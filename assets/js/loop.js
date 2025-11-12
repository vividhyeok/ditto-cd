import {
  TRACKS,
  STEP_COUNT,
  BAR_COUNT,
  BAR_STEPS,
  DEFAULT_STATE,
  cloneState,
  buildMetadata,
  metadataUrl,
  showToast,
  copyToClipboard,
  tryWriteNfc,
  parseMetadata,
  getQueryParam,
  CHORD_ROOTS,
  CHORD_QUALITIES,
  chordIndexFromParts,
  getScaleLabel,
  getScaleNotes,
  variantsToMatrix,
  chordSelectionsToSteps,
  createDefaultBarVariants,
  createDefaultChordSelections,
  deriveVariantsFromMatrix,
} from './shared.js';

const TRACK_META = {
  drum: { icon: '🥁', name: 'Drum', role: 'drum' },
  bass: { icon: '🔊', name: 'Bass', role: 'bass' },
  melody: { icon: '🎹', name: 'Melody 1', role: 'melody' },
  sub: { icon: '🎛️', name: 'Melody 2', role: 'melody2' },
};

function getTrackMeta(track) {
  return TRACK_META[track.id] || { icon: '🎛️', name: track.label || 'Track', role: track.id };
}

const FIXED_TEMPO = 107;

let state = cloneState(DEFAULT_STATE);
state.tempo = FIXED_TEMPO;
let players;
let chordSynth;
let transportEventId;
let isPlaying = false;
let currentStep = -1;

const grid = document.getElementById('patternGrid');
const playButton = document.getElementById('playToggle');
const clearButton = document.getElementById('clearPattern');
const shareButton = document.getElementById('shareButton');
const metaPanel = document.getElementById('metaPanel');
const metaStringEl = document.getElementById('metaString');
const metaUrlEl = document.getElementById('metaUrl');
const qrCanvas = document.getElementById('shareQr');
const copyMetaBtn = document.getElementById('copyMeta');
const copyUrlBtn = document.getElementById('copyUrl');
const nfcBtn = document.getElementById('writeNfc');
const chordRootSelect = document.getElementById('chordRoot');
const chordQualitySelect = document.getElementById('chordQuality');
const clearChordsBtn = document.getElementById('clearChords');

const variantButtons = TRACKS.map(() => Array.from({ length: BAR_COUNT }, () => null));
const chordBarElements = [];

function renderLabels() {
  const labelsContainer = document.getElementById('trackLabels');
  labelsContainer.innerHTML = '';
  TRACKS.forEach((track) => {
    const card = document.createElement('div');
    card.className = 'track-label';
    const meta = getTrackMeta(track);
    card.innerHTML = `
      <span class="track-label__icon">${meta.icon}</span>
      <span class="track-label__name">${meta.name}</span>
    `;
    card.title = track.label || meta.name;
    labelsContainer.appendChild(card);
  });
}

function renderGrid() {
  grid.innerHTML = '';
  TRACKS.forEach((_track, trackIndex) => {
    variantButtons[trackIndex] = Array.from({ length: BAR_COUNT }, () => null);
  });
  chordBarElements.splice(0, chordBarElements.length);

  TRACKS.forEach((track, trackIndex) => {
    const row = document.createElement('div');
    row.className = 'pattern-row variant-row';
    for (let barIndex = 0; barIndex < BAR_COUNT; barIndex += 1) {
      const barCell = document.createElement('div');
      barCell.className = 'bar-cell';
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'variant-toggle';
      toggle.dataset.track = String(trackIndex);
      toggle.dataset.bar = String(barIndex);
      const meta = getTrackMeta(TRACKS[trackIndex]);
      toggle.dataset.role = meta.role;
      toggle.addEventListener('click', handleVariantToggle);
      barCell.appendChild(toggle);
      variantButtons[trackIndex][barIndex] = toggle;
      row.appendChild(barCell);
    }
    grid.appendChild(row);
  });

  const chordRow = document.createElement('div');
  chordRow.className = 'pattern-row chord-row';
  for (let barIndex = 0; barIndex < BAR_COUNT; barIndex += 1) {
    const chordButton = document.createElement('button');
    chordButton.type = 'button';
    chordButton.className = 'chord-bar';
    chordButton.dataset.bar = String(barIndex);
    chordButton.innerHTML = `<span class="chord-bar__index">${barIndex + 1}</span><span class="chord-bar__name">---</span>`;
    chordButton.addEventListener('click', handleChordBarClick);
    chordRow.appendChild(chordButton);
    chordBarElements.push(chordButton);
  }
  grid.appendChild(chordRow);
}

function syncMatrix() {
  state.matrix = variantsToMatrix(state.barVariants);
}

function syncChords() {
  state.chords = chordSelectionsToSteps(state.chordSelections);
}

function updateVariantVisual(trackIndex, barIndex) {
  const toggle = variantButtons[trackIndex][barIndex];
  if (!toggle) return;
  const selected = state.barVariants[trackIndex][barIndex] ?? 0;
  const track = TRACKS[trackIndex];
  const variant = track.variants[selected] || track.variants[0];
  const meta = getTrackMeta(track);
  toggle.dataset.variant = String(selected);
  const isAlt = selected !== 0;
  toggle.classList.toggle('variant-toggle--alt', isAlt);
  toggle.innerHTML = `
    <span class="variant-toggle__corner">${meta.icon}</span>
    <span class="variant-toggle__label">${variant.label}</span>
    <span class="variant-toggle__caption">${meta.name}</span>
  `;
  toggle.setAttribute('aria-pressed', isAlt ? 'true' : 'false');
  toggle.setAttribute('aria-label', `${meta.name} ${barIndex + 1}마디 ${variant.label}`);
}

function updateChordVisual(barIndex) {
  const chordButton = chordBarElements[barIndex];
  if (!chordButton) return;
  const chordIndex = state.chordSelections[barIndex];
  const label = chordIndex !== null && chordIndex !== undefined ? getScaleLabel(chordIndex) : '---';
  chordButton.classList.toggle('chord-selected', chordIndex !== null && chordIndex !== undefined);
  chordButton.innerHTML = `<span class="chord-bar__index">${barIndex + 1}</span><span class="chord-bar__name">${label}</span>`;
  chordButton.setAttribute('aria-pressed', chordIndex !== null && chordIndex !== undefined ? 'true' : 'false');
  chordButton.setAttribute('aria-label', `마디 ${barIndex + 1} 음계 ${label === '---' ? '없음' : label}`);
}

function clearCurrentHighlight() {
  variantButtons.forEach((trackRow) => {
    trackRow.forEach((button) => {
      if (button) button.classList.remove('playing');
    });
  });
  chordBarElements.forEach((button) => button.classList.remove('playing'));
}

function setCurrentHighlight(stepIndex) {
  clearCurrentHighlight();
  const barIndex = Math.floor(stepIndex / BAR_STEPS);
  variantButtons.forEach((trackRow) => {
    const button = trackRow[barIndex];
    if (button) {
      button.classList.add('playing');
    }
  });
  const chordButton = chordBarElements[barIndex];
  if (chordButton) {
    chordButton.classList.add('playing');
  }
}

function handleVariantToggle(event) {
  const { track, bar } = event.currentTarget.dataset;
  const trackIndex = Number(track);
  const barIndex = Number(bar);
  const variants = TRACKS[trackIndex].variants;
  const current = state.barVariants[trackIndex][barIndex] ?? 0;
  const next = variants.length <= 1 ? 0 : (current + 1) % variants.length;
  state.barVariants[trackIndex][barIndex] = next;
  syncMatrix();
  updateVariantVisual(trackIndex, barIndex);
}

function handleChordBarClick(event) {
  const barIndex = Number(event.currentTarget.dataset.bar);
  const selectedChordIndex = getSelectedChordIndex();
  state.chordSelections[barIndex] = selectedChordIndex;
  syncChords();
  updateChordVisual(barIndex);
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
        decay: 0.2,
        sustain: 0.7,
        release: 0.4,
      },
    }).toDestination();
    chordSynth.volume.value = -6;
    chordSynth.maxPolyphony = 8;
  }
}

function scheduleTransport() {
  Tone.Transport.cancel();
  transportEventId = Tone.Transport.scheduleRepeat((time) => {
    currentStep = (currentStep + 1) % STEP_COUNT;
    setCurrentHighlight(currentStep);
    TRACKS.forEach((track, trackIndex) => {
      if (state.matrix[trackIndex][currentStep]) {
        players.player(track.id).start(time);
      }
    });
    const chordStep = state.chords[currentStep];
    if (chordStep && chordStep.head && chordStep.chordIndex !== null && chordSynth) {
      const duration = Tone.Time(chordStep.length, '16n');
      const notes = getScaleNotes(chordStep.chordIndex);
      chordSynth.triggerAttackRelease(notes, duration, time);
    }
  }, '16n');
}

async function togglePlayback() {
  if (!isPlaying) {
    await ensurePlayers();
    await Tone.start();
    Tone.Transport.bpm.value = state.tempo;
    currentStep = -1;
    scheduleTransport();
    Tone.Transport.start('+0.05');
    isPlaying = true;
    playButton.classList.add('is-playing');
    playButton.setAttribute('aria-label', '일시 정지');
    showToast('루프 재생 시작');
  } else {
    Tone.Transport.stop();
    if (typeof transportEventId !== 'undefined') {
      Tone.Transport.clear(transportEventId);
      transportEventId = undefined;
    }
    isPlaying = false;
    clearCurrentHighlight();
    currentStep = -1;
    playButton.classList.remove('is-playing');
    playButton.setAttribute('aria-label', '재생');
  }
}

function resetChordState() {
  state.chordSelections = createDefaultChordSelections();
  syncChords();
  chordBarElements.forEach((_, index) => updateChordVisual(index));
  chordRootSelect.value = 'none';
  chordQualitySelect.value = '0';
  chordQualitySelect.disabled = true;
  chordQualitySelect.classList.add('is-disabled');
}

function resetPattern() {
  state.barVariants = createDefaultBarVariants();
  syncMatrix();
  TRACKS.forEach((_, trackIndex) => {
    for (let barIndex = 0; barIndex < BAR_COUNT; barIndex += 1) {
      updateVariantVisual(trackIndex, barIndex);
    }
  });
  resetChordState();
}

function syncGridFromState() {
  syncMatrix();
  syncChords();
  TRACKS.forEach((_, trackIndex) => {
    for (let barIndex = 0; barIndex < BAR_COUNT; barIndex += 1) {
      updateVariantVisual(trackIndex, barIndex);
    }
  });
  chordBarElements.forEach((_, barIndex) => updateChordVisual(barIndex));
}

function getSelectedChordIndex() {
  const rootValue = chordRootSelect.value;
  if (rootValue === 'none') {
    return null;
  }
  const qualityIndex = Number(chordQualitySelect.value);
  return chordIndexFromParts(Number(rootValue), qualityIndex);
}

function applyMetadata(metadata) {
  if (!metadata) return;
  try {
    const parsed = parseMetadata(metadata);
    const barVariants = Array.isArray(parsed.barVariants) && parsed.barVariants.length
      ? parsed.barVariants
      : deriveVariantsFromMatrix(parsed.matrix);
    const chordSelections = Array.isArray(parsed.chordSelections) && parsed.chordSelections.length
      ? parsed.chordSelections
      : createDefaultChordSelections();
    state = cloneState({
      tempo: parsed.tempo,
      barVariants,
      chordSelections,
      matrix: parsed.matrix,
      chords: chordSelectionsToSteps(chordSelections),
    });
    syncGridFromState();
    metaPanel.classList.add('visible');
    metaStringEl.textContent = metadata;
    const relativeUrl = metadataUrl(metadata, 'desk.html');
    const absoluteUrl = new URL(relativeUrl, window.location.href).toString();
    metaUrlEl.textContent = absoluteUrl;
    metaUrlEl.href = absoluteUrl;
    if (qrCanvas && window.QRCode) {
      window.QRCode.toCanvas(qrCanvas, absoluteUrl, { width: 220, margin: 1 }, () => {});
    }
    showToast('메타데이터 불러옴');
  } catch (error) {
    console.error(error);
    showToast('메타데이터 해석 실패');
  }
}

async function handleShare() {
  if (isPlaying) {
    await togglePlayback();
  }
  syncMatrix();
  syncChords();
  const metadata = buildMetadata({
    matrix: state.matrix,
    tempo: state.tempo,
    chords: state.chords,
    barVariants: state.barVariants,
  });
  const relativeUrl = metadataUrl(metadata, 'desk.html');
  const absoluteUrl = new URL(relativeUrl, window.location.href).toString();
  metaStringEl.textContent = metadata;
  metaUrlEl.textContent = absoluteUrl;
  metaUrlEl.href = absoluteUrl;
  metaPanel.classList.add('visible');

  if (window.QRCode) {
    window.QRCode.toCanvas(qrCanvas, absoluteUrl, { width: 220, margin: 1 }, (err) => {
      if (err) {
        console.error(err);
        showToast('QR 생성 실패');
      }
    });
  }
}

function populateChordControls() {
  chordRootSelect.innerHTML = '';
  const noneOption = document.createElement('option');
  noneOption.value = 'none';
  noneOption.textContent = '음계 없음 (지우기)';
  chordRootSelect.appendChild(noneOption);
  CHORD_ROOTS.forEach((root, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = root;
    chordRootSelect.appendChild(option);
  });

  chordQualitySelect.innerHTML = '';
  CHORD_QUALITIES.forEach((quality, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = quality.display || 'maj';
    if (quality.description) {
      option.title = quality.description;
    }
    chordQualitySelect.appendChild(option);
  });

  chordRootSelect.value = 'none';
  chordQualitySelect.value = '0';

  const syncQualityState = () => {
    const disabled = chordRootSelect.value === 'none';
    chordQualitySelect.disabled = disabled;
    chordQualitySelect.classList.toggle('is-disabled', disabled);
  };

  syncQualityState();

  chordRootSelect.addEventListener('change', syncQualityState);
  clearChordsBtn.addEventListener('click', resetChordState);
}

function initButtons() {
  playButton.addEventListener('click', togglePlayback);
  clearButton.addEventListener('click', resetPattern);
  shareButton.addEventListener('click', handleShare);
  copyMetaBtn.addEventListener('click', () => copyToClipboard(metaStringEl.textContent));
  copyUrlBtn.addEventListener('click', () => copyToClipboard(metaUrlEl.textContent));
  nfcBtn.addEventListener('click', async () => {
    try {
      await tryWriteNfc(metaStringEl.textContent);
      showToast('NFC에 메타데이터 기록 완료');
    } catch (error) {
      console.error(error);
      showToast(error.message || 'NFC 기록 실패');
    }
  });

  if (!('NDEFReader' in window)) {
    nfcBtn.classList.add('hidden');
  }
}

function init() {
  renderLabels();
  renderGrid();
  populateChordControls();
  syncGridFromState();
  initButtons();
  const metadata = getQueryParam('meta');
  if (metadata) {
    applyMetadata(metadata);
  }
}

document.addEventListener('DOMContentLoaded', init);

