export function minutesToHHMM(mins: number) {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}
