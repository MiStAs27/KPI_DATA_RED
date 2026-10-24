import type { KpiRecord, Person } from '../types/kpi'

const basePeople = [
  { id: 'ana', name: 'Ana Martínez', role: 'Atención al cliente', initials: 'AM', color: '#7167e8' },
  { id: 'carlos', name: 'Carlos Rojas', role: 'Operaciones', initials: 'CR', color: '#16a98a' },
  { id: 'lucia', name: 'Lucía Fernández', role: 'Ventas', initials: 'LF', color: '#ef9b4b' },
  { id: 'diego', name: 'Diego Flores', role: 'Soporte', initials: 'DF', color: '#4892d2' },
  { id: 'sofia', name: 'Sofía Vargas', role: 'Atención al cliente', initials: 'SV', color: '#d46c95' },
]
export const people: Person[] = basePeople.map((person, index) => ({ ...person, dailyGoal: 42 + index * 3, monthlyGoal: (42 + index * 3) * 22 }))

// Fechas ISO construidas con componentes locales: no se parsean como UTC.
function isoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
export function makeDemoRecords(): KpiRecord[] {
  const today = new Date(); today.setHours(12, 0, 0, 0)
  const records: KpiRecord[] = []
  const labels = ['Interacciones resueltas', 'Solicitudes gestionadas', 'Tareas completadas']
  for (let p = 0; p < people.length; p++) for (let day = 29; day >= 0; day--) {
    const date = new Date(today); date.setDate(today.getDate() - day)
    const goal = 42 + p * 3
    const wave = Math.sin((day + p * 2) * 0.65) * 9
    const variation = ((day * 7 + p * 13) % 13) - 6
    const activity = Math.max(0, Math.round(goal * (0.83 + wave / 100) + variation))
    records.push({ id: `demo-${people[p].id}-${isoDate(date)}`, source: 'demo', personId: people[p].id, date: isoDate(date), activity, goal, label: labels[p % labels.length], category: ['Atención', 'Operaciones', 'Servicio'][p % 3] })
  }
  return records
}
