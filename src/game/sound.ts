let audio: AudioContext | undefined;

export function primeSound(): void {
  try {
    if (!audio) audio = new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    // Sound is optional; the game must continue on devices that cannot start audio.
  }
}

function chime(notes: readonly number[], duration = 0.09): void {
  if (!audio || audio.state !== 'running') return;
  const start = audio.currentTime;
  notes.forEach((frequency, index) => {
    const at = start + index * duration;
    const oscillator = audio!.createOscillator();
    const gain = audio!.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.12, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain).connect(audio!.destination);
    oscillator.start(at); oscillator.stop(at + duration + 0.01);
  });
}

export const playRecordedSound = (): void => chime([523.25, 659.25]);
export const playSuccessSound = (): void => chime([523.25, 659.25, 783.99], 0.12);
