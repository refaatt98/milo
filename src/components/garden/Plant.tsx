import { motion } from 'motion/react'
import type { PlantKind } from '../../lib/db'

const INK = '#27372F'
const STEM = '#6F9876'
const LEAF_A = '#8DB592'
const LEAF_B = '#6F9876'

type Stage = 0 | 1 | 2 | 3 | 4

function Leaf({ x, y, a, l, w, c = LEAF_A, vein = true }: { x: number; y: number; a: number; l: number; w: number; c?: string; vein?: boolean }) {
  const d = `M0 0C${w / 2} ${-l * 0.25} ${w / 2} ${-l * 0.75} 0 ${-l}C${-w / 2} ${-l * 0.75} ${-w / 2} ${-l * 0.25} 0 0Z`
  return (
    <g transform={`translate(${x} ${y}) rotate(${a})`}>
      <path d={d} fill={c} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      {vein && <path d={`M0 -2L0 ${-l * 0.8}`} stroke={INK} strokeWidth={1} opacity={0.4} strokeLinecap="round" />}
    </g>
  )
}

function Stem({ h, curve = 4, w = 3 }: { h: number; curve?: number; w?: number }) {
  return <path d={`M60 140C${60 + curve} ${140 - h * 0.4} ${60 - curve} ${140 - h * 0.7} 60 ${140 - h}`} stroke={STEM} strokeWidth={w} strokeLinecap="round" fill="none" />
}

function Seed({ color }: { color: string }) {
  return (
    <g>
      <path d="M38 141C42 132 52 128 60 128C68 128 78 132 82 141Z" fill="#C9B79C" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <ellipse cx={60} cy={131} rx={6.5} ry={4.5} fill={color} stroke={INK} strokeWidth={1.6} transform="rotate(-18 60 131)" />
      <path d="M58 127C59 124 61 123 63 123" stroke={STEM} strokeWidth={1.8} strokeLinecap="round" fill="none" />
      <circle cx={47} cy={137} r={1} fill={INK} opacity={0.35} />
      <circle cx={73} cy={136} r={1.2} fill={INK} opacity={0.35} />
    </g>
  )
}

function Sprout() {
  return (
    <g>
      <Stem h={26} curve={2} />
      <Leaf x={60} y={116} a={-58} l={14} w={10} vein={false} />
      <Leaf x={60} y={116} a={58} l={14} w={10} c={LEAF_B} vein={false} />
    </g>
  )
}

/* ---------- species ---------- */

function Tulip({ s }: { s: Stage }) {
  const h = s === 2 ? 56 : s === 3 ? 74 : 86
  const top = 140 - h
  return (
    <g>
      <Stem h={h} curve={3} />
      <Leaf x={60} y={138} a={-22} l={s === 2 ? 40 : 52} w={14} />
      <Leaf x={60} y={138} a={26} l={s === 2 ? 34 : 46} w={13} c={LEAF_B} />
      {s === 3 && <path d={`M53 ${top + 2}C52 ${top - 10} 57 ${top - 16} 60 ${top - 17}C63 ${top - 16} 68 ${top - 10} 67 ${top + 2}C64 ${top + 5} 56 ${top + 5} 53 ${top + 2}Z`} fill="#F4B9A0" stroke={INK} strokeWidth={1.6} />}
      {s === 4 && (
        <g>
          <path d={`M46 ${top - 14}C46 ${top - 2} 52 ${top + 4} 60 ${top + 4}C68 ${top + 4} 74 ${top - 2} 74 ${top - 14}L67 ${top - 6}L60 ${top - 20}L53 ${top - 6}Z`} fill="#F8D9C6" stroke={INK} strokeWidth={1.7} strokeLinejoin="round" />
          <path d={`M53 ${top - 6}C55 ${top - 1} 65 ${top - 1} 67 ${top - 6}`} stroke="#E99C82" strokeWidth={1.4} fill="none" />
          <Leaf x={60} y={110} a={-48} l={20} w={9} />
        </g>
      )}
    </g>
  )
}

function Sunflower({ s }: { s: Stage }) {
  const h = s === 2 ? 58 : s === 3 ? 84 : 98
  const top = 140 - h
  const petals = 12
  return (
    <g>
      <Stem h={h} curve={5} w={3.6} />
      <Leaf x={61} y={122} a={-62} l={26} w={22} />
      <Leaf x={59} y={110} a={64} l={24} w={20} c={LEAF_B} />
      {s >= 3 && <Leaf x={60} y={92} a={-50} l={20} w={17} c={LEAF_B} />}
      {s === 3 && (
        <g>
          <circle cx={60} cy={top} r={9} fill="#B9D5AE" stroke={INK} strokeWidth={1.6} />
          <path d={`M54 ${top - 6}L60 ${top - 14}L66 ${top - 6}`} fill="#F9E9A7" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
        </g>
      )}
      {s === 4 && (
        <g className="plant-spin" style={{ transformOrigin: `60px ${top}px` }}>
          {Array.from({ length: petals }, (_, i) => (
            <ellipse key={i} cx={60} cy={top - 15} rx={5} ry={10} fill="#F9E9A7" stroke={INK} strokeWidth={1.4} transform={`rotate(${(360 / petals) * i} 60 ${top})`} />
          ))}
          <circle cx={60} cy={top} r={10} fill="#8B6B4A" stroke={INK} strokeWidth={1.6} />
          <circle cx={57} cy={top - 3} r={1.4} fill="#F9E9A7" />
          <circle cx={63} cy={top + 2} r={1.2} fill="#F9E9A7" />
          <circle cx={61} cy={top - 4} r={1} fill="#F9E9A7" />
        </g>
      )}
    </g>
  )
}

function Frond({ x, y, a, l, c = LEAF_A }: { x: number; y: number; a: number; l: number; c?: string }) {
  const n = 6
  return (
    <g transform={`translate(${x} ${y}) rotate(${a})`}>
      <path d={`M0 0Q4 ${-l / 2} 0 ${-l}`} stroke={STEM} strokeWidth={2} fill="none" strokeLinecap="round" />
      {Array.from({ length: n }, (_, i) => {
        const yy = (-l * (i + 1)) / (n + 1)
        const ll = (l / 3.2) * (1 - i / (n + 2))
        return (
          <g key={i}>
            <Leaf x={1} y={yy} a={-62} l={ll} w={ll * 0.55} c={c} vein={false} />
            <Leaf x={1} y={yy} a={62} l={ll} w={ll * 0.55} c={c} vein={false} />
          </g>
        )
      })}
    </g>
  )
}

function Fern({ s }: { s: Stage }) {
  const l = s === 2 ? 50 : s === 3 ? 66 : 78
  return (
    <g>
      <Frond x={60} y={140} a={-28} l={l * 0.85} c={LEAF_B} />
      <Frond x={60} y={140} a={30} l={l * 0.8} c={LEAF_B} />
      <Frond x={60} y={140} a={-4} l={l} />
      {s >= 3 && (
        <path d="M60 140C62 120 70 108 76 104C82 100 84 108 78 110C74 111 74 106 77 106" stroke={STEM} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      )}
      {s === 4 && (
        <g>
          <Frond x={60} y={140} a={-52} l={l * 0.6} />
          <Frond x={60} y={140} a={54} l={l * 0.6} />
          {[
            [40, 82],
            [84, 90],
            [55, 60],
            [72, 70],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={3.2} fill="#DCEEF4" stroke={INK} strokeWidth={1.3} />
          ))}
        </g>
      )}
    </g>
  )
}

function Lavender({ s }: { s: Stage }) {
  const stems = s === 2 ? [[-8, 50], [6, 56]] : s === 3 ? [[-12, 62], [0, 74], [10, 66]] : [[-16, 66], [-6, 82], [4, 88], [14, 72]]
  return (
    <g>
      {stems.map(([dx, h], i) => {
        const tx = 60 + dx * 1.4
        const ty = 140 - h
        return (
          <g key={i}>
            <path d={`M60 140Q${60 + dx * 0.4} ${140 - h / 2} ${tx} ${ty}`} stroke={STEM} strokeWidth={2.2} fill="none" strokeLinecap="round" />
            {s >= 3 &&
              Array.from({ length: s === 4 ? 6 : 3 }, (_, k) => (
                <ellipse key={k} cx={tx + (k % 2 ? 2.5 : -2.5)} cy={ty + k * 4.5} rx={3} ry={4} fill={s === 4 ? '#B9A6DE' : '#EAE3F6'} stroke={INK} strokeWidth={1.1} />
              ))}
          </g>
        )
      })}
      <Leaf x={60} y={139} a={-48} l={22} w={6} />
      <Leaf x={60} y={139} a={50} l={20} w={6} c={LEAF_B} />
      <Leaf x={60} y={139} a={-18} l={18} w={5} c={LEAF_B} />
    </g>
  )
}

function Cactus({ s }: { s: Stage }) {
  const h = s === 2 ? 46 : s === 3 ? 60 : 70
  const top = 140 - h
  return (
    <g>
      {s === 4 && (
        <>
          <path d="M44 112C34 112 32 104 32 94C32 88 40 88 40 94V102H46" fill="#9CC093" stroke={INK} strokeWidth={1.7} strokeLinejoin="round" />
          <path d="M76 104C86 104 88 96 88 86C88 80 80 80 80 86V96H74" fill="#9CC093" stroke={INK} strokeWidth={1.7} strokeLinejoin="round" />
        </>
      )}
      <path d={`M46 140V${top + 14}C46 ${top + 4} 52 ${top} 60 ${top}C68 ${top} 74 ${top + 4} 74 ${top + 14}V140Z`} fill="#9CC093" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      <path d={`M60 ${top + 6}V136M53 ${top + 10}V136M67 ${top + 10}V136`} stroke={INK} strokeWidth={1} opacity={0.3} />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${i % 2 ? 74 : 46} ${top + 16 + i * 10}l${i % 2 ? 4 : -4} -2`} stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
      ))}
      {s === 3 && <ellipse cx={60} cy={top - 3} rx={5} ry={6} fill="#F4B9A0" stroke={INK} strokeWidth={1.5} />}
      {s === 4 &&
        [0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} cx={60} cy={top - 10} rx={4.5} ry={8} fill="#F8D9C6" stroke={INK} strokeWidth={1.4} transform={`rotate(${r} 60 ${top - 3})`} />
        ))}
      {s === 4 && <circle cx={60} cy={top - 3} r={4} fill="#F9E9A7" stroke={INK} strokeWidth={1.3} />}
    </g>
  )
}

function Blossom({ s }: { s: Stage }) {
  const r = s === 2 ? 22 : s === 3 ? 28 : 33
  const cy = 140 - (s === 2 ? 52 : s === 3 ? 68 : 78)
  const flowers =
    s === 4
      ? [[-18, -10], [12, -18], [20, 4], [-6, 8], [-22, 10], [4, -4], [-8, -24], [26, -10]]
      : s === 3
        ? [[-12, -8], [10, -14], [14, 6], [-6, 10]]
        : []
  return (
    <g>
      <path d={`M57 140C58 ${cy + 30} 56 ${cy + 16} 60 ${cy + 4}M60 ${cy + 26}C64 ${cy + 18} 70 ${cy + 14} 74 ${cy + 10}`} stroke="#8B6B4A" strokeWidth={5} strokeLinecap="round" fill="none" />
      <path d={`M${60 - r} ${cy + 4}C${60 - r - 4} ${cy - r * 0.6} ${60 - r * 0.3} ${cy - r - 4} ${60 + r * 0.2} ${cy - r}C${60 + r + 6} ${cy - r + 2} ${60 + r + 6} ${cy + 6} ${60 + r * 0.7} ${cy + r * 0.6}C${60 + r * 0.2} ${cy + r} ${60 - r * 0.8} ${cy + r * 0.8} ${60 - r} ${cy + 4}Z`} fill="#B9D5AE" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      <path d={`M${60 - r * 0.5} ${cy - r * 0.3}C${60 - r * 0.2} ${cy - r * 0.6} ${60 + r * 0.2} ${cy - r * 0.6} ${60 + r * 0.4} ${cy - r * 0.4}`} stroke="#E4EEDC" strokeWidth={3} strokeLinecap="round" fill="none" />
      {flowers.map(([dx, dy], i) =>
        s === 3 ? (
          <circle key={i} cx={60 + dx} cy={cy + dy} r={3} fill="#F4B9A0" stroke={INK} strokeWidth={1.1} />
        ) : (
          <g key={i} transform={`translate(${60 + dx} ${cy + dy})`}>
            {[0, 72, 144, 216, 288].map((a) => (
              <circle key={a} cx={0} cy={-3.4} r={2.8} fill="#FBE3EA" stroke={INK} strokeWidth={0.9} transform={`rotate(${a})`} />
            ))}
            <circle r={1.6} fill="#F9E9A7" />
          </g>
        ),
      )}
    </g>
  )
}

const SPECIES = { tulip: Tulip, sunflower: Sunflower, fern: Fern, lavender: Lavender, cactus: Cactus, blossom: Blossom }
export const SEED_COLORS: Record<PlantKind, string> = {
  tulip: '#F8D9C6',
  sunflower: '#F9E9A7',
  fern: '#DCEEF4',
  lavender: '#EAE3F6',
  cactus: '#E4EEDC',
  blossom: '#FBE3EA',
}

export function Plant({ kind, stage, size = 120, label }: { kind: PlantKind; stage: Stage; size?: number; label?: string }) {
  const Sp = SPECIES[kind]
  return (
    <svg viewBox="0 0 120 150" width={size} height={size * 1.25} role="img" aria-label={label} overflow="visible">
      <motion.g
        key={stage}
        initial={{ scale: 0.6, opacity: 0, y: 6 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 12, stiffness: 120 }}
        style={{ originX: '50%', originY: '100%', transformBox: 'fill-box' }}
      >
        <g className={stage > 0 ? 'plant-sway' : undefined} style={{ transformOrigin: '60px 140px' }}>
          {stage === 0 && <Seed color={SEED_COLORS[kind]} />}
          {stage === 1 && <Sprout />}
          {stage >= 2 && <Sp s={stage} />}
        </g>
      </motion.g>
    </svg>
  )
}
