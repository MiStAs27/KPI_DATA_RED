# Panel KPI

Panel privado de ejemplo para consultar actividad por persona y fecha. Esta entrega funciona completamente en el navegador con información ficticia; los indicadores y las categorías son provisionales y no representan métricas reales de Datared.

La demo no incorpora inicio de sesión: Firebase Hosting sirve el sitio como contenido público. No publiques aquí información personal real; primero se debe implementar autenticación y autorización en un backend.

## Requisitos

- Node.js 20.19+ o 22.12+ (incluyen npm). Descarga la versión LTS desde [nodejs.org](https://nodejs.org/).
- Una terminal y conexión a Internet la primera vez para instalar paquetes.

## Instalar y ejecutar localmente

1. Abre una terminal en la carpeta del proyecto.
2. Instala las dependencias:

   ```bash
   npm install
   ```

3. Inicia el servidor local:

   ```bash
   npm run dev
   ```

4. Abre la dirección que Vite muestra en la terminal, normalmente `http://localhost:5173`.

Para comprobar la versión optimizada localmente:

```bash
npm run build
npm run preview
```

## Publicar en Firebase Hosting (plan Spark)

La aplicación es estática y no usa Firebase SDK, backend ni servicios de pago. El plan Spark permite publicar estos archivos en Firebase Hosting.

1. Crea una cuenta o inicia sesión en [Firebase Console](https://console.firebase.google.com/).
2. Pulsa **Añadir proyecto** y sigue los pasos. Puedes desactivar Google Analytics para esta demo.
3. Instala Firebase CLI si aún no lo tienes: `npm install -g firebase-tools`.
4. Desde la carpeta del proyecto, inicia sesión: `firebase login`.
5. Genera los archivos listos para publicar: `npm run build`.
6. Vincula la carpeta con el proyecto creado: `firebase use --add`. Selecciona el proyecto y guarda un alias, por ejemplo `default`.
7. Publica: `firebase deploy --only hosting`.

Firebase Hosting publica la carpeta `dist`; la reescritura SPA ya está definida en `firebase.json`. Para cada cambio, vuelve a ejecutar `npm run build` y después `firebase deploy --only hosting`.

## Datos, cálculos y arquitectura

- `src/types/kpi.ts` define `Person`, `KpiRecord` y el contrato `KpiRepository`.
- `src/data/demoRepository.ts` implementa `DemoKpiRepository` con cinco personas y 30 días de datos generados en calendario local.
- `src/lib/indicators.ts` contiene las fórmulas independientes: cumplimiento = actividad / meta × 100; acumulado = suma de actividad / suma de meta × 100. Si la meta es cero, el porcentaje es `null`.
- `src/ui/` contiene la interfaz y estilos. Recharts dibuja la evolución diaria.
- Fechas serializadas como `AAAA-MM-DD` se comparan como calendario y se presentan sin convertirlas a UTC.

### Contrato del futuro repositorio

Una implementación conectada deberá cumplir `KpiRepository`: `listPeople()` entrega personas autorizadas y `listRecords(personId, from, to)` entrega registros de esa persona dentro del rango, con fechas `AAAA-MM-DD`, actividad y meta numéricas. Debe obtener los datos desde un backend autenticado, validar permisos en servidor, manejar errores de red y exponer información de sincronización. El navegador no recibirá credenciales del origen.

## Etapa 2: conexión autorizada con Datared

1. Verificar la URL completa, el método de autenticación y las pantallas necesarias.
2. Preferir una API oficial o una exportación autorizada.
3. Si no existe, evaluar extracción desde un backend; usar Playwright solo si hace falta un navegador.
4. Mantener contraseñas, cookies y tokens de Datared exclusivamente en el servidor, fuera del código, repositorio, logs y variables `VITE_*`.
5. No intentar eludir MFA, CAPTCHA ni restricciones de acceso.
6. Incorporar autenticación de usuarios y autorización en el backend antes de mostrar datos personales reales.
7. Mostrar fecha de última sincronización y errores reales; no anunciar una sincronización exitosa si falla.
8. Evaluar costes y límites del backend antes de elegir dónde alojarlo. No activar facturación.

## Implementado y pendiente

**Implementado:** panel adaptable, menú Resumen/Personas/Configuración, filtros por persona y período, tarjetas, gráfico, tabla, búsqueda y exportación CSV; estados de carga/error/sin resultados; aviso persistente de demo; Hosting clásico con fallback SPA.

**Pendiente:** acordar definiciones oficiales de KPI, verificar acceso y método autorizado con Datared, diseñar backend, autenticación/autorización y sincronización. No se conecta a Datared en esta etapa.
