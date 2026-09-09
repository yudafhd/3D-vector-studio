import type { Paint, TransformSpec, VectorNode, VectorScene } from "../types";
import { hexToRgb01 } from "../core/color";

function fmt(value: number): string {
  return Number(value.toFixed(4)).toString();
}

function paintFallback(paint: Paint): string {
  return typeof paint === "string" ? paint : paint.fallback;
}

function rgbCommand(hex: string): string {
  if (hex === "none") return "";
  const [r, g, b] = hexToRgb01(hex);
  return `${fmt(r)} ${fmt(g)} ${fmt(b)} setrgbcolor`;
}

function transformCommands(transform: TransformSpec | undefined, height: number): string[] {
  if (!transform) return [];

  const tx = transform.translateX ?? 0;
  const ty = -(transform.translateY ?? 0);
  const rotate = -(transform.rotate ?? 0);
  const ox = transform.originX ?? 0;
  const oy = height - (transform.originY ?? 0);
  const sx = transform.scaleX ?? 1;
  const sy = transform.scaleY ?? 1;

  const commands: string[] = [];

  if (tx !== 0 || ty !== 0) commands.push(`${fmt(tx)} ${fmt(ty)} translate`);
  if (rotate !== 0) {
    commands.push(`${fmt(ox)} ${fmt(oy)} translate`);
    commands.push(`${fmt(rotate)} rotate`);
    commands.push(`${fmt(-ox)} ${fmt(-oy)} translate`);
  }
  if (sx !== 1 || sy !== 1) {
    commands.push(`${fmt(ox)} ${fmt(oy)} translate`);
    commands.push(`${fmt(sx)} ${fmt(sy)} scale`);
    commands.push(`${fmt(-ox)} ${fmt(-oy)} translate`);
  }

  return commands;
}

function beginNode(node: VectorNode, height: number): string[] {
  return ["gsave", ...transformCommands(node.transform, height)];
}

function finishNode(node: VectorNode): string[] {
  const commands: string[] = [];

  if (paintFallback(node.fill) !== "none") {
    commands.push(rgbCommand(paintFallback(node.fill)), "gsave fill grestore");
  }

  if (node.stroke && node.stroke !== "none" && (node.strokeWidth ?? 0) > 0) {
    commands.push(
      rgbCommand(node.stroke),
      `${fmt(node.strokeWidth ?? 1)} setlinewidth`,
      "stroke"
    );
  } else if (paintFallback(node.fill) !== "none") {
    commands.push("newpath");
  }

  commands.push("grestore");
  return commands;
}

function ellipseToEps(node: Extract<VectorNode, { kind: "ellipse" }>, height: number): string {
  const cy = height - node.cy;
  const commands = beginNode(node, height);
  commands.push(
    "matrix currentmatrix",
    `${fmt(node.cx)} ${fmt(cy)} translate`,
    `${fmt(node.rx)} ${fmt(node.ry)} scale`,
    "newpath 0 0 1 0 360 arc closepath",
    "setmatrix"
  );
  commands.push(...finishNode(node));
  return commands.join("\n");
}

function roundedRectPath(node: Extract<VectorNode, { kind: "rect" }>, height: number): string[] {
  const x = node.x;
  const yTop = height - node.y;
  const yBottom = yTop - node.height;
  const r = Math.min(node.rx, node.ry, node.width / 2, node.height / 2);
  const k = 0.5522847498;
  const kr = r * k;
  const right = x + node.width;

  return [
    `newpath ${fmt(x + r)} ${fmt(yBottom)} moveto`,
    `${fmt(right - r)} ${fmt(yBottom)} lineto`,
    `${fmt(right - r + kr)} ${fmt(yBottom)} ${fmt(right)} ${fmt(yBottom + r - kr)} ${fmt(right)} ${fmt(yBottom + r)} curveto`,
    `${fmt(right)} ${fmt(yTop - r)} lineto`,
    `${fmt(right)} ${fmt(yTop - r + kr)} ${fmt(right - r + kr)} ${fmt(yTop)} ${fmt(right - r)} ${fmt(yTop)} curveto`,
    `${fmt(x + r)} ${fmt(yTop)} lineto`,
    `${fmt(x + r - kr)} ${fmt(yTop)} ${fmt(x)} ${fmt(yTop - r + kr)} ${fmt(x)} ${fmt(yTop - r)} curveto`,
    `${fmt(x)} ${fmt(yBottom + r)} lineto`,
    `${fmt(x)} ${fmt(yBottom + r - kr)} ${fmt(x + r - kr)} ${fmt(yBottom)} ${fmt(x + r)} ${fmt(yBottom)} curveto`,
    "closepath"
  ];
}

function rectToEps(node: Extract<VectorNode, { kind: "rect" }>, height: number): string {
  const commands = beginNode(node, height);
  commands.push(...roundedRectPath(node, height));
  commands.push(...finishNode(node));
  return commands.join("\n");
}

type Token = string;

function tokenizePath(d: string): Token[] {
  const matches = d.match(/([MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/g);
  return matches || [];
}

function isCommand(token: string): boolean {
  return /^[MmLlHhVvCcSsQqTtAaZz]$/.test(token);
}

function pathToPostScript(d: string, height: number): string[] {
  const tokens = tokenizePath(d);
  const output: string[] = ["newpath"];
  let i = 0;
  let command = "";
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;

  const number = (): number => {
    const value = Number(tokens[i]);
    i += 1;
    return value;
  };

  const absY = (y: number): number => height - y;

  while (i < tokens.length) {
    if (isCommand(tokens[i])) {
      command = tokens[i];
      i += 1;
    }

    switch (command) {
      case "M": {
        currentX = number();
        currentY = number();
        startX = currentX;
        startY = currentY;
        output.push(`${fmt(currentX)} ${fmt(absY(currentY))} moveto`);
        command = "L";
        break;
      }

      case "m": {
        currentX += number();
        currentY += number();
        startX = currentX;
        startY = currentY;
        output.push(`${fmt(currentX)} ${fmt(absY(currentY))} moveto`);
        command = "l";
        break;
      }

      case "L": {
        currentX = number();
        currentY = number();
        output.push(`${fmt(currentX)} ${fmt(absY(currentY))} lineto`);
        break;
      }

      case "l": {
        currentX += number();
        currentY += number();
        output.push(`${fmt(currentX)} ${fmt(absY(currentY))} lineto`);
        break;
      }

      case "H": {
        currentX = number();
        output.push(`${fmt(currentX)} ${fmt(absY(currentY))} lineto`);
        break;
      }

      case "h": {
        currentX += number();
        output.push(`${fmt(currentX)} ${fmt(absY(currentY))} lineto`);
        break;
      }

      case "V": {
        currentY = number();
        output.push(`${fmt(currentX)} ${fmt(absY(currentY))} lineto`);
        break;
      }

      case "v": {
        currentY += number();
        output.push(`${fmt(currentX)} ${fmt(absY(currentY))} lineto`);
        break;
      }

      case "C": {
        const x1 = number();
        const y1 = number();
        const x2 = number();
        const y2 = number();
        const x = number();
        const y = number();
        currentX = x;
        currentY = y;
        output.push(
          `${fmt(x1)} ${fmt(absY(y1))} ${fmt(x2)} ${fmt(absY(y2))} ${fmt(x)} ${fmt(absY(y))} curveto`
        );
        break;
      }

      case "c": {
        const c1x = currentX + number();
        const c1y = currentY + number();
        const c2x = currentX + number();
        const c2y = currentY + number();
        const endX = currentX + number();
        const endY = currentY + number();
        output.push(
          `${fmt(c1x)} ${fmt(absY(c1y))} ${fmt(c2x)} ${fmt(absY(c2y))} ${fmt(endX)} ${fmt(absY(endY))} curveto`
        );
        currentX = endX;
        currentY = endY;
        break;
      }

      case "Q": {
        const qx = number();
        const qy = number();
        const x = number();
        const y = number();

        const c1x = currentX + (2 / 3) * (qx - currentX);
        const c1y = currentY + (2 / 3) * (qy - currentY);
        const c2x = x + (2 / 3) * (qx - x);
        const c2y = y + (2 / 3) * (qy - y);

        output.push(
          `${fmt(c1x)} ${fmt(absY(c1y))} ${fmt(c2x)} ${fmt(absY(c2y))} ${fmt(x)} ${fmt(absY(y))} curveto`
        );

        currentX = x;
        currentY = y;
        break;
      }

      case "q": {
        const qx = currentX + number();
        const qy = currentY + number();
        const endX = currentX + number();
        const endY = currentY + number();

        const c1x = currentX + (2 / 3) * (qx - currentX);
        const c1y = currentY + (2 / 3) * (qy - currentY);
        const c2x = endX + (2 / 3) * (qx - endX);
        const c2y = endY + (2 / 3) * (qy - endY);

        output.push(
          `${fmt(c1x)} ${fmt(absY(c1y))} ${fmt(c2x)} ${fmt(absY(c2y))} ${fmt(endX)} ${fmt(absY(endY))} curveto`
        );

        currentX = endX;
        currentY = endY;
        break;
      }

      case "Z":
      case "z":
        output.push("closepath");
        currentX = startX;
        currentY = startY;
        command = "";
        break;

      default:
        throw new Error(`EPS exporter does not support SVG path command: ${command}`);
    }
  }

  return output;
}

function pathToEps(node: Extract<VectorNode, { kind: "path" }>, height: number): string {
  const commands = beginNode(node, height);
  commands.push(...pathToPostScript(node.d, height));
  commands.push(...finishNode(node));
  return commands.join("\n");
}

export function sceneToEps(scene: VectorScene): string {
  const body = scene.nodes
    .map((node) => {
      switch (node.kind) {
        case "ellipse":
          return ellipseToEps(node, scene.height);
        case "rect":
          return rectToEps(node, scene.height);
        case "path":
          return pathToEps(node, scene.height);
      }
    })
    .join("\n");

  return [
    "%!PS-Adobe-3.0 EPSF-3.0",
    `%%BoundingBox: 0 0 ${scene.width} ${scene.height}`,
    "%%LanguageLevel: 2",
    "%%Pages: 1",
    "%%EndComments",
    "1 setlinejoin",
    "1 setlinecap",
    body,
    "showpage",
    "%%EOF"
  ].join("\n");
}
