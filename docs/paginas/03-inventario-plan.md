# Inventario y plan de reposición

Documentación técnica de las páginas de análisis de inventario, decisiones de compra/reposición, presupuesto (Open-to-Buy), venta no capturada y señales de venta.

## Tabla de contenidos

1. [InventoryAnalysisPage — `/inventario`](#1-inventoryanalysispage--inventario)
2. [ReplenishmentPage — `/comprar/decisiones`, `/comprar/reposicion`, `/reposicion`](#2-replenishmentpage--comprardecisiones-comprarreposicion-reposicion)
3. [replenishment/components.tsx (subcomponentes de ReplenishmentPage)](#3-replenishmentcomponentstsx)
4. [replenishment/helpers.ts](#4-replenishmenthelpersts)
5. [replenishment/types.ts](#5-replenishmenttypests)
6. [BudgetPage — `/presupuesto`](#6-budgetpage--presupuesto)
7. [LostOpportunitiesPage — `/venta-no-capturada`](#7-lostopportunitiespage--venta-no-capturada)
8. [SalesSignalsPage — `/senales-ventas`](#8-salessignalspage--senales-ventas)
9. [Hallazgos de clean code](#9-hallazgos-de-clean-code)

---

## 1. InventoryAnalysisPage — `/inventario`

**Archivo:** `src/pages/InventoryAnalysisPage.tsx`

### Ruta y archivo
Registrada en `src/routes/AppRoutes.tsx` como `<Route path="/inventario" element={<InventoryAnalysisPage />} />`, cargada en forma perezosa (`lazy`).

### Propósito
Vista analítica de inventario valorizado: capital inmovilizado, sobrestock, stock muerto (sin venta 90 días) y quiebres con venta activa, para priorizar liberación de capital.

### Fuentes de datos
- `src/data/mockInventory.ts`: `inventoryKpis`, `inventoryByCategory`, `inventoryByWarehouse`, `inventoryByRotation`.
- `src/data/mockProducts.ts`: `products` (listado completo, usado para derivar sobrestock, sin venta, stock crítico y capital congelado).
- `src/utils/calculations.ts`: `frozenCapital` (capital sobre el máximo).
- `src/utils/formatters.ts`: `formatCurrency`, `formatCurrencyCompact`, `formatNumber`.

### Estado y navegación
- `useState<string>` `group` — corte de agrupación del gráfico de barras (`category` | `warehouse` | `rotation`), controlado por `Tabs` (`GROUP_TABS`).
- Navegación con `useNavigate()` al hacer click en filas de la tabla de capital inmovilizado (`/productos/:sku`).
- KPIs "Sobrestock" y "SKUs con quiebre" son `KpiCard` cliqueables que enlazan a `/comprar/decisiones?foco=overstock` y `/productos?stock=1` respectivamente.

### Estructura visual
- 4 `KpiCard` hero: Inventario valorizado, Sobrestock, Stock muerto, SKUs con quiebre.
- Fila de chips compactos: Disponible / Comprometido / Stock lento.
- `Card` "Inventario valorizado" con `Tabs` de corte + dos `BarList` lado a lado (valorizado y sobrestock por grupo).
- `Card` "Productos con más inventario inmovilizado": `DataTable` (columnas producto, stock, venta mes, días inv., capital inmovilizado, sobre máximo, estado) con `mobileCard`.
- 3 `ListCard` en grilla: Sobrestock, Sin venta en 90 días, Stock crítico (cada una con `Badge` de conteo y lista de productos enlazados a `/productos/:sku`).

### Lógica de negocio clave
- **Capital inmovilizado**: `p.availableStock * p.cost`, calculado inline (no hay helper centralizado) para ordenar el top 6 (`frozen`), para la columna "Capital inmovilizado" y para las tarjetas móviles/`ListCard`.
- **Sobre máximo (capital a liberar)**: `frozenCapital(p.availableStock, p.maxStock, p.cost)` de `utils/calculations.ts` — excedente sobre `maxStock` valorizado a costo.
- **Sobrestock**: `products.filter(p => p.purchaseStatus === "overstock")`.
- **Sin venta 90 días (candidato a stock muerto)**: `products.filter(p => p.salesLast90Days <= 6)`.
- **Stock crítico**: `products.filter(p => p.availableStock <= 0 && p.salesLast30Days > 0)` (quiebre con venta activa).

### Subcomponentes definidos en el archivo
- `ListCard` — tarjeta con lista de productos (nombre, disponible, días inventario, capital) y badge de conteo; reutilizada para sobrestock, sin venta y stock crítico.

---

## 2. ReplenishmentPage — `/comprar/decisiones`, `/comprar/reposicion`, `/reposicion`

**Archivo:** `src/pages/ReplenishmentPage.tsx`

### Ruta y archivo
Tres rutas en `AppRoutes.tsx` apuntan al mismo componente: `/comprar/decisiones`, `/comprar/reposicion`, `/reposicion`. El título cambia según `pathname` (`"Reposición"` si incluye `/comprar/reposicion`, si no `"Decisiones de compra"`).

### Propósito
Pantalla central de decisión de compra: lista, filtra, agrupa y permite ajustar/ignorar/agregar al borrador de OC las recomendaciones de reposición generadas por el sistema.

### Fuentes de datos
- `src/data/mockRecommendations.ts`: `recommendations` (`allRecs`), el dataset base de sugerencias.
- `src/data/mockPurchaseOrders.ts`: `purchaseOrders` (para detectar OC abiertas por SKU y contar órdenes emitidas/por recibir en la barra de proceso).
- `src/data/mockRfq.ts`: `rfqs` (cotizaciones abiertas para la barra de proceso).
- `src/data/mockSuppliers.ts`: `suppliers` (opciones del modal "Ajustar sugerencia").
- `src/data/mockRules.ts`: `monthlyPurchaseBudget` (presupuesto mensual de referencia, `$28.000.000`).
- `src/utils/filters.ts`: `filterRecommendations`, `uniqueValues`.
- `src/utils/calculations.ts`: `coverageDays`.
- `src/components/business/statusInfo.ts`: `recommendationUrgency`, `priorityUrgency` (orden de urgencia usado en el sort por defecto).
- `src/context/OcDraftContext.tsx` (`useOcDraft`): `addItem`, `hasItem`, `count`.
- `src/context/ToastContext.tsx` (`useToast`).
- `src/context/PurchaseFlowContext.tsx` (`usePurchaseFlow`): `approvals`.
- `src/utils/useLocalStorage.ts`, `src/utils/useUrlState.ts`.
- Subcomponentes/helpers propios de `src/pages/replenishment/*`.

### Estado y navegación
- **Persistente (localStorage)**: `overrides` (`compras:rec-overrides`, ediciones manuales de cantidad/proveedor por recomendación), `ignoredIds` (`compras:rec-ignored`, sugerencias postergadas).
- **URL (`useUrlState`)**: `foco` (`all|urgent|review|overstock`), `query` (`q`), `category` (`cat`), `supplier` (`prov`), `status` (`estado`), `priority` (`prioridad`).
- **UI local (`useState`)**: `selected` (selección múltiple de filas), `sort`, `toggles` (checks: quiebre, riesgo de quiebre, sobrestock, margen bajo, alta/baja rotación), `viewMode` (`product|supplier|category`), `editing`/`editQty`/`editSupplier` (modal "Ajustar sugerencia"), `decision`/`decisionQty` (drawer de decisión).
- Navegación: a `/comprar/borradores` (ver/continuar borrador OC), a `/productos/:sku` (SKU 360), a `/comprar/seguimiento?oc=:numero` (ver OC relacionada), a `/comprar/cotizaciones` y `/comprar/aprobaciones` desde la barra de proceso (`PurchaseProcessBar`).

### Estructura visual
- `PageHeader` con `ExportButton` (exporta `filtered` a CSV/XLSX) y botón "Ver borrador OC".
- `PurchaseProcessBar`: 6 etapas del flujo de compra (Necesidad → Preparación → Borrador → Aprobación → Emitidas → Por recibir), cada una enlazada a su ruta.
- `Card` de presupuesto del mes: barra de progreso (`budgetBar`), monto usado/disponible, capital crítico no cubierto.
- `Card` "Prioridad destacada" (`topDecision`): métricas (`DecisionMetric`) y 3 botones de escenario rápido (Conservador/Sugerido/Agresivo).
- `Card` de continuación de borrador (si `draftCount > 0`).
- Barra de tabs de foco (`Tabs`: Todos/Comprar ahora/Revisar/No comprar) + `SegmentedControl` de vista (Producto/Proveedor/Categoría) + `StateLegend` (detalle de estados en `<details>`).
- `FilterBar`: búsqueda + selects (categoría, proveedor, estado, prioridad) + 6 toggles.
- Barra de acciones masivas flotante (`sticky`) cuando hay selección: agregar al borrador, ignorar, revisar por proveedor.
- Vista `product`: `DataTable` con columnas Producto, Stock disp., Cobertura (`CoverageCell`), Venta (con tendencia), Cantidad sugerida, Capital, Prioridad, OC abierta, Acción.
- Vista `supplier`/`category`: `GroupedDecisionCards`.
- `RecommendationDecisionDrawer` (drawer de decisión con simulación) y `Modal` "Ajustar sugerencia" (edición manual de cantidad/proveedor).

### Lógica de negocio clave
- **Aplicación de overrides**: `recs` combina `allRecs` con `overrides` guardados por SKU (línea de `useMemo`).
- **Foco rápido**: filtra `visible` según `status` (`urgent` → `critical`/`buy_now`; `review`; `overstock`).
- **Orden por defecto**: por `recommendationUrgency` (estado), luego `priorityUrgency`, luego `suggestedPurchaseAmount` descendente.
- **Presupuesto**: `budgetUsedPct = totalSuggested / monthlyPurchaseBudget * 100`; `uncoveredCriticalCapital` = capital de recomendaciones urgentes que excede el disponible.
- **OC abiertas por SKU**: `openPoBySku` (Map) construido filtrando `purchaseOrders` por estados activos y tomando la primera línea por SKU.
- **Agrupación por proveedor/categoría**: `buildDecisionGroups` (de `replenishment/helpers.ts`).
- **Cantidad sugerida "para ~N días"**: `Math.round((availableStock + suggestedQuantity) / (salesLast30Days / 30))` (columna "Cantidad sugerida").
- **Múltiplo de compra**: `purchaseMultiple` (de `helpers.ts`).
- **Tipo de decisión** (Comprar ahora / Reponer / Revisar / No comprar / Postergar): `decisionTypeLabel` (de `helpers.ts`).
- **Tendencia de venta**: `salesTrendPct` (de `helpers.ts`).

### Subcomponentes definidos en el archivo
- Ninguno propio (todos los subcomponentes de UI de esta página viven en `replenishment/components.tsx`); el archivo solo define el componente de página `ReplenishmentPage`.

---

## 3. replenishment/components.tsx

**Archivo:** `src/pages/replenishment/components.tsx`

### Ruta y archivo
No es una página enrutada; agrupa los subcomponentes visuales usados por `ReplenishmentPage`.

### Propósito
Biblioteca de componentes de la vista de reposición: agrupación por proveedor/categoría, tarjetas móviles, y el drawer de decisión con simulación de escenarios, sensibilidad de demanda y comparación de proveedores.

### Fuentes de datos
- `src/data/mockSuppliers.ts`: `suppliers` (comparación de proveedores).
- `src/utils/calculations.ts`: `coverageDays`, `coverageSentence`.
- `src/utils/recommendationReasoning.ts`: `buildRecommendationReasoning`.
- `src/utils/buyingAlerts.ts`: `buildBuyingAlerts`, tipo `BuyingAlert`.
- `src/utils/skuProfile.ts`: `skuProfileOf`, `ABC_LABEL`, `ABC_DESCRIPTION`, `XYZ_LABEL`, `XYZ_DESCRIPTION`.
- `src/utils/cn.ts`, `src/utils/formatters.ts`.
- Tipos locales de `./types` (`DecisionGroup`, `DecisionViewMode`, `OpenPoSignal`) y helpers de `./helpers` (`decisionTypeLabel`, `purchaseMultiple`, `salesTrendPct`).

### Estado y navegación
No maneja estado propio de router; recibe todo por props (patrón controlado) desde `ReplenishmentPage`. Callbacks recibidos: `onQuantityChange`, `onClose`, `onAdd`, `onEdit`, `onIgnore`, `onViewSku`, `onViewOpenPo`, `onSelectGroup`, `onReviewFirst`.

### Estructura visual
- `SegmentedControl`: selector de vista Producto/Proveedor/Categoría.
- `GroupedDecisionCards`: grilla de tarjetas por grupo (proveedor o categoría) con contadores de críticos/revisar/no comprar y badge "OC abierta".
- `RecommendationMobileCard`: tarjeta compacta para tabla en móvil.
- `RecommendationDecisionDrawer`: drawer principal de decisión, con secciones "Decisión sugerida", alertas (`BuyingAlertsStrip`), "Situación" (grilla de `DecisionMetric`), aviso de OC en curso, `CoverageTargetBar`, simulador de cantidad con stepper, `ScenarioCard` × 3, `ReasoningSection` ("Por qué N u."), sección "Demanda", `<details>` de sensibilidad (`SensitivityCard` × 3) y tabla de comparación de proveedores.
- `CoverageCell`: celda de tabla con días de cobertura + barra de color según semáforo.

### Lógica de negocio clave
- **Cobertura proyectada tras la compra** (`projectedCoverage` en el drawer): `(availableStock + cantidad + entrante_efectivo) / demanda_diaria`, redondeado a 1 decimal; si la OC en tránsito está `delayed`, solo se considera 40% de su cantidad (`effectiveIncomingQty`).
- **Riesgo de quiebre** (`stockoutRisk`): Alto si cobertura ≤ lead time, Medio si ≤ 2×lead time, Bajo en otro caso — recalculado independientemente en el drawer, en `buildSimulationScenario`, en `CoverageCell`, en `coverageToneText` y en `SensitivityCard` (ver hallazgos §9.1).
- **GMROI estimado**: `(margen_bruto_esperado × 12) / capital`, donde el margen bruto surge de `protectedSales * margin%` y `protectedSales` limita las ventas protegidas al menor entre pronóstico y stock+compra+tránsito.
- **Escenarios (Conservador/Recomendado/Agresivo)**: `buildSimulationScenario`, cantidades ±30% de la sugerida redondeadas al múltiplo de compra (`roundToMultiple`).
- **Comparación de proveedores**: `buildSupplierComparison` — toma el proveedor actual + hasta 2 alternativos (misma categoría primero, luego cualquiera), aplicando factores de costo ficticios (+4%/−4%).
- **Razonamiento "por qué N unidades"**: delegado a `buildRecommendationReasoning` (`utils/recommendationReasoning.ts`) — descompone la cantidad en demanda de lead time + stock de seguridad + cobertura objetivo, menos stock disponible y tránsito.
- **Alertas de compra**: delegado a `buildBuyingAlerts` (`utils/buyingAlerts.ts`) — meses de inventario, OC abierta duplicada, proveedor atrasado, capacidad de bodega.
- **Perfil ABC/XYZ y margen** (`SkuProfileChips`): usa `skuProfileOf` y clasifica velocidad de venta y color de margen con umbrales propios (≥30% verde, ≥20% ámbar, si no rojo).

### Subcomponentes definidos en el archivo
- `SegmentedControl` — selector de 3 opciones estilo pill.
- `GroupedDecisionCards` — grilla de tarjetas de grupo (proveedor/categoría).
- `RecommendationMobileCard` — tarjeta de recomendación para tabla móvil.
- `RecommendationDecisionDrawer` — drawer completo de decisión y simulación.
- `SkuProfileChips` — chips de clase ABC/XYZ, velocidad de venta y margen.
- `BuyingAlertsStrip` — lista de alertas inteligentes de compra.
- `ReasoningSection` — desglose "por qué N unidades".
- `ReasoningRow` — fila individual del desglose de razonamiento.
- `CoverageTargetBar` — barra visual de cobertura actual vs. simulada vs. objetivo (45-60 d).
- `ScenarioCard` — tarjeta de un escenario de simulación.
- `SensitivityCard` — tarjeta de sensibilidad de demanda (−20%/0%/+20%).
- `DecisionMetric` — bloque de métrica con color por tono (exportado, reutilizado en `ReplenishmentPage`).
- `coverageToneText` — función auxiliar de color de texto según cobertura vs. lead time (no exportada).
- `CoverageCell` — celda de cobertura con barra (exportada, usada en la tabla de `ReplenishmentPage`).

---

## 4. replenishment/helpers.ts

**Archivo:** `src/pages/replenishment/helpers.ts`

### Ruta y archivo
No enrutado; módulo de funciones puras compartidas por `ReplenishmentPage` y `replenishment/components.tsx`.

### Propósito
Centralizar reglas de negocio pequeñas y reutilizables de la vista de reposición: etiqueta de tipo de decisión, tendencia de venta, múltiplo de compra sugerido y agrupación de recomendaciones.

### Fuentes de datos
- `src/utils/calculations.ts`: `coverageDays`.
- Tipos: `PurchaseRecommendation` (`types/purchasing`), `DecisionGroup`, `OpenPoSignal` (`./types`).

### Estado y navegación
No aplica (módulo sin estado ni componentes).

### Estructura visual
No aplica.

### Lógica de negocio clave
- **`decisionTypeLabel(rec)`**: "No comprar" si `overstock`; "Revisar margen"/"Revisar cantidad" si `review` (según `margin < 25`); "Comprar ahora" si sin stock o `critical`; "Reponer" si cobertura ≤ 2×lead time; si no, "Postergar".
- **`salesTrendPct(rec)`**: variación % de venta 30d vs. el promedio esperado (`salesLast90Days / 3`).
- **`purchaseMultiple(rec)`**: múltiplo de compra sugerido según el tamaño de `suggestedQuantity` (24 si ≥120 y múltiplo de 24; 20 si ≥100; 10 si ≥40; 1 en otro caso).
- **`buildDecisionGroups(rows, getKey, openPoBySku)`**: agrupa recomendaciones por la clave dada (proveedor o categoría), calculando total, conteos de crítico/revisar/sobrestock y si el grupo tiene alguna OC abierta; ordena por críticos y luego por total descendente.

### Subcomponentes definidos en el archivo
No aplica (no es un archivo de componentes).

---

## 5. replenishment/types.ts

**Archivo:** `src/pages/replenishment/types.ts`

### Ruta y archivo
No enrutado; módulo de tipos compartidos.

### Propósito
Definir los tipos de dominio propios de la vista de Reposición/Decisiones de compra.

### Fuentes de datos
Solo tipos: `PurchaseRecommendation` de `types/purchasing`.

### Estado y navegación
No aplica.

### Estructura visual
No aplica.

### Lógica de negocio clave
- `RecOverride`: forma de una edición manual persistida (`suggestedQuantity`, `suggestedPurchaseAmount`, `supplierName`).
- `DecisionViewMode`: `"product" | "supplier" | "category"`.
- `OpenPoSignal`: resumen de una OC abierta relacionada a un SKU (`number`, `quantity`, `expectedDate`, `status`).
- `DecisionGroup`: resultado de `buildDecisionGroups` (clave, etiqueta, items, total, conteos, `hasOpenPo`).

### Subcomponentes definidos en el archivo
No aplica.

---

## 6. BudgetPage — `/presupuesto`

**Archivo:** `src/pages/BudgetPage.tsx`

### Ruta y archivo
`<Route path="/presupuesto" element={<BudgetPage />} />` en `AppRoutes.tsx`.

### Propósito
Vista de presupuesto Open-to-Buy (OTB) por categoría: cuánto se puede seguir comprando cada mes descontando lo comprometido (OC emitidas) y lo que hay en el borrador actual, más un resumen de concentración de compra por proveedor.

### Fuentes de datos
- `src/data/mockBudgets.ts`: `BUDGET_MONTHS`, `DEFAULT_BUDGET_MONTH`, `formatBudgetMonth`, tipo `BudgetStatus`.
- `src/utils/openToBuy.ts`: `computeOtb`, tipo `CategoryOtb`.
- `src/data/mockSuppliers.ts`: `suppliers` (gasto por proveedor, últimos 90 días).
- `src/utils/entityLinks.ts`: `supplierPath`.
- `src/context/OcDraftContext.tsx` (`useOcDraft`): `items` (`draftItems`), `count`.
- `src/utils/useLocalStorage.ts`: lee `compras:po-created` (OC creadas en la sesión).
- `src/utils/formatters.ts`: `formatCurrency`, `formatCurrencyCompact`, `formatPercent`.

### Estado y navegación
- `useState` locales: `month` (mes de presupuesto activo), `query` (búsqueda de categoría), `estado` (filtro de estado OTB).
- Sin `useUrlState`/persistencia (filtros no sobreviven a recarga ni son compartibles por URL, a diferencia de otras páginas de este set).
- Enlaces (`Link`) a `supplierPath(s.name)` en el bloque de compra por proveedor.

### Estructura visual
- `PageHeader` con `Select` de mes en el `action` y `InfoHint` explicando qué es el disponible (OTB).
- 4 `KpiCard`: Presupuesto del mes, Comprometido, En borrador, Disponible (OTB).
- `HelpNote` condicional si hay categorías con borrador en curso.
- `HelpNote` condicional si hay categorías excedidas.
- `FilterBar` (búsqueda + select de estado).
- `Card` con `DataTable` de categorías (columnas: Categoría, Presupuesto, Comprometido, En borrador, Disponible (OTB), % usado con `UsageBar`, Estado con `Badge`), `mobileCard` propio.
- `Card` "Compra por proveedor (90 días)": barra de aviso de concentración (si un proveedor > 30% del gasto) + barras horizontales de participación por proveedor (top 8).

### Lógica de negocio clave
- **OTB por categoría**: delegado a `computeOtb(month, draftItems, createdOrders)` (`utils/openToBuy.ts`) — `disponible = presupuesto − comprometido − enBorrador`, con `comprometido` sumando la base del mes más las OC creadas en la sesión con estado que reserva caja.
- **Totales del mes**: `useMemo` que reduce `views` sumando `presupuesto`, `comprometido`, `recibido`, `enBorrador` (KPIs no se filtran, muestran la foto completa del mes).
- **% usado total**: `(comprometido + enBorrador) / presupuesto * 100`.
- **Concentración de proveedor**: `share = purchasedAmountLast90Days / total`; alerta si `topSupplier.share > 0.3` (30%).
- **Color de barra de uso** (`barColor`): rojo si `excedido`, ámbar si `ajustado`, verde si `ok` (estado ya viene calculado por `computeOtb`/`deriveStatus`).

### Subcomponentes definidos en el archivo
- `UsageBar` — barra de progreso de % usado del presupuesto de una categoría, con color según estado.
- `barColor` — función auxiliar (no componente) que resuelve la clase de color según `BudgetStatus`.

---

## 7. LostOpportunitiesPage — `/venta-no-capturada`

**Archivo:** `src/pages/LostOpportunitiesPage.tsx`

### Ruta y archivo
`<Route path="/venta-no-capturada" element={<LostOpportunitiesPage />} />`; la ruta antigua `/oportunidades-perdidas` redirige (`<Navigate replace>`) a esta.

### Propósito
Detectar y listar productos que vendían, se quedaron sin stock, dejaron de recomprarse y cuya categoría sigue vendiendo — es decir, venta perdida por falta de reposición, no por falta de demanda.

### Fuentes de datos
- `src/utils/lostOpportunities.ts`: `lostOpportunities()` (deriva el listado completo desde `mockProducts`).
- `src/data/mockProducts.ts`: `getProductBySku` (costo unitario al reponer).
- `src/utils/entityLinks.ts`: `supplierPath`, `categoryPath`.
- `src/context/OcDraftContext.tsx` (`useOcDraft`): `addItem`, `hasItem`.
- `src/context/ToastContext.tsx` (`useToast`).
- `src/utils/formatters.ts`.

### Estado y navegación
- `useUrlState`: `query` (`q`), `motivo`.
- `useMemo` para `all` (resultado de `lostOpportunities()`, calculado una sola vez) y `motivos` (valores únicos para el select).
- Enlaces a `/productos/:sku`, `categoryPath`, `supplierPath`.

### Estructura visual
- `PageHeader` con `InfoHint` explicativo.
- 3 `KpiCard`: Oportunidades detectadas, Venta perdida estimada ($/mes), Por reponer urgente (tone `red`).
- `FilterBar` (búsqueda + select de motivo).
- `EmptyState` si no hay resultados filtrados.
- Lista de `Card` (una por oportunidad): nombre enlazado a `/productos/:sku`, `Badge` de motivo, categoría/proveedor enlazados, venta histórica vs. reciente, insight en texto, monto de venta perdida y botón "Reponer" / "En OC".

### Lógica de negocio clave
- **Detección de oportunidad no capturada**: función `lostOpportunities()` (`utils/lostOpportunities.ts`) — condiciones combinadas: `vendiaAntes` (venta histórica mensual ≥ 8), `sinStock` (stock disponible ≤ máx(2, 25% del punto de reorden)), `ventaCayo` (venta reciente ≤ 50% de la histórica) y `categoriaViva` (la categoría sigue vendiendo sin este SKU).
- **Venta mensual histórica** (`histMonthlyOf`): `max(salesLast90Days/3, salesLast180Days/6)`.
- **Venta perdida estimada**: `(histMonthly − recent) * price`, redondeada.
- **Motivo/acción/tono**: reglas en cascada — "Sin stock y sin recompra" (rojo) si venta reciente 0 y sin stock; "Agotado, venta cayó" (ámbar) si solo sin stock; si no, "Categoría creciendo sin reposición" (azul).
- **Meses sin compra**: simulado de forma determinista con `hashString(sku) % 5 + 2` (no es un dato real de compras, es una aproximación visual).
- **Reponer**: agrega al borrador de OC con `quantity = histMonthly` y `unitCost` del producto (0 si no se encuentra).

### Subcomponentes definidos en el archivo
Ninguno — todo el marcado vive inline dentro de `LostOpportunitiesPage`.

---

## 8. SalesSignalsPage — `/senales-ventas`

**Archivo:** `src/pages/SalesSignalsPage.tsx`

### Ruta y archivo
`<Route path="/senales-ventas" element={<SalesSignalsPage />} />`.

### Propósito
Bandeja de señales reportadas desde terreno por el equipo de ventas (quiebres, demanda, oportunidades): recibir, analizar y decidir sobre cada señal, con trazabilidad de estado.

### Fuentes de datos
- `src/context/SignalsContext.tsx` (`useSignals`): `signals`, `addSignal`.
- `src/context/BuyerContext.tsx` (`useBuyer`): `buyer` (comprador activo, para el filtro "Asignadas a mí").
- `src/context/ToastContext.tsx` (`useToast`).
- `src/components/business/signalLabels.ts`: `SIGNAL_TYPE`, `SIGNAL_STATUS`, `SIGNAL_PRIORITY`, `SIGNAL_CHANNEL`, `STOCKOUT_TYPES`.
- `src/utils/dateRange.ts`: `inRange`, tipo `IsoRange`.
- `src/utils/constants.ts`: `TODAY_ISO`.
- `src/utils/formatters.ts`, `src/utils/cn.ts`.
- Componentes de negocio: `SignalDetail`, `ReportSignalModal`, `BarList`.

### Estado y navegación
- `useState` locales: `tab` (bandeja activa: por revisar/en gestión/aprobadas/resueltas/rechazadas/todas), `query`, `priority`, `type`, `channel`, `store`, `category`, `assigned`, `dates` (`IsoRange`), `onlyStockout`, `mine`, `selectedId`, `mobileDetail`, `reportOpen`, `reportDefaults`.
- Sin `useUrlState`: a diferencia de otras páginas del set, los filtros no persisten en la URL.
- No hay navegación por rutas propia (todo ocurre dentro de la página vía drawer/tabs).

### Estructura visual
- `PageHeader` con botón "Reportar señal".
- `FlowStrip`: tira de 5 pasos del proceso (Ventas reporta → Comprador recibe → Analiza → Decide → Queda registrado).
- `FilterBar` con 2 toggles ("Asignadas a mí", "Sólo quiebres") y 6 selects + rango de fechas.
- 5 `KpiCard` cliqueables (Nuevas, Quiebres reportados, Por revisar, Aceptadas, Venta perdida est.) que también actúan como accesos rápidos a tabs/filtros.
- `Card` "Resumen de señales": 3 `MiniBar` (top productos, top tiendas, productos más solicitados) usando `BarList`.
- `Tabs` de bandeja con conteos por estado.
- Layout de dos columnas en desktop: bandeja de `SignalRow` agrupada por antigüedad (`groupByTime`) + panel `SignalDetail` fijo; en móvil, `Drawer` con el detalle.
- `ReportSignalModal` para registrar una nueva señal.

### Lógica de negocio clave
- **Filtro combinado (`byFilters`)**: aplica todos los filtros salvo la pestaña; alimenta KPIs, analítica y conteos por tab.
- **Conteos por pestaña** (`counts`): "por revisar" = `new` + `in_review`; "en gestión" = `IN_PROGRESS_STATUSES` (`sourcing`, `quoted`, `awaiting_customer`, `purchased`).
- **Venta perdida estimada (KPI)**: suma `estimatedLostSale` de señales activas (no resueltas ni rechazadas).
- **Orden de la bandeja**: por `PRIORITY_ORDER` (alta→baja), luego por fecha descendente.
- **Agrupación temporal** (`groupByTime`): Hoy / Ayer / Esta semana / Anteriores, según `daysAgo(iso)` contra `TODAY_ISO`.
- **Alta como "sin revisar"**: `signal.status === "new"` marca punto de color y negrita en `SignalRow`.

### Subcomponentes definidos en el archivo
- `aggCount` — agrega y cuenta ocurrencias por clave, ordenado descendente (no es componente, es helper).
- `aggSum` — agrega y suma un valor por clave, ordenado descendente (no es componente, es helper).
- `MiniBar` — bloque de título + `BarList` con mensaje de vacío.
- `FlowStrip` — tira de pasos del proceso de señales.
- `SignalRow` — fila de la bandeja (badges de prioridad/tipo/origen "Terreno", estado, tienda, fecha).
- `groupByTime` — agrupa señales en buckets de antigüedad (no es componente, es helper).
- `fmtDate` / `daysAgo` — helpers de fecha a nivel de módulo.

---

## 9. Hallazgos de clean code

### 9.1 Lógica de "riesgo de quiebre" duplicada (5 implementaciones independientes)
La regla "cobertura ≤ lead time → Alto/rojo; ≤ 2×lead time → Medio/ámbar; si no → Bajo/verde" se reimplementa por separado en:
- `src/pages/replenishment/components.tsx:272-277` (`stockoutRisk` en `RecommendationDecisionDrawer`)
- `src/pages/replenishment/components.tsx:792-797` (`buildSimulationScenario`)
- `src/pages/replenishment/components.tsx:999-1006` (`coverageToneText`)
- `src/pages/replenishment/components.tsx:1018` (`CoverageCell`, tono `rose/amber/emerald`)
- `src/pages/replenishment/components.tsx:960` (`SensitivityCard`, versión de 2 niveles)

Cinco variantes del mismo umbral de negocio, con nombres de resultado distintos (`"Alto"/"Medio"/"Bajo"` vs. `rose/amber/emerald` vs. clases Tailwind). Un cambio futuro del umbral (p. ej. pasar de 2× a 1.5× lead time) requeriría tocar 5 lugares y es fácil dejar alguno desactualizado.

### 9.2 Fórmula de "cobertura proyectada" duplicada 3 veces
`Math.round(((availableStock + qty + incoming) / dailySales) * 10) / 10` (con fallback a `inventoryDays` si no hay venta) aparece igual en:
- `src/pages/replenishment/components.tsx:260-263` (`RecommendationDecisionDrawer`)
- `src/pages/replenishment/components.tsx:782-785` (`buildSimulationScenario`)
- `src/pages/replenishment/components.tsx:820-823` (`buildSupplierComparison`, sin el término `incoming`)

Podría extraerse a una función única (p. ej. `projectedCoverageDays(stock, qty, incoming, salesLast30Days, fallback)`), reduciendo el riesgo de que las tres copias diverjan.

### 9.3 Umbral de "margen bajo" inconsistente entre archivos
- `src/pages/replenishment/helpers.ts:12` (`decisionTypeLabel`) y `src/pages/ReplenishmentPage.tsx:143` (`lowMarginCount`) usan **`margin < 25`**.
- `src/utils/filters.ts:35` (`filterProducts`) y `src/utils/filters.ts:71` (`filterRecommendations`) usan **`margin >= 20`** como corte de "margen bajo" (es decir, bajo = `< 20`).
- `src/pages/replenishment/components.tsx:604` (`SkuProfileChips`) usa una tercera escala: verde `>= 30`, ámbar `>= 20`, rojo si no.

Mismo concepto de negocio ("margen bajo") con tres cortes distintos (20/25/30) en tres archivos; el toggle "Margen bajo" del filtro y el texto "Revisar margen" de la tabla pueden mostrar resultados que no coinciden entre sí.

### 9.4 Botón "Comparar proveedores" no hace lo que dice
`src/pages/replenishment/components.tsx:324-326` — el botón "Comparar proveedores" del footer del drawer llama a `onEdit(rec)`, exactamente el mismo handler que el botón "Modificar cantidad" (línea 316-318). Ambos abren el modal genérico "Ajustar sugerencia" (cantidad + proveedor único); no hay navegación ni scroll hacia la tabla de comparación de proveedores que ya existe más abajo en el propio drawer (líneas ~549-583). La etiqueta induce a un comportamiento que el código no ofrece.

### 9.5 Fórmula "capital inmovilizado" repetida 4 veces en el mismo archivo
`src/pages/InventoryAnalysisPage.tsx` calcula `p.availableStock * p.cost` de forma inline en:
- línea 42 (`frozen`, orden del top 6)
- línea 86 (columna "Capital inmovilizado" de la tabla)
- línea 225 (`mobileCard`)
- línea 290 (`ListCard`)

Es una fórmula de negocio simple pero repetida 4 veces sin un helper local (p. ej. `const capitalInmovilizado = (p: Product) => p.availableStock * p.cost;`), a diferencia de "sobre máximo" que sí está centralizado en `frozenCapital` (`utils/calculations.ts`).

### 9.6 `aggCount` y `aggSum` son casi el mismo algoritmo
`src/pages/SalesSignalsPage.tsx:489-495` (`aggCount`) y `:497-506` (`aggSum`) implementan el mismo patrón (Map de acumulación por clave + `sort` descendente); `aggCount` es equivalente a `aggSum` con una función de valor constante `() => 1`. Podrían colapsarse en una sola función genérica.

### 9.7 Rango objetivo de cobertura "45-60 días" como magic numbers dispersos
El objetivo de cobertura (45 a 60 días) y el umbral de sobrestock (60 días) aparecen como literales sin nombre en varios puntos de `src/pages/replenishment/components.tsx`:
- línea 799 (`overstockRisk`, `buildSimulationScenario`): `coverage > 60`
- línea 852 (`CoverageTargetBar`): texto `"45-60 d"` hardcodeado
- línea 861 (`CoverageTargetBar`): posición de la franja verde `left-[45%] w-[15%]` (= 45 a 60)
- línea 959 (`SensitivityCard`): `coverage > 60`

Los mismos números (45, 60) están codificados por separado como texto, como geometría de barra y como umbral de riesgo; una constante compartida (p. ej. `COVERAGE_TARGET_MIN_DAYS = 45`, `COVERAGE_TARGET_MAX_DAYS = 60`) evitaría que la barra visual y el texto queden desalineados si el objetivo cambia.

### 9.8 `RecommendationDecisionDrawer` es una función sobredimensionada
`src/pages/replenishment/components.tsx:212-591` (~380 líneas) mezcla ~20 cálculos derivados (cobertura, riesgo, GMROI, escenarios, comparación de proveedores, razonamiento, alertas) con el árbol JSX completo de 10+ secciones. Es el componente más grande del set de archivos revisado; separar el cálculo (p. ej. en un hook `useDecisionSimulation(rec, quantity, openPo, budgetAvailable)`) de la presentación facilitaría testear la lógica sin renderizar el drawer completo.
