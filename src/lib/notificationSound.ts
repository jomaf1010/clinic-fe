let audioCtx: AudioContext | null = null

export function playNotificationSound(): void {
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext()
    }

    const now = audioCtx.currentTime

    // Two-tone chime: pleasant and short
    const frequencies = [830, 1100]
    const duration = 0.12

    frequencies.forEach((freq, i) => {
      const oscillator = audioCtx!.createOscillator()
      const gain = audioCtx!.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(freq, now)

      const start = now + i * 0.13
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.15, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration)

      oscillator.connect(gain)
      gain.connect(audioCtx!.destination)

      oscillator.start(start)
      oscillator.stop(start + duration)
    })
  } catch {
    // Audio not available — silently ignore
  }
}
