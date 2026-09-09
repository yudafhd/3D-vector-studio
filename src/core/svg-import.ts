import { shade } from "./color";
import type {
  AssetRecipe,
  LinearGradient,
  MatrixTuple,
  Paint,
  RadialGradient,
  VectorElementRecipe,
  VectorElementStyle
} from "../types";

export interface SvgImportResult {
  recipe: AssetRecipe;
  warnings: string[];
}

interface StyleState {
  fill: string;
  stroke: string;
  color: string;
  strokeWidth: number;
  strokeLinecap: "round" | "square" | "butt";
  strokeLinejoin: "round" | "bevel" | "miter";
  strokeDasharray?: number[];
  strokeDashoffset?: number;
  fillRule: "nonzero" | "evenodd";
  opacity: number;
  fillOpacity: number;
  strokeOpacity: number;
  hidden: boolean;
}

const IDENTITY: MatrixTuple = [1, 0, 0, 1, 0, 0];
const numberPattern = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;

function numbers(value: string | null): number[] {
  return value?.match(numberPattern)?.map(Number).filter(Number.isFinite) ?? [];
}

function multiply(left: MatrixTuple, right: MatrixTuple): MatrixTuple {
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

function translate(x: number, y: number): MatrixTuple {
  return [1, 0, 0, 1, x, y];
}

function parseTransform(value: string | null): MatrixTuple {
  if (!value) return IDENTITY;
  let matrix: MatrixTuple = IDENTITY;
  const matcher = /([a-zA-Z]+)\s*\(([^)]*)\)/g;

  for (const match of value.matchAll(matcher)) {
    const name = match[1].toLowerCase();
    const args = numbers(match[2]);
    let next: MatrixTuple | undefined;

    if (name === "matrix" && args.length >= 6) {
      next = args.slice(0, 6) as MatrixTuple;
    } else if (name === "translate" && args.length >= 1) {
      next = translate(args[0], args[1] ?? 0);
    } else if (name === "scale" && args.length >= 1) {
      next = [args[0], 0, 0, args[1] ?? args[0], 0, 0];
    } else if (name === "rotate" && args.length >= 1) {
      const angle = (args[0] * Math.PI) / 180;
      const rotation: MatrixTuple = [
        Math.cos(angle),
        Math.sin(angle),
        -Math.sin(angle),
        Math.cos(angle),
        0,
        0
      ];
      next = args.length >= 3
        ? multiply(multiply(translate(args[1], args[2]), rotation), translate(-args[1], -args[2]))
        : rotation;
    } else if (name === "skewx" && args.length >= 1) {
      next = [1, 0, Math.tan((args[0] * Math.PI) / 180), 1, 0, 0];
    } else if (name === "skewy" && args.length >= 1) {
      next = [1, Math.tan((args[0] * Math.PI) / 180), 0, 1, 0, 0];
    }

    if (next) matrix = multiply(matrix, next);
  }
  return matrix;
}

function isIdentity(matrix: MatrixTuple): boolean {
  return matrix.every((value, index) => Math.abs(value - IDENTITY[index]) < 1e-10);
}

function styleMap(element: Element): Map<string, string> {
  const map = new Map<string, string>();
  for (const declaration of (element.getAttribute("style") ?? "").split(";")) {
    const separator = declaration.indexOf(":");
    if (separator < 0) continue;
    map.set(
      declaration.slice(0, separator).trim().toLowerCase(),
      declaration.slice(separator + 1).trim()
    );
  }
  return map;
}

function property(element: Element, inline: Map<string, string>, name: string): string | undefined {
  return inline.get(name) ?? element.getAttribute(name) ?? undefined;
}

function finite(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

let colorContext: CanvasRenderingContext2D | null | undefined;

function normalizeColor(value: string): string {
  const clean = value.trim();
  if (!clean || clean === "none" || clean.startsWith("url(")) return clean || "none";
  if (clean.startsWith("#")) {
    if (/^#[0-9a-f]{3}$/i.test(clean)) {
      return `#${clean.slice(1).split("").map((part) => part + part).join("")}`.toUpperCase();
    }
    if (/^#[0-9a-f]{6}$/i.test(clean)) return clean.toUpperCase();
  }

  colorContext ??= document.createElement("canvas").getContext("2d");
  if (!colorContext) return "#000000";
  colorContext.fillStyle = "#010203";
  colorContext.fillStyle = clean;
  const normalized = colorContext.fillStyle;
  return typeof normalized === "string" ? normalized.toUpperCase() : "#000000";
}

function cascadeStyle(element: Element, parent: StyleState): StyleState {
  const inline = styleMap(element);
  const display = property(element, inline, "display");
  const visibility = property(element, inline, "visibility");
  const color = property(element, inline, "color") ?? parent.color;
  const fillValue = property(element, inline, "fill") ?? parent.fill;
  const strokeValue = property(element, inline, "stroke") ?? parent.stroke;
  const lineCapValue = property(element, inline, "stroke-linecap") ?? parent.strokeLinecap;
  const lineJoinValue = property(element, inline, "stroke-linejoin") ?? parent.strokeLinejoin;
  const fillRuleValue = property(element, inline, "fill-rule") ?? parent.fillRule;
  const dashValue = property(element, inline, "stroke-dasharray");

  return {
    fill: fillValue === "currentColor" ? color : fillValue,
    stroke: strokeValue === "currentColor" ? color : strokeValue,
    color,
    strokeWidth: finite(property(element, inline, "stroke-width"), parent.strokeWidth),
    strokeLinecap: lineCapValue === "round" || lineCapValue === "square" ? lineCapValue : "butt",
    strokeLinejoin: lineJoinValue === "round" || lineJoinValue === "bevel" ? lineJoinValue : "miter",
    strokeDasharray: dashValue === "none"
      ? undefined
      : dashValue
        ? numbers(dashValue)
        : parent.strokeDasharray,
    strokeDashoffset: finite(
      property(element, inline, "stroke-dashoffset"),
      parent.strokeDashoffset ?? 0
    ),
    fillRule: fillRuleValue === "evenodd" ? "evenodd" : "nonzero",
    opacity: parent.opacity * clamp01(finite(property(element, inline, "opacity"), 1)),
    fillOpacity: parent.fillOpacity * clamp01(finite(property(element, inline, "fill-opacity"), 1)),
    strokeOpacity: parent.strokeOpacity * clamp01(finite(property(element, inline, "stroke-opacity"), 1)),
    hidden: parent.hidden || display === "none" || visibility === "hidden"
  };
}

function coordinate(value: string | null, fallback: number, percentBase = 1): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return value.trim().endsWith("%") ? (parsed / 100) * percentBase : parsed;
}

function gradientStops(
  element: Element,
  root: Element,
  seen = new Set<string>()
): Array<{ offset: number; color: string; opacity?: number }> {
  const stops: Array<{ offset: number; color: string; opacity?: number }> = [];
  for (const child of Array.from(element.children)) {
    if (child.localName !== "stop") continue;
    const inline = styleMap(child);
    const rawOffset = child.getAttribute("offset") ?? "0";
    const offset = rawOffset.trim().endsWith("%")
      ? finite(rawOffset, 0) / 100
      : finite(rawOffset, 0);
    const color = normalizeColor(property(child, inline, "stop-color") ?? "#000000");
    const opacity = clamp01(finite(property(child, inline, "stop-opacity"), 1));
    stops.push({
      offset: clamp01(offset),
      color,
      ...(opacity < 1 ? { opacity } : {})
    });
  }
  if (stops.length > 0) return stops;

  const href = element.getAttribute("href") ?? element.getAttributeNS("http://www.w3.org/1999/xlink", "href");
  const referencedId = href?.startsWith("#") ? href.slice(1) : undefined;
  if (referencedId && !seen.has(referencedId)) {
    const referenced = Array.from(root.querySelectorAll("linearGradient, radialGradient"))
      .find((candidate) => candidate.getAttribute("id") === referencedId);
    if (referenced) return gradientStops(referenced, root, new Set([...seen, referencedId]));
  }

  return [{ offset: 0, color: "#000000" }, { offset: 1, color: "#000000" }];
}

function collectGradients(root: Element, viewBox: [number, number, number, number]): Map<string, Paint> {
  const gradients = new Map<string, Paint>();
  let index = 0;

  for (const element of Array.from(root.querySelectorAll("linearGradient, radialGradient"))) {
    const sourceId = element.getAttribute("id");
    if (!sourceId) continue;
    const units = element.getAttribute("gradientUnits") === "userSpaceOnUse"
      ? "userSpaceOnUse"
      : "objectBoundingBox";
    const xBase = units === "userSpaceOnUse" ? viewBox[2] : 1;
    const yBase = units === "userSpaceOnUse" ? viewBox[3] : 1;
    const stops = gradientStops(element, root, new Set([sourceId]));
    const id = `import-gradient-${index++}`;
    const fallback = stops[Math.floor(stops.length / 2)]?.color ?? "#000000";
    const parsedTransform = parseTransform(element.getAttribute("gradientTransform"));
    const matrix = isIdentity(parsedTransform) ? undefined : parsedTransform;

    if (element.localName === "radialGradient") {
      const gradient: RadialGradient = {
        kind: "radial",
        id,
        cx: coordinate(element.getAttribute("cx"), 0.5 * xBase, xBase),
        cy: coordinate(element.getAttribute("cy"), 0.5 * yBase, yBase),
        r: coordinate(element.getAttribute("r"), 0.5 * Math.max(xBase, yBase), Math.max(xBase, yBase)),
        fx: coordinate(element.getAttribute("fx"), 0.5 * xBase, xBase),
        fy: coordinate(element.getAttribute("fy"), 0.5 * yBase, yBase),
        units,
        matrix,
        stops,
        fallback
      };
      gradients.set(sourceId, gradient);
    } else {
      const gradient: LinearGradient = {
        kind: "linear",
        id,
        x1: coordinate(element.getAttribute("x1"), 0, xBase),
        y1: coordinate(element.getAttribute("y1"), 0, yBase),
        x2: coordinate(element.getAttribute("x2"), xBase, xBase),
        y2: coordinate(element.getAttribute("y2"), 0, yBase),
        units,
        matrix,
        stops,
        fallback
      };
      gradients.set(sourceId, gradient);
    }
  }
  return gradients;
}

function paint(value: string, gradients: Map<string, Paint>): Paint {
  const match = value.match(/^url\(\s*#([^\s)]+)\s*\)$/);
  if (match) return gradients.get(match[1]) ?? "#000000";
  return normalizeColor(value);
}

function elementStyle(style: StyleState, gradients: Map<string, Paint>): VectorElementStyle {
  return {
    fill: paint(style.fill, gradients),
    ...(style.stroke !== "none" ? { stroke: normalizeColor(style.stroke) } : {}),
    ...(style.stroke !== "none" ? { strokeWidth: style.strokeWidth } : {}),
    ...(style.stroke !== "none" ? { strokeLinecap: style.strokeLinecap } : {}),
    ...(style.stroke !== "none" ? { strokeLinejoin: style.strokeLinejoin } : {}),
    ...(style.strokeDasharray?.length ? { strokeDasharray: style.strokeDasharray } : {}),
    ...(style.strokeDashoffset ? { strokeDashoffset: style.strokeDashoffset } : {}),
    fillRule: style.fillRule,
    ...(style.opacity < 1 ? { opacity: style.opacity } : {}),
    ...(style.fillOpacity < 1 ? { fillOpacity: style.fillOpacity } : {}),
    ...(style.strokeOpacity < 1 ? { strokeOpacity: style.strokeOpacity } : {})
  };
}

function matrixFor(element: Element, parent: MatrixTuple): MatrixTuple {
  return multiply(parent, parseTransform(element.getAttribute("transform")));
}

function pathFromPoints(points: string | null, close: boolean): string | undefined {
  const values = numbers(points);
  if (values.length < 2) return undefined;
  const pairs: string[] = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    pairs.push(`${values[index]} ${values[index + 1]}`);
  }
  return `M ${pairs.join(" L ")}${close ? " Z" : ""}`;
}

function vectorElement(
  element: Element,
  style: StyleState,
  matrix: MatrixTuple,
  gradients: Map<string, Paint>
): VectorElementRecipe | undefined {
  const shared = {
    ...(element.getAttribute("id") ? { id: element.getAttribute("id") ?? undefined } : {}),
    ...(!isIdentity(matrix) ? { matrix } : {}),
    ...elementStyle(style, gradients)
  };

  switch (element.localName) {
    case "path": {
      const d = element.getAttribute("d")?.trim();
      return d ? { kind: "path", d, ...shared } : undefined;
    }
    case "rect": {
      const width = coordinate(element.getAttribute("width"), 0);
      const height = coordinate(element.getAttribute("height"), 0);
      if (width <= 0 || height <= 0) return undefined;
      const rx = coordinate(element.getAttribute("rx"), 0);
      const ry = coordinate(element.getAttribute("ry"), rx);
      return {
        kind: "rect",
        x: coordinate(element.getAttribute("x"), 0),
        y: coordinate(element.getAttribute("y"), 0),
        width,
        height,
        rx,
        ry,
        ...shared
      };
    }
    case "circle": {
      const r = coordinate(element.getAttribute("r"), 0);
      return r > 0 ? {
        kind: "ellipse",
        cx: coordinate(element.getAttribute("cx"), 0),
        cy: coordinate(element.getAttribute("cy"), 0),
        rx: r,
        ry: r,
        ...shared
      } : undefined;
    }
    case "ellipse": {
      const rx = coordinate(element.getAttribute("rx"), 0);
      const ry = coordinate(element.getAttribute("ry"), 0);
      return rx > 0 && ry > 0 ? {
        kind: "ellipse",
        cx: coordinate(element.getAttribute("cx"), 0),
        cy: coordinate(element.getAttribute("cy"), 0),
        rx,
        ry,
        ...shared
      } : undefined;
    }
    case "polygon":
    case "polyline": {
      const d = pathFromPoints(element.getAttribute("points"), element.localName === "polygon");
      return d ? { kind: "path", d, ...shared } : undefined;
    }
    case "line":
      return {
        kind: "path",
        d: `M ${coordinate(element.getAttribute("x1"), 0)} ${coordinate(element.getAttribute("y1"), 0)} L ${coordinate(element.getAttribute("x2"), 0)} ${coordinate(element.getAttribute("y2"), 0)}`,
        ...shared,
        fill: "none"
      };
    default:
      return undefined;
  }
}

function parseViewBox(root: Element): [number, number, number, number] {
  const parsed = numbers(root.getAttribute("viewBox"));
  if (parsed.length >= 4 && parsed[2] > 0 && parsed[3] > 0) {
    return parsed.slice(0, 4) as [number, number, number, number];
  }
  const width = coordinate(root.getAttribute("width"), 1000);
  const height = coordinate(root.getAttribute("height"), 1000);
  return [0, 0, width > 0 ? width : 1000, height > 0 ? height : 1000];
}

function viewBoxToViewport(
  viewBox: [number, number, number, number],
  x: number,
  y: number,
  width: number,
  height: number,
  preserveAspectRatio: string | null
): MatrixTuple {
  const [vx, vy, viewWidth, viewHeight] = viewBox;
  let scaleX = width / viewWidth;
  let scaleY = height / viewHeight;
  let offsetX = x;
  let offsetY = y;

  if (preserveAspectRatio !== "none") {
    const slice = preserveAspectRatio?.includes("slice") ?? false;
    const scale = slice ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
    scaleX = scale;
    scaleY = scale;
    offsetX += (width - viewWidth * scale) / 2;
    offsetY += (height - viewHeight * scale) / 2;
  }

  return [scaleX, 0, 0, scaleY, offsetX - vx * scaleX, offsetY - vy * scaleY];
}

function safeName(filename: string): string {
  const withoutExtension = filename.replace(/\.svg$/i, "");
  return withoutExtension.replace(/[-_]+/g, " ").trim() || "Imported SVG";
}

export function importSvgAsRecipe(svg: string, filename = "imported.svg"): SvgImportResult {
  const documentNode = new DOMParser().parseFromString(svg, "image/svg+xml");
  const parserError = documentNode.querySelector("parsererror");
  if (parserError) throw new Error(`Invalid SVG: ${parserError.textContent?.trim() ?? "parse error"}`);

  const root = documentNode.documentElement;
  if (root.localName !== "svg") throw new Error("Invalid SVG: missing <svg> root.");
  if (root.querySelector("image, foreignObject, video, canvas, script")) {
    throw new Error("SVG contains raster, script, or foreign content that is not stock-safe.");
  }

  const warnings = new Set<string>();
  if (root.querySelector("filter")) warnings.add("Filters were omitted to keep the result vector-only.");
  if (root.querySelector("mask, clipPath")) warnings.add("Masks and clip paths are not flattened yet.");
  if (root.querySelector("text, textPath")) warnings.add("Text was omitted; convert text to outlines before importing.");
  if (root.querySelector("style")) warnings.add("CSS class rules are not imported; use inline or presentation styles.");

  const viewBox = parseViewBox(root);
  const gradients = collectGradients(root, viewBox);
  const elements: VectorElementRecipe[] = [];
  const references = new Map<string, Element>();
  for (const element of Array.from(root.querySelectorAll("[id]"))) {
    const id = element.getAttribute("id");
    if (id) references.set(id, element);
  }

  const baseStyle: StyleState = {
    fill: "#000000",
    stroke: "none",
    color: "#000000",
    strokeWidth: 1,
    strokeLinecap: "butt",
    strokeLinejoin: "miter",
    fillRule: "nonzero",
    opacity: 1,
    fillOpacity: 1,
    strokeOpacity: 1,
    hidden: false
  };

  const traverse = (
    element: Element,
    inheritedStyle: StyleState,
    inheritedMatrix: MatrixTuple,
    useStack: Set<string>
  ): void => {
    const tag = element.localName;
    if (["defs", "linearGradient", "radialGradient", "stop", "filter", "mask", "clipPath", "style", "metadata", "title", "desc"].includes(tag)) return;

    const style = cascadeStyle(element, inheritedStyle);
    if (style.hidden) return;
    let matrix = matrixFor(element, inheritedMatrix);

    if (tag === "svg" && element !== root) {
      const nestedViewBox = parseViewBox(element);
      const nestedWidth = coordinate(element.getAttribute("width"), nestedViewBox[2]);
      const nestedHeight = coordinate(element.getAttribute("height"), nestedViewBox[3]);
      matrix = multiply(matrix, viewBoxToViewport(
        nestedViewBox,
        coordinate(element.getAttribute("x"), 0),
        coordinate(element.getAttribute("y"), 0),
        nestedWidth,
        nestedHeight,
        element.getAttribute("preserveAspectRatio")
      ));
    }

    if (tag === "use") {
      const href = element.getAttribute("href") ?? element.getAttributeNS("http://www.w3.org/1999/xlink", "href");
      const id = href?.startsWith("#") ? href.slice(1) : undefined;
      if (!id || useStack.has(id)) return;
      const referenced = references.get(id);
      if (!referenced) return;
      const useX = coordinate(element.getAttribute("x"), 0);
      const useY = coordinate(element.getAttribute("y"), 0);
      if (referenced.localName === "symbol" && referenced.hasAttribute("viewBox")) {
        const symbolViewBox = parseViewBox(referenced);
        matrix = multiply(matrix, viewBoxToViewport(
          symbolViewBox,
          useX,
          useY,
          coordinate(element.getAttribute("width"), symbolViewBox[2]),
          coordinate(element.getAttribute("height"), symbolViewBox[3]),
          referenced.getAttribute("preserveAspectRatio")
        ));
      } else {
        matrix = multiply(matrix, translate(useX, useY));
      }
      traverse(referenced, style, matrix, new Set([...useStack, id]));
      return;
    }

    const parsed = vectorElement(element, style, matrix, gradients);
    if (parsed) elements.push(parsed);

    if (["svg", "g", "a", "switch", "symbol"].includes(tag)) {
      for (const child of Array.from(element.children)) {
        traverse(child, style, matrix, useStack);
      }
    } else if (!parsed && !["text", "textPath"].includes(tag)) {
      warnings.add(`Unsupported <${tag}> element was omitted.`);
    }
  };

  const rootStyle = cascadeStyle(root, baseStyle);
  for (const child of Array.from(root.children)) {
    traverse(child, rootStyle, IDENTITY, new Set());
  }

  if (elements.length === 0) {
    throw new Error("SVG contains no supported vector geometry.");
  }

  const aspect = viewBox[2] / viewBox[3];
  const width = aspect >= 1 ? 720 : 720 * aspect;
  const height = aspect >= 1 ? 720 / aspect : 720;
  const firstPaint = elements.find((element) => typeof element.fill === "string" && element.fill !== "none")?.fill;
  const faceColor = typeof firstPaint === "string" ? firstPaint : "#6366F1";

  return {
    recipe: {
      name: safeName(filename),
      canvas: { width: 1000, height: 1000, transparent: true },
      shape: {
        type: "custom",
        center: [500, 500],
        width,
        height,
        rotation: 0,
        depth: 0,
        bevel: 0,
        cornerRadius: 0,
        faceColor,
        sideColor: shade(faceColor, -32),
        lightAngle: 315,
        depthAngle: 105,
        source: {
          viewBox,
          elements,
          preserveAspectRatio: "meet",
          preserveColors: true
        }
      },
      symbol: {
        icon: "none",
        color: "#FFFFFF",
        sideColor: "#D3D0C8",
        scale: 0.75,
        depth: 0,
        offset: [0, 0]
      }
    },
    warnings: Array.from(warnings)
  };
}
