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
  if (transform.matrix) {
    const [a, b, c, d, e, f] = transform.matrix;
    const epsMatrix = [a, -b, -c, d, c * height + e, height * (1 - d) - f];
    commands.push(`[${epsMatrix.map(fmt).join(" ")}] concat`);
  }

  return commands;
}

function beginNode(node: VectorNode, height: number): string[] {
  return ["gsave", ...transformCommands(node.transform, height)];
}

function finishNode(node: VectorNode): string[] {
  const commands: string[] = [];

  if (paintFallback(node.fill) !== "none") {
    const fillCommand = node.kind === "path" && node.fillRule === "evenodd" ? "eofill" : "fill";
    commands.push(rgbCommand(paintFallback(node.fill)), `gsave ${fillCommand} grestore`);
  }

  if (node.stroke && node.stroke !== "none" && (node.strokeWidth ?? 0) > 0) {
    const lineCap = node.strokeLinecap === "round" ? 1 : node.strokeLinecap === "square" ? 2 : 0;
    const lineJoin = node.strokeLinejoin === "round" ? 1 : node.strokeLinejoin === "bevel" ? 2 : 0;
    commands.push(
      rgbCommand(node.stroke),
      `${fmt(node.strokeWidth ?? 1)} setlinewidth`,
      `${lineCap} setlinecap`,
      `${lineJoin} setlinejoin`,
      node.strokeDasharray
        ? `[${node.strokeDasharray.map(fmt).join(" ")}] ${fmt(node.strokeDashoffset ?? 0)} setdash`
        : "[] 0 setdash",
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

interface CubicSegment {
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  x: number;
  y: number;
}

function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
  const dot = ux * vx + uy * vy;
  const length = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (length === 0) return 0;
  const angle = Math.acos(Math.max(-1, Math.min(1, dot / length)));
  return ux * vy - uy * vx < 0 ? -angle : angle;
}

function arcToCubics(
  startX: number,
  startY: number,
  rawRx: number,
  rawRy: number,
  rotation: number,
  largeArc: boolean,
  sweep: boolean,
  endX: number,
  endY: number
): CubicSegment[] {
  if ((startX === endX && startY === endY) || rawRx === 0 || rawRy === 0) return [];

  const phi = ((rotation % 360) * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (startX - endX) / 2;
  const dy = (startY - endY) / 2;
  const xPrime = cosPhi * dx + sinPhi * dy;
  const yPrime = -sinPhi * dx + cosPhi * dy;
  let rx = Math.abs(rawRx);
  let ry = Math.abs(rawRy);

  const radiusScale = (xPrime * xPrime) / (rx * rx) + (yPrime * yPrime) / (ry * ry);
  if (radiusScale > 1) {
    const scale = Math.sqrt(radiusScale);
    rx *= scale;
    ry *= scale;
  }

  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const numerator = Math.max(0, rx2 * ry2 - rx2 * yPrime * yPrime - ry2 * xPrime * xPrime);
  const denominator = rx2 * yPrime * yPrime + ry2 * xPrime * xPrime;
  const coefficient = (largeArc === sweep ? -1 : 1) * Math.sqrt(denominator === 0 ? 0 : numerator / denominator);
  const centerPrimeX = coefficient * ((rx * yPrime) / ry);
  const centerPrimeY = coefficient * (-(ry * xPrime) / rx);
  const centerX = cosPhi * centerPrimeX - sinPhi * centerPrimeY + (startX + endX) / 2;
  const centerY = sinPhi * centerPrimeX + cosPhi * centerPrimeY + (startY + endY) / 2;

  const ux = (xPrime - centerPrimeX) / rx;
  const uy = (yPrime - centerPrimeY) / ry;
  const vx = (-xPrime - centerPrimeX) / rx;
  const vy = (-yPrime - centerPrimeY) / ry;
  let startAngle = vectorAngle(1, 0, ux, uy);
  let deltaAngle = vectorAngle(ux, uy, vx, vy);
  if (!sweep && deltaAngle > 0) deltaAngle -= Math.PI * 2;
  if (sweep && deltaAngle < 0) deltaAngle += Math.PI * 2;

  const segmentCount = Math.max(1, Math.ceil(Math.abs(deltaAngle) / (Math.PI / 2)));
  const segmentAngle = deltaAngle / segmentCount;
  const result: CubicSegment[] = [];

  const point = (angle: number) => ({
    x: centerX + rx * cosPhi * Math.cos(angle) - ry * sinPhi * Math.sin(angle),
    y: centerY + rx * sinPhi * Math.cos(angle) + ry * cosPhi * Math.sin(angle)
  });
  const derivative = (angle: number) => ({
    x: -rx * cosPhi * Math.sin(angle) - ry * sinPhi * Math.cos(angle),
    y: -rx * sinPhi * Math.sin(angle) + ry * cosPhi * Math.cos(angle)
  });

  for (let index = 0; index < segmentCount; index += 1) {
    const endAngle = startAngle + segmentAngle;
    const start = point(startAngle);
    const end = point(endAngle);
    const startDerivative = derivative(startAngle);
    const endDerivative = derivative(endAngle);
    const alpha = (4 / 3) * Math.tan(segmentAngle / 4);
    result.push({
      c1x: start.x + alpha * startDerivative.x,
      c1y: start.y + alpha * startDerivative.y,
      c2x: end.x - alpha * endDerivative.x,
      c2y: end.y - alpha * endDerivative.y,
      x: end.x,
      y: end.y
    });
    startAngle = endAngle;
  }

  const last = result[result.length - 1];
  last.x = endX;
  last.y = endY;
  return result;
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
  let cubicControl: [number, number] | undefined;
  let quadraticControl: [number, number] | undefined;

  const number = (): number => {
    const value = Number(tokens[i]);
    i += 1;
    return value;
  };

  const absY = (y: number): number => height - y;
  const resetCurveControls = () => {
    cubicControl = undefined;
    quadraticControl = undefined;
  };

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
        resetCurveControls();
        command = "L";
        break;
      }

      case "m": {
        currentX += number();
        currentY += number();
        startX = currentX;
        startY = currentY;
        output.push(`${fmt(currentX)} ${fmt(absY(currentY))} moveto`);
        resetCurveControls();
        command = "l";
        break;
      }

      case "L": {
        currentX = number();
        currentY = number();
        output.push(`${fmt(currentX)} ${fmt(absY(currentY))} lineto`);
        resetCurveControls();
        break;
      }

      case "l": {
        currentX += number();
        currentY += number();
        output.push(`${fmt(currentX)} ${fmt(absY(currentY))} lineto`);
        resetCurveControls();
        break;
      }

      case "H": {
        currentX = number();
        output.push(`${fmt(currentX)} ${fmt(absY(currentY))} lineto`);
        resetCurveControls();
        break;
      }

      case "h": {
        currentX += number();
        output.push(`${fmt(currentX)} ${fmt(absY(currentY))} lineto`);
        resetCurveControls();
        break;
      }

      case "V": {
        currentY = number();
        output.push(`${fmt(currentX)} ${fmt(absY(currentY))} lineto`);
        resetCurveControls();
        break;
      }

      case "v": {
        currentY += number();
        output.push(`${fmt(currentX)} ${fmt(absY(currentY))} lineto`);
        resetCurveControls();
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
        cubicControl = [x2, y2];
        quadraticControl = undefined;
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
        cubicControl = [c2x, c2y];
        quadraticControl = undefined;
        currentX = endX;
        currentY = endY;
        break;
      }

      case "S": {
        const c1x = cubicControl ? currentX * 2 - cubicControl[0] : currentX;
        const c1y = cubicControl ? currentY * 2 - cubicControl[1] : currentY;
        const c2x = number();
        const c2y = number();
        const endX = number();
        const endY = number();
        output.push(
          `${fmt(c1x)} ${fmt(absY(c1y))} ${fmt(c2x)} ${fmt(absY(c2y))} ${fmt(endX)} ${fmt(absY(endY))} curveto`
        );
        cubicControl = [c2x, c2y];
        quadraticControl = undefined;
        currentX = endX;
        currentY = endY;
        break;
      }

      case "s": {
        const c1x = cubicControl ? currentX * 2 - cubicControl[0] : currentX;
        const c1y = cubicControl ? currentY * 2 - cubicControl[1] : currentY;
        const c2x = currentX + number();
        const c2y = currentY + number();
        const endX = currentX + number();
        const endY = currentY + number();
        output.push(
          `${fmt(c1x)} ${fmt(absY(c1y))} ${fmt(c2x)} ${fmt(absY(c2y))} ${fmt(endX)} ${fmt(absY(endY))} curveto`
        );
        cubicControl = [c2x, c2y];
        quadraticControl = undefined;
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

        quadraticControl = [qx, qy];
        cubicControl = undefined;
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

        quadraticControl = [qx, qy];
        cubicControl = undefined;
        currentX = endX;
        currentY = endY;
        break;
      }

      case "T": {
        const qx = quadraticControl ? currentX * 2 - quadraticControl[0] : currentX;
        const qy = quadraticControl ? currentY * 2 - quadraticControl[1] : currentY;
        const endX = number();
        const endY = number();
        const c1x = currentX + (2 / 3) * (qx - currentX);
        const c1y = currentY + (2 / 3) * (qy - currentY);
        const c2x = endX + (2 / 3) * (qx - endX);
        const c2y = endY + (2 / 3) * (qy - endY);
        output.push(
          `${fmt(c1x)} ${fmt(absY(c1y))} ${fmt(c2x)} ${fmt(absY(c2y))} ${fmt(endX)} ${fmt(absY(endY))} curveto`
        );
        quadraticControl = [qx, qy];
        cubicControl = undefined;
        currentX = endX;
        currentY = endY;
        break;
      }

      case "t": {
        const qx = quadraticControl ? currentX * 2 - quadraticControl[0] : currentX;
        const qy = quadraticControl ? currentY * 2 - quadraticControl[1] : currentY;
        const endX = currentX + number();
        const endY = currentY + number();
        const c1x = currentX + (2 / 3) * (qx - currentX);
        const c1y = currentY + (2 / 3) * (qy - currentY);
        const c2x = endX + (2 / 3) * (qx - endX);
        const c2y = endY + (2 / 3) * (qy - endY);
        output.push(
          `${fmt(c1x)} ${fmt(absY(c1y))} ${fmt(c2x)} ${fmt(absY(c2y))} ${fmt(endX)} ${fmt(absY(endY))} curveto`
        );
        quadraticControl = [qx, qy];
        cubicControl = undefined;
        currentX = endX;
        currentY = endY;
        break;
      }

      case "A":
      case "a": {
        const rx = number();
        const ry = number();
        const rotation = number();
        const largeArc = number() !== 0;
        const sweep = number() !== 0;
        const rawEndX = number();
        const rawEndY = number();
        const endX = command === "a" ? currentX + rawEndX : rawEndX;
        const endY = command === "a" ? currentY + rawEndY : rawEndY;
        const segments = arcToCubics(
          currentX,
          currentY,
          rx,
          ry,
          rotation,
          largeArc,
          sweep,
          endX,
          endY
        );
        if (segments.length === 0 && (currentX !== endX || currentY !== endY)) {
          output.push(`${fmt(endX)} ${fmt(absY(endY))} lineto`);
        } else {
          for (const segment of segments) {
            output.push(
              `${fmt(segment.c1x)} ${fmt(absY(segment.c1y))} ${fmt(segment.c2x)} ${fmt(absY(segment.c2y))} ${fmt(segment.x)} ${fmt(absY(segment.y))} curveto`
            );
          }
        }
        currentX = endX;
        currentY = endY;
        resetCurveControls();
        break;
      }

      case "Z":
      case "z":
        output.push("closepath");
        currentX = startX;
        currentY = startY;
        resetCurveControls();
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
