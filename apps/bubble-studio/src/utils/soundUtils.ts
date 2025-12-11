/**
 * Sound utility functions using Web Audio API
 *
 * To customize sounds:
 * 1. Adjust frequency values (Hz) - higher = higher pitch
 * 2. Adjust duration (seconds) - how long each tone plays
 * 3. Change oscillator type: 'sine' (smooth), 'square' (retro), 'sawtooth' (harsh), 'triangle' (mellow)
 * 4. Modify timing between notes using setTimeout delays
 *
 * Example frequencies:
 * - C4: 261.63 Hz
 * - E4: 329.63 Hz
 * - G4: 392.00 Hz
 * - C5: 523.25 Hz
 * - E5: 659.25 Hz
 */

const playSound = (
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume: number = 0.3
) => {
  try {
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + duration
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  } catch (error) {
    console.warn('Failed to play sound:', error);
  }
};

/**
 * Play a cheerful completion sound (ascending notes)
 *
 * Current: 600Hz → 750Hz → 900Hz (smooth sine wave)
 *
 * Try these alternatives by uncommenting:
 */
export const playGenerationCompleteSound = () => {
  // Default: Gentle ascending chime
  playSound(600, 0.12);
  setTimeout(() => playSound(750, 0.12), 80);
  setTimeout(() => playSound(900, 0.2), 160);

  // Alternative 1: Classic notification (uncomment to use)
  // playSound(800, 0.15);
  // setTimeout(() => playSound(1000, 0.25), 100);

  // Alternative 2: Success fanfare (uncomment to use)
  // playSound(523.25, 0.1); // C5
  // setTimeout(() => playSound(659.25, 0.1), 100); // E5
  // setTimeout(() => playSound(783.99, 0.15), 200); // G5
  // setTimeout(() => playSound(1046.5, 0.25), 300); // C6

  // Alternative 3: Retro game sound (uncomment to use)
  // playSound(400, 0.08, 'square');
  // setTimeout(() => playSound(600, 0.08, 'square'), 60);
  // setTimeout(() => playSound(800, 0.15, 'square'), 120);

  // Alternative 4: Single bell tone (uncomment to use)
  // playSound(1000, 0.4, 'sine', 0.4);
};
