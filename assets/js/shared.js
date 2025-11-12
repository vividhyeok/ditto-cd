export const STEP_COUNT = 16;
export const BAR_COUNT = 4;
export const BAR_STEPS = STEP_COUNT / BAR_COUNT;
export const VERSION = 'V4';
export const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export const TRACKS = [
  {
    id: 'drum',
    label: 'Drum',
    info: '킥 중심 리듬',
    sample: '../deep-drum/sounds/drum-kits/analog/kick.mp3',
    variants: [
      { id: 'drum0', label: '00', pattern: [true, false, false, false], info: 'pulse' },
      { id: 'drum1', label: '01', pattern: [true, false, true, false], info: 'sync' },
      { id: 'drum2', label: '10', pattern: [true, true, false, false], info: 'drive' },
      { id: 'drum3', label: '11', pattern: [true, false, false, true], info: 'bounce' },
    ],
  },
  {
    id: 'bass',
    label: 'Bass',
    info: '저역 펄스',
    sample: '../deep-drum/sounds/bass.wav',
    variants: [
      { id: 'bass0', label: '00', pattern: [true, false, false, false], info: 'root' },
      { id: 'bass1', label: '01', pattern: [true, false, true, false], info: 'skip' },
      { id: 'bass2', label: '10', pattern: [true, true, false, false], info: 'push' },
      { id: 'bass3', label: '11', pattern: [true, false, false, true], info: 'tail' },
    ],
  },
  {
    id: 'melody',
    label: 'Melody 1',
    info: '상단 멜로디',
    sample: '../deep-drum/sounds/keys.mp3',
    variants: [
      { id: 'melody0', label: '00', pattern: [false, true, false, true], info: 'wave' },
      { id: 'melody1', label: '01', pattern: [true, false, false, true], info: 'spark' },
      { id: 'melody2', label: '10', pattern: [false, true, true, false], info: 'flow' },
      { id: 'melody3', label: '11', pattern: [true, false, true, false], info: 'lift' },
    ],
  },
  {
    id: 'sub',
    label: 'Melody 2',
    info: '보조 멜로디',
    sample: '../deep-drum/sounds/guitar.mp3',
    variants: [
      { id: 'sub0', label: '00', pattern: [true, false, false, false], info: 'hold' },
      { id: 'sub1', label: '01', pattern: [false, true, false, true], info: 'shift' },
      { id: 'sub2', label: '10', pattern: [false, false, true, false], info: 'late' },
      { id: 'sub3', label: '11', pattern: [false, true, true, false], info: 'roll' },
    ],
  },
];

export const CHORD_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const CHORD_QUALITIES = [
  { id: 'major', display: '장', description: 'Major (Ionian)', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'minor', display: '단', description: 'Natural Minor (Aeolian)', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'pentatonic', display: '펜타', description: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9] },
  { id: 'dorian', display: '도리안', description: 'Dorian Mode', intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'mixolydian', display: '믹소', description: 'Mixolydian Mode', intervals: [0, 2, 4, 5, 7, 9, 10] },
  { id: 'lydian', display: '리디안', description: 'Lydian Mode', intervals: [0, 2, 4, 6, 7, 9, 11] },
  { id: 'phrygian', display: '프리지안', description: 'Phrygian Mode', intervals: [0, 1, 3, 5, 7, 8, 10] },
  { id: 'locrian', display: '로크리안', description: 'Locrian Mode', intervals: [0, 1, 3, 5, 6, 8, 10] },
];

export const SCALE_TYPES = CHORD_QUALITIES.slice(0, 3);

const CHORDS_PER_ROOT = CHORD_QUALITIES.length;
const CHORD_STEP_BITS = 12;
const CHORD_BASE_MIDI = 48; // C3

export function createDefaultBarVariants() {
  return TRACKS.map(() => Array(BAR_COUNT).fill(0));
}

export function createDefaultChordSelections() {
  return Array(BAR_COUNT).fill(null);
}

export function variantsToMatrix(barVariants) {
  return barVariants.map((variantRow, trackIndex) => {
    const track = TRACKS[trackIndex];
    const steps = Array(STEP_COUNT).fill(false);
    variantRow.forEach((variantIndex, barIndex) => {
      const clamped = Math.max(0, Math.min(Number(variantIndex) || 0, track.variants.length - 1));
      const variant = track.variants[clamped] || track.variants[0];
      const chunk = variant.pattern || [];
      for (let offset = 0; offset < BAR_STEPS; offset += 1) {
        const absoluteIndex = barIndex * BAR_STEPS + offset;
        steps[absoluteIndex] = Boolean(chunk[offset]);
      }
    });
    return steps;
  });
}

export function createEmptyChordState() {
  return Array.from({ length: STEP_COUNT }, () => ({ chordIndex: null, head: false, length: 0 }));
}

export function chordSelectionsToSteps(chordSelections) {
  const steps = createEmptyChordState();
  chordSelections.forEach((index, barIndex) => {
    if (index === null || index === undefined) {
      return;
    }
    const start = barIndex * BAR_STEPS;
    for (let offset = 0; offset < BAR_STEPS; offset += 1) {
      const stepIndex = start + offset;
      steps[stepIndex] = {
        chordIndex: index,
        head: offset === 0,
        length: offset === 0 ? BAR_STEPS : 0,
      };
    }
  });
  return steps;
}

export function chordStepsToSelections(chordSteps) {
  const selections = createDefaultChordSelections();
  chordSteps.forEach((step, index) => {
    if (!step.head) return;
    const barIndex = Math.floor(index / BAR_STEPS);
    selections[barIndex] = step.chordIndex;
  });
  return selections;
}

export function deriveVariantsFromMatrix(matrix) {
  return TRACKS.map((track, trackIndex) => {
    const row = Array.isArray(matrix?.[trackIndex]) ? matrix[trackIndex] : Array(STEP_COUNT).fill(false);
    return Array.from({ length: BAR_COUNT }, (_unused, barIndex) => {
      let bestVariant = 0;
      let bestScore = -Infinity;
      track.variants.forEach((variant, variantIndex) => {
        let score = 0;
        for (let offset = 0; offset < BAR_STEPS; offset += 1) {
          const expected = Boolean(variant.pattern?.[offset]);
          const actual = Boolean(row[barIndex * BAR_STEPS + offset]);
          if (expected === actual) {
            score += 1;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestVariant = variantIndex;
        }
      });
      return bestVariant;
    });
  });
}

function createDefaultState() {
  const barVariants = createDefaultBarVariants();
  const chordSelections = createDefaultChordSelections();
  return {
  tempo: 107,
    barVariants,
    chordSelections,
    matrix: variantsToMatrix(barVariants),
    chords: chordSelectionsToSteps(chordSelections),
  };
}

export const DEFAULT_STATE = createDefaultState();

export function cloneState(state) {
  return {
    tempo: state.tempo,
    barVariants: (state.barVariants || createDefaultBarVariants()).map((row) => [...row]),
    chordSelections: (state.chordSelections || createDefaultChordSelections()).map((value) => value),
    matrix: (state.matrix || []).map((row) => [...row]),
    chords: (state.chords || createEmptyChordState()).map((step) => ({ ...step })),
  };
}

function binaryToBase62(binaryString) {
  const normalized = binaryString.replace(/^0+/, '') || '0';
  let value = BigInt(`0b${normalized}`);
  if (value === 0n) return '0';
  let output = '';
  const base = BigInt(62);
  while (value > 0n) {
    const remainder = Number(value % base);
    output = BASE62_ALPHABET[remainder] + output;
    value /= base;
  }
  return output;
}

function base62ToBinary(base62String) {
  const clean = base62String.trim();
  if (!clean.length) {
    return '0';
  }
  let value = 0n;
  for (const char of clean) {
    const index = BASE62_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid base62 character: ${char}`);
    }
    value = value * 62n + BigInt(index);
  }
  return value.toString(2);
}

export function matrixToBinary(matrix) {
  return matrix
    .map((row) => row.map((cell) => (cell ? '1' : '0')).join(''))
    .join('');
}

export function binaryToMatrix(binaryString, tracks = TRACKS.length, steps = STEP_COUNT) {
  const padded = binaryString.padStart(tracks * steps, '0');
  const matrix = [];
  for (let trackIndex = 0; trackIndex < tracks; trackIndex += 1) {
    const start = trackIndex * steps;
    const rowSlice = padded.slice(start, start + steps);
    matrix.push(rowSlice.split('').map((bit) => bit === '1'));
  }
  return matrix;
}

function encodeChordSteps(chords) {
  if (!Array.isArray(chords) || chords.length !== STEP_COUNT) {
    return '0';
  }
  let bits = '';
  chords.forEach((step) => {
    if (step.head && step.chordIndex !== null) {
      const chordBits = step.chordIndex.toString(2).padStart(7, '0');
      const lengthBits = (Math.max(1, Math.min(step.length || 1, STEP_COUNT)) - 1)
        .toString(2)
        .padStart(4, '0');
      bits += `1${chordBits}${lengthBits}`;
    } else {
      bits += '0'.repeat(CHORD_STEP_BITS);
    }
  });
  return binaryToBase62(bits);
}

function decodeChordSteps(encoded) {
  const chords = createEmptyChordState();
  if (!encoded || encoded === '0') {
    return chords;
  }
  const expectedBits = STEP_COUNT * CHORD_STEP_BITS;
  const binary = base62ToBinary(encoded).padStart(expectedBits, '0');
  for (let stepIndex = 0; stepIndex < STEP_COUNT; stepIndex += 1) {
    const offset = stepIndex * CHORD_STEP_BITS;
    if (binary[offset] !== '1') {
      continue;
    }
    const chordIndex = parseInt(binary.slice(offset + 1, offset + 8), 2);
    const lengthBits = binary.slice(offset + 8, offset + 12);
    const length = Math.min(STEP_COUNT - stepIndex, parseInt(lengthBits, 2) + 1 || 1);
    for (let i = 0; i < length; i += 1) {
      const target = stepIndex + i;
      if (target >= STEP_COUNT) break;
      chords[target] = {
        chordIndex,
        head: i === 0,
        length: i === 0 ? length : 0,
      };
    }
  }
  return chords;
}

function encodeBarVariants(barVariants) {
  if (!Array.isArray(barVariants)) {
    return '0';
  }
  const bits = [];
  TRACKS.forEach((track, trackIndex) => {
    const row = Array.isArray(barVariants[trackIndex]) ? barVariants[trackIndex] : [];
    for (let barIndex = 0; barIndex < BAR_COUNT; barIndex += 1) {
      const raw = Number(row[barIndex]) || 0;
      const clamped = Math.max(0, Math.min(raw, track.variants.length - 1));
      bits.push(clamped.toString(2).padStart(2, '0'));
    }
  });
  return binaryToBase62(bits.join(''));
}

function decodeBarVariants(encoded, bitsPerCell = 2) {
  const totalCells = TRACKS.length * BAR_COUNT;
  const expectedBits = totalCells * bitsPerCell;
  const rawBinary = base62ToBinary(encoded || '0');
  const binary = rawBinary.length >= expectedBits
    ? rawBinary.slice(-expectedBits)
    : rawBinary.padStart(expectedBits, '0');
  const result = [];
  let cursor = 0;
  TRACKS.forEach((track) => {
    const row = [];
    for (let bar = 0; bar < BAR_COUNT; bar += 1) {
      const slice = binary.slice(cursor, cursor + bitsPerCell);
      let value = parseInt(slice || '0', 2);
      if (Number.isNaN(value)) {
        value = 0;
      }
      const clamped = Math.max(0, Math.min(value, track.variants.length - 1));
      row.push(clamped);
      cursor += bitsPerCell;
    }
    result.push(row);
  });
  return result;
}

export function buildMetadata({ matrix, tempo, chords, barVariants }) {
  const binary = matrixToBinary(matrix);
  const pattern = binaryToBase62(binary);
  const encodedChords = encodeChordSteps(chords);
  const encodedVariants = encodeBarVariants(barVariants);
  return [VERSION, tempo, pattern, encodedChords, encodedVariants].join(':');
}

export function parseMetadata(metadata) {
  if (!metadata) {
    throw new Error('Metadata is empty');
  }
  const parts = metadata.split(':');
  const [version, tempoRaw] = parts;
  if (!version || !tempoRaw) {
    throw new Error('Metadata 구조가 올바르지 않아요');
  }
  const tempo = Number(tempoRaw);
  if (Number.isNaN(tempo) || tempo < 40 || tempo > 220) {
    throw new Error('Tempo out of expected range');
  }

  if (version === 'V1') {
    const pattern = parts[2] || '0';
    const binary = base62ToBinary(pattern);
    const matrix = binaryToMatrix(binary);
    const barVariants = deriveVariantsFromMatrix(matrix);
    const chords = createEmptyChordState();
    return {
      version,
      tempo,
      pattern,
      matrix,
      chords,
      barVariants,
      chordSelections: createDefaultChordSelections(),
      legacyLabel: parts[3] || '',
    };
  }

  if (version === 'V2') {
    const pattern = parts[2] || '0';
    const chordPattern = parts[3] || '0';
    const binary = base62ToBinary(pattern);
    const matrix = binaryToMatrix(binary);
    const chords = decodeChordSteps(chordPattern);
    const barVariants = deriveVariantsFromMatrix(matrix);
    return {
      version,
      tempo,
      pattern,
      matrix,
      chords,
      barVariants,
      chordSelections: chordStepsToSelections(chords),
    };
  }

  if (version === 'V3') {
    const pattern = parts[2] || '0';
    const chordPattern = parts[3] || '0';
    const variantPattern = parts[4] || '0';
    const binary = base62ToBinary(pattern);
    const matrix = binaryToMatrix(binary);
    const chords = decodeChordSteps(chordPattern);
    const barVariants = decodeBarVariants(variantPattern, 1);
    return {
      version,
      tempo,
      pattern,
      matrix,
      chords,
      barVariants,
      chordSelections: chordStepsToSelections(chords),
    };
  }

  if (version !== VERSION) {
    throw new Error(`Unsupported metadata version: ${version}`);
  }

  const pattern = parts[2] || '0';
  const chordPattern = parts[3] || '0';
  const variantPattern = parts[4] || '0';
  const binary = base62ToBinary(pattern);
  const matrix = binaryToMatrix(binary);
  const chords = decodeChordSteps(chordPattern);
  const barVariants = decodeBarVariants(variantPattern, 2);
  return {
    version,
    tempo,
    pattern,
    matrix,
    chords,
    barVariants,
    chordSelections: chordStepsToSelections(chords),
  };
}

export function metadataUrl(metadata, page = 'desk.html') {
  const params = new URLSearchParams({ meta: metadata });
  return `${page}?${params.toString()}`;
}

export function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

export function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('클립보드에 복사됨');
  } catch (err) {
    console.error(err);
    showToast('복사에 실패했어요');
  }
}

export async function tryWriteNfc(metadata) {
  if (!('NDEFReader' in window)) {
    throw new Error('이 기기는 Web NFC를 지원하지 않아요');
  }
  const writer = new NDEFReader();
  await writer.write({ records: [{ recordType: 'text', data: metadata }] });
}

function midiToNoteName(midi) {
  const normalized = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${CHORD_ROOTS[normalized]}${octave}`;
}

export function chordIndexFromParts(rootIndex, qualityIndex) {
  return rootIndex * CHORDS_PER_ROOT + qualityIndex;
}

export function splitChordIndex(index) {
  const rootIndex = Math.floor(index / CHORDS_PER_ROOT);
  const qualityIndex = index % CHORDS_PER_ROOT;
  return { rootIndex, qualityIndex };
}

export function getChordLabel(index) {
  if (index === null || index === undefined) return '';
  const { rootIndex, qualityIndex } = splitChordIndex(index);
  const root = CHORD_ROOTS[rootIndex] || 'C';
  const quality = CHORD_QUALITIES[qualityIndex] || CHORD_QUALITIES[0];
  const suffix = quality.display ? ` ${quality.display}` : '';
  return `${root}${suffix}`.trim();
}

export function getScaleNotes(index, octaveShift = 0) {
  const { rootIndex, qualityIndex } = splitChordIndex(index);
  const quality = CHORD_QUALITIES[qualityIndex] || CHORD_QUALITIES[0];
  const rootMidi = CHORD_BASE_MIDI + rootIndex + octaveShift * 12;
  return quality.intervals.map((offset) => midiToNoteName(rootMidi + offset));
}

export const getChordNotes = getScaleNotes;
export const getScaleLabel = getChordLabel;

export function countChordSegments(chords) {
  return chords.reduce((count, step) => (step.head ? count + 1 : count), 0);
}
