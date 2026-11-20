import type { ReactElement } from 'react'
import type { Destination } from '../../lib/db'

const INK = '#27372F'
const sw = { stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

function Ground({ c = '#E4EEDC' }: { c?: string }) {
  return <path d="M6 88C24 80 44 82 60 84C78 86 98 80 114 88C100 96 22 96 6 88Z" fill={c} {...sw} strokeWidth={1.6} />
}

function Desk() {
  return (
    <g>
      <Ground c="#F8D9C6" />
      <path d="M22 58H98V64H22Z" fill="#E7C9A6" {...sw} />
      <path d="M28 64V88M92 64V88" {...sw} strokeWidth={3} />
      <path d="M40 58L44 46H62L66 58Z" fill="#fff" {...sw} />
      <path d="M53 46V58" {...sw} strokeWidth={1.4} />
      <path d="M82 58V34" {...sw} />
      <path d="M72 34C72 26 92 26 92 34Z" fill="#F9E9A7" {...sw} />
      <path d="M77 40L70 52M87 40L94 52" stroke="#F9E9A7" strokeWidth={3} strokeLinecap="round" opacity={0.9} />
      <rect x={30} y={52} width={10} height={6} rx={1} fill="#DCEEF4" {...sw} strokeWidth={1.4} />
    </g>
  )
}

function SunnyGarden() {
  return (
    <g>
      <circle cx={88} cy={24} r={11} fill="#F9E9A7" {...sw} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <path key={a} d="M88 8V4" {...sw} strokeWidth={1.6} transform={`rotate(${a} 88 24)`} />
      ))}
      <Ground />
      {[
        [30, 60, '#F8D9C6'],
        [50, 52, '#EAE3F6'],
        [70, 62, '#F9E9A7'],
      ].map(([x, y, c], i) => (
        <g key={i}>
          <path d={`M${x} 86V${y}`} stroke="#6F9876" strokeWidth={2.4} strokeLinecap="round" />
          <path d={`M${x} ${+y + 14}C${+x - 10} ${+y + 8} ${+x - 10} ${+y + 18} ${x} ${+y + 18}`} fill="#8DB592" {...sw} strokeWidth={1.4} />
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={x} cy={+y - 5} r={4} fill={c as string} {...sw} strokeWidth={1.3} transform={`rotate(${a} ${x} ${y})`} />
          ))}
          <circle cx={x} cy={y} r={3} fill="#F9E9A7" {...sw} strokeWidth={1.2} />
        </g>
      ))}
    </g>
  )
}

function Library() {
  return (
    <g>
      <Ground />
      <path d="M28 86V44H92V86Z" fill="#EAE3F6" {...sw} />
      <path d="M22 46L60 20L98 46Z" fill="#F8D9C6" {...sw} />
      <path d="M52 86V64C52 58 68 58 68 64V86Z" fill="#fff" {...sw} />
      <rect x={34} y={52} width={14} height={12} rx={2} fill="#fff" {...sw} strokeWidth={1.6} />
      <rect x={72} y={52} width={14} height={12} rx={2} fill="#fff" {...sw} strokeWidth={1.6} />
      <path d="M37 64V55M41 64V56M45 64V54" stroke="#6F9876" strokeWidth={2.4} />
      <path d="M75 64V56M79 64V54M83 64V55" stroke="#F4B9A0" strokeWidth={2.4} />
      <circle cx={60} cy={36} r={4} fill="#fff" {...sw} strokeWidth={1.4} />
    </g>
  )
}

function Hill() {
  return (
    <g>
      <path d="M4 88C20 50 44 34 64 34C86 34 104 56 116 88Z" fill="#E4EEDC" {...sw} />
      <path d="M44 40H76V46H44Z" fill="#DCEEF4" {...sw} strokeWidth={1.6} transform="rotate(-4 60 43)" />
      <path d="M46 34H74V40H46Z" fill="#F9E9A7" {...sw} strokeWidth={1.6} transform="rotate(3 60 37)" />
      <path d="M48 28H72V34H48Z" fill="#F8D9C6" {...sw} strokeWidth={1.6} />
      <path d="M60 28V8" {...sw} />
      <path d="M60 8L76 13L60 18Z" fill="#6F9876" {...sw} strokeWidth={1.6} />
      <path d="M26 72l4-4M90 70l3-5M74 80l3-3" stroke="#6F9876" strokeWidth={2} strokeLinecap="round" />
    </g>
  )
}

function Cottage() {
  return (
    <g>
      <Ground />
      <path d="M80 30V18H88V36" fill="#F8D9C6" {...sw} />
      <path className="map-smoke" d="M84 14C80 10 88 6 84 2" stroke="#B8C4BC" strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M30 86V52H90V86Z" fill="#FAF3E3" {...sw} />
      <path d="M22 54C34 34 50 26 60 26C70 26 86 34 98 54Z" fill="#8DB592" {...sw} />
      <path d="M30 46C40 44 50 40 56 34" stroke="#6F9876" strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M52 86V68C52 62 66 62 66 68V86Z" fill="#F9E9A7" {...sw} />
      <circle cx={40} cy={66} r={6} fill="#DCEEF4" {...sw} strokeWidth={1.6} />
      <circle cx={80} cy={66} r={6} fill="#DCEEF4" {...sw} strokeWidth={1.6} />
    </g>
  )
}

function Station() {
  return (
    <g>
      <Ground c="#DCEEF4" />
      <path d="M34 86L40 60M86 86L80 60" {...sw} strokeWidth={3} />
      <rect x={26} y={18} width={68} height={46} rx={6} fill="#fff" {...sw} />
      <path d="M34 30H62M34 38H70M34 46H56" stroke="#8A978F" strokeWidth={2} strokeLinecap="round" />
      <path d="M68 46L72 50L80 40" stroke="#6F9876" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={80} cy={24} r={10} fill="#F9E9A7" {...sw} strokeWidth={1.6} />
      <path d="M80 18V24L84 26" {...sw} strokeWidth={1.6} fill="none" />
    </g>
  )
}

function Workshop() {
  return (
    <g>
      <Ground c="#F9E9A7" />
      <path d="M26 86V48H94V86Z" fill="#F8D9C6" {...sw} />
      <path d="M20 50L32 30H88L100 50Z" fill="#EAE3F6" {...sw} />
      <path d="M40 86V62H80V86" fill="#fff" {...sw} />
      <path d="M48 70H72M48 78H66" stroke="#8A978F" strokeWidth={2} strokeLinecap="round" />
      <g transform="translate(60 40)">
        <circle r={7} fill="#F9E9A7" {...sw} strokeWidth={1.6} />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <rect key={a} x={-2} y={-11} width={4} height={5} rx={1} fill="#F9E9A7" {...sw} strokeWidth={1.2} transform={`rotate(${a})`} />
        ))}
        <circle r={2.4} fill="#fff" {...sw} strokeWidth={1.2} />
      </g>
      <path d="M96 80L108 56" stroke="#F9E9A7" strokeWidth={6} strokeLinecap="round" />
      <path d="M96 80L108 56" {...sw} strokeWidth={1.4} fill="none" />
    </g>
  )
}

function Checkpoint() {
  return (
    <g>
      <Ground c="#EAE3F6" />
      <path d="M24 86L48 50L72 86Z" fill="#F8D9C6" {...sw} />
      <path d="M48 50L44 86M48 50L54 86" {...sw} strokeWidth={1.4} />
      <path d="M88 86V14" {...sw} strokeWidth={3} />
      <path d="M88 14H110L104 24L110 34H88Z" fill="#fff" {...sw} />
      <path d="M92 18h4v4h-4zM100 18h4v4h-4zM96 22h4v4h-4zM92 26h4v4h-4zM100 26h4v4h-4z" fill={INK} />
    </g>
  )
}

function Celebration() {
  return (
    <g>
      <Ground />
      <path d="M26 86V56C26 30 94 30 94 56V86" fill="none" stroke="#8DB592" strokeWidth={8} strokeLinecap="round" />
      <path d="M26 86V56C26 30 94 30 94 56V86" fill="none" {...sw} strokeWidth={1.4} />
      {[
        [26, 64],
        [30, 44],
        [44, 32],
        [60, 28],
        [76, 32],
        [90, 44],
        [94, 64],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={4.5} fill={['#F8D9C6', '#F9E9A7', '#EAE3F6', '#FBE3EA'][i % 4]} {...sw} strokeWidth={1.3} />
      ))}
      <path d="M60 60L63 68L71 68L65 73L67 81L60 76L53 81L55 73L49 68L57 68Z" fill="#F9E9A7" {...sw} strokeWidth={1.6} />
      <path d="M104 50C104 40 114 40 114 50C114 56 109 60 109 60C109 60 104 56 104 50Z" fill="#F8D9C6" {...sw} strokeWidth={1.4} />
      <path d="M109 60Q106 72 110 84" {...sw} strokeWidth={1} fill="none" />
    </g>
  )
}

const MAP: Record<Destination, () => ReactElement> = {
  desk: Desk,
  garden: SunnyGarden,
  library: Library,
  hill: Hill,
  cottage: Cottage,
  station: Station,
  workshop: Workshop,
  checkpoint: Checkpoint,
  celebration: Celebration,
}

export const DESTINATION_NAMES: Record<Destination, string> = {
  desk: 'طاولة القراءة',
  garden: 'الجنينة المشمسة',
  library: 'المكتبة الصغيرة',
  hill: 'تلة الدفاتر',
  cottage: 'كوخ الدراسة',
  station: 'محطة الامتحانات',
  workshop: 'ورشة المراجعة',
  checkpoint: 'نقطة التحدي الأخيرة',
  celebration: 'جنينة الاحتفال',
}

export function DestinationArt({ kind, size = 110, dim = false }: { kind: Destination; size?: number; dim?: boolean }) {
  const C = MAP[kind]
  return (
    <svg viewBox="0 0 120 100" width={size} height={size * (100 / 120)} aria-hidden style={{ filter: dim ? 'saturate(0.55)' : undefined, opacity: dim ? 0.85 : 1 }}>
      <C />
    </svg>
  )
}
