# Módulo: Proveedores

> Levantamiento funcional basado exclusivamente en el frontend (React + TypeScript, en español). Plataforma de compras para un retailer chileno de mejoramiento del hogar (la app se refiere a la empresa como "Mimbral"). Todos los datos son **mock** (mock data). No se modificó código.
>
> Archivos analizados:
> - `src/pages/SuppliersPage.tsx`
> - `src/pages/SupplierDetailPage.tsx`
> - `src/pages/SupplierDetailSections.tsx` (barrel de re-exportación)
> - `src/pages/supplierDetail/SupplierNegotiation.tsx`
> - `src/pages/supplierDetail/SeasonView.tsx`
> - `src/pages/supplierDetail/SupplierTermsAgreements.tsx`
> - `src/pages/supplierDetail/SupplierMaster.tsx`
> - `src/pages/supplierDetail/GStat.tsx`
> - Apoyo: `src/types/purchasing.ts`, `src/data/mockSuppliers.ts`, `src/components/business/supplierMetricHelp.tsx`, `src/utils/supplierPerf.ts`, `src/utils/seasonality.ts`, `src/routes/AppRoutes.tsx`, `src/components/layout/navItems.tsx`.

---

## Nota general sobre datos y persistencia (aplica a todo el módulo)

- **Fuente de datos de proveedores**: colección `suppliers` en `src/data/mockSuppliers.ts`.
  - `SuppliersPage` (listado) lee los proveedores vía `useCollection<Supplier>("suppliers", mockSuppliers)` (contexto `DataContext`), lo que permitiría overrides en runtime.
  - `SupplierDetailPage` y **todas** sus secciones (`SupplierMaster`, `SupplierNegotiation`, `SeasonView`, `SupplierTermsAgreements`) leen **directamente** el array mock importado `suppliers` (no usan `useCollection`). **Suposición**: en esta demo ambos coinciden porque no hay mutaciones sobre la colección de proveedores. Es un **hallazgo de inconsistencia de fuente** (ver Definiciones pendientes).
- **Métricas comerciales derivadas** (venta, utilidad, margen, quiebres, estacionalidad, fill rate, OTIF, score de evaluación, roles, importancia, dependencia) se **calculan en el frontend** cruzando el proveedor con `mockProducts`, `mockPurchaseOrders`, `mockReceptions`, `mockAlerts`, `mockCategories` y utilidades (`supplierFulfillment`, `supplierSeasonality`, `hashString`). Varias de ellas son **simuladas/deterministas** (ver cada pantalla).
- **Persistencia local real**: únicamente las **Condiciones comerciales** y los **Acuerdos y seguimiento** se persisten en `localStorage` (`useLocalStorage`), con claves `compras:terms:<idProveedor>` y `compras:agreements:<idProveedor>`. Es la **única escritura de datos del módulo**; el resto es solo lectura.
- **"Fecha actual" del módulo hardcodeada**: la inteligencia estacional (`seasonality.ts`) fija `CURRENT_YEAR = 2026` y `CURRENT_MONTH = 5` (**Junio**, índice 0-based). Los "días a temporada", el año en curso y los factores anuales se calculan respecto a Junio 2026, no a la fecha real del sistema (hoy 2026-07-13). Análogamente, el alta de acuerdos usa `"2026-06-26"` como fecha por defecto. **Hallazgo / Definición pendiente**.
- **Tipo de dato `Supplier`** (`src/types/purchasing.ts`), campos principales:
  - Base: `id`, `name`, `rut`, `categories[]`, `associatedSkus`, `openPurchaseOrders`, `deliveryCompliance` (0–100), `averageLeadTimeDays`, `lastPurchaseDate`, `purchasedAmountLast90Days`, `pendingAmount`, `status`.
  - Maestro (opcionales): `contactoComercial`, `contactoLogistica`, `contactoCobranza` (`{nombre,email,telefono}`), `condicionPago`, `plazoEntregaDias`, `minimoCompra`, `minimoCompraTipo` (`"monto" | "unidades"`), `marcas[]`, `documentosTributarios[]` (`{tipo,numero,vigente,vence?}`), `acuerdosComerciales[]` (`{titulo,detalle}`).
- **Estados del proveedor** (`SupplierStatus`): `active` (Activo), `review` (Revisar), `delayed` (Atrasado), `blocked` (Bloqueado), `inactive` (Sin compras).
- **Umbrales/constantes reutilizados en todo el módulo**:
  - Cumplimiento (semáforo): **<70 rojo · 70–84 ámbar · ≥85 verde**.
  - Lead time alto: **≥15 días** (ámbar). Umbral de objetivo de negociación: **≥12 días**.
  - Monto pendiente de riesgo: **> 20.000.000 CLP** (ámbar).
  - Fill rate / despacho: `<90` rojo/bad, `≥90` bueno; en `supplierFulfillment` el rating combina fill y cumplimiento (ver Pantalla 1).
  - OTIF: `<85` ámbar, `≥85` bueno.

---

## Pantalla 1 — Performance de proveedores (listado)

### Nombre
Proveedores (Performance de proveedores).

### Ruta(s)
- `/proveedores` (registrada en `src/routes/AppRoutes.tsx`, componente `SuppliersPage`, carga lazy).
- Acceso desde el menú lateral: grupo **"Proveedores"** (`key: "proveedores"`, hint "Performance comercial, costos, margen, cumplimiento y negociación") → único hijo **"Performance"** (`to: "/proveedores"`, hint "Cumplimiento, lead time, venta, margen y monto pendiente para negociar mejor").
- Nota: existe además un ítem distinto **"Mi cartera → Proveedores"** (`/mi-cartera/proveedores`) que pertenece a otro módulo (no es esta pantalla).

### Módulo
Proveedores.

### Objetivo funcional
Dar al comprador una vista comparativa del desempeño de todos los proveedores con foco en **cumplimiento, lead time, despacho (fill rate) y monto pendiente**, para decidir a quién seguir comprando, a quién revisar y con quién negociar antes de la temporada alta. La descripción del `PageHeader` lo declara textualmente: "Gestión de proveedores con foco en cumplimiento, lead time y monto pendiente. Información para decidir si seguir comprando a cada uno."

### Tipo de usuario
No se detectó gate de rol en la ruta ni en el ítem de navegación (`navItems.tsx` no define `roles` para la clave `proveedores` ni para su hijo `Performance`). **Suposición**: accesible tanto a `comprador` como a `lider`. La copy está redactada desde la óptica del comprador.

### Descripción detallada
Página compuesta por: encabezado, barra de filtros con resumen, fila de 4 KPIs, tres mini-rankings, un panel condicional de proveedores que entran en temporada, y una tabla principal de proveedores (con vista alternativa en tarjetas para móvil vía `mobileCard`). Los KPIs se recalculan sobre el **resultado filtrado**; los rankings y el panel de temporada usan el **universo completo** (variable `suppliers`, no `filtered`).

### Información que muestra
- **KPIs (sobre resultado filtrado `filtered`)** — 4 `KpiCard`:
  - "Proveedores atrasados" (`tone="bad"`): nº con `status === "delayed"`.
  - "Bajo cumplimiento (<70%)" (`tone="warn"`, con `MetricHint metric="cumplimiento"`): nº con `deliveryCompliance < 70`.
  - "OC abiertas (total)" (`tone="neutral"`): suma de `openPurchaseOrders`.
  - "Monto pendiente total" (`tone="info"`, con `MetricHint metric="pendiente"`): suma de `pendingAmount` (formato compacto `formatCurrencyCompact`).
- **Mini-rankings (sobre universo completo, top 4)** — 3 `MiniRank` (componente local):
  - "Peor cumplimiento": orden ascendente por `deliveryCompliance`; tono rojo; subtítulo "N OC abiertas".
  - "Mayor compra (90 días)": orden descendente por `purchasedAmountLast90Days`; tono verde; subtítulo "N SKUs".
  - "Lead time más alto": orden descendente por `averageLeadTimeDays`; tono ámbar; subtítulo "Cumple X%".
- **Panel "Entran en temporada próximamente"** (condicional): proveedores con `status !== "inactive"` y con pre-temporada detectada por `supplierSeasonality(name).preSeason !== null`. Cada fila muestra: nombre, "Temporada alta `<mes>` (~`<días>` días) · fill `<fill>`% · lead `<leadTime>`" y un `Badge` "Riesgo de quiebre" (rojo) o "Preparar compra" (ámbar) según `classification.risky`. Descripción del card: "Negocia antes del peak: stock reservado, fill mínimo y despacho anticipado".
- **Tabla de proveedores** (columnas, ver más abajo).

### Secciones/bloques
1. `PageHeader` (título "Proveedores" + descripción).
2. `FilterBar` (búsqueda + select de estado + resumen + botón limpiar).
3. Grid de 4 `KpiCard`.
4. Grid de 3 `MiniRank` (componente local).
5. `Card` "Entran en temporada próximamente" (condicional a `entranTemporada.length > 0`).
6. `Card` con `DataTable` (tabla principal + `mobileCard`).

### Filtros disponibles
- **Búsqueda de texto** (`q` en URL, `useUrlState`): filtra por `` `${name} ${rut}` `` (case-insensitive, con `trim`). Placeholder exacto: **"Buscar por nombre o RUT"**.
- **Estado** (`estado` en URL, `useUrlState`): select con `placeholder="Estado"` y opciones — "Activo" (`active`), "Revisar" (`review`), "Atrasado" (`delayed`), "Bloqueado" (`blocked`), "Sin compras" (`inactive`).
- Botón **"Limpiar"** (dentro de `FilterBar`, `onClear`) que hace `setQuery("")` y `setStatus("")`.
- **Resumen** (texto del `FilterBar`): "`N` proveedor(es) · `N` atrasado(s) · `N` por revisar" (usa `delayed` y `lowCompliance`).
- El estado del filtro se persiste en la URL (querystring), permitiendo compartir/deep-link.

### Acciones del usuario
- Escribir en el buscador y elegir estado para filtrar.
- Limpiar filtros ("Limpiar").
- Hacer clic en una fila de la tabla → `navigate("/proveedores/:id")` (`onRowClick`).
- Hacer clic en un proveedor del panel de temporada → `Link` a `/proveedores/:id?tab=temporadas` (deep-link a la pestaña Temporadas).
- Consultar ayuda contextual de métricas (íconos ⓘ `MetricHint`) en encabezados de columna y KPIs: `cumplimiento`, `despacho`, `leadTime`, `pendiente` (popover informativo, sin acción de negocio).

### Botones y controles
- Input de búsqueda, select de estado, botón **"Limpiar"** (dentro de `FilterBar`).
- Íconos de ayuda `MetricHint` (popover `InfoHint`, sin acción de negocio).
- Filas clicables (no hay botón explícito; toda la fila es el control de navegación).
- Enlaces (`Link`) en el panel de temporada.

### Tablas / tarjetas / formularios / componentes
- **Tabla**: `DataTable` con columnas `Column<Supplier>[]`, `rowKey = s.id`, `onRowClick`, y `mobileCard`. Columnas (etiquetas exactas):
  1. **"Proveedor"**: nombre (`s.name`) + RUT en `font-mono` gris.
  2. **"Categorías"** (`hideOnMobile`): `Badge tone="neutral"` por cada categoría (máx. ancho 200px).
  3. **"SKUs"** (align right, `hideOnMobile`): `formatNumber(associatedSkus)`.
  4. **"OC abiertas"** (align right): `formatNumber(openPurchaseOrders)`.
  5. **"Cumplimiento"** + `MetricHint metric="cumplimiento"` (align right): `formatPercent(deliveryCompliance,0)` coloreado por umbral 70/85.
  6. **"Despacho"** + `MetricHint metric="despacho"` (align right): `supplierFulfillment(name)`; muestra `${fillRate}%` si `arrivedOrders > 0`, si no "—"; bajo el valor, si `undeliveredSkus > 0`, línea roja "`N` SKU sin despachar". Color por `f.tone` (red/amber/green).
  7. **"Lead time"** + `MetricHint metric="leadTime"` (align right, `hideOnMobile`): `formatDays(averageLeadTimeDays)`.
  8. **"Última compra"** (align right, `hideOnMobile`): `formatDate(lastPurchaseDate)`.
  9. **"Compra 90 días"** (align right, `hideOnMobile`): `formatCurrencyCompact(purchasedAmountLast90Days)`.
  10. **"Monto pendiente"** + `MetricHint metric="pendiente"` (align right): `formatCurrency(pendingAmount)`, ámbar si `> 20000000`.
  11. **"Estado"**: `StatusBadge kind="supplier" value={status}`.
  - **`mobileCard`**: muestra nombre + RUT + `StatusBadge`, y grid con "Cumple" (con `MetricHint`), "Despacho" (con `MetricHint`), "Lead time" (con `MetricHint`) y "OC abiertas".
- **Tarjetas**: `KpiCard` (x4), `MiniRank` (x3; lista nombre/valor/subtítulo con tono rojo/verde/ámbar), `Card` de temporada con enlaces.
- **Badges**: `Badge` (categorías, temporada), `StatusBadge kind="supplier"` (estado).
- No hay formularios de datos en esta pantalla.

### Campos de formularios
No aplica (pantalla de solo lectura/consulta; los únicos "inputs" son la búsqueda de texto y el select de estado, que son filtros, no un formulario de datos).

### Estados posibles (existentes vs. no aplican por mock)
- **Con resultados**: tabla poblada (caso normal con datos mock).
- **Filtrado sin coincidencias**: `filtered` vacío → la tabla quedaría vacía y el resumen mostraría "0 proveedores". *No se observa un `EmptyState` explícito en esta página; depende del componente `DataTable`.* — **Definición pendiente**: comportamiento visual exacto de la tabla sin filas.
- **Panel de temporada oculto**: si `entranTemporada.length === 0`, el bloque no se renderiza.
- **Estados de proveedor**: los 5 estados (`active/review/delayed/blocked/inactive`) existen en el tipo; su aparición depende de los datos mock cargados.
- Estados de **carga/error de red no aplican**: datos mock en memoria (sin fetch asíncrono).

### Navegación hacia otras pantallas
- Fila de tabla → `/proveedores/:id` (Detalle).
- Panel temporada → `/proveedores/:id?tab=temporadas`.
- Entrada por menú lateral ("Proveedores → Performance") y por búsqueda global del `Topbar` (`to: /proveedores/${s.id}`).

### Flujo funcional completo
1. El usuario abre "Proveedores".
2. Ve KPIs y rankings del conjunto; opcionalmente filtra por nombre/RUT o estado (los KPIs se recalculan sobre el subconjunto filtrado; rankings y temporada usan el universo completo).
3. Detecta proveedores críticos (peor cumplimiento, lead time alto) o próximos a temporada.
4. Hace clic para abrir la ficha del proveedor y profundizar/preparar negociación.

### Reglas de negocio inferibles
- **Semáforo de cumplimiento**: `<70` rojo, `70–84` ámbar, `≥85` verde.
- **Monto pendiente** `> 20.000.000` se resalta en ámbar (umbral de riesgo de concentración).
- **Fill rate / despacho** (`supplierFulfillment`, ver detalle en Reglas del módulo): proviene de recepciones en estado `received | partial | with_issues`; si no hay órdenes arribadas se muestra "—" (aunque internamente `fillRate` cae a 100). Si hay SKUs con recibido < pedido, se indica el conteo en rojo.
- **Ordenamiento del panel de temporada**: prioriza proveedores `classification.risky` y luego menor cantidad de días al peak (`preSeason.days`, los más urgentes primero).
- **Rankings** siempre top 4.

### Validaciones
No hay validaciones de formulario (solo filtros). La búsqueda hace `trim` y comparación case-insensitive.

### Permisos/restricciones
No se observan restricciones por rol en el código de la página ni en la definición de ruta/nav. **Suposición**: sin gating específico.

### Dudas / definiciones pendientes
- ¿La ruta debe estar restringida a algún rol? (hoy no lo está).
- Comportamiento exacto de `DataTable` cuando el filtro no arroja resultados (¿empty state?).
- La divergencia entre `useCollection` (listado) y lectura directa del mock (detalle) podría causar inconsistencias si en el futuro se editan proveedores en runtime.

---

## Pantalla 2 — Detalle / Ficha de proveedor

### Nombre
Detalle de proveedor (ficha del proveedor con pestañas).

### Ruta(s)
- `/proveedores/:id` (componente `SupplierDetailPage`, carga lazy).
- Soporta deep-link a pestaña vía querystring `?tab=<valor>` (estado inicial `searchParams.get("tab") ?? "ficha"`). Valores válidos: `ficha`, `negociacion`, `temporadas`, `productos`, `ordenes`, `recepciones`, `alertas`.

### Módulo
Proveedores.

### Objetivo funcional
Consolidar en una sola ficha toda la información para **atender, evaluar y negociar** con un proveedor: KPIs de servicio, resumen comercial ("Para atender al proveedor"), cockpit de negociación, posición negociadora, más vendidos / productos detenidos, y pestañas de profundización.

### Tipo de usuario
Igual que el listado: sin gate de rol detectado. **Suposición**: `comprador` y `lider`. La capacidad de editar condiciones/registrar acuerdos (pestaña Negociación) está disponible **sin verificación de rol**.

### Descripción detallada
La página resuelve el proveedor por `id` con `suppliers.find(s => s.id === id)`. Si no existe, muestra `EmptyState` "Proveedor no encontrado" (descripción `No existe el proveedor "<id>".`) con botón "Volver a proveedores". Si existe, cruza el proveedor con:
- `supProducts` = `products` con `supplierName === supplier.name`.
- `supSkus` = set de SKUs de esos productos.
- `supPOs` = `purchaseOrders` con `supplierName === supplier.name`; `openPOs` = las que NO están en `["received","cancelled"]`.
- `supReceptions` = `receptions` con `supplierName === supplier.name`.
- `supAlerts` = `alerts` cuyo `relatedEntity === supplier.name` o cuyo `relatedSku ∈ supSkus`.
- `riskProducts` = nº de `supProducts` con `availableStock <= 0 && salesLast30Days > 0`.
Renderiza una cabecera fija (siempre visible) más un `Tabs` que conmuta el contenido inferior.

### Información que muestra

**Cabecera (siempre visible):**
- `PageHeader` con breadcrumb "Proveedores" → nombre, subtítulo "`RUT` · `categorías`", y `StatusBadge kind="supplier"` como `action`.
- **4 KPIs** (`KpiCard`):
  - "Cumplimiento" (`formatPercent(deliveryCompliance,0)`, semáforo bad/warn/good por 70/85, descripción "Entregas a tiempo", `MetricHint cumplimiento`).
  - "Lead time" (`formatDays`, `tone="warn"` si `≥15`, descripción "Promedio de entrega", `MetricHint leadTime`).
  - "OC abiertas" (`openPOs.length`, `tone="info"`, descripción "Ver órdenes", **`onClick` → `setTab("ordenes")`**, `active` cuando `tab==="ordenes"`).
  - "Monto pendiente" (`formatCurrencyCompact(pendingAmount)`, `tone="warn"` si `> 20000000`, `MetricHint pendiente`).
- **Banner de revisión** (condicional): aparece si `status === "delayed"` o `status === "review"` o `deliveryCompliance < 70`. Texto: "**Revisar proveedor:** cumplimiento X%" + (si `leadTime ≥ 15`) "· lead time alto (Xd)" + (si `riskProducts > 0`) "· N SKU en quiebre" + "· última compra `<fecha>`".
- **Panel "Para atender al proveedor"** (5 celdas):
  - "Importancia" (`Badge` con `importance.label/tone`).
  - "Venta 30 días" (`formatCurrencyCompact(ventas30)`).
  - "Margen promedio" (`formatPercent(margenProm,1)`, verde).
  - "Utilidad 30 días" (`formatCurrencyCompact(utilidad30)`, verde).
  - "OC atrasadas" (**`<button>` → `setTab("ordenes")`**; `delayedPOs.length`, rojo si `> 0`).
- **Cockpit de negociación** (`Card`, `NegotiationAgendaItem` x4, numerados 1–4):
  1. **"Costo"**: "`N` SKU subieron más de 5%. Impacto potencial en margen: `<monto>`." — Pedir: "recuperación de margen, descuento por volumen o lista escalonada." — tono ámbar si `costIncreaseProducts.length > 0`, si no verde.
  2. **"Productos detenidos"**: "`N` SKU · `<capital>` inmovilizados." — Pedir: "devolución, nota de crédito, apoyo promocional o cambio por otros SKU." — tono rojo si hay detenidos, si no verde.
  3. **"Cumplimiento"**: "**OTIF** `X%` · `N` OC atrasadas." — Pedir: "objetivo de servicio, lead time realista y plan para atrasos." — tono ámbar si `delayedPOs.length > 0 || deliveryCompliance < 85`, si no verde. **Nota**: el valor rotulado "OTIF" usa `deliveryCompliance` (puntualidad), no un OTIF combinado (ver Definiciones pendientes).
  4. **"Oportunidad"**: "`N` SKU crecen sobre 25% con cobertura corta." — Pedir: "capacidad, prioridad de despacho y precio por volumen." — tono azul si hay, si no neutral.
- **Posición negociadora** (`Card`):
  - "Posición": `negotiationPower` ("Media-alta" / "Media" / "Baja") + `Badge` verde/ámbar con "`X%` con alternativa".
  - Frase: "`N` productos concentran `X%` de la venta y `Y%` de la utilidad del proveedor." (`topSupplierProducts` = top 10 por venta 30d).
  - 4 métricas (`SupplierCockpitMetric`): "Compras 90d", "Productos activos", "Alternativas", "Detenidos".
- **Más vendidos (30 días)** (`Card`): top 5 `supProducts` con `salesLast30Days > 0` por venta 30d; cada uno con "N u. · margen X%" y monto; `Link` a `/productos/:sku`. Vacío: "Sin ventas registradas."
- **Productos detenidos** (`Card`): `detenidos` (`purchaseStatus === "overstock"` o `salesLast30Days === 0 && availableStock > 0`); badge "Sin venta" (rojo, si ventas=0) / "Sobrestock" (violeta); muestra hasta 5 y "+N más · ver pestaña Productos". Vacío: "Sin sobrestock ni productos sin venta. 👍".

**Contenido por pestaña** (ver secciones específicas más abajo): Ficha, Negociación, Temporadas, Catálogo, Órdenes, Recepciones, Alertas.

### Secciones/bloques
1. `PageHeader` + `StatusBadge`.
2. Grid de 4 `KpiCard`.
3. Banner de revisión (condicional).
4. Panel "Para atender al proveedor" (5 celdas; la última es `<button>`).
5. Cockpit de negociación (`NegotiationAgendaItem` x4).
6. Posición negociadora (`SupplierCockpitMetric` x4).
7. Más vendidos / Productos detenidos (2 `Card`).
8. `Tabs` (7 pestañas, con `count` en Catálogo/Órdenes/Recepciones/Alertas) + contenido conmutado.

### Filtros disponibles
- No hay filtros de búsqueda en la ficha. Los únicos "selectores" son el `Tabs` (pestañas) y, dentro de la pestaña Negociación, un conmutador de vista de la tabla "Datos clave para negociar" (Más vendidos / Más días de inventario / Menor margen / Mayor ganancia).

### Acciones del usuario
- Cambiar de pestaña (`Tabs`).
- Clic en KPI "OC abiertas" o en la celda "OC atrasadas" → `setTab("ordenes")`.
- Navegar a productos (`/productos/:sku`), a otros proveedores alternativos (`/proveedores/:id`), a seguimiento de OC (`/comprar/seguimiento?oc=...`) y a recepciones (`/recepciones?rid=...`).
- En pestaña Negociación: **editar condiciones comerciales** y **registrar acuerdos** (única escritura de datos del módulo).
- Volver a proveedores desde el estado "no encontrado" o desde el breadcrumb.

### Botones y controles
- `Tabs` con contadores (`count`) en Catálogo, Órdenes, Recepciones, Alertas.
- KPI "OC abiertas" clicable; celda "OC atrasadas" es un `<button>`.
- Botones "Editar" (condiciones) y "+ Registrar" (acuerdo) en la pestaña Negociación (sección Términos/Acuerdos).
- Conmutador de vistas (chips) en la tabla "Datos clave para negociar".
- Enlaces (`Link`) en listados y tablas.
- `MetricHint` (ayuda) en varios indicadores.

### Tablas / tarjetas / formularios / componentes
- Tarjetas KPI, `Card`/`CardHeader`/`CardBody`, `Badge`, `StatusBadge`, `AlertCard`, `EmptyState`, `Tabs`, `Button`, `Modal`, `ConfirmModal`, `Input`, `GStat`, `MonthlyBars` (barras de estacionalidad), heatmap de 12 meses.
- Tablas: "Datos clave para negociar" (Negociación) y "Comparación año contra año" (Temporadas).
- Formularios (modales) en pestaña Negociación: "Editar condiciones comerciales" y "Registrar acuerdo".

### Campos de formularios
Ver sección **Pestaña Negociación → 2B. Condiciones y acuerdos** (los únicos formularios del módulo).

### Estados posibles (existentes vs. no aplican por mock)
- **Proveedor no encontrado**: `EmptyState` + botón "Volver a proveedores" (existe).
- **Banner de revisión** visible/oculto según estado y cumplimiento.
- Cada pestaña tiene su **estado vacío** propio (Catálogo "Sin productos", Órdenes "Sin órdenes", Recepciones "Sin recepciones", Alertas "Sin alertas" usan `EmptyState`; Más vendidos y Productos detenidos usan texto).
- Estados de carga/error de red **no aplican** (datos mock).

### Navegación hacia otras pantallas
- Breadcrumb → `/proveedores`.
- `/productos/:sku` (detalle de producto) desde múltiples listados.
- `/proveedores/:id` (otros proveedores alternativos, en Negociación / Riesgo y dependencia).
- `/comprar/seguimiento?oc=<number>` (seguimiento de OC) desde pestaña Órdenes.
- `/recepciones?rid=<id>` desde pestaña Recepciones.
- Deep-link entrante `?tab=...` (desde el listado, `MyPanel ?tab=negociacion`, `CategoryDetail`, búsqueda global, etc.).

### Flujo funcional completo
1. Llega el usuario (desde listado, temporada, búsqueda global, categoría o panel personal).
2. Lee KPIs de servicio y el resumen "Para atender al proveedor".
3. Revisa el cockpit de negociación (qué pedir) y la posición negociadora (cuánta palanca tiene).
4. Profundiza en pestañas: ficha maestra, negociación detallada, temporadas, catálogo, órdenes, recepciones, alertas.
5. Registra condiciones/acuerdos negociados (se persisten localmente).

### Reglas de negocio inferibles (cabecera)
- **Importancia** (`importance`): `share ≥ 0.6` o `associatedSkus ≥ 200` → "Estratégico" (violet); `share ≥ 0.3` o `associatedSkus ≥ 100` → "Importante" (blue); resto "Secundario" (neutral). `share = purchasedAmountLast90Days / max(1, máx compra90d del panel)`.
- **Posición negociadora** (`negotiationPower`): si `alternativeProducts.length / max(1, supProducts.length) ≥ 0.45` → "Media-alta"; si `purchasedAmountLast90Days > 120.000.000` → "Media"; resto "Baja". `alternativeProducts` = productos con `equivalencias.length > 0`.
- **Productos detenidos**: `purchaseStatus === "overstock"` o (`salesLast30Days === 0 && availableStock > 0`).
- **Alza de costo** (`costIncreaseProducts`): `costoAnterior && cost > costoAnterior * 1.05` (>5%). Impacto = Σ `salesLast30Days * (cost − costoAnterior)`.
- **Oportunidad restringida** (`growingConstrained`, sobre top 10): `growth ≥ 0.25` con `salesLast30Days > 0` y cobertura `availableStock / (salesLast30Days/30) ≤ supplierLeadTimeDays * 2`. `growth` = `(salesLast30Days − salesLast90Days/3) / (salesLast90Days/3)`.
- **SKU en quiebre / riesgo** (`riskProducts`): `availableStock ≤ 0` y `salesLast30Days > 0`.
- **OC atrasadas** (`delayedPOs`): `status === "delayed"` o `delayedDays > 0`.
- **Concentración**: `topSalesShare`/`topProfitShare` = participación de los top 10 productos en la venta/utilidad 30d del proveedor.
- Umbrales de color reutilizados: cumplimiento 70/85, lead time 15, pendiente 20M.

### Validaciones
Solo en los formularios de la pestaña Negociación (ver detalle allí). El resto es lectura.

### Permisos/restricciones
Sin gating de rol detectado. La capacidad de editar condiciones/registrar acuerdos está disponible sin verificación de rol en el componente.

### Dudas / definiciones pendientes
- En el cockpit el ítem "Cumplimiento" etiqueta el valor como **OTIF** pero usa `deliveryCompliance` (puntualidad), mientras que la pestaña Negociación sí calcula un OTIF combinando cumplimiento × fill. **Inconsistencia de nomenclatura / Definición pendiente**.
- La ficha usa `suppliers` mock directo (no `useCollection`), a diferencia del listado.

---

### Pestaña "Ficha" — Ficha maestra + evaluación (`SupplierMaster`)

- **Objetivo**: datos maestros, contactos, condiciones, documentos tributarios, acuerdos marco y evaluación multidimensional.
- **Información que muestra**:
  - **"Ficha del proveedor"** (descripción "Datos maestros, contactos y condiciones comerciales."): RUT, Estado (`StatusBadge`), "Condición de pago" (`condicionPago ?? "—"`), "Plazo de entrega" (`plazoEntregaDias` si existe, si no `averageLeadTimeDays`, con `formatDays`), "Mínimo de compra" (según `minimoCompraTipo`: `"unidades"` → "`N` u." con `formatNumber`; si no → `formatCurrency`; "—" si nulo), "Categorías" (join ", "). Bloque **"Marcas que representa"** (badges) si `marcas.length > 0`.
  - **Contactos** (3 `ContactCard`): "Comercial", "Logística", "Cobranza" (nombre, email, teléfono; "Sin contacto registrado" si falta el contacto).
  - **"Evaluación del proveedor"** (`Card` con `Badge` `score/100` y semáforo verde ≥85 / ámbar ≥70 / rojo <70; descripción textual: "Score ponderado. Fecha y cantidad son datos reales; el resto es simulado (demo)."). Barra por dimensión (color por `scoreTone(value)`), con valor a la derecha.
    - **Dimensiones y pesos**: "Cumplimiento de fecha" (0.28), "Cumplimiento de cantidad" (0.22), "Calidad" (0.18), "Exactitud de factura" (0.12), "Exactitud documental" (0.10), "Estabilidad de precios" (0.10). `score = round(Σ value·peso)`.
    - **Origen de cada dimensión** (función `supplierEvaluation`, determinista por `h = hashString(supplier.id)`):
      - "fecha" = `round(deliveryCompliance)` — **real**.
      - "cantidad" = `perf.fillRate` (real) o, si es 0, `max(40, round(deliveryCompliance − 4 + (h%10)))` — real/fallback.
      - "calidad" = `70 + (h % 26)` (rango 70–95) — **simulado**.
      - "factura" = `91 + (h % 9)` (91–99) — **simulado**.
      - "documentos" = `80 + ((h>>3) % 18)` (80–97) — **simulado**.
      - "precios" = `78 + ((h>>5) % 22)` (78–99) — **simulado**.
  - **"Documentos tributarios"**: lista `documentosTributarios` (tipo, número en `font-mono`, "· vence `<fecha>`" si `vence`, `Badge` "Vigente"/"Vencido" según `vigente`). "Sin documentos registrados." si vacío.
  - **"Acuerdos comerciales"**: lista `acuerdosComerciales` (`titulo` + `detalle`). "Sin acuerdos registrados." si vacío.
- **Acciones**: solo lectura (no hay controles interactivos en esta pestaña).
- **Estados vacíos**: contactos sin registro, sin documentos, sin acuerdos, sin marcas.
- **Reglas de negocio**: semáforo de evaluación 70/85; ponderación fija de dimensiones.
- **Dudas**: la evaluación **no es 100% real** (4 de 6 dimensiones simuladas). No hay acción para recalcular o editar la evaluación.

---

### Pestaña "Negociación" — Cuenta comercial + condiciones/acuerdos

Combina dos componentes renderizados en `space-y-4`: `SupplierNegotiation` (arriba) y `SupplierTermsAgreements` (abajo).

#### 2A. `SupplierNegotiation` — vista de cuenta comercial (solo lectura)
- **Objetivo**: ver el proveedor como cuenta comercial para preparar la negociación.
- **Información que muestra** (bloques en orden):
  - **"Rol del proveedor"** (recuadro con `Badge` + tip + "· proveedor #N por compra"). Roles y prioridad:
    - "Problemático" (rojo) si `problem && relevant`. Tip: "Controlar riesgo: exigir cumplimiento, aplicar penalidades y desarrollar un proveedor alternativo."
    - "Estratégico" (violet) si `strategic`. Tip: "Relación de largo plazo: crecimiento conjunto, campañas, exclusividad y abastecimiento asegurado."
    - "Crítico" (ámbar) si `relevant`. Tip: "Priorizar continuidad, cumplimiento y stock; el precio es secundario."
    - "Reemplazable" (azul) si `alternativas.length > 0`. Tip: "Negociar fuerte costo, plazo, flete y bonificaciones; hay alternativas."
    - "De oportunidad" (slate) en otro caso. Tip: "Compras tácticas: liquidaciones y campañas puntuales."
  - **"Resultado comercial"** (5 `GStat`; descripción "Cuánto mueve y cuánto deja este proveedor"): "Venta anual (est.)" (`ventas30 × 12`), "Venta 30 días", "Margen promedio" (ámbar si `<25`), "Utilidad 30 días" (verde), "Compra anual (est.)" (`purchasedAmountLast90Days × 4`, sub "lo que le compras").
  - **"Cumplimiento y abastecimiento"** (6 `GStat`; descripción "¿Ayuda o perjudica la disponibilidad?"): "Fill rate" (`${fillRate}%` si `arrivedOrders > 0`, si no "—"; bad si `<90`; `MetricHint fillRate`), "OTIF" (`round(deliveryCompliance × fillRate / 100)`; warn si `<85`; `MetricHint otif`), "Cumplimiento" (semáforo 70/85; `MetricHint cumplimiento`), "Lead time" (warn si `≥15`; `MetricHint leadTime`), "OC atrasadas" (bad si `>0`), "Venta perdida" (Σ `salesLast30Days × price` de SKU en quiebre; sub "`N` SKU en quiebre").
  - **"Participación por categoría"** (descripción "Su peso e impacto en margen"): por cada categoría del proveedor, barra con % de participación (`supCat/catTotal` de venta 30d) ordenado desc.; línea "Margen proveedor `X%` vs categoría `Y%`" (`catMeta.averageMargin` de `mockCategories`).
  - **"Mix de productos"** (descripción "Qué potenciar, mantener o liquidar"): 3 `GStat` — "En quiebre" (`availableStock ≤ 0 && salesLast30Days > 0`), "Sin rotación" (`salesLast30Days === 0 && availableStock > 0`), "En caída" (`salesLast90Days > 0 && salesLast30Days > 0 && salesLast30Days < (salesLast90Days/3) * 0.8`). Debajo, "Top vendidos" (top 5, enlaces a producto). Vacío: "Sin ventas registradas."
  - **"Datos clave para negociar"** (tabla, top 10; descripción "Top 10 según la vista elegida. Ordena por lo que quieras poner sobre la mesa."): chips conmutadores "Más vendidos" (`venta`), "Más días de inventario" (`dias`), "Menor margen" (`margen`, orden ascendente), "Mayor ganancia" (`ganancia`). Columnas: **"Producto"** (nombre + SKU + "vende N/mes"), **"Venta 30d"**, **"Días inv."** (ámbar si `≥90`), **"Margen"** (rojo `<20`, ámbar `<30`), **"Ganancia 30d"** (`salesLast30Days × (price − cost)`). La columna correspondiente a la vista activa se resalta (encabezado y celda). Vacío: `EmptyState` "Sin productos".
  - **"Riesgo y dependencia"**: 2 `GStat` — "Dependencia" ("Alta" si `maxPart ≥ 40`, "Media" si `≥ 20`, "Baja"; sub "`X%` de su categoría top") y "Alternativas" (nº `alternativas`; warn si 0; sub "proveedores que pueden cubrir"). Si `alternativas.length > 0`, lista "Proveedores alternativos" con lead y cumplimiento, enlace a `/proveedores/:id`.
  - **"Próxima negociación"** (descripción "Qué exigir y con qué argumentos"): "Objetivos sugeridos" (lista dinámica) y "Palancas a tu favor" (lista dinámica).
- **Reglas de negocio inferibles**:
  - `alternativas` = proveedores con `id !== supplier.id`, `status !== "inactive"` y alguna categoría en común.
  - `problem = deliveryCompliance < 70 || perf.fillRate < 80`; `strategic = share ≥ 0.6 || associatedSkus ≥ 200`; `relevant = share ≥ 0.3 || associatedSkus ≥ 100`. `share = purchasedAmountLast90Days / max(1, máx compra90d)`.
  - `rankingProv` = posición 1-based del proveedor al ordenar por `purchasedAmountLast90Days` desc.
  - `maxPart` = mayor % de participación entre sus categorías; `otif = round(deliveryCompliance × fillRate / 100)` (0 si alguno es falsy).
  - **Objetivos sugeridos** (condicionales, en este orden): `fillRate < 95` → "Asegurar fill rate ≥ 95% (hoy X%)…"; `deliveryCompliance < 85` → "Subir cumplimiento de entrega a 95%…"; `averageLeadTimeDays ≥ 12` → "Reducir lead time… o acordar despacho semanal"; `ventaPerdida > 0` → "Stock de seguridad para frenar venta perdida (~X/mes)"; `sinRotacion.length > 0` → "Apoyo del proveedor para liquidar N producto(s) sin rotación"; **siempre** → "Usar el volumen (~compra anual) para rebate, plazo 60 días y flete".
  - **Palancas** (siempre): volumen anual + ranking; alternativas (o "Sin alternativas: cuidar la relación…"); participación en categoría top (si `maxPart > 0`).
  - Venta/compra anual son **estimaciones** (`×12` y `×4`). **Suposición** de anualización simple.
- **Datos mock**: OTIF, participación, venta perdida, roles, etc., derivados de mocks; fill rate viene de `supplierFulfillment` (recepciones mock).
- **Acciones**: navegar a productos y a proveedores alternativos; conmutar la vista de la tabla. Solo lectura de datos.

#### 2B. `SupplierTermsAgreements` — Condiciones comerciales y acuerdos (EDITABLE / persistente)
- **Objetivo**: registrar y consultar las condiciones comerciales acordadas y el historial de acuerdos/seguimientos. **Única funcionalidad de escritura del módulo.**
- **Persistencia** (`localStorage` vía `useLocalStorage`):
  - `compras:terms:<supplier.id>` (objeto `SupplierTerms`).
  - `compras:agreements:<supplier.id>` (array `Agreement`).
- **"Condiciones comerciales"** (`Card` con acción "Editar"; descripción "La foto completa de lo acordado hoy"):
  - Valores por defecto (`DEFAULT_TERMS`): `paymentDays: 30`, `freight: "Por pagar (cliente)"`, `minOrder: "$500.000"`, `baseDiscount: 0`, `rebate: "Sin rebate vigente"`, `returns: "Solo por falla · 30 días"`, `marketing: "Sin apoyo acordado"`, `account: "—"`.
  - Se muestran 8 filas (`termRows`): "Plazo de pago" (`${paymentDays} días`), "Descuento base" (`${baseDiscount}%`), "Flete", "Mínimo de compra", "Rebate / bonificación", "Devoluciones", "Apoyo marketing", "Ejecutivo asignado".
  - **Campos del formulario (modal "Editar condiciones comerciales", `size="lg"`, description = `supplier.name`)**:
    - "Plazo de pago (días)" — `Input type="number" min={0}` → `paymentDays` (`Number(...)`).
    - "Descuento base (%)" — `Input type="number" min={0}` → `baseDiscount`.
    - "Flete" — texto libre.
    - "Mínimo de compra" — texto libre (string, incluye símbolo).
    - "Rebate / bonificación" — texto libre.
    - "Devoluciones" — texto libre.
    - "Apoyo marketing" — texto libre.
    - "Ejecutivo asignado" — texto libre.
  - **Controles**: botón "Editar" (abre modal, resetea `draft = terms`); footer "Cancelar" y "Guardar" (deshabilitado si `!termsDirty`; muestra "Sin cambios").
  - **Validación / control de cambios**: `termsDirty` = `JSON.stringify(draft) !== JSON.stringify(terms)`. Cerrar con cambios sin guardar (`closeTerms`) abre `ConfirmModal` "Descartar cambios" (mensaje "Tienes cambios sin guardar…"; confirmar "Descartar cambios" / cancelar "Seguir editando", `danger`). Al guardar: `toast.success("Condiciones comerciales actualizadas")`.
- **"Acuerdos y seguimiento"** (`Card` con botón "+ Registrar"; descripción "Qué se pidió, qué se acordó y el próximo seguimiento"):
  - Lista (más reciente primero; alta hace `prepend`) de acuerdos: fecha (`formatDate`), `Badge` "Seguir `<fecha>`" (ámbar) si hay `followUp`, "Objetivo:" (obligatorio) y "Acordado:" (verde, si existe).
  - Estado vacío: "Sin acuerdos registrados. Registra lo conversado en la próxima reunión."
  - **Campos del formulario (modal "Registrar acuerdo", description = `supplier.name`)**:
    - "Fecha" — `Input type="date"` (valor inicial fijo **`"2026-06-26"`**).
    - "Objetivo / lo pedido" — texto (placeholder "Ej: Bajar costo 5% y fill 95%").
    - "Lo acordado" — texto (placeholder "Ej: 3% + despacho semanal").
    - "Próximo seguimiento" — `Input type="date"`.
  - **Validación**: al guardar (`saveAgr`), si `!objective.trim()` → `toast.warning("Indica al menos el objetivo")` y no guarda. Con objetivo válido → prepend a la lista + `toast.success("Acuerdo registrado")`.
  - **Controles**: botón "+ Registrar" (`Button size="sm" variant="secondary"`), footer "Cancelar"/"Guardar".
- **Estados posibles**: sin acuerdos (vacío) / con acuerdos; condiciones por defecto vs. editadas; modal con cambios (`dirty`) vs. sin cambios.
- **Reglas de negocio**: el `id` del acuerdo se genera con `` `ag${Date.now()}` ``; `objective` obligatorio, resto opcional; datos aislados por proveedor (clave con `supplier.id`).
- **Dudas / pendientes**:
  - La **fecha por defecto del acuerdo está hardcodeada** en `"2026-06-26"` (no usa la fecha actual). **Definición pendiente / posible bug** (hoy es 2026-07-13).
  - No hay **edición ni borrado** de acuerdos existentes (solo alta y visualización).
  - Persistencia local por navegador: los datos **no se comparten** entre usuarios/dispositivos (limitación de la demo mock).

> Nota: al final de `SupplierTermsAgreements.tsx` hay un comentario sobre la "Evaluación del proveedor (score 0–100)" con dimensiones reales y simuladas; la implementación real de esa evaluación reside en `SupplierMaster.tsx` (pestaña Ficha).

---

### Pestaña "Temporadas" — Estacionalidad (`SeasonView`)
- **Objetivo**: analizar la estacionalidad del proveedor y qué negociar antes del peak. Toda la data proviene de `supplierSeasonality(supplier.name)`, que **genera 24 meses de venta/margen/quiebres/fill de forma determinista** según el perfil de la categoría (construccion, jardin, herramientas, pinturas, flat) escalado por la venta 30d real de sus productos. Es **data simulada** (mock/demo).
- **Constantes de la simulación** (`seasonality.ts`): `CURRENT_YEAR = 2026`, `CURRENT_MONTH = 5` (Junio); serie de 24 meses terminando en 2026-06; factores anuales `yearFactor` = `{2024: 0.85, 2025: 0.95, 2026: 1.0}`. Perfiles por categoría son multiplicadores mensuales fijos (p. ej. jardín tiene peak en Ene/Nov/Dic, herramientas en Jun/Nov).
- **Información que muestra**:
  - **Alerta de pre-temporada** (condicional a `preSeason`): "⏳ **Entra en temporada alta en ~N días** (peak histórico en `<mes>`). Stock actual y fill `X%` · lead `<días>`. Conviene negociar la OC y el stock reservado ahora." Los "días" son `off * 30` (meses×30, no días reales).
  - **KPIs (7 `GStat`)**: "Venta 12m", "vs 12m previos" (`varPct`, verde/rojo), "Margen prom." (ámbar si `<25`), "Quiebres 12m" (bad si `≥8`), "Fill rate" (`MetricHint fillRate`; bad si `<90`), "Venta perdida" (sub "12 meses"), "Score temporada" (sub "0-100"; semáforo **≥80 verde / ≥60 ámbar / <60 rojo**).
  - **"Comportamiento"** (`Badge` con `classification.label`): valores reales **"Estacional fuerte"** / **"Estacional suave"** / **"Permanente"**, con sufijo **" · riesgo de quiebre"** si `classification.risky`. Muestra "Meses clave: `<peakMonths>`".
  - **Heatmap "Estacionalidad (últimos 12 meses)"** (descripción "Intensidad de venta y quiebres por mes"): 12 celdas coloreadas `rgba(31,73,214, 0.12 + intensity*0.8)` (`intensity = sales/maxSales`; texto blanco si `intensity > 0.55`); muestra "⚠`N`" si hay quiebres ese mes; tooltip con venta y quiebres. Leyenda: "Más oscuro = más venta. ⚠ = quiebres ese mes."
  - **"Curva de venta (12 meses)"** (`MonthlyBars`, descripción "Tendencia y meses peak"): destaca meses con `sales ≥ last12avg * 1.1` (**≥110% del promedio**).
  - **"Comparación año contra año"** (tabla): columna "Mes" + una columna por año (`years`) + "Var. último año" (`vNow/vPrev − 1`, verde/rojo). Filas de peak (`peakMonths`) resaltadas con etiqueta "peak". Leyenda: "Filas resaltadas = meses de temporada alta…".
  - **"Estacionalidad por producto"** (top 10 SKU por venta 30d): cada SKU con `Badge` de tipo — "Campañero" (amber), "Estacional fuerte" (violet), "Estacional suave" (blue) o "Permanente" (slate) — más `insight`, `peakMonth` y "`X%` en temporada". Enlace a producto. Vacío: "Sin productos para clasificar."
  - **Guía "Pretemporada" / "Temporada" / "Postemporada"**: 3 tarjetas con checklist fijo de acciones por fase.
  - **"Top productos de temporada"** (top 6): tipo ("Estacional"/"Extendida"/"Permanente" según `ratio`), margen, venta, y `Badge` de acción ("Liquidar postemporada" / "Asegurar stock / despacho" / "Reforzar antes de temporada" / "Mantener stock base").
  - **"Conclusión y recomendación"**: texto generado (`recommendation`), variable según `risky` / "Permanente" / temporada marcada.
- **Acciones**: navegar a productos; consultar `MetricHint fillRate`. Solo lectura.
- **Estados vacíos**: "Sin productos para clasificar" (SKU); alerta de pre-temporada solo si aplica.
- **Reglas de negocio inferibles** (`seasonality.ts`):
  - `classification`: `ratio = peakMult/avgMult`; `ratio ≥ 1.3` → "Estacional fuerte" (violet), `≥ 1.12` → "Estacional suave" (blue), si no "Permanente" (slate). `risky = fill < 85 && quiebres12 ≥ 8` (fuerza tono rojo y sufijo).
  - `peakMonths`: meses con `mult ≥ avgMult * 1.12`.
  - `preSeason` solo si `ratio ≥ 1.12`: primer mes (dentro de 6) con `profile[idx] ≥ avgMult*1.15` y `profile[prev] < avgMult*1.15`; `days = off*30`.
  - `score` = `round(0.4·ventaScore + 0.2·margenScore + 0.2·fill + 0.1·invScore + 0.1·postScore)`; `invScore = clamp(100 − quiebres12·2)`; `postScore = 70` si hay sobrestock, si no `90`.
  - `fill` = `perf.fillRate` si hay recepciones arribadas, si no `deliveryCompliance` (o 90). `leadTime` = `averageLeadTimeDays` (o 10).
  - Semáforos de `GStat`: score 80/60, margen `<25` ámbar, quiebres `≥8` rojo, fill `<90` rojo.
- **Datos mock**: **toda la serie temporal es simulada** por perfil de categoría — no representa historia real.
- **Corrección respecto a versiones previas del levantamiento**: el badge de "Comportamiento" **no** muestra `"constante"/"permanente_peak"/"estacional"` (esas etiquetas pertenecen a la función `demandType`, que **no se usa** en esta vista); muestra las etiquetas de `classification` descritas arriba.

---

### Pestaña "Catálogo" (productos del proveedor)
- Lista `supProducts` (`supplierName === supplier.name`). Descripción del card: "Cómo compra Mimbral cada producto a este proveedor: código, unidades, múltiplo, costo y equivalencias." Estado vacío `EmptyState` "Sin productos" ("Este proveedor no tiene SKUs asociados.").
- Por producto muestra: nombre + SKU (enlace a `/productos/:sku`), categoría, "disp. N", "vende N/mes", costo (`formatCurrency`), **delta de costo** vs `costoAnterior` (▲ rojo / ▼ verde con "`X%` vs `<costo anterior>`", solo si difieren), descuento vigente ("Dscto. `X%`" si `descuentoVigentePct`), "Cód. prov." (`codigoProveedor`, `font-mono`), "EAN" (`codigoBarras`, `font-mono`), "Compra `<unidadCompra>` · vende `<unidadVenta>`" (si alguno existe), "Múltiplo `N`" (si `multiploCompra`), "N equivalente(s) en otros proveedores" (con `title` que lista costos de `equivalencias`), y `StatusBadge kind="purchase"` del `purchaseStatus`.
- Solo lectura.

### Pestaña "Órdenes"
- Lista `supPOs` (`supplierName === supplier.name`). Estado vacío "Sin órdenes" ("No hay órdenes de compra con este proveedor.").
- Por OC: `number`, "espera `<expectedDate>` · `<totalAmount>`", `Badge` rojo "`N` d" si `delayedDays > 0`, `StatusBadge kind="purchaseOrder"`.
- Enlace a `/comprar/seguimiento?oc=<number>` (`encodeURIComponent`).

### Pestaña "Recepciones"
- Lista `supReceptions`. Estado vacío "Sin recepciones" ("No hay recepciones registradas de este proveedor.").
- Por recepción: `poNumber`, "`<warehouse>` · espera `<expectedDate>` · `conforme`/`con observación`" (según `qualityOk`), `Badge` con `RECEPTION_STATUS[status]` (label + tone).
- Enlace a `/recepciones?rid=<id>` (`encodeURIComponent`).

### Pestaña "Alertas"
- Muestra `AlertCard` (`compact`) para `supAlerts` (alertas cuyo `relatedEntity === supplier.name` o cuyo `relatedSku ∈ supSkus`). Grid de 2 columnas. Estado vacío "Sin alertas" ("Este proveedor no tiene alertas activas.").

---

## Reglas del módulo — `supplierFulfillment` (despacho/fill) y ayuda de métricas

- **`supplierFulfillment(name)`** (`utils/supplierPerf.ts`): calcula el despacho desde `receptions` en estado `received | partial | with_issues` (constante `ARRIVED`). Suma `expected`/`received` por línea (o `unitsExpected`/`unitsReceived` si no hay `items`); cuenta `undeliveredSkus` (líneas con `received < expected`).
  - `fillRate = round(unitsReceived / unitsExpected * 100)`; **si `unitsExpected` es 0 → `fillRate = 100`** (pero la UI muestra "—" cuando `arrivedOrders === 0`). Este default a 100 afecta OTIF, la regla `problem` (`fillRate < 80`) y los objetivos sugeridos (`fillRate < 95`) para proveedores sin recepciones.
  - `compliance` = `deliveryCompliance` del maestro (o null); `comp = compliance ?? 100`.
  - **Rating combinado** (`ratingLabel`/`tone`): `fillRate ≥ 98 && comp ≥ 85` → "Cumple bien" (green); `fillRate ≥ 90 && comp ≥ 70` → "Irregular" (amber); resto → "No cumple siempre" (red).
- **`MetricHint`** (`components/business/supplierMetricHelp.tsx`): popover de ayuda por métrica. Métricas disponibles: `cumplimiento`, `despacho`, `fillRate`, `leadTime`, `otif`, `pendiente`. `cumplimiento`, `despacho` y `fillRate` incluyen además una matriz "Cómo interpretarlos juntos" con las 4 combinaciones de Cumplimiento × Despacho (Ambos altos / Cumple-despacho bajo / No cumple-despacho alto / Ambos bajos).

---

## Resumen del módulo

### Objetivo
Gestionar la relación con proveedores desde la óptica de compras: medir su desempeño (cumplimiento, lead time, despacho/fill, OTIF, monto pendiente), entender su valor comercial (venta, margen, utilidad, participación), preparar y registrar negociaciones, y anticipar temporadas. Sirve para decidir a quién comprar, a quién revisar/penalizar y con quién crecer.

### Pantallas
1. **Performance de proveedores** (`/proveedores`): listado comparativo con KPIs, rankings, alerta de temporada y tabla filtrable.
2. **Detalle / ficha de proveedor** (`/proveedores/:id`): cabecera con 4 KPIs + panel "Para atender al proveedor" + cockpit de negociación + posición negociadora + más vendidos/detenidos, y 7 pestañas: **Ficha** (maestro + evaluación), **Negociación** (cuenta comercial + condiciones/acuerdos editables), **Temporadas** (estacionalidad simulada), **Catálogo**, **Órdenes**, **Recepciones**, **Alertas**.

### Flujo principal
Listado → filtrar/detectar proveedores críticos o próximos a temporada → abrir ficha → revisar KPIs, cockpit y posición negociadora → profundizar por pestañas → registrar condiciones comerciales y acuerdos negociados (persistidos en localStorage).

### Funcionalidades principales
- Ranking y semáforos de desempeño de proveedores (cumplimiento, lead time, despacho, pendiente).
- Ficha 360°: datos maestros, contactos, documentos tributarios, acuerdos marco y **evaluación multidimensional 0–100** (parcialmente simulada: 2 dimensiones reales, 4 simuladas).
- **Cockpit de negociación** con agenda priorizada (costo, detenidos, cumplimiento, oportunidad), posición negociadora (dependencia/alternativas/concentración) y objetivos/palancas dinámicos.
- **Condiciones comerciales y acuerdos editables y persistentes** (única escritura del módulo, en localStorage por proveedor).
- Análisis de **estacionalidad** (heatmap, curva, comparación año a año, clasificación por SKU, guía por fase, recomendación) — data simulada.

### Funcionalidades secundarias
- Alerta de proveedores que entran en temporada (listado) con deep-link a la pestaña Temporadas.
- Detección de productos detenidos, en quiebre, sin rotación y en caída.
- Tabla "Datos clave para negociar" conmutable por criterio (venta/días/margen/ganancia).
- Vista de catálogo con detalles de compra (código proveedor, EAN, unidades, múltiplo, equivalencias, delta de costo, descuento vigente).
- Listados de OC, recepciones y alertas del proveedor con enlaces cruzados.
- Ayuda contextual de métricas (`MetricHint`: cumplimiento, despacho, fillRate, otif, leadTime, pendiente).

### Dependencias con otros módulos
- **Productos** (`mockProducts` / `/productos/:sku`): cruces por `supplierName`; enlaces al detalle de producto.
- **Órdenes de compra** (`mockPurchaseOrders` / `/comprar/seguimiento`): OC abiertas, atrasadas y monto pendiente.
- **Recepciones** (`mockReceptions` / `/recepciones`): fill rate, OTIF y pestaña Recepciones.
- **Alertas** (`mockAlerts`): pestaña Alertas y motivo de revisión.
- **Categorías** (`mockCategories`): participación y comparación de margen; enlaces desde `CategoryDetailPage`.
- **Mi cartera / Mi panel** (`myPanel`): deep-links a `/proveedores/:id?tab=negociacion` y foco "proveedores".
- **Búsqueda global** (`Topbar`): acceso directo a la ficha.
- **Utilidades**: `supplierPerf` (fill rate/despacho), `seasonality` (temporadas simuladas), `hash` (evaluación simulada), `formatters`, `useUrlState`, `useLocalStorage`, `DataContext`.

### Definiciones pendientes / hallazgos transversales
- **Datos mock**: performance, evaluación (4 dimensiones no-reales) y estacionalidad completa son simulados/deterministas; solo cumplimiento, lead time, fill (desde recepciones) y datos maestros vienen de mocks "de negocio".
- **Fechas/tiempo hardcodeados**: `"2026-06-26"` como default al registrar acuerdos; y `CURRENT_MONTH = 5` (Junio 2026) como "hoy" de toda la inteligencia estacional (hoy real: 2026-07-13). Los "días a temporada" son múltiplos de 30.
- **Nomenclatura OTIF inconsistente** entre el cockpit de la cabecera (usa `deliveryCompliance`) y la pestaña Negociación (calcula OTIF real `deliveryCompliance × fillRate / 100`).
- **`fillRate` = 100 por defecto** cuando el proveedor no tiene recepciones arribadas (aunque la UI muestre "—"); puede sesgar OTIF, rol y objetivos.
- **Inconsistencia de fuente**: listado usa `useCollection`, detalle usa el array mock directo.
- **Sin gating de rol** detectado en ruta ni navegación; ambos roles (`comprador`/`lider`) accederían por igual y podrían escribir condiciones/acuerdos.
- Los acuerdos **no se pueden editar ni eliminar**; la persistencia es local por navegador.
- Comportamiento del `DataTable` sin resultados (empty state) no observado en la página del listado.

---

## Verificación de cobertura

- **Pantallas / rutas**: `/proveedores` (listado) y `/proveedores/:id` (detalle, con `?tab=`). ✔ Ambas documentadas, con rutas y navegación exactas.
- **Sub-pestañas del detalle (7)**: Ficha, Negociación (2 sub-componentes: cuenta comercial + condiciones/acuerdos), Temporadas, Catálogo, Órdenes, Recepciones, Alertas. ✔ Todas documentadas con detalle, contadores y estados vacíos.
- **Controles con etiqueta exacta**: filtros ("Buscar por nombre o RUT", "Estado", "Limpiar"), columnas de tabla (11 + `mobileCard`), KPIs, chips de "Datos clave para negociar", botones "Editar" / "+ Registrar" / "Cancelar" / "Guardar" / "Sin cambios", `ConfirmModal` "Descartar cambios / Seguir editando", botones "Ver órdenes" / "OC atrasadas". ✔
- **Campos de formulario**: modal condiciones (8 campos con tipo y `min`) y modal acuerdo (4 campos con tipo/placeholder/valor por defecto). ✔
- **Columnas de tabla y KPIs/tarjetas**: tabla listado, tabla negociación (5 col.), tabla año-a-año, 4 KPIs listado, 4 KPIs detalle, 5 celdas "Para atender", `GStat` de Resultado comercial (5) / Abastecimiento (6) / Mix (3) / Riesgo (2), 7 `GStat` de Temporadas. ✔
- **Navegación con destino exacto**: `/proveedores/:id`, `?tab=temporadas`, `?tab=ordenes` (vía `setTab`), `/productos/:sku`, `/comprar/seguimiento?oc=`, `/recepciones?rid=`. ✔
- **Reglas de negocio con umbrales/constantes reales**: cumplimiento 70/85, lead 15/12, pendiente 20M, fill 90/98, OTIF 85, importancia (share 0.6/0.3, SKUs 200/100), negotiationPower (0.45, 120M), dependencia (40/20), rol (problem/strategic/relevant), costo +5%, oportunidad ≥25% cobertura ≤lead×2, score temporada (pesos 0.4/0.2/0.2/0.1/0.1; semáforo 80/60), classification (ratio 1.3/1.12), risky (fill<85 & quiebres≥8), pesos de evaluación (0.28/0.22/0.18/0.12/0.10/0.10). ✔
- **Escritura real**: condiciones (`compras:terms:<id>`) y acuerdos (`compras:agreements:<id>`) en `localStorage`. ✔ Única escritura del módulo, documentada con validaciones y toasts.
- **Estados reales vs. inexistentes por mock**: estados de proveedor (5), banner de revisión, empty states por pestaña, ausencia de carga/error de red. ✔
- **Permisos / validaciones / dudas**: sin gating de rol; validación de "objetivo" obligatorio y control `dirty` en condiciones; hallazgos de datos simulados, fechas hardcodeadas, OTIF inconsistente, fillRate=100 por defecto, inconsistencia `useCollection` vs mock. ✔
- **Corrección aplicada**: etiquetas del badge "Comportamiento" en Temporadas corregidas a "Estacional fuerte / Estacional suave / Permanente" (antes se citaban erróneamente las de `demandType`).
