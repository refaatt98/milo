import { memo, useId } from 'react'
import { useUiMode } from '../../lib/mode'
import './milo.css'

export type MiloMood =
  | 'idle'
  | 'studying'
  | 'focused'
  | 'break'
  | 'happy'
  | 'excited'
  | 'sleepy'
  | 'encouraging'
  | 'champion'

interface Props {
  mood?: MiloMood
  size?: number | string
  cap?: boolean
  className?: string
  title?: string
  /** turn off ambient motion (e.g. many Milos on a screen) */
  still?: boolean
  /** render even in serious mode (e.g. stickers the user placed on a page) */
  force?: boolean
}

const INK = '#27372F'
const SKIN = '#B9D5AE'
const SKIN_SHADE = '#9CC093'
const BELLY = '#E7F0DE'
const LEAF = '#6F9876'
const LEAF_LIGHT = '#8DB592'
const CHEEK = '#F3B8A0'

const BODY =
  'M98 57C128 55 151 74 157 103C163 133 156 165 127 173C110 178 88 178 72 173C46 165 37 140 40 110C43 81 68 59 98 57Z'

/** Arms are drawn twice: a fat ink stroke, then a slimmer skin stroke on top. */
function Arm({ d, className }: { d: string; className?: string }) {
  return (
    <g className={className}>
      <path d={d} stroke={INK} strokeWidth={12.5} strokeLinecap="round" fill="none" />
      <path d={d} stroke={SKIN} strokeWidth={7.5} strokeLinecap="round" fill="none" />
    </g>
  )
}

const ARMS = {
  down: ['M48 126C38 134 36 144 40 152', 'M151 126C161 134 163 144 159 152'],
  hold: ['M50 132C55 148 64 154 76 154', 'M150 132C145 148 136 154 124 154'],
  up: ['M46 120C34 108 30 96 33 84', 'M154 120C166 108 170 96 167 84'],
  wave: ['M48 126C38 134 36 144 40 152', 'M153 120C166 112 172 100 170 88'],
  tea: ['M50 132C56 146 70 152 90 150', 'M150 132C146 146 136 152 120 152'],
}

function Eyes({ mood }: { mood: MiloMood }) {
  const L = 80
  const R = 118
  const Y = 111
  const arc = (x: number, up: boolean) =>
    up ? `M${x - 7} ${Y + 2}Q${x} ${Y - 8} ${x + 7} ${Y + 2}` : `M${x - 7} ${Y - 1}Q${x} ${Y + 6} ${x + 7} ${Y - 1}`
  const strokeEye = (d: string, k: string) => (
    <path key={k} d={d} stroke={INK} strokeWidth={3.4} strokeLinecap="round" fill="none" />
  )
  if (mood === 'happy' || mood === 'excited' || mood === 'champion')
    return <g>{[strokeEye(arc(L, true), 'l'), strokeEye(arc(R, true), 'r')]}</g>
  if (mood === 'break') return <g>{[strokeEye(arc(L, false), 'l'), strokeEye(arc(R, false), 'r')]}</g>
  if (mood === 'sleepy')
    return (
      <g>
        {[L, R].map((x) => (
          <g key={x}>
            <path d={`M${x - 7} ${Y + 1}Q${x} ${Y + 7} ${x + 7} ${Y + 1}`} fill={INK} />
            <path d={`M${x - 8} ${Y + 1}H${x + 8}`} stroke={INK} strokeWidth={3} strokeLinecap="round" />
          </g>
        ))}
      </g>
    )
  const dy = mood === 'focused' || mood === 'studying' ? 3 : 0
  return (
    <g className={mood === 'idle' || mood === 'encouraging' ? 'milo-look' : undefined}>
      {[L, R].map((x) => (
        <g key={x} className="milo-blink">
          <ellipse cx={x} cy={Y + dy} rx={6.6} ry={8.4} fill={INK} />
          <circle cx={x + 2.2} cy={Y + dy - 3.2} r={2.3} fill="#fff" />
          <circle cx={x - 2.4} cy={Y + dy + 3} r={1} fill="#fff" opacity={0.7} />
        </g>
      ))}
    </g>
  )
}

function Mouth({ mood }: { mood: MiloMood }) {
  switch (mood) {
    case 'happy':
    case 'excited':
    case 'champion':
      return (
        <g>
          <path d="M89 126Q99 141 109 126Q99 129 89 126Z" fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          <path d="M94 133Q99 137 104 133Q99 130 94 133Z" fill="#E98E7A" />
        </g>
      )
    case 'sleepy':
      return <ellipse cx={99} cy={130} rx={3.4} ry={4} fill={INK} className="milo-yawn" />
    case 'focused':
      return <path d="M94 129Q99 131 104 129" stroke={INK} strokeWidth={2.8} strokeLinecap="round" fill="none" />
    case 'encouraging':
      return <path d="M90 126Q99 136 108 126" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />
    default:
      return <path d="M92 127Q99 133 106 127" stroke={INK} strokeWidth={2.8} strokeLinecap="round" fill="none" />
  }
}

function Sprout({ lifted }: { lifted: boolean }) {
  return (
    <g className="milo-sprout" transform={lifted ? 'translate(4 -16)' : undefined}>
      <path d="M99 59C98 50 97 43 100 34" stroke={LEAF} strokeWidth={3.2} strokeLinecap="round" fill="none" />
      {/* big leaf */}
      <path
        d="M100 36C92 24 78 22 70 28C76 38 90 42 100 36Z"
        fill={LEAF_LIGHT}
        stroke={INK}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <path d="M98 35C90 31 83 29 76 29" stroke={INK} strokeWidth={1.3} strokeLinecap="round" fill="none" opacity={0.55} />
      {/* small leaf */}
      <path d="M100 38C104 28 113 25 120 28C117 36 108 41 100 38Z" fill={LEAF} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      {/* curly tendril — Milo's signature */}
      <path d="M100 34C103 26 108 22 112 22C115 22 116 25 114 27" stroke={LEAF} strokeWidth={2} strokeLinecap="round" fill="none" />
    </g>
  )
}

function Book() {
  return (
    <g className="milo-book">
      <path d="M100 148L70 141V166L100 172L130 166V141Z" fill="#F8D9C6" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M100 146L73 139V162L100 168Z" fill="#fff" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <path className="milo-page" d="M100 146L127 139V162L100 168Z" fill="#fff" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <path d="M79 147L94 150M79 153L94 156M110 150L121 147M110 156L121 153" stroke="#6F9876" strokeWidth={1.6} strokeLinecap="round" />
    </g>
  )
}

function Glasses() {
  return (
    <g fill="none" stroke={INK} strokeWidth={2.3}>
      <circle cx={80} cy={114} r={11.5} fill="#DCEEF4" fillOpacity={0.35} />
      <circle cx={118} cy={114} r={11.5} fill="#DCEEF4" fillOpacity={0.35} />
      <path d="M91.5 112Q99 108 106.5 112" strokeLinecap="round" />
      <path d="M68.5 112L58 108M129.5 112L140 108" strokeLinecap="round" />
    </g>
  )
}

function Tea() {
  return (
    <g>
      <g className="milo-steam" stroke="#9FB8A8" strokeWidth={2} strokeLinecap="round" fill="none">
        <path d="M100 132C96 126 104 122 100 116" />
        <path d="M110 134C106 128 114 124 110 118" />
      </g>
      <path d="M118 146C122 146 126 149 124 154C122 158 118 158 116 157" stroke={INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <path d="M90 140H120L117 160C116 163 113 165 110 165H100C97 165 94 163 93 160Z" fill="#fff" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M92 146H118" stroke="#F9E9A7" strokeWidth={3} />
      <path d="M102 140L104 132" stroke={INK} strokeWidth={1.4} />
      <rect x={101} y={127} width={6} height={6} rx={1.4} fill="#F8D9C6" stroke={INK} strokeWidth={1.4} />
    </g>
  )
}

function Cap() {
  return (
    <g className="milo-cap">
      <path d="M76 72C80 64 120 64 124 72L122 80C112 76 88 76 78 80Z" fill={INK} />
      <path d="M62 64L100 50L138 64L100 78Z" fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <path d="M100 64L132 68V84" stroke="#F9E9A7" strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <path d="M128 84L132 93L136 84Z" fill="#F9E9A7" stroke="#E2C766" strokeWidth={1} />
      <circle cx={100} cy={64} r={2.6} fill="#F9E9A7" />
    </g>
  )
}

function Wreath() {
  const leaves = [
    [62, 78, -40],
    [74, 66, -25],
    [88, 59, -10],
    [112, 59, 10],
    [126, 66, 25],
    [138, 78, 40],
  ]
  return (
    <g>
      {leaves.map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx={8} ry={4.2} transform={`rotate(${r} ${x} ${y})`} fill={i % 2 ? LEAF : LEAF_LIGHT} stroke={INK} strokeWidth={1.6} />
      ))}
      <circle cx={100} cy={57} r={5} fill="#F8D9C6" stroke={INK} strokeWidth={1.6} />
      <circle cx={100} cy={57} r={1.8} fill="#F9E9A7" />
    </g>
  )
}

function Sparkles({ big }: { big?: boolean }) {
  const star = (x: number, y: number, s: number, c: string, d: number) => (
    <path
      key={`${x}${y}`}
      className="milo-twinkle"
      style={{ animationDelay: `${d}s` }}
      d={`M${x} ${y - s}Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y}Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s}Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y}Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s}Z`}
      fill={c}
      stroke={INK}
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  )
  return (
    <g>
      {star(28, 70, 8, '#F9E9A7', 0)}
      {star(172, 60, 10, '#F8D9C6', 0.4)}
      {star(180, 130, 6, '#EAE3F6', 0.8)}
      {star(20, 132, 6, '#DCEEF4', 1.1)}
      {big && star(150, 30, 7, '#F9E9A7', 0.6)}
      {big && star(48, 30, 6, '#E4EEDC', 1.3)}
    </g>
  )
}

function Zzz() {
  return (
    <g fill={INK} fontFamily="Fraunces, serif" fontStyle="italic" fontWeight={700}>
      <text x={146} y={70} fontSize={18} className="milo-z" style={{ animationDelay: '0s' }}>z</text>
      <text x={158} y={54} fontSize={14} className="milo-z" style={{ animationDelay: '0.9s' }}>z</text>
      <text x={167} y={40} fontSize={11} className="milo-z" style={{ animationDelay: '1.8s' }}>z</text>
    </g>
  )
}

function Heart() {
  return (
    <path
      className="milo-twinkle"
      d="M176 70C176 64 184 62 186 68C188 62 196 64 196 70C196 77 186 82 186 82C186 82 176 77 176 70Z"
      fill="#F8D9C6"
      stroke={INK}
      strokeWidth={1.8}
    />
  )
}

function MiloBase({ mood = 'idle', size = 160, cap = false, className = '', title, still = false, force = false }: Props) {
  const clip = useId().replace(/:/g, '')
  const uiMode = useUiMode()
  if (uiMode === 'serious' && !force) return null
  const arms =
    mood === 'studying' || mood === 'focused'
      ? ARMS.hold
      : mood === 'break'
        ? ARMS.tea
        : mood === 'happy' || mood === 'excited' || mood === 'champion'
          ? ARMS.up
          : mood === 'encouraging'
            ? ARMS.wave
            : ARMS.down
  const motion =
    mood === 'excited' || mood === 'champion'
      ? 'milo-bounce'
      : mood === 'happy'
        ? 'milo-wiggle'
        : mood === 'sleepy'
          ? 'milo-sway'
          : mood === 'focused'
            ? 'milo-calm'
            : 'milo-breathe'
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={title ?? 'ميلو'}
      className={`milo ${still ? 'milo-still' : ''} ${className}`}
      overflow="visible"
    >
      <title>{title ?? 'ميلو'}</title>
      <defs>
        <clipPath id={`b${clip}`}>
          <path d={BODY} />
        </clipPath>
      </defs>
      <ellipse cx={100} cy={184} rx={46} ry={6} fill={INK} opacity={0.1} className={mood === 'excited' || mood === 'champion' ? 'milo-shadow' : undefined} />
      {(mood === 'happy' || mood === 'excited' || mood === 'champion') && <Sparkles big={mood !== 'happy'} />}
      {mood === 'encouraging' && <Heart />}
      <g className={motion}>
        {/* feet */}
        <ellipse cx={80} cy={175} rx={13} ry={7} fill={SKIN_SHADE} stroke={INK} strokeWidth={2.4} />
        <ellipse cx={120} cy={175} rx={13} ry={7} fill={SKIN_SHADE} stroke={INK} strokeWidth={2.4} />
        <Sprout lifted={cap} />
        {/* body */}
        <path d={BODY} fill={SKIN} />
        <g clipPath={`url(#b${clip})`}>
          <ellipse cx={100} cy={160} rx={46} ry={34} fill={BELLY} />
          <path d="M150 90C162 120 158 160 120 178L170 180L172 80Z" fill={SKIN_SHADE} opacity={0.55} />
          {/* freckles */}
          <circle cx={70} cy={84} r={2.2} fill={LEAF} opacity={0.55} />
          <circle cx={78} cy={76} r={1.6} fill={LEAF} opacity={0.55} />
          <circle cx={64} cy={93} r={1.4} fill={LEAF} opacity={0.55} />
        </g>
        <path d={BODY} fill="none" stroke={INK} strokeWidth={2.8} strokeLinejoin="round" />
        {/* cheeks */}
        <ellipse cx={66} cy={127} rx={8} ry={5} fill={CHEEK} opacity={0.75} />
        <ellipse cx={132} cy={127} rx={8} ry={5} fill={CHEEK} opacity={0.75} />
        {mood === 'encouraging' && (
          <g stroke={INK} strokeWidth={2.4} strokeLinecap="round">
            <path d="M73 97L86 95" />
            <path d="M112 95L125 97" />
          </g>
        )}
        <Eyes mood={mood} />
        <Mouth mood={mood} />
        {(mood === 'focused' || mood === 'studying') && <Glasses />}
        {(mood === 'studying' || mood === 'focused') && <Book />}
        {mood === 'break' && <Tea />}
        <Arm d={arms[0]} className={mood === 'excited' || mood === 'champion' ? 'milo-cheer-l' : undefined} />
        <Arm d={arms[1]} className={mood === 'encouraging' ? 'milo-wave' : mood === 'excited' || mood === 'champion' ? 'milo-cheer-r' : undefined} />
        {cap && <Cap />}
        {mood === 'champion' && !cap && <Wreath />}
      </g>
      {mood === 'sleepy' && <Zzz />}
    </svg>
  )
}

export const Milo = memo(MiloBase)
export default Milo
