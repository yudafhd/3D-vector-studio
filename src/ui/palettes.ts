export interface ColorPalette {
  id: string;
  name: string;
  faceColor: string;
  sideColor: string;
  symbolColor: string;
  symbolSideColor: string;
}

export const CURATED_PALETTES: ColorPalette[] = [
  {
    id: "gold",
    name: "Gold Wealth",
    faceColor: "#F7D85B",
    sideColor: "#B86B08",
    symbolColor: "#FFFFFF",
    symbolSideColor: "#D3D0C8"
  },
  {
    id: "emerald",
    name: "Fintech Mint",
    faceColor: "#34D399",
    sideColor: "#065F46",
    symbolColor: "#FFFFFF",
    symbolSideColor: "#A7F3D0"
  },
  {
    id: "violet",
    name: "Cyber Violet",
    faceColor: "#818CF8",
    sideColor: "#3730A3",
    symbolColor: "#F5D0FE",
    symbolSideColor: "#C084FC"
  },
  {
    id: "titanium",
    name: "Obsidian Slate",
    faceColor: "#475569",
    sideColor: "#0F172A",
    symbolColor: "#38BDF8",
    symbolSideColor: "#0284C7"
  },
  {
    id: "coral",
    name: "Sunset Coral",
    faceColor: "#FB923C",
    sideColor: "#9A3412",
    symbolColor: "#FFF7ED",
    symbolSideColor: "#FDBA74"
  },
  {
    id: "ruby",
    name: "Ruby Shield",
    faceColor: "#F43F5E",
    sideColor: "#881337",
    symbolColor: "#FFFFFF",
    symbolSideColor: "#FDA4AF"
  }
];
