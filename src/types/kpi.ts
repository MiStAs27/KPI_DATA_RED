export interface Person { id: string; name: string; role: string; initials: string; color: string }
export interface KpiRecord { personId: string; date: string; activity: number; goal: number; label: string; category: string }
export interface KpiRepository {
  listPeople(): Promise<Person[]>
  listRecords(personId: string, from: string, to: string): Promise<KpiRecord[]>
}
