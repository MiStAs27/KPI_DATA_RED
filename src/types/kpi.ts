export interface Person { id: string; name: string; role: string; initials: string; color: string; dailyGoal: number; monthlyGoal: number }
export interface KpiRecord { id: string; personId: string; date: string; activity: number; goal: number; label: string; category: string; source: 'manual' | 'import' | 'demo' }
export interface KpiData { version: 1; people: Person[]; records: KpiRecord[]; updatedAt: string | null }
export type PersonInput = Omit<Person, 'id' | 'initials'> & { id?: string }
export type RecordInput = Omit<KpiRecord, 'id' | 'source'> & { id?: string }
export interface ImportRow { line: number; personName: string; date: string; activity: number; goal: number; label: string; category: string }
export interface KpiRepository {
  getData(): Promise<KpiData>
  listPeople(): Promise<Person[]>
  listRecords(personId: string, from: string, to: string): Promise<KpiRecord[]>
  savePerson(person: PersonInput): Promise<void>
  deletePerson(id: string): Promise<void>
  saveRecord(record: RecordInput): Promise<void>
  deleteRecord(id: string): Promise<void>
  importRows(rows: ImportRow[], replace: boolean, createPeople: boolean): Promise<{ added: number; updated: number; skipped: number; people: number }>
}
