import { describe, it, expect } from 'vitest'
import {
  formatMinutesToTimeInput,
  parseTimeInput,
  calcFilamentLineCost,
  calcTotalFilamentCost,
  calcEnergyCost,
  calcTotalCost,
  calcSuggestedPrice,
  calcProfit,
  rollPricePerKg,
} from './calc'

describe('formatMinutesToTimeInput', () => {
  it('formats hours and minutes', () => expect(formatMinutesToTimeInput(135)).toBe('2h 15m'))
  it('formats hours only when minutes are 0', () => expect(formatMinutesToTimeInput(120)).toBe('2h'))
  it('formats minutes only when hours are 0', () => expect(formatMinutesToTimeInput(45)).toBe('45m'))
  it('handles 0 minutes', () => expect(formatMinutesToTimeInput(0)).toBe('0m'))
})

describe('parseTimeInput', () => {
  it('parses "1h30m"', () => expect(parseTimeInput('1h30m')).toBeCloseTo(1.5))
  it('parses "1h 30m" with space', () => expect(parseTimeInput('1h 30m')).toBeCloseTo(1.5))
  it('parses "90min"', () => expect(parseTimeInput('90min')).toBeCloseTo(1.5))
  it('parses "90m"', () => expect(parseTimeInput('90m')).toBeCloseTo(1.5))
  it('parses "1.5h"', () => expect(parseTimeInput('1.5h')).toBeCloseTo(1.5))
  it('parses "2h"', () => expect(parseTimeInput('2h')).toBeCloseTo(2))
  it('returns null for empty string', () => expect(parseTimeInput('')).toBeNull())
  it('returns null for bare number (ambiguous)', () => expect(parseTimeInput('90')).toBeNull())
  it('returns null for zero hours', () => expect(parseTimeInput('0h')).toBeNull())
  it('returns null for nonsense', () => expect(parseTimeInput('abc')).toBeNull())
  it('is case insensitive', () => expect(parseTimeInput('1H30M')).toBeCloseTo(1.5))
})

describe('calcFilamentLineCost', () => {
  it('calculates cost: 100g at R$80/kg = R$8', () => {
    expect(calcFilamentLineCost({ gramsUsed: 100, pricePerKg: 80 })).toBeCloseTo(8)
  })
  it('calculates cost: 47g at R$95/kg', () => {
    expect(calcFilamentLineCost({ gramsUsed: 47, pricePerKg: 95 })).toBeCloseTo(4.465)
  })
})

describe('calcTotalFilamentCost', () => {
  it('sums multiple lines', () => {
    const lines = [
      { gramsUsed: 35, pricePerKg: 80 },   // 2.80
      { gramsUsed: 12, pricePerKg: 100 },  // 1.20
    ]
    expect(calcTotalFilamentCost(lines)).toBeCloseTo(4.0)
  })
  it('returns 0 for empty array', () => {
    expect(calcTotalFilamentCost([])).toBe(0)
  })
  it('returns cost of single line', () => {
    expect(calcTotalFilamentCost([{ gramsUsed: 100, pricePerKg: 80 }])).toBeCloseTo(8)
  })
})

describe('calcEnergyCost', () => {
  it('calculates: 2h × 250W × R$0.75/kWh = R$0.375', () => {
    expect(calcEnergyCost({ printHours: 2, printerWattage: 250, energyCostPerKwh: 0.75 }))
      .toBeCloseTo(0.375)
  })
  it('handles zero wattage', () => {
    expect(calcEnergyCost({ printHours: 2, printerWattage: 0, energyCostPerKwh: 0.75 })).toBe(0)
  })
})

describe('calcTotalCost', () => {
  it('sums filament and energy costs', () => {
    expect(calcTotalCost({ filamentCost: 5, energyCost: 1.5 })).toBeCloseTo(6.5)
  })
  it('works when energy is 0', () => {
    expect(calcTotalCost({ filamentCost: 5, energyCost: 0 })).toBeCloseTo(5)
  })
})

describe('calcSuggestedPrice', () => {
  it('applies 30% markup to R$10 = R$13', () => {
    expect(calcSuggestedPrice({ totalCost: 10, markupPercent: 30 })).toBeCloseTo(13)
  })
  it('applies 0% markup returns same cost', () => {
    expect(calcSuggestedPrice({ totalCost: 10, markupPercent: 0 })).toBeCloseTo(10)
  })
  it('applies 100% markup doubles the cost', () => {
    expect(calcSuggestedPrice({ totalCost: 10, markupPercent: 100 })).toBeCloseTo(20)
  })
})

describe('calcProfit', () => {
  it('calculates profit: R$13 - R$10 = R$3', () => {
    expect(calcProfit({ suggestedPrice: 13, totalCost: 10 })).toBeCloseTo(3)
  })
  it('profit is 0 when no markup', () => {
    expect(calcProfit({ suggestedPrice: 10, totalCost: 10 })).toBeCloseTo(0)
  })
})

describe('rollPricePerKg', () => {
  it('derives R$80/kg from 1kg roll at R$80', () => {
    expect(rollPricePerKg({ cost: 80, initialWeightG: 1000 })).toBeCloseTo(80)
  })
  it('derives R$50/kg from 500g roll at R$25', () => {
    expect(rollPricePerKg({ cost: 25, initialWeightG: 500 })).toBeCloseTo(50)
  })
  it('returns null when cost is null', () => {
    expect(rollPricePerKg({ cost: null, initialWeightG: 1000 })).toBeNull()
  })
  it('returns null when initialWeightG is 0 (avoid division by zero)', () => {
    expect(rollPricePerKg({ cost: 80, initialWeightG: 0 })).toBeNull()
  })
})
