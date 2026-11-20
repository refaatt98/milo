let ctx: AudioContext | null = null

/** A soft two-note wooden chime, generated (no audio files needed). */
export function chime(kind: 'start' | 'done' | 'break' = 'done') {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    const notes = kind === 'start' ? [523.25, 659.25] : kind === 'break' ? [659.25, 523.25] : [523.25, 659.25, 783.99]
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator()
      const g = ctx!.createGain()
      o.type = 'sine'
      o.frequency.value = f
      const t = ctx!.currentTime + i * 0.13
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.12, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
      o.connect(g).connect(ctx!.destination)
      o.start(t)
      o.stop(t + 1)
    })
  } catch {
    /* sound is optional */
  }
}
