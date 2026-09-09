# Vector3D Studio

Vector3D Studio is a vector-native pseudo-3D asset generator aimed at isolated SVG/EPS assets.

It does **not** use Three.js in the core rendering pipeline. Geometry is created directly as SVG-compatible vector nodes, so export stays editable and vector-native.

## Current features

- Live pseudo-3D preview
- Transparent artboard
- Five procedural shape presets:
  - coin
  - card
  - rounded button
  - shield
  - hex token
- Four built-in vector symbols:
  - dollar
  - check
  - star
  - bolt
- Adjustable:
  - width / height
  - rotation
  - extrusion depth
  - bevel
  - corner radius
  - face / side colors
  - light direction
  - extrusion direction
  - symbol scale / depth
- JSON recipe editor
- SVG export
- EPS export
- SVG stock-safety validator
- No bitmap image
- No SVG blur/filter
- No canvas/WebGL dependency

## Run

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Asset files

Each built-in asset is stored as an individual JSON recipe in `src/assets/`:

```text
src/assets/
├── button.json
├── card.json
├── coin.json
├── coinStack.json
├── hex.json
└── shield.json
```

The filename (without `.json`) becomes the preset key. The loader discovers JSON
files in this folder automatically, so adding a valid recipe file is enough to make
it available in the preset selector without editing a TypeScript registry.

## Architecture

```text
Asset Recipe JSON
       ↓
Geometry builder
       ↓
Vector scene graph
       ├── ellipse
       ├── rounded rect
       └── SVG path
       ↓
Extrusion + bevel + material
       ↓
       ├───────────────┐
       ↓               ↓
SVG renderer       EPS renderer
       ↓               ↓
vector SVG          vector EPS
```

## Recipe example

```json
{
  "name": "Dollar Coin",
  "canvas": {
    "width": 1000,
    "height": 1000,
    "transparent": true
  },
  "shape": {
    "type": "coin",
    "center": [500, 465],
    "width": 670,
    "height": 495,
    "rotation": -14,
    "depth": 62,
    "bevel": 30,
    "cornerRadius": 80,
    "faceColor": "#F7D85B",
    "sideColor": "#B86B08",
    "lightAngle": 315,
    "depthAngle": 105
  },
  "symbol": {
    "icon": "dollar",
    "color": "#FFFFFF",
    "sideColor": "#D3D0C8",
    "scale": 0.78,
    "depth": 18,
    "offset": [0, 18]
  }
}
```

## EPS support

The EPS exporter currently supports the vector commands used by the built-in generator:

- ellipse
- rounded rectangles
- path commands:
  - M
  - L
  - H
  - V
  - C
  - Q
  - Z

Gradients are flattened to their declared fallback solid color in EPS. SVG keeps the real vector gradients.

This is intentional for a safe MVP. A later production exporter can build stepped vector gradients or use a dedicated professional conversion pipeline.

## Why not Three.js?

Three.js is useful when the source representation needs to be a real mesh with:

- arbitrary 3D camera rotation
- complex occlusion
- real perspective projection
- complex meshes
- scene lighting

But its normal output is WebGL/canvas pixels.

For microstock-style icon assets such as coins, cards, buttons, badges, shields, folders, payment objects, and simple devices, direct SVG geometry is a better first architecture.

A hybrid Three.js projector can be added later:

```text
Three.js mesh
    ↓
camera projection
    ↓
visible polygon extraction
    ↓
depth sort
    ↓
SVG polygon/path reconstruction
```

That should be a separate optional module, not the main vector renderer.

## Recommended next milestones

1. Generic custom SVG path import
2. Path normalization into a 1000×1000 recipe canvas
3. Multi-part objects
4. Per-face lighting
5. Isometric primitive library
6. Batch asset-pack generator
7. Strict Adobe Stock preflight
8. Outline expansion
9. EPS gradient approximation
10. Optional Three.js mesh-to-vector projection module
