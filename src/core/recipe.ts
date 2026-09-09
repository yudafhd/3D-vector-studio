import type {
  AssetRecipe,
  IconType,
  ShapeRecipe,
  ShapeType,
  SymbolRecipe,
  VectorSourceRecipe
} from "../types";

const shapeTypes = new Set<ShapeType>(["coin", "card", "button", "shield", "hex", "custom"]);
const iconTypes = new Set<IconType>(["dollar", "check", "star", "bolt", "custom", "none"]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string.`);
  return value;
}

function finiteNumber(value: unknown, label: string, minimum?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  if (minimum !== undefined && value < minimum) throw new Error(`${label} must be at least ${minimum}.`);
  return value;
}

function tuple(value: unknown, length: number, label: string): number[] {
  if (!Array.isArray(value) || value.length !== length) throw new Error(`${label} must contain ${length} numbers.`);
  return value.map((entry, index) => finiteNumber(entry, `${label}[${index}]`));
}

function validateSource(value: unknown, label: string): VectorSourceRecipe {
  const source = record(value, label);
  const viewBox = tuple(source.viewBox, 4, `${label}.viewBox`);
  if (viewBox[2] <= 0 || viewBox[3] <= 0) throw new Error(`${label}.viewBox dimensions must be positive.`);
  if (!Array.isArray(source.elements) || source.elements.length === 0) {
    throw new Error(`${label}.elements must contain vector geometry.`);
  }

  source.elements.forEach((rawElement, index) => {
    const element = record(rawElement, `${label}.elements[${index}]`);
    if (element.kind === "path") {
      text(element.d, `${label}.elements[${index}].d`);
    } else if (element.kind === "rect") {
      finiteNumber(element.x, `${label}.elements[${index}].x`);
      finiteNumber(element.y, `${label}.elements[${index}].y`);
      finiteNumber(element.width, `${label}.elements[${index}].width`, 0);
      finiteNumber(element.height, `${label}.elements[${index}].height`, 0);
    } else if (element.kind === "ellipse") {
      finiteNumber(element.cx, `${label}.elements[${index}].cx`);
      finiteNumber(element.cy, `${label}.elements[${index}].cy`);
      finiteNumber(element.rx, `${label}.elements[${index}].rx`, 0);
      finiteNumber(element.ry, `${label}.elements[${index}].ry`, 0);
    } else {
      throw new Error(`${label}.elements[${index}].kind is unsupported.`);
    }
    if (element.matrix !== undefined) tuple(element.matrix, 6, `${label}.elements[${index}].matrix`);
  });

  return source as unknown as VectorSourceRecipe;
}

function validateShape(value: unknown, label: string): ShapeRecipe {
  const shape = record(value, label);
  if (!shapeTypes.has(shape.type as ShapeType)) throw new Error(`${label}.type is unsupported.`);
  tuple(shape.center, 2, `${label}.center`);
  finiteNumber(shape.width, `${label}.width`, 0);
  finiteNumber(shape.height, `${label}.height`, 0);
  finiteNumber(shape.rotation, `${label}.rotation`);
  finiteNumber(shape.depth, `${label}.depth`, 0);
  finiteNumber(shape.bevel, `${label}.bevel`, 0);
  finiteNumber(shape.cornerRadius, `${label}.cornerRadius`, 0);
  text(shape.faceColor, `${label}.faceColor`);
  text(shape.sideColor, `${label}.sideColor`);
  finiteNumber(shape.lightAngle, `${label}.lightAngle`);
  finiteNumber(shape.depthAngle, `${label}.depthAngle`);
  if (shape.type === "custom") validateSource(shape.source, `${label}.source`);
  return shape as unknown as ShapeRecipe;
}

function validateSymbol(value: unknown, label: string): SymbolRecipe {
  const symbol = record(value, label);
  if (!iconTypes.has(symbol.icon as IconType)) throw new Error(`${label}.icon is unsupported.`);
  text(symbol.color, `${label}.color`);
  text(symbol.sideColor, `${label}.sideColor`);
  finiteNumber(symbol.scale, `${label}.scale`, 0);
  finiteNumber(symbol.depth, `${label}.depth`, 0);
  tuple(symbol.offset, 2, `${label}.offset`);
  if (symbol.icon === "custom") validateSource(symbol.source, `${label}.source`);
  return symbol as unknown as SymbolRecipe;
}

export function validateAssetRecipe(value: unknown): AssetRecipe {
  const recipe = record(value, "Recipe");
  text(recipe.name, "Recipe.name");
  const canvas = record(recipe.canvas, "Recipe.canvas");
  finiteNumber(canvas.width, "Recipe.canvas.width", 1);
  finiteNumber(canvas.height, "Recipe.canvas.height", 1);
  if (canvas.transparent !== true) throw new Error("Recipe.canvas.transparent must be true.");
  validateShape(recipe.shape, "Recipe.shape");
  validateSymbol(recipe.symbol, "Recipe.symbol");

  if (recipe.parts !== undefined) {
    if (!Array.isArray(recipe.parts)) throw new Error("Recipe.parts must be an array.");
    recipe.parts.forEach((rawPart, index) => {
      const part = record(rawPart, `Recipe.parts[${index}]`);
      validateShape(part.shape, `Recipe.parts[${index}].shape`);
      if (part.symbol !== undefined) validateSymbol(part.symbol, `Recipe.parts[${index}].symbol`);
    });
  }

  return recipe as unknown as AssetRecipe;
}
