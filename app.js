let mode = "guided";
let currentRow = 0;
let stitchMode = "SC";

const urlParams = new URLSearchParams(window.location.search);
const defaultPatternSlug = Object.keys(patterns)[0];
const requestedPatternSlug = urlParams.get("pattern");
const patternSlug = patterns[requestedPatternSlug] ? requestedPatternSlug : defaultPatternSlug;
const pattern = patterns[patternSlug];
const storageKey = `crochet-pattern-progress:${pattern.slug}`;

const colorMap = pattern.colors || {};
const legendItems = Object.entries(colorMap).map(([name, color]) => ({
  name,
  color
}));

let completedRows = [];

function getPatternCopy() {
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

function loadProgress() {
  const saved = localStorage.getItem(storageKey);

  if (!saved) {
    return;
  }

  try {
    const progress = JSON.parse(saved);
    currentRow = Math.min(progress.currentRow ?? 0, pattern.rows.length - 1);
    completedRows = (progress.completedRows ?? []).filter(
      (rowIndex) => rowIndex < pattern.rows.length
    );
    stitchMode = progress.stitchMode ?? "SC";
  } catch (error) {
    currentRow = 0;
    completedRows = [];
    stitchMode = "SC";
  }
}

function saveProgress() {
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      currentRow,
      completedRows,
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
}

function populateRowSelect() {
  const rowSelect = document.getElementById("rowSelect");
  if (!rowSelect) return;

  rowSelect.innerHTML = "";

  pattern.rows.forEach((row, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = `Row ${row.number} (${row.side})`;
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

function buildStitchBlocks(row) {
  const blocks = parseInstructionBlocks(row.instructions);
  const stitches = [];

  blocks.forEach((block) => {
    for (let i = 0; i < block.count; i += 1) {
      stitches.push({
        colorName: block.colorName,
        colorValue: colorMap[block.colorName] || "#cccccc"
      });
    }
  });

  return stitches;
}

function createChart(row) {
  const stitches = buildStitchBlocks(row);
  const chart = document.createElement("div");
  chart.className = "stitch-chart";

  stitches.forEach((stitch, index) => {
    const cell = document.createElement("div");
    cell.className = "stitch-cell";
    cell.style.backgroundColor = stitch.colorValue;
    cell.title = `Stitch ${index + 1}: ${stitch.colorName}`;
    chart.appendChild(cell);
  });

  return chart;
}

function getTurnText() {
  return stitchMode === "HDC" ? "Chain 2 and turn." : "Chain 1 and turn.";
}

function renderNotes() {
  const turnInstructionNote = document.getElementById("turnInstructionNote");
  if (!turnInstructionNote) return;

  turnInstructionNote.textContent =
    stitchMode === "HDC" ? "For HDC, chain 2 and turn." : "For SC, chain 1 and turn.";
}

function renderCurrentRow() {
  const row = pattern.rows[currentRow];
  const title = document.getElementById("currentRowTitle");
  const instructions = document.getElementById("currentRowInstructions");
  const total = document.getElementById("currentRowTotal");
  const direction = document.getElementById("currentRowDirection");
  const chartContainer = document.getElementById("currentRowChart");
  const badge = document.getElementById("currentRowBadge");
  const stitchSummary = document.getElementById("currentRowStitchSummary");

  if (
    !row ||
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

  const isCompleted = completedRows.includes(currentRow);
  const stitches = buildStitchBlocks(row);

  title.textContent = `Row ${row.number} (${row.side})`;
  instructions.innerHTML = `<strong>Instructions:</strong> ${row.instructions}`;
  total.innerHTML = `<strong>Total stitches:</strong> ${row.totalStitches}`;
  direction.innerHTML = `<strong>Turning instruction:</strong> ${getTurnText()}`;

  badge.textContent = isCompleted ? "Completed" : "In Progress";
  badge.className = isCompleted ? "current-row-badge completed" : "current-row-badge";

  stitchSummary.textContent = `${stitches.length} stitches shown in this row`;

  chartContainer.innerHTML = "";
  chartContainer.appendChild(createChart(row));
}

function goToRow(rowIndex) {
  currentRow = rowIndex;
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

  pattern.rows.forEach((row, index) => {
    const div = document.createElement("div");
    div.className = "row";
    div.style.cursor = "pointer";
    div.onclick = () => goToRow(index);

    if (index === currentRow) {
      div.classList.add("active");
    }

    if (completedRows.includes(index)) {
      div.classList.add("completed");
    }

    const title = document.createElement("h3");
    title.textContent = `Row ${row.number} (${row.side})`;

    const instructions = document.createElement("p");
    instructions.innerHTML = `<strong>Instructions:</strong> ${row.instructions}`;

    const total = document.createElement("p");
    total.innerHTML = `<strong>Total stitches:</strong> ${row.totalStitches}`;

    const direction = document.createElement("p");
    direction.innerHTML = `<strong>Turning instruction:</strong> ${getTurnText()}`;

    const chartLabel = document.createElement("div");
    chartLabel.className = "chart-label";
    chartLabel.innerHTML = "<strong>Visual row chart:</strong>";

    const stitchSummary = document.createElement("p");
    stitchSummary.className = "stitch-summary";
    stitchSummary.textContent = `${buildStitchBlocks(row).length} stitches shown in this row`;

    div.appendChild(title);
    div.appendChild(instructions);
    div.appendChild(total);
    div.appendChild(direction);
    div.appendChild(chartLabel);
    div.appendChild(stitchSummary);
    div.appendChild(createChart(row));

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

  const totalRows = pattern.rows.length;
  const imageHeight = graphImage.clientHeight;
  const rowHeight = imageHeight / totalRows;
  const highlightTop = imageHeight - rowHeight * (currentRow + 1) + rowHeight / 2;

  graphHighlight.style.top = `${highlightTop}px`;
  graphHighlight.style.height = `${rowHeight}px`;
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

  rowSelect.value = String(currentRow);
  syncStitchModeSelect();

  const completedCount = completedRows.length;
  progressText.textContent = `Row ${currentRow + 1} of ${pattern.rows.length} | ${completedCount} completed | ${stitchMode}`;

  graphButtons.forEach((button) => {
    button.hidden = !pattern.graphImageUrl;
  });

  completeButtons.forEach((button) => {
    button.textContent = completedRows.includes(currentRow)
      ? "Mark Row Incomplete"
      : "Mark Row Complete";
  });

  renderNotes();
  renderCurrentRow();
  renderPatternList();
  updateGraphHighlight();
  saveProgress();
}

function nextRow() {
  if (currentRow < pattern.rows.length - 1) {
    currentRow += 1;
    render();
  }
}

function prevRow() {
  if (currentRow > 0) {
    currentRow -= 1;
    render();
  }
}

function setMode(newMode) {
  mode = newMode;
  render();
}

function jumpToRow() {
  const rowSelect = document.getElementById("rowSelect");
  currentRow = Number(rowSelect.value);
  render();
}

function changeStitchMode() {
  const stitchModeSelect = document.getElementById("stitchModeSelect");
  if (!stitchModeSelect) return;

  stitchMode = stitchModeSelect.value;
  render();
}

function toggleCompleteRow() {
  if (completedRows.includes(currentRow)) {
    completedRows = completedRows.filter((rowIndex) => rowIndex !== currentRow);
  } else {
    completedRows.push(currentRow);
    completedRows.sort((a, b) => a - b);
  }

  render();
}

function resetProgress() {
  currentRow = 0;
  completedRows = [];
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
