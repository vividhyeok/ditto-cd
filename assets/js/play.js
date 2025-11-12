import {
  TRACKS,
  STEP_COUNT,
  parseMetadata,
  getQueryParam,
  showToast,
  getScaleNotes,
  getScaleLabel,
  countChordSegments,
  deriveVariantsFromMatrix,
} from './shared.js';

const patternGrid = document.getElementById('patternPreview');
const patternStatsEl = document.getElementById('patternStats');
const tempoTag = document.getElementById('tempoTag');
const chordTag = document.getElementById('chordTag');
const metaStringEl = document.getElementById('metaString');
const playButton = document.getElementById('playToggle');
const stopButton = document.getElementById('stopButton');

let parsedData;
let players;
let chordSynth;
let transportEventId;
let isPlaying = false;
let currentStep = -1;
const drumStepElements = TRACKS.map(() => []);
const chordStepElements = [];

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

async function ensurePlayers() {
  if (!players) {
    players = new Tone.Players(
      TRACKS.reduce((acc, track) => {
        acc[track.id] = track.sample;
        return acc;
      }, {})
    ).toDestination();
    await players.loaded;
  }
  if (!chordSynth) {
    chordSynth = new Tone.PolySynth(Tone.Synth, {
      envelope: {
        attack: 0.01,
        decay: 0.15,
        sustain: 0.7,
        release: 0.35,
      },
    }).toDestination();
    chordSynth.volume.value = -6;
    chordSynth.maxPolyphony = 8;
  }
}

function scheduleTransport() {
  Tone.Transport.cancel();
  const chordSteps = Array.isArray(parsedData.chords) ? parsedData.chords : emptyChordSteps();
  transportEventId = Tone.Transport.scheduleRepeat((time) => {
    currentStep = (currentStep + 1) % STEP_COUNT;
    setHighlight(currentStep);
    TRACKS.forEach((track, trackIndex) => {
      if (parsedData.matrix[trackIndex][currentStep]) {
        players.player(track.id).start(time);
      }
    });
    const chordStep = chordSteps[currentStep];
    if (chordStep && chordStep.head && chordStep.chordIndex !== null && chordSynth) {
      const duration = Tone.Time(chordStep.length, '16n');
  const notes = getScaleNotes(chordStep.chordIndex);
      chordSynth.triggerAttackRelease(notes, duration, time);
    }
  }, '16n');
}

async function startPlayback() {
  if (isPlaying) return;
  await ensurePlayers();
  await Tone.start();
  Tone.Transport.bpm.value = parsedData.tempo;
  currentStep = -1;
  scheduleTransport();
  Tone.Transport.start('+0.05');
  isPlaying = true;
  playButton.textContent = 'Playing';
  showToast('루프 재생 중');
}

function stopPlayback() {
  if (!isPlaying) return;
  Tone.Transport.stop();
  if (typeof transportEventId !== 'undefined') {
    Tone.Transport.clear(transportEventId);
    transportEventId = undefined;
  }
  Tone.Transport.cancel();
  isPlaying = false;
  currentStep = -1;
  clearHighlight();
  playButton.textContent = 'Play';
}

function bindActions() {
  playButton.addEventListener('click', startPlayback);
  stopButton.addEventListener('click', stopPlayback);
  window.addEventListener('pagehide', stopPlayback);
  window.addEventListener('beforeunload', stopPlayback);
}

function showError(message) {
  patternGrid.innerHTML = '';
  patternStatsEl.textContent = message;
  playButton.disabled = true;
  stopButton.disabled = true;
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
