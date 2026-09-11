# Resonance

[![CI](../../actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)

An interactive simulation of resonance in driven oscillating systems, built with [SceneryStack](https://scenerystack.org/).
Visualize driven mass-spring systems and Chladni plate vibration patterns.

## Features

- **Single Oscillator** — driven damped harmonic oscillator with spring presets and frequency sweep
- **Multiple Oscillators** — 1–10 oscillators with different natural frequencies driven together
- **Phase Analysis** — phase lag and phase-space plots near resonance
- **Chladni Patterns** — particles on vibrating plates revealing nodal lines and mode shapes
- Real-time controls for mass, spring constant, damping, driving frequency, and amplitude
- Configurable phase-space graphs, trace mode, and 25+ analytical properties
- English, Spanish, and French UI with multiple color profiles and PWA support

## Quick Start

```bash
npm install
npm run icons    # generate PNG icons from public/icons/icon.svg
npm start        # dev server → http://localhost:5173
```

## Scripts

| Command | Description |
|---|---|
| `npm start` / `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + production build → `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run check` | TypeScript type check |
| `npm run lint` | Biome lint check |
| `npm run format` | Auto-format all files |
| `npm run fix` | Lint + auto-fix |
| `npm test` | Run Vitest unit tests |
| `npm run icons` | Regenerate PNG icons from `public/icons/icon.svg` |
| `npm run clean` | Remove `dist/` |

## Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| [SceneryStack](https://scenerystack.org/) | ^3.0.0 | Simulation framework |
| [Vite](https://vitejs.dev/) | ^8 | Build tool + dev server |
| [TypeScript](https://www.typescriptlang.org/) | ^7 | Type-safe JavaScript |
| [Biome](https://biomejs.dev/) | ^2.5 | Linting + formatting |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) | ^1 | PWA + service worker |

## License

GNU Affero General Public License v3.0 — see [OpenLyceum org license](https://github.com/OpenLyceum/.github/blob/main/LICENSE).

## Contributing

See [OpenLyceum contributing guidelines](https://github.com/OpenLyceum/.github/blob/main/CONTRIBUTING.md).
Report bugs via GitHub Issues; use org issue templates.
