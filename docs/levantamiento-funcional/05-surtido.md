# Módulo: Surtido

> Levantamiento funcional realizado exclusivamente desde el frontend (React + TypeScript, datos mock). Documenta lo que la interfaz permite hacer y mostrar. Donde el código no define algo, se marca como **Definición pendiente** o **Suposición**. Todos los datos son de demostración (mock / `localStorage`); no hay backend real.

El módulo agrupa cuatro pantallas cuyo hilo común es **decidir qué surtido llevar y cómo activarlo comercialmente**, no solo cuánto reponer:

| Pantalla | Ruta principal | Archivo | Título en UI |
|---|---|---|---|
| Gestión de surtido | `/surtido` | `AssortmentPage.tsx` | "Surtido" |
| Surtido redundante / catálogo optimizado | `/surtido-redundante` | `CatalogOptimizationPage.tsx` | "Surtido redundante" |
| Campañas y descuentos | `/campanas` | `CampaignsPage.tsx` (+ `CampaignPerformance.tsx`, `campaignsHelpers.ts`, `campaignsShared.tsx`) | "Campañas y descuentos" |
| Anticipación de campañas / oportunidades | `/anticipacion` | `CampaignOpportunitiesPage.tsx` (+ `campaignOpportunities/CreatedCampaignsView.tsx`) | "Anticipación de campañas" |

**Rutas y redirecciones confirmadas en `src/routes/AppRoutes.tsx`:**
- `/surtido` → `AssortmentPage`
- `/surtido-redundante` → `CatalogOptimizationPage`; ruta antigua `/catalogo-optimizado` → **redirige** a `/surtido-redundante`
- `/campanas` → `CampaignsPage`
- `/anticipacion` → `CampaignOpportunitiesPage`; ruta antigua `/campanas-oportunidades` → **redirige** a `/anticipacion`

> **Nota sobre el nombre del enunciado.** El módulo pide "/anticipacion (Productos a potenciar / anticipación de campañas)". En el código esa ruta corresponde a `CampaignOpportunitiesPage`, titulada **"Anticipación de campañas"**. El concepto "potenciar" existe como un estado de oportunidad (`boost` → "Potenciar"), no como una pantalla propia.

Componente transversal a todo el módulo: **`ScopeToggle` / `useCategoryScope`** ("Mi cartera · N cat." vs "Todas"), que acota los datos a las categorías asignadas al comprador. Preferencia compartida entre vistas vía `localStorage` (`compras:scope`); el líder ve "Todas" por defecto y el comprador "Mi cartera".

---

## 1. Pantalla: Gestión de surtido

### Nombre
Surtido (Gestión de surtido / category management).

### Ruta(s)
`/surtido` (`AssortmentPage.tsx`).

### Módulo
Surtido.

### Objetivo funcional
Decidir **qué surtido llevar, no solo cuánto reponer**: rol estratégico de cada categoría, surtido por tienda/cluster, penetración de marca propia y qué productos entran (altas/NPI) o salen (line review) del surtido. Según el comentario del código, es "una estimación para decidir, no un planograma real".

### Tipo de usuario
Comprador y líder (no hay restricción de rol en la ruta ni en la página). El `ScopeToggle` ajusta el alcance por rol: comprador arranca en "Mi cartera", líder en "Todas".

### Descripción detallada
Página con encabezado (`PageHeader` título "Surtido") y un `ScopeToggle` en la acción. Debajo, un set de **4 pestañas** (`Tabs`) que conmutan el contenido. Cada pestaña incluye una nota de ayuda (`HelpNote`) explicando el concepto de negocio y presenta tablas/tarjetas/KPIs. Todos los datos se derivan de `mockCategories` y `mockProducts`, filtrados por `inScope`.

### Información que muestra
Depende de la pestaña activa (ver "Secciones/bloques"). En conjunto: roles de categoría, KPIs de conteo por rol, brechas de surtido por cluster, penetración de marca propia (mix de surtido, mix de venta, márgenes comparados) y listas de altas y candidatos a salida.

### Secciones/bloques (pestañas)
Las pestañas se definen en `TABS`:

1. **Rol de categoría** (`rol`) — pestaña por defecto.
2. **Surtido por tienda** (`tiendas`).
3. **Marca propia** (`marca-propia`).
4. **Altas y salidas** (`line-review`).

**Pestaña 1 · Rol de categoría** (`RoleTab`)
- `HelpNote` explicando los 4 roles: tráfico, margen, nicho, conveniencia.
- 4 `KpiCard` con el conteo de categorías por rol.
- `DataTable` con columnas: Categoría (link a detalle de categoría), Rol sugerido (`Badge`), Foco (descripción del rol, oculto en móvil), Venta 30d, Margen (oculto en móvil), SKUs (oculto en móvil).
- Regla de clasificación (`classifyCategoryRoles` en `utils/assortment.ts`): relativa a la cartera. El ~30% superior por venta (mínimo 1) = **tráfico**; del resto, margen ≥ mediana = **margen**; si no, SKUs activos ≥ mediana = **nicho**; el resto = **conveniencia**. Si no hay rol resuelto, cae a "nicho" (fallback en el render).

**Pestaña 2 · Surtido por tienda** (`StoresTab`)
- `HelpNote` sobre clusters y brechas.
- Si no hay brechas (`totalGaps === 0`): tarjeta con mensaje de cobertura completa.
- Si hay brechas: grid de `Card` por cluster, cada una con: título del cluster, "N SKU presentes · N brechas", `Badge` ("N brechas" ámbar / "Cubierto" verde) y lista de hasta 8 SKUs en brecha (link a producto + unidades/mes).
- Lógica (`assortmentByCluster`): agrupa ubicaciones físicas (`stockByLocation`) en clusters legibles por palabra clave (`clusterOf`: Zona San Javier, Zona Centro, Centro de Distribución, Zona Norte, Zona Sur, Otras). Un SKU es "vendedor" si `salesLast30Days >= 10`. Brecha = SKU vendedor sin stock (`stock > 0`) en el cluster. Ordena clusters por SKU presentes desc.; muestra top 8 brechas por venta.

**Pestaña 3 · Marca propia** (`PrivateLabelTab`)
- `HelpNote` sobre penetración de marca propia.
- 4 `KpiCard`: Mix surtido propio (%), Mix venta propia (%), Venta marca propia ($ compacto, últimos 30 días), Categorías (conteo en alcance).
- `DataTable` con: Categoría (link), SKU propia/total, Mix surtido (barra `MixBar` violeta), Mix venta (%, oculto móvil), Margen propia/nacional (comparación con color verde si propio ≥ nacional, oculto móvil).
- Lógica (`privateLabelByCategory`): marca propia si `product.marcaPropia` es true o `brand ∈ {Andes, Genérica, Fix}` (`PRIVATE_LABEL_BRANDS`, demo). Márgenes ponderados por unidades vendidas (`weightedMargin`). Ventas ponderadas por precio. Filas ordenadas por venta total desc.

**Pestaña 4 · Altas y salidas** (`LineReviewTab`)
- `HelpNote` sobre line review.
- `Card` "Altas por evaluar (NPI)" con `Badge` de conteo y tabla (`ChangeTable`).
- `Card` "Candidatos a salida (line review)" con acción-link "Ver surtido redundante →" (a `/surtido-redundante`) y tabla.
- `ChangeTable` columnas: Producto (link + SKU · categoría · marca), Venta 30d (u.), Stock (oculto móvil), Margen (oculto móvil), Recomendación (motivo).
- Lógica altas (`newProducts`): productos con `productStatus === "new"`; motivo según tenga o no venta inicial; orden por venta desc.
- Lógica salidas (`exitCandidates`): productos con `productStatus` `discontinued`/`no_sales`, o `salesLast90Days === 0` con stock > 0, o `purchaseStatus === "do_not_buy"`; motivo según causa; orden por `stock × margen` desc.

### Filtros disponibles
- **ScopeToggle** ("Mi cartera / Todas") — único filtro. No hay buscador, selects de categoría ni exportación en esta pantalla.

### Acciones del usuario
- Cambiar de pestaña.
- Alternar alcance (Mi cartera / Todas).
- Navegar a detalle de categoría o producto vía links.
- Ir a "Surtido redundante" desde la pestaña de altas/salidas.

### Botones y controles
- `Tabs` (4 pestañas), `ScopeToggle` (segmentado), links de navegación, link de acción "Ver surtido redundante →". No hay formularios ni botones de acción que modifiquen datos.

### Tablas / tarjetas / formularios / componentes
- `PageHeader`, `Tabs`, `HelpNote`, `KpiCard`, `Card`/`CardBody`/`CardHeader`, `DataTable`, `Badge`, `MixBar` (barra de progreso local), links `entityLinks` (`categoryPath`, `productPath`). Sin formularios.

### Campos de formularios
No aplica (pantalla de solo lectura).

### Estados posibles
- **Vacíos por alcance/datos:** cada tabla tiene `emptyMessage` ("No hay categorías en tu alcance", "No hay productos en tu alcance", etc.).
- **Sin brechas:** mensaje de cobertura completa en la pestaña de tiendas.
- **Roles:** 4 estados (tráfico/margen/nicho/conveniencia).
- No hay estados de carga (`loading`) ni error de red — datos síncronos en memoria (mock).

### Navegación hacia otras pantallas
- Detalle de categoría (`categoryPath`).
- Detalle de producto (`productPath`).
- `/surtido-redundante` (link "Ver surtido redundante →").

### Flujo funcional completo
1. El usuario entra a `/surtido`; ve por defecto la pestaña "Rol de categoría" acotada a su cartera.
2. Revisa el rol sugerido de cada categoría y decide su estrategia.
3. En "Surtido por tienda" identifica brechas locales (SKUs que venden pero faltan en ciertos clusters) para priorizar cobertura.
4. En "Marca propia" evalúa dónde crecer con marca propia (margen mayor y mix bajo).
5. En "Altas y salidas" valida productos nuevos y detecta candidatos a salir; puede saltar a "Surtido redundante" para racionalizar.

### Reglas de negocio inferibles
- El rol de categoría es **relativo a la cartera visible** (cambia según el alcance).
- Categorías de tráfico "nunca pueden quebrar"; las de margen protegen rentabilidad (textos de `CATEGORY_ROLE_META`).
- Un SKU se considera "vendedor" con ≥ 10 unidades/mes.
- Marca propia definida por flag `marcaPropia` o pertenencia a marcas propias demo.
- Candidato a salida = descontinuado, sin ventas, sin venta 90d con stock, o "no comprar".

### Validaciones
No hay entrada de datos, por lo tanto no hay validaciones de formulario.

### Permisos / restricciones
- Ruta accesible sin distinción de rol. El único ajuste por rol es el valor inicial del `ScopeToggle`.

### Dudas / definiciones pendientes
- **Definición pendiente:** umbrales (30% tráfico, mediana de margen/SKU, ≥10 u. vendedor, top 8 brechas) son heurísticas de demo; requieren validación de negocio real.
- **Definición pendiente:** la clusterización por palabra clave del nombre de ubicación es de demo; los clusters reales del retailer no están definidos aquí.
- **Definición pendiente:** el conjunto de marcas propias (`Andes`, `Genérica`, `Fix`) es de demo.
- **Suposición:** las pestañas son de análisis/decisión; no persisten ni ejecutan cambios de surtido (no hay acción de "activar" un rol o "dar de baja" un SKU desde aquí).

---

## 2. Pantalla: Surtido redundante (catálogo optimizado)

### Nombre
Surtido redundante / catálogo optimizado (racionalización de duplicidad de SKU).

### Ruta(s)
`/surtido-redundante` (`CatalogOptimizationPage.tsx`). Redirección desde `/catalogo-optimizado`.

### Módulo
Surtido.

### Objetivo funcional
Detectar **productos redundantes** — SKUs que se solapan dentro de una misma subcategoría y gama de precio — para racionalizar el surtido y **liberar capital inmovilizado**. Regla de negocio central: por tipo de producto basta con la mejor opción por gama de precio (económica / media / premium).

### Tipo de usuario
Comprador y líder (sin restricción de ruta). Alcance controlado por `ScopeToggle`.

### Descripción detallada
Página contenedora ligera: `PageHeader` (título "Surtido redundante") con `ScopeToggle` + `Select` de categoría en la acción, y el componente reutilizable **`CatalogRedundancy`** que hace todo el trabajo. El mismo componente se reutiliza en el detalle de categoría (según su docstring).

### Información que muestra
- Fila de 4 `KpiCard` (resumen): Subcategorías saturadas, SKUs redundantes (% del surtido), Capital liberable ($), SKUs analizados.
- `HelpNote` explicando qué es "redundante" (gama de precio, conservar el mejor por venta/rotación/margen).
- Barra de filtros por acción + acciones (exportar, crear campaña de liquidación).
- Grid de tarjetas por subcategoría saturada (`GroupCard`): SKUs a conservar ("uno por gama") y SKUs que "sobran" con su acción sugerida y capital inmovilizado.

### Secciones / bloques
1. **Filtro superior** (en `PageHeader`): ScopeToggle + Select "Todas las categorías".
2. **KPIs resumen** (`showSummary`, true aquí).
3. **HelpNote "¿Qué es redundante?"**.
4. **Filtros por acción + botones de acción**.
5. **Grid de grupos** (subcategorías con exceso), cada uno con bloque "Conservar (uno por gama)" y bloque "Sobran".

### Filtros disponibles
- **ScopeToggle** (Mi cartera / Todas).
- **Select de categoría** (`useUrlState("cat")`, persistido en la URL; opciones = categorías presentes en el alcance).
- **Filtros por acción** (chips): Todos, Liquidar, Descontinuar, Reactivar compra (solo se muestran los que tienen conteo > 0, además de "Todos").

### Acciones del usuario
- Acotar por alcance y por categoría.
- Filtrar por tipo de acción sugerida.
- **Exportar CSV** de redundantes (`ExportButton`, archivo `catalogo-redundantes`).
- **Crear campaña de liquidación** con los redundantes que tienen stock (`Button` → abre `CampaignBuilderModal`).
- Navegar a detalle de cada SKU (conservar o candidato).

### Botones y controles
- `ScopeToggle`, `Select` categoría, chips de filtro por acción, `ExportButton`, botón "Crear campaña de liquidación (N)", links a productos, `CampaignBuilderModal` (formulario modal — ver pantalla de Campañas para su detalle de campos).

### Tablas / tarjetas / formularios / componentes
- `PageHeader`, `Select`, `CatalogRedundancy` (con `KpiCard`, `HelpNote`, `ExportButton`, `Button`, `EmptyState`, `GroupCard`, `Badge`), `CampaignBuilderModal`.
- Formulario: el `CampaignBuilderModal` precargado con nombre "Liquidación {categoría}" o "Liquidación de surtido", canales `["web", "marketplace"]` y líneas de productos redundantes con stock a 30% de descuento (`LIQUIDATION_DISCOUNT`).

### Campos de formularios
En el `CampaignBuilderModal` (ver pantalla 3 · Campañas para descripción completa): Nombre, Fecha inicio, Fecha término, Canales (multi-selección), lista de productos con % descuento por línea.

### Estados posibles
- **Catálogo sano** (sin candidatos): `EmptyState` "Catálogo sano" (candidateCount === 0).
- **Con redundancia**: KPIs + grupos.
- **Acciones de SKU sugeridas** (`classify` en `catalogOptimization.ts`):
  - `liquidate` ("Liquidar") — tiene stock.
  - `discontinue` ("Descontinuar") — sin ventas/descontinuado o stock total 0.
  - `review` ("Revisar") — definido en el tipo pero no generado por `classify` (**no se produce con la lógica actual**; label existe por completitud).
- **Reactivar compra**: cuando el "mejor de la gama" está marcado "no comprar"/descontinuado (`needsReactivation`).
- Severidad `high`/`medium` calculada pero no mostrada explícitamente en la UI.
- Sin estados de carga/error de red (datos síncronos).

### Navegación hacia otras pantallas
- Detalle de producto (`/productos/{sku}`) desde cada SKU conservado o candidato.
- Al guardar la campaña de liquidación, toast con acción "Ver campañas" que navega a `/anticipacion`. (Nota: la campaña creada se guarda en `localStorage` `compras:campaigns`, que es la lista de "Mis campañas" de `/anticipacion`, no la de `/campanas`.)

### Flujo funcional completo
1. Usuario entra a `/surtido-redundante`; ve sus categorías (o todas) analizadas.
2. Revisa KPIs de capital liberable y redundancia.
3. Filtra por categoría y/o por acción (liquidar/descontinuar/reactivar).
4. En cada subcategoría saturada ve qué SKU conservar (uno por gama) y cuáles sobran.
5. Puede exportar la lista o lanzar una campaña de liquidación con los redundantes con stock.
6. Al crear la campaña, se persiste en "Mis campañas" y se le ofrece navegar a `/anticipacion`.

### Reglas de negocio inferibles
- Agrupación por `categoría|||subcategoría`; solo grupos con ≥ 2 SKUs se analizan.
- Gama de precio (`tierOf`): tercios del rango de precios del grupo → low/mid/high; si todos igual precio → "mid".
- "Mejor de la gama" (`better`): mayor venta 30d, luego rotación, luego margen.
- Redundante = todo SKU que no es el mejor de su gama.
- Acción liquidar vs descontinuar según stock/ventas.
- Capital inmovilizado = `cost × totalStock`.
- Descuento de liquidación por defecto = 30%; solo entran a la campaña líneas con `availableStock > 0`.
- Grupos ordenados por capital liberable desc.

### Validaciones
- Del modal de campaña: nombre no vacío, al menos un canal, al menos un producto; descuento por línea acotado 0–90 (`input number` min 0 max 90).

### Permisos / restricciones
- Sin restricción por rol. Alcance por `ScopeToggle`.

### Dudas / definiciones pendientes
- **Definición pendiente:** la acción "review" está tipada pero nunca se genera; ¿debía existir un caso intermedio?
- **Definición pendiente:** severidad (`high`/`medium`) se calcula pero no se muestra — ¿uso previsto?
- **Suposición:** al liquidar/descontinuar no hay flujo de aprobación ni cambio de estado del producto desde esta pantalla; la única acción "ejecutora" es crear una campaña de liquidación.
- **Definición pendiente:** los umbrales de gama por tercios y `inventoryDays >= 120` son heurísticas de demo.

---

## 3. Pantalla: Campañas y descuentos

### Nombre
Campañas y descuentos (planificación y rendimiento de campañas promocionales).

### Ruta(s)
`/campanas` (`CampaignsPage.tsx`; usa `CampaignPerformance.tsx`, `campaignsHelpers.ts`, `campaignsShared.tsx`).

### Módulo
Surtido.

### Objetivo funcional
**Armar cada evento comercial**: elegir productos en descuento, repartir el presupuesto por canal, definir dónde se exhibe cada producto (reel, banner, góndola, listado destacado…) y su orden de exhibición, y luego revisar el **rendimiento** (simulado) de la campaña.

### Tipo de usuario
Comprador y líder (sin restricción de ruta).

### Descripción detallada
Página con estado editable persistido en `localStorage` (`compras:campaign-plans`, inicializado con `CAMPAIGN_PLANS`). Un selector de campañas (chips) permite cambiar de plan o crear uno nuevo. Un `Card` de resumen muestra métricas del plan activo. Dos pestañas: **Planificación** y **Rendimiento**. La planificación gestiona presupuesto por canal, espacios publicitarios (cupos) y la tabla de productos en descuento. El rendimiento (componente `CampaignPerformance`) muestra KPIs y tablas por canal/producto con datos **simulados**.

### Información que muestra
**Selector y resumen:**
- Chips de campañas (nombre + "en N d" / "en curso") + chip "Crear campaña".
- `Card` resumen: nombre, `Badge` "en N días", rango de fechas, Productos (conteo), Descuento prom. (%), Venta estimada ($ compacto), barra de presupuesto asignado vs total (con color según % y sobregiro).

**Pestaña Planificación:**
- **Presupuesto por canal**: 4 `Card` (Redes, Mercado Libre, Web, Tienda) con presupuesto, % del total, barra de uso y monto asignado. Orden fijo `["redes","ml","web","tienda"]` (`channelOrder`).
- **Espacios publicitarios**: `Card` resumen (N libres de N cupos, N ocupados, barra, toggle Tarjetas/Calendario) + chips de filtro por canal (con conteo de cupos libres) + vista de espacios en grid o calendario.
- **Productos en descuento**: tabla detallada.

**Pestaña Rendimiento** (`CampaignPerformance`, datos simulados):
- `HelpNote` "Datos simulados (demo)".
- 6 `KpiCard`: Inversión, Ingresos, ROAS, Conversiones, CTR promedio, Impresiones.
- Tabla "Rendimiento por canal" (Impresiones, Clics, CTR, Conversiones, Ingresos, Inversión, ROAS) — ordenable.
- Tabla "Rendimiento por producto" (Producto, Canal, Posición, Impresiones, Clics, CTR, Conversiones, Ingresos, ROAS) — ordenable.

### Secciones / bloques
1. Selector de campañas (chips) + crear.
2. Card resumen del plan activo.
3. Tabs Planificación / Rendimiento.
4. (Plan) Presupuesto por canal.
5. (Plan) Espacios publicitarios: resumen + toggle vista + filtros por canal + grid/calendario de cupos.
6. (Plan) Tabla de productos en descuento.
7. (Perf) KPIs + tablas por canal y producto.
8. Modal agregar/editar producto.
9. Modal crear campaña.

### Filtros disponibles
- **Selector de campaña** (chips): elige el plan activo.
- **Filtros por canal** de espacios (chips): Todos, Web, Tienda física, Mercado Libre, Redes, Email — cada uno con conteo de cupos libres. Filtra los espacios mostrados por `filterKey`.
- **Toggle de vista de espacios**: Tarjetas (`grid`) / Calendario (`calendar`).
- No hay filtro/scope de cartera aquí (esta pantalla no usa `ScopeToggle`).
- Ordenamiento de columnas en las tablas de rendimiento (por defecto por ingresos desc.).

### Acciones del usuario
- Seleccionar campaña; crear campaña nueva (modal).
- Agregar producto en descuento (botón global "Agregar producto" o desde un espacio con cupo libre).
- Editar producto (icono lápiz en la tabla) y quitarlo (botón "Quitar" en el modal de edición).
- **Reordenar** la posición de exhibición de un producto dentro de su placement (flechas subir/bajar), tanto en las tarjetas de espacios como en la columna "Posición" de la tabla.
- Cambiar de vista de espacios (tarjetas/calendario) y filtrar por canal.
- Cambiar a la pestaña Rendimiento y ordenar sus tablas.
- Navegar a detalle de producto/categoría desde la tabla.

### Botones y controles
- Botón "Agregar producto" (header), chips de campaña, chip "Crear campaña", `Tabs`, toggle vista, chips de canal, botones de asignación por espacio ("Asignar producto"/"Asignar primer producto"/"Asignar último cupo"/"Ver asignaciones"), flechas subir/bajar (`IconArrowUp`/`IconArrowDown`, deshabilitadas en extremos), icono editar por fila, `Modal` agregar/editar (con botón "Quitar" en modo edición) y `Modal` crear campaña.

### Tablas / tarjetas / formularios / componentes
- `PageHeader`, `Card`/`CardBody`, `Badge`, `Tabs`, `Modal`, `Input`, `Select`, `Button`, `Svg` (icono inline compartido), `KpiCard`, `DataTable` (en rendimiento), tabla HTML propia para productos en descuento.
- Persistencia: `useLocalStorage` (`compras:campaign-plans`). Toasts vía `useToast`.

### Campos de formularios
**Modal Agregar/Editar producto en descuento** (`ProductForm`):
- Producto (Select de SKU en modo "add"; solo lectura en "edit"). Al elegir SKU se autocompletan nombre, categoría y precios sugeridos (`retailPrice`: precio normal derivado de costo/margen, promo = 85% redondeado).
- Descuento desde (fecha).
- Descuento hasta (fecha).
- Precio antes (numérico).
- Precio con descuento (numérico).
- Descuento (calculado, solo lectura, `discountPct`).
- Canal (Select: Redes Sociales / Mercado Libre / Web-Banner / Tienda física).
- Ubicación / exhibición (Select: labels de `PLACEMENT_LABELS` — Reel, Banner home web, Cabecera de góndola, Vitrina tienda, Listado destacado ML, Email & newsletter).
- Presupuesto de publicidad (numérico).

**Modal Crear campaña:**
- Nombre de la campaña (texto).
- Desde / Hasta (fechas; valores iniciales 2026-06-25 / 2026-06-30).
- Presupuesto total (numérico). Se reparte automáticamente 40% Redes, 30% ML, 20% Web, 10% Tienda (`channelBudget`).

### Estados posibles
- **Estados de producto de campaña** (`STATUS_CFG`): `ready` ("Listo", verde), `pending` ("Falta creativo", ámbar), `stock_risk` ("Riesgo de stock", rojo). Los tres existen en los datos mock (`CAMPAIGN_PLANS`).
- **Presupuesto**: normal, > 90% (barra ámbar), sobregiro (`overBudget`, barra roja + "Excede en …").
- **Cupos de espacio**: "Completo" (0 libres, rojo), "Último cupo" (1 libre, ámbar), "N libres de N" (verde).
- **Campaña vacía** (sin productos): tarjeta CTA "Aún no hay productos en esta campaña".
- **Rendimiento sin productos**: tarjeta "Todavía no hay rendimiento que mostrar".
- **Producto nuevo**: badge "Nuevo" (`isNew`).
- Estados de campaña creada desde el modal (`draft`/`scheduled`/`active`) aplican a "Mis campañas" de `/anticipacion`, no a los planes de esta pantalla. **No aplican** a `CampaignPlan`.
- Sin estados de carga/error de red.

### Navegación hacia otras pantallas
- Detalle de producto (`productPath`) y de categoría (`categoryPath`) desde la tabla de productos y desde rendimiento por producto.
- No hay navegación de salida por botones dedicados.

### Flujo funcional completo
1. El usuario selecciona una campaña existente o crea una nueva (nombre, fechas, presupuesto → reparto automático por canal).
2. Reparte/observa el presupuesto por canal.
3. Revisa los espacios publicitarios disponibles por canal y sus cupos.
4. Agrega productos en descuento (globalmente o asignándolos a un espacio con cupo), definiendo precios, vigencia, canal, ubicación y presupuesto.
5. Ordena la posición de exhibición de cada producto dentro de su espacio.
6. Edita o quita productos según necesidad.
7. Cambia a "Rendimiento" para revisar métricas simuladas por canal y producto.

### Reglas de negocio inferibles
- Presupuesto total se reparte 40/30/20/10 (Redes/ML/Web/Tienda) al crear.
- Venta estimada de un producto ≈ `budget × 4` (`estSale`).
- Precio normal sugerido derivado de `cost / (1 - margen)`, redondeado a decenas; promo sugerida = 85% del normal.
- Cada espacio (`SPACE_TYPES`) tiene un número fijo de cupos (Banner 3, Listado destacado ML 8, Reel 6, Góndola 4, Vitrina 2, Email 4). Al asignar, el producto va al final de su placement; `order` gestiona posición (1 = más visible).
- Un producto nuevo entra con estado `pending`; en edición conserva su estado previo.
- El descuento debe ser positivo (promo < normal) para ser válido.

### Validaciones
**Agregar/editar producto** (`fValid`): requiere SKU, fechas desde/hasta, precio normal > 0, promo > 0, promo < normal, presupuesto > 0 y `to >= from`. Si falta algo, toast "Completa producto, fechas, precios y presupuesto" y el botón de guardar queda deshabilitado.
**Crear campaña** (`submitCreate`): requiere nombre no vacío, ambas fechas, `to >= from` y presupuesto > 0; si no, toast "Completa nombre, fechas y presupuesto".
Inputs numéricos filtran no-dígitos (`replace(/[^0-9]/g, "")`).

### Permisos / restricciones
- Sin restricción por rol. Persistencia local por navegador (no compartida entre usuarios; es demo).

### Dudas / definiciones pendientes
- **Definición pendiente:** el rendimiento es **simulado** (`campaignPerformance` sobre datos mock); el `HelpNote` indica que en producción se conectaría con analítica web, Google Ads, mailing, Mercado Libre, redes y POS.
- **Definición pendiente / inconsistencia:** existen **dos conceptos de "campaña"** distintos y desconectados: (a) `CampaignPlan` (esta pantalla, `compras:campaign-plans`, canales Redes/ML/Web/Tienda con espacios y orden de exhibición) y (b) `CreatedCampaign` ("Mis campañas" en `/anticipacion`, `compras:campaigns`, canales que incluyen Google Ads/Meta/TikTok). No se sincronizan entre sí. Requiere definición de negocio sobre si deben unificarse.
- **Suposición:** `estSale = budget × 4` es un placeholder de demo.
- **Definición pendiente:** no hay flujo de aprobación, publicación ni cierre de campaña; el estado del producto (`ready`/`pending`/`stock_risk`) no se edita explícitamente en el formulario (solo se conserva).

---

## 4. Pantalla: Anticipación de campañas (oportunidades)

### Nombre
Anticipación de campañas / Oportunidades de campaña (incluye "Mis campañas" creadas).

### Ruta(s)
`/anticipacion` (`CampaignOpportunitiesPage.tsx`, con subvista `campaignOpportunities/CreatedCampaignsView.tsx`). Redirección desde `/campanas-oportunidades`.

### Módulo
Surtido.

### Objetivo funcional
**Anticiparse a las campañas**: comprar antes del peak para no quebrar, liquidar sobrestock y detectar crecimiento por canal. Cruza campaña, canal, stock, venta reciente, crecimiento, margen y venta estimada para recomendar si comprar, liquidar, potenciar o excluir cada producto; y consolida las compras de campaña en órdenes por proveedor. Segunda vista: gestionar las campañas creadas por el comprador ("Mis campañas").

### Tipo de usuario
Comprador y líder. Alcance por `ScopeToggle`. Integra el borrador de OC (contexto `OcDraftContext`).

### Descripción detallada
Página con dos vistas conmutadas por `Tabs`: **"Oportunidades detectadas"** y **"Mis campañas"**. La vista de oportunidades muestra chips de campañas próximas, KPIs clcables (que filtran), un bloque de consolidación de OC por proveedor con alerta de lead time crítico, pestañas de foco por estado, una barra de filtros completa y una `DataTable` con acción por fila. La vista "Mis campañas" lista las campañas creadas (persistidas en `localStorage` `compras:campaigns`) con sus productos y estado; permite crear y eliminar.

### Información que muestra
**Vista Oportunidades:**
- Plantillas rápidas de campaña (chips): "Cyber herramientas", "Especial construcción", "Liquidación stock lento", "Campaña jardín primavera".
- Chips "Próximas": nombre de campaña · N SKU · "en N días" (agrupadas por `campaignName`, ordenadas por días).
- 4 `KpiCard` (escritorio, clcables → filtran por estado): Riesgo de quiebre, Comprar antes, Sugeridos para liquidar, Compra sugerida campañas ($ total).
- Bloque "OC a generar por proveedor (N)": una fila por proveedor con SKU/unidades/monto, `Badge` de lead time (crítico rojo si `leadTime >= minDays`, verde si OK) y botón "Crear OC".
- `Tabs` de foco por estado: Todos, Comprar antes, Riesgo de quiebre, Liquidar, Potenciar, No recomendado (con conteos).
- `FilterBar` + `DataTable` de oportunidades.

**Vista Mis campañas** (`CreatedCampaignsView`):
- Si vacía: `EmptyState` "Aún no has creado campañas" + botón "Crear campaña".
- Si hay: `HelpNote` de tip + una `Card` por campaña con nombre, rango de fechas, N productos, % dcto promedio, `Badge` de estado (Borrador/Programada/Activa), badges de canales, alerta de productos con stock bajo, y lista de productos (SKU, nombre, stock, badge de descuento, precio tachado/promo, link "Ver producto"). Botón eliminar (X) por campaña.

### Secciones / bloques
1. Header con ScopeToggle, ExportButton y botón "Crear campaña".
2. Plantillas rápidas.
3. Tabs Oportunidades / Mis campañas.
4. (Oport.) Chips de campañas próximas.
5. (Oport.) KPIs clcables.
6. (Oport.) Consolidación de OC por proveedor.
7. (Oport.) Tabs de foco por estado.
8. (Oport.) FilterBar + tabla.
9. (Mis campañas) Lista de campañas creadas.
10. `CampaignBuilderModal` (crear/editar campaña).
11. `ConfirmModal` (eliminar campaña).

### Columnas de la tabla de oportunidades
Producto (SKU · marca · nombre link · categoría link · proveedor link), Oportunidad (`Badge` tipo), Canal / Campaña, Falta (días, rojo si ≤ 7), Stock disp. (rojo si ≤ 0), Venta 30d / Var. (con delta), Venta est. campaña, Brecha stock (rojo si > 0, "OK" si no), Compra sugerida (u. + $), Margen (ámbar si < 25%), Estado (`Badge` con dot), Riesgo / Recomendación, y columna de acciones (botón según `actionLabel` + "Ver producto"). Fila con fondo rojo suave si `stockout_risk`. Orden por defecto: urgencia de estado (`STATUS_URGENCY`) y luego días a campaña.

### Filtros disponibles
- **ScopeToggle** (Mi cartera / Todas).
- **KPIs clcables** que fijan `status` (Riesgo de quiebre / Comprar antes / Liquidar).
- **Tabs de foco por estado** (Todos, Comprar antes, Riesgo de quiebre, Liquidar, Potenciar, No recomendado).
- **FilterBar**: buscador (SKU/producto/campaña), y selects Canal, Tipo de oportunidad, Estado, Categoría, Proveedor; toggles: Riesgo de quiebre, Crecimiento acelerado, Sobrestock/liquidar, Margen bajo (< 25%). Botón limpiar filtros (`clearFilters`).

### Acciones del usuario
- Acotar alcance, filtrar/buscar/ordenar oportunidades.
- **Agregar a OC** un producto (si `actionLabel === "Agregar a OC"` y compra sugerida > 0) → lo añade al borrador de OC (`addItem`) con toast y acción "Ver borrador OC".
- **Crear OC por proveedor** (consolida todos los SKU sugeridos de ese proveedor en el borrador).
- Acciones simuladas por fila ("Potenciar", "Liquidación", "Excluir", "Revisar margen") → marca la fila como "Gestionado" (`done`) con toast; "Revisar proveedor" → navega a `/proveedores`.
- **Exportar CSV** de oportunidades filtradas (`campanas-oportunidades`).
- **Crear campaña** (botón header o plantilla rápida → `CampaignBuilderModal`).
- **Eliminar campaña** creada (con `ConfirmModal`).
- Navegar a detalle de producto (click en fila o "Ver producto"), categoría, proveedor.

### Botones y controles
- `ScopeToggle`, `ExportButton`, botón "Crear campaña", chips de plantillas, `Tabs` (x2), `KpiCard` clcables, botón "Crear OC" por proveedor, `FilterBar` (search + selects + toggles + limpiar), `DataTable` con acción por fila (`Button` primario/secundario + link "Ver producto"), `CampaignBuilderModal`, `ConfirmModal`, botón eliminar por campaña.

### Tablas / tarjetas / formularios / componentes
- `PageHeader`, `KpiCard`, `Card`, `DataTable` (+ `mobileCard`), `FilterBar`, `Badge`, `Button`, `Tabs`, `ConfirmModal`, `ExportButton`, `CampaignBuilderModal`, `ScopeToggle`, `CreatedCampaignsView` (`EmptyState`, `HelpNote`, `Badge`, `Button`).
- Contextos: `OcDraftContext` (borrador OC), `ToastContext`, `useLocalStorage` (`compras:campaigns`).

### Campos de formularios
- **`CampaignBuilderModal`** (mismo componente que en Surtido redundante): Nombre, Fecha inicio, Fecha término, Canales (multi-selección de `PROMO_CHANNELS`: Web, Marketplace, Tienda física, Omnicanal, Venta empresa, Redes sociales, Email, Google Ads, Meta, TikTok Ads), buscador de productos, lista de productos con % descuento por línea (0–90). El estado de la campaña se deriva de la fecha de inicio (`scheduled` si futura, `active` si no).
- La tabla de oportunidades no tiene formularios de edición; sus acciones son de un clic.

### Estados posibles
**Estados de oportunidad** (`CAMPAIGN_STATUS`, `CampaignOpportunityStatus`): `ready_for_campaign` (Listo para campaña), `buy_before_campaign` (Comprar antes de campaña), `stockout_risk` (Riesgo de quiebre), `liquidate` (Liquidar), `boost` (Potenciar), `review_margin` (Revisar margen), `review_supplier` (Revisar proveedor), `not_recommended` (No recomendado). Cuáles existen en los datos depende de `mockCampaignOpportunities`; los KPIs y tabs cuentan al menos stockout_risk, buy_before_campaign, liquidate, boost, not_recommended.
**Tipos de oportunidad** (`OPPORTUNITY_TYPE_LABELS`): campaña planificada, liquidación sugerida, crecimiento acelerado, riesgo de quiebre, producto estrella, revisar antes de campaña, no recomendado.
**Estados de campaña creada** (`CreatedCampaignStatus`): draft (Borrador), scheduled (Programada), active (Activa).
**Estados de UI:** fila ya "En OC" (deshabilitada), "Gestionado" (deshabilitada), lead time crítico vs OK, campañas vacías (EmptyState), sin resultados de filtros. Sin estados de carga/error de red.

### Navegación hacia otras pantallas
- `/productos/{sku}` (detalle de producto; click en fila y "Ver producto").
- `/comprar/borradores` (borrador de OC, vía toast tras agregar).
- `/proveedores` (acción "Revisar proveedor" y links de proveedor).
- Detalle de categoría (`categoryPath`) y proveedor (`supplierPath`).

### Flujo funcional completo
1. El comprador entra a `/anticipacion`; ve oportunidades de su cartera priorizadas por urgencia.
2. Revisa campañas próximas y KPIs de riesgo/compra/liquidación.
3. Usa los KPIs, tabs de estado y la FilterBar para focalizar.
4. Para cada oportunidad, agrega a OC, consolida OC por proveedor (atento al lead time crítico), o gestiona acciones (potenciar, liquidar, excluir, revisar).
5. Alternativamente, crea una campaña comercial (desde cero o plantilla) que queda en "Mis campañas".
6. En "Mis campañas" revisa y elimina campañas, atento a productos con stock bajo antes de lanzarlas.

### Reglas de negocio inferibles
- Orden de la tabla por urgencia (`STATUS_URGENCY`: stockout_risk < buy_before < review_supplier < review_margin < liquidate < boost < ready_for_campaign < not_recommended) y luego días a campaña.
- Consolidación por proveedor: una OC por proveedor sumando compras sugeridas; se ordena poniendo primero los de lead time crítico (`leadTime >= minDays`) y luego por menor tiempo a campaña.
- Lead time **crítico** = tiempo de entrega del proveedor ≥ días que faltan para la campaña (no alcanza a llegar).
- "Margen bajo" = margen < 25%.
- "Falta" en rojo si ≤ 7 días.
- Solo se agregan a OC productos con `suggestedPurchaseQuantity > 0` y `actionLabel === "Agregar a OC"`; se evita duplicar (`hasItem`).
- Estado de campaña creada derivado de la fecha de inicio vs "hoy" (`2026-06-24` en el builder).

### Validaciones
- `CampaignBuilderModal`: nombre no vacío, ≥ 1 canal, ≥ 1 producto; descuento por línea 0–90. Mensajes de error inline.
- Agregar a OC ignora productos ya presentes en el borrador (toast "Ya estaban en el borrador").
- Eliminar campaña pasa por `ConfirmModal` (acción irreversible).

### Permisos / restricciones
- Sin restricción por rol en la ruta. Alcance por `ScopeToggle`. Persistencia local (demo).

### Dudas / definiciones pendientes
- **Definición pendiente:** las acciones "Potenciar / Liquidación / Excluir / Revisar margen" solo marcan la fila como "Gestionado" con un toast (simuladas); no ejecutan ningún cambio real ni dejan trazabilidad persistente.
- **Definición pendiente / inconsistencia:** "Mis campañas" (`compras:campaigns`, `CreatedCampaign`) es un modelo distinto y desconectado de los planes de `/campanas` (`CampaignPlan`). Una campaña creada aquí no aparece en `/campanas` y viceversa.
- **Suposición:** el lead time del proveedor proviene de `getSupplierByName(...).averageLeadTimeDays` (0 si no hay dato).
- **Definición pendiente:** las plantillas rápidas solo precargan el nombre de la campaña; no traen productos ni configuración asociada.
- **Definición pendiente:** `mockCampaignOpportunities` está fechado al 24/06/2026; los "días a campaña" y estados son estáticos de demo.

---

## RESUMEN DEL MÓDULO: Surtido

### Objetivo
Dar al comprador/líder las herramientas para **decidir qué surtido llevar y cómo activarlo comercialmente**: definir el rol de cada categoría, cubrir brechas por tienda, impulsar marca propia, racionalizar SKUs redundantes para liberar capital, planificar campañas con presupuesto y espacios publicitarios, y anticiparse a las campañas comprando/liquidando a tiempo.

### Pantallas
1. **Gestión de surtido** (`/surtido`): rol de categoría, surtido por tienda, marca propia, altas y salidas.
2. **Surtido redundante** (`/surtido-redundante`): detección de SKUs duplicados por gama y capital liberable; exportación y campaña de liquidación.
3. **Campañas y descuentos** (`/campanas`): planificación de eventos (presupuesto por canal, espacios/cupos, productos en descuento, orden de exhibición) y rendimiento simulado.
4. **Anticipación de campañas** (`/anticipacion`): oportunidades de comprar/liquidar/potenciar antes de campañas, consolidación de OC por proveedor y gestión de "Mis campañas".

### Flujo principal
Analizar el surtido (roles, brechas, marca propia) → depurar el catálogo (redundantes → liquidar/descontinuar) → anticipar las campañas (comprar antes, consolidar OC por proveedor, liquidar sobrestock) → construir y operar la campaña (planificación de descuentos, canales y espacios) → medir su rendimiento.

### Funcionalidades principales
- Clasificación de rol de categoría y detección de brechas de surtido por cluster.
- Análisis de penetración de marca propia y line review (altas/salidas).
- Detección de redundancia de catálogo con capital liberable y acciones (liquidar/descontinuar/reactivar).
- Planificación de campañas: presupuesto por canal, espacios publicitarios con cupos y orden de exhibición, productos en descuento.
- Detección y priorización de oportunidades de campaña con recomendaciones y compra sugerida.
- Creación de campañas comerciales (builder) y consolidación de órdenes de compra por proveedor.

### Funcionalidades secundarias
- Exportación a CSV (surtido redundante y oportunidades).
- Alcance por cartera del comprador (`ScopeToggle`) compartido entre vistas.
- Rendimiento de campaña **simulado** (impresiones, clics, CTR, conversiones, ingresos, ROAS).
- Alerta de lead time crítico y de stock bajo antes de lanzar campañas.
- Plantillas rápidas de campaña (solo precargan nombre).

### Dependencias con otros módulos
- **Productos** (`/productos/{sku}`): destino de la mayoría de los links; fuente de datos (`mockProducts`).
- **Categorías** (`categoryPath`): links desde surtido y campañas.
- **Proveedores** (`/proveedores`, `mockSuppliers`): lead time para consolidación de OC y acción "Revisar proveedor".
- **Órdenes de compra / Borrador de OC** (`OcDraftContext`, `/comprar/borradores`): "Agregar a OC" y "Crear OC por proveedor" alimentan el borrador de compra.
- **Rol / Comprador** (`RoleContext`, `BuyerContext`): definen alcance y categorías asignadas.
- **Persistencia local** (`localStorage`): `compras:campaign-plans`, `compras:campaigns`, `compras:scope` (demo; no hay backend).

> **Observación transversal (para definición de negocio):** conviven **dos modelos de campaña desconectados** — `CampaignPlan` en `/campanas` y `CreatedCampaign` en `/anticipacion` y en la campaña de liquidación de `/surtido-redundante`. Comparten la idea de "campaña con productos en descuento y canales" pero no se sincronizan. Requiere decisión sobre su unificación.
