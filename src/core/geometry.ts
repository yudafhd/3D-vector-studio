import type {
  AssetRecipe,
  Paint,
  PathNode,
  ShapeRecipe,
  SymbolRecipe,
  TransformSpec,
  VectorNode
} from "../types";
import { shade } from "./color";
import { iconPath } from "./icons";

function polar(angleDeg: number): { x: number; y: number } {
  const angle = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(angle), y: Math.sin(angle) };
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
  }
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

function addBevel(nodes: VectorNode[], shape: ShapeRecipe): void {
  const front = createBaseNode(shape, "none");
  const dark = shade(shape.faceColor, -38);
  const light = shade(shape.faceColor, 38);
  const width = Math.max(7, shape.bevel * 0.55);

  nodes.push({
    ...front,
    fill: "none",
    stroke: dark,
    strokeWidth: width,
    group: "bevel"
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
    group: "bevel"
  } as VectorNode);

  if (shape.type === "coin" || shape.type === "button") {
    const insetFactorX = Math.max(0.58, 1 - (shape.bevel * 2.8) / shape.width);
    const insetFactorY = Math.max(0.58, 1 - (shape.bevel * 2.5) / shape.height);
    const inset = scaleNodeAroundCenter(
      createBaseNode(shape, shade(shape.faceColor, -10)),
      insetFactorX,
      insetFactorY
    );
    inset.group = "bevel";
    nodes.push(inset);

    nodes.push({
      ...inset,
      fill: "none",
      stroke: shade(shape.faceColor, -28),
      strokeWidth: Math.max(5, shape.bevel * 0.35),
      group: "bevel"
    } as VectorNode);
  }
}

function addSymbol(
  nodes: VectorNode[],
  shape: ShapeRecipe,
  symbol: SymbolRecipe,
  gradientId = "symbol-gradient"
): void {
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
        translateX: centerShiftX + offsetX + depthDirection.x * symbol.depth * t * 0.32,
        translateY: centerShiftY + offsetY + depthDirection.y * symbol.depth * t,
        rotate: shape.rotation,
        originX: 500,
        originY: 465,
        scaleX: symbol.scale,
        scaleY: symbol.scale
      },
      group: "symbol"
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
    group: "symbol"
  });
}

function buildSinglePartNodes(
  shape: ShapeRecipe,
  symbol?: SymbolRecipe,
  partIndex = 0
): VectorNode[] {
  const nodes: VectorNode[] = [];
  const direction = polar(shape.depthAngle);
  const layers = Math.min(14, Math.max(4, Math.round(shape.depth / 7)));

  for (let i = layers; i >= 1; i -= 1) {
    const t = i / layers;
    const sideColor = shade(
      shape.sideColor,
      Math.round((1 - t) * 24 - 8)
    );

    const sideNode = createBaseNode(
      shape,
      sideColor,
      direction.x * shape.depth * t * 0.32,
      direction.y * shape.depth * t
    );
    sideNode.group = "sides";
    nodes.push(sideNode);
  }

  const faceNode = createBaseNode(shape, facePaint(shape, `face-gradient-${partIndex}`));
  faceNode.group = "face";
  nodes.push(faceNode);

  addBevel(nodes, shape);

  if (symbol && symbol.icon !== "none") {
    addSymbol(nodes, shape, symbol, `symbol-gradient-${partIndex}`);
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
