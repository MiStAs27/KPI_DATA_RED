import { describe, expect, it } from 'vitest'
import { LocalKpiRepository, STORAGE_KEY } from '../data/localRepository'
import { dailyTotals, performance, teamRanking, csvCell } from './dashboard'
import { guessColumns, parseCsv, parseImportDate, parseImportNumber, prepareImport } from './imports'
import { totals } from './indicators'
import type { ImportRow, KpiRecord, PersonInput } from '../types/kpi'

const person: PersonInput = { name: 'Ana Martínez', role: 'Operaciones', color: '#7167e8', dailyGoal: 40, monthlyGoal: 880 }
const row: ImportRow = { line: 2, personName: person.name, date: '2026-10-24', activity: 45, goal: 40, label: 'Solicitudes', category: 'General' }
function fixture() {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
  return { values, storage, repository: new LocalKpiRepository(storage) }
}

describe('persistencia y edición', () => {
  it('inicia vacío y conserva personas y actividad al abrir otra instancia', async () => {
    const { storage, repository } = fixture()
    expect((await repository.getData()).records).toEqual([])
    await repository.savePerson(person)
    const p = (await repository.listPeople())[0]
    await repository.saveRecord({ personId: p.id, date: row.date, activity: 45, goal: 40, label: row.label, category: row.category })
    const reloaded = new LocalKpiRepository(storage)
    expect((await reloaded.getData()).records[0].activity).toBe(45)
    await reloaded.savePerson({ ...p, dailyGoal: 60 })
    expect((await reloaded.getData()).records[0].goal).toBe(40)
    expect((await reloaded.listPeople())[0].dailyGoal).toBe(60)
  })
  it('no sobrescribe datos corruptos y permite recuperar el archivo original', async () => {
    const { values, repository } = fixture(); values.set(STORAGE_KEY, '{broken')
    await expect(repository.savePerson(person)).rejects.toThrow('No se han sobrescrito')
    expect(repository.rawBackup()).toBe('{broken')
    await repository.reset(); expect((await repository.getData()).people).toHaveLength(0)
  })
  it('informa un fallo de escritura sin simular éxito', async () => {
    const repository = new LocalKpiRepository({ getItem: () => null, setItem: () => { throw new Error('QuotaExceeded') } })
    await expect(repository.savePerson(person)).rejects.toThrow('No se pudo guardar')
  })
  it('rechaza nombres duplicados, registros duplicados y valores negativos', async () => {
    const { repository } = fixture(); await repository.savePerson(person)
    await expect(repository.savePerson({ ...person, name: ' ANA MARTINEZ ' })).rejects.toThrow('Ya existe')
    const p = (await repository.listPeople())[0]
    const input = { personId: p.id, date: row.date, label: row.label, category: row.category, goal: 40, activity: 45 }
    await repository.saveRecord(input)
    await expect(repository.saveRecord(input)).rejects.toThrow('Ya existe')
    await expect(repository.saveRecord({ ...input, label: 'Otro', activity: -1 })).rejects.toThrow('Actividad')
    const saved = (await repository.getData()).records[0]
    await repository.saveRecord({ ...saved, activity: 50 })
    expect((await repository.getData()).records[0].activity).toBe(50)
    await repository.deleteRecord(saved.id); expect((await repository.getData()).records).toHaveLength(0)
  })
  it('elimina en cascada solo los registros de la persona elegida', async () => {
    const { repository } = fixture(); await repository.importRows([row, { ...row, line: 3, personName: 'Luis' }], false, true)
    const p = (await repository.listPeople())[0]; await repository.deletePerson(p.id)
    const data = await repository.getData(); expect(data.people).toHaveLength(1); expect(data.records).toHaveLength(1)
    expect(data.records[0].personId).toBe(data.people[0].id)
  })
  it('no mezcla automáticamente ejemplos con un espacio con datos', async () => {
    const { repository } = fixture(); await repository.loadDemo()
    expect((await repository.getData()).records).toHaveLength(150)
    await expect(repository.loadDemo()).rejects.toThrow('espacio vacío')
  })
})

describe('importación', () => {
  it('detecta columnas con tildes y procesa campos escapados y multilínea', () => {
    const csv = '\uFEFFFecha;Colaborador;Actividad;Meta;Indicador;Categoría\r\n24/10/2026;"Ana; Martínez";"45,5";40;"Texto ""citado""\ny otra línea";General\r\n'
    const table = parseCsv(csv); const mapping = guessColumns(table[0]); const result = prepareImport(table, mapping, [])
    expect(result.errors).toEqual([]); expect(result.rows[0]).toMatchObject({ date: '2026-10-24', personName: 'Ana; Martínez', activity: 45.5, label: 'Texto "citado"\ny otra línea' })
  })
  it('rechaza fechas imposibles, números vacíos y CSV incompleto', () => {
    expect(() => parseImportDate('31/02/2026')).toThrow('Fecha inválida')
    expect(() => parseImportDate('2026-02-29')).toThrow()
    expect(parseImportDate('29/02/2024')).toBe('2024-02-29')
    expect(parseImportDate(new Date('2026-10-24T00:00:00Z'))).toBe('2026-10-24')
    expect(() => parseImportNumber('', 'Meta')).toThrow()
    expect(parseImportNumber('1.234,50', 'Meta')).toBe(1234.5)
    expect(parseImportNumber(0, 'Meta')).toBe(0)
    expect(() => parseCsv('Fecha,Nombre\n"sin cierre')).toThrow('comillas')
  })
  it('muestra errores por fila y bloquea columnas repetidas y duplicados internos', () => {
    const table = parseCsv('Fecha,Colaborador,Actividad,Meta\n2026-10-24,Ana,2,4\n2026-10-24,Ana,2,4\n2026-10-25,Luis,,4')
    const mapping = guessColumns(table[0]); const result = prepareImport(table, mapping, [])
    expect(result.errors).toHaveLength(2); expect(result.errors[0]).toContain('Fila 3')
    expect(prepareImport(table, { ...mapping, goal: mapping.activity }, []).errors[0]).toContain('columna diferente')
  })
  it('reimporta sin duplicar y actualiza valores solo cuando se solicita', async () => {
    const { repository } = fixture()
    expect(await repository.importRows([row], false, true)).toMatchObject({ added: 1, people: 1 })
    expect(await repository.importRows([row], false, true)).toMatchObject({ added: 0, skipped: 1 })
    await repository.importRows([{ ...row, activity: 60 }], false, true)
    expect((await repository.getData()).records[0].activity).toBe(45)
    expect(await repository.importRows([{ ...row, activity: 60 }], true, true)).toMatchObject({ updated: 1 })
    expect((await repository.getData()).records[0].activity).toBe(60)
  })
  it('una fila inválida aborta la importación completa', async () => {
    const { repository } = fixture()
    await expect(repository.importRows([row, { ...row, line: 3, personName: 'Luis', activity: -1 }], false, true)).rejects.toThrow()
    expect((await repository.getData()).people).toHaveLength(0)
    await expect(repository.importRows([row], false, false)).rejects.toThrow('no existe')
    expect((await repository.getData()).records).toHaveLength(0)
  })
})

describe('resumen de equipo', () => {
  it('suma por día y calcula cumplimiento ponderado, con meta cero sin porcentaje', async () => {
    const { repository } = fixture()
    await repository.importRows([row, { ...row, line: 3, personName: 'Luis', activity: 5, goal: 10 }], false, true)
    const data = await repository.getData()
    expect(dailyTotals(data.records)).toEqual([{ date: row.date, activity: 50, goal: 50 }])
    expect(totals(data.records).attainment).toBe(100)
    expect(teamRanking(data.people, data.records)[0].person.name).toBe('Ana Martínez')
    expect(totals([{ ...data.records[0], goal: 0 }] as KpiRecord[]).attainment).toBeNull()
    expect(performance(80).className).toBe('warning'); expect(performance(100).className).toBe('success'); expect(performance(79.9).className).toBe('danger')
    expect(await repository.listRecords('all', '2026-10-25', '2026-10-30')).toHaveLength(0)
  })
  it('protege la exportación CSV ante fórmulas de hojas de cálculo', () => {
    expect(csvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"')
    expect(csvCell('Ana "M"')).toBe('"Ana ""M"""')
    expect(csvCell(45)).toBe('"45"')
  })
})
