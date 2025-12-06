/**
 * Refill urgency calculation and color mapping utility
 * Maps load remaining to color intensity (lighter = less urgent, darker = more urgent)
 */

export interface UrgencyColor {
  color: string
  urgency: number // 0 to 1, where 1 = empty/urgent
  loadPercentage: number
}

/**
 * Green color palette based on urgency levels
 * Light green (full tank) → Dark green (nearly empty)
 */
const URGENCY_COLORS = [
  { urgency: 0.0, color: '#c6f6d5' }, // Very light green (70-100% load)
  { urgency: 0.3, color: '#86efac' }, // Light green (50-70% load)
  { urgency: 0.5, color: '#4ade80' }, // Medium green (30-50% load)
  { urgency: 0.7, color: '#16a34a' }, // Dark green (0-30% load)
]

/**
 * Calculate load remaining before a refill point
 * @param loadBefore - Load liters before reaching refill point
 * @param vehicleCapacity - Total vehicle capacity in liters
 * @returns Urgency value 0-1 where 1 = empty (urgent refill)
 */
export function calculateUrgency(loadBefore: number, vehicleCapacity: number): number {
  if (vehicleCapacity <= 0) return 0
  const loadPercentage = Math.max(0, Math.min(1, loadBefore / vehicleCapacity))
  // Invert: full tank (1.0) → urgency 0, empty tank (0) → urgency 1
  return 1 - loadPercentage
}

/**
 * Get color for a given urgency level using interpolation
 * @param urgency - Urgency value 0-1
 * @returns Hex color string
 */
export function getUrgencyColor(urgency: number): string {
  const clamped = Math.max(0, Math.min(1, urgency))

  // Find the two colors to interpolate between
  for (let i = 0; i < URGENCY_COLORS.length - 1; i++) {
    const current = URGENCY_COLORS[i]
    const next = URGENCY_COLORS[i + 1]

    if (clamped >= current.urgency && clamped <= next.urgency) {
      // Linear interpolation between colors
      const range = next.urgency - current.urgency
      const t = (clamped - current.urgency) / range
      return interpolateColor(current.color, next.color, t)
    }
  }

  // Fallback to last color if urgency > 0.7
  return URGENCY_COLORS[URGENCY_COLORS.length - 1].color
}

/**
 * Linear RGB color interpolation
 */
function interpolateColor(color1: string, color2: string, t: number): string {
  const c1 = hexToRgb(color1)
  const c2 = hexToRgb(color2)

  if (!c1 || !c2) return color1

  const r = Math.round(c1.r + (c2.r - c1.r) * t)
  const g = Math.round(c1.g + (c2.g - c1.g) * t)
  const b = Math.round(c1.b + (c2.b - c1.b) * t)

  return rgbToHex(r, g, b)
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16)
        return hex.length === 1 ? '0' + hex : hex
      })
      .join('')
  )
}

/**
 * Get urgency description for UI display
 */
export function getUrgencyLabel(urgency: number): string {
  if (urgency < 0.3) return 'Low urgency (mostly full)'
  if (urgency < 0.5) return 'Normal refill'
  if (urgency < 0.7) return 'Planned refill'
  return 'Critical refill (nearly empty)'
}
