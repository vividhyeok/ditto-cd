const UNLOCK_EVENTS = ['pointerdown', 'touchstart', 'touchend', 'keydown'];

let toneReady = false;
let unlockingPromise = null;
let unlockHandler = null;
let stateMonitorAttached = false;

function getToneGlobal() {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.Tone || null;
}

function getToneContext() {
  const tone = getToneGlobal();
  if (!tone) {
    return null;
  }
  try {
    if (typeof tone.getContext === 'function') {
      const context = tone.getContext();
      if (!context) return null;
      return context.rawContext || context.context || context;
    }
    if (tone.context) {
      return tone.context.rawContext || tone.context._context || tone.context;
    }
  } catch (error) {
    console.warn('Tone context lookup failed', error);
  }
  return null;
}

function detachUnlockListeners() {
  if (!unlockHandler) {
    return;
  }
  UNLOCK_EVENTS.forEach((eventName) => window.removeEventListener(eventName, unlockHandler));
  unlockHandler = null;
}

function attachUnlockListeners(audioContext) {
  if (!audioContext || unlockHandler) {
    return;
  }
  unlockHandler = async () => {
    try {
      await audioContext.resume();
    } catch (error) {
      console.warn('AudioContext resume failed', error);
    }
    if (audioContext.state === 'running') {
      toneReady = true;
      detachUnlockListeners();
    }
  };
  UNLOCK_EVENTS.forEach((eventName) => window.addEventListener(eventName, unlockHandler, { passive: true }));
}

function attachStateMonitor(audioContext) {
  if (!audioContext || stateMonitorAttached) {
    return;
  }
  audioContext.addEventListener('statechange', () => {
    if (audioContext.state === 'running') {
      toneReady = true;
      detachUnlockListeners();
      return;
    }
    if (audioContext.state === 'interrupted' || audioContext.state === 'suspended') {
      toneReady = false;
      attachUnlockListeners(audioContext);
    }
  });
  stateMonitorAttached = true;
}

async function attemptToneStart() {
  const tone = getToneGlobal();
  if (!tone) {
    return false;
  }
  let toneStartResult;
  try {
    toneStartResult = tone.start();
  } catch (error) {
    console.warn('Tone.start() rejected', error);
  }
  const audioContext = getToneContext();
  if (!audioContext) {
    if (toneStartResult?.catch) {
      toneStartResult.catch((error) => console.warn('Tone.start() async rejection', error));
    }
    return false;
  }
  attachStateMonitor(audioContext);
  if (audioContext.state === 'running') {
    toneReady = true;
    detachUnlockListeners();
    return true;
  }
  let resumeResult;
  try {
    resumeResult = audioContext.resume();
  } catch (error) {
    console.warn('AudioContext resume threw', error);
  }
  if (audioContext.state === 'running') {
    toneReady = true;
    detachUnlockListeners();
    return true;
  }
  if (resumeResult?.then) {
    try {
      await resumeResult;
    } catch (error) {
      console.warn('AudioContext resume promise rejected', error);
    }
    if (audioContext.state === 'running') {
      toneReady = true;
      detachUnlockListeners();
      return true;
    }
  }
  if (toneStartResult?.then) {
    try {
      await toneStartResult;
    } catch (error) {
      console.warn('Tone.start() promise rejected', error);
    }
    if (audioContext.state === 'running') {
      toneReady = true;
      detachUnlockListeners();
      return true;
    }
  }
  attachUnlockListeners(audioContext);
  return false;
}

export async function ensureToneReady() {
  if (toneReady) {
    return true;
  }
  if (unlockingPromise) {
    try {
      await unlockingPromise;
    } catch (error) {
      console.warn('Tone unlock retry failed', error);
    }
    return toneReady;
  }
  unlockingPromise = attemptToneStart().finally(() => {
    unlockingPromise = null;
  });
  try {
    const ready = await unlockingPromise;
    return ready;
  } catch (error) {
    console.warn('Tone unlock attempt errored', error);
  }
  return toneReady;
}

export function primeToneUnlock(target) {
  if (!target || target.dataset?.toneUnlockBound === 'true') {
    return;
  }
  const handler = () => {
    ensureToneReady().then((ready) => {
      if (ready) {
        target.removeEventListener('pointerdown', handler);
        target.removeEventListener('touchstart', handler);
        target.removeEventListener('touchend', handler);
      }
    });
  };
  target.dataset.toneUnlockBound = 'true';
  target.addEventListener('pointerdown', handler, { passive: true });
  target.addEventListener('touchstart', handler, { passive: true });
  target.addEventListener('touchend', handler, { passive: true });
}

export function isToneReady() {
  return toneReady;
}
