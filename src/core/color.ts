export function clamp(value: number, min = 0, max = 255): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeHex(hex: string): string {
  let clean = hex.trim().replace(/^#/, "");
  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (clean.length !== 6) {
    return "000000";
  }
  return clean;
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = normalizeHex(hex);
  const value = Number.parseInt(clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(clamp(n, 0, 255))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const r01 = r / 255;
  const g01 = g / 255;
  const b01 = b / 255;

  const max = Math.max(r01, g01, b01);
  const min = Math.min(r01, g01, b01);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r01:
        h = (g01 - b01) / d + (g01 < b01 ? 6 : 0);
        break;
      case g01:
        h = (b01 - r01) / d + 2;
        break;
      case b01:
        h = (r01 - g01) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h * 360, s, l];
}

function hue2rgb(p: number, q: number, t: number): number {
  let adjusted = t;
  if (adjusted < 0) adjusted += 1;
  if (adjusted > 1) adjusted -= 1;
  if (adjusted < 1 / 6) return p + (q - p) * 6 * adjusted;
  if (adjusted < 1 / 2) return q;
  if (adjusted < 2 / 3) return p + (q - p) * (2 / 3 - adjusted) * 6;
  return p;
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const h01 = (h % 360 + 360) % 360 / 360;
  const s01 = Math.max(0, Math.min(1, s));
  const l01 = Math.max(0, Math.min(1, l));

  if (s01 === 0) {
    const grey = Math.round(l01 * 255);
    return [grey, grey, grey];
  }

  const q = l01 < 0.5 ? l01 * (1 + s01) : l01 + s01 - l01 * s01;
  const p = 2 * l01 - q;

  const r = hue2rgb(p, q, h01 + 1 / 3);
  const g = hue2rgb(p, q, h01);
  const b = hue2rgb(p, q, h01 - 1 / 3);

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export function shade(hex: string, amount: number): string {
  if (hex === "none") return "none";
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);

  // amount is approx -60 to +60
  // Convert amount to lightness adjustment
  const deltaL = (amount / 255) * 1.05;
  const nextL = Math.max(0.04, Math.min(0.96, l + deltaL));

  // Maintain vibrancy in shadows
  let nextS = s;
  if (amount < 0) {
    nextS = Math.min(1, s * 1.08);
  }

  const [newR, newG, newB] = hslToRgb(h, nextS, nextL);
  return rgbToHex(newR, newG, newB);
}

export function hexToRgb01(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return [r / 255, g / 255, b / 255];
}

