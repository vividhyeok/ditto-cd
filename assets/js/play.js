import {
  TRACKS,
  STEP_COUNT,
  BAR_COUNT,
  parseMetadata,
  getQueryParam,
  showToast,
  getScaleLabel,
  countChordSegments,
  deriveVariantsFromMatrix,
} from './shared.js';
import {
  createLoopEngine,
  buildTimeline,
  mapBarVariantsToLabels,
  chordSelectionsToSequence,
} from './tone-variants.js';

const patternGrid = document.getElementById('patternPreview');
const patternStatsEl = document.getElementById('patternStats');
const tempoTag = document.getElementById('tempoTag');
const chordTag = document.getElementById('chordTag');
const metaStringEl = document.getElementById('metaString');
const playButton = document.getElementById('playToggle');
const stopButton = document.getElementById('stopButton');
const spectrumCanvas = document.getElementById('spectrumCanvas');
const playButtonLabel = playButton?.querySelector('.visual-button__label');

let parsedData;
let toneEngine;
let transportEventId;
let isPlaying = false;
let currentStep = -1;
const drumStepElements = TRACKS.map(() => []);
const chordStepElements = [];
let analyser;
let spectrumContext;
let spectrumAnimationFrame;
let spectrumGradient;
let spectrumListening = false;

function emptyChordSteps() {
  return Array.from({ length: STEP_COUNT }, () => ({ chordIndex: null, head: false, length: 0 }));
}

function renderPattern(matrix, chords) {
  patternGrid.innerHTML = '';
  drumStepElements.forEach((row) => row.splice(0, row.length));
  chordStepElements.splice(0, chordStepElements.length);

  matrix.forEach((row, trackIndex) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'pattern-row';
    const rowElements = drumStepElements[trackIndex];
    row.forEach((active) => {
      const cell = document.createElement('div');
      cell.className = 'step';
      if (active) {
        cell.classList.add('active');
      }
      rowEl.appendChild(cell);
      rowElements.push(cell);
    });
    patternGrid.appendChild(rowEl);
  });

  const chordRow = document.createElement('div');
  chordRow.className = 'pattern-row';
  const chordSteps = Array.isArray(chords) && chords.length === STEP_COUNT ? chords : emptyChordSteps();
  chordSteps.forEach((step) => {
    const cell = document.createElement('div');
    cell.className = 'step chord-step';
    if (step.chordIndex !== null) {
      cell.classList.add('chord-active');
      if (step.head) {
        cell.classList.add('chord-head');
        cell.textContent = getScaleLabel(step.chordIndex);
      } else {
        cell.textContent = '—';
      }
    }
    chordRow.appendChild(cell);
    chordStepElements.push(cell);
  });
  patternGrid.appendChild(chordRow);
}

function updateStats() {
  const activeSteps = parsedData.matrix.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  const totalSteps = TRACKS.length * STEP_COUNT;
  const chordSegments = countChordSegments(Array.isArray(parsedData.chords) ? parsedData.chords : emptyChordSteps());
  const altCount = (parsedData.barVariants || []).reduce(
    (sum, row) => sum + row.filter((value) => value === 1).length,
    0,
  );
  patternStatsEl.textContent = `드럼 ${activeSteps}/${totalSteps} · 음계 ${chordSegments}개 · ${parsedData.tempo} BPM · 대안 패턴 ${altCount}회`;
}

function updateTags() {
  tempoTag.textContent = `${parsedData.tempo} BPM`;
  chordTag.textContent = `음계 ${countChordSegments(Array.isArray(parsedData.chords) ? parsedData.chords : emptyChordSteps())}개`;
}

function clearHighlight() {
  drumStepElements.forEach((row) => {
    row.forEach((step) => step.classList.remove('current'));
  });
  chordStepElements.forEach((step) => step.classList.remove('current'));
}

function setHighlight(stepIndex) {
  clearHighlight();
  drumStepElements.forEach((row) => {
    const step = row[stepIndex];
    if (step) {
      step.classList.add('current');
    }
  });
  const chordStep = chordStepElements[stepIndex];
  if (chordStep) {
    chordStep.classList.add('current');
  }
}

function scheduleTransport() {
  if (typeof transportEventId !== 'undefined') {
    Tone.Transport.clear(transportEventId);
    transportEventId = undefined;
  }
  transportEventId = Tone.Transport.scheduleRepeat(() => {
    currentStep = (currentStep + 1) % STEP_COUNT;
    setHighlight(currentStep);
  }, '16n');
}

function ensureToneEngine() {
  if (!toneEngine) {
    toneEngine = createLoopEngine({ bpm: parsedData.tempo });
  }
  toneEngine.setBpm(parsedData.tempo);
}

function setupAnalyser() {
  if (!analyser) {
    analyser = new Tone.Analyser('fft', 128);
    Tone.Destination.connect(analyser);
  }
}

function ensureSpectrumContext() {
  if (!spectrumCanvas) return null;
  if (!spectrumContext) {
    spectrumContext = spectrumCanvas.getContext('2d');
  }
  return spectrumContext;
}

function resizeSpectrumCanvas() {
  if (!spectrumCanvas || !spectrumContext) return;
  const { clientWidth, clientHeight } = spectrumCanvas;
  if (!clientWidth || !clientHeight) return;
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(clientWidth * dpr);
  const height = Math.round(clientHeight * dpr);
  if (spectrumCanvas.width !== width || spectrumCanvas.height !== height) {
    spectrumCanvas.width = width;
    spectrumCanvas.height = height;
  }
  spectrumContext.setTransform(1, 0, 0, 1, 0, 0);
  spectrumContext.scale(dpr, dpr);
  spectrumGradient = null;
}

function getSpectrumGradient(height) {
  if (!spectrumContext) return '#71f4c8';
  if (!spectrumGradient) {
    const gradient = spectrumContext.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, 'rgba(113, 244, 200, 0.1)');
    gradient.addColorStop(0.35, 'rgba(113, 244, 200, 0.35)');
    gradient.addColorStop(1, 'rgba(195, 252, 233, 0.9)');
    spectrumGradient = gradient;
  }
  return spectrumGradient;
}

function renderSpectrumFrame() {
  if (!analyser || !spectrumCanvas || !ensureSpectrumContext()) return;
  resizeSpectrumCanvas();
  const ctx = spectrumContext;
  const width = spectrumCanvas.clientWidth;
  const height = spectrumCanvas.clientHeight;
  ctx.clearRect(0, 0, width, height);

  const values = analyser.getValue();
  const barCount = values.length;
  if (!barCount) return;

  const stepWidth = width / barCount;
  const barWidth = Math.max(stepWidth * 0.7, 2);
  const gradient = getSpectrumGradient(height);

  ctx.fillStyle = 'rgba(113, 244, 200, 0.06)';
  ctx.fillRect(0, height * 0.65, width, height * 0.35);

  ctx.fillStyle = gradient;
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < barCount; i += 1) {
    const value = values[i];
    const normalized = Math.min(Math.max((value + 100) / 100, 0), 1);
    const eased = normalized ** 1.5;
    const barHeight = eased * height;
    const x = i * stepWidth + (stepWidth - barWidth) / 2;
    ctx.fillRect(x, height - barHeight, barWidth, barHeight);
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(113, 244, 200, 0.4)';
  ctx.fillRect(0, height - 2, width, 2);

  spectrumAnimationFrame = requestAnimationFrame(renderSpectrumFrame);
}

function startSpectrum() {
  if (!spectrumCanvas) return;
  setupAnalyser();
  if (!ensureSpectrumContext()) return;
  resizeSpectrumCanvas();
  if (!spectrumListening) {
    window.addEventListener('resize', resizeSpectrumCanvas);
    spectrumListening = true;
  }
  cancelAnimationFrame(spectrumAnimationFrame);
  spectrumAnimationFrame = requestAnimationFrame(renderSpectrumFrame);
}

function stopSpectrum() {
  if (spectrumAnimationFrame) {
    cancelAnimationFrame(spectrumAnimationFrame);
    spectrumAnimationFrame = null;
  }
  if (spectrumContext && spectrumCanvas) {
    spectrumContext.clearRect(0, 0, spectrumCanvas.clientWidth, spectrumCanvas.clientHeight);
  }
  if (spectrumListening) {
    window.removeEventListener('resize', resizeSpectrumCanvas);
    spectrumListening = false;
  }
}

function updatePlayButtonState() {
  if (!playButton) return;
  playButton.classList.toggle('is-playing', isPlaying);
  playButton.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
  if (playButtonLabel) {
    playButtonLabel.textContent = isPlaying ? '재생 중' : 'Play';
  }
}

function buildEngineTimeline() {
  const barVariants = parsedData.barVariants && parsedData.barVariants.length
    ? parsedData.barVariants
    : deriveVariantsFromMatrix(parsedData.matrix);
  const variantLabels = mapBarVariantsToLabels(barVariants, BAR_COUNT);
  const chords = chordSelectionsToSequence(parsedData.chordSelections || [], BAR_COUNT);
  return buildTimeline({
    barCount: BAR_COUNT,
    variantLabels,
    chords,
  });
}

async function startPlayback() {
  if (isPlaying) return;
  await Tone.start();
  ensureToneEngine();
  toneEngine.setTimeline(buildEngineTimeline());
  toneEngine.start();
  Tone.Transport.position = 0;
  Tone.Transport.bpm.value = parsedData.tempo;
  currentStep = -1;
  scheduleTransport();
  Tone.Transport.start('+0.05');
  isPlaying = true;
  startSpectrum();
  updatePlayButtonState();
  showToast('루프 재생 중');
}

function stopPlayback() {
  if (!isPlaying) return;
  Tone.Transport.stop();
  Tone.Transport.position = 0;
  if (typeof transportEventId !== 'undefined') {
    Tone.Transport.clear(transportEventId);
    transportEventId = undefined;
  }
  toneEngine?.stop();
  isPlaying = false;
  currentStep = -1;
  clearHighlight();
  stopSpectrum();
  updatePlayButtonState();
}

function bindActions() {
  playButton.addEventListener('click', () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  });
  stopButton.addEventListener('click', stopPlayback);
  window.addEventListener('pagehide', stopPlayback);
  window.addEventListener('beforeunload', stopPlayback);
}

function showError(message) {
  if (patternGrid) {
    patternGrid.innerHTML = '';
  }
  if (patternStatsEl) {
    patternStatsEl.hidden = false;
    patternStatsEl.textContent = message;
  }
  playButton.disabled = true;
  stopButton.disabled = true;
  stopSpectrum();
  isPlaying = false;
  updatePlayButtonState();
}

function init() {
  const metadata = getQueryParam('meta');
  if (!metadata) {
    showError('meta 파라미터가 없습니다. Desk 화면에서 링크를 확인하세요.');
    return;
  }

  try {
    parsedData = parseMetadata(metadata);
  } catch (error) {
    console.error(error);
    showError(`메타데이터 해석 실패: ${error.message}`);
    return;
  }

  metaStringEl.textContent = metadata;
  if (!parsedData.barVariants || !parsedData.barVariants.length) {
    parsedData.barVariants = deriveVariantsFromMatrix(parsedData.matrix);
  }
  renderPattern(parsedData.matrix, parsedData.chords);
  updateStats();
  updateTags();
  bindActions();
  showToast('Play 뷰가 준비되었습니다');
}

document.addEventListener('DOMContentLoaded', init);
