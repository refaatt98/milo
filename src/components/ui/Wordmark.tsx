export function Wordmark({ big = false }: { big?: boolean }) {
  return (
    <span className={`font-num font-bold italic leading-none tracking-tight ${big ? 'text-[2.4rem]' : 'text-[1.6rem]'}`} dir="ltr">
      milo<span className="font-sans not-italic font-semibold text-sage" style={{ fontSize: '0.62em', letterSpacing: '0.02em' }}>Note</span>
      <span className="text-sage">.</span>
    </span>
  )
}
