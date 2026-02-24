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

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);

    setTimeout(() => {
      const oscillator2 = ctx.createOscillator();
      const gainNode2 = ctx.createGain();

      oscillator2.connect(gainNode2);
      gainNode2.connect(ctx.destination);

      oscillator2.frequency.value = 1000;
      oscillator2.type = 'sine';

      gainNode2.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      oscillator2.start(ctx.currentTime);
      oscillator2.stop(ctx.currentTime + 0.5);
    }, 200);
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
}
