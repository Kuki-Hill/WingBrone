# WIND//01 — UI review

Historical review of the 1 November version. The current CRT treatment and 25-attack trial are documented in [the latest review](../crt-review/README.md). Baselines below preserve the earlier design.

## Original visual system

The interface uses the composition principles of 1990s anime title sequences: cropped display type, asymmetry, chapter numbering, sharp rules, restrained diagonal blocks, and compact tactical annotations. Cowboy Bebop and Evangelion were references for typography and information hierarchy only. No logos, character art, frames, or interface assets from those works are included.

The user's art direction takes priority over the generic suggestions returned by UI UX Pro Max. Its accessibility, focus, semantic-colour and reduced-motion guidance informed the checks. No UI component library or web-font service was added.

| Token | Value | Use |
| --- | --- | --- |
| Ink | `#030506` | Canvas and UI backgrounds |
| Paper | `#E8E1D2` | Text, primary buttons, neutral rules |
| Safe | `#B7F52A` | Face recognition, dodge window, successful dodge |
| Attack | `#FF4D27` | Attack blade/trail, impact, error, countdown |
| Violet | `#49316D` | Chapter cuts, selected input mode |

Display: local Impact/Arial Narrow. Chinese: local Microsoft YaHei/PingFang. Data: local Cascadia Mono/Consolas. Text is Traditional Chinese and English. The keepsake's text was localised without changing capture selection, storage, scoring, composition dimensions, or download flow.

## Development-only fixtures

Start a second Vite development server if port 5174 is already used by the normal preview:

```sh
npm run dev -- --port 5175 --strictPort
```

Use `http://127.0.0.1:5175/?review=home`. Supported states:

```text
?review=home
?review=tutorial&direction=left
?review=trial&direction=right&stage=dodge
?review=paused
?review=tracking-lost
?review=results&score=9&combo=5
?review=home&tracking=found
```

`direction`: left/right/up/down. `stage`: rest/prepare/dodge/impact/recover. `feedback=success` or `feedback=hit` shows the corresponding feedback. Scores are clamped to valid integers. The trial fixture holds the attack pose until keyboard input or resume; start/retry returns to a normal run. The tracking fixture contains sample numbers and a **NO LIVE FEED** placeholder; it never provides a real portrait.

Only the `import.meta.env.DEV` bootstrap imports `uiReview.tsx`. The regular `Game` class, camera inference, timing, collision, score, pause and capture selection modules are not modified by fixtures. A production build ignores these query parameters. The production smoke check confirms `?review=results&score=12` still opens the normal home screen with no review dock.

## Playwright CLI checks

The review scripts use the already-installed Playwright CLI 0.1.22 as a developer tool. It is not a runtime dependency. With the dev server running:

```sh
playwright-cli -s=windui open http://127.0.0.1:5175/
playwright-cli -s=windui run-code --filename=tools/review-matrix.js
playwright-cli -s=windui run-code --filename=tools/review-interactions.js
playwright-cli -s=windui run-code --filename=tools/review-baselines.js
```

`review-stage1.js` through `review-stage5.js` retain the staged checks. `review-production.js` needs a production preview at port 5174. It captures actual keyboard gameplay and tests permission denial by rejecting the camera request in a separate test page; it does not use a webcam.

Full-page review captures are written to ignored `captures/ui-review/`. The final matrix covers home, tutorial, trial, paused, tracking-lost and results at **1440×900, 1280×720 and 390×844**. It waits for scene readiness before screenshots; captures made before this wait did not reliably include the WebGL scene.

### Stable baselines

Twelve baselines in `baselines/` cover the HUD, camera panel, pause panel and results at all three sizes. The comparison hides WebGL, disables UI transitions and uses only fixture data. It does not compare animated particle frames or real camera images. These PNGs were created and matched on the Windows Chromium/system-font environment used for this review; another platform may render fonts differently.

To approve an intentional visual change, inspect the matrix first. In PowerShell create a temporary updater, leaving the checked-in comparison script unchanged:

```powershell
(Get-Content tools/review-baselines.js -Raw).Replace('const update = false;', 'const update = true;') | Set-Content -Encoding utf8 captures/update-ui-baselines.js
playwright-cli -s=windui run-code --filename=captures/update-ui-baselines.js
playwright-cli -s=windui run-code --filename=tools/review-baselines.js
```

## Checks performed — 1 November 2026

- Six-state layout matrix: 18 viewport captures, no horizontal overflow or render-error boundary.
- Practice: real left/right/up/down key presses progress through all four directions into trial.
- Trial: responding to the visible green cue registers a successful dodge; direction arrows use the existing attack configuration.
- Pause/resume, Escape, exit, keyboard fallback after simulated tracking loss, retry, low quality, reduced motion, panel expand/collapse, and modal keyboard focus checked.
- Results: score fixture, PNG preview/download, and retry tested at each size; zero and perfect scores also checked at 1440px and 390px. The exported no-photo card remains explicit about the missing portrait.
- System reduced-motion preference enables the existing CALM option on load; CSS transitions/entrances are suppressed.
- Camera-permission denial checked with a simulated rejection and a working keyboard fallback.
- Measured token contrast on Ink: Paper 15.69:1, muted text 8.42:1, Attack 6.17:1, Safe 15.67:1. Paper on Violet: 8.30:1.
- UI baselines: 12/12 matched on a second pass with WebGL hidden.
- Unit/regression tests: 52 passing; TypeScript/Vite production build passes. Existing large-bundle warning remains.

The automated browser did not test live webcam comfort, real face direction accuracy, camera latency, or a second human's response to the new UI. The prior human-trial observations in PROCESS.md remain the source for those design decisions. Mobile UI reflows and scrolls, while the game remains intended for desktop play.
