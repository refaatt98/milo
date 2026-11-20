/** Soft paper-scratch sound while writing, generated with WebAudio (no files). */
let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null
let src: AudioBufferSourceNode | null = null
let gain: GainNode | null = null
let filter: BiquadFilterNode | null = null

function ensure() {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AC) return false
  ctx ??= new AC()
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = noise.getChannelData(0)
    let last = 0
    for (let i = 0; i < d.length; i++) {
      last = last * 0.6 + (Math.random() * 2 - 1) * 0.4
      d[i] = last
    }
  }
  return true
}

export function asmrStart(kind: 'pencil' | 'pen' | 'marker') {
  if (!ensure() || !ctx || !noise) return
  void ctx.resume()
  asmrStop()
  src = ctx.createBufferSource()
  src.buffer = noise
  src.loop = true
  filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = kind === 'pencil' ? 3800 : kind === 'marker' ? 1200 : 2600
  filter.Q.value = 0.9
  gain = ctx.createGain()
  gain.gain.value = 0
  src.connect(filter).connect(gain).connect(ctx.destination)
  src.start()
}

/** speed in page units per ms */
export function asmrMove(speed: number) {
  if (!gain || !ctx) return
  const target = Math.min(0.22, speed * 0.12)
  gain.gain.setTargetAtTime(target, ctx.currentTime, 0.03)
}

export function asmrStop() {
  if (gain && ctx) gain.gain.setTargetAtTime(0, ctx.currentTime, 0.04)
  const s = src
  src = null
  if (s) setTimeout(() => s.stop(), 200)
}
