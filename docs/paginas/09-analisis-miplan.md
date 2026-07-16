# Análisis, Mi Plan, Reportes y Acceso

Documentación técnica de las páginas de análisis de compras/ventas, ranking del equipo, calidad de compra, desempeño individual, alertas, reportes exportables y el login. Todas viven bajo `src/pages/` (algunas en el subdirectorio `src/pages/reports/`) y se enrutan desde `src/routes/AppRoutes.tsx`.

## Tabla de contenidos

1. [PurchaseAnalysisPage — Ranking & liquidación](#1-purchaseanalysispage--ranking--liquidación)
2. [RankingPage — Competencia del equipo](#2-rankingpage--competencia-del-equipo)
3. [SalesAnalysisPage — Análisis de ventas](#3-salesanalysispage--análisis-de-ventas)
4. [ReportsPage — Reportes consolidados](#4-reportspage--reportes-consolidados)
5. [reports/ExportLauncher.tsx](#5-reportsexportlaunchertsx)
6. [reports/csv.ts](#6-reportscsvts)
7. [reports/definitions.ts](#7-reportsdefinitionsts)
8. [AprendizajePage — Aprendizaje de compra](#8-aprendizajepage--aprendizaje-de-compra)
9. [PurchaseQualityPage — Calidad de compra](#9-purchasequalitypage--calidad-de-compra)
10. [MyPerformancePage — Mi desempeño](#10-myperformancepage--mi-desempeño)
11. [AlertsPage — Alertas comerciales](#11-alertspage--alertas-comerciales)
12. [LoginPage — Inicio de sesión](#12-loginpage--inicio-de-sesión)
13. [Hallazgos de clean-code](#13-hallazgos-de-clean-code)

---

## 1. PurchaseAnalysisPage — Ranking & liquidación

### Ruta y archivo
`/analisis-compra` → `src/pages/PurchaseAnalysisPage.tsx`.

### Propósito
Vista de "comprar bien": rankea los productos, proveedores y marcas de mayor venta en el alcance del usuario, y separa en una pestaña aparte los productos candidatos a liquidar o descontinuar.

### Fuentes de datos
- `src/data/mockProducts` (`products`) — fallback de `useCollection<Product>("products", mockProducts)`.
- `src/context/DataContext` (`useCollection`) — colección editable/versionada de productos.
- `src/context/BuyerContext` (`useBuyer` → `myCategories`).
- `src/context/RoleContext` (`useRole` → `role`).
- `src/utils/useUrlState` — filtros persistidos en la URL.
- `src/utils/filters` (`uniqueValues`) — opciones de los selects.
- `src/utils/calculations` (`coverageDays`).
- `src/utils/entityLinks` (`productPath`, `supplierPath`).
- `src/utils/formatters` (`formatCurrency`, `formatCurrencyCompact`, `formatNumber`, `formatPercent`).

### Estado y navegación
- `tab` (`useUrlState("tab", "productos")`): `productos | proveedores | marcas | liquidar`.
- `query`, `category` (`cat`), `brand` (`marca`), `supplier` (`prov`): filtros de la pestaña "Top productos", persistidos en la URL.
- `productSort`, `supplierSort`, `brandSort` (`useState<SortState>`): orden de cada tabla; se alternan con un `toggleSort` local.
- Navegación: clic en fila de producto → `productPath(sku)`; clic en proveedor → `supplierPath(nombre)`; botones de acción de liquidación navegan a `/surtido-redundante`, `productPath`, o `/campanas` según el motivo.

### Estructura visual
- KPIs: "SKUs en alcance", "Venta 30d", "Candidatos a liquidar" (clic → tab liquidar), "Sin rotación (30d)" (clic → tab liquidar).
- `Tabs` con 4 pestañas y contador por pestaña.
- Pestaña **Top productos**: `FilterBar` (búsqueda + selects categoría/marca/proveedor) + `DataTable` de hasta `TOP_LIMIT = 100` productos, con `mobileCard`.
- Pestaña **Top proveedores** / **Top marcas**: `DataTable` de filas agregadas (`AggregateRow`).
- Pestaña **Liquidar / descontinuar**: `HelpNote` con los criterios + `DataTable` de `LiquidationCandidate` con badge de motivo, métrica clave y botón de acción.

### Lógica de negocio clave
- **Alcance por rol**: el comprador ve solo `myCategories`; el líder ve todo `products`.
- **Candidatos a liquidar** (`buildLiquidationCandidate`): evalúa cada producto en orden de prioridad —
  1. **Sin rotación**: `salesLast30Days === 0` y `availableStock > 0` → severidad basada en capital detenido (tope 5).
  2. **Margen bajo/negativo**: `margin < LOW_MARGIN_PCT` (20%) → severidad 4 si negativo, 2 si solo bajo.
  3. **Sobrestock**: `coverageDays >= OVERSTOCK_COVERAGE_DAYS` (120 días) con venta activa → severidad basada en cobertura.
  La lista final se ordena por `severity` descendente (más capital detenido o peor margen primero).
- **Agregación por proveedor/marca** (`aggregate`): agrupa el alcance por `supplierName` o `brand`, sumando venta 30d, valor de stock y promediando margen.
- **Rotación** (`rotationTone`/`rotationLabel`): ≥8 alta (verde), ≥4 media (ámbar), <4 baja (rojo).

### Subcomponentes definidos en el archivo
- `rotationTone(rotation)` — tono de badge según rotación.
- `rotationLabel(rotation)` — etiqueta legible de rotación.
- `buildLiquidationCandidate(p)` — clasifica un producto como candidato a liquidar (o `null`).
- `PurchaseAnalysisPage` — componente de página (único export).

---

## 2. RankingPage — Competencia del equipo

### Ruta y archivo
`/equipo/ranking` (protegida con `RoleGate allow="lider"`) → `src/pages/RankingPage.tsx`.

### Propósito
Tablero de gamificación del equipo de compradores: ranking general por score, rankings destacados por dimensión, reconocimientos del mes, movimientos de liga, retos, premios configurables y temporadas anteriores.

### Fuentes de datos
- `src/data/mockBuyers` (`buyers`, `getBuyer`).
- `src/data/mockSeasonHistory` (`seasonHistory`).
- `src/data/mockCompetitionFeed` (`competitionFeed`).
- `src/data/mockRewards` (`defaultRewards`, `REWARD_CRITERIA`, tipo `Reward`).
- `src/data/mockChallenges` (`SEASON`, `PREV_SEASON_NAME`, `challenges`).
- `src/utils/teamScore` — casi toda la lógica de negocio (`teamAggregate`, `scoreColor`, `trendText`, `trendColor`, `leagueOf`, `stockoutRate`, `RANKING_DEFS`, `badgesOf`, `daysToClose`, `seasonStatus`, `SEASON_MOVE_CFG`, `winnerByCriterion`).
- `src/utils/useLocalStorage` — persistencia de premios (`compras:rewards`).
- `src/context/ToastContext` (`useToast`).
- `src/components/business/BuyerDetailDrawer` (`BuyerDetailDrawer`, `BUYER_TONE_AV`).
- `src/components/business/CompetitionFeed`, `src/components/business/ChallengeList`.

### Estado y navegación
- `sel` (`useState<Buyer | null>`): comprador seleccionado, abre `BuyerDetailDrawer`.
- `rewards` (`useLocalStorage<Reward[]>("compras:rewards", defaultRewards)`): premios configurables por el líder.
- `rewardForm` (`useState<Reward | null>`): formulario de alta/edición de premio, controla el `Modal`.
- No usa `useUrlState`; toda la navegación interna es por clic (abre drawer/modal), no hay rutas ni tabs con URL.

### Estructura visual
- Banner de "Temporada en curso" (fondo degradado, top-3 con medallas).
- 3 `KpiCard`: Score promedio, Tasa de quiebres, Margen promedio.
- Lista "Ranking general": fila por comprador (medalla/posición, avatar, nombre, badge de liga, tendencia, score) — clic abre `BuyerDetailDrawer`.
- Grid "Rankings destacados": una `Card` por cada `RANKING_DEFS` (margen, quiebres, rotación, recuperación) con el top 3.
- Grid "Reconocimientos del mes": una tarjeta por cada `badgesOf(buyers)`.
- Card "Movimientos de liga vs temporada anterior": fila por comprador con badges de liga origen→destino y badge de ascenso/descenso.
- `ChallengeList` — "Retos de la semana".
- Grid "Premios de la temporada": tarjetas editables (botón "Editar" abre `Modal`), muestran el ganador actual vía `winnerByCriterion`.
- Grid "Temporadas anteriores": campeón y podio de cada `seasonHistory`.
- `CompetitionFeed` — "Novedades del equipo".
- `Modal` de alta/edición de premio (`Select` de criterio, `Input` título y recompensa, botón Eliminar condicional).
- `BuyerDetailDrawer` — drawer de detalle del comprador seleccionado.

### Lógica de negocio clave
- **Score global**: explicado en el banner informativo (30% cumplimiento de venta, 20% margen, 20% reducción de quiebres, 15% rotación, 10% cumplimiento de OC, 5% gestión de sobrestock); el cálculo real vive en los datos mock/`teamScore`, esta página solo lo consume.
- **Ligas** (`leagueOf`): Bronce/Plata/Oro/Elite/Leyenda según rangos de score fijos en `LEAGUES` (`teamScore.ts`).
- **Movimiento de liga** (`seasonStatus`): compara la liga actual con la liga que tenía `prevSeasonScore` para determinar ascenso/descenso/mantiene.
- **Ganador de premio** (`winnerByCriterion`): recalculado en vivo según el criterio configurado (general, mejora, quiebres, margen, rotación) — no se guarda un ganador fijo.

### Subcomponentes definidos en el archivo
- Ninguno propio más allá del componente de página `RankingPage`; los subcomponentes visuales (`GoalRow`, `Sparkline`, `BUYER_TONE_AV`) están importados de `BuyerDetailDrawer.tsx`.

---

## 3. SalesAnalysisPage — Análisis de ventas

### Ruta y archivo
`/ventas` → `src/pages/SalesAnalysisPage.tsx`.

### Propósito
Analiza señales de venta (crecimiento, caída, venta perdida, estacionalidad) por categoría, proveedor y producto para orientar decisiones de compra.

### Fuentes de datos
- `src/data/mockSales` (`salesKpis`, `salesByCategory`, `salesBySupplier`, `topProducts`, `growingProducts`, `decliningProducts`, `seasonalProducts`).
- `src/data/mockProducts` (`products`, `getProductBySku`).
- `src/data/mockCategories` (`categories`).
- `src/utils/calculations` (`coverageDays`).
- `src/utils/formatters` (`formatCurrency`, `formatCurrencyCompact`, `formatDelta`, `formatNumber`, `formatPercent`, `formatDays`).
- `src/utils/entityLinks` (`supplierPath`).

### Estado y navegación
- `period` (`useState<Period>("30")`): `30 | 90 | 180` días, selector en el `PageHeader` (no persistido en URL).
- `tab` (`useState("resumen")`): `resumen | categorias | proveedores | productos | crecimiento | caida | perdida | temporada`; los KPIs clicables cambian el tab.
- Navegación: enlaces `Link` a `/reposicion?cat=...`, `/inventario`, `/reposicion?foco=urgent`, `/productos/:sku`, `supplierPath(...)`.

### Estructura visual
- Resumen ejecutivo (barra con venta del período, delta, venta perdida, margen).
- 4 `KpiCard` clicables (venta perdida, alta venta + bajo stock, en crecimiento, en caída).
- `Tabs` de 8 secciones con contadores.
- Tab **Resumen**: card "Señales para comprar mejor" (lista de `signals` accionables) + `BarList` de venta por categoría.
- Tab **Categorías/Proveedores**: listas de tarjetas-fila con delta/participación.
- Tab **Productos**: grid de tarjetas con badge "Alta venta + bajo stock" cuando aplica.
- Tabs **Crecimiento/Caída/Temporada**: reutilizan el subcomponente `TrendList`.
- Tab **Venta perdida**: lista o `EmptyState` si no hay productos en quiebre con venta activa.

### Lógica de negocio clave
- **Venta perdida por quiebre**: productos con `availableStock <= 0` y `salesLast30Days > 0`; monto perdido = `salesLast30Days * price`.
- **Alta venta + bajo stock** (riesgo): productos de `topProducts` cuya `coverageDays(...) <= supplierLeadTimeDays * 1.5`.
- **Señales accionables** (`signals`): 4 tarjetas fijas construidas en el render (categoría que más crece, categoría que más cae, venta perdida total, producto en mayor crecimiento), cada una con su CTA y ruta destino.

### Subcomponentes definidos en el archivo
- `TrendList({ trends, positive })` — grid de tarjetas de tendencia (crecimiento/caída/temporada), reutilizado por 3 tabs.

---

## 4. ReportsPage — Reportes consolidados

### Ruta y archivo
`/reportes` → `src/pages/ReportsPage.tsx`.

### Propósito
Centraliza 8 reportes operativos/estratégicos (compras por proveedor, categoría, comprador; OC abiertas; rotación; margen por categoría; alertas de producto; cumplimiento de proveedores), todos derivados de los datos mock existentes y exportables a CSV.

### Fuentes de datos
- `src/data/mockPurchaseOrders` (`purchaseOrders`).
- `src/data/mockProducts` (`products`, `getProductBySku`).
- `src/data/mockSuppliers` (`suppliers`).
- `src/utils/calculations` (`coverageDays`).
- `src/utils/dateRange` (`inRange`, tipo `IsoRange`).
- `src/utils/constants` (`TODAY_ISO`).
- `src/utils/formatters` (`formatCurrency`, `formatCurrencyCompact`, `formatNumber`, `formatPercent`, `formatDays`, `formatDate`).
- `./reports/definitions` (tipos de filas, `REPORTS`, `OPEN_PO_STATUSES`, `daysBetween`, `makeToggleSort`).
- `./reports/ExportLauncher`, `./reports/csv` (columnas CSV por reporte).

### Estado y navegación
- `report` (`useState<ReportKey>("compras_proveedor")`): reporte activo, controlado por `Tabs` (no persistido en URL).
- `range` (`useState<IsoRange>`): filtro de fecha de creación de OC, solo visible cuando `dateScopesReport` es `true` (reportes 1, 2, 3 y 4).
- 8 `SortState` independientes, uno por tabla de reporte (`supplierSort`, `categorySort`, `buyerSort`, `openSort`, `rotationSort`, `marginSort`, `alertSort`, `perfSort`), todos alternados con `makeToggleSort` importado de `definitions.ts`.

### Estructura visual
- `PageHeader` con `ExportLauncher` como acción (botón de exportación del reporte activo, siempre visible arriba).
- 4 `KpiCard` globales: monto comprado, órdenes de compra, proveedores, categorías activas (sobre `scopedOrders`).
- `Tabs` de 8 reportes.
- `FilterBar` con `dateRange` (solo si `dateScopesReport`).
- Por cada reporte: `Card` con `CardHeader` (título, descripción, `ExportButton` local) + `DataTable` con `mobileCard`; algunos incluyen `HelpNote` (categoría, cumplimiento de proveedores) o KPIs adicionales (OC abiertas, alertas de producto).

### Lógica de negocio clave
- **Compras por categoría**: las OC no guardan categoría directamente; se unen las líneas de OC (`o.lines`) con el producto vía `getProductBySku(line.sku)` para obtener `category`, sumando `quantity * unitCost`. Solo OC con detalle de líneas aportan (se documenta cuántas OC del rango no tienen líneas).
- **OC abiertas/atrasadas**: abierta = estado en `OPEN_PO_STATUSES`; atrasada = `status === "delayed"` o `delayedDays > 0` o fecha esperada ya pasada (`daysBetween(expectedDate, TODAY_ISO) < 0`).
- **Productos sin venta / críticos**: sin venta = `salesLast30Days === 0` con stock (capital detenido = `availableStock * cost`); crítico = con venta y `coverageDays <= supplierLeadTimeDays`.
- **Cumplimiento de proveedores**: usa `suppliers` tal cual (sin agregación adicional), coloreado por `deliveryCompliance` (verde ≥85%, ámbar 70–84%, rojo <70%) — mismos cortes que en `PurchaseQualityPage`/otras páginas de proveedores.
- **Exportación**: cada reporte tiene un `ExportButton` local en el `CardHeader` que exporta exactamente las mismas filas/columnas/nombre de archivo que el `ExportLauncher` del header (ver hallazgo de duplicación).

### Subcomponentes definidos en el archivo
- Ninguno; todas las columnas (`supplierColumns`, `categoryColumns`, `buyerColumns`, `openColumns`, `rotationColumns`, `marginColumns`, `alertColumns`, `perfColumns`) se definen inline dentro del componente de página.

---

## 5. reports/ExportLauncher.tsx

### Ruta y archivo
No es una ruta propia; subcomponente usado por `ReportsPage.tsx` en `src/pages/reports/ExportLauncher.tsx`.

### Propósito
Renderiza el `ExportButton` correspondiente al reporte actualmente activo (`report`), para exportar desde el encabezado de la página sin depender de scroll hasta la tabla.

### Fuentes de datos
- `src/components/business/ExportButton`.
- `src/data/mockSuppliers` (solo para tipar `supplierPerfRows: typeof suppliers`).
- `./definitions` (tipos de filas y `ReportKey`).
- `./csv` (todas las columnas CSV: `alertCsv`, `buyerCsv`, `categoryCsv`, `marginCsv`, `openCsv`, `perfCsv`, `rotationCsv`, `supplierCsv`).

### Estado y navegación
Sin estado propio; es un componente puramente derivado de las props que recibe de `ReportsPage`.

### Estructura visual
Un único `ExportButton` (etiqueta "Exportar CSV"), seleccionado por `switch (props.report)`.

### Lógica de negocio clave
`switch` exhaustivo sobre `ReportKey` (8 casos) que mapea cada reporte a su `filename`, `rows` y `columns` — debe mantenerse sincronizado manualmente con los 8 `ExportButton` que `ReportsPage.tsx` ya define inline en cada `CardHeader` (mismos filename/rows/columns, ver hallazgo de duplicación).

### Subcomponentes definidos en el archivo
- `ExportLauncher(props)` — único export.

---

## 6. reports/csv.ts

### Ruta y archivo
No es una ruta; módulo de definición de columnas CSV en `src/pages/reports/csv.ts`.

### Propósito
Define, por cada uno de los 8 reportes, el arreglo de columnas `{ label, value }` que consume `exportToCsv` (vía `ExportButton`) para producir el CSV.

### Fuentes de datos
- `src/data/mockSuppliers` (`suppliers`, solo para tipar `perfCsv`).
- `./definitions` (tipos `BuyerBuyRow`, `CategoryBuyRow`, `CategoryMarginRow`, `OpenOrderRow`, `ProductAlertRow`, `SupplierBuyRow`).

### Estado y navegación
N/A (módulo de datos puro, sin estado ni componentes).

### Estructura visual
N/A.

### Lógica de negocio clave
- Exporta 8 constantes: `supplierCsv`, `categoryCsv`, `buyerCsv`, `openCsv`, `rotationCsv`, `marginCsv`, `alertCsv`, `perfCsv`.
- Los valores monetarios/porcentuales se redondean en el propio `value()` (p. ej. `Math.round(r.avg)`, `Math.round(r.avgMargin * 10) / 10`) para que el CSV no arrastre decimales de punto flotante de los cálculos en memoria.
- Línea 77 contiene un comentario suelto ("Botón de exportación del encabezado…") sin código asociado debajo (ver hallazgos).

### Subcomponentes definidos en el archivo
N/A (sin componentes; solo constantes de columnas).

---

## 7. reports/definitions.ts

### Ruta y archivo
No es una ruta; módulo de tipos y helpers compartidos en `src/pages/reports/definitions.ts`.

### Propósito
Centraliza los tipos de fila agregada, la lista de reportes disponibles, los estados de OC considerados "abiertos" y dos helpers puros (`daysBetween`, `makeToggleSort`) usados por `ReportsPage.tsx`.

### Fuentes de datos
- `src/components/ui/Table` (tipo `SortState`).
- `src/types/purchasing` (`PurchaseOrder`, `PurchaseOrderStatus`, `Product`).

### Estado y navegación
N/A (módulo de tipos/helpers puro).

### Estructura visual
N/A.

### Lógica de negocio clave
- `ReportKey` (union type) y `REPORTS` (metadatos value/label) — fuente única de verdad para las pestañas de `ReportsPage`.
- `OPEN_PO_STATUSES`: estados de OC considerados "en curso" (`draft`, `pending_approval`, `approved`, `sent`, `confirmed`, `partially_received`, `with_difference`, `delayed`).
- `daysBetween(aIso, bIso)`: diferencia en días enteros entre dos fechas ISO, normalizando a medianoche local.
- `makeToggleSort(setter)`: factory que alterna la dirección de orden (`asc`/`desc`) de una columna, con `desc` por defecto al cambiar de columna — misma lógica que el `toggleSort` local de `PurchaseAnalysisPage.tsx` (ver hallazgos).
- Interfaces de fila: `SupplierBuyRow`, `CategoryBuyRow`, `BuyerBuyRow`, `OpenOrderRow`, `CategoryMarginRow`, `ProductAlertRow`.

### Subcomponentes definidos en el archivo
N/A (sin componentes).

---

## 8. AprendizajePage — Aprendizaje de compra

### Ruta y archivo
`/aprendizaje` → `src/pages/AprendizajePage.tsx`. Redirecciones legacy: `/calidad-compra` → `/aprendizaje`; `/decisiones` → `/aprendizaje?tab=decisiones`.

### Propósito
Fusiona en una sola vista, por pestañas, "Calidad de compra" (sugerido vs comprado) y el "Historial de decisiones" (por qué se compró así y cómo resultó) — para no repetir errores de compra.

### Fuentes de datos
Ninguna directa: es un contenedor de layout puro.
- `src/utils/useUrlState`.
- `./PurchaseQualityPage`, `./DecisionsPage` (este último no está en el alcance de este documento; solo se referencia como sub-vista embebida).

### Estado y navegación
- `tab` (`useUrlState("tab", "calidad")`): `calidad | decisiones`; cualquier otro valor cae a `"calidad"` (`view`).
- No navega a otras rutas; solo alterna qué sub-página embebida renderiza.

### Estructura visual
- `PageHeader` + `Tabs` de 2 pestañas.
- Renderiza `<PurchaseQualityPage embedded />` o `<DecisionsPage embedded />` según `view` (el prop `embedded` suprime el `PageHeader` propio de cada sub-página para evitar duplicar el título).

### Lógica de negocio clave
Ninguna propia; delega toda la lógica de negocio a `PurchaseQualityPage` (ver sección 9) y a `DecisionsPage` (evaluación de decisiones vía `evaluateDecision` de `src/utils/decisionEval.ts`, no documentada en detalle aquí por no estar en el alcance asignado).

### Subcomponentes definidos en el archivo
Ninguno; es un simple switch de dos sub-páginas.

---

## 9. PurchaseQualityPage — Calidad de compra

### Ruta y archivo
Embebida en `/aprendizaje` (tab "calidad") vía `AprendizajePage`; no tiene ruta propia en `AppRoutes.tsx`. Acepta prop `embedded?: boolean` para ocultar su `PageHeader` cuando se usa embebida.

### Propósito
Mide si cada línea de compra (OC) se compró bien: compara los "días comprados" (cantidad ÷ venta diaria) contra el rango objetivo de cobertura de la regla de compra aplicable, clasificando cada línea.

### Fuentes de datos
- `src/utils/purchaseQuality` (`purchaseQualityLines`, `PURCHASE_CLASS`, tipos `PurchaseClass`/`PurchaseQualityLine`) — toda la lógica de clasificación.
- `src/context/BuyerContext` (`useBuyer`), `src/context/RoleContext` (`useRole`) — alcance por comprador/líder.
- `src/utils/useUrlState`.
- `src/utils/entityLinks` (`supplierPath`).
- `src/utils/formatters` (`formatCurrencyCompact`, `formatNumber`).

### Estado y navegación
- `query` (`useUrlState("q")`), `klass` (`useUrlState("tipo")`): filtros de texto y de clasificación.
- Enlaces: producto → `/productos/:sku`; proveedor → `supplierPath(...)`.

### Estructura visual
- `PageHeader` (solo si `!embedded`) con `InfoHint` explicando "días comprados".
- 5 `KpiCard`: líneas evaluadas, saludables, cortas, altas, sobrecompras.
- `FilterBar` (búsqueda + select de resultado/clase).
- `Card` con `DataTable` de `PurchaseQualityLine` (producto, proveedor, comprado, días comprados, objetivo, monto, badge de resultado) y `mobileCard`.

### Lógica de negocio clave (calidad de compra vía `purchaseQuality`)
`purchaseQualityLines()` (en `src/utils/purchaseQuality.ts`) recorre todas las líneas de todas las OC y, por cada línea:
1. Calcula `dailyDemand = product.monthlySales / 30`.
2. Resuelve la regla de compra aplicable (`resolveRuleForProduct`) para obtener `targetInventoryDays` (default 45 si no hay regla).
3. Define el rango objetivo como `objMin = obj * 0.7`, `objMax = obj * 1.3`.
4. Calcula `diasComprados = quantity / dailyDemand`.
5. Clasifica (`PurchaseClass`): `sin_venta` (sin demanda diaria), `corta` (< objMin), `saludable` (entre objMin y objMax), `alta` (≤ objMax * 1.8), `sobrecompra` (por encima).

Esta página solo filtra (por comprador si `role !== "lider"`) y visualiza esas líneas ya clasificadas; no repite la lógica de clasificación.

### Subcomponentes definidos en el archivo
Ninguno; solo el componente de página `PurchaseQualityPage`.

---

## 10. MyPerformancePage — Mi desempeño

### Ruta y archivo
`/mi-desempeno` → `src/pages/MyPerformancePage.tsx`.

### Propósito
Panel individual del comprador logueado: su score, nivel de liga, posición y percentil frente al equipo (anonimizado), causa justa de sus quiebres, y cómo subir el score.

### Fuentes de datos
- `src/data/mockBuyers` (`buyers`, `getBuyer`, `CURRENT_BUYER_ID`).
- `src/context/BuyerContext` (`useBuyer` → nombre del comprador actual).
- `src/utils/teamScore` (`teamAggregate`, `scoreColor`, `trendText`, `trendColor`, `leagueOf`, `percentileSimilarLoad`, `RANKING_DEFS`, `badgesOf`, `SCORE_ADVICE`, `daysToClose`, `seasonStatus`, `SEASON_MOVE_CFG`, `winnerByCriterion`).
- `src/utils/buyerAttribution` (`buyerAttribution`) — atribución justa de quiebres.
- `src/data/mockChallenges` (`SEASON`, `challenges`), `src/data/mockCompetitionFeed` (`competitionFeed`).
- `src/data/mockRewards` (`defaultRewards`, tipo `Reward`) + `src/utils/useLocalStorage` (lee `compras:rewards`, mismos premios configurados en `RankingPage`).
- `src/components/business/BuyerDetailDrawer` (`GoalRow`, `Sparkline`), `src/components/business/ChallengeList`, `src/components/business/CompetitionFeed`.

### Estado y navegación
- Sin `useState` propio de la página (solo el `useLocalStorage` de solo-lectura para `rewards`).
- Enlace destacado "Foco de hoy" → `/comprar/decisiones`.

### Estructura visual
- Banner "Foco de hoy" (la mejora de mayor impacto, con puntos potenciales y CTA).
- Gauge circular de score (`conic-gradient`) + badge de liga + `Sparkline` de histórico.
- 3 mini-cards: posición (#N de equipo), percentil (vs carga similar), cumplimiento de metas.
- Card de encuadre positivo ("Vas #N de M... y eres #K en <dimensión>").
- Card "Tus indicadores vs promedio del equipo" (Fill Rate, nivel de servicio, tiempo reposición, quiebres).
- Banner de temporada (mismo estilo de degradado que `RankingPage`, ver hallazgo de duplicación).
- Card "Causa de tus quiebres": barra apilada + desglose por causa (comprador/proveedor/demanda) + nota de equidad.
- Card "Cómo subir mi score" (top 3 mejoras por impacto) + card "Tus reconocimientos" (insignias propias).
- `ChallengeList` de retos propios (equipo, duelos donde participa, rachas).
- `CompetitionFeed` de novedades propias + card "Premios en juego" (con indicador "¡Lo vas ganando tú!").
- "Mis metas del mes" (`GoalRow` por meta) + "Ranking del equipo" anonimizado (`Comprador A/B/C...` salvo la fila propia, que muestra "Tú").

### Lógica de negocio clave
- **Percentil justo**: `percentileSimilarLoad(me, buyers)` compara solo contra compradores con carga similar (±20 pts de `workloadPct`); si el grupo resultante tiene menos de 3, usa el equipo completo.
- **Mejoras priorizadas**: para cada dimensión del `breakdown` del comprador, simula subir el valor hasta `min(95, valor + 15)` y calcula los puntos de score recuperables ponderados por el peso de la dimensión; se listan las 3 de mayor impacto con `pts >= 1`.
- **Atribución justa de quiebres**: delegada íntegramente a `buyerAttribution` (`src/utils/buyerAttribution.ts`), que reparte los quiebres del comprador entre causa comprador/proveedor/demanda de forma determinista (basada en un hash del id del comprador) y calcula `scoreAdjust` (puntos que "deberían" devolverse por causas externas).
- **Ranking anonimizado**: la página oculta los nombres de los demás compradores (`Comprador ${letra}`), mostrando el nombre real solo para la fila propia.

### Subcomponentes definidos en el archivo
Ninguno propio; reutiliza `GoalRow` y `Sparkline` de `BuyerDetailDrawer.tsx`.

---

## 11. AlertsPage — Alertas comerciales

### Ruta y archivo
`/alertas` → `src/pages/AlertsPage.tsx`.

### Propósito
Bandeja de entrada de alertas comerciales (stock, OC, proveedor, margen, demanda, oportunidad) con filtros, detalle y acción sugerida concreta por alerta (agregar a OC, ver OC, revisar proveedor, etc.).

### Fuentes de datos
- `src/data/mockAlerts` (`alerts` como semilla).
- `src/data/mockRecommendations` (`recommendations`) — para la acción "Agregar a OC".
- `src/components/business/alertLabels` (`ALERT_TYPE_LABELS`).
- `src/utils/filters` (`filterAlerts`).
- `src/utils/dateRange` (`inRange`, `IsoRange`).
- `src/utils/formatters` (`formatNumber`, `formatDate`).
- `src/utils/cn`.
- `src/utils/constants` (`TODAY_ISO`).
- `src/utils/useLocalStorage` (persiste overrides de estado de alerta en `compras:alert-status`).
- `src/context/OcDraftContext` (`useOcDraft` → `addItem`, `hasItem`).
- `src/context/ToastContext` (`useToast`).

### Estado y navegación
- `statusOverrides` (`useLocalStorage<Record<string, AlertStatus>>("compras:alert-status", {})`): cambios de estado (revisión/resuelta) superpuestos sobre la semilla `mockAlerts`.
- `tab` (`useState("active")`): `active | new | in_review | resolved | ignored`.
- `query`, `type`, `severity`, `responsible`, `dates` (`useState`, **no** persistidos en URL, a diferencia de otras páginas del set).
- `selectedId` (`useState<string | null>`) + `mobileDetail` (`useState<boolean>`): controla qué alerta se muestra en el panel de detalle (desktop) o en el `Drawer` (móvil).
- Navegación: acciones por alerta a `/comprar/borradores` (tras agregar a OC), `/comprar/seguimiento`, `/proveedores`, `/venta-no-capturada`, `/productos/:sku`; vacío-activas ofrece botón a `/comprar/decisiones`.

### Estructura visual
- `FilterBar` (búsqueda, rango de fecha, selects de severidad/tipo/responsable).
- 4 `KpiCard` clicables: alertas activas, severidad alta, en revisión, resueltas.
- `Tabs` de 5 estados con contadores.
- Layout de bandeja: lista izquierda agrupada por antigüedad (`AlertRow`) + panel de detalle derecho (`AlertDetail`) en desktop; en móvil el detalle se abre en `Drawer`.
- `EmptyState` cuando no hay alertas en la vista/tab actual.

### Lógica de negocio clave
- **Acción sugerida por alerta** (`actionForAlert`): si existe una recomendación de compra (`recommendations`) para el `relatedSku` con `suggestedQuantity > 0`, ofrece "Agregar a OC" (deshabilitado si ya está en el borrador); si no, deriva la acción del `type` de alerta (`po_delayed` → seguimiento de OC, `supplier_delay` → proveedores, `lost_opportunity`/`no_recent_purchase` → venta no capturada, o ver producto).
- **Agrupación por tiempo** (`groupByTime`): clasifica alertas en Hoy / Ayer / Esta semana / Anteriores según `TODAY_ISO`.
- **Orden por severidad**: dentro del tab activo, ordena `high → medium → low`.
- **Persistencia de estado**: marcar "en revisión" o "resuelta" no muta `mockAlerts`; guarda un override por id en localStorage que se aplica sobre la semilla en cada render.

### Subcomponentes definidos en el archivo
- `TYPE_GROUP` — mapa de tipo de alerta a grupo visual (label + tono de badge).
- `groupByTime(items)` — agrupa alertas por antigüedad.
- `AlertRow({ alert, selected, onClick, action })` — fila de la bandeja izquierda.
- `AlertDetail({ alert, primaryAction, onReview, onResolve })` — panel/drawer de detalle.

---

## 12. LoginPage — Inicio de sesión

### Ruta y archivo
`/login` → `src/pages/LoginPage.tsx`, montada por `LoginGate` en `AppRoutes.tsx` (redirige a `/` si ya hay sesión).

### Propósito
Pantalla de acceso de la demo: formulario de correo/contraseña sin backend real, que simplemente marca la sesión como autenticada.

### Fuentes de datos
- `src/context/AuthContext` (`useAuth` → `login`).
- No consume `src/data/*` ni `src/utils/*` de dominio; solo componentes de UI e íconos.

### Estado y navegación
- `email`, `password` (`useState<string>`).
- `showPassword` (`useState<boolean>`): alterna visibilidad del campo contraseña ("ojito").
- `error` (`useState<string>`): mensaje de validación local (campos vacíos).
- Al enviar (`submit`): si `email`/`password` están vacíos, muestra error; si no, llama `login(email.trim())` y navega a `location.state.from` (ruta de origen antes del redirect a login) o `/` con `replace: true`.

### Estructura visual
- Card centrada con logo/marca ("Buyer Workspace"), formulario (`Input` correo con ícono, `Input` contraseña con ícono y botón de ojito), mensaje de error accesible (`role="alert"`), botón "Iniciar sesión", y nota "Demo sin backend: cualquier correo y contraseña inician sesión."

### Lógica de negocio clave (login)
No hay validación de credenciales: `AuthContext.login(email)` simplemente persiste `{ authenticated: true, email }` en `localStorage` (`compras:auth`) vía `useLocalStorage`. Cualquier combinación de correo/contraseña no vacíos autentica. El `email` de la sesión no se usa para lógica de rol/comprador (esos vienen de `RoleContext`/`BuyerContext`, independientes).

### Subcomponentes definidos en el archivo
Ninguno; componente de página único.

---

## 13. Hallazgos de clean-code

Ver la lista de hallazgos en la respuesta final (formato `archivo:línea — problema — acción sugerida`). Resumen de las categorías encontradas:

1. **Duplicación de lógica de orden de tabla** entre `PurchaseAnalysisPage.tsx` (función local `toggleSort`) y `reports/definitions.ts` (`makeToggleSort`, ya exportada y reutilizada por `ReportsPage.tsx`).
2. **Duplicación de UI** del banner de temporada (mismo degradado inline, misma estructura) entre `RankingPage.tsx` y `MyPerformancePage.tsx`.
3. **Magic number duplicado** para el umbral de "margen bajo" (20%): constante nombrada `LOW_MARGIN_PCT` en `PurchaseAnalysisPage.tsx`, pero literal `20` repetido dos veces en `ReportsPage.tsx`.
4. **Duplicación funcional de exportación CSV**: cada uno de los 8 reportes tiene un `ExportButton` con el mismo `filename`/`rows`/`columns` definido dos veces — una vez en `reports/ExportLauncher.tsx` (visible en el header) y otra vez inline en el `CardHeader` de `ReportsPage.tsx`.
5. **Funciones/componentes sobredimensionados**: `ReportsPage()` (~1080 líneas) y, en menor medida, `PurchaseAnalysisPage()` (~600 líneas) mezclan definición de columnas, cálculo de filas y JSX en un único componente; el patrón de extracción ya usado para CSV (`reports/csv.ts`, `reports/definitions.ts`) no se aplicó a las definiciones de columnas de tabla.
6. **Comentario huérfano**: última línea de `reports/csv.ts` (comentario sobre "botón de exportación del encabezado") no tiene código asociado en ese archivo.
