import {
  BAR_COUNT,
  CHORD_ROOTS,
  CHORD_QUALITIES,
  splitChordIndex,
  TRACKS,
} from './shared.js';

const QUALITIES = {
  min: [0, 3, 7],
  maj: [0, 4, 7],
  dim: [0, 3, 6],
};

const NAT_MINOR = [0, 2, 3, 5, 7, 8, 10];
const NAT_MAJOR = [0, 2, 4, 5, 7, 9, 11];

function toNote(rootNote, semitone) {
  return Tone.Frequency(rootNote).transpose(semitone).toNote();
}

function makePitchSets(rootNote, quality) {
  const triadInts = QUALITIES[quality] ?? QUALITIES.min;
  const scale = quality === 'maj' ? NAT_MAJOR : NAT_MINOR;
  const chordTones = triadInts.map((i) => toNote(rootNote, i));
  const scaleTones = scale.map((i) => toNote(rootNote, i));
  return { chordTones, scaleTones };
}

function oct(note, n) {
  return Tone.Frequency(note).transpose(n * 12).toNote();
}

function makeInstruments() {
  const melody1 = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2 },
  }).toDestination();

  const melody2 = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'square' },
    envelope: { attack: 0.005, decay: 0.15, sustain: 0.15, release: 0.15 },
  }).toDestination();

  const bass = new Tone.MonoSynth({
    oscillator: { type: 'triangle' },
    filter: { Q: 1, type: 'lowpass', frequency: 200 },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.2, release: 0.1 },
  }).toDestination();

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.02,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.3, sustain: 0 },
  }).toDestination();

  const snare = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
  }).toDestination();

  const hat = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.07, release: 0.03 },
    resonance: 200,
    harmonicity: 5.1,
  }).toDestination();

  return { melody1, melody2, bass, kick, snare, hat };
}

function makePatternBank(rootNote, quality) {
  const { chordTones, scaleTones } = makePitchSets(rootNote, quality);
  const R = chordTones[0];
  const m3 = chordTones[1];
  const P5 = chordTones[2];
  const S2 = scaleTones[1];
  const b7 = scaleTones[6];
  const up = (n, o = 1) => oct(n, o);

  const melody1 = {
    '00': [
      ['0:0:0', up(R, 1), '8n'],
      ['0:1:0', up(m3, 1), '8n'],
      ['0:2:0', up(P5, 1), '8n'],
      ['0:3:0', up(m3, 1), '8n'],
    ],
    '01': [
      ['0:0:0', up(S2, 1), '8n'],
      ['0:0:2', up(m3, 1), '16n'],
      ['0:1:0', up(P5, 1), '8n'],
      ['0:2:2', up(b7, 1), '16n'],
      ['0:3:0', up(R, 1), '8n'],
    ],
    '10': [
      ['0:0:0', up(R, 1), '16n'],
      ['0:0:2', up(m3, 1), '16n'],
      ['0:1:0', up(P5, 1), '8n'],
      ['0:2:0', up(m3, 1), '16n'],
      ['0:2:2', up(P5, 1), '16n'],
      ['0:3:0', up(R, 1), '8n'],
    ],
    '11': [
      ['0:0:0', up(R, 1), '16n'],
      ['0:0:1', up(m3, 1), '16n'],
      ['0:0:2', up(P5, 1), '16n'],
      ['0:0:3', up(m3, 1), '16n'],
      ['0:1:0', up(R, 1), '16n'],
      ['0:1:1', up(S2, 1), '16n'],
      ['0:1:2', up(m3, 1), '16n'],
      ['0:1:3', up(P5, 1), '16n'],
      ['0:2:0', up(R, 1), '8n'],
      ['0:3:0', up(P5, 1), '8n'],
    ],
  };

  const melody2 = {
    '00': [
      ['0:1:0', up(R, 2), '8n'],
      ['0:3:0', up(m3, 2), '8n'],
    ],
    '01': [
      ['0:0:3', up(b7, 1), '16n'],
      ['0:1:2', up(R, 1), '16n'],
      ['0:2:3', up(S2, 1), '16n'],
      ['0:3:2', up(m3, 1), '16n'],
    ],
    '10': [
      ['0:0:2', up(P5, 1), '8n'],
      ['0:2:2', up(P5, 1), '8n'],
    ],
    '11': [
      ['0:0:2', up(R, 2), '16n'],
      ['0:0:3', up(S2, 2), '16n'],
      ['0:1:2', up(m3, 2), '16n'],
      ['0:1:3', up(P5, 2), '16n'],
      ['0:2:2', up(R, 2), '8n'],
      ['0:3:2', up(P5, 2), '8n'],
    ],
  };

  const bass = {
    '00': [
      ['0:0:0', R, '4n'],
      ['0:1:0', R, '4n'],
      ['0:2:0', R, '4n'],
      ['0:3:0', R, '4n'],
    ],
    '01': [
      ['0:0:0', R, '8n'],
      ['0:0:2', oct(R, 1), '8n'],
      ['0:1:0', R, '8n'],
      ['0:1:2', oct(R, 1), '8n'],
      ['0:2:0', R, '8n'],
      ['0:2:2', oct(R, 1), '8n'],
      ['0:3:0', R, '8n'],
      ['0:3:2', oct(R, 1), '8n'],
    ],
    '10': [
      ['0:0:0', R, '8n'],
      ['0:0:2', P5, '8n'],
      ['0:1:0', R, '8n'],
      ['0:1:2', P5, '8n'],
      ['0:2:0', R, '8n'],
      ['0:2:2', P5, '8n'],
      ['0:3:0', R, '8n'],
      ['0:3:2', P5, '8n'],
    ],
    '11': [
      ['0:0:0', R, '16n'],
      ['0:0:1', R, '16n'],
      ['0:0:2', P5, '16n'],
      ['0:0:3', R, '16n'],
      ['0:1:0', R, '16n'],
      ['0:1:1', P5, '16n'],
      ['0:1:2', oct(R, 1), '16n'],
      ['0:1:3', P5, '16n'],
      ['0:2:0', R, '8n'],
      ['0:3:0', P5, '8n'],
    ],
  };

  const drums = {
    '00': {
      kick: ['0:0:0', '0:1:0', '0:2:0', '0:3:0'],
      snare: ['0:1:0', '0:3:0'],
      hat: ['0:0:2', '0:1:2', '0:2:2', '0:3:2'],
    },
    '01': {
      kick: ['0:0:0', '0:1:0', '0:2:0', '0:3:0'],
      snare: ['0:1:0', '0:3:0'],
      hat: ['0:0:0', '0:0:2', '0:1:0', '0:1:2', '0:2:0', '0:2:2', '0:3:0', '0:3:2'],
    },
    '10': {
      kick: ['0:0:0', '0:1:1', '0:2:0', '0:3:1'],
      snare: ['0:1:0', '0:3:0'],
      hat: ['0:0:2', '0:1:2', '0:2:2', '0:3:2'],
    },
    '11': {
      kick: ['0:0:0', '0:0:3', '0:1:0', '0:1:3', '0:2:0', '0:2:3', '0:3:0'],
      snare: ['0:1:0', '0:1:2', '0:3:0', '0:3:2'],
      hat: [
        '0:0:0',
        '0:0:1',
        '0:0:2',
        '0:0:3',
        '0:1:0',
        '0:1:1',
        '0:1:2',
        '0:1:3',
        '0:2:0',
        '0:2:1',
        '0:2:2',
        '0:2:3',
        '0:3:0',
        '0:3:1',
        '0:3:2',
        '0:3:3',
      ],
    },
  };

  return { melody1, melody2, bass, drums };
}

const DEFAULT_CHORD = { rootNote: 'C3', quality: 'min' };

function offsetTime(timeString, barOffset) {
  const [bar = 0, beat = 0, subdivision = 0] = timeString.split(':').map((value) => Number(value) || 0);
  const totalSixteenths = bar * 16 + beat * 4 + subdivision;
  const offsetSixteenths = barOffset * 16;
  const combined = totalSixteenths + offsetSixteenths;
  const resultBar = Math.floor(combined / 16);
  const remainder = combined % 16;
  const resultBeat = Math.floor(remainder / 4);
  const resultSubdivision = remainder % 4;
  return `${resultBar}:${resultBeat}:${resultSubdivision}`;
}

function inferTriadQuality(intervals = []) {
  if (intervals.includes(4) && intervals.includes(7)) {
    return 'maj';
  }
  if (intervals.includes(3) && intervals.includes(6)) {
    return 'dim';
  }
  if (intervals.includes(3) && intervals.includes(7)) {
    return 'min';
  }
  return 'min';
}

function selectionToChord(selection, fallback = DEFAULT_CHORD) {
  if (selection === null || selection === undefined) {
    return fallback;
  }
  const { rootIndex, qualityIndex } = splitChordIndex(selection);
  const root = CHORD_ROOTS[rootIndex] || 'C';
  const quality = CHORD_QUALITIES[qualityIndex];
  return {
    rootNote: `${root}3`,
    quality: inferTriadQuality(quality?.intervals),
  };
}

function chordSelectionsToSequence(chordSelections = [], barCount = BAR_COUNT) {
  const result = [];
  let lastChord = DEFAULT_CHORD;
  for (let index = 0; index < barCount; index += 1) {
    const selection = chordSelections[index];
    if (selection !== null && selection !== undefined) {
      lastChord = selectionToChord(selection, DEFAULT_CHORD);
      break;
    }
  }
  for (let index = 0; index < barCount; index += 1) {
    const selection = chordSelections[index];
    const chord = selectionToChord(selection, lastChord);
    result[index] = chord;
    if (selection !== null && selection !== undefined) {
      lastChord = chord;
    }
  }
  return result;
}

const TRACK_ROLE_MAP = {
  drum: 'drums',
  bass: 'bass',
  melody: 'melody1',
  sub: 'melody2',
};

function mapBarVariantsToLabels(barVariants = [], barCount = BAR_COUNT) {
  const variants = {
    drums: Array(barCount).fill('00'),
    bass: Array(barCount).fill('00'),
    melody1: Array(barCount).fill('00'),
    melody2: Array(barCount).fill('00'),
  };

  TRACKS.forEach((track, trackIndex) => {
    const role = TRACK_ROLE_MAP[track.id];
    if (!role) {
      return;
    }
    const row = barVariants[trackIndex] || [];
    for (let bar = 0; bar < barCount; bar += 1) {
      const variantIndex = row[bar];
      const label = track.variants?.[variantIndex]?.label || track.variants?.[0]?.label || '00';
      variants[role][bar] = label;
    }
  });

  return variants;
}

function buildTimeline({
  barCount = BAR_COUNT,
  variantLabels = mapBarVariantsToLabels(),
  chords = chordSelectionsToSequence(),
} = {}) {
  const timeline = {
    barCount,
    melody1: [],
    melody2: [],
    bass: [],
    drums: { kick: [], snare: [], hat: [] },
  };

  for (let bar = 0; bar < barCount; bar += 1) {
    const chord = chords[bar] || DEFAULT_CHORD;
    const bank = makePatternBank(chord.rootNote, chord.quality);

    const addEvents = (target, events = []) => {
      events.forEach(([time, note, duration]) => {
        timeline[target].push([offsetTime(time, bar), note, duration]);
      });
    };

    const addDrums = (target, events = []) => {
      events.forEach((time) => {
        timeline.drums[target].push(offsetTime(time, bar));
      });
    };

    const melodyVariant = variantLabels.melody1?.[bar] || '00';
    addEvents('melody1', bank.melody1[melodyVariant] || bank.melody1['00']);

    const melody2Variant = variantLabels.melody2?.[bar] || '00';
    addEvents('melody2', bank.melody2[melody2Variant] || bank.melody2['00']);

    const bassVariant = variantLabels.bass?.[bar] || '00';
    addEvents('bass', bank.bass[bassVariant] || bank.bass['00']);

    const drumVariant = variantLabels.drums?.[bar] || '00';
    const drumPattern = bank.drums[drumVariant] || bank.drums['00'];
    addDrums('kick', drumPattern.kick);
    addDrums('snare', drumPattern.snare);
    addDrums('hat', drumPattern.hat);
  }

  return timeline;
}

function createLoopEngine({ bpm = 120 } = {}) {
  let instruments;
  let parts = {};
  let timeline;
  let started = false;

  function ensureInstruments() {
    if (!instruments) {
      instruments = makeInstruments();
      if (instruments.bass) {
        instruments.bass.volume.value = -6;
      }
      if (instruments.melody1) {
        instruments.melody1.volume.value = -8;
      }
      if (instruments.melody2) {
        instruments.melody2.volume.value = -10;
      }
      if (instruments.hat) {
        instruments.hat.volume.value = -14;
      }
    }
  }

  function clearParts() {
    Object.values(parts).forEach((part) => {
      if (part) {
        part.stop();
        part.dispose();
      }
    });
    parts = {};
  }

  function buildParts() {
    if (!timeline) {
      return;
    }
    clearParts();
    ensureInstruments();

    const loopEnd = `${timeline.barCount || BAR_COUNT}m`;

    const createNotePart = (synth, events = []) => {
      if (!synth || !events.length) {
        return null;
      }
      const part = new Tone.Part((time, value) => {
        synth.triggerAttackRelease(value.note, value.duration, time);
      }, events.map(([time, note, duration]) => [time, { note, duration }]));
      part.loop = true;
      part.loopEnd = loopEnd;
      part.start(0);
      return part;
    };

    parts.melody1 = createNotePart(instruments.melody1, timeline.melody1);
    parts.melody2 = createNotePart(instruments.melody2, timeline.melody2);
    parts.bass = createNotePart(instruments.bass, timeline.bass);

    const createTriggerPart = (triggerFn, times = []) => {
      if (!times.length) {
        return null;
      }
      const part = new Tone.Part((time) => triggerFn(time), times.map((time) => [time]));
      part.loop = true;
      part.loopEnd = loopEnd;
      part.start(0);
      return part;
    };

    parts.kick = createTriggerPart((time) => {
      instruments.kick.triggerAttackRelease('C1', '8n', time);
    }, timeline.drums.kick);

    parts.snare = createTriggerPart((time) => {
      instruments.snare.triggerAttackRelease('16n', time);
    }, timeline.drums.snare);

    parts.hat = createTriggerPart((time) => {
      instruments.hat.triggerAttackRelease('C6', '16n', time);
    }, timeline.drums.hat);
  }

  function setTimeline(newTimeline) {
    timeline = newTimeline;
    if (started) {
      buildParts();
    }
  }

  function start() {
    if (!timeline) {
      return;
    }
    Tone.Transport.bpm.value = bpm;
    buildParts();
    started = true;
  }

  function stop() {
    started = false;
    clearParts();
    if (instruments?.melody1?.releaseAll) instruments.melody1.releaseAll();
    if (instruments?.melody2?.releaseAll) instruments.melody2.releaseAll();
    if (instruments?.bass?.triggerRelease) instruments.bass.triggerRelease();
  }

  function setBpm(nextBpm) {
    bpm = nextBpm;
    Tone.Transport.bpm.value = bpm;
  }

  return {
    setTimeline,
    start,
    stop,
    setBpm,
  };
}

export {
  createLoopEngine,
  buildTimeline,
  mapBarVariantsToLabels,
  chordSelectionsToSequence,
  selectionToChord,
  inferTriadQuality,
  DEFAULT_CHORD,
};
