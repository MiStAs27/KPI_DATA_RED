import type { KpiRecord, Person } from '../types/kpi'
import { totals } from './indicators'

export function dailyTotals(rows: KpiRecord[]) {
  const days = new Map<string, { date: string; activity: number; goal: number }>()
  for (const row of rows) {
    const day = days.get(row.date) ?? { date: row.date, activity: 0, goal: 0 }
    day.activity += row.activity; day.goal += row.goal; days.set(row.date, day)
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function teamRanking(people: Person[], rows: KpiRecord[]) {
  return people.map(person => {
    const records = rows.filter(r => r.personId === person.id)
    return { person, count: records.length, ...totals(records) }
  }).sort((a, b) => (b.attainment ?? -1) - (a.attainment ?? -1) || b.activity - a.activity)
}

export function performance(value: number | null) {
  return value === null ? { className: 'none', label: 'Sin meta' } : value >= 100 ? { className: 'success', label: 'Meta alcanzada' } : value >= 80 ? { className: 'warning', label: 'Próximo a meta' } : { className: 'danger', label: 'Bajo la meta' }
}

export function csvCell(value: string | number) {
  const text = String(value)
  // Keep spreadsheet programs from evaluating imported names/labels as formulas.
  const safe = typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

export function downloadFile(content: string, name: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a'); link.href = url; link.download = name
  document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
