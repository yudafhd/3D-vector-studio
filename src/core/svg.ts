import type {
  LinearGradient,
  Paint,
  TransformSpec,
  VectorNode,
  VectorScene
} from "../types";

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

  const transform = transformToSvg(node.transform);
  if (transform) attrs.push(`transform="${escapeXml(transform)}"`);

  return attrs.join(" ");
}

function collectGradients(scene: VectorScene): LinearGradient[] {
  const found = new Map<string, LinearGradient>();

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
      const vector = gradientVector(gradient.angle);
      const stops = gradient.stops
        .map(
          (stop) =>
            `<stop offset="${stop.offset * 100}%" stop-color="${escapeXml(stop.color)}"/>`
        )
        .join("");

      return `<linearGradient id="${escapeXml(gradient.id)}" x1="${vector.x1}%" y1="${vector.y1}%" x2="${vector.x2}%" y2="${vector.y2}%">${stops}</linearGradient>`;
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
