let mode = "guided";
let currentStep = 0;
let stitchMode = "SC";
let pattern = null;
let currentVariantKey = "";

const urlParams = new URLSearchParams(window.location.search);
const requestedPatternSlug = urlParams.get("pattern");
const requestedVariantKey = urlParams.get("size") || urlParams.get("variant");

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRpfPIFjsakzp0tnbnLfPcppDohelOIeX1Mu0CNIBrJtybPP7ZQ2zRtm0nBzzfdkMv8qEBa5ur13LFZ/pub?gid=0&single=true&output=csv";

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
    throw new Error(
      `Pattern data file not found. activeRows=${JSON.stringify(activeRows)}`
    );
  }

  const dataFile = String(selectedRow.dataFile).trim();
  const response = await fetch(dataFile, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(
      `Could not load pattern data. dataFile=${dataFile} status=${response.status} url=${response.url}`
    );
  }

  const rawText = await response.text();
  let data;

  try {
    data = JSON.parse(rawText);
  } catch (error) {
    throw new Error(
      `Pattern JSON could not be parsed. dataFile=${dataFile} message=${error.message} preview=${rawText.slice(0, 200)}`
    );
  }

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
    approxSize:
      variant?.approxSize || pattern.approxSize || pattern.sheetApproxSize || "",
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
      const match = cleaned.match(/^([A-Za-z ]+)\s+x\s+(\d+)$/i);

      if (!match) {
        return null;
      }

      return {
        colorName: match[1].trim(),
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
  variantSelectLabel.textContent = "Size:";

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
  const badge = document.getElementById("currentRowBadge");
  const stitchSummary = document.getElementById("currentRowStitchSummary");
  const chartLabels = document.querySelectorAll(".chart-label strong");

  if (
    !step ||
    !title ||
    !instructions ||
    !total ||
    !direction ||
    !chartContainer ||
    !badge ||
    !stitchSummary
  ) {
    return;
  }

  const isCompleted = completedSteps.includes(currentStep);
  const blocks = getStepVisualBlocks(step);

  title.textContent = getStepTitle(step, currentStep);
  instructions.innerHTML = `<strong>Instructions:</strong> ${step.instructions || "No instructions added yet."}`;
  total.innerHTML = `<strong>${getTotalLabel()}:</strong> ${getStepTotalValue(step)}`;
  direction.innerHTML = `<strong>${getDirectionLabel()}:</strong> ${getTurnText(step)}`;

  badge.textContent = isCompleted ? "Completed" : "In Progress";
  badge.className = isCompleted ? "current-row-badge completed" : "current-row-badge";

  stitchSummary.textContent = getVisualSummary(blocks.length);

  chartLabels.forEach((label) => {
    label.textContent = `${getVisualLabel()}:`;
  });

  chartContainer.innerHTML = "";
  chartContainer.appendChild(createChart(step));
}

function goToStep(stepIndex) {
  currentStep = stepIndex;
  mode = "guided";
  render();
}

function renderPatternList() {
  const container = document.getElementById("pattern");
  const patternSection = document.querySelector(".pattern-section");
  const patternSteps = getPatternSteps();

  if (!container || !patternSection) {
    return;
  }

  if (mode === "guided") {
    patternSection.style.display = "none";
    container.innerHTML = "";
    return;
  }

  patternSection.style.display = "block";
  container.innerHTML = "";

  patternSteps.forEach((step, index) => {
    const div = document.createElement("div");
    div.className = "row";
    div.style.cursor = "pointer";
    div.onclick = () => goToStep(index);

    if (index === currentStep) {
      div.classList.add("active");
    }

    if (completedSteps.includes(index)) {
      div.classList.add("completed");
    }

    const title = document.createElement("h3");
    title.textContent = getStepTitle(step, index);

    const instructions = document.createElement("p");
    instructions.innerHTML = `<strong>Instructions:</strong> ${step.instructions || "No instructions added yet."}`;

    const total = document.createElement("p");
    total.innerHTML = `<strong>${getTotalLabel()}:</strong> ${getStepTotalValue(step)}`;

    const direction = document.createElement("p");
    direction.innerHTML = `<strong>${getDirectionLabel()}:</strong> ${getTurnText(step)}`;

    const chartLabel = document.createElement("div");
    chartLabel.className = "chart-label";
    chartLabel.innerHTML = `<strong>${getVisualLabel()}:</strong>`;

    const stitchSummary = document.createElement("p");
    stitchSummary.className = "stitch-summary";
    stitchSummary.textContent = getVisualSummary(getStepVisualBlocks(step).length);

    div.appendChild(title);
    div.appendChild(instructions);
    div.appendChild(total);
    div.appendChild(direction);
    div.appendChild(chartLabel);
    div.appendChild(stitchSummary);
    div.appendChild(createChart(step));

    container.appendChild(div);
  });
}

function updateGraphHighlight() {
  const activePattern = getActivePatternData();
  const graphWrapper = document.getElementById("graphWrapper");
  const graphImage = document.getElementById("graphImage");
  const graphHighlight = document.getElementById("graphHighlight");
  const patternSteps = getPatternSteps();

  if (
    !graphWrapper ||
    !graphImage ||
    !graphHighlight ||
    !graphImage.complete ||
    !activePattern.graphImageUrl
  ) {
    if (graphHighlight) {
      graphHighlight.style.display = "none";
    }
    return;
  }

  const totalSteps = patternSteps.length;
  const imageWidth = graphImage.clientWidth;
  const imageHeight = graphImage.clientHeight;
  const imageLeft = graphImage.offsetLeft;
  const imageTop = graphImage.offsetTop;

  if (!totalSteps || !imageWidth || !imageHeight) {
    graphHighlight.style.display = "none";
    return;
  }

  graphHighlight.style.left = `${imageLeft}px`;
  graphHighlight.style.top = `${imageTop}px`;
  graphHighlight.style.width = `${imageWidth}px`;
  graphHighlight.style.height = `${imageHeight}px`;

  if (getPatternType() === "c2c") {
    const diagonalPosition =
      totalSteps <= 1 ? imageWidth + imageHeight : (1 - currentStep / (totalSteps - 1)) * (imageWidth + imageHeight);

    const intersections = [];

    const leftY = diagonalPosition;
    if (leftY >= 0 && leftY <= imageHeight) {
      intersections.push({ x: 0, y: leftY });
    }

    const topX = diagonalPosition;
    if (topX >= 0 && topX <= imageWidth) {
      intersections.push({ x: topX, y: 0 });
    }

    const rightY = diagonalPosition - imageWidth;
    if (rightY >= 0 && rightY <= imageHeight) {
      intersections.push({ x: imageWidth, y: rightY });
    }

    const bottomX = diagonalPosition - imageHeight;
    if (bottomX >= 0 && bottomX <= imageWidth) {
      intersections.push({ x: bottomX, y: imageHeight });
    }

    const uniquePoints = intersections.filter(
      (point, index, points) =>
        points.findIndex(
          (candidate) =>
            Math.abs(candidate.x - point.x) < 0.5 &&
            Math.abs(candidate.y - point.y) < 0.5
        ) === index
    );

    if (uniquePoints.length < 2) {
      graphHighlight.style.display = "none";
      return;
    }

    const [startPoint, endPoint] = uniquePoints;
    const bandThickness = Math.max(
      10,
      Math.min(24, ((imageWidth + imageHeight) / 2) / totalSteps * 1.75)
    );

    graphHighlight.classList.add("c2c-highlight");
    graphHighlight.style.border = "none";
    graphHighlight.style.boxShadow = "none";
    graphHighlight.style.borderRadius = "0";
    graphHighlight.style.background = "transparent";
    graphHighlight.innerHTML = `
      <svg viewBox="0 0 ${imageWidth} ${imageHeight}" preserveAspectRatio="none" aria-hidden="true">
        <line
          x1="${startPoint.x}"
          y1="${startPoint.y}"
          x2="${endPoint.x}"
          y2="${endPoint.y}"
          stroke="rgba(184, 92, 56, 0.22)"
          stroke-width="${bandThickness}"
          stroke-linecap="round"
        />
        <line
          x1="${startPoint.x}"
          y1="${startPoint.y}"
          x2="${endPoint.x}"
          y2="${endPoint.y}"
          stroke="rgba(184, 92, 56, 0.9)"
          stroke-width="${Math.max(3, bandThickness * 0.22)}"
          stroke-linecap="round"
        />
      </svg>
    `;
  } else {
    const stepHeight = imageHeight / totalSteps;
    const highlightTop = imageTop + imageHeight - stepHeight * (currentStep + 1);

    graphHighlight.classList.remove("c2c-highlight");
    graphHighlight.innerHTML = "";
    graphHighlight.style.background = "rgba(184, 92, 56, 0.16)";
    graphHighlight.style.border = "2px solid rgba(184, 92, 56, 0.95)";
    graphHighlight.style.boxShadow =
      "inset 0 0 0 1px rgba(255, 255, 255, 0.6)";
    graphHighlight.style.borderRadius = "6px";
    graphHighlight.style.top = `${highlightTop}px`;
    graphHighlight.style.height = `${stepHeight}px`;
  }

  graphHighlight.style.display = "block";
}

function openGraphModal() {
  const modal = document.getElementById("graphModal");
  if (!modal || !getActivePatternData().graphImageUrl) return;

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  updateGraphHighlight();
}

function closeGraphModal() {
  const modal = document.getElementById("graphModal");
  if (!modal) return;

  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function openResetModal() {
  const modal = document.getElementById("resetModal");
  const text = document.getElementById("resetModalText");

  if (!modal) {
    return;
  }

  if (text) {
    text.textContent =
      `This will clear your completed ${getUnitLabel(true).toLowerCase()} and return you to the beginning.`;
  }

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeResetModal() {
  const modal = document.getElementById("resetModal");

  if (!modal) {
    return;
  }

  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function confirmResetProgress() {
  closeResetModal();
  currentStep = 0;
  completedSteps = [];
  stitchMode = "SC";
  localStorage.removeItem(getStorageKey());
  render();
}

function render() {
  const progressText = document.getElementById("progressText");
  const rowSelect = document.getElementById("rowSelect");
  const completeButtons = document.querySelectorAll(".complete-button");
  const graphButtons = document.querySelectorAll("[onclick='openGraphModal()']");
  const patternSteps = getPatternSteps();
  const isC2c = getPatternType() === "c2c";

  if (!progressText || !rowSelect) {
    return;
  }

  rowSelect.value = String(currentStep);
  syncStitchModeSelect();
  syncVariantSelect();

  const completedCount = completedSteps.length;
  progressText.textContent = isC2c
    ? `${getUnitLabel()} ${currentStep + 1} of ${patternSteps.length} | ${completedCount} completed`
    : `${getUnitLabel()} ${currentStep + 1} of ${patternSteps.length} | ${completedCount} completed | ${stitchMode}`;

  graphButtons.forEach((button) => {
    button.hidden = !getActivePatternData().graphImageUrl;
  });

  completeButtons.forEach((button) => {
    button.textContent = completedSteps.includes(currentStep)
      ? `Mark ${getUnitLabel()} Incomplete`
      : `Mark ${getUnitLabel()} Complete`;
  });

  renderNotes();
  renderLegend();
  renderCurrentRow();
  renderPatternList();
  updateGraphHighlight();
  saveProgress();
}

function nextRow() {
  if (currentStep < getPatternSteps().length - 1) {
    currentStep += 1;
    render();
  }
}

function prevRow() {
  if (currentStep > 0) {
    currentStep -= 1;
    render();
  }
}

function setMode(newMode) {
  mode = newMode;
  render();
}

function jumpToRow() {
  const rowSelect = document.getElementById("rowSelect");
  currentStep = Number(rowSelect.value);
  render();
}

function changeVariant() {
  const variantSelect = document.getElementById("variantSelect");
  if (!variantSelect) return;

  currentVariantKey = variantSelect.value;
  currentStep = 0;
  completedSteps = [];
  mode = "guided";

  const nextUrl = new URL(window.location.href);
  if (currentVariantKey) {
    nextUrl.searchParams.set("size", currentVariantKey);
  } else {
    nextUrl.searchParams.delete("size");
  }
  window.history.replaceState({}, "", nextUrl);

  initializePatternContent();
  loadProgress();
  populateRowSelect();
  render();
}

function changeStitchMode() {
  const stitchModeSelect = document.getElementById("stitchModeSelect");
  if (!stitchModeSelect) return;

  stitchMode = stitchModeSelect.value;
  render();
}

function toggleCompleteRow() {
  if (completedSteps.includes(currentStep)) {
    completedSteps = completedSteps.filter((stepIndex) => stepIndex !== currentStep);
  } else {
    completedSteps.push(currentStep);
    completedSteps.sort((a, b) => a - b);
  }

  render();
}

function resetProgress() {
  openResetModal();
}

window.addEventListener("resize", updateGraphHighlight);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeGraphModal();
    closeResetModal();
  }
});

async function startApp() {
  try {
    pattern = await loadPatternData();

    const variantKeys = Object.keys(pattern.variants || {});
    const defaultVariantKey = pattern.defaultVariant || variantKeys[0] || "";
    currentVariantKey = variantKeys.includes(requestedVariantKey)
      ? requestedVariantKey
      : defaultVariantKey;

    initializePatternContent();
    loadProgress();
    populateRowSelect();
    renderLegend();
    render();
  } catch (error) {
    console.error(error);
    const message =
      error && error.message ? error.message : "Unknown loading error.";
    document.body.innerHTML =
      `<main class="page"><p>Sorry, this pattern could not be loaded.</p><p>${message}</p></main>`;
  }
}

startApp();
