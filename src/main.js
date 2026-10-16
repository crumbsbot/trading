import "./styles.css";

const API_URL = "/api/market";
const REFRESH_MS = 60_000;

const elements = {
  feedStatus: document.getElementById("feedStatus"),
  updatedAt: document.getElementById("updatedAt"),
  price: document.getElementById("priceValue"),
  change: document.getElementById("changePill"),
  marketCap: document.getElementById("marketCapValue"),
  volume: document.getElementById("volumeValue"),
  supply: document.getElementById("supplyValue"),
  range: document.getElementById("rangeValue"),
  source: document.getElementById("sourceValue"),
  detailUpdated: document.getElementById("detailUpdated"),
  exchangeGrid: document.getElementById("exchangeGrid"),
  priceSpread: document.getElementById("priceSpread"),
};

const hasNumber = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const usd = (value, digits = 2) => {
  if (!hasNumber(value)) return "—";
  return Number(value).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
};
const compactUsd = value => {
  if (!hasNumber(value)) return "—";
  const n = Number(value);
  if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(2) + "K";
  return usd(n, 2);
};
const amount = (value, digits = 2) => hasNumber(value) ? Number(value).toLocaleString("en-US", { maximumFractionDigits: digits }) : "—";
const timestamp = value => {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short", hour12: false }) + " UTC";
};
function setText(element, value) {
  if (element) element.textContent = value;
}
function formatPrice(value) {
  if (!hasNumber(value)) return "—";
  const n = Number(value);
  return usd(n, n < 0.01 ? 6 : n < 1 ? 4 : 2);
}
function render(data) {
  setText(elements.price, formatPrice(data.price_usd));
  setText(elements.marketCap, compactUsd(data.market_cap_usd));
  setText(elements.volume, compactUsd(data.volume_24h_usd));
  setText(elements.supply, hasNumber(data.circulating_supply) ? amount(data.circulating_supply, 0) + " PI" : "—");
  setText(elements.range, hasNumber(data.low_24h_usd) && hasNumber(data.high_24h_usd)
    ? formatPrice(data.low_24h_usd) + " – " + formatPrice(data.high_24h_usd) : "—");
  setText(elements.source, data.source_label || "Public exchange APIs");
  setText(elements.updatedAt, "Updated " + timestamp(data.updated_at));
  setText(elements.detailUpdated, timestamp(data.updated_at));
  setText(elements.priceSpread, hasNumber(data.price_spread_pct) ? Number(data.price_spread_pct).toFixed(3) + "% price difference" : "—");
  if (elements.exchangeGrid) {
    const exchanges = Array.isArray(data.exchanges) ? data.exchanges : [];
    elements.exchangeGrid.replaceChildren();
    if (!exchanges.length) {
      const empty = document.createElement("p");
      empty.className = "exchange-empty";
      empty.textContent = "Exchange data is temporarily unavailable.";
      elements.exchangeGrid.append(empty);
    } else {
      for (const exchange of exchanges) {
        const card = document.createElement("article");
        card.className = "exchange-card";
        const heading = document.createElement("div");
        heading.className = "exchange-heading";
        const name = document.createElement("h3");
        name.textContent = exchange.exchange || "Exchange";
        const pair = document.createElement("span");
        pair.className = "exchange-pair";
        pair.textContent = exchange.pair || "PI/USDT";
        heading.append(name, pair);
        const price = document.createElement("div");
        price.className = "exchange-price";
        price.textContent = formatPrice(exchange.price_usd);
        const details = document.createElement("dl");
        details.className = "exchange-details";
        const fields = [
          ["24h change", hasNumber(exchange.change_24h_pct) ? (Number(exchange.change_24h_pct) > 0 ? "+" : "") + Number(exchange.change_24h_pct).toFixed(2) + "%" : "—"],
          ["24h volume", compactUsd(exchange.volume_24h_usd)],
          ["24h low / high", hasNumber(exchange.low_24h_usd) && hasNumber(exchange.high_24h_usd) ? formatPrice(exchange.low_24h_usd) + " / " + formatPrice(exchange.high_24h_usd) : "—"]
        ];
        for (const [label, value] of fields) {
          const row = document.createElement("div");
          const dt = document.createElement("dt");
          dt.textContent = label;
          const dd = document.createElement("dd");
          dd.textContent = value;
          row.append(dt, dd);
          details.append(row);
        }
        card.append(heading, price, details);
        elements.exchangeGrid.append(card);
      }
    }
  }
  const pct = hasNumber(data.change_24h_pct) ? Number(data.change_24h_pct) : NaN;
  if (elements.change) {
    elements.change.classList.toggle("positive", Number.isFinite(pct) && pct >= 0);
    elements.change.classList.toggle("negative", Number.isFinite(pct) && pct < 0);
    setText(elements.change, Number.isFinite(pct) ? (pct > 0 ? "+" : "") + pct.toFixed(2) + "% · 24H" : "24H CHANGE —");
  }
  setText(elements.feedStatus, "Live market feed · refreshes every minute");
}
let running = false;
async function refresh() {
  if (running) return;
  running = true;
  try {
    const response = await fetch(API_URL, { headers: { Accept: "application/json" }, cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Market feed unavailable");
    render(data);
  } catch {
    setText(elements.feedStatus, "Market feed temporarily unavailable");
    if (!elements.price || elements.price.textContent === "—") setText(elements.updatedAt, "No current data available");
  } finally { running = false; }
}
void refresh();
window.setInterval(refresh, REFRESH_MS);
try {
  if (localStorage.getItem("crumbs-theme") === "pi") document.documentElement.dataset.theme = "violet";
} catch {}
document.addEventListener("bulbybot-theme-toggle", event => {
  const violet = event.detail?.theme === "violet";
  if (violet) document.documentElement.dataset.theme = "violet";
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem("crumbs-theme", violet ? "pi" : "green"); } catch {}
});