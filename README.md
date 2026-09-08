# Evergreen Growth

A silent, continuous architectural journey for Evergreen Growth, with a complete editorial Reading view. The static HTML contains all company content before animation starts.

## Run locally

Use Node.js 22.12 or newer. Dependencies are pinned in `package.json` and `package-lock.json`.

```sh
cd /home/charlie/Desktop/evergreen-immersive
npm ci
npm run dev
```

Open **http://localhost:5173**. For the production build:

```sh
npm run build
npm run preview
```

Open **http://localhost:4173**. The complete static output is in `dist/`; serve this directory through an HTTP server. Relative build paths support hosting under a subdirectory. No server application, API keys, third-party requests, or sound files are needed.

## Maintain the site

| File             | Edit here                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `index.html`     | Company copy, event archive, statistics, links, email, accessible labels                                                 |
| `src/style.css`  | Typography, palette, responsive layouts, reading presentation                                                            |
| `src/journey.ts` | Scene origins, camera positions and targets, chapter mapping, transition duration ratios, resolution and frame-rate caps |
| `src/world.ts`   | Procedural geometry, shared materials, studio lighting, subtle object movement                                           |
| `src/main.ts`    | Navigation, native scroll mapping, content measurements, view persistence, fallback handling                             |
| `public/images/` | Pre-rendered scene illustrations used in Reading view and before WebGL is ready                                          |
| `public/fonts/`  | Self-hosted Manrope and Instrument Serif, with their OFL licenses                                                        |

The eight camera stops map to six public fragments: `#top`, `#statement`, `#heritage`, `#activities`, `#events`, and `#contact`. Activities contains three sequential stops. Footer links can use `data-destination="direct"` or `data-destination="giving"` to go to a specific activity while retaining `#activities` as the public fragment. Without JavaScript, these links still reach the complete Activities section.

Add an event by duplicating an `.event` article in the HTML. Keep its machine-readable `datetime`, visible date, and past-tense description in agreement. All supplied events are historical 2024 gatherings. Do not present them as upcoming events.

Reading intervals are measured from actual content height. Short panels hold at a stable camera stop; long panels remain in normal document flow so all text can be read. Camera motion resumes between reading intervals. Width changes and font loading trigger remeasurement. Avoid assigning fixed heights or overflow clipping to the copy.

The default is Immersive when WebGL works. Reduced motion defaults to Reading. Explicit selections use the local-storage key `evergreen-view`. If WebGL fails or its context is lost, the site preserves the current chapter in Reading view. All text and native links remain available when JavaScript is disabled. No analytics or remote services are used.

## Verify and capture

```sh
npm run build
npm test
```

The Playwright suite starts the production preview and covers navigation, history, fragment reloads, reading preferences, keyboard access, reduced motion, JavaScript and WebGL failure, context loss, slow scene loading, content preservation, and responsive layouts. Screenshots and traces are retained for failures. Results are written to `artifacts/test-report.json`.

For a fresh development environment, install Chromium with `npx playwright install chromium`. The browser helper also recognizes the Chromium already installed in this workspace. With a graphical Linux session, verification uses visible Chromium and the available OpenGL GPU; otherwise it uses headless Chromium. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to choose another Chromium executable.

With the development server running:

```sh
npm run capture
node scripts/verify-motion.mjs
node scripts/verify-zoom.mjs
node scripts/verify-accessibility.mjs
node scripts/capture-motion.mjs
```

`capture` regenerates the eight static WebP illustrations from the actual scene, then saves desktop and touch-mobile chapter screenshots plus full Reading screenshots. After updating the illustrations, run `npm run build` again to include them in `dist/`.

`verify-motion` measures every stop and forward/reverse camera travel, then verifies that rendering pauses in Reading view and a hidden tab. It requires a visible browser for the hidden-tab check and writes `artifacts/performance.json`. The mobile result is viewport/touch emulation on the available GPU, not a measurement from a physical phone.

`verify-zoom` is an optional Linux/X11 check that applies actual 200% Chromium zoom to its own test window. It requires `python3`, `xwininfo`, `libX11`, and `libXtst`, and saves its dimensions and screenshots. The regular test suite also covers the equivalent reduced CSS viewport.

`verify-accessibility` runs axe WCAG A/AA checks in both views. `capture-motion` records a silent browser walkthrough, including entry, forward travel, and reverse travel, to `artifacts/journey-preview.webm`.

The camera changes heading between pavilions and follows configurable raised arcs between reading stops. Projected scene anchors also drive perspective, displacement, and scale of the HTML headings; they settle flat for reading. These are the core spatial effects adapted from the reference. The lighter art direction, semantic HTML, native scrolling, and absence of sound are intentional requirements of this version.

## Design and content provenance

Company content comes exclusively from `../evergreen-tech/index.html`. See `CONTENT-AUDIT.md` for the mapping and editorial decisions. The original folder is unchanged.

[Yamauchi No.10](https://y-n10.com/) informed the continuous spatial journey and alternate reading presentation. The artwork, geometry, styling, and implementation here are original procedural work. Robotics, reconstructed worlds, and energy structures are visual metaphors, not additional investment claims.

The renderer uses [Three.js](https://threejs.org/docs/pages/WebGLRenderer.html), with [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) connected to native document scrolling. The site is English-only and static; public deployment is outside this deliverable.
