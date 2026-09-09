export type ShapeType = "coin" | "card" | "button" | "shield" | "hex";
export type IconType = "dollar" | "check" | "star" | "bolt" | "none";

export interface CanvasRecipe {
  width: number;
  height: number;
  transparent: true;
}

export interface ShapeRecipe {
  type: ShapeType;
  center: [number, number];
  width: number;
  height: number;
  rotation: number;
  depth: number;
  bevel: number;
  cornerRadius: number;
  faceColor: string;
  sideColor: string;
  lightAngle: number;
  depthAngle: number;
}

export interface SymbolRecipe {
  icon: IconType;
  color: string;
  sideColor: string;
  scale: number;
  depth: number;
  offset: [number, number];
}

export interface PartRecipe {
  id?: string;
  shape: ShapeRecipe;
  symbol?: SymbolRecipe;
}

export interface AssetRecipe {
  name: string;
  canvas: CanvasRecipe;
  shape: ShapeRecipe;
  symbol: SymbolRecipe;
  parts?: PartRecipe[];
}

export interface LinearGradient {
  kind: "linear";
  id: string;
  angle: number;
  stops: Array<{ offset: number; color: string }>;
  fallback: string;
}

export type Paint = string | LinearGradient;

export interface TransformSpec {
  translateX?: number;
  translateY?: number;
  rotate?: number;
  originX?: number;
  originY?: number;
  scaleX?: number;
  scaleY?: number;
}

export interface EllipseNode {
  kind: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  fill: Paint;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  transform?: TransformSpec;
  group?: string;
}

export interface RectNode {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  ry: number;
  fill: Paint;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  transform?: TransformSpec;
  group?: string;
}

export interface PathNode {
  kind: "path";
  d: string;
  fill: Paint;
  fillRule?: "nonzero" | "evenodd";
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: "round" | "square" | "butt";
  strokeLinejoin?: "round" | "bevel" | "miter";
  opacity?: number;
  transform?: TransformSpec;
  group?: string;
}

export type VectorNode = EllipseNode | RectNode | PathNode;

export interface VectorScene {
  width: number;
  height: number;
  nodes: VectorNode[];
}
