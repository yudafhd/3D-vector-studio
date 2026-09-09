export interface ValidationResult {
  ok: boolean;
  messages: string[];
}

const forbiddenPatterns: Array<[RegExp, string]> = [
  [/<image\b/i, "Embedded raster image detected."],
  [/<filter\b/i, "SVG filter detected."],
  [/<foreignObject\b/i, "foreignObject detected."],
  [/data:image\//i, "Embedded bitmap data URI detected."],
  [/<video\b/i, "Video element detected."],
  [/<canvas\b/i, "Canvas element detected."]
];

export function validateStockSafeSvg(svg: string): ValidationResult {
  const messages: string[] = [];

  for (const [pattern, message] of forbiddenPatterns) {
    if (pattern.test(svg)) messages.push(message);
  }

  if (!/<svg\b/i.test(svg)) messages.push("Missing SVG root.");
  if (!/<(path|ellipse|rect|circle|polygon)\b/i.test(svg)) {
    messages.push("No supported vector geometry found.");
  }

  return {
    ok: messages.length === 0,
    messages:
      messages.length === 0
        ? ["Vector-only SVG: no bitmap, filter, foreignObject, video, or canvas detected."]
        : messages
  };
}
