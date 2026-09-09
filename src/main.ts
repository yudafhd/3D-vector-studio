import "./style.css";
import { buildScene } from "./core/geometry";
import { sceneToSvg } from "./core/svg";
import { importSvgAsRecipe } from "./core/svg-import";
import { validateStockSafeSvg } from "./core/validator";
import { validateAssetRecipe } from "./core/recipe";
import { sceneToEps } from "./export/eps";
import { clonePreset, presets } from "./presets";
import { UI_ICONS } from "./ui/icons";
import { CURATED_PALETTES } from "./ui/palettes";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app root.");

app.innerHTML = `
  <main class="layout">
    <!-- Left: Stage & Workspace -->
    <section class="workspace">
      <header class="topbar">
        <div class="brand">
          <div class="brand-icon">${UI_ICONS.logo}</div>
          <div class="brand-title">
            <h1>Vector3D Studio</h1>
            <span class="brand-badge">Stock-Safe</span>
          </div>
        </div>

        <div class="topbar-center">
          <div class="preset-selector-wrap">
            <span class="preset-label">Preset</span>
            <select id="preset" class="preset-select">
              ${Object.keys(presets)
                .map(
                  (key) =>
                    `<option value="${key}"${key === "button" ? " selected" : ""}>${presets[key].name}</option>`
                )
                .join("")}
            </select>
          </div>
          <button id="shuffleBtn" class="btn btn-ghost btn-sm" title="Randomize style (R)">
            ${UI_ICONS.shuffle}
            <span>Shuffle</span>
          </button>
          <button id="resetPresetBtn" class="btn btn-ghost btn-sm" title="Reset to preset defaults">
            ${UI_ICONS.reset}
            <span>Reset</span>
          </button>
        </div>

        <div class="topbar-actions">
          <label class="btn btn-secondary btn-sm" style="cursor: pointer;" title="Import SVG or Recipe JSON file">
            ${UI_ICONS.upload}
            <span>Import</span>
            <input id="topbarImportInput" type="file" accept=".json,.svg,application/json,image/svg+xml" style="display: none;" />
          </label>

          <div class="export-menu-wrap">
            <button id="exportMenuToggle" class="btn btn-primary btn-sm" aria-expanded="false" title="Export Vector Asset">
              ${UI_ICONS.download}
              <span>Export</span>
              ${UI_ICONS.chevronDown}
            </button>
            <div id="exportPopover" class="export-popover">
              <!-- SVG -->
              <div class="export-menu-item">
                <div class="export-menu-header">
                  <span class="export-menu-title">SVG Vector</span>
                  <span class="export-menu-badge">Stock Safe</span>
                </div>
                <div style="display: flex; gap: 6px;">
                  <button id="exportSvg" class="btn btn-primary btn-sm" style="flex: 1;">
                    ${UI_ICONS.download} Download
                  </button>
                  <button id="quickCopySvg" class="btn btn-secondary btn-sm" style="flex: 1;">
                    ${UI_ICONS.copy} Copy Code
                  </button>
                </div>
              </div>

              <!-- EPS -->
              <div class="export-menu-item">
                <div class="export-menu-header">
                  <span class="export-menu-title">Adobe PostScript (EPS)</span>
                  <span class="export-menu-badge">Illustrator</span>
                </div>
                <button id="exportEps" class="btn btn-secondary btn-sm" style="width: 100%;">
                  ${UI_ICONS.download} Download .EPS
                </button>
              </div>

              <!-- PNG -->
              <div class="export-menu-item">
                <div class="export-menu-header">
                  <span class="export-menu-title">Rasterized PNG</span>
                  <span class="export-menu-badge">High-DPI</span>
                </div>
                <div class="png-scale-picker">
                  <button type="button" class="png-scale-btn" data-scale="1">1x</button>
                  <button type="button" class="png-scale-btn active" data-scale="2">2x</button>
                  <button type="button" class="png-scale-btn" data-scale="4">4x</button>
                </div>
                <button id="exportPng" class="btn btn-secondary btn-sm" style="width: 100%; margin-top: 4px;">
                  ${UI_ICONS.download} Download .PNG
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Stage Shell Viewport -->
      <div class="stage-shell">
        <!-- Floating Stage Toolbar (Top-Right) -->
        <div class="stage-toolbar">
          <button id="bgChecker" class="stage-tool-btn active" title="Transparent Checkerboard">
            ${UI_ICONS.bgChecker}
          </button>
          <button id="bgDark" class="stage-tool-btn" title="Dark Studio">
            ${UI_ICONS.bgDark}
          </button>
          <button id="bgLight" class="stage-tool-btn" title="Clean White">
            ${UI_ICONS.bgLight}
          </button>
          <button id="bgGrid" class="stage-tool-btn" title="Blueprint Grid">
            ${UI_ICONS.bgGrid}
          </button>

          <div class="toolbar-divider"></div>

          <button id="zoomOut" class="stage-tool-btn" title="Zoom Out">
            ${UI_ICONS.zoomOut}
          </button>
          <span id="zoomLevel" class="zoom-indicator">100%</span>
          <button id="zoomIn" class="stage-tool-btn" title="Zoom In">
            ${UI_ICONS.zoomIn}
          </button>
          <button id="zoomReset" class="stage-tool-btn" title="Reset Zoom">
            ${UI_ICONS.zoomReset}
          </button>
        </div>

        <!-- Canvas Card Host -->
        <div class="viewport-container">
          <div id="canvasCard" class="canvas-card bg-checker">
            <div id="svgHost"></div>
          </div>
        </div>

        <!-- Floating Stage Status Pill (Bottom) -->
        <footer class="stage-footer-pill">
          <div class="status-indicator">
            <span id="statusDot" class="status-dot"></span>
            <span id="validation">Vector-only SVG</span>
          </div>
          <div class="spec-item">
            ${UI_ICONS.nodes}
            <span id="nodeCount">0 nodes</span>
          </div>
          <div class="spec-item dim-mobile">
            ${UI_ICONS.canvasSize}
            <span>1000 × 1000 px</span>
          </div>
        </footer>
      </div>
    </section>

    <!-- Right: Inspector Sidebar -->
    <aside class="inspector">
      <!-- Tabs Header -->
      <nav class="inspector-tabs-bar" role="tablist">
        <button class="inspector-tab active" data-tab="lighting" role="tab" title="3D & Lighting" aria-label="3D & Lighting">
          ${UI_ICONS.tab3D}
        </button>
        <button class="inspector-tab" data-tab="material" role="tab" title="Material & Colors" aria-label="Material & Colors">
          ${UI_ICONS.tabColors}
        </button>
        <button class="inspector-tab" data-tab="layers" role="tab" title="Layers" aria-label="Layers">
          ${UI_ICONS.tabLayers}
        </button>
        <button class="inspector-tab" data-tab="recipe" role="tab" title="Recipe JSON" aria-label="Recipe JSON">
          ${UI_ICONS.tabCode}
        </button>
      </nav>

      <!-- Inspector Panels Container -->
      <div class="inspector-content">
        <!-- Panel 1: 3D & Lighting -->
        <div id="panel-lighting" class="inspector-panel active">
          <div class="panel-section">
            <div class="panel-header">
              <h3>3D Extrusion</h3>
              <span class="header-badge">Isometric</span>
            </div>

            <div class="control-group">
              <div class="control-label-row">
                <span class="control-label">Extrusion Depth <span class="control-caption">(3D thickness)</span></span>
                <span id="depthOut" class="control-value-badge">62 px</span>
              </div>
              <div class="slider-wrapper">
                <input id="depth" type="range" min="0" max="110" step="1" />
              </div>
            </div>

            <div class="control-group">
              <div class="control-label-row">
                <span class="control-label">Bevel Chamfer <span class="control-caption">(Edge curve)</span></span>
                <span id="bevelOut" class="control-value-badge">30 px</span>
              </div>
              <div class="slider-wrapper">
                <input id="bevel" type="range" min="0" max="55" step="1" />
              </div>
            </div>

            <div class="control-group">
              <div class="control-label-row">
                <span class="control-label">Extrusion Angle <span class="control-caption">(Projection)</span></span>
                <span id="depthAngleOut" class="control-value-badge">105°</span>
              </div>
              <div class="slider-wrapper">
                <input id="depthAngle" type="range" min="45" max="145" step="1" />
              </div>
            </div>
          </div>

          <div class="panel-section">
            <div class="panel-header">
              <h3>Light Direction</h3>
              <span class="header-badge">Specular</span>
            </div>

            <div class="control-group">
              <div class="control-label-row">
                <span class="control-label">Light Source Angle</span>
                <span id="lightAngleOut" class="control-value-badge">315°</span>
              </div>
              <div class="slider-wrapper">
                <input id="lightAngle" type="range" min="0" max="360" step="1" />
              </div>
              <div class="angle-presets">
                <button type="button" class="angle-preset-btn" data-angle="315">Top-L (315°)</button>
                <button type="button" class="angle-preset-btn" data-angle="270">Top (270°)</button>
                <button type="button" class="angle-preset-btn" data-angle="45">Top-R (45°)</button>
                <button type="button" class="angle-preset-btn" data-angle="90">Front (90°)</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Panel 2: Material & Colors -->
        <div id="panel-material" class="inspector-panel">
          <div class="panel-section">
            <div class="panel-header">
              <h3>Custom Swatches</h3>
            </div>
            <div class="color-swatches-grid">
              <label class="swatch-field" for="faceColor">
                <div class="color-input-bubble">
                  <input id="faceColor" type="color" />
                </div>
                <div class="swatch-text">
                  <span class="swatch-title">Face Color</span>
                  <span id="faceColorHex" class="swatch-hex">#F7D85B</span>
                </div>
              </label>

              <label class="swatch-field" for="sideColor">
                <div class="color-input-bubble">
                  <input id="sideColor" type="color" />
                </div>
                <div class="swatch-text">
                  <span class="swatch-title">Side Extrusion</span>
                  <span id="sideColorHex" class="swatch-hex">#B86B08</span>
                </div>
              </label>

              <label class="swatch-field" for="symbolColor">
                <div class="color-input-bubble">
                  <input id="symbolColor" type="color" />
                </div>
                <div class="swatch-text">
                  <span class="swatch-title">Symbol Face</span>
                  <span id="symbolColorHex" class="swatch-hex">#FFFFFF</span>
                </div>
              </label>

              <label class="swatch-field" for="symbolSideColor">
                <div class="color-input-bubble">
                  <input id="symbolSideColor" type="color" />
                </div>
                <div class="swatch-text">
                  <span class="swatch-title">Symbol Side</span>
                  <span id="symbolSideColorHex" class="swatch-hex">#D3D0C8</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <!-- Panel 3: Rendered Layers -->
        <div id="panel-layers" class="inspector-panel">
          <div class="panel-section">
            <div class="panel-header">
              <h3>Layer Stack</h3>
              <span id="layerCount" class="header-badge">0 layers</span>
            </div>
            <p class="layer-description">Urutan ini mengikuti susunan layer pada preset dan hasil render.</p>
            <div id="layerList" class="layer-list"></div>
          </div>
        </div>

        <!-- Panel 4: Recipe JSON -->
        <div id="panel-recipe" class="inspector-panel">
          <div class="panel-section recipe-panel">
            <div class="recipe-toolbar">
              <div class="panel-header">
                <h3>Recipe JSON Definition</h3>
              </div>
              <div style="display: flex; gap: 6px;">
                <label class="btn btn-secondary btn-sm" style="cursor: pointer;" title="Import SVG or Recipe JSON file">
                  ${UI_ICONS.upload}
                  <span>Import</span>
                  <input id="recipeImportInput" type="file" accept=".json,.svg,application/json,image/svg+xml" style="display: none;" />
                </label>
                <button id="copyRecipe" class="btn btn-secondary btn-sm">
                  ${UI_ICONS.copy}
                  <span>Copy</span>
                </button>
              </div>
            </div>
            <div class="recipe-textarea-wrap">
              <textarea id="recipeEditor" class="recipe-textarea" spellcheck="false"></textarea>
            </div>
            <div id="recipeError" class="error-banner"></div>
            <button id="applyRecipe" class="btn btn-primary" style="width: 100%;">Apply Recipe Changes</button>
          </div>
        </div>
      </div>
    </aside>
  </main>

  <!-- Toast Notification Container -->
  <div id="toastContainer" class="toast-container"></div>
`;

// Helper Element Selector
const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
};

// Toast Notifications
function showToast(message: string, isError = false): void {
  const container = el<HTMLDivElement>("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast${isError ? " toast-error" : ""}`;
  toast.innerHTML = `${isError ? UI_ICONS.tabCode : UI_ICONS.shieldCheck} <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px) scale(0.95)";
    toast.style.transition = "all 0.2s ease";
    setTimeout(() => toast.remove(), 220);
  }, 2400);
}

// Controls Dictionary
const controls = {
  preset: el<HTMLSelectElement>("preset"),
  depth: el<HTMLInputElement>("depth"),
  bevel: el<HTMLInputElement>("bevel"),
  faceColor: el<HTMLInputElement>("faceColor"),
  sideColor: el<HTMLInputElement>("sideColor"),
  symbolColor: el<HTMLInputElement>("symbolColor"),
  symbolSideColor: el<HTMLInputElement>("symbolSideColor"),
  lightAngle: el<HTMLInputElement>("lightAngle"),
  depthAngle: el<HTMLInputElement>("depthAngle")
};

const hexOutputs = {
  faceColor: el<HTMLSpanElement>("faceColorHex"),
  sideColor: el<HTMLSpanElement>("sideColorHex"),
  symbolColor: el<HTMLSpanElement>("symbolColorHex"),
  symbolSideColor: el<HTMLSpanElement>("symbolSideColorHex")
};

const outputs = {
  depth: el<HTMLSpanElement>("depthOut"),
  bevel: el<HTMLSpanElement>("bevelOut"),
  lightAngle: el<HTMLSpanElement>("lightAngleOut"),
  depthAngle: el<HTMLSpanElement>("depthAngleOut")
};

const svgHost = el<HTMLDivElement>("svgHost");
const canvasCard = el<HTMLDivElement>("canvasCard");
const validation = el<HTMLSpanElement>("validation");
const statusDot = el<HTMLSpanElement>("statusDot");
const nodeCount = el<HTMLSpanElement>("nodeCount");
const recipeEditor = el<HTMLTextAreaElement>("recipeEditor");
const recipeError = el<HTMLDivElement>("recipeError");
const zoomLevelIndicator = el<HTMLSpanElement>("zoomLevel");

let recipe = clonePreset("button");
let ignoreRecipeEditor = false;
let currentZoom = 1;
let pngExportScale = 2;

function download(name: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function numberValue(input: HTMLInputElement): number {
  return Number(input.value);
}

function updateSliderTrack(input: HTMLInputElement): void {
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  const val = Number(input.value) || 0;
  const percentage = ((val - min) / (max - min)) * 100;
  input.style.background = `linear-gradient(to right, #6366f1 0%, #6366f1 ${percentage}%, #252b3b ${percentage}%, #252b3b 100%)`;
}

function applyControlsToRecipe(): void {
  recipe.shape.depth = numberValue(controls.depth);
  recipe.shape.bevel = numberValue(controls.bevel);
  recipe.shape.faceColor = controls.faceColor.value;
  recipe.shape.sideColor = controls.sideColor.value;
  recipe.shape.lightAngle = numberValue(controls.lightAngle);
  recipe.shape.depthAngle = numberValue(controls.depthAngle);
  recipe.symbol.color = controls.symbolColor.value;
  recipe.symbol.sideColor = controls.symbolSideColor.value;

  if (recipe.parts && recipe.parts.length > 0) {
    const frontPart = recipe.parts[recipe.parts.length - 1];
    frontPart.shape = {
      ...recipe.shape,
      center: frontPart.shape.center
    };
    if (frontPart.symbol) {
      frontPart.symbol = {
        ...recipe.symbol,
        offset: frontPart.symbol.offset
      };
    }
    for (const part of recipe.parts) {
      part.shape.lightAngle = recipe.shape.lightAngle;
    }
  }
}

function syncControlsFromRecipe(): void {
  if (recipe.parts && recipe.parts.length > 0) {
    const frontPart = recipe.parts[recipe.parts.length - 1];
    recipe.shape = { ...frontPart.shape };
    if (frontPart.symbol) {
      recipe.symbol = { ...frontPart.symbol };
    }
  }

  controls.depth.value = String(recipe.shape.depth);
  controls.bevel.value = String(recipe.shape.bevel);
  controls.faceColor.value = recipe.shape.faceColor;
  controls.sideColor.value = recipe.shape.sideColor;
  controls.lightAngle.value = String(recipe.shape.lightAngle);
  controls.depthAngle.value = String(recipe.shape.depthAngle);
  controls.symbolColor.value = recipe.symbol.color;
  controls.symbolSideColor.value = recipe.symbol.sideColor;

  // Update slider gradient tracks
  [
    controls.depth,
    controls.bevel,
    controls.lightAngle,
    controls.depthAngle
  ].forEach(updateSliderTrack);
}

function syncOutputs(): void {
  outputs.depth.textContent = `${recipe.shape.depth} px`;
  outputs.bevel.textContent = `${recipe.shape.bevel} px`;
  outputs.lightAngle.textContent = `${recipe.shape.lightAngle}°`;
  outputs.depthAngle.textContent = `${recipe.shape.depthAngle}°`;

  hexOutputs.faceColor.textContent = recipe.shape.faceColor.toUpperCase();
  hexOutputs.sideColor.textContent = recipe.shape.sideColor.toUpperCase();
  hexOutputs.symbolColor.textContent = recipe.symbol.color.toUpperCase();
  hexOutputs.symbolSideColor.textContent = recipe.symbol.sideColor.toUpperCase();
}

let rafId: number | null = null;
let editorDebounceTimer: number | null = null;

function syncRecipeEditor(): void {
  if (!ignoreRecipeEditor) {
    recipeEditor.value = JSON.stringify(recipe, null, 2);
  }
}

function render(updateEditor = true): void {
  const scene = buildScene(recipe);
  const svg = sceneToSvg(scene);

  svgHost.innerHTML = svg;
  nodeCount.textContent = `${scene.nodes.length} nodes`;

  const result = validateStockSafeSvg(svg);
  statusDot.className = `status-dot ${result.ok ? "" : "bad"}`;
  validation.textContent = result.ok ? "" : result.messages[0];

  syncOutputs();

  if (updateEditor) {
    syncRecipeEditor();
  }
}

function scheduleRender(updateEditorImmediately = false): void {
  if (rafId === null) {
    rafId = requestAnimationFrame(() => {
      rafId = null;
      render(false);
    });
  }

  if (updateEditorImmediately) {
    if (editorDebounceTimer !== null) {
      clearTimeout(editorDebounceTimer);
      editorDebounceTimer = null;
    }
    syncRecipeEditor();
  } else if (!ignoreRecipeEditor) {
    if (editorDebounceTimer !== null) {
      clearTimeout(editorDebounceTimer);
    }
    editorDebounceTimer = window.setTimeout(() => {
      editorDebounceTimer = null;
      syncRecipeEditor();
    }, 250);
  }
}

// Bind Sliders & Color Pickers
const inputControls = [
  controls.depth,
  controls.bevel,
  controls.faceColor,
  controls.sideColor,
  controls.symbolColor,
  controls.symbolSideColor,
  controls.lightAngle,
  controls.depthAngle
];

inputControls.forEach((control) => {
  control.addEventListener("input", () => {
    if (control instanceof HTMLInputElement && control.type === "range") {
      updateSliderTrack(control);
    }
    if (control === controls.faceColor && recipe.shape.type === "custom" && recipe.shape.source) {
      recipe.shape.source.preserveColors = false;
    }
    if (control === controls.symbolColor && recipe.symbol.icon === "custom" && recipe.symbol.source) {
      recipe.symbol.source.preserveColors = false;
    }
    applyControlsToRecipe();
    scheduleRender(false);
  });

  control.addEventListener("change", () => {
    if (control instanceof HTMLInputElement && control.type === "range") {
      updateSliderTrack(control);
    }
    applyControlsToRecipe();
    scheduleRender(true);
  });
});

// Preset Selection
controls.preset.addEventListener("change", () => {
  recipe = clonePreset(controls.preset.value);
  syncControlsFromRecipe();
  render(true);
  showToast(`Switched to ${recipe.name}`);
});

// Light Angle Presets
document.querySelectorAll<HTMLButtonElement>(".angle-preset-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const angle = Number(btn.dataset.angle);
    if (Number.isNaN(angle)) return;
    controls.lightAngle.value = String(angle);
    updateSliderTrack(controls.lightAngle);
    applyControlsToRecipe();
    scheduleRender(true);
    showToast(`Light angle: ${angle}°`);
  });
});

// Inspector Tabs Navigation
const tabs = document.querySelectorAll<HTMLButtonElement>(".inspector-tab");
const panels = document.querySelectorAll<HTMLDivElement>(".inspector-panel");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const targetTab = tab.dataset.tab;
    tabs.forEach((t) => t.classList.toggle("active", t === tab));
    panels.forEach((p) => {
      p.classList.toggle("active", p.id === `panel-${targetTab}`);
    });
  });
});

// Export Popover Toggle
const exportMenuToggle = el<HTMLButtonElement>("exportMenuToggle");
const exportPopover = el<HTMLDivElement>("exportPopover");

exportMenuToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = exportPopover.classList.toggle("open");
  exportMenuToggle.setAttribute("aria-expanded", String(isOpen));
});

document.addEventListener("click", (e) => {
  if (!exportPopover.contains(e.target as Node) && !exportMenuToggle.contains(e.target as Node)) {
    exportPopover.classList.remove("open");
    exportMenuToggle.setAttribute("aria-expanded", "false");
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    exportPopover.classList.remove("open");
    exportMenuToggle.setAttribute("aria-expanded", "false");
  }
});

// Stage Background Modes
const bgModes = [
  { id: "bgChecker", cls: "bg-checker" },
  { id: "bgDark", cls: "bg-dark" },
  { id: "bgLight", cls: "bg-light" },
  { id: "bgGrid", cls: "bg-grid" }
];

bgModes.forEach(({ id, cls }) => {
  el<HTMLButtonElement>(id).addEventListener("click", () => {
    bgModes.forEach((m) => {
      canvasCard.classList.remove(m.cls);
      el<HTMLButtonElement>(m.id).classList.toggle("active", m.id === id);
    });
    canvasCard.classList.add(cls);
  });
});

// Stage Zoom Controls
function setZoom(scale: number): void {
  currentZoom = Math.min(Math.max(scale, 0.5), 2.2);
  canvasCard.style.setProperty("--zoom-scale", String(currentZoom));
  zoomLevelIndicator.textContent = `${Math.round(currentZoom * 100)}%`;
}

el<HTMLButtonElement>("zoomIn").addEventListener("click", () => setZoom(currentZoom + 0.15));
el<HTMLButtonElement>("zoomOut").addEventListener("click", () => setZoom(currentZoom - 0.15));
el<HTMLButtonElement>("zoomReset").addEventListener("click", () => setZoom(1));

// Shuffle / Randomize Feature
el<HTMLButtonElement>("shuffleBtn").addEventListener("click", () => {
  const randomPal = CURATED_PALETTES[Math.floor(Math.random() * CURATED_PALETTES.length)];

  recipe.shape.depth = Math.floor(Math.random() * 60) + 20;
  recipe.shape.bevel = Math.floor(Math.random() * 25) + 10;
  recipe.shape.lightAngle = Math.floor(Math.random() * 360);

  controls.faceColor.value = randomPal.faceColor;
  controls.sideColor.value = randomPal.sideColor;
  controls.symbolColor.value = randomPal.symbolColor;
  controls.symbolSideColor.value = randomPal.symbolSideColor;

  syncControlsFromRecipe();
  render(true);
  showToast("Randomized 3D asset style");
});

// Reset to Current Preset
el<HTMLButtonElement>("resetPresetBtn").addEventListener("click", () => {
  recipe = clonePreset(controls.preset.value);
  syncControlsFromRecipe();
  render(true);
  showToast("Reset to preset defaults");
});

// Quick Copy SVG
async function copySvgToClipboard(): Promise<void> {
  try {
    const scene = buildScene(recipe);
    const svgString = sceneToSvg(scene);
    await navigator.clipboard.writeText(svgString);
    showToast("SVG copied to clipboard!");
  } catch (err) {
    showToast("Failed to copy SVG to clipboard", true);
  }
}

el<HTMLButtonElement>("quickCopySvg").addEventListener("click", copySvgToClipboard);

// Export Actions
el<HTMLButtonElement>("exportSvg").addEventListener("click", () => {
  const scene = buildScene(recipe);
  const fileName = `${recipe.name.toLowerCase().replaceAll(" ", "-")}.svg`;
  download(fileName, sceneToSvg(scene), "image/svg+xml");
  showToast(`Exported ${fileName}`);
});

el<HTMLButtonElement>("exportEps").addEventListener("click", () => {
  try {
    const scene = buildScene(recipe);
    const fileName = `${recipe.name.toLowerCase().replaceAll(" ", "-")}.eps`;
    download(fileName, sceneToEps(scene), "application/postscript");
    showToast(`Exported ${fileName}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recipeError.textContent = `EPS export failed: ${message}`;
    recipeError.classList.add("visible");
    showToast("EPS export failed", true);
  }
});

// PNG Resolution Scale Switcher
document.querySelectorAll<HTMLButtonElement>(".png-scale-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const scale = Number(btn.dataset.scale);
    if (!scale) return;
    pngExportScale = scale;
    document.querySelectorAll<HTMLButtonElement>(".png-scale-btn").forEach((b) => {
      b.classList.toggle("active", b === btn);
    });
    showToast(`PNG resolution: ${scale * 1000}×${scale * 1000}px`);
  });
});

// Export PNG Action
el<HTMLButtonElement>("exportPng").addEventListener("click", () => {
  try {
    const scene = buildScene(recipe);
    const svgString = sceneToSvg(scene);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = scene.width * pngExportScale;
      canvas.height = scene.height * pngExportScale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const pngUrl = URL.createObjectURL(pngBlob);
        const anchor = document.createElement("a");
        anchor.href = pngUrl;
        const fileName = `${recipe.name.toLowerCase().replaceAll(" ", "-")}@${pngExportScale}x.png`;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(pngUrl);
        showToast(`Exported ${fileName}`);
      }, "image/png");
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      showToast("Failed to rasterize PNG", true);
    };

    img.src = url;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showToast(`PNG export failed: ${message}`, true);
  }
});

// Recipe JSON Apply & Copy
el<HTMLButtonElement>("applyRecipe").addEventListener("click", () => {
  recipeError.textContent = "";
  recipeError.classList.remove("visible");

  try {
    const parsed = validateAssetRecipe(JSON.parse(recipeEditor.value));
    recipe = parsed;
    controls.preset.selectedIndex = -1;
    syncControlsFromRecipe();
    render(false);
    showToast("Recipe applied successfully!");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recipeError.textContent = message;
    recipeError.classList.add("visible");
    showToast("Invalid JSON recipe", true);
  }
});

el<HTMLButtonElement>("copyRecipe").addEventListener("click", async () => {
  await navigator.clipboard.writeText(recipeEditor.value);
  showToast("Recipe JSON copied!");
});

recipeEditor.addEventListener("focus", () => {
  ignoreRecipeEditor = true;
});

recipeEditor.addEventListener("blur", () => {
  ignoreRecipeEditor = false;
});

// Import Recipe Logic
function importRecipeFromJsonString(jsonString: string, sourceName = "recipe.json"): void {
  recipeError.textContent = "";
  recipeError.classList.remove("visible");

  try {
    const parsed = validateAssetRecipe(JSON.parse(jsonString));

    recipe = parsed;
    controls.preset.selectedIndex = -1;
    syncControlsFromRecipe();
    render(false);
    showToast(`Imported ${parsed.name || sourceName}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recipeError.textContent = `Import error: ${message}`;
    recipeError.classList.add("visible");
    showToast(`Import failed: ${message}`, true);
  }
}

function importRecipeFromSvgString(svgString: string, sourceName = "asset.svg"): void {
  recipeError.textContent = "";
  recipeError.classList.remove("visible");

  try {
    const result = importSvgAsRecipe(svgString, sourceName);
    recipe = result.recipe;
    controls.preset.selectedIndex = -1;
    syncControlsFromRecipe();
    render(true);
    const warningSuffix = result.warnings.length > 0
      ? ` (${result.warnings.length} import warning${result.warnings.length === 1 ? "" : "s"})`
      : "";
    recipeError.textContent = result.warnings.join(" ");
    recipeError.classList.toggle("visible", result.warnings.length > 0);
    showToast(`Imported ${recipe.name}${warningSuffix}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recipeError.textContent = `Import error: ${message}`;
    recipeError.classList.add("visible");
    showToast(`Import failed: ${message}`, true);
  }
}

function importAssetText(text: string, file: File): void {
  const isSvg = file.name.toLowerCase().endsWith(".svg") || file.type === "image/svg+xml";
  if (isSvg) {
    importRecipeFromSvgString(text, file.name);
  } else {
    importRecipeFromJsonString(text, file.name);
  }
}

function bindFileInput(id: string): void {
  const input = document.getElementById(id) as HTMLInputElement | null;
  if (!input) return;

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) importAssetText(text, file);
      input.value = "";
    };
    reader.onerror = () => {
      showToast("Failed to read JSON file", true);
      input.value = "";
    };
    reader.readAsText(file);
  });
}

bindFileInput("topbarImportInput");
bindFileInput("recipeImportInput");

// Drag & Drop SVG or JSON onto Window / Canvas
window.addEventListener("dragover", (e) => {
  e.preventDefault();
});

window.addEventListener("drop", (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file && (/\.(json|svg)$/i.test(file.name) || file.type.includes("json") || file.type === "image/svg+xml")) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) importAssetText(text, file);
    };
    reader.onerror = () => {
      showToast("Failed to read dropped file", true);
    };
    reader.readAsText(file);
  }
});

// Keyboard Shortcuts
window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault();
    el<HTMLButtonElement>("exportSvg").click();
  } else if (e.key === "r" || e.key === "R") {
    el<HTMLButtonElement>("shuffleBtn").click();
  }
});

// Initial Setup
syncControlsFromRecipe();
render(true);
