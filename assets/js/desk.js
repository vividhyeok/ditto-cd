import {
  TRACKS,
  STEP_COUNT,
  parseMetadata,
  metadataUrl,
  copyToClipboard,
  showToast,
  getQueryParam,
  getScaleLabel,
  countChordSegments,
  deriveVariantsFromMatrix,
} from './shared.js';

const patternGrid = document.getElementById('patternPreview');
const patternStatsEl = document.getElementById('patternStats');
const tempoTag = document.getElementById('tempoTag');
const chordTag = document.getElementById('chordTag');
const metaStringEl = document.getElementById('metaString');
const deskLinkEl = document.getElementById('deskLink');
const loopLinkEl = document.getElementById('loopLink');
const playLinkEl = document.getElementById('playLink');
const playBtn = document.getElementById('playNow');
const openLoopBtn = document.getElementById('openLoop');
const copyMetaBtn = document.getElementById('copyMeta');
const copyDeskBtn = document.getElementById('copyDesk');
const copyLoopBtn = document.getElementById('copyLoop');
const copyPlayBtn = document.getElementById('copyPlay');
const deskQrCanvas = document.getElementById('deskQr');
const detailPanel = document.getElementById('detailPanel');
const variantSummaryCard = document.getElementById('variantSummary');
const variantListEl = document.getElementById('variantList');

let metadataValue = '';
let parsedData;

function emptyChordSteps() {
  return Array.from({ length: STEP_COUNT }, () => ({ chordIndex: null, head: false, length: 0 }));
}

function renderPattern(matrix, chords) {
  patternGrid.innerHTML = '';
  matrix.forEach((row) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'pattern-row';
    row.forEach((step) => {
      const cell = document.createElement('div');
      cell.className = 'step';
      if (step) {
        cell.classList.add('active');
      }
      rowEl.appendChild(cell);
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
  });
  patternGrid.appendChild(chordRow);
}

function renderVariantSummary(barVariants = []) {
  if (!variantSummaryCard || !variantListEl) {
    return;
  }

  if (!barVariants.length) {
    variantSummaryCard.classList.add('hidden');
    variantListEl.innerHTML = '';
    return;
  }

  variantSummaryCard.classList.remove('hidden');
  variantListEl.innerHTML = '';

  barVariants.forEach((row, trackIndex) => {
    const track = TRACKS[trackIndex];
    if (!track) return;

    const rowEl = document.createElement('div');
    rowEl.className = 'variant-summary-row';

    const labelEl = document.createElement('div');
    labelEl.className = 'variant-summary-label';
    labelEl.textContent = track.label;
    rowEl.appendChild(labelEl);

    const badgesEl = document.createElement('div');
    badgesEl.className = 'variant-summary-badges';

    row.forEach((variantIndex, barIndex) => {
      const badge = document.createElement('span');
      badge.className = 'variant-badge';
      const variant = track.variants[variantIndex] || track.variants[0];
      badge.textContent = `${barIndex + 1}·${variant.label}`;
      if (variant.info) {
        badge.title = variant.info;
      }
      badgesEl.appendChild(badge);
    });

    rowEl.appendChild(badgesEl);
    variantListEl.appendChild(rowEl);
  });
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

function updateLinks() {
  const deskUrl = new URL(window.location.href).toString();
  const loopUrl = new URL(metadataUrl(metadataValue, 'loop.html'), window.location.href).toString();
  const playUrl = new URL(metadataUrl(metadataValue, 'play.html'), window.location.href).toString();

  deskLinkEl.textContent = deskUrl;
  deskLinkEl.href = deskUrl;
  loopLinkEl.textContent = loopUrl;
  loopLinkEl.href = loopUrl;
  playLinkEl.textContent = playUrl;
  playLinkEl.href = playUrl;

  if (window.QRCode) {
    window.QRCode.toCanvas(deskQrCanvas, deskUrl, { width: 220, margin: 1 }, () => {});
  }
}

function bindActions() {
  playBtn.addEventListener('click', () => window.open(playLinkEl.href, '_blank'));
  openLoopBtn.addEventListener('click', () => window.open(loopLinkEl.href, '_blank'));
  copyMetaBtn.addEventListener('click', () => copyToClipboard(metadataValue));
  copyDeskBtn.addEventListener('click', () => copyToClipboard(deskLinkEl.href));
  copyLoopBtn.addEventListener('click', () => copyToClipboard(loopLinkEl.href));
  copyPlayBtn.addEventListener('click', () => copyToClipboard(playLinkEl.href));
}

function showMissingMetadata() {
  detailPanel.innerHTML = '<p>URL에 meta 파라미터가 없습니다. Loop 화면에서 QR을 다시 생성해주세요.</p>';
  detailPanel.classList.add('card');
  if (variantSummaryCard) {
    variantSummaryCard.classList.add('hidden');
  }
}

function init() {
  metadataValue = getQueryParam('meta');
  if (!metadataValue) {
    showMissingMetadata();
    return;
  }

  try {
    parsedData = parseMetadata(metadataValue);
  } catch (error) {
    console.error(error);
    detailPanel.innerHTML = `<p>메타데이터 해석 실패: ${error.message}</p>`;
    detailPanel.classList.add('card');
    if (variantSummaryCard) {
      variantSummaryCard.classList.add('hidden');
    }
    return;
  }

  metaStringEl.textContent = metadataValue;
  renderPattern(parsedData.matrix, parsedData.chords);
  if (!parsedData.barVariants || !parsedData.barVariants.length) {
    parsedData.barVariants = deriveVariantsFromMatrix(parsedData.matrix);
  }
  renderVariantSummary(parsedData.barVariants);
  updateStats();
  updateTags();
  updateLinks();
  bindActions();
  showToast('Desk 메타데이터 로드 완료');
}

document.addEventListener('DOMContentLoaded', init);
