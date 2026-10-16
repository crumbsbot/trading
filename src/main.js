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
  historyStatus: document.getElementById("historyStatus"),
  priceChart: document.getElementById("priceChart"),
  historyChange: document.getElementById("historyChange"),
  periodHigh: document.getElementById("periodHigh"),
  periodLow: document.getElementById("periodLow"),
  historyLatest: document.getElementById("historyLatest"),
  chartStart: document.getElementById("chartStart"),
  chartEnd: document.getElementById("chartEnd"),
  previousClose: document.getElementById("previousClose"),
  change7d: document.getElementById("change7d"),
  change30d: document.getElementById("change30d"),
  historyVolume: document.getElementById("historyVolume"),
  allTimeHigh: document.getElementById("allTimeHigh"),
  allTimeLow: document.getElementById("allTimeLow"),
  allTimeHighDate: document.getElementById("allTimeHighDate"),
  allTimeLowDate: document.getElementById("allTimeLowDate"),
  volumeMarketCap: document.getElementById("volumeMarketCap"),
  historySource: document.getElementById("historySource"),
  historyUpdated: document.getElementById("historyUpdated")
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
  const volumeCapRatio = hasNumber(data.market_cap_usd) && Number(data.market_cap_usd) > 0 && hasNumber(data.volume_24h_usd) ? Number(data.volume_24h_usd) / Number(data.market_cap_usd) * 100 : null;
  setText(elements.volumeMarketCap, hasNumber(volumeCapRatio) ? volumeCapRatio.toFixed(3) + "%" : "—");
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

const HISTORY_API = "/api/history";
let selectedRange = "1y";
let historyBusy = false;
const historyUsd = value => hasNumber(value) ? usd(value, Number(value) < 0.01 ? 6 : Number(value) < 1 ? 4 : 2) : "—";
const historyDate = value => {
  if (!Number.isFinite(Number(value))) return "—";
  return new Date(Number(value) * 1000).toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });
};
function svgNode(name, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}
function drawHistoryChart(points) {
  const svg = elements.priceChart;
  if (!svg) return;
  svg.replaceChildren();
  const cleanPoints = points
    .filter(point => hasNumber(point.close) && Number.isFinite(Number(point.time)))
    .map(point => ({ ...point, close: Number(point.close), time: Number(point.time) }));
  if (cleanPoints.length < 2) {
    const label = svgNode("text", { x: 500, y: 150, "text-anchor": "middle" });
    label.textContent = "Not enough recorded prices to draw a chart.";
    svg.append(label);
    return;
  }
  const width = 1000, height = 300, left = 12, right = 12, top = 18, bottom = 24;
  const values = cleanPoints.map(point => point.close);
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || Math.max(Math.abs(max) * 0.02, 0.000001);
  const x = i => left + (i / (cleanPoints.length - 1)) * (width - left - right);
  const y = value => top + ((max - value) / span) * (height - top - bottom);
  for (let i = 0; i < 4; i++) {
    const yy = top + i * (height - top - bottom) / 3;
    svg.append(svgNode("line", { x1: left, x2: width - right, y1: yy, y2: yy, class: "chart-gridline" }));
  }
  const path = values.map((value, i) => (i ? "L" : "M") + x(i).toFixed(2) + " " + y(value).toFixed(2)).join(" ");
  const area = path + " L " + x(values.length - 1) + " " + (height - bottom) + " L " + x(0) + " " + (height - bottom) + " Z";
  svg.append(svgNode("path", { d: area, class: "chart-area" }));
  svg.append(svgNode("path", { d: path, class: "chart-line" }));

  // A live crosshair and readable tooltip follow the nearest daily point.
  const crosshair = svgNode("line", { x1: x(values.length - 1), x2: x(values.length - 1), y1: top, y2: height - bottom, class: "chart-crosshair", visibility: "hidden" });
  const focusDot = svgNode("circle", { cx: x(values.length - 1), cy: y(values[values.length - 1]), r: 5, class: "chart-focus-point", visibility: "hidden" });
  const tooltip = svgNode("g", { class: "chart-tooltip", visibility: "hidden", "pointer-events": "none" });
  const tooltipBg = svgNode("rect", { x: 0, y: 0, width: 188, height: 52, rx: 8, class: "chart-tooltip-bg" });
  const tooltipDate = svgNode("text", { x: 10, y: 19, class: "chart-tooltip-date" });
  const tooltipPrice = svgNode("text", { x: 10, y: 40, class: "chart-tooltip-price" });
  tooltip.append(tooltipBg, tooltipDate, tooltipPrice);
  svg.append(crosshair, focusDot, tooltip);

  const last = svgNode("circle", { cx: x(values.length - 1), cy: y(values[values.length - 1]), r: 4.5, class: "chart-last-point" });
  svg.append(last);
  const maxLabel = svgNode("text", { x: width - right, y: 12, "text-anchor": "end", class: "chart-value-label" });
  maxLabel.textContent = historyUsd(max);
  const minLabel = svgNode("text", { x: width - right, y: height - bottom - 4, "text-anchor": "end", class: "chart-value-label" });
  minLabel.textContent = historyUsd(min);
  svg.append(maxLabel, minLabel);
  svg.setAttribute("tabindex", "0");
  svg.setAttribute("aria-label", "Interactive Pi price chart. Hover, tap, or use the left and right arrow keys to inspect each date and price.");

  let selectedIndex = cleanPoints.length - 1;
  const showPoint = index => {
    selectedIndex = Math.max(0, Math.min(cleanPoints.length - 1, index));
    const point = cleanPoints[selectedIndex];
    const px = x(selectedIndex), py = y(point.close);
    crosshair.setAttribute("x1", px); crosshair.setAttribute("x2", px);
    crosshair.setAttribute("visibility", "visible");
    focusDot.setAttribute("cx", px); focusDot.setAttribute("cy", py);
    focusDot.setAttribute("visibility", "visible");
    const boxX = px > width * 0.68 ? px - 200 : Math.min(width - 200, px + 14);
    const boxY = py < 82 ? Math.min(height - bottom - 56, py + 12) : Math.max(top, py - 62);
    tooltip.setAttribute("transform", "translate(" + boxX + " " + boxY + ")");
    tooltipDate.textContent = historyDate(point.time) + (point.is_live ? " · LIVE" : "");
    tooltipPrice.textContent = historyUsd(point.close) + " per PI";
    tooltip.setAttribute("visibility", "visible");
    setText(elements.historyLatest, historyUsd(point.close));
    setText(elements.chartEnd, historyDate(point.time) + (point.is_live ? " · LIVE" : ""));
  };
  const hidePoint = () => {
    crosshair.setAttribute("visibility", "hidden");
    focusDot.setAttribute("visibility", "hidden");
    tooltip.setAttribute("visibility", "hidden");
  };
  const selectFromPointer = event => {
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    const svgX = (event.clientX - rect.left) / rect.width * width;
    const ratio = Math.max(0, Math.min(1, (svgX - left) / (width - left - right)));
    showPoint(Math.round(ratio * (cleanPoints.length - 1)));
  };
  svg.onpointermove = selectFromPointer;
  svg.onpointerdown = event => {
    selectFromPointer(event);
    if (event.pointerType === "touch") event.preventDefault();
  };
  svg.onpointerleave = hidePoint;
  svg.onblur = hidePoint;
  svg.onkeydown = event => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      showPoint(selectedIndex + (event.key === "ArrowRight" ? 1 : -1));
    } else if (event.key === "Escape") hidePoint();
  };
  showPoint(cleanPoints.length - 1);
}
function renderHistory(data) {
  const points = Array.isArray(data.points) ? data.points : [];
  const stats = data.statistics || {};
  drawHistoryChart(points);
  const first = points.find(point => hasNumber(point.close));
  const last = [...points].reverse().find(point => hasNumber(point.close));
  const change = first && last && Number(first.close) !== 0 ? (Number(last.close) / Number(first.close) - 1) * 100 : null;
  setText(elements.historyChange, hasNumber(change) ? (change > 0 ? "+" : "") + change.toFixed(2) + "%" : "—");
  if (elements.historyChange) elements.historyChange.className = "stat-value " + (hasNumber(change) ? (change >= 0 ? "positive" : "negative") : "");
  setText(elements.periodHigh, historyUsd(stats.period_high_usd));
  setText(elements.periodLow, historyUsd(stats.period_low_usd));
  setText(elements.historyLatest, historyUsd(last?.close ?? stats.current_price_usd));
  setText(elements.chartStart, first ? historyDate(first.time) : "—");
  setText(elements.chartEnd, last ? historyDate(last.time) : "—");
  setText(elements.previousClose, historyUsd(stats.previous_close_usd));
  setText(elements.change7d, hasNumber(stats.change_7d_pct) ? (stats.change_7d_pct > 0 ? "+" : "") + Number(stats.change_7d_pct).toFixed(2) + "%" : "—");
  setText(elements.change30d, hasNumber(stats.change_30d_pct) ? (stats.change_30d_pct > 0 ? "+" : "") + Number(stats.change_30d_pct).toFixed(2) + "%" : "—");
  setText(elements.historyVolume, compactUsd(stats.latest_volume_usd));
  setText(elements.allTimeHigh, historyUsd(stats.period_high_usd));
  setText(elements.allTimeLow, historyUsd(stats.period_low_usd));
  const maxPoint = points.reduce((best, p) => !best || Number(p.close) > Number(best.close) ? p : best, null);
  const minPoint = points.reduce((best, p) => !best || Number(p.close) < Number(best.close) ? p : best, null);
  setText(elements.allTimeHighDate, maxPoint ? "Highest daily price · " + historyDate(maxPoint.time) : "No historical point");
  setText(elements.allTimeLowDate, minPoint ? "Lowest daily price · " + historyDate(minPoint.time) : "No historical point");
  setText(elements.historySource, data.source || "Recorded daily PI price history");
  setText(elements.historyUpdated, "Fetched " + timestamp(data.updated_at));
  setText(elements.historyStatus, points.length + " price points · " + data.interval);
}
async function refreshHistory(range = selectedRange) {
  if (historyBusy) return;
  historyBusy = true;
  selectedRange = range;
  setText(elements.historyStatus, "Loading " + range + " history…");
  document.querySelectorAll("[data-history-range]").forEach(button => {
    const active = button.dataset.historyRange === range;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  let dataErrorMessage = "";
  try {
    const response = await fetch(HISTORY_API + "?range=" + encodeURIComponent(range), { headers: { Accept: "application/json" }, cache: "no-store" });
    const data = await response.json();
    if (!response.ok) { dataErrorMessage = data?.detail || data?.error || ("HTTP " + response.status); throw new Error(dataErrorMessage); }
    renderHistory(data);
  } catch (error) {
    dataErrorMessage = dataErrorMessage || error?.message || "Historical data unavailable";
    setText(elements.historyStatus, "Unavailable · " + dataErrorMessage);
    if (elements.priceChart) {
      elements.priceChart.replaceChildren();
      const message = svgNode("text", { x: 500, y: 150, "text-anchor": "middle" });
      message.textContent = "Public market history is temporarily unavailable.";
      elements.priceChart.append(message);
    }
  } finally { historyBusy = false; }
}
document.querySelectorAll("[data-history-range]").forEach(button => button.addEventListener("click", () => void refreshHistory(button.dataset.historyRange)));

void refresh();
void refreshHistory();
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