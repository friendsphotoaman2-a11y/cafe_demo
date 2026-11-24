/**
 * Web Audio API synthesizer chime for Waiter Calls & New Orders.
 * Supports browser autoplay unlock: Manager clicks "Sound ON" once at start of day.
 */

let sharedAudioCtx: AudioContext | null = null;
let soundEnabled = false;

export function isAudioEnabled(): boolean {
  return soundEnabled;
}

export function setAudioEnabled(enabled: boolean) {
  soundEnabled = enabled;
  if (!enabled && sharedAudioCtx && sharedAudioCtx.state === 'running') {
    sharedAudioCtx.suspend().catch(() => {});
  }
}

/**
 * Call on manager tap ("Sound ON") to unlock AudioContext in browser
 */
export async function unlockAudio(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return false;

    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioContextClass();
    }

    if (sharedAudioCtx.state === 'suspended') {
      await sharedAudioCtx.resume();
    }

    soundEnabled = true;

    // Play a gentle welcome bell chime to confirm audio is active
    playWaiterCallChime();
    return true;
  } catch (err) {
    console.warn('Could not unlock audio context:', err);
    return false;
  }
}

/**
 * Plays a distinct two/three-tone bell chime for waiter assistance or new order
 */
export function playWaiterCallChime() {
  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return;

    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioContextClass();
    }

    const ctx = sharedAudioCtx;

    // Check if context is suspended; attempt resume if unlocked
    if (ctx.state === 'suspended' && soundEnabled) {
      ctx.resume().catch(() => {});
    }

    const playTone = (freq: number, start: number, duration: number, vol = 0.35) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

      gain.gain.setValueAtTime(vol, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    // 3-tone service desk bell chime: E5 (659Hz) -> G#5 (830Hz) -> B5 (987Hz)
    playTone(659.25, 0, 0.4, 0.4);
    playTone(830.61, 0.22, 0.6, 0.4);
    playTone(987.77, 0.45, 0.9, 0.5);
  } catch (e) {
    console.warn('Audio chime could not be played:', e);
  }
}
