export type ShapeType = "coin" | "card" | "button" | "shield" | "hex" | "custom";
export type IconType = "dollar" | "check" | "star" | "bolt" | "custom" | "none";

export type MatrixTuple = [number, number, number, number, number, number];

export interface VectorElementStyle {
  fill?: Paint;
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: "round" | "square" | "butt";
  strokeLinejoin?: "round" | "bevel" | "miter";
  strokeDasharray?: number[];
  strokeDashoffset?: number;
  fillRule?: "nonzero" | "evenodd";
  opacity?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
}

interface VectorElementBase extends VectorElementStyle {
  id?: string;
  matrix?: MatrixTuple;
}

export interface VectorPathRecipe extends VectorElementBase {
  kind: "path";
  d: string;
}

export interface VectorRectRecipe extends VectorElementBase {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
  ry?: number;
}

export interface VectorEllipseRecipe extends VectorElementBase {
  kind: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export type VectorElementRecipe = VectorPathRecipe | VectorRectRecipe | VectorEllipseRecipe;

export interface VectorSourceRecipe {
  viewBox: [number, number, number, number];
  elements: VectorElementRecipe[];
  preserveAspectRatio?: "meet" | "slice" | "none";
  preserveColors?: boolean;
}

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
  source?: VectorSourceRecipe;
}

export interface SymbolRecipe {
  icon: IconType;
  color: string;
  sideColor: string;
  scale: number;
  depth: number;
  offset: [number, number];
  source?: VectorSourceRecipe;
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
  angle?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  units?: "objectBoundingBox" | "userSpaceOnUse";
  matrix?: MatrixTuple;
  stops: Array<{ offset: number; color: string; opacity?: number }>;
  fallback: string;
}

export interface RadialGradient {
  kind: "radial";
  id: string;
  cx: number;
  cy: number;
  r: number;
  fx?: number;
  fy?: number;
  units?: "objectBoundingBox" | "userSpaceOnUse";
  matrix?: MatrixTuple;
  stops: Array<{ offset: number; color: string; opacity?: number }>;
  fallback: string;
}

export type Paint = string | LinearGradient | RadialGradient;

export interface TransformSpec {
  translateX?: number;
  translateY?: number;
  rotate?: number;
  originX?: number;
  originY?: number;
  scaleX?: number;
  scaleY?: number;
  matrix?: MatrixTuple;
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
  strokeLinecap?: "round" | "square" | "butt";
  strokeLinejoin?: "round" | "bevel" | "miter";
  opacity?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
  strokeDasharray?: number[];
  strokeDashoffset?: number;
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
  strokeLinecap?: "round" | "square" | "butt";
  strokeLinejoin?: "round" | "bevel" | "miter";
  opacity?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
  strokeDasharray?: number[];
  strokeDashoffset?: number;
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
  fillOpacity?: number;
  strokeOpacity?: number;
  strokeDasharray?: number[];
  strokeDashoffset?: number;
  transform?: TransformSpec;
  group?: string;
}

export type VectorNode = EllipseNode | RectNode | PathNode;

export interface VectorScene {
  width: number;
  height: number;
  nodes: VectorNode[];
}
