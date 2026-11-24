/**
 * Web Audio API synthesizer for Waiter Calls & New Orders.
 * Features:
 * - Repeating loud ring (2s chime every 3s) for up to 60s until manager clicks Done
 * - Sound ON / OFF toggle + volume control (0.0 to 1.0)
 * - LocalStorage persistence for user preferences
 * - Browser autoplay detection & safe unlock handling
 */

let sharedAudioCtx: AudioContext | null = null;
let soundEnabled = true;
let soundVolume = 0.85; // 0.0 to 1.0
let repeatingRingTimer: NodeJS.Timeout | null = null;
let ringTimeoutTimer: NodeJS.Timeout | null = null;

// Initialize preferences from localStorage if in browser
if (typeof window !== 'undefined') {
  try {
    const savedEnabled = localStorage.getItem('cafe_sound_enabled');
    if (savedEnabled !== null) {
      soundEnabled = savedEnabled === 'true';
    }
    const savedVol = localStorage.getItem('cafe_sound_volume');
    if (savedVol !== null) {
      const parsed = parseFloat(savedVol);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        soundVolume = parsed;
      }
    }
  } catch {
    // Ignore storage errors
  }
}

export function isAudioEnabled(): boolean {
  return soundEnabled;
}

export function setAudioEnabled(enabled: boolean) {
  soundEnabled = enabled;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('cafe_sound_enabled', String(enabled));
    } catch {}
  }
  if (!enabled) {
    stopWaiterCallRing();
  }
}

export function getAudioVolume(): number {
  return soundVolume;
}

export function setAudioVolume(vol: number) {
  soundVolume = Math.max(0, Math.min(1, vol));
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('cafe_sound_volume', String(soundVolume));
    } catch {}
  }
}

export function isAutoplayBlocked(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(sharedAudioCtx && sharedAudioCtx.state === 'suspended');
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) return null;

  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioContextClass();
  }
  return sharedAudioCtx;
}

/**
 * Call on manager tap to unlock AudioContext in browser
 */
export async function unlockAudio(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    soundEnabled = true;
    if (typeof window !== 'undefined') {
      localStorage.setItem('cafe_sound_enabled', 'true');
    }
    // Confirm with a quick chime
    playTonePattern([
      { freq: 659.25, start: 0, duration: 0.3 },
      { freq: 987.77, start: 0.18, duration: 0.5 },
    ], soundVolume * 0.5);
    return true;
  } catch (err) {
    console.warn('Could not unlock audio context:', err);
    return false;
  }
}

/**
 * Internal tone pattern player using Web Audio API
 */
function playTonePattern(
  tones: Array<{ freq: number; start: number; duration: number }>,
  customVol?: number
) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const masterVol = customVol !== undefined ? customVol : soundVolume;
  if (masterVol <= 0) return;

  tones.forEach(t => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(t.freq, ctx.currentTime + t.start);

      // Volume envelope with clear attack & resonant decay
      gain.gain.setValueAtTime(masterVol * 0.7, ctx.currentTime + t.start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t.start + t.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + t.start);
      osc.stop(ctx.currentTime + t.start + t.duration);
    } catch (e) {
      console.warn('Tone play error:', e);
    }
  });
}

/**
 * Plays a single two-beat loud service bell chime
 */
export function playWaiterCallChime(vol?: number) {
  // Crisp resonant 4-tone brass service bell: C6 (1046Hz) -> E6 (1318Hz) -> G6 (1567Hz) -> C7 (2093Hz)
  playTonePattern([
    { freq: 880.0, start: 0, duration: 0.4 },
    { freq: 1174.66, start: 0.12, duration: 0.5 },
    { freq: 1396.91, start: 0.25, duration: 0.6 },
    { freq: 1760.0, start: 0.42, duration: 1.2 },
  ], vol);
}

/**
 * Starts a repeating loud ring (2s ring every 3s) that keeps repeating
 * until stopWaiterCallRing() is called or 60s maximum duration elapsed.
 */
export function startWaiterCallRing(vol?: number) {
  if (!soundEnabled) return;
  stopWaiterCallRing(); // Clear any existing ring

  // Play immediately
  playWaiterCallChime(vol);

  // Repeat every 3 seconds
  repeatingRingTimer = setInterval(() => {
    playWaiterCallChime(vol);
  }, 3000);

  // Maximum 60 seconds auto-shutoff safety net
  ringTimeoutTimer = setTimeout(() => {
    stopWaiterCallRing();
  }, 60000);
}

/**
 * Stops any active repeating waiter call ring
 */
export function stopWaiterCallRing() {
  if (repeatingRingTimer) {
    clearInterval(repeatingRingTimer);
    repeatingRingTimer = null;
  }
  if (ringTimeoutTimer) {
    clearTimeout(ringTimeoutTimer);
    ringTimeoutTimer = null;
  }
}

/**
 * Test sound button helper
 */
export function testWaiterCallSound(vol?: number) {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  playWaiterCallChime(vol);
}
