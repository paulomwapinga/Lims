let audioContext: AudioContext | null = null;
let isAudioContextResumed = false;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

async function ensureAudioContextResumed() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended' && !isAudioContextResumed) {
    await ctx.resume();
    isAudioContextResumed = true;
  }
}

document.addEventListener('click', () => {
  ensureAudioContextResumed();
}, { once: false });

document.addEventListener('keydown', () => {
  ensureAudioContextResumed();
}, { once: false });

export async function playNotificationSound() {
  try {
    await ensureAudioContextResumed();

    const ctx = getAudioContext();

    if (ctx.state !== 'running') {
      await ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = 880;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.2);
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
}
