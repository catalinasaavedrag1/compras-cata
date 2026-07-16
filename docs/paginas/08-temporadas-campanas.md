# Temporadas y campañas

Documentación técnica de las páginas de planificación estacional (demanda por canal, planificador de temporada) y de campañas comerciales (descuentos, anticipación/oportunidades, rendimiento, margen por canal) de compras-cata.

## Tabla de contenidos

1. [SeasonsChannelsPage — `/temporadas`](#1-seasonschannelspage)
2. [SeasonPlannerPage — `/comprar/temporada`](#2-seasonplannerpage)
3. [seasonPlanner/components.tsx](#3-seasonplannercomponentstsx)
4. [seasonPlanner/constants.ts](#4-seasonplannerconstantsts)
5. [CampaignsPage — `/campanas`](#5-campaignspage)
6. [CampaignOpportunitiesPage — `/anticipacion`](#6-campaignopportunitiespage)
7. [campaignOpportunities/CreatedCampaignsView.tsx](#7-campaignopportunitiescreatedcampaignsviewtsx)
8. [CampaignPerformance.tsx](#8-campaignperformancetsx)
9. [ChannelMarginPage — `/margen-canal`](#9-channelmarginpage)
10. [campaignsHelpers.ts](#10-campaignshelpersts)
11. [campaignsShared.tsx](#11-campaignssharedtsx)
12. [Hallazgos de clean code](#12-hallazgos-de-clean-code)

---

## 1. SeasonsChannelsPage

**Archivo:** `src/pages/SeasonsChannelsPage.tsx`

### Ruta y archivo
`/temporadas`, registrada en `src/routes/AppRoutes.tsx` (carga lazy como `SeasonsChannelsPage`).

### Propósito
Diagnóstico de "cuándo sube la demanda y por qué canal se compra" para una categoría: temporada del año, mezcla de canales (tienda, ecommerce, marketplace, empresa B2B, licitaciones) y cómo repartir la compra sugerida entre canales. Es el paso de análisis previo a `SeasonPlannerPage` (enlace directo en el `InfoHint` del encabezado).

### Fuentes de datos
- `src/data/mockCategories` (`categories`) y `src/data/mockProducts` (`products`).
- `src/utils/channelDemand` — `channelDemandForCategory`, `splitPurchaseByChannel`, `CHANNEL_META` (meta de `DemandChannel`: tienda/ecommerce/marketplace/empresa/licitaciones).
- `src/utils/seasonality` — `seasonalFactor`, `demandType`.
- `src/utils/formatters` — `formatCurrency`, `formatCurrencyCompact`, `formatNumber`, `formatPercent`.
- `src/components/business/ScopeToggle` — `useCategoryScope` (alcance "mis categorías" vs "todas").

### Estado y navegación
- `useState<string>` local `categoria` para la categoría seleccionada (sin persistencia ni URL state); se deriva `selected` con fallback a la primera categoría en alcance.
- `scope`/`setScope` viene de `useCategoryScope()` (hook compartido, no local a esta página).
- Enlace de navegación a `/comprar/temporada` ("Planificar temporada") dentro del `InfoHint` del `PageHeader`.
- No usa `useLocalStorage` ni `useUrlState`; toda la selección se pierde al recargar.

### Estructura visual
- `PageHeader` con `ScopeToggle` + `Select` de categoría y un `InfoHint` explicativo.
- 4 `KpiCard`: demanda mensual, mes peak (con badge de "entra/sale de temporada" según `seasonalFactor`), % canales digitales, % proyectos (empresa + licitaciones).
- Dos `Card` lado a lado: `MonthlyBars` (demanda total por mes, resalta el mes peak) y `StackedChannelBars` + `ChannelLegend` (mezcla de canales por mes, apilada).
- Card "Mezcla de canales": barras de participación (`mixPct`) por canal con color de `CHANNEL_META`, unidades/mes y meses peak.
- Card "Compra sugerida por canal": grid de tarjetas con el reparto de `selected.suggestedPurchase` según `splitPurchaseByChannel`, más un `HelpNote` de recomendación.
- No hay modales ni drawers en esta página.

### Lógica de negocio clave
- La demanda por canal y mes se calcula íntegramente en `channelDemandForCategory` (`src/utils/channelDemand.ts`): reparte las unidades base (`salesLast30Days` de los productos de la categoría) entre 5 canales según una mezcla fija por familia de categoría (`mixForCategory`, detectada por regex sobre el nombre) y un perfil estacional mensual propio de cada canal (`CHANNEL_PROFILE`), normalizado por su propio promedio.
- `seasonalFactor(categoria, 2)` (de `utils/seasonality.ts`) da el multiplicador de demanda de los próximos 2 meses vs. el promedio anual; la página lo usa solo para el badge "entra/sale de temporada" (umbrales `>=1.05` / `<=0.95`), no para ajustar cantidades.
- `splitPurchaseByChannel` reparte `suggestedPurchase` de la categoría proporcionalmente al `mixPct` de cada canal (redondeo simple, sin ajuste de estacionalidad del mes actual).

### Subcomponentes definidos en el archivo
Ninguno: la página es un único componente exportado (`SeasonsChannelsPage`) que compone piezas de `components/ui` y `components/business`.

---

## 2. SeasonPlannerPage

**Archivo:** `src/pages/SeasonPlannerPage.tsx`

### Ruta y archivo
`/comprar/temporada`, registrada en `AppRoutes.tsx` (lazy `SeasonPlannerPage`).

### Propósito
Planificador de compra por temporada comercial (ej. "Riego 2026", "Vuelta a la obra"): construye y compara 3 escenarios de compra, explica el origen de la demanda por producto y permite seguir la ejecución de la temporada ya en curso.

### Fuentes de datos
- `src/data/mockSeasons` — `seasons`, `getSeasonById` (catálogo de temporadas).
- `src/utils/channelDemand` — `CHANNEL_META` (para los chips de canales de la temporada en el encabezado).
- `src/utils/seasonPlan` — `planSeason`, `seasonHeadline`, tipos `ScenarioKey`/`SeasonProductPlan`.
- `src/utils/seasonTracking` — `trackSeason`.
- `src/utils/formatters` — `formatCurrencyCompact`, `formatDate`, `formatNumber`, `formatPercent`.
- `src/context/OcDraftContext` — `useOcDraft()` (`addItem`, `hasItem`).
- `src/context/ToastContext` — `useToast()`.
- Subcomponentes propios: `./seasonPlanner/constants` (`CONFIDENCE_META`, `RISK_META`) y `./seasonPlanner/components` (`ChipRow`, `CompareCell`, `HeaderField`, `MiniStat`, `OriginBar`, `ProductDetail`, `ScenarioComparator`, `SectionTitle`, `SeasonTrackingView`).

### Estado y navegación
- `useState` locales: `seasonId` (temporada activa), `scenario: ScenarioKey` ("conservador"|"probable"|"agresivo"), `detailSku` (drawer de detalle de producto), `tab` ("plan"|"track"). Ninguno persiste en URL ni localStorage.
- `plansByScenario` se calcula con `useMemo` llamando `planSeason` una vez por cada uno de los 3 escenarios (para alimentar el `ScenarioComparator`); `plan` es el activo según `scenario`.
- Navega a `/comprar/borradores` tras "Generar propuestas OC" (via `useNavigate` + acción del toast).

### Estructura visual
- `PageHeader` con `Select` de temporada y botón "Generar propuestas OC".
- `Tabs`: "Planificación" (`tab="plan"`) y "Seguimiento" (`tab="track"`, con badge de cantidad de alertas).
- `SeasonHeader` (función interna, no exportada): card con fechas de venta/compra, deadline OC, lead time, presupuesto, crecimiento esperado y precisión del pronóstico anterior, más `ChipRow` de categorías/canales/bodegas.
- Pestaña "Planificación": `HelpNote` con `seasonHeadline` en lenguaje natural; sección 1 "Resumen ejecutivo" (4 `KpiCard` + 4 `MiniStat`); card "Temporada anterior vs actual" con 5 `CompareCell`; sección 2 "Distribución de la demanda por origen" (`OriginBar` + tabla por canal); sección 3 "Escenarios de compra" (`ScenarioComparator`); sección 4 "Detalle por producto" (`DataTable` con badges de confianza/riesgo).
- Pestaña "Seguimiento": delega en `SeasonTrackingView`.
- `Drawer` de detalle de producto (nivel 4), abierto por `detailSku`, renderiza `ProductDetail`.

### Lógica de negocio clave
- Toda la fórmula de compra (`planSeason`/`decompose` en `utils/seasonPlan.ts`) se resume aquí como: histórico ajustado + crecimiento + ecommerce + Mercado Libre + Falabella + empresa confirmada + licitaciones (confirmadas y ponderadas) + campañas + stock de seguridad, menos stock disponible, en tránsito y transferible. Cada escenario (`conservador`/`probable`/`agresivo`) aplica multiplicadores distintos (`growthMult`, `probableWeight`, `safetyMult`, `campaignMult`) definidos en `SCENARIOS`.
- El ajuste de pronóstico manual por SKU vive en el subcomponente `ForecastAdjust` (ver `seasonPlanner/components.tsx`), no en esta página.
- `trackSeason(plan)` (de `utils/seasonTracking.ts`) simula el avance de la temporada (`SEASON_PROGRESS = 0.45`) comparando plan vs. venta real/recepción/pronóstico actualizado por canal y producto, generando alertas accionables.
- El margen esperado de la temporada (`plan.summary.margenEsperado`) se calcula en `planSeason` como `(ventaPotencial - costSell) / ventaPotencial`, donde `ventaPotencial`/`costSell` topan la demanda (`needTotal`) contra lo realmente disponible para vender (stock + compra sugerida + tránsito).

### Subcomponentes definidos en el archivo
- `SeasonHeader` — función interna (no exportada) que arma el encabezado con fechas, presupuesto y chips de la temporada; usa `plan`/`season` del closure del componente padre.

---

## 3. seasonPlanner/components.tsx

**Archivo:** `src/pages/seasonPlanner/components.tsx`

### Ruta y archivo
No es una página routeada; es el módulo de piezas de presentación consumido por `SeasonPlannerPage`.

### Propósito
Concentra todos los bloques visuales reutilizables del planificador de temporada: encabezados de sección, comparadores, la vista de detalle de producto (con ajuste manual de pronóstico) y la vista de seguimiento completa.

### Fuentes de datos
- `src/context/ToastContext` (`useToast`), `src/context/TraceContext` (`useTrace`, para la bitácora de ajustes de pronóstico).
- `src/utils/useLocalStorage` — persiste el ajuste manual de pronóstico por SKU (`compras:forecast-adj:${sku}`).
- `src/utils/constants` — `TODAY_ISO`.
- `src/utils/seasonPlan` — `planSeason` (solo como tipo de retorno), `SCENARIOS`, tipos `ScenarioKey`/`SeasonProductPlan`.
- `src/utils/seasonTracking` — tipos `SeasonTracking`, `ChannelTracking`, `ProductTracking`, `AlertTone`.
- `src/utils/formatters`, `src/utils/cn`.
- `./constants` — `CONFIDENCE_META`, `RISK_META`, `SCENARIO_ORDER`.

### Estado y navegación
- `ForecastAdjust` (componente interno, no exportado) mantiene estado local de edición (`editing`, `qty`, `reason`, `error`) y persiste el ajuste guardado en `useLocalStorage<ForecastAdjustment | null>` con clave `compras:forecast-adj:${p.sku}`. Al guardar, registra una entrada en `TraceContext` (`log`) con actor fijo `"Catalina Saavedra"`.
- `SeasonTrackingView` no mantiene estado propio salvo el toast disparado por los botones de "Replanificar" (acciones simuladas, no persistidas).

### Estructura visual
- Piezas atómicas: `SectionTitle` (numerador de sección), `HeaderField`, `ChipRow`, `MiniStat`, `CompareCell`.
- `OriginBar`: barra apilada de origen de demanda (confirmada / histórica proyectada / probable ponderada / campañas / stock estratégico) con leyenda.
- `ScenarioComparator`: 3 tarjetas clicables (una por escenario) con métricas resumen y estado activo.
- `ProductDetail`: drawer de nivel 4 — fórmula explicable (componentes de la demanda con signo +/-), `ForecastAdjust`, origen de la demanda, `MonthlyBars` de evolución semanal (pronóstico + stock proyectado), datos de compra (margen, rotación, lead time, ETA, múltiplo, MOQ, venta perdida estimada, costo).
- `SeasonTrackingView`: avance de temporada (barra de progreso), comparativa canal plan-vs-real con `VarianceBadge`, panel de alertas (`ALERT_STYLE` por tono), acciones de replanificación y tabla de seguimiento por producto (`DataTable`).

### Lógica de negocio clave
- `ForecastAdjust` permite sobrescribir `p.suggested` con una cantidad manual + motivo obligatorio; el delta se muestra en violeta (aumento) o rojo (disminución) contra el pronóstico del sistema. Es puramente de UI/persistencia local: no retroalimenta `planSeason`.
- `VarianceBadge` clasifica la desviación de venta real vs. esperada por canal: `over` si `pct > 8`, `under` si `pct < -8`, verde en el resto — el mismo umbral de 8 puntos que usa `channelPlanned`/`trackSeason` en `utils/seasonTracking.ts` para calcular `status` (ver hallazgo de duplicación).
- `ProductDetail` calcula `stockoutWeek` como la primera semana (`p.weekly`) con `stock <= 0`, y muestra el corriente acumulado (`running`) de los componentes de la fórmula de compra.

### Subcomponentes definidos en el archivo
- `SectionTitle` — numerador circular + título de sección.
- `HeaderField` — etiqueta/valor del encabezado de temporada.
- `ChipRow` — fila de badges para categorías/canales/bodegas.
- `MiniStat` — tarjeta compacta de métrica con tono opcional.
- `CompareCell` — celda "temporada anterior (tachado) vs actual".
- `OriginBar` — barra apilada + leyenda de origen de demanda.
- `ScenarioComparator` — comparador de los 3 escenarios de compra (exportado, usado por `SeasonPlannerPage`).
- `ScStat` — mini estadística interna de `ScenarioComparator` (no exportado).
- `ForecastAdjust` — ajuste manual del pronóstico por producto (no exportado; usado por `ProductDetail`).
- `ProductDetail` — detalle explicativo completo de un producto del plan (nivel 4 / drawer).
- `VarianceBadge` — badge de desviación % (no exportado; usado por `SeasonTrackingView`).
- `SeasonTrackingView` — vista completa de seguimiento de la temporada (avance, canal, alertas, replanificación, tabla).

---

## 4. seasonPlanner/constants.ts

**Archivo:** `src/pages/seasonPlanner/constants.ts`

### Ruta y archivo
No routeado; módulo de constantes de UI compartido por `SeasonPlannerPage` y `seasonPlanner/components.tsx`.

### Propósito
Centraliza los mapas de presentación (etiqueta + tono de badge) para los niveles de confianza y riesgo del plan de temporada, y el orden fijo de escenarios.

### Fuentes de datos
- Tipos desde `src/components/ui/Badge` (`BadgeTone`) y `src/utils/seasonPlan` (`ConfidenceLevel`, `ScenarioKey`, `SeasonRisk`). No importa datos de negocio, solo tipos.

### Estado y navegación
No aplica (módulo de constantes puras, sin estado ni hooks).

### Estructura visual
No renderiza nada; provee `CONFIDENCE_META` (alta/media/baja → label + tono verde/ámbar/rojo), `RISK_META` (alto_quiebre/medio/sobrestock/normal → label + tono) y `SCENARIO_ORDER` (`["conservador", "probable", "agresivo"]`) usados por `DataTable`, `ProductDetail` y `ScenarioComparator`.

### Lógica de negocio clave
Ninguna (solo mapeo de valores de dominio a presentación).

### Subcomponentes definidos en el archivo
No aplica — solo exporta constantes (`CONFIDENCE_META`, `RISK_META`, `SCENARIO_ORDER`).

---

## 5. CampaignsPage

**Archivo:** `src/pages/CampaignsPage.tsx`

### Ruta y archivo
`/campanas`, registrada en `AppRoutes.tsx` (lazy `CampaignsPage`).

### Propósito
Editor operativo de campañas de descuento: por campaña, arma qué productos entran en descuento, en qué canal/espacio publicitario se exhiben, en qué orden y con qué presupuesto; también aloja la pestaña de rendimiento (delegada en `CampaignPerformance`).

### Fuentes de datos
- `src/data/mockProducts` (`products`, para el selector de producto y su precio de referencia).
- `src/data/mockCampaignPlans` — `CAMPAIGN_PLANS` (semilla), `CHANNEL_META` (meta de canal **promocional**: redes/ml/web/tienda — distinto del `CHANNEL_META` de `utils/channelDemand`), `PLACEMENT_ICON`, `PLACEMENT_LABELS`, `SPACE_TYPES`, tipos `CampaignPlan`/`CampaignProduct`/`PromoChannelKey`/`PlacementKey`.
- `src/utils/useLocalStorage` — persiste el arreglo de campañas completo bajo `compras:campaign-plans`.
- `src/utils/tone` (`CHANNEL_BG`), `src/utils/entityLinks` (`productPath`, `categoryPath`), `src/utils/formatters`.
- `./campaignsHelpers` — `daysUntil`, `discountPct`, `rangeText`, `STATUS_CFG`, tipo `ProductForm`.
- `./campaignsShared` — `Svg`.
- `src/context/ToastContext`.

### Estado y navegación
- `plans` vía `useLocalStorage<CampaignPlan[]>("compras:campaign-plans", CAMPAIGN_PLANS)` — toda edición (agregar/editar/quitar producto, reordenar, crear campaña) muta este arreglo.
- `useState` locales: `selId` (campaña seleccionada), `tab` ("plan"|"perf"), `spaceView` ("grid"|"calendar"), `chFilter` (filtro de canal de los espacios publicitarios), `form: ProductForm | null` (modal agregar/editar producto), `createOpen` + `cmName`/`cmFrom`/`cmTo`/`cmBudget` (modal crear campaña). Ninguno en URL.
- No navega a otras rutas directamente (a diferencia de `CampaignOpportunitiesPage`); todo ocurre en la misma página vía modales.

### Estructura visual
- Selector de campañas (chips) + botón "Crear campaña".
- Card resumen: nombre, días hasta el evento, nº de productos, descuento promedio, venta estimada total, barra de presupuesto asignado/total.
- `Tabs` "Planificación" / "Rendimiento" (esta última renderiza `<CampaignPerformance camp={camp} />`).
- Pestaña Planificación: grid de presupuesto por canal (4 cards); card de resumen de espacios publicitarios (libres/ocupados) con toggle "Tarjetas"/"Calendario"; chips de filtro por canal; grilla de espacios (`spaceView === "grid"`) con badges de estado, barra de ocupación y lista de productos asignados con botones subir/bajar (`IconArrowUp`/`IconArrowDown`); vista calendario alternativa (lista compacta); tabla de "Productos en descuento" (precio antes/después, vigencia, canal/ubicación, posición con reordenamiento, presupuesto, venta estimada, estado, editar).
- `Modal` "Agregar/editar producto en descuento" (selector de producto, fechas, precio antes/con descuento con cálculo de % en vivo, canal, ubicación/exhibición, presupuesto).
- `Modal` "Crear campaña" (nombre, fechas, presupuesto total, con nota del reparto automático 40/30/20/10 %).

### Lógica de negocio clave
- El descuento (`discountPct`, de `campaignsHelpers.ts`) y la vigencia (`rangeText`, `daysUntil`) son puramente de presentación de fechas/precios, no de canal ni estacionalidad.
- `retailPrice(sku)` deriva un precio de lista sugerido a partir del costo y margen del producto (`cost / (1 - margin/100)`, redondeado a la decena) y un precio promocional al 85% de ese valor, para precargar el formulario de "Agregar producto".
- El posicionamiento del banner (`order`) dentro de cada `placement` se recalcula en `moveProduct` intercambiando el campo `order` con el vecino adyacente (ordenados por `orderOf`, con fallback al índice de aparición).
- `submitCreate` reparte el presupuesto total de una campaña nueva en canales fijos: 40% redes, 30% Mercado Libre, 20% web, 10% tienda (duplicado como texto de ayuda en el modal; ver hallazgo de duplicación).
- El rendimiento por canal/espacio (ocupación, cupos libres, `occPct`) es aritmética simple sobre `SPACE_TYPES` y los productos ya asignados; no hay estacionalidad ni pronóstico aquí (eso vive en `CampaignPerformance`).

### Subcomponentes definidos en el archivo
Ninguno exportado aparte de `CampaignsPage`; toda la UI (incluidos los dos modales) se define inline dentro del componente de página.

---

## 6. CampaignOpportunitiesPage

**Archivo:** `src/pages/CampaignOpportunitiesPage.tsx`

### Ruta y archivo
`/anticipacion` (renombrada desde "Oportunidades"; `/campanas-oportunidades` redirige aquí). Registrada en `AppRoutes.tsx` (lazy `CampaignOpportunitiesPage`).

### Propósito
Detecta y prioriza, por SKU y campaña, si conviene comprar antes del peak, liquidar, potenciar o excluir un producto — cruzando stock, crecimiento de venta, margen y proximidad de campaña — y permite crear/gestionar campañas propias (pestaña "Mis campañas").

### Fuentes de datos
- `src/data/mockCampaignOpportunities` — `campaignOpportunities` (dataset base).
- `src/data/mockSuppliers` — `getSupplierByName` (lead time del proveedor para la consolidación de OC).
- `src/components/business/campaignLabels` — `CHANNEL_LABELS`, `OPPORTUNITY_TYPE_LABELS`, `CAMPAIGN_STATUS`, `TYPE_TONE`, `STATUS_URGENCY`.
- `src/components/business/ScopeToggle` — `useCategoryScope`.
- `src/components/business/CampaignBuilderModal` (constructor de campañas nuevas), `src/components/business/ExportButton`, `src/components/business/FilterBar`.
- `src/utils/filters` (`uniqueValues`), `src/utils/entityLinks`, `src/utils/formatters`, `src/utils/useLocalStorage`.
- `src/context/OcDraftContext`, `src/context/ToastContext`.
- `./campaignOpportunities/CreatedCampaignsView`.

### Estado y navegación
- `view` ("oportunidades"|"campanas") controla la pestaña activa.
- `createdCampaigns` vía `useLocalStorage<CreatedCampaign[]>("compras:campaigns", [])`.
- `builderOpen`/`builderTemplate` (modal `CampaignBuilderModal`), `pendingDelete` (id pendiente de confirmar en `ConfirmModal`).
- `done: string[]` — ids de oportunidades marcadas como "gestionadas" (simulado, no persistente).
- Filtros: `sort` (`SortState` de `ui/Table`), `query`, `channel`, `type`, `status`, `category`, `supplier`, `toggles` (`risk`, `growth`, `liquidation`, `lowMargin`) — todos en estado local, no en URL.
- Navega a `/comprar/borradores` (tras agregar a OC), `/proveedores` (acción "Revisar proveedor"), `/productos/:sku` (fila y botón "Ver producto").

### Estructura visual
- `PageHeader` con `ScopeToggle`, `ExportButton` y botón "Crear campaña".
- Chips de "Plantillas rápidas" (4 plantillas fijas) que abren `CampaignBuilderModal` con nombre precargado.
- `Tabs` "Oportunidades detectadas" / "Mis campañas".
- Pestaña Oportunidades: chips de "Campañas próximas" agrupadas; 4 `KpiCard` clicables (filtran por estado); card "OC a generar por proveedor" (consolidación con badge de lead time crítico); `Tabs` secundarias de foco por estado; `FilterBar` con 5 selects + 4 toggles; `DataTable` con columnas producto/oportunidad/canal-campaña/días-para-campaña/stock/venta-30d/venta-estimada/brecha/compra-sugerida/margen/estado/riesgo-recomendación/acciones.
- Pestaña Campañas: delega en `CreatedCampaignsView`.
- `CampaignBuilderModal` (crear campaña) y `ConfirmModal` (eliminar campaña) como overlays.

### Lógica de negocio clave
- El estado de cada oportunidad (`stockout_risk`, `buy_before_campaign`, `liquidate`, `boost`, `review_margin`, `review_supplier`, `ready_for_campaign`, `not_recommended`) viene precalculado en el dataset `mockCampaignOpportunities`; la página solo ordena por `STATUS_URGENCY` + `daysToCampaign` y filtra/agrupa.
- La consolidación "OC a generar por proveedor" (`bySupplier`) agrupa oportunidades con `suggestedPurchaseQuantity > 0` por proveedor, suma unidades/monto y marca lead time crítico cuando `leadTime >= minDays` (el proveedor no llega a tiempo para la campaña más próxima del grupo).
- `handleAction` bifurca por `actionLabel`: agrega a OC (`useOcDraft().addItem`), navega a proveedores, o simplemente marca como "gestionado" en el arreglo local `done` (sin persistencia real) para el resto de acciones (potenciar, liquidar, excluir, revisar margen).
- No hay cálculo de demanda por canal/mes aquí: el canal (`o.channel`) es un atributo fijo del dataset, no derivado de `channelDemand`/`seasonality`.

### Subcomponentes definidos en el archivo
Ninguno exportado; la tabla y las secciones se arman inline dentro de `CampaignOpportunitiesPage`.

---

## 7. campaignOpportunities/CreatedCampaignsView.tsx

**Archivo:** `src/pages/campaignOpportunities/CreatedCampaignsView.tsx`

### Ruta y archivo
No routeado; vista de la pestaña "Mis campañas" dentro de `CampaignOpportunitiesPage` (`view === "campanas"`).

### Propósito
Lista las campañas creadas por el comprador (vía `CampaignBuilderModal`) con sus productos, descuentos y stock, resaltando los productos con stock bajo antes de lanzar la campaña.

### Fuentes de datos
- `src/components/business/campaignLabels` — `PROMO_CHANNEL_LABELS`, `CREATED_CAMPAIGN_STATUS`.
- `src/utils/formatters` — `formatCurrency`, `formatDate`, `formatNumber`.
- `src/types/purchasing` — tipo `CreatedCampaign` (recibido por props, no se consulta ningún store propio).
- No importa `channelDemand`/`seasonality`/`seasonPlan` — es puramente presentacional sobre los datos recibidos por props.

### Estado y navegación
Sin estado propio (componente puramente controlado por props: `campaigns`, `onCreate`, `onDelete`, `onAddToOc`). `onAddToOc`/`onDelete` son callbacks del padre (`CampaignOpportunitiesPage`), que navega o abre el `ConfirmModal`.

### Estructura visual
- Estado vacío: `EmptyState` con ícono de campaña y botón "Crear campaña".
- Estado con datos: `HelpNote` de aviso; por cada campaña, un `Card` con `CardHeader` (nombre, rango de fechas, nº productos, descuento promedio, badge de estado `CREATED_CAMPAIGN_STATUS`, botón eliminar) y `CardBody` con badges de canales (`PROMO_CHANNEL_LABELS`) + badge de "stock bajo" si aplica, y una lista de productos (SKU, nombre, stock con aviso si ≤5, badge de descuento, precio antes/después, botón "Ver producto").

### Lógica de negocio clave
- `lowStock` cuenta productos con `availableStock <= 5` (umbral fijo) por campaña, para el badge de aviso.
- `avgDiscount` promedia `discountPct` de los productos de la campaña (con `Math.max(1, …)` para evitar división por cero).
- No hay cálculo de demanda ni margen: los datos (`discountPct`, `basePrice`, `campaignPrice`, `availableStock`) llegan ya calculados en el objeto `CreatedCampaign`.

### Subcomponentes definidos en el archivo
Ninguno: solo exporta `CreatedCampaignsView`.

---

## 8. CampaignPerformance.tsx

**Archivo:** `src/pages/CampaignPerformance.tsx`

### Ruta y archivo
No routeado directamente; se renderiza dentro de `CampaignsPage` cuando `tab === "perf"` (`<CampaignPerformance camp={camp} />`).

### Propósito
Muestra el rendimiento (simulado) de una campaña de descuentos ya armada: KPIs totales y desglose por canal y por producto (impresiones, clics, CTR, conversiones, ingresos, inversión, ROAS).

### Fuentes de datos
- `src/data/mockCampaignPerformance` — `campaignPerformance` (motor de cálculo), `PERF_CHANNEL_META`, `roasTone`, tipos `ChannelPerformance`/`ProductPerformance`.
- `src/data/mockCampaignPlans` — tipo `CampaignPlan` (recibe el plan de campaña completo por props).
- `src/utils/entityLinks` (`productPath`), `src/utils/formatters`, `src/utils/tone` (`CHANNEL_BG`).
- `./campaignsShared` — `Svg` (mismo componente reutilizado por `CampaignsPage`).

### Estado y navegación
- `chSort`/`prSort`: estado local de ordenamiento de la tabla por canal y por producto, tipados inline como `{ key: string | null; dir: "asc" | "desc" }` (en vez de reutilizar el tipo `SortState` exportado por `components/ui/Table`, que sí usa `CampaignOpportunitiesPage`).
- `cycleSort` (función interna) alterna asc/desc/nueva-columna — lógica equivalente a `handleSort` de `CampaignOpportunitiesPage.tsx` (ver hallazgo de duplicación).
- Sin navegación propia salvo el `Link` a `productPath(r.sku)` en la columna "Producto".

### Estructura visual
- `HelpNote` fija avisando que los datos son simulados (demo).
- Estado vacío si `camp.products.length === 0`.
- 6 `KpiCard`: inversión, ingresos, ROAS (tono según `roasTone`), conversiones, CTR promedio, impresiones.
- `DataTable` "Rendimiento por canal" (`byChannel`, ordenable).
- `DataTable` "Rendimiento por producto" (`byProduct`, con posición del banner vía badge 1º/2º/resto).

### Lógica de negocio clave
- Todo el cálculo vive en `campaignPerformance()` (`data/mockCampaignPerformance.ts`), no en la página: por producto deriva CTR/conversión con variación estable por hash de SKU sobre tasas base por canal (`CHANNEL_BASE`), da más impresiones a los productos con `order` (posición de banner) más bajo (`orderBoost`), y calcula ingresos como `conversions × p.promo`.
- El desglose por canal reparte parte del tráfico de "web" hacia `google_ads` y "mailing", y de "redes" hacia "mailing", usando `googleShare`/`emailShare` de `CHANNEL_BASE`; Mercado Libre y tienda física quedan íntegros en su canal.
- `roasTone`: verde si ROAS ≥ 3, ámbar si ≥ 1.5, rojo en el resto — mismo criterio usado tanto en los KPIs totales como en cada fila de las tablas.

### Subcomponentes definidos en el archivo
Ninguno exportado; el único componente es `CampaignPerformance`. (`cycleSort` es una función auxiliar interna, no un componente.)

---

## 9. ChannelMarginPage

**Archivo:** `src/pages/ChannelMarginPage.tsx`

### Ruta y archivo
`/margen-canal`, registrada en `AppRoutes.tsx` (lazy `ChannelMarginPage`).

### Propósito
Compara, para un mismo SKU, el precio y margen en marketplace, web y tienda física, agrupando los 3 canales en una sola tarjeta para detectar márgenes negativos, bajo objetivo, sobre-marginados o con diferencia relevante entre canales.

### Fuentes de datos
- `src/data/mockChannelMargin` — `channelMargins`, `CHANNEL_LABELS`, `MARGIN_STATUS`.
- `src/utils/filters` (`uniqueValues`), `src/utils/formatters`, `src/utils/useUrlState` (`useUrlState`, `useUrlToggle`), `src/utils/entityLinks`.
- `src/context/BuyerContext` (`useBuyer` — comprador activo y lista de compradores), `src/context/ToastContext`.

### Estado y navegación
- **Único de los 11 archivos que usa `useUrlState`/`useUrlToggle`** (todo el filtrado queda en la URL, compartible/recargable): `alcance` (scope), `tab`, `q` (query), `canal`, `estado`, `cat`, `prov`, `comision` (toggle), `descuento` (toggle).
- Navega a `/productos/:sku?tab=margen` al abrir el detalle de un SKU (`onOpen` de `SkuCard`).
- `scope` admite `"mias"` (categorías del `buyer` actual), `"todos"`, o el nombre de otro comprador (via el `Select` "Viendo").

### Estructura visual
- `PageHeader` con `ExportButton` e `InfoHint` ("Cómo leer las tarjetas").
- Selector de alcance ("Viendo": mis categorías / todos / otro comprador).
- `FilterBar` (búsqueda + 4 selects + 2 toggles) con resumen de resultados.
- 6 `KpiCard` clicables (solo escritorio): bajo margen, margen negativo, sobre-marginados, y bajo margen desglosado por marketplace/web/tienda.
- `Tabs` por estado general del SKU: todos / requieren revisión / margen negativo / diferencia entre canales / sobre-marginados.
- Lista de `SkuCard` (una por SKU agrupado): header con SKU, badge de estado general, nombre/categoría/proveedor/objetivo/comprador, botones "Crear tarea" y "Ver detalle"; línea de "problema principal"; resumen de rango de precio/margen entre canales; grid de hasta 3 sub-tarjetas por canal (precio, margen, diferencia en puntos vs. objetivo, comisión si aplica, precio sugerido si el margen es bajo/negativo); conclusión/acción si el estado no es "ok".

### Lógica de negocio clave
- `channelMargins` (dato base) ya trae `marginPct`, `status` y `suggestedPrice` calculados por SKU/canal en `data/mockChannelMargin.ts` (margen = `(precioFinal - costo - comisión) / precioFinal`; estado según `marginPct` vs. `targetMarginPct ± umbral`). La página solo agrupa por SKU y clasifica el estado **general** del grupo.
- `generalStatusFor(rows)`: `negative` si algún canal está en negativo, `review` si alguno está bajo margen, `spread` si la diferencia entre el mejor y peor margen es ≥15 puntos, `over` si todos los canales están sobre-marginados, `ok` en el resto.
- No hay demanda por canal/mes ni estacionalidad en esta página: es una comparación de margen instantánea entre canales de venta, no de compra por temporada.

### Subcomponentes definidos en el archivo
- `SkuCard` — tarjeta de comparación de los 3 canales para un SKU agrupado (recibe `SkuGroup`, `onOpen`, `onTask`).

---

## 10. campaignsHelpers.ts

**Archivo:** `src/pages/campaignsHelpers.ts`

### Ruta y archivo
No routeado; módulo de utilidades puras usado por `CampaignsPage` (y su tipo `ProductForm`).

### Propósito
Helpers de fecha y descuento específicos del editor de campañas (formato corto de fecha en español, rango de fechas, días hasta una fecha, % de descuento) y el mapa de estado de producto en campaña.

### Fuentes de datos
- `src/utils/constants` — `TODAY_ISO` (fecha "hoy" fija del entorno demo, usada para calcular `daysUntil` de forma determinista).
- `src/data/mockCampaignPlans` — tipos `CampaignProduct`, `PlacementKey`, `PromoChannelKey` (solo tipos).

### Estado y navegación
No aplica (funciones puras + una interfaz de formulario, sin hooks).

### Estructura visual
No renderiza nada.

### Lógica de negocio clave
- `MONTHS`: array de abreviaturas de mes en español (`"ene"…"dic"`), fuente de `dateShort`/`rangeText`.
- `daysUntil(iso)`: días entre `TODAY_ISO` y la fecha dada, con piso en 0 (`Math.max(0, …)`).
- `discountPct(normal, promo)`: `Math.round((1 - promo/normal) * 100)`, con guardas de validez (normal>0, promo>0, promo<normal); si no son válidos retorna 0.
- `STATUS_CFG`: mapa de `CampaignProduct["status"]` (`ready`/`pending`/`stock_risk`) a etiqueta y tono de badge.

### Subcomponentes definidos en el archivo
No aplica — exporta funciones y constantes: `MONTHS`, `dateShort`, `rangeText`, `daysUntil`, `discountPct`, `STATUS_CFG`, y el tipo `ProductForm`.

---

## 11. campaignsShared.tsx

**Archivo:** `src/pages/campaignsShared.tsx`

### Ruta y archivo
No routeado; módulo compartido entre `CampaignsPage` y `CampaignPerformance`.

### Propósito
Provee un único componente `Svg` para renderizar los íconos inline (paths SVG) usados por los mapas de metadatos de canal/placement (`CHANNEL_META`, `PERF_CHANNEL_META`, `PLACEMENT_ICON`), evitando repetir el wrapper `<svg>` en cada página.

### Fuentes de datos
Ninguna (componente de presentación puro, sin imports de `data`/`context`/`utils` de negocio).

### Estado y navegación
No aplica.

### Estructura visual
`Svg({ path, className })`: `<svg>` con `viewBox="0 0 24 24"`, `stroke="currentColor"`, que renderiza un único `<path>` con el `d` recibido.

### Lógica de negocio clave
Ninguna.

### Subcomponentes definidos en el archivo
- `Svg` — único componente exportado.

---

## 12. Hallazgos de clean code

Hallazgos de alta confianza, seguros y que preservan el comportamiento (no se aplicó ningún cambio; solo se documentan para una futura limpieza).

1. **Colisión de nombre `CHANNEL_META` entre dos dominios distintos.** `src/utils/channelDemand.ts:25` exporta `CHANNEL_META` para `DemandChannel` (tienda/ecommerce/marketplace/empresa/licitaciones), usado en `SeasonsChannelsPage.tsx` y `SeasonPlannerPage.tsx`. `src/data/mockCampaignPlans.ts:39` exporta también `CHANNEL_META`, pero para `PromoChannelKey` (redes/ml/web/tienda), usado en `CampaignsPage.tsx`/`CampaignPerformance.tsx`. Mismo nombre, formas incompatibles, mismo área de producto ("campañas y temporadas") — alto riesgo de que un IDE autoimporte el `CHANNEL_META` equivocado. Sugerencia: renombrar uno de los dos en su origen (p. ej. `PROMO_CHANNEL_META` en `mockCampaignPlans.ts`) y actualizar sus importadores.

2. **Lógica de alternar orden de tabla (asc/desc/nueva columna) duplicada.** `CampaignOpportunitiesPage.tsx:227-230` (`handleSort`) y `CampaignPerformance.tsx:221-232` (`cycleSort`) implementan exactamente la misma regla de tres ramas (misma key → invierte dir; key nueva → `desc`). Sugerencia: extraer un helper compartido (p. ej. `utils/tableSort.ts` con `nextSortState(current, key)`) y reutilizarlo en ambos archivos.

3. **Tipo de estado de orden reinventado en vez de reutilizar `SortState`.** `CampaignOpportunitiesPage.tsx:7` importa `type SortState` desde `components/ui/Table.tsx:21`. `CampaignPerformance.tsx:213-220` declara el mismo shape (`{ key: string | null; dir: "asc" | "desc" }`) inline para `chSort`/`prSort` en vez de importar `SortState`. Sugerencia: importar y usar `SortState` en `CampaignPerformance.tsx` para consistencia de tipos.

4. **Cálculo de "posición dentro del placement" duplicado en el mismo archivo.** En `CampaignsPage.tsx:109-117` (`assigned` dentro de `allSpaces`) y `CampaignsPage.tsx:141-150` (`positionBySku`) se recorre el mismo `spaceProducts` para calcular, con la misma fórmula (`i + 1`, `i === 0`, `i === group.length - 1`), la posición/`isFirst`/`isLast` de cada producto dentro de su espacio — una vez por espacio (para las tarjetas) y otra por SKU (para la tabla). Sugerencia: calcular una sola vez un mapa `sku → {position, total, isFirst, isLast}` y derivar de ahí tanto `s.assigned` como `positionBySku`.

5. **Umbral de "desviación relevante" (8 puntos porcentuales) duplicado entre lógica de negocio y presentación.** `src/utils/seasonTracking.ts:142` fija `status = variancePct > 8 ? "over" : variancePct < -8 ? "under" : "on"` para clasificar el avance por canal. `src/pages/seasonPlanner/components.tsx:518-519` (`VarianceBadge`) repite el mismo par de umbrales (`pct > 8` / `pct < -8`) de forma independiente para colorear el badge. Si el umbral de negocio cambia, hay que recordar tocar ambos archivos. Sugerencia: exportar una constante `VARIANCE_ALERT_THRESHOLD_PCT = 8` desde `utils/seasonTracking.ts` (o un módulo de constantes compartido) y que `VarianceBadge` la importe en vez de repetir el número.

6. **Reparto de presupuesto por canal (40/30/20/10 %) como magic numbers duplicados entre código y copy de UI.** `CampaignsPage.tsx:290-295` (`submitCreate`) codifica el reparto automático del presupuesto de una campaña nueva como `tb * 0.4` / `0.3` / `0.2` / `0.1` para redes/ML/web/tienda respectivamente. El mismo reparto se repite como texto libre en el modal "Crear campaña" (`CampaignsPage.tsx:1146`: *"Se reparte automáticamente: 40% Redes, 30% Mercado Libre, 20% Web, 10% Tienda"*). Si se ajustan los porcentajes en el código, el texto de ayuda queda desactualizado silenciosamente. Sugerencia: extraer un único `CHANNEL_BUDGET_SPLIT: Record<PromoChannelKey, number>` y generar el texto de ayuda a partir de ese objeto (o al menos mantener ambos con un comentario cruzado).

7. **Componente de página sobredimensionado.** `CampaignsPage.tsx` define un único componente (`CampaignsPage`, líneas 24-1154, ~1130 líneas) que mezcla: cálculo derivado (ocupación de espacios, posiciones, reparto de presupuesto), dos formularios completos en `Modal` (agregar/editar producto y crear campaña) y el render de la grilla/calendario de espacios y la tabla de productos, todo inline. Sugerencia (sin cambiar comportamiento): extraer al menos el modal "Agregar/editar producto" y el modal "Crear campaña" a componentes propios dentro de la misma carpeta (`campaigns/ProductFormModal.tsx`, `campaigns/CreateCampaignModal.tsx`), recibiendo el estado por props, tal como ya se hizo con `CreatedCampaignsView` para `CampaignOpportunitiesPage`.
