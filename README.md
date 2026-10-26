# Flower Motion Studio

An interactive flower-logo motion study with three pages:

- **Comparison:** Rubber, Soft, and Heavy in separate floor-based frames.
- **Playground:** Six bounce patterns, intensity, speed, deformation on/off, and direct drag/drop.
- **Logo studio:** Independent colours for the outer disc, petals, centre ring, and centre, plus click-to-expand and explode. Default: three clicks,100 pieces. Adjust the threshold, force, fragment count and expansion; reset to reassemble.

## Run

Requires Node22.12+ (or a compatible newer Node).

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. If port4317 is occupied by another project, use `npx vite --host 0.0.0.0 --port 4319 --strictPort` after checking the port is free.

```sh
npm run build
npm run preview
```

The static build is in `dist/`. Three HTML entry points and relative asset/navigation paths support hosting in a project subdirectory. A GitHub Pages build/deploy workflow is included. Enable Pages with GitHub Actions as its source when publishing the repository.

## Controls

Drag and release to drop the logo. Quick gestures can throw; a stationary hold releases without a throw. Arrow keys pick up and move; Shift moves farther; Space/Enter drops; Escape releases. Reduced Motion stops automatic simulation and preserves direct manipulation.

Logo studio’s click response charges and holds the logo. Dragging does not count as a click. Click the logo or use the accessible **Charge logo** button; the configured final click breaks the current-colour artwork into actual clipped Voronoi pieces. **Reset logo** reassembles it. Disable Click response for ordinary bouncing. Burst settings apply to the next explosion.

Motion, palette and click-effect preferences are saved locally in this browser. The Playground and Logo studio have separate settings. No settings are sent to a service.

## Art and implementation

The supplied flower SVG’s path geometry is preserved. Default fills are #459865,#F2E9CD,#459865,#F1CE59. Colour changes affect only live fill attributes. Motion supplies the shared frame scheduler; the bounded physics step is120Hz. Collision support follows a sampled source outline through rotation and deformation.

Continuous presets sustain a characteristic rebound; **Drop and settle** decays to rest. Deformation off keeps the logo rigid through flight and collisions.

## Selected animation exports

[Looping GIF](exports/flower-drop-and-settle.gif) · [MP4](exports/flower-drop-and-settle.mp4)

These use Drop and settle,96% intensity,deformation off,and1.4× speed with original colours.720×540,66frames,2.2seconds. The GIF repeats indefinitely; the MP4 repeats when loop is enabled in the player. It is a repeating drop/settle/hold demonstration, with a reset at the repeat boundary, rather than seamless continuous physics.

## Verification

Verified locally in Chromium: three-page build, mouse/touch drag/drop, keyboard, floor/boundary behaviour, responsive reflow, saved settings, colour isolation, original SVG paths, Reduced Motion, three-click100-piece burst, adjustable300-piece burst, drag exclusion, and reset. Mobile checks used touch/viewport emulation; physical-device review remains useful.
