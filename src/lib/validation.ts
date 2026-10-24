export function normalized(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return y >= 1900 && y <= 9999 && date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

export function requireNumber(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1e12) throw new Error(`${field}: ingresa un número entre 0 y 1.000.000.000.000.`)
}

export function requireText(value: string, field: string, max = 120) {
  if (!value.trim() || value.trim().length > max) throw new Error(`${field}: ingresa entre 1 y ${max} caracteres.`)
}

export function recordKey(row: { personId: string; date: string; label: string; category: string }) {
  return JSON.stringify([row.personId, row.date, normalized(row.label), normalized(row.category)])
}

export function localIso(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
