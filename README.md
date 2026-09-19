<div align="center">
  <img src="public/branding/wft-logo.jfif" alt="Weatherford" height="72" />

  # Weatherford CoRod® Mobile Gripper™ Simulator

  Interactive, browser-based training simulator for the Weatherford CoRod® continuous-rod
  **Mobile Gripper (MG)** unit — 3D rig visualisation, a faithful operator console, guided
  procedures, emergency drills and a scored assessment mode.
</div>

---

## Overview

This is a React + TypeScript + Vite single-page app that recreates a CoRod MG operator
station. It combines a real-time hydraulic/physics simulation with a 3D rig viewport
(Three.js), a physical-looking control console, and training/assessment tooling. The UI
supports English and Arabic (RTL).

## Features

### Simulation & 3D
- **Real-time physics tick** (engine, hydraulics, squeeze pressure, string dynamics, BOP).
- **3D rig viewport** (Three.js/WebGL) with an operator sightline, gripper head, BOP/flange,
  service reel and free orbit, plus a 2D schematic and split views.
- **Directional rod/guide highlighting** — bright blue when running in hole (RIH), bright
  green when pulling out (POOH), and red during any squeeze-pressure alarm.

### Equipment Configuration (Injector Profiles)
- Select the **active injector type**; each profile has its own cylinder count, contact area,
  squeeze ceiling and **required-squeeze-vs-weight curve**.
- Imperial / metric units. Presets ship as mock data; custom profiles persist to
  `localStorage`.

### Well Design & String Architecture
- Build or select a **well design** before a run: target depth, run-operation type and an
  ordered, **tapered rod string** (multiple sections, each with size + length + nominal
  weight).
- Depth markers, string weight and required squeeze are computed **per depth** from the
  active (possibly tapered) design. A stage banner above the 3D view shows which segment is
  currently being run.

### Multi-Tiered Squeeze-Pressure Alarm (Slip / Free-Fall)
- **Tier 1 – Slip:** actual squeeze ≥ 50 PSI below required → looping slip alarm + red
  screen-edge highlight + status banner.
- **Tier 2 – Free-Fall:** deficit ≥ 100 PSI → escalated free-fall alarm. Hitting the safety
  relief during an operation also forces this tier.
- **Tier 3 – Emergency timeout:** no corrective action within 20 s → critical lockout tone.
- Non-blocking UI: a small corner pill shows the live PSI deficit; everything auto-clears the
  instant the operator corrects the squeeze.

### Audio
- Recorded engine/PTO, hydraulic and background pump-jack loops, all **proximity-aware**
  (volume scales with 3D camera distance to the relevant equipment).
- **Per-window audio control:** each pop-out (3D / console / gauges) and the main dashboard
  can be muted independently, so running multiple windows doesn't stack the sound.

### Multi-Window Operation
- Pop out the **3D View** or the **Console** into separate browser windows. State is synced
  across windows via `BroadcastChannel`; the primary window runs the simulation and pop-ups
  send authoritative control patches back to it.

### Training & Assessment
- Guided structured procedures, emergency drills, a scored continuous-assessment mode with a
  report/leaderboard, logbook, manual reference, JSA and glossary.

### Safety Interlocks
- Engine must be running before the string can be positioned (depth presets/slider are gated).
- Mechanical clamps can only be installed when the string is held (brake or safety clamp) and
  the reel is stationary.
- BOP regulator drives the pump toward the operator-set pressure (not a fixed value).

## Tech Stack

- **React 18 + TypeScript**
- **Vite** (dev server & build)
- **Three.js** for the 3D viewport
- **Tailwind-style utility classes** for UI
- **Web Audio API** for the sound engine
- i18n (English + Arabic / RTL)

## Run Locally

**Prerequisites:** Node.js (or Bun)

```bash
# install dependencies
npm install      # or: bun install

# start the dev server (http://localhost:3000)
npm run dev      # or: bun run dev

# production build
npm run build

# preview the production build
npm run preview
```

### View modes / pop-outs

Append a `view` query param to open a window in a specific mode:

- `/` — full dashboard
- `/?view=3d` — 3D viewport only
- `/?view=console` — control console only
- `/?view=gauges` — gauge panel only

## Project Structure

```
src/
  App.tsx                 # top-level app, physics tick, multi-window sync, handlers
  types.ts                # shared simulation types
  components/             # console, gauges, 3D viewport, panels, modals, physical controls
  data/                   # injector profiles, well designs, manual reference, scenarios
  i18n/                   # English/Arabic strings (split into parts)
  input/                  # keyboard/gamepad binding + input system
  utils/                  # audio engine, persistence, scoring, certificate/print
public/
  models/                 # .glb rig models
  sounds/                 # engine / alarm / ambience loops
  branding/, manual/      # images
```

## License

Internal training tool. All Weatherford and CoRod® marks belong to their respective owners.
