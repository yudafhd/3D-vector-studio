import type {
  MatrixTuple,
  Paint,
  TransformSpec,
  VectorNode,
  VectorScene
} from "../types";

type GradientPaint = Exclude<Paint, string>;

function matrixToSvg(matrix: MatrixTuple): string {
  return `matrix(${matrix.join(" ")})`;
}

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

function transformToSvg(transform?: TransformSpec): string {
  if (!transform) return "";

  const tx = transform.translateX ?? 0;
  const ty = transform.translateY ?? 0;
  const rotate = transform.rotate ?? 0;
  const ox = transform.originX ?? 0;
  const oy = transform.originY ?? 0;
  const sx = transform.scaleX ?? 1;
  const sy = transform.scaleY ?? 1;

  const parts: string[] = [];

  if (tx !== 0 || ty !== 0) parts.push(`translate(${tx} ${ty})`);
  if (rotate !== 0) parts.push(`rotate(${rotate} ${ox} ${oy})`);
  if (sx !== 1 || sy !== 1) {
    parts.push(`translate(${ox} ${oy}) scale(${sx} ${sy}) translate(${-ox} ${-oy})`);
  }
  if (transform.matrix) parts.push(matrixToSvg(transform.matrix));

  return parts.join(" ");
}

function paintValue(paint: Paint): string {
  return typeof paint === "string" ? paint : `url(#${paint.id})`;
}

function commonAttrs(node: VectorNode): string {
  const attrs: string[] = [`fill="${escapeXml(paintValue(node.fill))}"`];

  if (node.stroke) attrs.push(`stroke="${escapeXml(node.stroke)}"`);
  if (node.strokeWidth !== undefined) attrs.push(`stroke-width="${node.strokeWidth}"`);
  if (node.opacity !== undefined) attrs.push(`opacity="${node.opacity}"`);
  if (node.fillOpacity !== undefined) attrs.push(`fill-opacity="${node.fillOpacity}"`);
  if (node.strokeOpacity !== undefined) attrs.push(`stroke-opacity="${node.strokeOpacity}"`);
  if (node.strokeDasharray) attrs.push(`stroke-dasharray="${node.strokeDasharray.join(" ")}"`);
  if (node.strokeDashoffset !== undefined) attrs.push(`stroke-dashoffset="${node.strokeDashoffset}"`);
  if ("strokeLinecap" in node && node.strokeLinecap) {
    attrs.push(`stroke-linecap="${node.strokeLinecap}"`);
  }
  if ("strokeLinejoin" in node && node.strokeLinejoin) {
    attrs.push(`stroke-linejoin="${node.strokeLinejoin}"`);
  }

  const transform = transformToSvg(node.transform);
  if (transform) attrs.push(`transform="${escapeXml(transform)}"`);

  return attrs.join(" ");
}

function collectGradients(scene: VectorScene): GradientPaint[] {
  const found = new Map<string, GradientPaint>();

  for (const node of scene.nodes) {
    if (typeof node.fill !== "string") {
      found.set(node.fill.id, node.fill);
    }
  }

  return Array.from(found.values());
}

function gradientVector(angle: number): { x1: number; y1: number; x2: number; y2: number } {
  const a = (angle * Math.PI) / 180;
  const x = Math.cos(a);
  const y = Math.sin(a);

  return {
    x1: 50 - x * 50,
    y1: 50 - y * 50,
    x2: 50 + x * 50,
    y2: 50 + y * 50
  };
}

function renderDefs(scene: VectorScene): string {
  const gradients = collectGradients(scene);
  if (gradients.length === 0) return "";

  const body = gradients
    .map((gradient) => {
      const stops = gradient.stops
        .map(
          (stop) =>
            `<stop offset="${stop.offset * 100}%" stop-color="${escapeXml(stop.color)}"${stop.opacity === undefined ? "" : ` stop-opacity="${stop.opacity}"`}/>`
        )
        .join("");

      const units = gradient.units ? ` gradientUnits="${gradient.units}"` : "";
      const gradientTransform = gradient.matrix
        ? ` gradientTransform="${escapeXml(matrixToSvg(gradient.matrix))}"`
        : "";

      if (gradient.kind === "radial") {
        return `<radialGradient id="${escapeXml(gradient.id)}" cx="${gradient.cx}" cy="${gradient.cy}" r="${gradient.r}"${gradient.fx === undefined ? "" : ` fx="${gradient.fx}"`}${gradient.fy === undefined ? "" : ` fy="${gradient.fy}"`}${units}${gradientTransform}>${stops}</radialGradient>`;
      }

      if (gradient.angle !== undefined) {
        const vector = gradientVector(gradient.angle);
        return `<linearGradient id="${escapeXml(gradient.id)}" x1="${vector.x1}%" y1="${vector.y1}%" x2="${vector.x2}%" y2="${vector.y2}%"${units}${gradientTransform}>${stops}</linearGradient>`;
      }

      return `<linearGradient id="${escapeXml(gradient.id)}" x1="${gradient.x1 ?? 0}" y1="${gradient.y1 ?? 0}" x2="${gradient.x2 ?? 1}" y2="${gradient.y2 ?? 0}"${units}${gradientTransform}>${stops}</linearGradient>`;
    })
    .join("");

  return `<defs>${body}</defs>`;
}

function renderNode(node: VectorNode): string {
  const attrs = commonAttrs(node);

  if (node.kind === "ellipse") {
    return `<ellipse cx="${node.cx}" cy="${node.cy}" rx="${node.rx}" ry="${node.ry}" ${attrs}/>`;
  }

  if (node.kind === "rect") {
    return `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${node.rx}" ry="${node.ry}" ${attrs}/>`;
  }

  return `<path d="${escapeXml(node.d)}" fill-rule="${node.fillRule ?? "nonzero"}" ${attrs}/>`;
}

function renderSceneNodes(nodes: VectorNode[]): string {
  if (nodes.length === 0) return "";

  const chunks: string[] = [];
  let currentGroup: string | undefined = undefined;
  let currentNodes: string[] = [];

  const flushGroup = () => {
    if (currentNodes.length > 0) {
      if (currentGroup) {
        chunks.push(`<g id="${escapeXml(currentGroup)}">${currentNodes.join("")}</g>`);
      } else {
        chunks.push(currentNodes.join(""));
      }
      currentNodes = [];
    }
  };

  for (const node of nodes) {
    if (node.group !== currentGroup) {
      flushGroup();
      currentGroup = node.group;
    }
    currentNodes.push(renderNode(node));
  }
  flushGroup();

  return chunks.join("");
}

export function sceneToSvg(scene: VectorScene): string {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}">`,
    renderDefs(scene),
    renderSceneNodes(scene.nodes),
    `</svg>`
  ].join("");
}
