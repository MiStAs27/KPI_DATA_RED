import type { KpiRecord } from '../types/kpi'

export function percent(activity: number, goal: number): number | null {
  return goal === 0 ? null : (activity / goal) * 100
}
export function totals(rows: KpiRecord[]) {
  const activity = rows.reduce((sum, row) => sum + row.activity, 0)
  const goal = rows.reduce((sum, row) => sum + row.goal, 0)
  return { activity, goal, attainment: percent(activity, goal) }
}
