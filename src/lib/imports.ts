import type { ImportRow, Person } from '../types/kpi'
import { normalized, requireNumber, requireText, validDate } from './validation'

export type Cell = string | number | boolean | Date | null
export const fields = ['date', 'personName', 'activity', 'goal', 'label', 'category'] as const
export type Field = typeof fields[number]
export type ColumnMap = Record<Field, number>
export const fieldLabels: Record<Field, string> = { date: 'Fecha', personName: 'Colaborador', activity: 'Actividad', goal: 'Meta', label: 'Indicador (opcional)', category: 'Categoría (opcional)' }
const aliases: Record<Field, string[]> = {
  date: ['fecha', 'date', 'dia'], personName: ['persona', 'colaborador', 'nombre', 'empleado', 'person', 'person name'],
  activity: ['actividad', 'activity', 'cantidad', 'realizado', 'total'], goal: ['meta', 'goal', 'objetivo'],
  label: ['indicador', 'indicador de ejemplo', 'label', 'descripcion'], category: ['categoria', 'category', 'departamento'],
}

export function guessColumns(headers: Cell[]): ColumnMap {
  return Object.fromEntries(fields.map(field => [field, headers.findIndex(h => aliases[field].includes(normalized(String(h ?? ''))))])) as ColumnMap
}

export function parseCsv(text: string): Cell[][] {
  text = text.replace(/^\uFEFF/, '')
  const firstLine = text.split(/\r?\n/)[0]
  // Ignore delimiters inside quoted header cells.
  const counts = [',', ';', '\t'].map(delimiter => {
    let quoted = false; let count = 0
    for (const char of firstLine) { if (char === '"') quoted = !quoted; if (!quoted && char === delimiter) count++ }
    return { delimiter, count }
  })
  const delimiter = counts.sort((a, b) => b.count - a.count)[0].delimiter
  const rows: Cell[][] = []; let row: string[] = []; let cell = ''; let quoted = false; let closed = false
  const finishCell = () => { row.push(cell.trim()); cell = ''; closed = false }
  const finishRow = () => { finishCell(); rows.push(row); row = [] }
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (char === '"') { quoted = false; closed = true }
      else cell += char
    } else if (char === '"') {
      if (cell.trim() || closed) throw new Error('CSV inválido: comillas dentro de un campo sin escapar.')
      cell = ''; quoted = true
    } else if (char === delimiter) finishCell()
    else if (char === '\n' || char === '\r') { finishRow(); if (char === '\r' && text[i + 1] === '\n') i++ }
    else if (closed && char.trim()) throw new Error('CSV inválido: hay texto después de cerrar un campo entre comillas.')
    else cell += char
  }
  if (quoted) throw new Error('CSV inválido: faltan comillas de cierre.')
  if (cell || row.length || closed) finishRow()
  return rows
}

export function parseImportDate(cell: Cell | undefined) {
  if (cell instanceof Date && Number.isFinite(cell.getTime())) {
    // Excel dates are calendar dates decoded as UTC by read-excel-file.
    return `${cell.getUTCFullYear()}-${String(cell.getUTCMonth() + 1).padStart(2, '0')}-${String(cell.getUTCDate()).padStart(2, '0')}`
  }
  const value = String(cell ?? '').trim()
  const local = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value)
  const iso = local ? `${local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}` : value
  if (!validDate(iso)) throw new Error('Fecha inválida. Usa AAAA-MM-DD o DD/MM/AAAA; en Excel, una celda de fecha.')
  return iso
}

export function parseImportNumber(cell: Cell | undefined, field: string) {
  if (typeof cell === 'number') { requireNumber(cell, field); return cell }
  let text = String(cell ?? '').trim()
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(text)) text = text.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(,\d{3})+\.\d+$/.test(text)) text = text.replace(/,/g, '')
  else if (/^\d+(,\d+)?$/.test(text)) text = text.replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error(`${field}: se requiere un número positivo o cero. No uses separadores de miles sin decimales.`)
  const value = Number(text); requireNumber(value, field); return value
}

export function prepareImport(table: Cell[][], mapping: ColumnMap, people: Person[]) {
  const errors: string[] = []; const rows: ImportRow[] = []; const seen = new Set<string>()
  const selected = fields.filter(f => mapping[f] >= 0).map(f => mapping[f])
  if (new Set(selected).size !== selected.length) return { rows, errors: ['Asigna una columna diferente a cada campo.'], newPeople: [], duplicates: 0 }
  if (fields.slice(0, 4).some(f => mapping[f] < 0)) return { rows, errors: ['Asigna Fecha, Colaborador, Actividad y Meta antes de importar.'], newPeople: [], duplicates: 0 }
  if (table.length > 10001) return { rows, errors: ['El archivo supera las 10.000 filas. Divídelo en archivos más pequeños.'], newPeople: [], duplicates: 0 }
  table.slice(1).forEach((cells, index) => {
    if (cells.every(c => c === null || String(c).trim() === '')) return
    try {
      if (cells.length > table[0].length && cells.slice(table[0].length).some(c => c !== null && String(c).trim())) throw new Error('Hay más columnas que encabezados. Revisa el separador y las comillas del CSV.')
      const personName = String(cells[mapping.personName] ?? '').trim()
      requireText(personName, 'Colaborador')
      const row: ImportRow = { line: index + 2, personName, date: parseImportDate(cells[mapping.date]), activity: parseImportNumber(cells[mapping.activity], 'Actividad'), goal: parseImportNumber(cells[mapping.goal], 'Meta'), label: mapping.label < 0 ? 'Actividad registrada' : String(cells[mapping.label] ?? '').trim(), category: mapping.category < 0 ? 'General' : String(cells[mapping.category] ?? '').trim() }
      requireText(row.label, 'Indicador'); requireText(row.category, 'Categoría')
      const key = JSON.stringify([normalized(row.personName), row.date, normalized(row.label), normalized(row.category)])
      if (seen.has(key)) throw new Error('Registro duplicado de persona, fecha, indicador y categoría dentro del archivo.')
      seen.add(key); rows.push(row)
    } catch (e) { errors.push(`Fila ${index + 2}: ${e instanceof Error ? e.message : 'Dato inválido.'}`) }
  })
  const known = new Set(people.map(p => normalized(p.name)))
  const names = new Map(rows.filter(r => !known.has(normalized(r.personName))).map(r => [normalized(r.personName), r.personName]))
  if (!rows.length && !errors.length) errors.push('El archivo no contiene registros.')
  return { rows, errors, newPeople: [...names.values()] }
}

export async function readImportFile(file: File): Promise<Cell[][]> {
  if (file.size > 5 * 1024 * 1024) throw new Error('El archivo supera el límite de 5 MB.')
  let table: Cell[][]
  if (/\.csv$/i.test(file.name)) table = parseCsv(await file.text())
  else if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/browser')
    const cells = await readSheet(file)
    // The library's Date type declaration uses DateConstructor; validate actual
    // runtime values rather than casting that declaration into our domain type.
    table = cells.map(row => row.map((cell): Cell => {
      if (cell === null || typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean' || cell instanceof Date) return cell
      throw new Error('La planilla contiene una celda no compatible.')
    }))
  } else throw new Error('Selecciona un archivo CSV o Excel .xlsx. Convierte los archivos .xls a .xlsx antes de importarlos.')
  const first = table.findIndex(row => row.some(c => c !== null && String(c).trim()))
  if (first < 0) throw new Error('El archivo está vacío.')
  return table.slice(first)
}
