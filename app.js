 let mode = "guided";
let currentStep = 0;
let stitchMode = "SC";
let pattern = null;
let currentVariantKey = "";

const urlParams = new URLSearchParams(window.location.search);
const requestedPatternSlug = urlParams.get("pattern");
const requestedVariantKey = urlParams.get("size") || urlParams.get("variant");

// Replace this with your published Google Sheets CSV link.
const SHEET_CSV_URL = "PASTE_YOUR_PUBLISHED_CSV_URL_HERE";

let completedSteps = [];

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

async function loadPatternIndex() {
  const response = await fetch(SHEET_CSV_URL, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Could not load pattern index.");
  }

  const csv = await response.text();
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("Pattern index is empty.");
  }

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      headers.map((header, index) => [header, values[index] || ""])
    );
  });
}

async function loadPatternData() {
  const indexRows = await loadPatternIndex();
  const activeRows = indexRows.filter(
    (row) => String(row.isActive).toLowerCase() === "true"
  );

  const fallbackRow = activeRows[0];
  const matchedRow = activeRows.find((row) => row.slug === requestedPatternSlug);
  const selectedRow = matchedRow || fallbackRow;

  if (!selectedRow?.dataFile) {
    throw new Error("Pattern data file not found.");
  }

  const response = await fetch(selectedRow.dataFile, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Could not load pattern data.");
  }

  const data = await response.json();

  data.slug = data.slug || selectedRow.slug;
  data.title = data.title || selectedRow.title;
  data.patternType = data.patternType || selectedRow.patternType || "row";
  data.sheetApproxSize = selectedRow.approxSize || "";

  return data;
}

function getActivePatternData() {
  const variant =
    currentVariantKey && pattern?.variants && pattern.variants[currentVariantKey]
      ? pattern.variants[currentVariantKey]
      : null;

  return {
    ...pattern,
    ...(variant || {}),
    slug: pattern.slug,
    variantKey: currentVariantKey,
    variantLabel: variant?.label || "",
    title: variant?.title || pattern.title,
    patternType: variant?.patternType || pattern.patternType || "row",
    colors: variant?.colors || pattern.colors || {},
    steps: variant?.steps || variant?.rows || pattern.steps || pattern.rows || [],
    graphImageUrl: variant?.graphImageUrl || pattern.graphImageUrl || "",
    graphImageAlt: variant?.graphImageAlt || pattern.graphImageAlt || "",
    approxSize: variant?.approxSize || pattern.approxSize || pattern.sheetApproxSize || "",
    totalLabel: variant?.totalLabel || pattern.totalLabel || "",
    directionLabel: variant?.directionLabel || pattern.directionLabel || "",
    visualLabel: variant?.visualLabel || pattern.visualLabel || "",
    stepLabelSingular: variant?.stepLabelSingular || pattern.stepLabelSingular || "",
    stepLabelPlural: variant?.stepLabelPlural || pattern.stepLabelPlural || ""
  };
}

function getStorageKey() {
  const suffix = currentVariantKey ? `:${currentVariantKey}` : "";
  return `crochet-pattern-progress:${pattern.slug}${suffix}`;
}

function getPatternType() {
  return getActivePatternData().patternType;
}

function getPatternSteps() {
  return getActivePatternData().steps;
}

function getColorMap() {
  return getActivePatternData().colors;
}

function getLegendItems() {
  return Object.entries(getColorMap()).map(([name, color]) => ({
    name,
    color
  }));
}

function getUnitLabel(plural = false) {
  const activePattern = getActivePatternData();

  if (plural) {
    return (
      activePattern.stepLabelPlural ||
      (activePattern.patternType === "c2c" ? "Diagonals" : "Rows")
    );
  }

  return (
    activePattern.stepLabelSingular ||
    (activePattern.patternType === "c2c" ? "Diagonal" : "Row")
  );
}

function getPatternCopy() {
  const activePattern = getActivePatternData();

  if (activePattern.patternType === "c2c") {
    return {
      intro:
        activePattern.intro ||
        "Follow the C2C pattern step by step online and track your progress as you crochet.",
      howToUseNote:
        activePattern.howToUseNote ||
        "Guided Mode shows one diagonal at a time. Full Pattern shows every diagonal as a reference.",
      currentRowHelper:
        activePattern.currentRowHelper ||
        "Use Guided Mode to focus on one diagonal at a time while you crochet.",
      graphNoteTitle: activePattern.graphNoteTitle || "Graph View",
      graphNoteBody:
        activePattern.graphNoteBody ||
        "Use the Open Full Graph button to see the complete chart with your current diagonal highlighted.",
      graphModalLabel: activePattern.graphModalLabel || "Full Graph",
      graphModalTitle: activePattern.graphModalTitle || "Pattern Chart",
      graphModalCopy:
        activePattern.graphModalCopy ||
        "The highlighted band shows your current diagonal in the graph."
    };
  }

  return {
    intro:
      activePattern.intro ||
      "Follow the pattern row by row online and track your progress as you crochet.",
    howToUseNote:
      activePattern.howToUseNote ||
      "Guided Mode shows one row at a time. Full Pattern shows every row as a reference.",
    currentRowHelper:
      activePattern.currentRowHelper ||
      "Use Guided Mode to focus on one row at a time while you crochet.",
    graphNoteTitle: activePattern.graphNoteTitle || "Graph View",
    graphNoteBody:
      activePattern.graphNoteBody ||
      "Use the Open Full Graph button to see the complete chart with your current row highlighted.",
    graphModalLabel: activePattern.graphModalLabel || "Full Graph",
    graphModalTitle: activePattern.graphModalTitle || "Pattern Chart",
    graphModalCopy:
      activePattern.graphModalCopy ||
      "The highlighted band shows your current row in the graph."
  };
}

function getStepNumber(step, index) {
  return step.number ?? index + 1;
}

function getStepTitle(step, index) {
  if (step.title) {
    return step.title;
  }

  const sideText = step.side ? ` (${step.side})` : "";
  return `${getUnitLabel()} ${getStepNumber(step, index)}${sideText}`;
}

function parseInstructionBlocks(instructions) {
  return String(instructions || "")
    .split(",")
    .map((part) => part.trim())
    .map((part) => {
      const cleaned = part.replace(/[()]/g, "").trim();
      const match = cleaned.match(/^([A-Za-z]+)\s+x\s+(\d+)$/i);

      if (!match) {
        return null;
      }

      return {
        colorName: match[1],
        count: Number(match[2])
      };
    })
    .filter(Boolean);
}

function getStepVisualBlocks(step) {
  const colorMap = getColorMap();
  const sourceBlocks = Array.isArray(step.chartBlocks)
    ? step.chartBlocks
    : parseInstructionBlocks(step.instructions || "");

  const blocks = [];

  sourceBlocks.forEach((block) => {
    for (let i = 0; i < block.count; i += 1) {
      blocks.push({
        colorName: block.colorName,
        colorValue: colorMap[block.colorName] || "#cccccc"
      });
    }
  });

  return blocks;
}

function getStepTotalValue(step) {
  if (typeof step.totalBlocks === "number") {
    return step.totalBlocks;
  }

  if (typeof step.totalStitches === "number") {
    return step.totalStitches;
  }

  return getStepVisualBlocks(step).length;
}

function getTotalLabel() {
  const activePattern = getActivePatternData();
  return (
    activePattern.totalLabel ||
    (activePattern.patternType === "c2c" ? "Total blocks" : "Total stitches")
  );
}

function getDirectionLabel() {
  const activePattern = getActivePatternData();
  return (
    activePattern.directionLabel ||
    (activePattern.patternType === "c2c" ? "Step note" : "Turning instruction")
  );
}

function getVisualLabel() {
  const activePattern = getActivePatternData();
  return (
    activePattern.visualLabel ||
    (activePattern.patternType === "c2c" ? "Visual block chart" : "Visual row chart")
  );
}

function getVisualSummary(count) {
  return getPatternType() === "c2c"
    ? `${count} blocks shown in this step`
    : `${count} stitches shown in this row`;
}

function getTurnText(step) {
  if (step.turnText) {
    return step.turnText;
  }

  if (getPatternType() === "c2c") {
    return "Follow the C2C increase, even, or decrease instructions for this diagonal.";
  }

  return stitchMode === "HDC" ? "Chain 2 and turn." : "Chain 1 and turn.";
}

function loadProgress() {
  const saved = localStorage.getItem(getStorageKey());
  const patternSteps = getPatternSteps();

  if (!saved) {
    currentStep = 0;
    completedSteps = [];
    stitchMode = "SC";
    return;
  }

  try {
    const progress = JSON.parse(saved);
    currentStep = Math.min(
      progress.currentStep ?? progress.currentRow ?? 0,
      Math.max(patternSteps.length - 1, 0)
    );
    completedSteps = (progress.completedSteps ?? progress.completedRows ?? []).filter(
      (stepIndex) => stepIndex < patternSteps.length
    );
    stitchMode = progress.stitchMode ?? "SC";
  } catch (error) {
    currentStep = 0;
    completedSteps = [];
    stitchMode = "SC";
  }
}

function saveProgress() {
  localStorage.setItem(
    getStorageKey(),
    JSON.stringify({
      currentStep,
      completedSteps,
      stitchMode
    })
  );
}

function syncVariantSelect() {
  const variantSelectLabel = document.getElementById("variantSelectLabel");
  const variantSelect = document.getElementById("variantSelect");
  const variantKeys = Object.keys(pattern.variants || {});

  if (!variantSelectLabel || !variantSelect) {
    return;
  }

  if (!variantKeys.length) {
    variantSelectLabel.hidden = true;
    variantSelect.hidden = true;
    return;
  }

  variantSelectLabel.hidden = false;
  variantSelect.hidden = false;
  variantSelectLabel.textContent = pattern.variantLabel || "Size:";

  variantSelect.innerHTML = "";
  variantKeys.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = pattern.variants[key].label || key;
    variantSelect.appendChild(option);
  });

  variantSelect.value = currentVariantKey;
}

function initializePatternContent() {
  const activePattern = getActivePatternData();
  const copy = getPatternCopy();
  const patternTitle = document.getElementById("patternTitle");
  const patternIntro = document.getElementById("patternIntro");
  const patternSize = document.getElementById("patternSize");
  const graphImage = document.getElementById("graphImage");
  const howToUseNote = document.getElementById("howToUseNote");
  const currentRowHelper = document.querySelector(".current-row-helper");
  const graphNoteTitle = document.getElementById("graphNoteTitle");
  const graphNoteBody = document.getElementById("graphNoteBody");
  const graphModalLabel = document.getElementById("graphModalLabel");
  const graphModalTitle = document.getElementById("graphModalTitle");
  const graphModalCopy = document.getElementById("graphModalCopy");
  const rowSelectLabel = document.getElementById("rowSelectLabel");
  const currentStepLabel = document.getElementById("currentStepLabel");
  const patternSectionTitle = document.getElementById("patternSectionTitle");
  const patternSectionCopy = document.getElementById("patternSectionCopy");

  document.title = `${activePattern.title} | Interactive Crochet Pattern`;

  if (patternTitle) {
    patternTitle.textContent = activePattern.variantLabel
      ? `${activePattern.title} - ${activePattern.variantLabel}`
      : activePattern.title;
  }

  if (patternIntro) {
    patternIntro.textContent = copy.intro;
  }

  if (patternSize) {
    patternSize.hidden = !activePattern.approxSize;
    patternSize.textContent = activePattern.approxSize
      ? `Approximate size: ${activePattern.approxSize}`
      : "";
  }

  if (graphImage) {
    graphImage.src = activePattern.graphImageUrl || "";
    graphImage.alt = activePattern.graphImageAlt || `${activePattern.title} graph`;
  }

  if (howToUseNote) {
    howToUseNote.textContent = copy.howToUseNote;
  }

  if (currentRowHelper) {
    currentRowHelper.textContent = copy.currentRowHelper;
  }

  if (graphNoteTitle) {
    graphNoteTitle.textContent = copy.graphNoteTitle;
  }

  if (graphNoteBody) {
    graphNoteBody.textContent = copy.graphNoteBody;
  }

  if (graphModalLabel) {
    graphModalLabel.textContent = copy.graphModalLabel;
  }

  if (graphModalTitle) {
    graphModalTitle.textContent = copy.graphModalTitle;
  }

  if (graphModalCopy) {
    graphModalCopy.textContent = copy.graphModalCopy;
  }

  if (rowSelectLabel) {
    rowSelectLabel.textContent = `Jump to ${getUnitLabel().toLowerCase()}:`;
  }

  if (currentStepLabel) {
    currentStepLabel.textContent = `Current ${getUnitLabel()}`;
  }

  if (patternSectionTitle) {
    patternSectionTitle.textContent = `Pattern ${getUnitLabel(true)}`;
  }

  if (patternSectionCopy) {
    patternSectionCopy.textContent =
      getPatternType() === "c2c"
        ? "Use this as your full diagonal-by-diagonal reference below."
        : "Use this as your full reference view below.";
  }

  syncVariantSelect();
}

function populateRowSelect() {
  const rowSelect = document.getElementById("rowSelect");
  if (!rowSelect) return;

  rowSelect.innerHTML = "";

  getPatternSteps().forEach((step, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = getStepTitle(step, index);
    rowSelect.appendChild(option);
  });
}

function syncStitchModeSelect() {
  const stitchModeSelect = document.getElementById("stitchModeSelect");
  if (!stitchModeSelect) return;
  stitchModeSelect.value = stitchMode;
}

function renderLegend() {
  const legend = document.getElementById("legend");
  const legendPanel = document.querySelector(".legend-panel");
  const legendItems = getLegendItems();

  if (!legend) return;

  if (legendPanel) {
    legendPanel.style.display = legendItems.length ? "block" : "none";
  }

  legend.innerHTML = "";

  legendItems.forEach((item) => {
    const legendItem = document.createElement("div");
    legendItem.className = "legend-item";

    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.backgroundColor = item.color;

    const label = document.createElement("span");
    label.textContent = item.name;

    legendItem.appendChild(swatch);
    legendItem.appendChild(label);
    legend.appendChild(legendItem);
  });
}

function createChart(step) {
  const blocks = getStepVisualBlocks(step);
  const isC2c = getPatternType() === "c2c";
  const chart = document.createElement("div");
  chart.className = isC2c ? "stitch-chart c2c-chart" : "stitch-chart";

  blocks.forEach((block, index) => {
    const cell = document.createElement("div");
    cell.className = isC2c ? "stitch-cell c2c-cell" : "stitch-cell";
    cell.style.backgroundColor = block.colorValue;
    cell.title = `${isC2c ? "Block" : "Stitch"} ${index + 1}: ${block.colorName}`;
    chart.appendChild(cell);
  });

  return chart;
}

function renderNotes() {
  const turnInstructionNote = document.getElementById("turnInstructionNote");
  const stitchModeLabel = document.getElementById("stitchModeLabel");
  const stitchModeSelect = document.getElementById("stitchModeSelect");
  const isC2c = getPatternType() === "c2c";

  if (turnInstructionNote) {
    turnInstructionNote.textContent = isC2c
      ? "C2C patterns use diagonal block steps, so each step note can cover increasing, even work, or decreasing."
      : stitchMode === "HDC"
        ? "For HDC, chain 2 and turn."
        : "For SC, chain 1 and turn.";
  }

  if (stitchModeLabel) {
    stitchModeLabel.hidden = isC2c;
  }

  if (stitchModeSelect) {
    stitchModeSelect.hidden = isC2c;
  }
}

function renderCurrentRow() {
  const patternSteps = getPatternSteps();
  const step = patternSteps[currentStep];
  const title = document.getElementById("currentRowTitle");
  const instructions = document.getElementById("currentRowInstructions");
  const total = document.getElementById("currentRowTotal");
  const direction = document.getElementById("currentRowDirection");
  const chartContainer = document.getElementById("currentRowChart");
  const badge
