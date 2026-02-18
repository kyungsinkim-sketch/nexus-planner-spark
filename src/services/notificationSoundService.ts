/**
 * NotificationSoundService — Plays notification sounds using Web Audio API.
 *
 * Uses synthesized tones (no external audio files needed).
 * Two sound types:
 * - "message": Short, pleasant double-beep for new chat messages
 * - "alert":   Slightly longer triple-tone for important notifications
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

function playTone(frequency: number, duration: number, startTime: number, ctx: AudioContext, gain: GainNode) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, startTime);
  osc.connect(gain);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

/**
 * Play a notification sound.
 * @param type - "message" for chat messages, "alert" for important notifications
 */
export function playNotificationSound(type: 'message' | 'alert' = 'message') {
  try {
    const ctx = getAudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);

    if (type === 'message') {
      // Pleasant double-beep (like iMessage)
      playTone(880, 0.08, ctx.currentTime, ctx, gain);
      playTone(1175, 0.08, ctx.currentTime + 0.1, ctx, gain);
      // Fade out
      gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    } else {
      // Triple-tone alert (ascending)
      playTone(660, 0.1, ctx.currentTime, ctx, gain);
      playTone(880, 0.1, ctx.currentTime + 0.12, ctx, gain);
      playTone(1100, 0.12, ctx.currentTime + 0.24, ctx, gain);
      // Fade out
      gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.36);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    }
  } catch (e) {
    // Web Audio API not available — silently skip
    console.warn('Notification sound failed:', e);
  }
}
