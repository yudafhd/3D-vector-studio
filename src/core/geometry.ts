import type {
  AssetRecipe,
  MatrixTuple,
  Paint,
  PathNode,
  ShapeRecipe,
  SymbolRecipe,
  TransformSpec,
  VectorElementRecipe,
  VectorNode
} from "../types";
import { shade } from "./color";
import { iconPath } from "./icons";

function polar(angleDeg: number): { x: number; y: number } {
  const angle = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function multiplyMatrices(left: MatrixTuple, right: MatrixTuple): MatrixTuple {
  const [a1, b1, c1, d1, e1, f1] = left;
  const [a2, b2, c2, d2, e2, f2] = right;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1
  ];
}

function sourceMappingMatrix(shape: ShapeRecipe): MatrixTuple {
  const source = shape.source;
  if (!source) return [1, 0, 0, 1, 0, 0];

  const [vx, vy, viewWidth, viewHeight] = source.viewBox;
  if (viewWidth <= 0 || viewHeight <= 0) {
    throw new Error("Custom vector viewBox width and height must be greater than zero.");
  }

  let scaleX = shape.width / viewWidth;
  let scaleY = shape.height / viewHeight;
  if ((source.preserveAspectRatio ?? "meet") !== "none") {
    const scale = (source.preserveAspectRatio ?? "meet") === "slice"
      ? Math.max(scaleX, scaleY)
      : Math.min(scaleX, scaleY);
    scaleX = scale;
    scaleY = scale;
  }

  const renderedWidth = viewWidth * scaleX;
  const renderedHeight = viewHeight * scaleY;
  return [
    scaleX,
    0,
    0,
    scaleY,
    shape.center[0] - renderedWidth / 2 - vx * scaleX,
    shape.center[1] - renderedHeight / 2 - vy * scaleY
  ];
}

function customElementToNode(
  element: VectorElementRecipe,
  transform: TransformSpec,
  fill: Paint,
  includeSourceStyle: boolean
): VectorNode {
  const common = {
    fill: includeSourceStyle ? (element.fill ?? fill) : fill,
    stroke: includeSourceStyle ? element.stroke : undefined,
    strokeWidth: includeSourceStyle ? element.strokeWidth : undefined,
    strokeLinecap: includeSourceStyle ? element.strokeLinecap : undefined,
    strokeLinejoin: includeSourceStyle ? element.strokeLinejoin : undefined,
    strokeDasharray: includeSourceStyle ? element.strokeDasharray : undefined,
    strokeDashoffset: includeSourceStyle ? element.strokeDashoffset : undefined,
    opacity: includeSourceStyle ? element.opacity : undefined,
    fillOpacity: includeSourceStyle ? element.fillOpacity : undefined,
    strokeOpacity: includeSourceStyle ? element.strokeOpacity : undefined,
    transform
  };

  switch (element.kind) {
    case "ellipse":
      return {
        kind: "ellipse",
        cx: element.cx,
        cy: element.cy,
        rx: element.rx,
        ry: element.ry,
        ...common
      };
    case "rect":
      return {
        kind: "rect",
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        rx: element.rx ?? 0,
        ry: element.ry ?? element.rx ?? 0,
        ...common
      };
    case "path":
      return {
        kind: "path",
        d: element.d,
        fillRule: element.fillRule,
        ...common
      };
  }
}

function transformForShape(shape: ShapeRecipe, dx = 0, dy = 0): TransformSpec {
  return {
    translateX: dx,
    translateY: dy,
    rotate: shape.rotation,
    originX: shape.center[0],
    originY: shape.center[1]
  };
}

function facePaint(shape: ShapeRecipe, gradientId = "face-gradient"): Paint {
  return {
    kind: "linear",
    id: gradientId,
    angle: shape.lightAngle,
    fallback: shape.faceColor,
    stops: [
      { offset: 0, color: shade(shape.faceColor, 34) },
      { offset: 0.55, color: shape.faceColor },
      { offset: 1, color: shade(shape.faceColor, -30) }
    ]
  };
}

function symbolPaint(shape: ShapeRecipe, symbol: SymbolRecipe, gradientId = "symbol-gradient"): Paint {
  return {
    kind: "linear",
    id: gradientId,
    angle: shape.lightAngle,
    fallback: symbol.color,
    stops: [
      { offset: 0, color: shade(symbol.color, 8) },
      { offset: 1, color: shade(symbol.color, -20) }
    ]
  };
}

function shieldPath(shape: ShapeRecipe): string {
  const [cx, cy] = shape.center;
  const w = shape.width;
  const h = shape.height;
  const left = cx - w / 2;
  const right = cx + w / 2;
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  return [
    `M ${cx} ${top}`,
    `C ${cx - w * 0.18} ${top + h * 0.05}, ${left + w * 0.09} ${top + h * 0.14}, ${left} ${top + h * 0.19}`,
    `L ${left + w * 0.05} ${cy + h * 0.12}`,
    `C ${left + w * 0.10} ${bottom - h * 0.18}, ${cx - w * 0.13} ${bottom - h * 0.05}, ${cx} ${bottom}`,
    `C ${cx + w * 0.13} ${bottom - h * 0.05}, ${right - w * 0.10} ${bottom - h * 0.18}, ${right - w * 0.05} ${cy + h * 0.12}`,
    `L ${right} ${top + h * 0.19}`,
    `C ${right - w * 0.09} ${top + h * 0.14}, ${cx + w * 0.18} ${top + h * 0.05}, ${cx} ${top}`,
    "Z"
  ].join(" ");
}

function hexPath(shape: ShapeRecipe): string {
  const [cx, cy] = shape.center;
  const rx = shape.width / 2;
  const ry = shape.height / 2;
  return [
    `M ${cx - rx * 0.52} ${cy - ry}`,
    `L ${cx + rx * 0.52} ${cy - ry}`,
    `L ${cx + rx} ${cy}`,
    `L ${cx + rx * 0.52} ${cy + ry}`,
    `L ${cx - rx * 0.52} ${cy + ry}`,
    `L ${cx - rx} ${cy}`,
    "Z"
  ].join(" ");
}

function createBaseNode(shape: ShapeRecipe, fill: Paint, dx = 0, dy = 0): VectorNode {
  const [cx, cy] = shape.center;
  const transform = transformForShape(shape, dx, dy);

  switch (shape.type) {
    case "coin":
      return {
        kind: "ellipse",
        cx,
        cy,
        rx: shape.width / 2,
        ry: shape.height / 2,
        fill,
        transform
      };

    case "card":
    case "button":
      return {
        kind: "rect",
        x: cx - shape.width / 2,
        y: cy - shape.height / 2,
        width: shape.width,
        height: shape.height,
        rx: shape.cornerRadius,
        ry: shape.cornerRadius,
        fill,
        transform
      };

    case "shield":
      return {
        kind: "path",
        d: shieldPath(shape),
        fill,
        fillRule: "evenodd",
        transform
      };

    case "hex":
      return {
        kind: "path",
        d: hexPath(shape),
        fill,
        fillRule: "evenodd",
        transform
      };

    case "custom":
      throw new Error("Custom shapes contain multiple nodes; use createBaseNodes().");
  }
}

function createBaseNodes(
  shape: ShapeRecipe,
  fill: Paint,
  dx = 0,
  dy = 0,
  includeSourceStyle = false
): VectorNode[] {
  if (shape.type !== "custom") return [createBaseNode(shape, fill, dx, dy)];
  if (!shape.source || shape.source.elements.length === 0) {
    throw new Error("Custom shape is missing vector source elements.");
  }

  const mapping = sourceMappingMatrix(shape);
  return shape.source.elements.map((element) => {
    const matrix = element.matrix
      ? multiplyMatrices(mapping, element.matrix)
      : mapping;
    return customElementToNode(
      element,
      {
        translateX: dx,
        translateY: dy,
        rotate: shape.rotation,
        originX: shape.center[0],
        originY: shape.center[1],
        matrix
      },
      fill,
      includeSourceStyle && shape.source?.preserveColors !== false
    );
  });
}

function scaleNodeAroundCenter(node: VectorNode, factorX: number, factorY: number): VectorNode {
  if (node.kind === "ellipse") {
    return { ...node, rx: node.rx * factorX, ry: node.ry * factorY };
  }

  if (node.kind === "rect") {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const width = node.width * factorX;
    const height = node.height * factorY;
    return {
      ...node,
      x: cx - width / 2,
      y: cy - height / 2,
      width,
      height,
      rx: Math.max(0, node.rx * Math.min(factorX, factorY)),
      ry: Math.max(0, node.ry * Math.min(factorX, factorY))
    };
  }

  return {
    ...node,
    transform: {
      ...node.transform,
      scaleX: factorX,
      scaleY: factorY
    }
  };
}

function addBevel(nodes: VectorNode[], shape: ShapeRecipe, groupPrefix: string): void {
  if (shape.bevel <= 0) return;

  if (shape.type === "custom") {
    const outlines = createBaseNodes(shape, "none");
    const dark = shade(shape.faceColor, -38);
    const light = shade(shape.faceColor, 38);
    const width = Math.max(1, shape.bevel * 0.55);

    for (const outline of outlines) {
      nodes.push({
        ...outline,
        fill: "none",
        stroke: dark,
        strokeWidth: width,
        group: `${groupPrefix}-bevel`
      } as VectorNode);
      nodes.push({
        ...outline,
        fill: "none",
        stroke: light,
        strokeWidth: Math.max(1, width * 0.45),
        transform: {
          ...outline.transform,
          translateX: (outline.transform?.translateX ?? 0) - shape.bevel * 0.1,
          translateY: (outline.transform?.translateY ?? 0) - shape.bevel * 0.13
        },
        group: `${groupPrefix}-bevel`
      } as VectorNode);
    }
    return;
  }

  const front = createBaseNode(shape, "none");
  const dark = shade(shape.faceColor, -38);
  const light = shade(shape.faceColor, 38);
  const width = Math.max(7, shape.bevel * 0.55);

  nodes.push({
    ...front,
    fill: "none",
    stroke: dark,
    strokeWidth: width,
    group: `${groupPrefix}-bevel`
  } as VectorNode);

  nodes.push({
    ...front,
    fill: "none",
    stroke: light,
    strokeWidth: Math.max(4, width * 0.54),
    transform: {
      ...front.transform,
      translateX: (front.transform?.translateX ?? 0) - shape.bevel * 0.10,
      translateY: (front.transform?.translateY ?? 0) - shape.bevel * 0.13
    },
    group: `${groupPrefix}-bevel`
  } as VectorNode);

  if (shape.type === "coin" || shape.type === "button") {
    const insetFactorX = Math.max(0.58, 1 - (shape.bevel * 2.8) / shape.width);
    const insetFactorY = Math.max(0.58, 1 - (shape.bevel * 2.5) / shape.height);
    const inset = scaleNodeAroundCenter(
      createBaseNode(shape, shade(shape.faceColor, -10)),
      insetFactorX,
      insetFactorY
    );
    inset.group = `${groupPrefix}-bevel`;
    nodes.push(inset);

    nodes.push({
      ...inset,
      fill: "none",
      stroke: shade(shape.faceColor, -28),
      strokeWidth: Math.max(5, shape.bevel * 0.35),
      group: `${groupPrefix}-bevel`
    } as VectorNode);
  }
}

function addSymbol(
  nodes: VectorNode[],
  shape: ShapeRecipe,
  symbol: SymbolRecipe,
  gradientId = "symbol-gradient",
  groupPrefix = "part-0"
): void {
  if (symbol.icon === "custom") {
    if (!symbol.source || symbol.source.elements.length === 0) {
      throw new Error("Custom emblem is missing vector source elements.");
    }

    const symbolShape: ShapeRecipe = {
      ...shape,
      type: "custom",
      center: [shape.center[0] + symbol.offset[0], shape.center[1] + symbol.offset[1]],
      width: Math.min(shape.width, shape.height) * symbol.scale,
      height: Math.min(shape.width, shape.height) * symbol.scale,
      depth: symbol.depth,
      bevel: 0,
      faceColor: symbol.color,
      sideColor: symbol.sideColor,
      source: symbol.source
    };
    const direction = polar(shape.depthAngle);
    const layers = symbol.depth <= 0 ? 0 : Math.min(12, Math.max(2, Math.ceil(symbol.depth / 4)));

    for (let i = layers; i >= 1; i -= 1) {
      const t = i / layers;
      for (const node of createBaseNodes(
        symbolShape,
        shade(symbol.sideColor, Math.round((1 - t) * 18)),
        direction.x * symbol.depth * t,
        direction.y * symbol.depth * t
      )) {
        node.group = `${groupPrefix}-symbol-sides`;
        nodes.push(node);
      }
    }

    for (const node of createBaseNodes(
      symbolShape,
      symbolPaint(shape, symbol, gradientId),
      0,
      0,
      true
    )) {
      node.group = `${groupPrefix}-symbol`;
      nodes.push(node);
    }
    return;
  }

  const d = iconPath(symbol.icon);
  if (!d) return;

  const [offsetX, offsetY] = symbol.offset;
  const depthDirection = polar(shape.depthAngle);
  const layers = Math.min(6, Math.max(2, Math.round(symbol.depth / 6)));

  const centerShiftX = shape.center[0] - 500;
  const centerShiftY = shape.center[1] - 465;

  for (let i = layers; i >= 1; i -= 1) {
    const t = i / layers;
    const node: PathNode = {
      kind: "path",
      d,
      fill: shade(symbol.sideColor, Math.round((1 - t) * 18)),
      fillRule: "nonzero",
      transform: {
        translateX: centerShiftX + offsetX + depthDirection.x * symbol.depth * t,
        translateY: centerShiftY + offsetY + depthDirection.y * symbol.depth * t,
        rotate: shape.rotation,
        originX: 500,
        originY: 465,
        scaleX: symbol.scale,
        scaleY: symbol.scale
      },
      group: `${groupPrefix}-symbol`
    };
    nodes.push(node);
  }

  nodes.push({
    kind: "path",
    d,
    fill: symbolPaint(shape, symbol, gradientId),
    fillRule: "nonzero",
    transform: {
      translateX: centerShiftX + offsetX,
      translateY: centerShiftY + offsetY,
      rotate: shape.rotation,
      originX: 500,
      originY: 465,
      scaleX: symbol.scale,
      scaleY: symbol.scale
    },
    group: `${groupPrefix}-symbol`
  });
}

function buildSinglePartNodes(
  shape: ShapeRecipe,
  symbol?: SymbolRecipe,
  partIndex = 0
): VectorNode[] {
  const nodes: VectorNode[] = [];
  const direction = polar(shape.depthAngle);
  const layers = shape.depth <= 0 ? 0 : Math.min(24, Math.max(4, Math.ceil(shape.depth / 4)));
  const groupPrefix = `part-${partIndex}`;

  for (let i = layers; i >= 1; i -= 1) {
    const t = i / layers;
    const sideColor = shade(
      shape.sideColor,
      Math.round((1 - t) * 24 - 8)
    );

    for (const sideNode of createBaseNodes(
      shape,
      sideColor,
      direction.x * shape.depth * t,
      direction.y * shape.depth * t
    )) {
      sideNode.group = `${groupPrefix}-sides`;
      nodes.push(sideNode);
    }
  }

  for (const faceNode of createBaseNodes(
    shape,
    facePaint(shape, `face-gradient-${partIndex}`),
    0,
    0,
    true
  )) {
    faceNode.group = `${groupPrefix}-face`;
    nodes.push(faceNode);
  }

  addBevel(nodes, shape, groupPrefix);

  if (symbol && symbol.icon !== "none") {
    addSymbol(nodes, shape, symbol, `symbol-gradient-${partIndex}`, groupPrefix);
  }

  return nodes;
}

export function buildScene(recipe: AssetRecipe) {
  const nodes: VectorNode[] = [];

  if (recipe.parts && recipe.parts.length > 0) {
    recipe.parts.forEach((part, index) => {
      const partNodes = buildSinglePartNodes(part.shape, part.symbol, index);
      nodes.push(...partNodes);
    });
  } else {
    const singleNodes = buildSinglePartNodes(recipe.shape, recipe.symbol, 0);
    nodes.push(...singleNodes);
  }

  return {
    width: recipe.canvas.width,
    height: recipe.canvas.height,
    nodes
  };
}
