# Panel KPI

Panel React para gestionar colaboradores, metas y registros de actividad. Esta entrega implementa la **Fase 1: frontend dinámico con persistencia local** del plan de implementación.

## Ejecutar

Requiere Node.js 22.12 o posterior.

```bash
npm install
npm run dev
```

Vite muestra la dirección local del panel. Usa siempre la misma dirección, navegador y perfil para acceder a tus datos: `localhost` y `127.0.0.1` tienen almacenamientos distintos.

```bash
npm test
npm run build
npm run preview
```

`npm test` ejecuta pruebas de validación, importación, persistencia, edición y cálculos. `npm run build` comprueba TypeScript y genera `dist/`.

## Uso

1. En **Personas**, agrega colaboradores con nombre, rol, color, meta diaria y meta mensual. Puedes editarlos o eliminarlos. Eliminar una persona elimina también sus registros, después de una confirmación con el número de registros afectados.
2. En **Resumen**, pulsa **Registrar actividad** para guardar fecha, persona, indicador, categoría, actividad y meta. La meta diaria del colaborador se propone como valor inicial y puede ajustarse. La tabla permite editar y eliminar registros.
3. Selecciona **Todo el equipo** para ver totales, evolución diaria y ranking de cumplimiento. Los filtros admiten un día, 7 días, 30 días o un período personalizado. La búsqueda filtra por persona, indicador o categoría. La tabla muestra 20 registros por página.
4. Usa **Importar** para cargar CSV o Excel `.xlsx`, revisar el mapeo de columnas, las primeras filas, errores y colaboradores nuevos, y confirmar la importación.
5. **CSV** exporta todos los resultados que coinciden con los filtros y la búsqueda, incluidas todas las páginas y personas seleccionadas. Incluye el origen de cada registro.
6. En **Configuración**, consulta la última escritura y descarga una copia JSON de los datos completos. El reinicio local requiere confirmación. La copia JSON es un respaldo de los datos; esta fase no incorpora un asistente de restauración.

El espacio empieza vacío. **Explorar con ejemplos** o **Cargar ejemplos** agrega cinco colaboradores y 30 días ficticios únicamente cuando el espacio está vacío. Los ejemplos se identifican en la tabla y en el aviso superior. Nunca se generan datos ficticios automáticamente al abrir el panel.

## Importación CSV y Excel

- Formatos: `.csv` y `.xlsx`. Los archivos `.xls` deben convertirse a `.xlsx`.
- Máximo: 5 MB y 10.000 filas de datos. Excel usa la primera hoja.
- La primera fila no vacía debe contener los encabezados. El mapeo detecta nombres frecuentes y permite seleccionar manualmente cada columna.
- Campos obligatorios: **Fecha, Colaborador, Actividad y Meta**.
- Opcionales: **Indicador** y **Categoría**. Si no se asignan, se usan `Actividad registrada` y `General`.
- Fechas: `AAAA-MM-DD`, `DD/MM/AAAA` o celdas de fecha de Excel. Se valida el calendario y se conserva el día sin desplazarlo por UTC.
- Números: cero o valores positivos, hasta 1.000.000.000.000. Admite `1234.5`, `1234,5`, `1.234,50` y `1,234.50`. Para evitar ambigüedad, no uses separadores de miles sin decimales.
- CSV admite coma, punto y coma o tabulación, campos entre comillas, comillas escapadas, saltos de línea y BOM UTF-8.
- Puedes autorizar la creación de colaboradores desconocidos. Se crean con rol `Sin asignar` y metas base en 0.
- Un registro se identifica por **persona + fecha + indicador + categoría**. La comparación de nombres, indicadores y categorías ignora mayúsculas, tildes y espacios redundantes.
- Los duplicados dentro del archivo se deben corregir. Si un registro ya existe en el panel, puedes conservarlo o actualizar su actividad y meta. Volver a importar el mismo archivo no duplica los registros.
- Una fila inválida bloquea la importación completa. La validación y el guardado se ejecutan antes de anunciar éxito; un fallo no deja una importación parcial.

Ejemplo de CSV separado por punto y coma:

```csv
Fecha;Colaborador;Actividad;Meta;Indicador;Categoría
2026-10-24;Ana Martínez;45;40;Solicitudes gestionadas;Operaciones
2026-10-24;Carlos Rojas;30;35;Tareas completadas;Soporte
```

El importador ofrece una plantilla descargable. El CSV exportado puede volver a importarse. Los campos de texto que podrían ejecutarse como fórmulas en Excel se exportan con un apóstrofo de protección.

## Definiciones de los indicadores

- Cumplimiento = suma de actividad / suma de metas de los registros × 100. El total del equipo es ponderado por las metas, no un promedio de porcentajes individuales.
- Si la suma de metas es cero, se muestra **Sin meta**.
- El gráfico agrupa todos los registros seleccionados por fecha.
- Semáforos: menos de 80% en rojo, desde 80% hasta menos de 100% en amarillo y 100% o más en verde.
- Las metas se suman una vez por registro. Si hay varios indicadores diarios, cada uno debe tener su propia meta. No se generan metas para días sin registros.
- La meta mensual es una referencia editable del colaborador. No reemplaza la meta acumulada del período ni se distribuye automáticamente entre días.
- Cambiar las metas base de una persona no altera registros históricos.

Los indicadores y categorías deben acordarse con el negocio antes de considerarse métricas oficiales de Datared.

## Persistencia y alcance

Los datos se almacenan en LocalStorage, bajo `panel-kpi:data:v1`, en el navegador y origen actuales. Se conservan al recargar y al cerrar el navegador. Las pestañas del mismo origen se actualizan mediante el evento `storage`. LocalStorage no ofrece coordinación transaccional entre escrituras simultáneas de distintas pestañas; para edición concurrente y varios usuarios hace falta la fase de backend.

El panel muestra errores si el almacenamiento está bloqueado, lleno o contiene datos inválidos. Un archivo local corrupto no se sobrescribe al intentar leerlo o editarlo. Configuración permite descargar el contenido original antes de reiniciarlo.

Esta fase no incluye login ni datos compartidos. El rol de una persona es descriptivo y no concede permisos. Borrar datos del sitio elimina el almacenamiento. Descarga copias cuando necesites conservarlo.

## Arquitectura

- `src/types/kpi.ts`: modelos y contrato `KpiRepository` con lectura, edición e importación.
- `src/data/localRepository.ts`: validación y persistencia local de personas y registros.
- `src/data/demoRepository.ts`: conjunto de ejemplos, cargado solo por solicitud explícita.
- `src/lib/imports.ts`: lectura CSV/Excel, normalización, mapeo y validación de filas.
- `src/lib/indicators.ts`, `dashboard.ts` y `validation.ts`: cálculos, agregaciones, exportación y validaciones.
- `src/ui/App.tsx`: navegación y coordinación de los cambios.
- `src/ui/Dashboard.tsx`: filtros, tarjetas, gráfico, ranking y detalle.
- `src/ui/Editors.tsx`: formularios y confirmaciones con diálogos nativos accesibles.
- `src/lib/kpi.test.ts`: pruebas de lógica y persistencia.

## Siguientes fases

- **Fase 2:** base compartida, autenticación y permisos validados en servidor. El diseño del repositorio permite añadir una implementación remota.
- **Fase 3:** integración Datared. Antes de desarrollarla se requiere identificar el sistema, su URL, método de acceso autorizado, API o exportación y definiciones de KPI. Las credenciales se manejarán exclusivamente en backend, nunca en código cliente ni variables `VITE_*`. El panel muestra su estado real: **Sin conexión**.
- **Fase 4:** tendencias frente al período anterior y reportes PDF/Excel. Esta entrega ya incorpora semáforos y CSV del equipo.

## Hosting existente

La configuración de Firebase Hosting sirve `dist` con fallback SPA. Esta entrega solo modifica el proyecto local y no realiza despliegues.

Para publicar más adelante, vincula tu proyecto con Firebase CLI, ejecuta `npm run build` y después `firebase deploy --only hosting`. Publicar el frontend no habilita autenticación ni sincroniza el LocalStorage entre usuarios. Verifica primero los requisitos de acceso y datos de tu organización.
