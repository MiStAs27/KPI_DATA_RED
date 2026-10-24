import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Upload, X } from 'lucide-react'
import type { KpiRecord, Person, PersonInput, RecordInput } from '../types/kpi'
import { localIso, normalized, recordKey } from '../lib/validation'
import { fields, fieldLabels, guessColumns, prepareImport, readImportFile, type Cell, type ColumnMap } from '../lib/imports'
import { downloadFile } from '../lib/dashboard'
import type { LocalKpiRepository } from '../data/localRepository'

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close() }, [])
  return <dialog ref={ref} className={`editor-dialog ${wide ? 'wide-dialog' : ''}`} aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); onClose() }}><div className="dialog-heading"><h2 id="dialog-title">{title}</h2><button type="button" className="icon-button" aria-label="Cerrar diálogo" onClick={onClose}><X size={20}/></button></div>{children}</dialog>
}

export function PersonEditor({ person, onSave, onClose }: { person?: Person; onSave: (p: PersonInput) => Promise<void>; onClose: () => void }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  return <Modal title={person ? 'Editar persona' : 'Agregar persona'} onClose={onClose}><form className="editor-form" onSubmit={async event => {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError('')
    try { await onSave({ id: person?.id, name: String(form.get('name')), role: String(form.get('role')), color: String(form.get('color')), dailyGoal: Number(form.get('dailyGoal')), monthlyGoal: Number(form.get('monthlyGoal')) }); onClose() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.') } finally { setBusy(false) }
  }}>
    <label>Nombre completo<input autoFocus name="name" required maxLength={120} defaultValue={person?.name} placeholder="Ej. Ana Martínez"/></label>
    <label>Rol o área<input name="role" required maxLength={120} defaultValue={person?.role} placeholder="Ej. Operaciones"/></label>
    <div className="form-grid"><label>Meta diaria base<input name="dailyGoal" type="number" min="0" max="1000000000000" step="any" required defaultValue={person?.dailyGoal ?? 0}/></label><label>Meta mensual de referencia<input name="monthlyGoal" type="number" min="0" max="1000000000000" step="any" required defaultValue={person?.monthlyGoal ?? 0}/></label></div>
    <label>Color del avatar<input className="color-input" name="color" type="color" defaultValue={person?.color ?? '#7167e8'}/></label>
    <p className="form-hint">La meta diaria se propone para nuevos registros. La meta mensual es una referencia independiente. Editarlas conserva las metas históricas.</p>
    {error && <p className="inline-error" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancelar</button><button className="export-button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar persona'}</button></div>
  </form></Modal>
}

export function RecordEditor({ record, people, personId, onSave, onClose }: { record?: KpiRecord; people: Person[]; personId: string; onSave: (r: RecordInput) => Promise<void>; onClose: () => void }) {
  const initialId = record?.personId ?? (people.some(p => p.id === personId) ? personId : people[0]?.id ?? '')
  const [selectedId, setSelectedId] = useState(initialId); const [goal, setGoal] = useState(String(record?.goal ?? people.find(p => p.id === initialId)?.dailyGoal ?? 0))
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  return <Modal title={record ? 'Editar actividad' : 'Registrar actividad'} onClose={onClose}><form className="editor-form" onSubmit={async event => {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError('')
    try { await onSave({ id: record?.id, personId: selectedId, date: String(form.get('date')), activity: Number(form.get('activity')), goal: Number(goal), label: String(form.get('label')), category: String(form.get('category')) }); onClose() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.') } finally { setBusy(false) }
  }}>
    <label>Colaborador<select autoFocus value={selectedId} required onChange={event => { setSelectedId(event.target.value); setGoal(String(people.find(p => p.id === event.target.value)?.dailyGoal ?? 0)) }}>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Fecha<input name="date" type="date" min="1900-01-01" max="9999-12-31" required defaultValue={record?.date ?? localIso()}/></label>
    <label>Indicador<input name="label" required maxLength={120} defaultValue={record?.label ?? 'Actividad registrada'}/></label><label>Categoría<input name="category" required maxLength={120} defaultValue={record?.category ?? 'General'}/></label>
    <div className="form-grid"><label>Actividad<input name="activity" type="number" min="0" max="1000000000000" step="any" required defaultValue={record?.activity ?? 0}/></label><label>Meta del registro<input name="goal" type="number" min="0" max="1000000000000" step="any" required value={goal} onChange={event => setGoal(event.target.value)}/></label></div>
    <p className="form-hint">La meta se suma una vez por registro. Si hay varios indicadores diarios, asigna a cada uno su propia meta. Una meta de 0 se muestra como «Sin meta».</p>
    {error && <p className="inline-error" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancelar</button><button className="export-button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar actividad'}</button></div>
  </form></Modal>
}

export function ImportEditor({ people, records, repository, onSaved, onClose }: { people: Person[]; records: KpiRecord[]; repository: LocalKpiRepository; onSaved: (message: string) => Promise<void>; onClose: () => void }) {
  const [table, setTable] = useState<Cell[][]>([]); const [filename, setFilename] = useState(''); const [mapping, setMapping] = useState<ColumnMap>({ date: -1, personName: -1, activity: -1, goal: -1, label: -1, category: -1 })
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [createPeople, setCreatePeople] = useState(true); const [replace, setReplace] = useState(false); const [dragging, setDragging] = useState(false)
  const preview = useMemo(() => table.length ? prepareImport(table, mapping, people) : null, [table, mapping, people])
  const existingKeys = new Set(records.map(recordKey)); const peopleByName = new Map(people.map(p => [normalized(p.name), p.id]))
  const duplicates = preview?.rows.filter(row => existingKeys.has(recordKey({ ...row, personId: peopleByName.get(normalized(row.personName)) ?? '' }))).length ?? 0
  async function read(file?: File) {
    if (!file) return
    setBusy(true); setError(''); setTable([]); setFilename(file.name)
    try { const cells = await readImportFile(file); setTable(cells); setMapping(guessColumns(cells[0])) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo leer el archivo. Comprueba que no esté protegido o dañado.') } finally { setBusy(false) }
  }
  return <Modal title="Importar actividad" onClose={onClose} wide><div className="editor-form">
    <p className="form-hint">CSV y Excel .xlsx, hasta 5 MB y 10.000 filas. Se lee la primera hoja de Excel. La primera fila debe contener los encabezados.</p>
    <label className={`dropzone ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); if (!busy) void read(e.dataTransfer.files[0]) }}><Upload size={24}/><strong>{busy ? 'Procesando…' : filename || 'Arrastra una planilla o selecciona un archivo'}</strong><span>CSV separado por coma, punto y coma o tabulación · Excel .xlsx</span><input type="file" aria-label="Seleccionar planilla" accept=".csv,.xlsx" disabled={busy} onChange={e => { void read(e.target.files?.[0]); e.target.value = '' }}/></label>
    <button className="text-button" onClick={() => downloadFile('\uFEFFFecha;Colaborador;Actividad;Meta;Indicador;Categoría\r\n2026-10-24;Ana Martínez;45;40;Solicitudes gestionadas;Operaciones\r\n', 'plantilla-actividad.csv')}>Descargar plantilla CSV</button>
    {table.length > 0 && <>
      <div className="import-mapping">{fields.map(field => <label key={field}>{fieldLabels[field]}<select value={mapping[field]} onChange={e => setMapping({ ...mapping, [field]: Number(e.target.value) })}><option value={-1}>{field === 'label' || field === 'category' ? 'Usar valor predeterminado' : 'Seleccionar columna'}</option>{table[0].map((header, i) => <option key={i} value={i}>{i + 1}. {String(header ?? '(sin título)')}</option>)}</select></label>)}</div>
      <p className="form-hint">Fechas: AAAA-MM-DD o DD/MM/AAAA. Números: 1234,5 o 1234.5. Sin columnas opcionales se usan «Actividad registrada» y «General».</p>
      <div className="import-summary"><strong>{preview?.rows.length ?? 0} registros válidos</strong><span>{duplicates} ya existentes</span><span>{preview?.newPeople.length ?? 0} personas nuevas</span></div>
      {preview && preview.errors.length > 0 && <div className="import-errors" role="alert"><strong>Corrige {preview.errors.length} error(es) para continuar.</strong><ul>{preview.errors.slice(0, 15).map((error, i) => <li key={i}>{error}</li>)}</ul>{preview.errors.length > 15 && <p>Se muestran los primeros 15 errores.</p>}</div>}
      {!!preview?.rows.length && <div className="table-scroll import-preview"><table><thead><tr><th>FILA</th><th>FECHA</th><th>PERSONA</th><th>INDICADOR</th><th>ACTIVIDAD</th><th>META</th></tr></thead><tbody>{preview.rows.slice(0, 5).map(row => <tr key={row.line}><td>{row.line}</td><td>{row.date}</td><td>{row.personName}</td><td>{row.label}</td><td>{row.activity}</td><td>{row.goal}</td></tr>)}</tbody></table><p className="form-hint">Vista previa de los primeros 5 registros.</p></div>}
      {!!preview?.newPeople.length && <><label className="checkbox-label"><input type="checkbox" checked={createPeople} onChange={e => setCreatePeople(e.target.checked)}/>Crear colaboradores que todavía no existen</label><p className="form-hint">{preview.newPeople.slice(0, 10).join(', ')}{preview.newPeople.length > 10 ? '…' : ''}. Se crean con rol «Sin asignar» y metas base en 0.</p></>}
      <label>Si un registro ya existe<select value={replace ? 'replace' : 'skip'} onChange={e => setReplace(e.target.value === 'replace')}><option value="skip">Conservar el existente y omitir el importado</option><option value="replace">Actualizar actividad y meta con el archivo</option></select></label><p className="form-hint">La coincidencia se identifica por persona, fecha, indicador y categoría. Los duplicados dentro del archivo deben corregirse.</p>
    </>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="dialog-actions"><button className="secondary-button" onClick={onClose} disabled={busy}>Cancelar</button><button className="export-button" disabled={busy || !preview?.rows.length || !!preview.errors.length || (!!preview.newPeople.length && !createPeople)} onClick={async () => {
      if (!preview || busy) return
      setBusy(true); setError('')
      try { const result = await repository.importRows(preview.rows, replace, createPeople); await onSaved(`Importación guardada: ${result.added} nuevos, ${result.updated} actualizados, ${result.skipped} omitidos y ${result.people} personas creadas.`); onClose() }
      catch (e) { setError(e instanceof Error ? e.message : 'No se pudo importar.') } finally { setBusy(false) }
    }}>{busy ? 'Procesando…' : 'Confirmar importación'}</button></div>
  </div></Modal>
}

export function ConfirmDialog({ title, children, onConfirm, onClose }: { title: string; children: ReactNode; onConfirm: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  return <Modal title={title} onClose={onClose}><div className="editor-form"><div className="confirm-copy">{children}</div>{error && <p className="inline-error" role="alert">{error}</p>}<div className="dialog-actions"><button className="secondary-button" onClick={onClose} disabled={busy}>Cancelar</button><button className="danger-button" disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); onClose() } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la acción.') } finally { setBusy(false) } }}>{busy ? 'Procesando…' : 'Confirmar eliminación'}</button></div></div></Modal>
}
