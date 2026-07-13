# Módulo: Surtido

> Levantamiento funcional realizado exclusivamente desde el frontend (React + TypeScript, datos mock). Documenta lo que la interfaz permite hacer y mostrar. Donde el código no define algo, se marca como **Definición pendiente** o **Suposición**. Todos los datos son de demostración (mock / `localStorage`); no hay backend real.

El módulo agrupa cuatro pantallas cuyo hilo común es **decidir qué surtido llevar y cómo activarlo comercialmente**, no solo cuánto reponer:

| Pantalla | Ruta principal | Archivo | Título en UI |
|---|---|---|---|
| Gestión de surtido | `/surtido` | `AssortmentPage.tsx` | "Surtido" |
| Surtido redundante / catálogo optimizado | `/surtido-redundante` | `CatalogOptimizationPage.tsx` (+ `components/business/CatalogRedundancy.tsx`, `utils/catalogOptimization.ts`) | "Surtido redundante" |
| Campañas y descuentos | `/campanas` | `CampaignsPage.tsx` (+ `CampaignPerformance.tsx`, `campaignsHelpers.ts`, `campaignsShared.tsx`) | "Campañas y descuentos" |
| Anticipación de campañas / oportunidades | `/anticipacion` | `CampaignOpportunitiesPage.tsx` (+ `campaignOpportunities/CreatedCampaignsView.tsx`) | "Anticipación de campañas" |

**Rutas y redirecciones confirmadas en `src/routes/AppRoutes.tsx`:**
- `/surtido` → `AssortmentPage`
- `/surtido-redundante` → `CatalogOptimizationPage`; ruta antigua `/catalogo-optimizado` → **redirige** a `/surtido-redundante` (`<Navigate replace>`)
- `/campanas` → `CampaignsPage`
- `/anticipacion` → `CampaignOpportunitiesPage`; ruta antigua `/campanas-oportunidades` → **redirige** a `/anticipacion` (`<Navigate replace>`)

> **Nota sobre el nombre del enunciado.** El módulo pide "/anticipacion (Productos a potenciar / anticipación de campañas)". En el código esa ruta corresponde a `CampaignOpportunitiesPage`, titulada **"Anticipación de campañas"**. El concepto "potenciar" existe como un estado de oportunidad (`boost` → "Potenciar") y como etiquetas de acción (`Potenciar en web` / `Potenciar en marketplace`), no como una pantalla propia.

**Componentes y constantes transversales al módulo:**
- **`ScopeToggle` / `useCategoryScope`** ("Mi cartera · N cat." vs "Todas"), que acota los datos a las categorías asignadas al comprador. Preferencia compartida entre vistas vía `localStorage` (`compras:scope`); el líder ve "Todas" por defecto y el comprador "Mi cartera". Presente en 3 de 4 pantallas (Surtido, Surtido redundante, Anticipación); **`CampaignsPage` NO usa `ScopeToggle`**.
- **`TODAY_ISO = "2026-06-24"`** (`src/utils/constants.ts`): "hoy" de la demo. Lo usa `daysUntil` (`campaignsHelpers.ts`) para calcular "en N días". El `CampaignBuilderModal` usa su propia constante local `todayISO = "2026-06-24"` (mismo valor) para derivar el estado de la campaña creada.

---

## 1. Pantalla: Gestión de surtido

### Nombre
Surtido (Gestión de surtido / category management).

### Ruta(s)
`/surtido` (`AssortmentPage.tsx`).

### Módulo
Surtido.

### Objetivo funcional
Decidir **qué surtido llevar, no solo cuánto reponer**: rol estratégico de cada categoría, surtido por tienda/cluster, penetración de marca propia y qué productos entran (altas/NPI) o salen (line review) del surtido. Según el comentario del código (`utils/assortment.ts`), es "una estimación para decidir, no un planograma real".

### Tipo de usuario
Comprador y líder (no hay restricción de rol en la ruta ni en la página). El `ScopeToggle` ajusta el alcance por rol: comprador arranca en "Mi cartera", líder en "Todas".

### Descripción detallada
Página con encabezado (`PageHeader` título "Surtido", descripción "Decide qué surtido llevar, no solo cuánto reponer: rol de cada categoría, surtido por tienda, marca propia y qué productos entran o salen.") y un `ScopeToggle` en la acción. Debajo, un set de **4 pestañas** (`Tabs`) que conmutan el contenido. Cada pestaña incluye una nota de ayuda (`HelpNote`) explicando el concepto de negocio y presenta tablas/tarjetas/KPIs. Todos los datos se derivan de `mockCategories` y `mockProducts`, filtrados por `inScope` (categorías por `c.name`, productos por `p.category`).

### Información que muestra
Depende de la pestaña activa (ver "Secciones/bloques"). En conjunto: roles de categoría, KPIs de conteo por rol, brechas de surtido por cluster, penetración de marca propia (mix de surtido, mix de venta, márgenes comparados) y listas de altas y candidatos a salida.

### Secciones/bloques (pestañas)
Las pestañas se definen en `TABS` (estado local `tab`, inicial `"rol"`):

1. **Rol de categoría** (`rol`) — pestaña por defecto.
2. **Surtido por tienda** (`tiendas`).
3. **Marca propia** (`marca-propia`).
4. **Altas y salidas** (`line-review`).

**Pestaña 1 · Rol de categoría** (`RoleTab`)
- `HelpNote` explicando los 4 roles: tráfico, margen, nicho, conveniencia.
- 4 `KpiCard` (tone `neutral`, icono `IconCategories`, descripción "categorías") con el conteo de categorías por rol, recorriendo `CATEGORY_ROLE_META`.
- `DataTable` (`emptyMessage` "No hay categorías en tu alcance.") con columnas exactas: **Categoría** (link a `categoryPath`), **Rol sugerido** (`Badge` con tono de `CATEGORY_ROLE_META`), **Foco** (descripción del rol, `hideOnMobile`), **Venta 30d** (`formatCurrencyCompact`, alineada derecha), **Margen** (`formatPercent`, `hideOnMobile`), **SKUs** (`formatNumber`, `hideOnMobile`).
- Regla de clasificación (`classifyCategoryRoles`): relativa a la cartera. `trafficCut = max(1, ceil(N × 0.3))` → los de mayor venta son **tráfico**; del resto, `averageMargin ≥ medianMargin` = **margen**; si no, `activeSkus ≥ medianSkus` = **nicho**; el resto = **conveniencia**. La mediana se toma en el índice `floor(N/2)` sobre la lista ordenada (no es promedio de los dos centrales). Si el mapa no resuelve un rol, el render aplica fallback `"nicho"` (`roles.get(c.id) ?? "nicho"`).

**Pestaña 2 · Surtido por tienda** (`StoresTab`)
- `HelpNote` sobre clusters y brechas.
- Si no hay brechas (`totalGaps === 0`, suma de `brechas` por cluster): `Card` con mensaje "Sin brechas de surtido detectadas en tu alcance: los SKU vendedores tienen presencia en todos los clusters."
- Si hay brechas: grid `lg:grid-cols-2` de `Card` por cluster, cada una con `CardHeader` (título del cluster, descripción "N SKU presentes · N brechas") + acción `Badge` ("N brechas" tono ámbar / "Cubierto" tono verde) y lista de hasta 8 SKUs en brecha (link a `productPath` + "N u./mes"). Si un cluster no tiene brechas relevantes: "Sin brechas relevantes."
- Lógica (`assortmentByCluster`): agrupa ubicaciones físicas (`stockByLocation`) en clusters legibles por palabra clave (`clusterOf`): **Zona San Javier** ("san javier"), **Zona Centro** ("santiago"/"central"), **Centro de Distribución** ("distribución"/"distribucion"), **Zona Norte** ("norte"), **Zona Sur** ("sur"), **Otras** (resto). Un SKU está "presente" en el cluster si `loc.stock > 0`. Un SKU es "vendedor" si `salesLast30Days >= 10`. Brecha = SKU vendedor **sin presencia** en el cluster. Ordena clusters por SKU presentes desc.; muestra top 8 brechas por venta desc.

**Pestaña 3 · Marca propia** (`PrivateLabelTab`)
- `HelpNote` sobre penetración de marca propia.
- 4 `KpiCard`: **Mix surtido propio** (%, tone `info`, descripción "N SKU propios"), **Mix venta propia** (%, tone `neutral`, "de la venta total"), **Venta marca propia** ($ compacto, tone `good`, "últimos 30 días"), **Categorías** (conteo de filas, tone `neutral`, "en tu alcance").
- `DataTable` (`emptyMessage` "No hay productos en tu alcance.") con columnas: **Categoría** (link), **SKU propia / total**, **Mix surtido** (barra `MixBar` violeta, componente local), **Mix venta** (%, `hideOnMobile`), **Margen propia / nacional** (comparación; el margen propio se pinta verde `text-emerald-600` si `privateMarginPct >= nationalMarginPct`; muestra "—" si no hay SKU propia; `hideOnMobile`).
- Lógica (`privateLabelByCategory`): marca propia si `product.marcaPropia` es true, o `brand ∈ {Andes, Genérica, Fix}` (`PRIVATE_LABEL_BRANDS`, demo) — vía `isPrivateLabel`. Márgenes ponderados por unidades vendidas (`weightedMargin`; si no hay unidades, promedio simple de márgenes). Ventas ponderadas por precio (`salesLast30Days × price`). Filas ordenadas por venta total desc.

**Pestaña 4 · Altas y salidas** (`LineReviewTab`)
- `HelpNote` sobre line review.
- `Card` "Altas por evaluar (NPI)" (descripción "Productos nuevos: confirma rotación antes de comprometer más compra y espacio") con `Badge` azul de conteo y tabla (`ChangeTable`).
- `Card` "Candidatos a salida (line review)" (descripción "Sin venta, descontinuados o marcados no comprar: liquida y libera espacio") con acción-link "Ver surtido redundante →" (a `/surtido-redundante`) y tabla.
- `ChangeTable` columnas exactas: **Producto** (link + "SKU · categoría · marca"), **Venta 30d** ("N u."), **Stock** (`hideOnMobile`), **Margen** (`hideOnMobile`), **Recomendación** (motivo).
- Lógica altas (`newProducts`): `productStatus === "new"`; motivo "Nuevo con venta inicial: confirma reposición y espacio." si `salesLast30Days > 0`, si no "Nuevo sin venta aún: valida rotación antes de reordenar."; orden por venta desc.
- Lógica salidas (`exitCandidates`): `productStatus` `discontinued`/`no_sales`, o `salesLast90Days === 0` con `availableStock > 0`, o `purchaseStatus === "do_not_buy"`; motivo según causa ("Descontinuado: liquida el saldo…", "Sin venta en 90 días con stock…", "Marcado no comprar…"); orden por `availableStock × margin` desc.

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
- **Vacíos por alcance/datos:** cada tabla tiene `emptyMessage` ("No hay categorías en tu alcance.", "No hay productos en tu alcance.", "No hay productos nuevos por evaluar en tu alcance.", "Sin candidatos a salida en tu alcance. Surtido sano.").
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
- El rol de categoría es **relativo a la cartera visible** (cambia según el alcance, porque medianas y corte del 30% se recalculan sobre las categorías en `inScope`).
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
Detectar **productos redundantes** — SKUs que se solapan dentro de una misma subcategoría y gama de precio — para racionalizar el surtido y **liberar capital inmovilizado**. Regla de negocio central (comentario en `catalogOptimization.ts`): por tipo de producto basta con la mejor opción por gama de precio (económica / media / premium); tener varias en la misma gama duplica el segmento sin diferenciación (caso de "10 martillos iguales").

### Tipo de usuario
Comprador y líder (sin restricción de ruta). Alcance controlado por `ScopeToggle`.

### Descripción detallada
Página contenedora ligera: `PageHeader` (título "Surtido redundante") con `ScopeToggle` + `Select` de categoría en la acción, y el componente reutilizable **`CatalogRedundancy`** (recibe `products` ya acotados, `scopeLabel`, `showSummary` true por defecto) que hace todo el trabajo. El mismo componente se reutiliza en el detalle de categoría (según su docstring).

### Información que muestra
- Fila de 4 `KpiCard` (resumen, solo si `showSummary`): **Subcategorías saturadas** (tone `warn`, "con SKUs que se solapan"), **SKUs redundantes** (tone `bad`, descripción "% del surtido" vía `redundantShare`), **Capital liberable** ($, tone `info`, "inmovilizado en redundantes"), **SKUs analizados** (tone `neutral`, "en el ámbito").
- `HelpNote` (variant `tip`, título "¿Qué es "redundante"?") explicando gama de precio y conservar el mejor por venta/rotación/margen.
- Barra de filtros por acción (chips) + acciones (`ExportButton`, botón crear campaña de liquidación).
- Grid `lg:grid-cols-2` de tarjetas por subcategoría saturada (`GroupCard`): bloque "Conservar (uno por gama)" (borde verde, con gama/venta/rotación/margen y badge "Conservar" + eventual "Reactivar compra") y bloque "Sobran" (con motivo, `Badge` de acción y capital inmovilizado por SKU).

### Secciones / bloques
1. **Filtro superior** (en `PageHeader`): ScopeToggle + Select "Todas las categorías".
2. **KPIs resumen** (`showSummary`, true aquí).
3. **HelpNote "¿Qué es redundante?"**.
4. **Filtros por acción + botones de acción**.
5. **Grid de grupos** (subcategorías con exceso), cada uno con bloque "Conservar (uno por gama)" y bloque "Sobran".

### Filtros disponibles
- **ScopeToggle** (Mi cartera / Todas).
- **Select de categoría** (`useUrlState("cat")`, persistido en la URL; `aria-label` "Filtrar por categoría", placeholder "Todas las categorías"; opciones = categorías presentes en el alcance, ordenadas).
- **Filtros por acción** (chips, `RedundancyFilter`): Todos, Liquidar, Descontinuar, Reactivar compra (solo se muestran los que tienen `count > 0`, además de "Todos"); cada chip muestra su conteo entre paréntesis.

### Acciones del usuario
- Acotar por alcance y por categoría.
- Filtrar por tipo de acción sugerida.
- **Exportar CSV** de redundantes (`ExportButton`, archivo `catalogo-redundantes`; columnas: SKU, Producto, Categoría, Subcategoría, Acción sugerida, Conservar (líder), Venta 30d, Stock disponible, Días inventario, Capital inmovilizado).
- **Crear campaña de liquidación** con los redundantes que tienen stock (`Button` "Crear campaña de liquidación (N)" → abre `CampaignBuilderModal`). El botón solo aparece si `liquidationLines.length > 0`.
- Navegar a detalle de cada SKU (conservar o candidato) — toda la fila es un `Link` a `/productos/{sku}`.

### Botones y controles
- `ScopeToggle`, `Select` categoría, chips de filtro por acción, `ExportButton`, botón "Crear campaña de liquidación (N)", links a productos, `CampaignBuilderModal` (formulario modal — ver pantalla 4 · Anticipación para su detalle de campos; es el mismo componente).

### Tablas / tarjetas / formularios / componentes
- `PageHeader`, `Select`, `CatalogRedundancy` (con `KpiCard`, `HelpNote`, `ExportButton`, `Button`, `EmptyState`, `GroupCard`, `Badge`), `CampaignBuilderModal`.
- Formulario: el `CampaignBuilderModal` precargado con `initialName` "Liquidación {categoría}" (si hay `scopeLabel`) o "Liquidación de surtido", `initialChannels` `["web", "marketplace"]` y `initialLines` = productos redundantes con `availableStock > 0` a **30% de descuento** (`LIQUIDATION_DISCOUNT`).

### Campos de formularios
En el `CampaignBuilderModal` (ver pantalla 4 · Anticipación para descripción completa): Nombre, Fecha inicio, Fecha término, Canales (multi-selección), buscador de productos, lista de productos con % descuento por línea. Al guardar, la campaña va a `localStorage` `compras:campaigns` (modelo `CreatedCampaign`).

### Estados posibles
- **Catálogo sano** (sin candidatos): `EmptyState` "Catálogo sano" ("No se detectaron SKUs redundantes en este ámbito…"; se muestra cuando `candidateCount === 0`).
- **Con redundancia**: KPIs + grupos.
- **Acciones de SKU sugeridas** (`classify` en `catalogOptimization.ts`):
  - `liquidate` ("Liquidar", badge ámbar) — el candidato tiene stock y no está muerto.
  - `discontinue` ("Descontinuar", badge rojo) — `productStatus` `no_sales`/`discontinued` **o** `totalStock === 0`.
  - `review` ("Revisar", badge slate) — definido en el tipo y en `ACTION_LABEL`, pero **`classify` nunca lo produce** (label existe por completitud).
- **Reactivar compra**: cuando el "mejor de la gama" (`keeper`) está `purchaseStatus === "do_not_buy"` o `productStatus === "discontinued"` (`needsReactivation`) → badge ámbar "Reactivar compra" en el keeper y chip de filtro "Reactivar compra".
- Severidad `high`/`medium` (`high` si SKU muerto o `inventoryDays >= 120`) se **calcula pero no se muestra** en la UI.
- Sin estados de carga/error de red (datos síncronos).

### Navegación hacia otras pantallas
- Detalle de producto (`/productos/{sku}`) desde cada SKU conservado o candidato.
- Al guardar la campaña de liquidación, `toast.success` con acción "Ver campañas" que navega a **`/anticipacion`**. (Nota: la campaña creada se guarda en `localStorage` `compras:campaigns`, que es la lista de "Mis campañas" de `/anticipacion`, **no** la de `/campanas`.)

### Flujo funcional completo
1. Usuario entra a `/surtido-redundante`; ve sus categorías (o todas) analizadas.
2. Revisa KPIs de capital liberable y redundancia.
3. Filtra por categoría y/o por acción (liquidar/descontinuar/reactivar).
4. En cada subcategoría saturada ve qué SKU conservar (uno por gama) y cuáles sobran.
5. Puede exportar la lista o lanzar una campaña de liquidación con los redundantes con stock.
6. Al crear la campaña, se persiste en "Mis campañas" y se le ofrece navegar a `/anticipacion`.

### Reglas de negocio inferibles
- Agrupación por `categoría|||subcategoría`; solo grupos con **≥ 2 SKUs** se analizan.
- Gama de precio (`tierOf`): tercios del rango de precios del grupo → `low` (`t < 1/3`), `high` (`t > 2/3`), `mid` (resto); si `max <= min` (todos igual precio) → todos "mid".
- "Mejor de la gama" (`better`): mayor venta 30d, luego rotación, luego margen.
- Redundante = todo SKU que no es el mejor de su gama (`sorted.slice(1)`).
- Acción liquidar vs descontinuar según stock/ventas (ver Estados).
- Capital inmovilizado por SKU = `round(cost × totalStock)`; capital liberable del grupo = suma de candidatos.
- Descuento de liquidación por defecto = 30%; solo entran a la campaña líneas con `availableStock > 0`.
- Grupos ordenados por capital liberable desc.
- `share` (venta del candidato / venta del líder) se usa solo en el texto del motivo (`buildReason`).

### Validaciones
- Del modal de campaña: nombre no vacío, al menos un canal, al menos un producto (mensajes de error inline); descuento por línea acotado 0–90 (`input number` `min={0} max={90}`).

### Permisos / restricciones
- Sin restricción por rol. Alcance por `ScopeToggle`.

### Dudas / definiciones pendientes
- **Definición pendiente:** la acción "review" está tipada (`ACTION_LABEL.review = "Revisar"`) pero `classify` nunca la genera; ¿debía existir un caso intermedio?
- **Definición pendiente:** severidad (`high`/`medium`) se calcula pero no se muestra — ¿uso previsto?
- **Suposición:** al liquidar/descontinuar no hay flujo de aprobación ni cambio de estado del producto desde esta pantalla; la única acción "ejecutora" es crear una campaña de liquidación.
- **Definición pendiente:** los umbrales de gama por tercios y `inventoryDays >= 120` son heurísticas de demo.
- **Observación:** `skuOptimizationStatus` (mismo archivo) expone el estado de redundancia de un SKU para otras vistas (p. ej. detalle de producto); no se usa dentro de esta pantalla pero forma parte del módulo.

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
Comprador y líder (sin restricción de ruta). Esta pantalla **no** tiene `ScopeToggle`: opera sobre el conjunto completo de planes y de productos (`mockProducts`).

### Descripción detallada
Página con estado editable persistido en `localStorage` (`compras:campaign-plans`, inicializado con `CAMPAIGN_PLANS` — modelo `CampaignPlan`). Un selector de campañas (chips) permite cambiar de plan (`selId`, inicial `plans[0]?.id ?? "cyber"`) o crear uno nuevo. Un `Card` de resumen muestra métricas del plan activo. Dos pestañas: **Planificación** y **Rendimiento**. La planificación gestiona presupuesto por canal, espacios publicitarios (cupos) y la tabla de productos en descuento. El rendimiento (componente `CampaignPerformance`) muestra KPIs y tablas por canal/producto con datos **simulados** (`mockCampaignPerformance`, deterministas, sin `Math.random` ni `Date.now`).

**Planes semilla (`CAMPAIGN_PLANS`, 3):**
| id | Nombre | Fechas | Presupuesto total | Reparto (redes/ml/web/tienda) | N productos |
|---|---|---|---|---|---|
| `cyber` | Cyber Junio | 24–27 jun 2026 | $8.000.000 | 3,2M / 2,4M / 1,6M / 0,8M | 6 |
| `invierno` | Campaña Invierno | 10–24 jul 2026 | $6.000.000 | 1,8M / 1,2M / 2,0M / 1,0M | 5 |
| `fiestas` | Fiestas Patrias | 5–18 sep 2026 | $5.000.000 | 1,5M / 0,9M / 1,1M / 1,5M | 5 |

### Información que muestra
**Selector y resumen:**
- Chips de campañas (nombre + "en N d" / "en curso" según `daysUntil(from)`) + chip "Crear campaña".
- `Card` resumen: nombre, `Badge` rojo "en N días", rango de fechas (`rangeText`) + año, **Productos** (conteo), **Descuento prom.** (`-N%`, media de `(1 - promo/normal)` por producto), **Venta estimada** ($ compacto, suma de `estSale`), barra de "Presupuesto asignado {X} de {total}" con % y color (verde ≤90%, ámbar >90%, rojo si sobregiro) y pie "Disponible {…}" / "Excede en {…}".

**Pestaña Planificación:**
- **Presupuesto por canal**: 4 `Card` en orden fijo `channelOrder = ["redes","ml","web","tienda"]` (Redes Sociales, Mercado Libre, Web / Banner, Tienda física — de `CHANNEL_META`), cada una con icono/tono, N productos, presupuesto ($ compacto), "% del total", barra de uso (`used/budget`) y "{…} asignado".
- **Espacios publicitarios**: `Card` resumen ("N libres de N cupos", "N ocupados", barra, "% de cupos disponibles", toggle Tarjetas/Calendario) + chips de filtro por canal (con conteo de cupos libres por `filterKey`) + vista de espacios en grid o calendario.
- **Productos en descuento**: tabla HTML propia (min-width 920px, scroll horizontal).

**Pestaña Rendimiento** (`CampaignPerformance`, datos simulados):
- `HelpNote` "Datos simulados (demo)." (menciona integración futura con analítica web, Google Ads, mailing, Mercado Libre, redes y POS).
- 6 `KpiCard`: **Inversión** ("Gasto en publicidad"), **Ingresos** ("Venta atribuida"), **ROAS** (tono según `roasTone`), **Conversiones** ("Ventas generadas"), **CTR promedio** ("Clics sobre impresiones"), **Impresiones** ("Veces exhibido").
- Tabla "Rendimiento por canal": Canal, Impresiones, Clics, CTR, Conversiones, Ingresos, Inversión, ROAS — ordenable, por defecto por Ingresos desc.
- Tabla "Rendimiento por producto": Producto (link + placement), Canal, Posición (`Nº`), Impresiones, Clics (`hideOnMobile`), CTR, Conversiones, Ingresos, ROAS — ordenable, por defecto por Ingresos desc.

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
- **Filtros por canal** de espacios (chips `chips`): Todos, Web, Tienda física, Mercado Libre, Redes, Email — cada uno con conteo de cupos libres (`freeByKey`). Filtra los espacios mostrados por `filterKey`. **Nota:** el espacio "Email & newsletter" tiene canal `web` pero su `filterKey` se fuerza a `"email"` (`fkOf`), por lo que aparece bajo el chip "Email", no bajo "Web".
- **Toggle de vista de espacios**: Tarjetas (`grid`) / Calendario (`calendar`).
- Ordenamiento de columnas en las tablas de rendimiento (por defecto por ingresos desc.).
- No hay filtro/scope de cartera aquí.

### Acciones del usuario
- Seleccionar campaña; crear campaña nueva (modal).
- Agregar producto en descuento (botón global "Agregar producto" o desde un espacio con cupo libre, con `channel`/`placement` preseteados).
- Editar producto (icono lápiz en la tabla) y quitarlo (botón "Quitar" en el modal de edición).
- **Reordenar** la posición de exhibición de un producto dentro de su placement (flechas subir/bajar, `moveProduct` intercambia `order` con el vecino), tanto en las tarjetas de espacios como en la columna "Posición" de la tabla. Deshabilitadas en los extremos (`isFirst`/`isLast`).
- Cambiar de vista de espacios (tarjetas/calendario) y filtrar por canal.
- Cambiar a la pestaña Rendimiento y ordenar sus tablas.
- Navegar a detalle de producto/categoría desde la tabla.

### Botones y controles
- Botón "Agregar producto" (header), chips de campaña, chip "Crear campaña", `Tabs` (Planificación con `count` = N productos / Rendimiento), toggle vista (Tarjetas/Calendario), chips de canal, botones de asignación por espacio ("Asignar producto" / "Asignar primer producto" / "Asignar último cupo" / "Ver asignaciones" según cupos), flechas subir/bajar (`IconArrowUp`/`IconArrowDown`), icono editar por fila, `Modal` agregar/editar (con botón "Quitar" en modo edición) y `Modal` crear campaña.

### Tablas / tarjetas / formularios / componentes
- `PageHeader`, `Card`/`CardBody`, `Badge`, `Tabs`, `Modal`, `Input`, `Select`, `Button`, `Svg` (icono inline compartido de `campaignsShared.tsx`), `KpiCard`, `DataTable` (en rendimiento), tabla HTML propia para productos en descuento.
- Columnas exactas de la tabla "Productos en descuento": **Producto** (link + badge "Nuevo" + SKU · link categoría), **Precio antes / después** (tachado + promo + `-N%`), **Vigencia** (`rangeText`), **Canal y ubicación** (icono + `placementLabel`), **Posición** (`Nº` + flechas + "de N"), **Presupuesto**, **Venta estim.**, **Estado** (`Badge` de `STATUS_CFG`), y columna vacía con botón editar.
- Persistencia: `useLocalStorage` (`compras:campaign-plans`). Toasts vía `useToast`.

### Campos de formularios
**Modal Agregar/Editar producto en descuento** (`ProductForm`; título "Agregar/Editar producto en descuento", size `lg`):
- **Producto** (`Select` de SKU en modo "add", opciones `SKU — nombre`; solo lectura en "edit"). Al elegir SKU se autocompletan nombre, categoría y precios sugeridos (`retailPrice`: `normal = round(cost / (1 - (margin||30)/100) / 10) × 10`; `promo = round(normal × 0.85 / 10) × 10`).
- **Descuento desde** (fecha).
- **Descuento hasta** (fecha).
- **Precio antes** (numérico, filtra no-dígitos).
- **Precio con descuento** (numérico, filtra no-dígitos).
- **Descuento** (calculado, solo lectura, `discountPct`; muestra "—" si no válido).
- **Canal** (`Select`: Redes Sociales / Mercado Libre / Web / Banner / Tienda física).
- **Ubicación / exhibición** (`Select`: labels de `PLACEMENT_LABELS` — Reel Instagram/TikTok, Banner home web, Cabecera de góndola, Vitrina tienda, Listado destacado ML, Email & newsletter).
- **Presupuesto de publicidad** (numérico, filtra no-dígitos).

**Modal Crear campaña** (`CampaignPlan`):
- **Nombre de la campaña** (texto, placeholder "Ej: Cyber Septiembre").
- **Desde / Hasta** (fechas; valores iniciales `cmFrom = 2026-06-25` / `cmTo = 2026-06-30`).
- **Presupuesto total de la campaña** (numérico). Se reparte automáticamente **40% Redes, 30% ML, 20% Web, 10% Tienda** (`channelBudget`), con nota "Lo puedes ajustar después".

### Estados posibles
- **Estados de producto de campaña** (`STATUS_CFG`): `ready` ("Listo", verde), `pending` ("Falta creativo", ámbar), `stock_risk` ("Riesgo de stock", rojo). Los tres existen en los datos mock (`CAMPAIGN_PLANS`).
- **Presupuesto**: normal (verde), > 90% (barra ámbar), sobregiro (`overBudget`, barra roja + "Excede en …").
- **Cupos de espacio**: "Completo" (0 libres, rojo), "Último cupo" (1 libre, ámbar), "N libres de N" (verde).
- **Campaña vacía** (sin productos): tarjeta CTA "Aún no hay productos en esta campaña".
- **Rendimiento sin productos**: tarjeta "Todavía no hay rendimiento que mostrar".
- **Producto nuevo**: badge "Nuevo" (`isNew`); un producto agregado entra con `isNew: true` y `status: "pending"`.
- Estados de campaña creada desde el modal (`draft`/`scheduled`/`active`) aplican a "Mis campañas" de `/anticipacion` (`CreatedCampaign`), **no** a los planes (`CampaignPlan`) de esta pantalla.
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
- Venta estimada de un producto = `round(budget × 4)` (`estSale`).
- Precio normal sugerido = `round(cost / (1 - margen) / 10) × 10` (margen 30 si falta); promo sugerida = `round(normal × 0.85 / 10) × 10`.
- **Espacios publicitarios (`SPACE_TYPES`, 6 tipos, 27 cupos totales):** Banner Home Web (canal web, 3), Listado destacado (ML, 8), Reel Redes (redes, 6), Cabecera de góndola (tienda, 4), Vitrina tienda (tienda, 2), Email & newsletter (web/filtro email, 4). Al asignar, el producto va al final de su placement (`nextOrder = placementCount + 1`); `order` gestiona posición (1 = más visible). En edición sin cambiar placement se conserva el orden previo.
- Un producto nuevo entra con estado `pending`; en edición conserva su `status` e `isNew` previos.
- El descuento debe ser positivo (promo < normal) para ser válido y contar como descuento.
- **Rendimiento (`campaignPerformance`, simulado y determinista):** métricas por producto derivadas de `budget`, `promo`, hash del SKU e índice; se reparten a los canales de rendimiento (`PERF_CHANNEL_ORDER`: web, google_ads, ml, redes, email, tienda) según `CHANNEL_BASE` (una parte "nativa" del canal del producto + `googleShare`/`emailShare`), por lo que aparecen **Google Ads** y **Mailing / Email** aunque el `CampaignPlan` solo tenga 4 canales. `roasTone`: verde ≥ 3, ámbar ≥ 1,5, rojo < 1,5.

### Validaciones
**Agregar/editar producto** (`fValid`): requiere SKU, fechas desde/hasta, precio normal > 0, promo > 0, promo < normal, presupuesto > 0 y `to >= from`. Si falta algo, `toast.warning` "Completa producto, fechas, precios y presupuesto" y el botón "Agregar a la campaña"/"Guardar cambios" queda deshabilitado.
**Crear campaña** (`submitCreate`): requiere nombre no vacío, ambas fechas, `to >= from` y presupuesto > 0; si no, `toast.warning` "Completa nombre, fechas y presupuesto".
Inputs numéricos filtran no-dígitos (`replace(/[^0-9]/g, "")`).

### Permisos / restricciones
- Sin restricción por rol. Persistencia local por navegador (no compartida entre usuarios; es demo).

### Dudas / definiciones pendientes
- **Definición pendiente:** el rendimiento es **simulado** (`campaignPerformance` sobre datos mock); el `HelpNote` indica que en producción se conectaría con analítica web, Google Ads, mailing, Mercado Libre, redes y POS.
- **Definición pendiente / inconsistencia:** existen **dos conceptos de "campaña"** distintos y desconectados: (a) `CampaignPlan` (esta pantalla, `compras:campaign-plans`, canales Redes/ML/Web/Tienda con espacios, cupos y orden de exhibición) y (b) `CreatedCampaign` ("Mis campañas" en `/anticipacion`, `compras:campaigns`, canales que incluyen Google Ads/Meta/TikTok). No se sincronizan entre sí. Requiere definición de negocio sobre si deben unificarse. Ver "Observación transversal" al final del módulo.
- **Suposición:** `estSale = budget × 4` es un placeholder de demo.
- **Definición pendiente:** no hay flujo de aprobación, publicación ni cierre de campaña; el estado del producto (`ready`/`pending`/`stock_risk`) no se edita explícitamente en el formulario (solo se conserva en edición; los nuevos entran `pending`).

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
Comprador y líder. Alcance por `ScopeToggle` (oportunidades filtradas por `inScope(o.category)`). Integra el borrador de OC (contexto `OcDraftContext`).

### Descripción detallada
Página con dos vistas conmutadas por `Tabs` (`view`): **"Oportunidades detectadas"** (`count` = N oportunidades en alcance) y **"Mis campañas"** (`count` = N campañas creadas). La vista de oportunidades muestra chips de plantillas rápidas, chips de campañas próximas, KPIs clcables (que filtran), un bloque de consolidación de OC por proveedor con alerta de lead time crítico, pestañas de foco por estado, una barra de filtros completa y una `DataTable` con acción por fila. La vista "Mis campañas" lista las campañas creadas (persistidas en `localStorage` `compras:campaigns`, modelo `CreatedCampaign`) con sus productos y estado; permite crear y eliminar.

### Información que muestra
**Vista Oportunidades:**
- Plantillas rápidas de campaña (chips): "Cyber herramientas", "Especial construcción", "Liquidación stock lento", "Campaña jardín primavera".
- Chips "Próximas": "nombre · N SKU · en N días" (agrupadas por `campaignName`, ordenadas por días; días en rojo si ≤ 7, ámbar si no).
- 4 `KpiCard` (escritorio `md:grid-cols-4`, los 3 primeros clcables → filtran por estado): **Riesgo de quiebre** (tone `bad`, "Campaña sin stock"), **Comprar antes** (tone `warn`, "Abastecer evento"), **Sugeridos para liquidar** (tone `warn`, "Sobrestock"), **Compra sugerida campañas** ($ total, tone `info`, "Total a comprar", **no** clcable).
- Bloque "OC a generar por proveedor (N)": una fila por proveedor con "N SKU · N u. · $ · campaña en N días", `Badge` de lead time (rojo "Lead N ≥ N a campaña" si `leadTime >= minDays`, verde "Lead N OK" si no) y botón "Crear OC". La descripción del `CardHeader` advierte cuántos proveedores tienen lead time crítico.
- `Tabs` de foco por estado: Todos, Comprar antes, Riesgo de quiebre, Liquidar, Potenciar, No recomendado (con conteos).
- `FilterBar` + `DataTable` de oportunidades.

**Vista Mis campañas** (`CreatedCampaignsView`):
- Si vacía: `EmptyState` "Aún no has creado campañas" + botón "Crear campaña".
- Si hay: `HelpNote` (variant `tip`) + una `Card` por campaña con nombre, "inicio → término · N productos · N% dcto promedio", `Badge` de estado (Borrador/Programada/Activa, `CREATED_CAMPAIGN_STATUS`), badges de canales (`PROMO_CHANNEL_LABELS`), badge rojo "N con stock bajo — revisa compra" (productos con `availableStock <= 5`), y lista de productos (SKU, nombre, "Stock N" + "· stock bajo" si ≤ 5, badge `-N%`, precio base tachado / precio campaña, link "Ver producto"). Botón eliminar (`IconClose`) por campaña.

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
10. `CampaignBuilderModal` (crear campaña).
11. `ConfirmModal` (eliminar campaña).

### Columnas de la tabla de oportunidades
Orden y contenido exactos (`columns`):
1. **Producto** — SKU · marca, nombre (link `productPath`), "categoría (link) · proveedor (link) / Sin proveedor". Ordenable por nombre.
2. **Oportunidad** — `Badge` (`OPPORTUNITY_TYPE_LABELS`, tono `TYPE_TONE`).
3. **Canal / Campaña** — nombre de campaña + "canal · fecha" (`hideOnMobile`).
4. **Falta** — `formatDays(daysToCampaign)`, rojo si ≤ 7. Ordenable.
5. **Stock disp.** — rojo si ≤ 0 (`hideOnMobile`). Ordenable.
6. **Venta 30d / Var.** — venta + delta de crecimiento (`hideOnMobile`). Ordenable por `growthRate`.
7. **Venta est. campaña** — "N u." (`hideOnMobile`).
8. **Brecha stock** — "-N u." rojo si `stockGap > 0`, "OK" verde si no. Ordenable.
9. **Compra sugerida** — "N u." + $ si `suggestedPurchaseQuantity > 0`, "—" si no. Ordenable por monto.
10. **Margen** — ámbar si < 25% (`hideOnMobile`). Ordenable.
11. **Estado** — `Badge` con `dot` (`CAMPAIGN_STATUS`).
12. **Riesgo / Recomendación** — "⚠ riesgo" + recomendación (`hideOnMobile`).
13. **(acciones)** — botón según `actionLabel` (primario, o secundario "En OC"/"Gestionado" deshabilitado) + botón "Ver producto".

Fila con fondo rojo suave (`bg-rose-50/40`) si `status === "stockout_risk"`. Orden por defecto (memo, no del `SortState`): urgencia de estado (`STATUS_URGENCY`) y luego `daysToCampaign` asc. Click en la fila navega a `/productos/{sku}`.

### Filtros disponibles
- **ScopeToggle** (Mi cartera / Todas).
- **KPIs clcables** que fijan `status` (Riesgo de quiebre / Comprar antes / Liquidar; toggle on/off).
- **Tabs de foco por estado** (Todos, Comprar antes, Riesgo de quiebre, Liquidar, Potenciar, No recomendado; también fijan `status`).
- **FilterBar**: buscador (SKU/producto/campaña), y selects **Canal** (`CHANNEL_LABELS`), **Tipo de oportunidad** (`OPPORTUNITY_TYPE_LABELS`), **Estado** (`CAMPAIGN_STATUS`), **Categoría** (valores presentes), **Proveedor** (valores presentes); toggles: **Riesgo de quiebre** (deja `stockout_risk` + `buy_before_campaign`), **Crecimiento acelerado** (`opportunityType === accelerated_growth`), **Sobrestock / liquidar** (`status === liquidate`), **Margen bajo** (`margin < 25`). Botón limpiar filtros (`clearFilters`).

### Acciones del usuario
- Acotar alcance, filtrar/buscar/ordenar oportunidades.
- **Agregar a OC** un producto (si `actionLabel === "Agregar a OC"` y `suggestedPurchaseQuantity > 0`) → lo añade al borrador de OC (`addItem`) con toast y acción "Ver borrador OC".
- **Crear OC por proveedor** (`createSupplierOc`: consolida todos los SKU sugeridos de ese proveedor en el borrador, evitando duplicados con `hasItem`).
- Acciones simuladas por fila (según `actionLabel`: "Potenciar en web", "Potenciar en marketplace", "Marcar para liquidación", "Excluir de campaña", "Revisar margen") → marcan la fila como "Gestionado" (`done`) con `toast.success` "{actionLabel}: {producto}"; **"Revisar proveedor"** → navega a `/proveedores`.
- **Exportar CSV** de oportunidades filtradas (`campanas-oportunidades`; 16 columnas incl. SKU, Producto, Categoría, Proveedor, Oportunidad, Canal, Campaña, Fecha, Stock, Venta 30d, Crecimiento %, Venta estimada, Brecha, Compra sugerida, Margen %, Estado).
- **Crear campaña** (botón header o plantilla rápida → `CampaignBuilderModal`).
- **Eliminar campaña** creada (con `ConfirmModal`).
- Navegar a detalle de producto (click en fila o "Ver producto"), categoría, proveedor.

### Botones y controles
- `ScopeToggle`, `ExportButton`, botón "Crear campaña", chips de plantillas, `Tabs` (x2: vista y foco por estado), `KpiCard` clcables, botón "Crear OC" por proveedor (primario si crítico, secundario si no), `FilterBar` (search + selects + toggles + limpiar), `DataTable` con acción por fila (`Button` primario/secundario + link "Ver producto"), `CampaignBuilderModal`, `ConfirmModal`, botón eliminar por campaña.

### Tablas / tarjetas / formularios / componentes
- `PageHeader`, `KpiCard`, `Card`, `DataTable` (+ `mobileCard`), `FilterBar`, `Badge`, `Button`, `Tabs`, `ConfirmModal`, `ExportButton`, `CampaignBuilderModal`, `ScopeToggle`, `CreatedCampaignsView` (`EmptyState`, `HelpNote`, `Badge`, `Button`).
- Contextos: `OcDraftContext` (borrador OC: `addItem`, `hasItem`), `ToastContext`, `useLocalStorage` (`compras:campaigns`).

### Campos de formularios
- **`CampaignBuilderModal`** (mismo componente que en Surtido redundante; título "Crear campaña comercial", size `xl`): **Nombre**, **Fecha inicio** (inicial `todayISO = 2026-06-24`), **Fecha término** (inicial `2026-07-04`), **Canales** (multi-selección de `PROMO_CHANNELS`, 10: Web, Marketplace, Tienda física, Omnicanal, Venta empresa, Redes sociales, Email marketing, Google Ads, Meta (Facebook/Instagram), TikTok Ads; por defecto `["web"]`), **buscador de productos** (min 1 carácter, hasta 6 resultados, evita ya agregados), **lista de productos** con **% descuento por línea** (`input number`, 0–90; descuento inicial 10% al agregar, `campaignPrice = round(basePrice × (1 - %/100))`). Badges resumen: "N productos", "Descuento promedio N%", "N con stock bajo — revisa compra antes de lanzar" (≤ 5). El estado de la campaña se deriva de la fecha de inicio (`scheduled` si `startDate > todayISO`, `active` si no). `id` generado con `CAMP-{hashCode(name+startDate+lines.length)}`.
- La tabla de oportunidades no tiene formularios de edición; sus acciones son de un clic.

### Estados posibles
**Estados de oportunidad** (`CAMPAIGN_STATUS`, `CampaignOpportunityStatus`): `ready_for_campaign` (Listo para campaña, verde), `buy_before_campaign` (Comprar antes de campaña, ámbar), `stockout_risk` (Riesgo de quiebre, rojo), `liquidate` (Liquidar, violeta), `boost` (Potenciar, azul), `review_margin` (Revisar margen, ámbar), `review_supplier` (Revisar proveedor, ámbar), `not_recommended` (No recomendado, neutral). **Verificado en `mockCampaignOpportunities`: los 8 estados están presentes** (conteos aprox.: buy_before 5, liquidate 4, boost 3, stockout_risk 2, y 1 c/u de ready_for_campaign, review_margin, review_supplier, not_recommended).
**Tipos de oportunidad** (`OPPORTUNITY_TYPE_LABELS`, 7): campaña planificada, liquidación sugerida, crecimiento acelerado, riesgo de quiebre, producto estrella, revisar antes de campaña, no recomendado. **En el mock aparecen 6 de 7** (todos salvo el tipo `not_recommended`, aunque sí existe el *estado* `not_recommended`).
**Canales** (`CHANNEL_LABELS`, 7: Web, Marketplace, Tienda física, Omnicanal, Venta empresa, Redes sociales, Email marketing). **En el mock aparecen 6 de 7** (todos salvo `b2b`/"Venta empresa").
**Etiquetas de acción por fila** (`actionLabel`, valores reales en el mock): "Agregar a OC", "Marcar para liquidación", "Potenciar en web", "Potenciar en marketplace", "Excluir de campaña", "Revisar margen", "Revisar proveedor".
**Estados de campaña creada** (`CreatedCampaignStatus`): draft (Borrador), scheduled (Programada), active (Activa).
**Estados de UI:** fila ya "En OC" (deshabilitada), "Gestionado" (deshabilitada), lead time crítico vs OK, campañas vacías (EmptyState), sin resultados de filtros ("No hay oportunidades que coincidan con los filtros."). Sin estados de carga/error de red.

### Navegación hacia otras pantallas
- `/productos/{sku}` (detalle de producto; click en fila, "Ver producto" y "Ver producto" de cada campaña creada).
- `/comprar/borradores` (borrador de OC, vía toast tras agregar a OC o crear OC por proveedor).
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
- Orden de la tabla por urgencia (`STATUS_URGENCY`: stockout_risk 0 < buy_before 1 < review_supplier 2 < review_margin 3 < liquidate 4 < boost 5 < ready_for_campaign 6 < not_recommended 7) y luego `daysToCampaign` asc.
- Consolidación por proveedor: una OC por proveedor sumando `suggestedPurchaseQuantity` (solo SKU con cantidad > 0); se ordena poniendo primero los de lead time crítico (`leadTime >= minDays`) y luego por menor `minDays`.
- Lead time **crítico** = `averageLeadTimeDays` del proveedor ≥ días que faltan para la campaña más próxima de su grupo (no alcanza a llegar).
- "Margen bajo" = `margin < 25`.
- "Falta" en rojo si ≤ 7 días.
- Solo se agregan a OC productos con `suggestedPurchaseQuantity > 0` y `actionLabel === "Agregar a OC"`; se evita duplicar (`hasItem`).
- Estado de campaña creada derivado de la fecha de inicio vs `todayISO` (`2026-06-24`).

### Validaciones
- `CampaignBuilderModal` (`save`): nombre no vacío ("Ponle un nombre…"), ≥ 1 canal ("Selecciona al menos un canal."), ≥ 1 producto ("Agrega al menos un producto en descuento."); descuento por línea 0–90. Mensajes de error inline (recuadro rojo).
- Agregar a OC / crear OC por proveedor ignora productos ya presentes en el borrador (toast "Ya estaban en el borrador").
- Eliminar campaña pasa por `ConfirmModal` (mensaje con nombre, N productos y N canales; "Esta acción no se puede deshacer.").

### Permisos / restricciones
- Sin restricción por rol en la ruta. Alcance por `ScopeToggle`. Persistencia local (demo).

### Dudas / definiciones pendientes
- **Definición pendiente:** las acciones "Potenciar en web/marketplace", "Marcar para liquidación", "Excluir de campaña", "Revisar margen" solo marcan la fila como "Gestionado" con un toast (simuladas); no ejecutan ningún cambio real ni dejan trazabilidad persistente (el estado `done` es de sesión, no se guarda).
- **Definición pendiente / inconsistencia:** "Mis campañas" (`compras:campaigns`, `CreatedCampaign`) es un modelo distinto y desconectado de los planes de `/campanas` (`CampaignPlan`). Una campaña creada aquí no aparece en `/campanas` y viceversa.
- **Suposición:** el lead time del proveedor proviene de `getSupplierByName(...).averageLeadTimeDays` (0 si no hay dato).
- **Definición pendiente:** las plantillas rápidas solo precargan el `initialName` de la campaña; no traen productos ni configuración asociada.
- **Definición pendiente:** `mockCampaignOpportunities` está fechado al 24/06/2026 (`TODAY_ISO`); los "días a campaña" y estados son estáticos de demo.

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
- Alcance por cartera del comprador (`ScopeToggle`) compartido entre vistas (excepto `/campanas`).
- Rendimiento de campaña **simulado** y determinista (impresiones, clics, CTR, conversiones, ingresos, ROAS; incluye canales Google Ads y Mailing).
- Alerta de lead time crítico y de stock bajo antes de lanzar campañas.
- Plantillas rápidas de campaña (solo precargan nombre).

### Dependencias con otros módulos
- **Productos** (`/productos/{sku}`): destino de la mayoría de los links; fuente de datos (`mockProducts`).
- **Categorías** (`categoryPath`, `mockCategories`): links desde surtido y campañas; base del rol de categoría.
- **Proveedores** (`/proveedores`, `mockSuppliers`): lead time (`averageLeadTimeDays`) para consolidación de OC y acción "Revisar proveedor".
- **Órdenes de compra / Borrador de OC** (`OcDraftContext`, `/comprar/borradores`): "Agregar a OC" y "Crear OC por proveedor" alimentan el borrador de compra.
- **Rol / Comprador** (`RoleContext`, `BuyerContext` vía `useCategoryScope`): definen alcance y categorías asignadas.
- **Persistencia local** (`localStorage`): `compras:campaign-plans`, `compras:campaigns`, `compras:scope` (demo; no hay backend).

> **Observación transversal (para definición de negocio):** conviven **dos modelos de campaña desconectados** — `CampaignPlan` en `/campanas` (canales `redes/ml/web/tienda`, espacios publicitarios, cupos y orden de exhibición, presupuesto por canal) y `CreatedCampaign` en `/anticipacion` y en la campaña de liquidación de `/surtido-redundante` (canales `PromoChannel` con Google Ads/Meta/TikTok, líneas con `discountPct`, sin espacios ni presupuesto por canal). Comparten la idea de "campaña con productos en descuento y canales" pero no se sincronizan ni comparten `localStorage`. Requiere decisión sobre su unificación.

---

## Verificación de cobertura

Contraste del documento con el código real (archivos leídos: `AssortmentPage.tsx`, `CatalogOptimizationPage.tsx` + `CatalogRedundancy.tsx` + `catalogOptimization.ts`, `CampaignsPage.tsx` + `campaignsHelpers.ts` + `campaignsShared.tsx` + `CampaignPerformance.tsx` + `mockCampaignPlans.ts` + `mockCampaignPerformance.ts`, `CampaignOpportunitiesPage.tsx` + `CreatedCampaignsView.tsx` + `campaignLabels.ts` + `CampaignBuilderModal.tsx`, `assortment.ts`, `AppRoutes.tsx`, `constants.ts`, `mockCampaignOpportunities.ts`).

| Dimensión | Cobertura | Notas |
|---|---|---|
| Pantallas / sub-vistas | Completa | 4 pantallas + 2 sub-vistas (`CampaignPerformance`, `CreatedCampaignsView`); `CatalogRedundancy` reutilizable. |
| Rutas y redirecciones | Completa | 4 rutas confirmadas + 2 redirects (`/catalogo-optimizado`, `/campanas-oportunidades`). |
| Pestañas / secciones | Completa | Surtido (4 tabs), Campañas (Planificación/Rendimiento), Anticipación (Oportunidades/Mis campañas + foco por estado). |
| Controles con etiqueta exacta | Completa | Botones, chips, toggles, tabs, selects transcritos literalmente. |
| Campos de formulario | Completa | `ProductForm`, crear campaña (`CampaignPlan`), `CampaignBuilderModal` (`CreatedCampaign`). |
| Columnas de tabla / KPIs | Completa | Rol, Marca propia, Line review, Productos en descuento, Rendimiento por canal/producto, Oportunidades (13 columnas). |
| Navegación con destino exacto | Completa | `/productos/{sku}`, `categoryPath`, `supplierPath`, `/surtido-redundante`, `/proveedores`, `/comprar/borradores`, `/anticipacion`. |
| Reglas de negocio con umbrales | Completa | 30% tráfico, medianas, ≥10 u. vendedor, top 8 brechas, tercios de gama, `inventoryDays ≥ 120`, LIQUIDATION 30%, dcto inicial 10%, `estSale = budget×4`, reparto 40/30/20/10, `roasTone` (3 / 1,5), margen < 25%, falta ≤ 7 d, lead crítico. |
| Estados reales vs inexistentes por mock | Completa | Oportunidades: 8/8 estados presentes; 6/7 tipos (falta tipo `not_recommended`); 6/7 canales (falta `b2b`). Redundancia: `review` tipado pero no generado. |
| Permisos / restricciones | Completa | Sin control por rol en rutas; único ajuste por rol = valor inicial de `ScopeToggle`. |
| Validaciones | Completa | `fValid`, `submitCreate`, `save` del builder, límites numéricos. |
| Dudas / definiciones pendientes | Completa | Dos modelos de campaña desconectados; acciones simuladas; severidad/`review` sin uso; heurísticas de demo; datos fechados al 24/06/2026. |

**Hallazgos destacados de esta auditoría (añadidos o precisados respecto de la versión previa):**
- `/campanas` es la única pantalla del módulo **sin `ScopeToggle`**.
- El espacio "Email & newsletter" (canal `web`) se filtra bajo el chip **"Email"** por `fkOf` — no bajo "Web".
- Los **8 estados** de oportunidad existen en el mock; el **tipo** `not_recommended` no aparece (sí el estado); el canal `b2b`/"Venta empresa" no aparece.
- Etiquetas de acción reales por fila (7): "Agregar a OC", "Marcar para liquidación", "Potenciar en web", "Potenciar en marketplace", "Excluir de campaña", "Revisar margen", "Revisar proveedor".
- 3 planes semilla con nombres/fechas/presupuestos exactos; 6 tipos de espacio, **27 cupos** totales.
- El rendimiento simulado reparte a **6 canales** (incl. Google Ads y Mailing) aunque el `CampaignPlan` solo tenga 4; `roasTone` verde ≥ 3, ámbar ≥ 1,5, rojo < 1,5.
- `TODAY_ISO`/`todayISO` = `2026-06-24` en todo el módulo; crear campaña en `/campanas` inicia con `2026-06-25 → 2026-06-30` y el builder con `2026-06-24 → 2026-07-04`.
