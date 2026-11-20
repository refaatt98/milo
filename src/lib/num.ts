/** Converts Arabic-Indic (٠-٩) and Persian (۰-۹) digits and separators to ASCII. */
export function asciiDigits(s: string) {
  return s
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[٫،]/g, '.') // Arabic decimal separator / comma
    .replace(/٬/g, '')
}

/** Parses a number typed with any digits; returns NaN when empty or invalid. */
export function parseNum(s: string) {
  const t = asciiDigits(s).trim()
  return t === '' ? NaN : Number(t)
}
