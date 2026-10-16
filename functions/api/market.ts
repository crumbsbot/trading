type Kv = { get(key: string, type?: "json"): Promise<unknown>; put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> };
type Env = { PI_MARKET_CACHE?: Kv };
type MarketRow = { price: number; change: number | null; high: number | null; low: number | null; volume: number | null; source: string };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=30, s-maxage=45" },
});
async function fetchJson(url: string, timeoutMs = 5000): Promise<unknown> {
  const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error("Market provider returned HTTP " + response.status);
  return response.json() as Promise<unknown>;
}
async function fromGate(): Promise<MarketRow> {
  const data = await fetchJson("https://api.gateio.ws/api/v4/spot/tickers?currency_pair=PI_USDT");
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!row) throw new Error("Gate.io returned no ticker");
  const price = Number(row.last);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Gate.io price invalid");
  const pctRaw = Number(row.change_percentage);
  const high = Number(row.high_24h);
  const low = Number(row.low_24h);
  const volume = Number(row.quote_volume);
  return { price, change: Number.isFinite(pctRaw) ? pctRaw : null, high: Number.isFinite(high) ? high : null, low: Number.isFinite(low) ? low : null, volume: Number.isFinite(volume) ? volume : null, source: "Gate.io PI/USDT" };
}
async function fromMexc(): Promise<MarketRow> {
  const row = await fetchJson("https://api.mexc.com/api/v3/ticker/24hr?symbol=PIUSDT") as Record<string, unknown>;
  const price = Number(row.lastPrice);
  if (!Number.isFinite(price) || price <= 0) throw new Error("MEXC price invalid");
  const pct = Number(row.priceChangePercent);
  const high = Number(row.highPrice);
  const low = Number(row.lowPrice);
  const volume = Number(row.quoteVolume);
  return { price, change: Number.isFinite(pct) ? pct : null, high: Number.isFinite(high) ? high : null, low: Number.isFinite(low) ? low : null, volume: Number.isFinite(volume) ? volume : null, source: "MEXC PI/USDT" };
}
async function getSupply(): Promise<number | null> {
  try {
    const body = await fetchJson("https://api.minepi.com/mainnet_supply?type=circulating", 5000) as unknown;
    const candidates: unknown[] = [];
    if (typeof body === "number" || typeof body === "string") candidates.push(body);
    if (body && typeof body === "object") {
      const record = body as Record<string, unknown>;
      for (const key of ["result", "circulating_supply", "circulatingSupply", "supply", "circulating"]) candidates.push(record[key]);
      if (record.data && typeof record.data === "object") {
        const data = record.data as Record<string, unknown>;
        for (const key of ["result", "circulating_supply", "circulatingSupply", "supply", "circulating"]) candidates.push(data[key]);
      }
    }
    for (const candidate of candidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) return value;
    }
  } catch { /* supply source is optional; never fabricate a market cap */ }
  return null;
}
export async function onRequestGet({ env }: { env: Env }) {
  try {
    const cached = await env.PI_MARKET_CACHE?.get("pi-market:latest", "json") as (Record<string, unknown> & { cached_at?: number }) | null;
    if (cached && Number(cached.price_usd) > 0 && (Number(cached.market_cap_usd) > 0 || cached.market_cap_usd === null) && Number(cached.cached_at) > 0 && Date.now() / 1000 - Number(cached.cached_at) < 45) return json({ ...cached, cache: "hit" });
  } catch { /* cache is optional */ }
  const results = await Promise.allSettled([fromGate(), fromMexc()]);
  const rows = results.filter((item): item is PromiseFulfilledResult<MarketRow> => item.status === "fulfilled").map(item => item.value);
  if (!rows.length) {
    return json({ error: "Live Pi market data is temporarily unavailable. Please try again shortly.", price_usd: null, market_cap_usd: null, volume_24h_usd: null, updated_at: new Date().toISOString() }, 503);
  }
  // Mean of live spot prices; volume total is limited to the tracked exchanges below.
  const price = rows.reduce((sum, row) => sum + row.price, 0) / rows.length;
  const supply = await getSupply();
  const cap = supply == null ? null : price * supply;
  const changes = rows.map(row => row.change).filter((value): value is number => value != null && Number.isFinite(value));
  const highs = rows.map(row => row.high).filter(value => value != null && Number.isFinite(value));
  const lows = rows.map(row => row.low).filter(value => value != null && Number.isFinite(value));
  const volumes = rows.map(row => row.volume).filter(value => value != null && Number.isFinite(value));
  const result = {
    price_usd: Number(price.toFixed(8)),
    market_cap_usd: cap == null ? null : Math.round(cap),
    circulating_supply: supply,
    change_24h_pct: changes.length ? Number((changes.reduce((a, b) => a + b, 0) / changes.length).toFixed(4)) : null,
    high_24h_usd: highs.length ? Math.max(...highs) : null,
    low_24h_usd: lows.length ? Math.min(...lows) : null,
    volume_24h_usd: volumes.length ? Math.round(volumes.reduce((a, b) => a + b, 0)) : null,
    source_label: rows.map(row => row.source).join(" + ") + (supply != null ? " + Pi Mainnet supply" : ""),
    sources_used: rows.map(row => row.source),
    updated_at: new Date().toISOString(),
    cached_at: Math.floor(Date.now() / 1000),
  };
  try { await env.PI_MARKET_CACHE?.put("pi-market:latest", JSON.stringify(result), { expirationTtl: 45 }); } catch { /* optional */ }
  return json(result);
}