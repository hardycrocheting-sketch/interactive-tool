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
  const graphImage = document.getElementById("graphImage");
  const graphHighlight = document.getElementById("graphHighlight");
  const patternSteps = getPatternSteps();

  if (!graphImage || !graphHighlight || !graphImage.complete || !activePattern.graphImageUrl) {
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
  currentStep = 0;
  completedSteps = [];
  stitchMode = "SC";
  localStorage.removeItem(getStorageKey());
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
