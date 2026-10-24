import type { ImportRow, KpiData, KpiRecord, KpiRepository, PersonInput, RecordInput } from '../types/kpi'
import { normalized, recordKey, requireNumber, requireText, validDate } from '../lib/validation'
import { makeDemoRecords, people as demoPeople } from './demoRepository'

export const STORAGE_KEY = 'panel-kpi:data:v1'
const emptyData = (): KpiData => ({ version: 1, people: [], records: [], updatedAt: null })
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>

function validatePerson(person: PersonInput) {
  requireText(person.name, 'Nombre'); requireText(person.role, 'Rol')
  if (!/^#[0-9a-f]{6}$/i.test(person.color)) throw new Error('El color no es válido.')
  requireNumber(person.dailyGoal, 'Meta diaria'); requireNumber(person.monthlyGoal, 'Meta mensual')
}

function validateRecord(row: RecordInput, data: KpiData) {
  if (!data.people.some(p => p.id === row.personId)) throw new Error('Selecciona una persona del equipo.')
  if (!validDate(row.date)) throw new Error('La fecha no es válida.')
  requireText(row.label, 'Indicador'); requireText(row.category, 'Categoría')
  requireNumber(row.activity, 'Actividad'); requireNumber(row.goal, 'Meta')
}

// Every mutation reads the latest saved snapshot and writes once. A failed write
// never updates the UI as if the changes had been saved successfully.
export class LocalKpiRepository implements KpiRepository {
  constructor(private providedStorage?: StoragePort) {}
  private get storage(): StoragePort { return this.providedStorage ?? window.localStorage }

  async getData(): Promise<KpiData> {
    let raw: string | null
    try { raw = this.storage.getItem(STORAGE_KEY) } catch { throw new Error('El navegador bloqueó el almacenamiento local. Habilítalo para usar el panel.') }
    if (raw === null) return emptyData()
    try {
      const data: KpiData = JSON.parse(raw)
      if (data.version !== 1 || !Array.isArray(data.people) || !Array.isArray(data.records) || (data.updatedAt !== null && (typeof data.updatedAt !== 'string' || !Number.isFinite(Date.parse(data.updatedAt))))) throw new Error()
      const ids = new Set<string>(); const names = new Set<string>()
      for (const p of data.people) {
        validatePerson(p)
        if (typeof p.id !== 'string' || !p.id || ids.has(p.id) || names.has(normalized(p.name)) || typeof p.initials !== 'string') throw new Error()
        ids.add(p.id); names.add(normalized(p.name))
      }
      const recordIds = new Set<string>(); const keys = new Set<string>()
      for (const row of data.records) {
        validateRecord(row, data)
        if (typeof row.id !== 'string' || !row.id || recordIds.has(row.id) || keys.has(recordKey(row)) || !['manual', 'import', 'demo'].includes(row.source)) throw new Error()
        recordIds.add(row.id); keys.add(recordKey(row))
      }
      return data
    } catch { throw new Error('Los datos locales no se pueden leer. No se han sobrescrito. Conserva una copia desde Configuración antes de reiniciar el almacenamiento.') }
  }

  private write(data: KpiData) {
    try { this.storage.setItem(STORAGE_KEY, JSON.stringify({ ...data, updatedAt: new Date().toISOString() })) }
    catch { throw new Error('No se pudo guardar. El almacenamiento está lleno o bloqueado. Libera espacio o descarga una copia de tus datos.') }
  }

  async listPeople() { return (await this.getData()).people }
  async listRecords(personId: string, from: string, to: string) {
    return (await this.getData()).records.filter(r => (personId === 'all' || r.personId === personId) && r.date >= from && r.date <= to).sort((a, b) => a.date.localeCompare(b.date))
  }

  async savePerson(input: PersonInput) {
    const data = await this.getData(); validatePerson(input)
    if (data.people.some(p => p.id !== input.id && normalized(p.name) === normalized(input.name))) throw new Error('Ya existe una persona con ese nombre.')
    if (input.id && !data.people.some(p => p.id === input.id)) throw new Error('Esta persona ya no existe. Recarga el panel.')
    const person = { ...input, id: input.id ?? crypto.randomUUID(), name: input.name.trim(), role: input.role.trim(), initials: input.name.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase() }
    data.people = input.id ? data.people.map(p => p.id === input.id ? person : p) : [...data.people, person]
    this.write(data)
  }

  async deletePerson(id: string) {
    const data = await this.getData()
    data.people = data.people.filter(p => p.id !== id)
    data.records = data.records.filter(r => r.personId !== id)
    this.write(data)
  }

  async saveRecord(input: RecordInput) {
    const data = await this.getData(); validateRecord(input, data)
    if (input.id && !data.records.some(r => r.id === input.id)) throw new Error('Este registro ya no existe. Recarga el panel.')
    if (data.records.some(r => r.id !== input.id && recordKey(r) === recordKey(input))) throw new Error('Ya existe ese indicador y categoría para esa persona y fecha. Edita el registro existente.')
    const row: KpiRecord = { ...input, id: input.id ?? crypto.randomUUID(), label: input.label.trim(), category: input.category.trim(), source: 'manual' }
    data.records = input.id ? data.records.map(r => r.id === input.id ? row : r) : [...data.records, row]
    this.write(data)
  }

  async deleteRecord(id: string) {
    const data = await this.getData(); data.records = data.records.filter(r => r.id !== id); this.write(data)
  }

  async importRows(rows: ImportRow[], replace: boolean, createPeople: boolean) {
    if (!rows.length || rows.length > 10000) throw new Error('Importa entre 1 y 10.000 registros por archivo.')
    const data = await this.getData()
    const result = { added: 0, updated: 0, skipped: 0, people: 0 }
    const people = new Map(data.people.map(p => [normalized(p.name), p]))
    const existing = new Map(data.records.map(r => [recordKey(r), r]))
    const inFile = new Set<string>()
    for (const input of rows) {
      requireText(input.personName, 'Colaborador')
      let person = people.get(normalized(input.personName))
      if (!person) {
        if (!createPeople) throw new Error(`La persona «${input.personName}» no existe. Activa la creación de colaboradores o agrégala antes.`)
        person = { id: crypto.randomUUID(), name: input.personName.trim(), role: 'Sin asignar', color: '#7167e8', dailyGoal: 0, monthlyGoal: 0, initials: input.personName.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase() }
        people.set(normalized(person.name), person); data.people.push(person); result.people++
      }
      const row: KpiRecord = { id: crypto.randomUUID(), personId: person.id, date: input.date, activity: input.activity, goal: input.goal, label: input.label.trim(), category: input.category.trim(), source: 'import' }
      validateRecord(row, data)
      const key = recordKey(row); const old = existing.get(key)
      if (inFile.has(key)) throw new Error(`Fila ${input.line}: indicador duplicado para la misma persona, fecha y categoría dentro del archivo.`)
      inFile.add(key)
      if (old) {
        if (!replace || (old.activity === row.activity && old.goal === row.goal)) { result.skipped++; continue }
        Object.assign(old, row, { id: old.id }); result.updated++
      } else { data.records.push(row); existing.set(key, row); result.added++ }
    }
    this.write(data); return result
  }

  async loadDemo() {
    const data = await this.getData()
    if (data.people.length || data.records.length) throw new Error('Los ejemplos solo se pueden cargar en un espacio vacío.')
    this.write({ ...data, people: demoPeople, records: makeDemoRecords() })
  }

  rawBackup() { return this.storage.getItem(STORAGE_KEY) ?? JSON.stringify(emptyData()) }
  async reset() { this.write(emptyData()) }
}
