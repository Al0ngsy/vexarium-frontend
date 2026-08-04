# VEXARIUM Frontend

SvelteKit + Tailwind CSS v4 client for the VEXARIUM trading signal & options analysis tool — **informational only, not financial advice.**

Arasaka-corporate visual identity (Cyberpunk 2077): near-black surfaces, crimson accents, stark white, angular 4px radii, UPPERCASE labels, JetBrains Mono for prices/Greeks.

## Features

- **Analysis view** (`/analysis/[symbol]`) — overall verdict hero, indicator cards with progressive disclosure (click to see plain-language explanation), AI analysis panel.
- **Options view** (`/options/[symbol]`) — beginner-friendly strategy cards (OptionStrat-inspired) with mini P/L charts, plain-language subtitles + info popovers, Greeks grid, and payoff timeline. Each strategy explains *why* in simple terms.
- **Portfolio view** (`/portfolio`) — saved trades with live HOLD / TAKE PROFIT / CUT LOSS stance badges, P/L tracking, localStorage persistence (DB sync for authed users via the trades API).
- **Legal pages** — disclaimer, terms, privacy (GDPR).
- **Arasaka design system** — design tokens in `src/app.css`, shared components, chart theming for TradingView Lightweight Charts.

## Tech Stack

SvelteKit 2 (runes) · Svelte 5 · Tailwind CSS v4 · TypeScript · TradingView Lightweight Charts · Lucide icons · @fontsource (self-hosted)

## Project Structure

```
frontend/
├── src/
│   ├── app.css              # Arasaka design tokens + utility classes
│   ├── app.d.ts
│   ├── lib/
│   │   ├── api.ts           # typed client for the VEXARIUM backend
│   │   ├── types.ts         # shared TS types mirroring backend schemas
│   │   ├── verdict.ts       # verdict/stance → color/icon/label maps
│   │   ├── storage.ts       # localStorage CRUD for saved trades
│   │   └── chart-theme.ts   # Lightweight Charts Arasaka theme
│   ├── components/          # IndicatorCard, VerdictBadge, StrategyCard, PayoffChart,
│   │                        #   InfoPopover, SaveTradeModal, TradeCard, LegalLayout
│   └── routes/
│       ├── +layout.svelte   # header (ANALYSIS / PORTFOLIO) + footer (legal links)
│       ├── +page.svelte     # symbol search → routes to analysis/options
│       ├── analysis/[symbol]/+page.svelte
│       ├── options/[symbol]/+page.svelte
│       ├── portfolio/+page.svelte
│       └── legal/           # disclaimer, terms, privacy
├── vite.config.ts           # adapter-cloudflare, Tailwind v4 plugin, /api dev proxy
└── package.json
```

## Setup

Requires Node.js 22+ and Yarn Berry (v4). The repo pins Yarn 4.17.0 via `packageManager` + a committed release in `.yarn/releases/`.

```bash
cd frontend
corepack enable          # activate the pinned Yarn version (once)
yarn install
```

## Run

```bash
yarn dev                 # http://localhost:5173 (proxies /api → http://localhost:8000)
```

Start the backend first (see `backend/README.md`). The dev proxy forwards `/api` to the FastAPI server.

To point the client at a non-local backend:

```bash
VITE_API_URL=https://your-api.example.com yarn dev
```

## Build & Deploy

```bash
yarn check               # svelte-check (type checking)
yarn build               # production build via @sveltejs/adapter-cloudflare
```

The app is pre-configured for **Cloudflare Pages** via `@sveltejs/adapter-cloudflare` (SSR, ~5ms cold start on the free tier). Build output goes to `.svelte-kit/cloudflare`.

### Deploy to Cloudflare Pages (recommended, free)

1. Push the repo to GitHub (`Al0ngsy`).
2. In the Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Pick the repo + `frontend` as the root directory.
4. Build settings:
   - **Build command:** `yarn build`
   - **Output directory:** `.svelte-kit/cloudflare`
   - **Framework preset:** SvelteKit (auto-detected)
5. Add environment variable `VITE_API_URL` pointing at your deployed backend (e.g. `https://api.vexarium.com`).
6. Deploy. Optionally set a custom domain (e.g. `app.vexarium.com`).

> The GitHub Actions workflow also runs `yarn build` on every push/PR, so a failed build blocks the branch.

## Design Language

| Token | Value | Use |
|---|---|---|
| `--background` | `#0a0a0c` | Page background |
| `--surface` / `--panel-bg` | `#121215` | Panels / cards |
| `--accent-primary` | `#c81e1e` | Crimson — actions, focus, active states |
| `--foreground` | `#f5f5f7` | Primary text |
| `--foreground-muted` | `#9999a0` | Secondary text |
| Verdict colors | green → amber → red | strong_buy → strong_sell |
| Stance colors | green / blue / red | TAKE PROFIT / HOLD / CUT LOSS |

Rules: opaque panels (no glassmorphism), 4px radius, thin `#2a2a30` borders, UPPERCASE labels with `0.08em` tracking, JetBrains Mono for numeric data, crimson (not neon) as the single accent.

---

**⚠️ Disclaimer:** VEXARIUM provides educational analysis only — not financial or investment advice. Options trading involves significant risk of loss.
