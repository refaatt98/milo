import type { ReactElement } from 'react'
import Milo, { type MiloMood } from '../character/Milo'
import { Plant } from '../garden/Plant'

const INK = '#27372F'

const shape = (d: string, fill: string) => () => (
  <svg viewBox="0 0 100 100" className="size-full" overflow="visible">
    <path d={d} fill={fill} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
  </svg>
)

function starD(cx = 50, cy = 52, r = 44) {
  const p: string[] = []
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.48 : r
    const a = (Math.PI / 5) * i - Math.PI / 2
    p.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`)
  }
  return `M${p.join('L')}Z`
}

const miloSticker = (mood: MiloMood, cap = false) => () => (
  <div className="size-full">
    <Milo mood={mood} size="100%" cap={cap} still force />
  </div>
)

export const STICKERS: Record<string, { label: string; render: () => ReactElement }> = {
  'milo-happy': { label: 'ميلو مبسوط', render: miloSticker('happy') },
  'milo-study': { label: 'ميلو بدرس', render: miloSticker('studying') },
  'milo-cap': { label: 'ميلو متخرّج', render: miloSticker('idle', true) },
  'milo-tea': { label: 'ميلو بشرب شاي', render: miloSticker('break') },
  'milo-sleepy': { label: 'ميلو نعسان', render: miloSticker('sleepy') },
  'milo-cheer': { label: 'ميلو بشجّع', render: miloSticker('encouraging') },
  tulip: { label: 'توليب', render: () => <Plant kind="tulip" stage={4} size={80} still /> },
  sunflower: { label: 'دوار الشمس', render: () => <Plant kind="sunflower" stage={4} size={80} still /> },
  cactus: { label: 'صبّار', render: () => <Plant kind="cactus" stage={4} size={80} still /> },
  star: { label: 'نجمة', render: shape(starD(), '#F9E9A7') },
  heart: { label: 'قلب', render: shape('M50 88C50 88 8 62 8 34C8 18 20 10 32 10C42 10 48 18 50 24C52 18 58 10 68 10C80 10 92 18 92 34C92 62 50 88 50 88Z', '#F4A6B7') },
  check: {
    label: 'صح',
    render: () => (
      <svg viewBox="0 0 100 100" className="size-full">
        <circle cx="50" cy="50" r="44" fill="#B9D5AE" stroke={INK} strokeWidth="4" />
        <path d="M28 52L44 67L73 35" fill="none" stroke={INK} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  important: {
    label: 'مهم!',
    render: () => (
      <svg viewBox="0 0 120 70" className="size-full">
        <path d="M6 12L114 6L110 60L10 64Z" fill="#F8D9C6" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        <text x="60" y="46" textAnchor="middle" fontSize="30" fontWeight="800" fontFamily="Baloo Bhaijaan 2, sans-serif" fill={INK}>مهم!</text>
      </svg>
    ),
  },
  review: {
    label: 'راجعها',
    render: () => (
      <svg viewBox="0 0 130 70" className="size-full">
        <rect x="6" y="8" width="118" height="54" rx="27" fill="#EAE3F6" stroke={INK} strokeWidth="4" />
        <text x="65" y="45" textAnchor="middle" fontSize="26" fontWeight="800" fontFamily="Baloo Bhaijaan 2, sans-serif" fill={INK}>راجعها ↻</text>
      </svg>
    ),
  },
  bulb: {
    label: 'فكرة',
    render: () => (
      <svg viewBox="0 0 100 100" className="size-full">
        <path d="M50 8C30 8 18 22 18 40C18 54 28 60 32 70H68C72 60 82 54 82 40C82 22 70 8 50 8Z" fill="#F9E9A7" stroke={INK} strokeWidth="4" />
        <path d="M36 78H64M40 88H60" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      </svg>
    ),
  },
  pin: {
    label: 'دبوس',
    render: () => (
      <svg viewBox="0 0 100 100" className="size-full">
        <circle cx="50" cy="34" r="24" fill="#B23A48" stroke={INK} strokeWidth="4" />
        <circle cx="42" cy="26" r="6" fill="#fff" opacity=".6" />
        <path d="M50 58V94" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      </svg>
    ),
  },
  tape: {
    label: 'شريط لاصق',
    render: () => (
      <svg viewBox="0 0 140 44" className="size-full">
        <path d="M4 6L136 2L138 40L6 42L10 24Z" fill="rgba(249,233,167,.85)" stroke={INK} strokeWidth="2" strokeDasharray="5 4" />
      </svg>
    ),
  },
}
export const STICKER_IDS = Object.keys(STICKERS)
