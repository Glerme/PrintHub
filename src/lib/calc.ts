export function formatMinutesToTimeInput(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** Returns duration in decimal hours, or null if input is invalid or non-positive. */
export function parseTimeInput(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const hmMatch = trimmed.match(/^(\d+(?:\.\d+)?)h\s*(\d+(?:\.\d+)?)m(?:in)?$/i)
  if (hmMatch) {
    const result = parseFloat(hmMatch[1]) + parseFloat(hmMatch[2]) / 60
    return result > 0 ? result : null
  }

  const minMatch = trimmed.match(/^(\d+(?:\.\d+)?)m(?:in)?$/i)
  if (minMatch) {
    const result = parseFloat(minMatch[1]) / 60
    return result > 0 ? result : null
  }

  const hMatch = trimmed.match(/^(\d+(?:\.\d+)?)h$/i)
  if (hMatch) {
    const result = parseFloat(hMatch[1])
    return result > 0 ? result : null
  }

  return null
}

/** Inputs must be non-negative. */
export function calcFilamentLineCost({
  gramsUsed,
  pricePerKg,
}: {
  gramsUsed: number
  pricePerKg: number
}): number {
  return gramsUsed * (pricePerKg / 1000)
}

export function calcTotalFilamentCost(
  lines: { gramsUsed: number; pricePerKg: number }[]
): number {
  return lines.reduce((sum, l) => sum + calcFilamentLineCost(l), 0)
}

/** Inputs must be non-negative. */
export function calcEnergyCost({
  printHours,
  printerWattage,
  energyCostPerKwh,
}: {
  printHours: number
  printerWattage: number
  energyCostPerKwh: number
}): number {
  return printHours * (printerWattage / 1000) * energyCostPerKwh
}

export function calcTotalCost({
  filamentCost,
  energyCost,
}: {
  filamentCost: number
  energyCost: number
}): number {
  return filamentCost + energyCost
}

export function calcSuggestedPrice({
  totalCost,
  markupPercent,
}: {
  totalCost: number
  markupPercent: number
}): number {
  return totalCost * (1 + markupPercent / 100)
}

export function calcProfit({
  suggestedPrice,
  totalCost,
}: {
  suggestedPrice: number
  totalCost: number
}): number {
  return suggestedPrice - totalCost
}

export function rollPricePerKg(roll: {
  cost: number | null
  initialWeightG: number
}): number | null {
  if (roll.cost === null || roll.initialWeightG === 0) return null
  return (roll.cost / roll.initialWeightG) * 1000
}
