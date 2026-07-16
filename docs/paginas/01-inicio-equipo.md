# Inicio y Equipo — Documentación técnica

Documentación de referencia de las páginas de "Inicio" (portada operativa del comprador / "Mi cartera") y del módulo "Equipo" (vistas exclusivas del rol líder). Generado a partir del código fuente en `src/pages/`.

## Tabla de contenidos

1. [MyPanelPage.tsx — Inicio / Mi cartera](#1-mypanelpagetsx--inicio--mi-cartera)
2. [myPanel/InicioPortada.tsx](#2-mypanelinicioportadatsx)
3. [myPanel/components.tsx](#3-mypanelcomponentstsx)
4. [myPanel/types.ts](#4-mypaneltypests)
5. [TeamDashboardPage.tsx — Panel del equipo](#5-teamdashboardpagetsx--panel-del-equipo)
6. [WorkloadPage.tsx — Carga & reasignación](#6-workloadpagetsx--carga--reasignación)
7. [TeamAlertsPage.tsx — Alertas del equipo](#7-teamalertspagetsx--alertas-del-equipo)
8. [BuyersPage.tsx — Compradores](#8-buyerspagetsx--compradores)
9. [GoalsPage.tsx — Metas del equipo (OKRs)](#9-goalspagetsx--metas-del-equipo-okrs)
10. [Hallazgos de limpieza (clean-code)](#10-hallazgos-de-limpieza-clean-code)

---

## 1. MyPanelPage.tsx — Inicio / Mi cartera

### Ruta y archivo
`src/pages/MyPanelPage.tsx`, exporta `MyPanelPage`. Cargada de forma perezosa en `src/routes/AppRoutes.tsx` como `InicioPage` y montada en **seis rutas**:
- `/` y `/mi-cartera` → resumen ("portada" en `/`, "Mi cartera" resumen en `/mi-cartera`).
- `/mi-cartera/productos-clave`, `/mi-cartera/marcas`, `/mi-cartera/proveedores`, `/mi-cartera/oportunidades` → foco de cartera específico.
- `/mi-panel` redirige a `/` (ruta legada).

El propio componente decide qué modo mostrar leyendo `location.pathname` (ver "Estado y navegación").

### Propósito
Es la página de aterrizaje del comprador: en `/` responde "¿qué debo resolver hoy?" (bandeja priorizada de decisiones); en `/mi-cartera/*` responde "¿cómo está funcionando mi negocio?" (venta, margen, inventario, cobertura, surtido, proveedores) para las categorías que tiene asignadas.

### Fuentes de datos
- `src/data/mockProducts` (`products`), `src/data/mockRecommendations` (`recommendations`), `src/data/mockSuppliers` (`suppliers`), `src/data/mockCampaignOpportunities` (`campaignOpportunities`), `src/data/mockPurchaseOrders` (`purchaseOrders`), `src/data/mockCategories` (`categories`).
- `src/context/BuyerContext` (`useBuyer` → `buyer`, `myCategories`), `src/context/OcDraftContext` (`useOcDraft` → `addItem`, `hasItem`, `count`, `totalAmount`), `src/context/ToastContext` (`useToast`), `src/context/SignalsContext` (`useSignals` → `signals`), `src/context/PurchaseFlowContext` (`usePurchaseFlow` → `approvals`).
- `src/utils/orderConsolidation` (`orderBySignal`), `src/utils/calculations` (`coverageDays`, `coverageSentence`, `estimatedStockoutDate`, `calculateSuggestedPurchase`, `addDaysISO`), `src/utils/constants` (`TODAY_ISO`), `src/utils/seasonality` (`seasonalFactor`), `src/utils/lostOpportunities` (`lostOpportunities`), `src/utils/formatters` (`capitalize`, `formatCurrencyCompact`, `formatDate`, `formatDays`, `formatNumber`, `formatPercent`).
- `src/components/business/signalLabels` (`SIGNAL_TYPE`, `SIGNAL_STATUS`, `SIGNAL_PRIORITY`), `src/components/business/StatusBadge`.

### Estado y navegación
- No usa `useState` propio: el "modo" de vista se deriva de `useLocation()` (`isPortfolioView = pathname.startsWith("/mi-cartera")`) y el foco (`portfolioFocus: PortfolioFocus`) se deriva del segmento final del pathname (`resumen | productos-clave | marcas | proveedores | oportunidades`).
- El comprador activo (`buyer`) y sus categorías vienen de `BuyerContext`, que internamente persiste en `localStorage` bajo la clave `"compras:buyer"` (ver `useLocalStorage` en `BuyerContext.tsx`).
- Enlaza a: `/productos/:sku`, `/proveedores`, `/proveedores/:id?tab=negociacion`, `/categorias`, `/categorias/:id`, `/comprar/decisiones`, `/comprar/borradores`, `/comprar/aprobaciones`, `/comprar/seguimiento`, `/inventario`, `/ventas`, `/senales-ventas`, `/venta-no-capturada`, `/anticipacion`, `/mi-cartera/*`.
- Botón de acción del `PageHeader` alterna entre "Ver decisiones" (navega a `/`) y "Ir a reposición" (navega a `/comprar/decisiones") según `isPortfolioView`.

### Estructura visual
- **Portada (`!isPortfolioView`)**: delega en `InicioPortada` (prioridades del día, agenda, resumen en una línea, trabajo pendiente) y añade debajo una sección "Trabajo del día" con: tabla de riesgo de quiebre (`DataTable` + columnas `riskColumns`), lista de "Órdenes de compra sin recibir", "Proveedores por revisar", "Mi inventario con sobrestock", tarjeta "Venta no capturada" y `CollapsibleSection` "Señales de ventas para mí".
- **Mi cartera — resumen (`isPortfolioView && focus === "resumen"`)**: cabecera de cartera (categorías/SKU/proveedores/marcas), card "Objetivos del mes" (4 `GoalBar`), sección "Resumen ejecutivo" (8 `TrendKpi`), cards "Salud de cartera" (score 0-100 + `MiniDim` por dimensión) y "Principales focos" (`FocoCard` x5), "Productos estratégicos" (top 3), tablas compactas de "Marcas" y "Proveedores", grid de "Oportunidades" resumidas, card "Tendencias" (acelerando/desacelerando vía `TrendRow`), "Categorías" (grid de tarjetas) y "Calidad de cartera" (`QualityItem` x4).
- **Mi cartera — foco específico (`productos-clave` / `marcas` / `proveedores` / `oportunidades`)**: delega todo el layout en `PortfolioFocusWorkspace` (de `myPanel/components.tsx`).

### Lógica de negocio clave
- **Cartera agregada (`portfolio`, useMemo)**: venta 30d, utilidad bruta, valor de inventario, sobrestock (`purchaseStatus === "overstock"` o `inventoryDays > 180`), stock sin venta 90d, cobertura ponderada por venta, rotación anualizada, GMROI — todo calculado inline sobre `myProducts` (no delega a un util compartido).
- **Ritmo de venta (`salesPace`, useMemo)**: compara venta 30d real vs. esperado (`salesLast90Days / 3`); clasifica "acelerando" (`diffPct >= 0.15`) y "desacelerando" (`diffPct <= -0.15` y con stock), usando `coverageDays` de `utils/calculations`.
- **Roles de producto (`portfolioInsights.productRows`)**: clasifica cada SKU en `Estrella | Tractor | Margen | Emergente | Riesgo | Deterioro | Detenido` mediante una cascada de reglas con umbrales embebidos (crecimiento ±25%, margen ≥34/36%, GMROI ≥4, venta ≥40 u.). Los umbrales no están extraídos a constantes con nombre.
- **Salud de cartera (`portfolioInsights.health`)**: 6 dimensiones (venta, margen, inventario, disponibilidad, surtido, proveedores) normalizadas 0-100 con fórmulas heurísticas propias del componente (p. ej. `100 - overstockValue/inventoryValue * 120`).
- **Riesgo de quiebre (`riskRows`)**: producto con venta > 0 y (`availableStock <= 0` o `coverageDays <= leadTimeDays * 2`); usa `recommendations` como fuente preferente de cantidad sugerida y cae a `calculateSuggestedPurchase` (de `utils/calculations`, con `seasonalFactor` de `utils/seasonality`) si no hay recomendación.
- **Historia / tendencia (`story`, useMemo)**: compara contra un "mes anterior" sintético (`(salesLast90Days - salesLast30Days) / 2`), calcula deltas de venta/margen/rotación/GMROI/cobertura, score de salud global (promedio de las 6 dimensiones) con mejor/peor dimensión, top 3 productos estratégicos por utilidad, metas del mes (venta +18% redondeada a 500.000, margen 33%, sobrestock tope, disponibilidad 96%).
- **Agenda de decisiones (`agenda`, `priorityAgenda`)**: agrega ítems de 6 fuentes (riesgo de quiebre, ventas acelerando/desacelerando, OC abiertas, proveedores a revisar, sobrestock, aprobaciones pendientes) con `priority` e `impactValue` numéricos propios por fuente, y ordena por prioridad → impacto → días. Es la lógica más extensa del archivo (~150 líneas de `forEach` consecutivos).
- **Portada de agenda (`portadaAgenda`, useMemo)**: usa `orderBySignal` (`utils/orderConsolidation`) para calcular fecha límite de emisión de OC (quiebre − lead time) y arma hasta 7 entradas mezclando OC por emitir, seguimiento de atrasos, llegadas próximas y campañas en ventana de 21 días.

### Subcomponentes definidos en el archivo
- `MyPanelPage` — único componente exportado; orquesta cálculo y layout de ambas vistas (portada y Mi cartera).

---

## 2. myPanel/InicioPortada.tsx

### Ruta y archivo
No es una ruta propia; es un subcomponente de presentación usado por `MyPanelPage` cuando `!isPortfolioView` (rutas `/`).

### Propósito
Presentar, en un único vistazo, la "bandeja de entrada diaria" del comprador: qué resolver hoy, por qué importa, cuánto está en juego y qué acción tomar — explícitamente diseñada para no ser un dashboard de métricas.

### Fuentes de datos
No importa datos ni contexto directamente: recibe todo por props (`priorities: AgendaItem[]`, `agenda: AgendaEntry[]`, `summary: PortadaSummary`, `pending: PendingWork[]`) ya calculados por `MyPanelPage`. Importa tipos de `./types` (`AgendaItem`) y utilidades visuales (`cn` de `utils/cn`).

### Estado y navegación
Sin estado propio. Cada tarjeta de prioridad, entrada de agenda y ítem de trabajo pendiente es un `Link` de `react-router-dom` hacia la ruta indicada en `item.to` / `e.to` / `w.to` (definidas por el llamador).

### Estructura visual
- Barra resumen de una línea (categorías, quiebres, riesgos, sobrestock, OC atrasadas) vía `SummaryChip`.
- Columna principal "Prioridades del día": lista ordenada (`<ol>`) de tarjetas con badge de tipo, urgencia, título, impacto y recomendación; la primera tarjeta se resalta con color según `tone`. Usa `EmptyState` si no hay prioridades.
- Columna lateral: "Tu agenda" (lista de próximos vencimientos con ícono, detalle y pastilla de tiempo) y "Trabajo pendiente" (lista de contadores por categoría de trabajo).

### Lógica de negocio clave
Ninguna: es puramente presentacional. Solo helpers de formato local: `plural(n, singular, plural)` para pluralizar etiquetas y los mapas `cardTone` / `numberTone` / `dotTone` / `pillTone` que traducen `tone` a clases Tailwind.

### Subcomponentes definidos en el archivo
- `InicioPortada` — componente exportado, layout completo de la portada.
- `Sep` — separador tipográfico "·" entre chips del resumen.
- `plural(n, one, many)` — función helper de pluralización (no componente).
- `SummaryChip` — chip "valor + etiqueta" con color por `tone`, usado en la barra resumen.

---

## 3. myPanel/components.tsx

### Ruta y archivo
No es una ruta; biblioteca de componentes de presentación puros para la vista "Mi cartera" (usados por `MyPanelPage`).

### Propósito
Aislar el renderizado de "Mi cartera" del cálculo: cada componente recibe filas ya derivadas (`KeyProductRow`, `BrandPortfolioRow`, `SupplierPortfolioRow`, `PortfolioOpportunity`, `SalesPaceRow`) y solo las pinta, sin `useState` ni fetch de datos propios.

### Fuentes de datos
`src/components/ui/Card`, `src/components/ui/Badge`, `src/components/ui/EmptyState`, `src/components/business/StatusBadge`, `src/utils/formatters` (`capitalize`, `formatCurrencyCompact`, `formatNumber`, `formatPercent`), `src/utils/cn`. Tipos de `./types`.

### Estado y navegación
Sin estado. Todos los ítems clicables son `Link` hacia `/productos/:sku`, `/proveedores/:id?tab=negociacion`, o la ruta pasada por prop (`item.to`, `w.to`).

### Estructura visual
- `PortfolioFocusWorkspace`: switch por `focus` que arma el layout de cada pestaña de "Mi cartera":
  - `productos-clave`: "Mapa de roles comerciales" (conteo por rol + lista de `KeyProductItem`) y "Rankings para decidir" (3 `ProductRank`: más vendidos, mayor utilidad, mayor GMROI).
  - `marcas`: KPIs de marcas (`PortfolioMetric` x4) + grid de `BrandHealthItem`.
  - `proveedores`: KPIs de negociación (`PortfolioMetric` x3) + grid de `SupplierPortfolioItem`.
  - `oportunidades` (default): grid de `OpportunityItem` o `EmptyState`.
- Componentes reutilizables exportados para uso desde `MyPanelPage`: `TrendKpi` (KPI con flecha de tendencia), `GoalBar` (barra de meta con % y texto), `MiniDim` (barra mini de dimensión de salud), `FocoCard` (fila "foco" con link), `Delta` (texto +/- % con color), `TrendRow` (fila de producto con % de cambio), `QualityItem` (tarjeta de calidad de datos), `SectionLabel`, `PortfolioCountLink`, `AgendaStat`, `SignalSummary`.

### Lógica de negocio clave
- `roleTone(role)`: mapea `PortfolioProductRole` a color de `Badge` (Estrella→green, Tractor/Emergente→blue, Margen→violet, Detenido/Deterioro→red, resto→amber).
- `BrandHealthItem`: deriva una "conclusión" textual de la marca (crece consumiendo capital / se frena / protege rentabilidad / monitorear mix) con umbrales embebidos (`growth > 0.15`, `growth < -0.12`, `margin >= 34`).
- `SupplierPortfolioItem`: deriva "posición negociadora" con umbrales embebidos (`dependency > 0.35` y ratio de alternativas `> 0.4`).
- `TrendKpi`: formatea el delta según unidad (`%`, `pp`, `d`, o número plano) y decide si es "bueno" según `invert`.

### Subcomponentes definidos en el archivo
- `PortfolioFocusWorkspace` — layout por foco de cartera (exportado).
- `ProductRank` — lista top-N de productos por métrica (privado).
- `SectionLabel` — etiqueta de sección en mayúsculas (exportado).
- `PortfolioCountLink` — link tipo pastilla "Etiqueta (n)" (exportado).
- `TrendKpi` — tarjeta KPI con flecha de tendencia (exportado).
- `GoalBar` — barra de progreso hacia una meta (exportado).
- `MiniDim` — barra mini de dimensión 0-100 (exportado).
- `FocoCard` — fila "foco" con punto de color y link (exportado).
- `Delta` — texto de variación porcentual con color (exportado).
- `TrendRow` — fila producto + % de cambio (exportado).
- `QualityItem` — tarjeta de calidad de datos, número + etiqueta + link (exportado).
- `roleTone` — helper de color por rol (privado, no componente).
- `KeyProductItem` — tarjeta de producto clasificado por rol (privado).
- `BrandHealthItem` — tarjeta de salud de marca (privado).
- `SupplierPortfolioItem` — tarjeta de proveedor con posición negociadora (privado).
- `OpportunityItem` — tarjeta de oportunidad comercial (privado).
- `PortfolioMetric` — mini-KPI de etiqueta + valor (privado).
- `AgendaStat` — tarjeta etiqueta + valor (exportado, sin uso visible dentro de las páginas documentadas).
- `SignalSummary` — tarjeta coloreada de resumen de señal (exportado, sin uso visible dentro de las páginas documentadas).

---

## 4. myPanel/types.ts

### Ruta y archivo
No es una ruta; módulo de tipos compartidos entre `MyPanelPage`, `InicioPortada` y `components.tsx`.

### Propósito
Definir la forma de los datos ya derivados que consume la vista "Mi cartera", separando el contrato de datos del cálculo (en `MyPanelPage`) y de la presentación (en `components.tsx`).

### Fuentes de datos
Solo tipos: importa `Product`, `Supplier` de `src/types/purchasing`.

### Estado y navegación
No aplica (archivo de solo tipos).

### Estructura visual
No aplica.

### Lógica de negocio clave
No contiene lógica; define los tipos: `RiskRow`, `AgendaItem` (incluye `kind`, `tone`, `priority`, `impactValue` para el ranking de la agenda), `SalesPaceRow`, `PortfolioProductRole` (unión de 7 roles), `KeyProductRow`, `PortfolioFocus` (unión de 5 vistas), `BrandPortfolioRow`, `SupplierPortfolioRow`, `PortfolioOpportunity`.

### Subcomponentes definidos en el archivo
No aplica (sin componentes).

---

## 5. TeamDashboardPage.tsx — Panel del equipo

### Ruta y archivo
`src/pages/TeamDashboardPage.tsx`, ruta `/equipo`, protegida con `RoleGate allow="lider"` (solo visible para el rol líder).

### Propósito
Responde "¿cómo está funcionando el área de compras hoy?" para un líder de equipo: primero las excepciones que requieren su intervención, luego los indicadores agregados.

### Fuentes de datos
`src/data/mockBuyers` (`buyers`), `src/data/mockLeaderAlerts` (`leaderAlerts`), `src/utils/teamScore` (`teamAggregate`, `scoreLabel`, `scoreColor`, `trendText`, `trendColor`, `WORKLOAD_CFG`, `workloadBarColor`, `byWorkloadDesc`), `src/utils/formatters` (`formatCurrencyCompact`, `formatNumber`), `src/components/business/BuyerDetailDrawer` (`BuyerDetailDrawer`, `BUYER_TONE_AV`), `src/components/business/KpiCard`.

### Estado y navegación
- `useState<Buyer | null>` (`sel`) controla el drawer de detalle de comprador (`BuyerDetailDrawer`), abierto al hacer clic en una fila de desempeño o al resolver una excepción con `buyer` asociado.
- `openByName(name)`: si la alerta trae un comprador, abre su drawer; si no, navega a `/equipo/carga`.
- Enlaza a `/equipo/alertas` (botón "Ver todas") y `/equipo/carga` (botón "Equilibrar carga").

### Estructura visual
- Hero con score promedio del equipo (`a.avgScore`) + 3 mini-stats (compradores, venta, ahorro negociado).
- Card "Requiere tu atención": hasta 4 `leaderAlerts` ordenadas por severidad, cada una con borde de color y botón que llama a `openByName`.
- Grid de 8 `KpiCard` (cumplimiento de metas, fill rate, nivel de servicio, quiebres, compras pendientes, tiempo de reposición, sobrestock, productos gestionados).
- Dos cards "Mejor desempeño" / "Necesita apoyo" (top-2 / bottom-2 por `score`), renderizadas con el subcomponente local `PerfRow`.
- Card "Carga del equipo": barra de `workloadPct` por comprador, ordenada por `byWorkloadDesc`.
- `BuyerDetailDrawer` al final, controlado por `sel`.

### Lógica de negocio clave
- Todos los KPIs y agregados (`teamAggregate(buyers)`) vienen de `utils/teamScore.ts`; la página solo arma el arreglo `kpis` con `tone` condicional (p. ej. `a.goalArea >= 85 ? "good" : "warn"`).
- `exceptions`: copia y ordena `leaderAlerts` por severidad con un comparador que reconstruye el objeto de orden `{ high: 0, medium: 1, low: 2 }` **en cada comparación** (no memoizado, no extraído) y toma las primeras 4.
- `top` / `bottom`: se derivan de `[...buyers].sort((x,y) => y.score - x.score)` tomando `slice(0,2)` y `slice(-2).reverse()`.

### Subcomponentes definidos en el archivo
- `TeamDashboardPage` — componente de página (exportado).
- `PerfRow` — fila de comprador con avatar, nombre, score y tendencia; usada en "Mejor desempeño" y "Necesita apoyo" (definida dentro del cuerpo del componente, se recrea en cada render).

---

## 6. WorkloadPage.tsx — Carga & reasignación

### Ruta y archivo
`src/pages/WorkloadPage.tsx`, ruta `/equipo/carga`, protegida con `RoleGate allow="lider"`.

### Propósito
Permite al líder ver la carga de trabajo (0-100%) de cada comprador y simular/registrar la reasignación de categorías, proveedores o solicitudes, o el offboarding de un comprador con redistribución de su carga.

### Fuentes de datos
`src/data/mockBuyers` (`buyers`), `src/data/mockSuppliers` (`suppliers`), `src/utils/teamScore` (`WORKLOAD_CFG`, `workloadBarColor`, `byWorkloadDesc`), `src/context/ToastContext` (`useToast`), `src/context/SignalsContext` (`useSignals` → `signals`), `src/utils/formatters` (`formatNumber`), `src/components/business/BuyerDetailDrawer` (`BUYER_TONE_AV`).

### Estado y navegación
- `useState<ReassignState | null>` (`reassign`): controla el modal de reasignación (categoría/proveedor/solicitud), guarda `{ kind, label, from }`.
- `useState<OffboardState | null>` (`offboard`): controla el modal de baja y redistribución, guarda `{ buyer, mode }` (modo por defecto `"carga"`).
- No hay navegación a otras rutas: todo ocurre en modales (`Modal`) dentro de la misma página; las acciones solo disparan `toast.success(...)` (no mutan datos reales, es simulación de front).

### Estructura visual
- Card de leyenda de niveles de carga (`LEVELS`: Baja/Normal/Alta/Crítica con color).
- Grid de tarjetas por comprador (ordenadas por `byWorkloadDesc`): avatar, badge de carga, barra de progreso, 6 "factores" (categorías, proveedores, SKUs, OC abiertas, compras pendientes, quiebres), grupos `ReassignGroup` para categorías/proveedores/solicitudes, botón "Dar de baja y redistribuir".
- `Modal` "Reasignar {kind}": lista de compradores destino con la nueva carga estimada.
- `Modal` "Dar de baja y redistribuir": selector de criterio (`equitativa | carga | especialidad | manual`) + vista previa de impacto en la carga de cada comprador restante.

### Lógica de negocio clave
- `suppliersOf(b)` / `requestsOf(b)`: listan hasta 6 proveedores/solicitudes asociadas al comprador (proveedores activos de sus categorías; señales `assignedBuyer === b.name` no resueltas/rechazadas).
- Reasignación individual: `weight` fijo por tipo (categoría 0.9, proveedor 0.4, solicitud 0.15); `share = round((from.workloadPct / from.categories.length) * weight)`; `newPct = min(100, target.workloadPct + share)`. Fórmula heurística embebida en el JSX del modal, sin extraer a `utils/teamScore.ts`.
- Redistribución por baja: si `mode === "carga"`, reparte el 50% de la carga del saliente concentrado en el comprador con menor carga y el resto entre los demás; si no, reparte equitativamente (`workloadPct / arr.length`). También calculado inline en el JSX.
- Ninguna de las dos reasignaciones persiste estado real: solo dispara un toast de confirmación (`toast.success`), no hay mutación de `buyers`.

### Subcomponentes definidos en el archivo
- `WorkloadPage` — componente de página (exportado).
- `ReassignGroup` — grupo de chips clicables (categorías/proveedores/solicitudes) con color por `kind` (privado).

---

## 7. TeamAlertsPage.tsx — Alertas del equipo

### Ruta y archivo
`src/pages/TeamAlertsPage.tsx`, ruta `/equipo/alertas`, protegida con `RoleGate allow="lider"`.

### Propósito
Listar, para el líder, todas las alertas de gestión del equipo (no solo las top-4 de `TeamDashboardPage`) con severidad, tipo, motivo de importancia y acción sugerida.

### Fuentes de datos
`src/data/mockBuyers` (`buyers`), `src/data/mockLeaderAlerts` (`leaderAlerts`), `src/components/business/BuyerDetailDrawer` (`BuyerDetailDrawer`).

### Estado y navegación
- `useState<Buyer | null>` (`sel`): controla el `BuyerDetailDrawer`.
- `handle(alert)`: enruta según `alert.type` — `overload`/`underload`/`no_owner` → `/equipo/carga`; `goal_risk` → `/equipo/metas`; `no_supplier` → `/proveedores`; si tiene `buyer` asociado → abre el drawer de ese comprador; en cualquier otro caso → `/equipo/compradores`.

### Estructura visual
- Badges de conteo por severidad (alta/media/baja) usando `leaderAlerts.filter(...)`.
- Lista de `Card` (una por alerta): barra lateral de color por severidad, badges (severidad, tipo vía `TYPE_LABEL`, comprador o "Área"), título, detalle, caja ámbar "Por qué importa" (texto de `IMPACT[a.type]`), botón de acción (`a.action`, texto libre del dato mock) que llama a `handle(a)`.
- `BuyerDetailDrawer` al final.

### Lógica de negocio clave
- Ordena `leaderAlerts` por severidad reconstruyendo inline el mapa `{ high: 0, medium: 1, low: 2 }` (igual patrón que `TeamDashboardPage.tsx`, ver hallazgos de limpieza).
- `TYPE_LABEL` e `IMPACT`: diccionarios estáticos que traducen `LeaderAlert["type"]` a etiqueta corta y a la frase de "por qué importa"; son el único lugar del código que explica el impacto de negocio de cada tipo de alerta.

### Subcomponentes definidos en el archivo
- `TeamAlertsPage` — único componente exportado; no define subcomponentes internos (usa `Card`/`Badge`/`Button` genéricos inline).

---

## 8. BuyersPage.tsx — Compradores

### Ruta y archivo
`src/pages/BuyersPage.tsx`, ruta `/equipo/compradores`, protegida con `RoleGate allow="lider"`.

### Propósito
Directorio de fichas ejecutivas de todos los compradores del equipo, punto de entrada al detalle completo de cada uno (KPIs, metas, evolución).

### Fuentes de datos
`src/data/mockBuyers` (`buyers`), `src/utils/teamScore` (`scoreColor`, `trendText`, `trendColor`, `WORKLOAD_CFG`, `leagueOf`), `src/components/business/BuyerDetailDrawer` (`BuyerDetailDrawer`, `BUYER_TONE_AV`).

### Estado y navegación
- `useState<Buyer | null>` (`sel`): al hacer clic en cualquier tarjeta, abre `BuyerDetailDrawer` con ese comprador. No hay navegación a otras rutas ni filtros.

### Estructura visual
- Grid responsivo (1/2/3 columnas) de tarjetas-botón, una por comprador (orden por `score` descendente): avatar con iniciales, nombre, categorías, score numérico + tendencia, badges "Nivel {liga}" (`leagueOf`) y "Carga {label}" (`WORKLOAD_CFG`), y 4 mini-métricas (Fill Rate, Quiebres, Pendientes, Alertas).
- `BuyerDetailDrawer` como panel de detalle (probablemente el componente más rico en información de comprador individual, compartido con las otras páginas de Equipo).

### Lógica de negocio clave
Ninguna propia: toda la clasificación (liga, color de score, color/etiqueta de carga, texto de tendencia) proviene de `utils/teamScore.ts`. La página solo ordena `buyers` por `score` y arma el grid.

### Subcomponentes definidos en el archivo
- `BuyersPage` — único componente exportado; sin subcomponentes internos.

---

## 9. GoalsPage.tsx — Metas del equipo (OKRs)

### Ruta y archivo
`src/pages/GoalsPage.tsx`, ruta `/equipo/metas`, protegida con `RoleGate allow="lider"`.

### Propósito
Responde "¿quién va ganando, quién está en riesgo, y qué mover para subir?" mostrando el score OKR de cada comprador (avance ponderado por peso de meta) y el detalle de sus metas individuales.

### Fuentes de datos
`src/data/mockBuyers` (`buyers`), `src/utils/teamScore` (`okrScore`, `okrLevel`, `okrState`, `goalImpact`, `GOAL_ORDER`, `stockoutRate`, `trendText`, `trendColor`), `src/components/business/BuyerDetailDrawer` (`BUYER_TONE_AV`), `src/components/ui/Select`.

### Estado y navegación
- `useState("all")` (`comprador`): filtro de comprador vía `Select`.
- `useState("all")` (`estado`): filtro de estado de meta (`risk | on_track | done`) vía `Select`.
- Ambos filtros son solo de UI local, no persisten en URL ni `localStorage`. No hay navegación saliente (no hay `Link`/`navigate`) — toda la interacción queda dentro de la página.

### Estructura visual
- Leaderboard visual: ranking completo de compradores por `okrScore`, con medalla (🥇🥈🥉) para el top-3, avatar, nivel (color por `LEVEL_COLOR`), tendencia y barra de progreso.
- Barra de filtros (`Select` x2).
- Grid de tarjetas por comprador (filtradas): medidor circular (`conic-gradient`) con el score OKR, posición en el ranking y distancia al puesto anterior, badges de nivel/estado, reconocimientos (🏅, hasta 5 categorías distintas de "mejor en..."), meta de mayor impacto destacada, lista de metas activas con barra de progreso y "cumplidas" contadas aparte.

### Lógica de negocio clave
- Todo el cálculo de OKR (`okrScore`, `okrLevel`, `okrState`, `goalImpact`, `GOAL_ORDER`) vive en `utils/teamScore.ts`; la página solo compone y ordena.
- `recognitions`: reparte 5 reconocimientos ("Mejor OKR", "Mayor mejora", "Menos quiebres", "Mejor Fill Rate", "Mejor margen") usando `winnerId(fn, asc)`, un helper local que ordena `buyers` por la métrica dada y toma el primero — puede repetir ganador en varias categorías.
- `topGoal`: para cada comprador, la meta no cumplida de mayor `goalImpact(weight, pct)` (puntos OKR recuperables si esa meta llegara a 100%).
- Orden de metas visibles: primero por `GOAL_ORDER[status]` (riesgo antes que en curso antes que cumplida), luego por `goalImpact` descendente.

### Subcomponentes definidos en el archivo
- `GoalsPage` — único componente exportado.
- `goalBar(pct)` — helper (no componente) que devuelve el color hex de la barra de meta según el porcentaje (≥80 verde, ≥50 ámbar, si no rojo).

---

## 10. Hallazgos de limpieza (clean-code)

Ver lista de hallazgos en la respuesta final de la tarea (no se incluyen en este documento para mantenerlo como referencia funcional, no de auditoría).
