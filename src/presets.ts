import type { AssetRecipe } from "./types";

type AssetModule = {
  default: AssetRecipe;
};

const assetModules = import.meta.glob<AssetModule>("./assets/*.json", {
  eager: true
});

function assetKey(path: string): string {
  const filename = path.split("/").pop();
  if (!filename) throw new Error(`Invalid asset path: ${path}`);
  return filename.replace(/\.json$/i, "");
}

export const presets: Record<string, AssetRecipe> = Object.fromEntries(
  Object.entries(assetModules).map(([path, module]) => [assetKey(path), module.default])
);

if (!presets.coin) {
  throw new Error("Missing required default asset: src/assets/coin.json");
}

export function clonePreset(key: string): AssetRecipe {
  return structuredClone(presets[key] ?? presets.coin);
}
