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
- Direct SVG import by file picker or drag-and-drop
- Multi-element custom vector sources with nested transforms and reusable `<use>` geometry
- Solid colors plus linear and radial gradients
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
└── button.json
```

The filename (without `.json`) becomes the preset key. The loader discovers JSON
files in this folder automatically, so adding a valid recipe file is enough to make
it available in the preset selector without editing a TypeScript registry.

## Complex SVG compatibility

SVG files can be imported directly. The importer normalizes the source `viewBox`
into the recipe canvas and stores editable vector data under `shape.source`.
Supported geometry includes:

- `path`, `rect`, `circle`, `ellipse`, `polygon`, `polyline`, and `line`
- nested `svg`/`g` transforms, including matrix, translate, scale, rotate, and skew
- reusable local `<use>` references and symbols
- compound paths and `evenodd` fill rules
- fill/stroke opacity, line caps, line joins, and dash patterns
- solid colors, linear gradients, and radial gradients
- all SVG path commands, including smooth curves and elliptical arcs, in SVG and EPS export

For stock safety, raster images, scripts, `foreignObject`, video, and canvas content
are rejected. Text should be converted to outlines before import. CSS class rules,
filters, masks, and clip paths currently produce import warnings and are omitted.

A custom shape recipe uses the same controls as a procedural shape:

```json
{
  "type": "custom",
  "center": [500, 500],
  "width": 720,
  "height": 540,
  "rotation": 0,
  "depth": 0,
  "bevel": 0,
  "cornerRadius": 0,
  "faceColor": "#6366F1",
  "sideColor": "#3730A3",
  "lightAngle": 315,
  "depthAngle": 105,
  "source": {
    "viewBox": [0, 0, 800, 600],
    "preserveAspectRatio": "meet",
    "preserveColors": true,
    "elements": [
      {
        "kind": "path",
        "d": "M 80 80 H 720 V 520 H 80 Z",
        "fill": "#6366F1",
        "fillRule": "nonzero"
      }
    ]
  }
}
```

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

The EPS exporter supports:

- ellipse
- rounded rectangles
- path commands:
  - M
  - L
  - H
  - V
  - C / S
  - Q / T
  - A
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

1. Clip-path and mask flattening
2. Text-to-outline conversion
3. CSS stylesheet resolution
4. Continuous side-face extrusion for arbitrary Bézier contours
5. Per-face lighting
6. Batch asset-pack generator
7. Strict Adobe Stock preflight
8. Outline expansion
9. EPS gradient approximation
10. Optional Three.js mesh-to-vector projection module
