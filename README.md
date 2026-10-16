# Pi Trading — BulbyBots

A lightweight Pi Network market overview designed to use the same shared BulbyBots shell and glitzy visual language as the other pages.

## First version

- PI/USD indicative price averaged from Gate.io and MEXC spot tickers when available.
- Estimated market capitalisation calculated from price multiplied by circulating PI supply if the Pi Mainnet supply endpoint returns a valid value.
- Combined quote-volume figure for the tracked exchanges over the rolling 24 hours.
- 24-hour change and observed price range.
- One Cloudflare Pages Function (`/api/market`) with optional short-lived KV caching.
- Shared header, footer, favicon, theme preference, aurora background and starfield.

## Deploy

Connect this repository to Cloudflare Pages with root directory `/`, build command `npm run build`, and output directory `dist`. The static frontend needs no framework adapter; `functions/api/market.ts` is a Pages Function. Optional KV binding name: `PI_MARKET_CACHE`. It still works without KV, but public exchange APIs are requested on each refresh.

## Data notes

- The price is the arithmetic mean of the available Gate.io and MEXC PI/USDT last prices.
- The 24-hour volume is summed from the quote volumes those exchanges provide. It is therefore **tracked-exchange volume**, not a claim to be the entire global PI market volume.
- Market capitalisation is estimated from circulating supply, not the total value of money invested in Pi. Supply may be unavailable, in which case market cap remains blank rather than invented.
- API errors are shown as unavailable; the UI does not use hardcoded prices.

## Later expansions

Price-history chart, per-exchange volume table, USD/PHP converter, order-book depth, market movers, and a news/milestone timeline can be added separately.


## Public historical market data

- `/api/history?range=1y` uses CoinGecko's public market-chart endpoint for the `pi-network` asset. The frontend supports 30, 90, 180 and 365-day ranges.
- History is cached at the Worker edge for 15 minutes to reduce public API traffic.
- The endpoint provides daily/aggregated price and volume points, not full intraday OHLC candles. The UI labels highs and lows as observed daily prices, not all-time exchange candle extremes.
- If the public endpoint rate-limits or becomes unavailable, the page shows the provider error instead of inventing chart values.
- The live Gate.io/MEXC exchange snapshot remains separate from CoinGecko's aggregated historical series.
