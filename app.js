let mode = "guided";
let currentStep = 0;
let stitchMode = "SC";

const urlParams = new URLSearchParams(window.location.search);
const defaultPatternSlug = Object.keys(patterns)[0];
const requestedPatternSlug = urlParams.get("pattern");
const patternSlug = patterns[requestedPatternSlug] ? requestedPatternSlug : defaultPatternSlug;
const pattern = patterns[patternSlug];
const patternType = pattern.patternType || "row";
const patternSteps = pattern.steps || pattern.rows || [];
const storageKey = `crochet-pattern-progress:${pattern.slug}`;

const colorMap = pattern.colors || {};
const legendItems = Object.entries(colorMap).map(([name, color]) => ({
  name,
  color
}));

let completedSteps = [];

function getUnitLabel(plural = false) {
  if (plural) {
    return pattern.stepLabelPlural || (patternType === "c2c" ? "Diagonals" : "Rows");
  }

  return pattern.stepLabelSingular || (patternType === "c2c" ? "Diagonal" : "Row");
}

function getPatternCopy() {
  if (patternType === "c2c") {
    return {
      intro:
        pattern.intro ||
        "Follow the C2C pattern step by step online and track your progress as you crochet.",
      howToUseNote:
        pattern.howToUseNote ||
        "Guided Mode shows one diagonal at a time. Full Pattern shows every diagonal as a reference.",
      currentRowHelper:
        pattern.currentRowHelper ||
        "Use Guided Mode to focus on one diagonal at a time while you crochet.",
      graphNoteTitle: pattern.graphNoteTitle || "Graph View",
      graphNoteBody:
        pattern.graphNoteBody ||
        "Use the Open Full Graph button to see the complete chart with your current diagonal highlighted.",
      graphModalLabel: pattern.graphModalLabel || "Full Graph",
      graphModalTitle: pattern.graphModalTitle || "Pattern Chart",
      graphModalCopy:
        pattern.graphModalCopy ||
        "The highlighted band shows your current diagonal in the graph."
    };
  }

  return {
    intro:
      pattern.intro ||
      "Follow the pattern row by row online and track your progress as you crochet.",
    howToUseNote:
      pattern.howToUseNote ||
      "Guided Mode shows one row at a time. Full Pattern shows every row as a reference.",
    currentRowHelper:
      pattern.currentRowHelper ||
      "Use Guided Mode to focus on one row at a time while you crochet.",
    graphNoteTitle: pattern.graphNoteTitle || "Graph View",
    graphNoteBody:
      pattern.graphNoteBody ||
      "Use the Open Full Graph button to see the complete chart with your current row highlighted.",
    graphModalLabel: pattern.graphModalLabel || "Full Graph",
    graphModalTitle: pattern.graphModalTitle || "Pattern Chart",
    graphModalCopy:
      pattern.graphModalCopy ||
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

function getStepVisualBlocks(step) {
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
  return pattern.totalLabel || (patternType === "c2c" ? "Total blocks" : "Total stitches");
}

function getDirectionLabel() {
  return pattern.directionLabel || (patternType === "c2c" ? "Step note" : "Turning instruction");
}

function getVisualLabel() {
  return pattern.visualLabel || (patternType === "c2c" ? "Visual block chart" : "Visual row chart");
}

function getVisualSummary(count) {
  return patternType === "c2c"
    ? `${count} blocks shown in this step`
    : `${count} stitches shown in this row`;
}

function getTurnText(step) {
  if (step.turnText) {
    return step.turnText;
  }

  if (patternType === "c2c") {
    return "Follow the C2C increase, even, or decrease instructions for this diagonal.";
  }

  return stitchMode === "HDC" ? "Chain 2 and turn." : "Chain 1 and turn.";
}

function loadProgress() {
  const saved = localStorage.getItem(storageKey);

  if (!saved) {
    return;
  }

  try {
    const progress = JSON.parse(saved);
    currentStep = Math.min(progress.currentStep ?? progress.currentRow ?? 0, patternSteps.length - 1);
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
    storageKey,
    JSON.stringify({
      currentStep,
      completedSteps,
      stitchMode
    })
  );
}

function initializePatternContent() {
  const copy = getPatternCopy();
  const patternTitle = document.getElementById("patternTitle");
  const patternIntro = document.getElementById("patternIntro");
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

  document.title = `${pattern.title} | Interactive Crochet Pattern`;

  if (patternTitle) {
    patternTitle.textContent = pattern.title;
  }

  if (patternIntro) {
    patternIntro.textContent = copy.intro;
  }

  if (graphImage) {
    graphImage.src = pattern.graphImageUrl || "";
    graphImage.alt = pattern.graphImageAlt || `${pattern.title} graph`;
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
      patternType === "c2c"
        ? "Use this as your full diagonal-by-diagonal reference below."
        : "Use this as your full reference view below.";
  }
}

function populateRowSelect() {
  const rowSelect = document.getElementById("rowSelect");
  if (!rowSelect) return;

  rowSelect.innerHTML = "";

  patternSteps.forEach((step, index) => {
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

function parseInstructionBlocks(instructions) {
  return instructions
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

function createChart(step) {
  const blocks = getStepVisualBlocks(step);
  const chart = document.createElement("div");
  chart.className = patternType === "c2c" ? "stitch-chart c2c-chart" : "stitch-chart";

  blocks.forEach((block, index) => {
    const cell = document.createElement("div");
    cell.className = patternType === "c2c" ? "stitch-cell c2c-cell" : "stitch-cell";
    cell.style.backgroundColor = block.colorValue;
    cell.title = `${patternType === "c2c" ? "Block" : "Stitch"} ${index + 1}: ${block.colorName}`;
    chart.appendChild(cell);
  });

  return chart;
}

function renderNotes() {
  const turnInstructionNote = document.getElementById("turnInstructionNote");
  const stitchModeLabel = document.getElementById("stitchModeLabel");
  const stitchModeSelect = document.getElementById("stitchModeSelect");

  if (turnInstructionNote) {
    turnInstructionNote.textContent =
      patternType === "c2c"
        ? "C2C patterns use diagonal block steps, so each step note can cover increasing, even work, or decreasing."
        : stitchMode === "HDC"
          ? "For HDC, chain 2 and turn."
          : "For SC, chain 1 and turn.";
  }

  if (stitchModeLabel) {
    stitchModeLabel.hidden = patternType === "c2c";
  }

  if (stitchModeSelect) {
    stitchModeSelect.hidden = patternType === "c2c";
  }
}

function renderCurrentRow() {
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
  const graphImage = document.getElementById("graphImage");
  const graphHighlight = document.getElementById("graphHighlight");

  if (!graphImage || !graphHighlight || !graphImage.complete || !pattern.graphImageUrl) {
    if (graphHighlight) {
      graphHighlight.style.display = "none";
    }
    return;
  }

  const totalSteps = patternSteps.length;
  const imageHeight = graphImage.clientHeight;
  const stepHeight = imageHeight / totalSteps;
  const highlightTop = imageHeight - stepHeight * (currentStep + 1) + stepHeight / 2;

  graphHighlight.style.top = `${highlightTop}px`;
  graphHighlight.style.height = `${stepHeight}px`;
  graphHighlight.style.display = "block";
}

function openGraphModal() {
  const modal = document.getElementById("graphModal");
  if (!modal || !pattern.graphImageUrl) return;

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

function render() {
  const progressText = document.getElementById("progressText");
  const rowSelect = document.getElementById("rowSelect");
  const completeButtons = document.querySelectorAll(".complete-button");
  const graphButtons = document.querySelectorAll("[onclick='openGraphModal()']");

  if (!progressText || !rowSelect) {
    return;
  }

  rowSelect.value = String(currentStep);
  syncStitchModeSelect();

  const completedCount = completedSteps.length;
  progressText.textContent =
    patternType === "c2c"
      ? `${getUnitLabel()} ${currentStep + 1} of ${patternSteps.length} | ${completedCount} completed`
      : `${getUnitLabel()} ${currentStep + 1} of ${patternSteps.length} | ${completedCount} completed | ${stitchMode}`;

  graphButtons.forEach((button) => {
    button.hidden = !pattern.graphImageUrl;
  });

  completeButtons.forEach((button) => {
    button.textContent = completedSteps.includes(currentStep)
      ? `Mark ${getUnitLabel()} Incomplete`
      : `Mark ${getUnitLabel()} Complete`;
  });

  renderNotes();
  renderCurrentRow();
  renderPatternList();
  updateGraphHighlight();
  saveProgress();
}

function nextRow() {
  if (currentStep < patternSteps.length - 1) {
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
  currentStep = 0;
  completedSteps = [];
  stitchMode = "SC";
  localStorage.removeItem(storageKey);
  render();
}

window.addEventListener("resize", updateGraphHighlight);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeGraphModal();
  }
});

initializePatternContent();
loadProgress();
populateRowSelect();
renderLegend();
render();
