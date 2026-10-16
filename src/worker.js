import dailyPriceHistory from "./pi_daily_prices.json";

const MARKET_CACHE_SECONDS = 45;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=30, s-maxage=45",
      "access-control-allow-origin": "*",
    },
  });
}

async function fetchJson(url, timeoutMs = 5000) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error("Market provider returned HTTP " + response.status);
  return response.json();
}

async function fromGate() {
  const data = await fetchJson("https://api.gateio.ws/api/v4/spot/tickers?currency_pair=PI_USDT");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Gate.io returned no ticker");
  const price = Number(row.last);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Gate.io price invalid");
  const pct = Number(row.change_percentage);
  const high = Number(row.high_24h);
  const low = Number(row.low_24h);
  const volume = Number(row.quote_volume);
  return {
    price,
    change: Number.isFinite(pct) ? pct : null,
    high: Number.isFinite(high) ? high : null,
    low: Number.isFinite(low) ? low : null,
    volume: Number.isFinite(volume) ? volume : null,
    source: "Gate.io PI/USDT",
  };
}

async function fromMexc() {
  const row = await fetchJson("https://api.mexc.com/api/v3/ticker/24hr?symbol=PIUSDT");
  const price = Number(row.lastPrice);
  if (!Number.isFinite(price) || price <= 0) throw new Error("MEXC price invalid");
  const pct = Number(row.priceChangePercent);
  const high = Number(row.highPrice);
  const low = Number(row.lowPrice);
  const volume = Number(row.quoteVolume);
  return {
    price,
    change: Number.isFinite(pct) ? pct : null,
    high: Number.isFinite(high) ? high : null,
    low: Number.isFinite(low) ? low : null,
    volume: Number.isFinite(volume) ? volume : null,
    source: "MEXC PI/USDT",
  };
}

async function getSupply() {
  try {
    const body = await fetchJson("https://api.minepi.com/mainnet_supply?type=circulating", 5000);
    const candidates = [];
    if (typeof body === "number" || typeof body === "string") candidates.push(body);
    if (body && typeof body === "object") {
      for (const key of ["result", "circulating_supply", "circulatingSupply", "supply", "circulating"]) candidates.push(body[key]);
      if (body.data && typeof body.data === "object") {
        for (const key of ["result", "circulating_supply", "circulatingSupply", "supply", "circulating"]) candidates.push(body.data[key]);
      }
    }
    for (const candidate of candidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) return value;
    }
  } catch {
    // Supply is optional. Never fabricate market cap if the supply endpoint fails.
  }
  return null;
}

async function marketData() {
  const settled = await Promise.allSettled([fromGate(), fromMexc()]);
  const rows = settled
    .filter(item => item.status === "fulfilled")
    .map(item => item.value);

  if (!rows.length) {
    return json({
      error: "Live Pi market data is temporarily unavailable. Please try again shortly.",
      price_usd: null,
      market_cap_usd: null,
      volume_24h_usd: null,
      updated_at: new Date().toISOString(),
    }, 503);
  }

  const price = rows.reduce((sum, row) => sum + row.price, 0) / rows.length;
  const supply = await getSupply();
  const changes = rows.map(row => row.change).filter(Number.isFinite);
  const highs = rows.map(row => row.high).filter(Number.isFinite);
  const lows = rows.map(row => row.low).filter(Number.isFinite);
  const volumes = rows.map(row => row.volume).filter(Number.isFinite);

  return json({
    price_usd: Number(price.toFixed(8)),
    market_cap_usd: supply == null ? null : Math.round(price * supply),
    circulating_supply: supply,
    change_24h_pct: changes.length ? Number((changes.reduce((a, b) => a + b, 0) / changes.length).toFixed(4)) : null,
    high_24h_usd: highs.length ? Math.max(...highs) : null,
    low_24h_usd: lows.length ? Math.min(...lows) : null,
    volume_24h_usd: volumes.length ? Math.round(volumes.reduce((a, b) => a + b, 0)) : null,
    source_label: rows.map(row => row.source).join(" + ") + (supply != null ? " + Pi Mainnet supply" : ""),
    sources_used: rows.map(row => row.source),
    exchanges: rows.map(row => ({
      exchange: row.source.replace(" PI/USDT", ""),
      pair: "PI/USDT",
      price_usd: row.price,
      change_24h_pct: row.change,
      high_24h_usd: row.high,
      low_24h_usd: row.low,
      volume_24h_usd: row.volume,
    })),
    price_spread_pct: rows.length > 1 ? Number((((Math.max(...rows.map(row => row.price)) - Math.min(...rows.map(row => row.price))) / price) * 100).toFixed(4)) : null,
    updated_at: new Date().toISOString(),
  });
}


const HISTORY_RANGES = new Map([["1mo", 30], ["3mo", 90], ["6mo", 180], ["1y", 365]]);

async function historyData(range) {
  if (!HISTORY_RANGES.has(range)) range = "1y";
  const days = HISTORY_RANGES.get(range);
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 86400000);
  const startDay = startDate.toISOString().slice(0, 10);
  const endDay = endDate.toISOString().slice(0, 10);
  const allPoints = dailyPriceHistory.map(row => ({
    date: row.date,
    time: Math.floor(Date.parse(row.date + "T00:00:00Z") / 1000),
    open: null,
    high: null,
    low: null,
    close: Number(row.price_usd),
    volume: null,
    market_cap: null
  })).filter(point => Number.isFinite(point.time) && Number.isFinite(point.close) && point.close > 0)
    .sort((a, b) => a.time - b.time);
  const points = allPoints.filter(point => point.date >= startDay && point.date <= endDay);
  if (points.length < 2) throw new Error("The recorded daily price list contains too few points for this range");
  const latest = points[points.length - 1];
  const previous = points.length > 1 ? points[points.length - 2] : null;
  const pointBeforeDays = daysAgo => points.find(point => point.time >= latest.time - daysAgo * 86400) || points[0];
  const sevenDayPoint = pointBeforeDays(7);
  const thirtyDayPoint = pointBeforeDays(30);
  const closes = points.map(point => point.close);
  return {
    symbol: "PI",
    currency: "USD",
    range,
    interval: "daily",
    points,
    statistics: {
      current_price_usd: latest.close,
      previous_close_usd: previous ? previous.close : null,
      change_7d_pct: sevenDayPoint.close ? (latest.close / sevenDayPoint.close - 1) * 100 : null,
      change_30d_pct: thirtyDayPoint.close ? (latest.close / thirtyDayPoint.close - 1) * 100 : null,
      latest_volume_usd: null,
      period_high_usd: Math.max(...closes),
      period_low_usd: Math.min(...closes),
      all_time_high_usd: null,
      all_time_low_usd: null,
      latest_volume: null,
      latest_timestamp: latest.time,
      previous_point_usd: previous ? previous.close : null
    },
    source: "Recorded daily PI price history",
    updated_at: new Date().toISOString()
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/market") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      const cache = caches.default;
      const cacheKey = new Request(new URL("/api/market", url.origin).toString(), { method: "GET" });
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
      const response = await marketData();
      if (response.ok) {
        const cacheable = new Response(response.body, response);
        cacheable.headers.set("cache-control", "public, max-age=30, s-maxage=" + MARKET_CACHE_SECONDS);
        ctx.waitUntil(cache.put(cacheKey, cacheable.clone()));
        return cacheable;
      }
      return response;
    }
    if (url.pathname === "/api/history") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      const range = HISTORY_RANGES.has(url.searchParams.get("range")) ? url.searchParams.get("range") : "1y";
      const cache = caches.default;
      const cacheKey = new Request(new URL("/api/history?range=" + range, url.origin).toString(), { method: "GET" });
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
      try {
        const data = await historyData(range);
        const response = json(data);
        const cacheable = new Response(response.body, response);
        cacheable.headers.set("cache-control", "public, max-age=300, s-maxage=900");
        ctx.waitUntil(cache.put(cacheKey, cacheable.clone()));
        return cacheable;
      } catch (error) {
        return json({ error: "Recorded historical PI prices are temporarily unavailable.", detail: String(error?.message || error), source: "Recorded daily PI price history", updated_at: new Date().toISOString() }, 502);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
