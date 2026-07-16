# Fundamentos compartidos

Referencia técnica de las piezas compartidas de **compras-cata**: sistema de diseño, componentes de negocio, layout/navegación, contextos globales, utilidades y datos mock. UI en español (comprador retail chileno).

## Tabla de contenidos

1. [Sistema de diseño (`src/components/ui`)](#1-sistema-de-diseño-srccomponentsui)
2. [Componentes de negocio (`src/components/business`)](#2-componentes-de-negocio-srccomponentsbusiness)
3. [Layout y navegación (`src/components/layout`, `src/layouts`)](#3-layout-y-navegación-srccomponentslayout-srclayouts)
4. [Contextos — estado global (`src/context`)](#4-contextos--estado-global-srccontext)
5. [Utilidades (`src/utils`)](#5-utilidades-srcutils)
6. [Datos mock (`src/data`)](#6-datos-mock-srcdata)
7. [Convenciones de código](#7-convenciones-de-código)

---

## 1. Sistema de diseño (`src/components/ui`)

21 primitivas, sin dependencias de un framework de UI de terceros (salvo `react-day-picker` en `DateRangePicker`). Todas usan `cn()` (`src/utils/cn.ts`) para componer clases Tailwind condicionales.

| Componente | Props clave | Uso / convenciones |
|---|---|---|
| **Badge** | `tone?: "neutral"\|"blue"\|"green"\|"amber"\|"red"\|"violet"\|"slate"` (def. `neutral`), `children`, `dot?`, `className?` | Pastilla estática (`<span>`), coloreada con `ring-1 ring-inset`. Exporta el tipo `BadgeTone`, reutilizado por casi todos los componentes de negocio que definen su propio mapa estado→tono. |
| **BottomSheet** | `open`, `onClose`, `title`, `children`, `footer?` | Diálogo solo-móvil (`lg:hidden`), sube desde abajo. Usa `useDialogA11y`. Agrega arrastre táctil propio para cerrar (`onTouchStart/Move/End`, umbral 90px). `z-[55]`. |
| **Breadcrumbs** | `items: Crumb[]` (`{label, to?}`) | Ruta de navegación; el último ítem se renderiza como texto (página actual). Consumido por `PageHeader`. |
| **Button** | Extiende `ButtonHTMLAttributes`; `variant?: "primary"\|"secondary"\|"ghost"\|"danger"`, `size?: "sm"\|"md"`, `icon?`, `loading?` | `loading` reemplaza el `icon` por un `Spinner` y fuerza `disabled`. No usa `forwardRef`. |
| **Card / CardHeader / CardBody** | `Card`: `children`, `className?`. `CardHeader`: `title`, `description?`, `action?`. `CardBody`: `children` | Composición por **subcomponentes hermanos** (no slots): `<Card><CardHeader/><CardBody/></Card>`. `CardHeader`/`CardBody` leen `useDensity()` para ajustar padding. |
| **Chip / RemovableChip** | `Chip`: `children`, `active?`, `onClick?`, `nowrap?`. `RemovableChip`: `children`, `onRemove`, `removeLabel?` | `Chip` es `<span>` si no hay `onClick`, o `<button aria-pressed>` si lo hay (toggle). `RemovableChip` es un componente aparte con estilo fijo (tinte brand) y botón de cierre — no está construido sobre `Chip`. |
| **CollapsibleSection** | `id`, `title`, `description?`, `hint?`, `defaultOpen?`, `action?`, `children` | Envuelve `Card`/`CardBody`. Persiste abierto/cerrado en `localStorage` con clave `` `compras:section:${id}` ``. `action` detiene la propagación del click para no togglear la sección. |
| **ConfirmModal** | `open`, `title`, `message`, `confirmLabel?`, `cancelLabel?`, `danger?`, `onConfirm`, `onCancel` | Envoltorio delgado sobre `Modal` (`size="md"`); arma el `footer` con dos `Button` internamente. Usa `onCancel` en vez de `onClose` (asimetría de nombres respecto a `Modal`). |
| **DateRangePicker** | `value: IsoRange`, `onChange`, `label?`, `placeholder?`, `align?: "left"\|"right"` | Popover propio (botón disparador + panel), construido sobre `react-day-picker`. Mantiene `draft` separado del `value` aplicado (Aplicar/Cancelar/Limpiar). Atajos desde `DATE_PRESETS` (`utils/dateRange.ts`). Implementa su **propio** cierre por click-fuera/Escape (no reutiliza `useDialogA11y`). |
| **Drawer** | `open`, `onClose`, `title`, `description?`, `children`, `footer?` | Panel lateral derecho, `max-w-xl`, alto completo. Usa `useDialogA11y`. Estructuralmente casi idéntico a `Modal` (mismo header/body/footer). `z-[60]`. |
| **EmptyState** | `title`, `description?`, `icon?` (def. `IconBox`), `action?` | Placeholder centrado; usado directamente por `DataTable` cuando `data.length === 0`. |
| **Input** | Extiende `InputHTMLAttributes`; `icon?`, `label?` | Genera `id` estable con `useId()` si no se pasa `id`. Icono opcional posicionado a la izquierda (ajusta `pl-9`). No usa `forwardRef`. |
| **Modal** | `open`, `onClose`, `title`, `description?`, `children`, `footer?`, `size?: "md"\|"lg"\|"xl"` (def. `lg`) | Diálogo centrado, header/body/footer **por props** (no subcomponentes, a diferencia de `Card`). Usa `useDialogA11y`. `z-[60]`. Base de `ConfirmModal`. |
| **MoreActions** | `actions: MoreAction[]` (`{label, onClick, icon?, danger?}`), `label?` | Menú "⋮ Más acciones" (`role="menu"`/`"menuitem"`). Cierre por click-fuera/Escape implementado a mano (no comparte lógica con `useDialogA11y`). Retorna `null` si `actions.length === 0`. `z-40`. |
| **PageHeader** | `title`, `description?`, `action?`, `breadcrumbs?: Crumb[]`, `help?` | Compone `Breadcrumbs`. Lee `useDensity()` para ocultar `description` y compactar en modo denso. `help` se muestra junto al título (ícono de ayuda contextual). |
| **Select** | Extiende `SelectHTMLAttributes`; `label?`, `options: Option[]` (`{value, label}`), `placeholder?` | **Usa `options`, no `children`** — no se pasan `<option>` manualmente. Si `placeholder` está definido (incluso `""`), agrega una opción en blanco al inicio. Mismo patrón `useId`/`fieldId` que `Input`. |
| **Skeleton / PageSkeleton** | `Skeleton`: `className?`. `PageSkeleton`: sin props | `Skeleton` es un bloque pulsante genérico; `PageSkeleton` compone varios `Skeleton` en un layout de página completa (encabezado + fila de KPIs + tabla), usado como fallback de `Suspense` a nivel de ruta. |
| **DataTable** (`Table.tsx`) | `columns: Column<T>[]`, `data: T[]`, `rowKey`, `onRowClick?`, `emptyMessage?`, `rowClassName?`, `stickyHeader?`, `selection?: SelectionConfig`, `sort?`, `onSortChange?`, `mobileCard?: (row: T) => ReactNode` | Tabla genérica `<T>`. **`mobileCard`**: si se pasa, en `<lg` se muestra una lista de tarjetas y se oculta la tabla real (`hidden lg:block`). El wrapper de la tabla real siempre lleva `overflow-x-auto scrollbar-thin`. Ordenamiento client-side vía `sortValue` por columna. Renderiza `EmptyState` si no hay datos. |
| **Tabs** | `tabs: TabItem[]` (`{value, label, count?}`), `value`, `onChange`, `className?` | `role="tablist"`/`"tab"`/`aria-selected`; el tab activo usa una barra inferior absoluta (evita salto de layout). Badge `count` opcional por tab. |
| **Toaster** | Sin props (lee `useToast()`) | Consumidor puro de `ToastContext`. Se monta una sola vez en `AppLayout.tsx`. Posición fija inferior-derecha, `z-[60]`. |
| **icons.tsx** | Cada ícono: `{className?}` (def. `"w-5 h-5"`) | **Patrón factory**: un helper local `base(path)` (no exportado) genera cada componente; ~38 íconos SVG inline exportados individualmente (`IconCalendar`, `IconClose`, …). Sin librería externa, sin mapa nombre→componente. |

**Convención transversal de diálogos**: `Modal`, `Drawer` y `BottomSheet` comparten el hook `useDialogA11y` (foco inicial, trampa de Tab, cierre con Escape, restauración de foco). `DateRangePicker` y `MoreActions`, en cambio, implementan su propio cierre por click-fuera/Escape sin usar ese hook (ver hallazgos).

---

## 2. Componentes de negocio (`src/components/business`)

30 archivos: componentes de dominio (compra, proveedores, señales de venta, gamificación de equipo, logística) más módulos de "lenguaje" (mapas de etiquetas/tonos en español).

| Componente/módulo | Propósito |
|---|---|
| **AlertCard.tsx** | Tarjeta de una alerta comercial: barra de severidad, tipo, estado, recomendación y acciones revisar/resolver. |
| **BarList.tsx** | Lista de barras horizontales genérica (label + valor + tono), auto-escalada al máximo. |
| **BuyerDetailDrawer.tsx** | Drawer con ficha completa de un comprador: score, carga, 12 KPIs, desglose de score, sparkline de 6 semanas, metas individuales. |
| **CampaignBuilderModal.tsx** | Modal asistente para crear una campaña comercial (nombre/fechas, canales, productos/descuentos con precio en vivo). |
| **CatalogRedundancy.tsx** | Vista de análisis de redundancia de catálogo: KPIs, filtros de acción, grupos por subcategoría (mantener/liquidar/descontinuar), export CSV, lanzar campaña de liquidación. |
| **ChallengeList.tsx** | Tarjetas de retos de gamificación (equipo/duelo/racha) con barra de progreso y avatares. |
| **CompetitionFeed.tsx** | Feed compacto de eventos de ranking/liga/insignia/racha por comprador. |
| **ExportButton.tsx** | Botón reutilizable "Exportar CSV" con feedback de toast (vacío/éxito). |
| **FilterBar.tsx** | Barra de filtros responsiva (búsqueda, selects, toggles, rango de fechas) con panel de "más filtros" en desktop y bottom sheet en móvil, más chips de filtros activos. |
| **HelpNote.tsx** | Caja de ayuda/tip inline reutilizable. |
| **InfoHint.tsx** | Ícono de ayuda contextual (ⓘ) que abre popover (desktop) o bottom sheet (móvil). |
| **KpiCard.tsx** | Tile de KPI estándar (título, valor, delta, tono, ícono), opcionalmente como link o botón de filtro. |
| **LandedCost.tsx** (`LandedCostBreakdown`) | Desglose de costo puesto en bodega (factura + flete + arancel + manejo) y su impacto en margen vs margen nominal. |
| **LogisticsPlan.tsx** | UI de plan de retiro/logística en 3 niveles: resumen de capacidad, optimizador de camiones (con visualización 3D + economía de flete), detalle por camión, alertas/sugerencias, comparador de escenarios. |
| **PriorityBadge.tsx** | `PriorityBadge` y `SeverityBadge`: mapean prioridad ("alta/media/baja") y severidad de alerta a pastillas de color. |
| **PurchaseProcessBar.tsx** | Barra de navegación horizontal de etapas del proceso de compra (pills enlazadas con contador), resalta la etapa activa. |
| **RecommendationBadge.tsx** | Badge que traduce el estado de recomendación a una etiqueta orientada a acción (ej. "Comprar urgente"). |
| **ReportSignalModal.tsx** | Modal "reportar señal" de venta en terreno: tipo de señal, búsqueda/alta de producto, canal/tienda, prioridad auto-sugerida, comentario, evidencia opcional. |
| **ScopeToggle.tsx** | Hook `useCategoryScope()` + control segmentado para acotar vistas de surtido a "mi cartera" vs "todas las categorías", persistido en `localStorage`. |
| **SeasonalityChart.tsx** | Gráficos SVG/flex sin dependencias: barras mensuales con línea de promedio, barras apiladas por canal, leyenda de canales. |
| **SignalDetail.tsx** | Panel de detalle completo de una señal de venta: badges, campos de solicitud (editables), evidencia, estadísticas, acciones de flujo de estado (avanzar/rechazar/convertir a OC), chat comprador↔vendedor, timeline. |
| **StateLegend.tsx** | Leyenda plegable de cada estado de recomendación en lenguaje de negocio. |
| **StatusBadge.tsx** | Dispatcher genérico de badges de estado, cubre 7 dominios (`recommendation`, `product`, `purchase`, `purchaseOrder`, `supplier`, `category`, `alert`) vía una sola API `{kind, value, dot?}`. |
| **SupplierOrderCoach.tsx** | Panel de coaching dentro del borrador de OC: aviso de fecha límite, progreso de mínimo del proveedor, candidatos de consolidación. |
| **TruckLoad3D.tsx** | Visualización isométrica 3D pura CSS de % de llenado de un camión (cajas apiladas dentro de un contenedor "de vidrio"). |
| **alertLabels.ts** | `ALERT_TYPE_LABELS`: mapa `AlertType` → etiqueta en español (16 tipos de alerta). |
| **campaignLabels.ts** | Etiquetas/tonos/orden de urgencia para canal, tipo/estado de oportunidad, canal promocional, estado de campaña creada. |
| **signalLabels.ts** | "Idioma" central del módulo de Señales de Ventas: mapas de tipo/canal/estado/prioridad + `suggestPriority()` (sugeridor de prioridad basado en reglas). |
| **statusInfo.ts** | Significado en lenguaje llano de cada estado/prioridad de recomendación (para leyendas/tooltips) + órdenes de urgencia. |
| **supplierMetricHelp.tsx** (`MetricHint`) | Contenido de `InfoHint` predefinido para KPIs de proveedor (cumplimiento, despacho, fill rate, lead time, OTIF, monto pendiente). |

---

## 3. Layout y navegación (`src/components/layout`, `src/layouts`)

### Armado del shell

```
main.tsx → BrowserRouter → App.tsx → AppRoutes.tsx
  (12 providers de contexto anidados, ver §4)
  → RequireAuth (gate de sesión) → AppLayout.tsx → <Outlet/> → página
```

`AppLayout.tsx` (`src/layouts/AppLayout.tsx`) es el shell: link de "saltar al contenido", `ScrollToHash`, `Sidebar` (desktop), `MobileNav` (menú móvil a pantalla completa, controlado por estado local `menuOpen`), columna flex con `AppHeader` + `<main><Outlet/></main>`, luego `MobileBottomNav` y `Toaster` como hermanos de `Sidebar`.

- **AppHeader.tsx**: barra superior delgada — marca (solo móvil; en desktop vive en `Sidebar`) + `TopbarActions` (de `Topbar.tsx`), más una fila de "sub-pestañas" con las vistas del módulo activo cuando tiene más de una.
- **Topbar.tsx** (`TopbarActions`): buscador global (⌘K/Ctrl+K o "/") sobre productos/proveedores/categorías/OC, `BackendStatus`, toggle de densidad, switch de rol Comprador/Líder, `NotificationCenter`, botón de borrador de OC con contador, selector de comprador (o nombre del líder) y menú de cuenta.
- **Sidebar.tsx** (desktop, `lg:flex`): riel de íconos por módulo (ancho fijo 4rem) + panel expandible con buscador de vistas, vistas principales/extra del módulo activo y accesos a "trabajo pendiente" (alertas, aprobaciones, borrador OC). Atajo de teclado `[` abre/cierra el panel; se persiste en `localStorage`.

### `navItems.tsx`: módulos de navegación

Modelo de dos niveles: **módulo** (barra superior/sidebar) → **vistas** (sub-pestañas, `children`). Exporta:

- `compradorModules: NavModule[]` — **11 módulos**: `inicio` (/), `cartera` (/mi-cartera), `inventario` (/inventario), `plan-compra` (/comprar/decisiones), `negociaciones` (/comprar/cotizaciones), `ordenes` (/comprar/borradores), `entregas` (/comprar/plan-retiro), `proveedores` (/proveedores), `temporadas` (/temporadas), `analisis` (/analisis-compra), `config` (/reglas).
- `liderExtraModules: NavModule[]` — 2 módulos extra solo para rol `"lider"`: `lider` (/equipo), `equipo` (/equipo/compradores).
- `modulesFor(role)` — retorna `compradorModules`, o ambos arrays combinados si `role === "lider"`.
- `isPathActive(pathname, to, end?)`, `activeModuleFor(modules, pathname)` — helpers de matching de ruta activa.
- `navItems: NavItem[]` — lista plana deduplicada de todas las vistas (para títulos de ruta, recientes, etc.).
- Tipos: `NavItem`, `NavModule`, `NavBadgeKey = "alertas" | "aprobaciones" | "senales" | "equipoAlertas"`.

### Mobile: `MobileNav` vs `MobileBottomNav`

Ambos cambian en el breakpoint Tailwind `lg:` (1024px). `MobileBottomNav` es una barra fija de 5 pestañas siempre visible (Inicio, Cartera, Comprar, Inventario + botón "Más"). `MobileNav` es el menú completo a pantalla, mostrado solo cuando `menuOpen === true` (activado por el botón "Más"): buscador, tabs del módulo actual, tabs secundarias, grilla de cambio de módulo, badges.

### `RoleGate.tsx`

`RoleGate({allow: Role, children})`: si `role !== allow`, renderiza un `EmptyState` ("Sección del Líder de Compras") con botón "Volver al inicio" en vez de `children`. Usado a nivel de ruta en `AppRoutes.tsx` en las 6 rutas `/equipo*` (todas con `allow="lider"`).

### `useNavBadges.ts`

Combina `usePurchaseFlow().pendingApprovalsCount`, `useSignals().signals`, más los arrays estáticos `data/mockAlerts.ts` y `data/mockLeaderAlerts.ts`, en `Record<NavBadgeKey, {count, tone}>`. Nota: los badges `alertas` y `equipoAlertas` se calculan desde mocks estáticos (no reflejan cambios en tiempo de ejecución); solo `aprobaciones` y `senales` son dinámicos vía contexto.

### `NotificationCenter.tsx`

Campana + dropdown (desktop) / panel a pantalla completa vía `createPortal` (móvil), leyendo `useNotifications()` de `NotificationContext`. Las notificaciones son **derivadas** (no las crea el usuario) — ver §4.

### `BackendStatus.tsx`

Lee `useDataSource().source` de `DataContext` y muestra una pastilla: "API conectada" / "Conectando…" / "Modo demo", con tooltip mostrando `apiBase` o aviso de "sin backend configurado".

---

## 4. Contextos — estado global (`src/context`)

12 providers, todos anidados en `AppRoutes.tsx` (orden fijo, sin dependencias funcionales entre ellos — ver §Hallazgos). Casi todos persisten con el hook compartido `useLocalStorage` (§5/§7).

| Contexto | Qué guarda | Clave `localStorage` | Nota |
|---|---|---|---|
| **AuthContext** | `{authenticated, email}`; `login(email)`, `logout()` | `compras:auth` | Auth simulada (cualquier email inicia sesión). |
| **BuyerContext** | Comprador actual, lista de `buyers` (derivada de `mockCategories`), `myCategories` | `compras:buyer` | Define el "scope" de datos propios en muchas páginas. |
| **ClaimsContext** | `SupplierClaim[]`; `addClaim`, `updateClaim`, `openClaims`, `forSupplier(name)`, `exists(poNumber, sku)` | `compras:claims` | ID propio: `` `CLM-${Date.now()}-${Math.random()...}` ``. |
| **DataContext** | `{source: "backend"\|"mock"\|"loading", ready, cache}`; hidrata desde API si `VITE_API_URL`, si no usa mock | *(sin persistencia — en memoria)* | Expone `useCollection<T>(name, fallback)` y `useDataSource()`. |
| **DensityContext** | `density: "comodo"\|"compacto"`; `compact`, `toggle()`, `setDensity()` | `compras:density` | Consumido por `Card`, `PageHeader`, `Table`, `KpiCard`, `Topbar`. |
| **NotificationContext** | `AppNotification[]` derivadas de `alertService`/`signalService`/`purchaseOrderService`; solo persiste qué IDs están leídas | `compras:notif-read` | Consumidor único: `NotificationCenter.tsx`. |
| **OcDraftContext** | Ítems del borrador de OC (`OcDraftItem[]`) + metadatos de cabecera; `add/update/remove/clear/hasItem`, totales calculados | `compras:oc-draft` y `compras:oc-draft-meta` | Muy usado (17 archivos): `Topbar` (contador), `Sidebar` (pendientes), muchas páginas de compra. |
| **PurchaseFlowContext** | Aprobaciones/decisiones creadas fusionadas con seed, mapa `approvalState`, `observations`; `addApproval`, `addDecision`, `setApprovalState` | `compras:approvals-created`, `compras:decisions-created`, `compras:approvals`, `compras:approval-notes` (4 claves) | Consumido por `useNavBadges` (badge `aprobaciones`), `ApprovalsPage`, `DecisionsPage`, `PurchaseOrdersPage`. |
| **RoleContext** | `role: "comprador"\|"lider"`, `setRole`, `persona` | `compras:role` | Define qué módulos/rutas se ven (ver §3). |
| **SignalsContext** | Señales de venta: seed base + overlay `{patches, extraMessages, extraEvents}` sobre creadas; `addSignal`, `setStatus`, `assign`, `setPriority`, `reject`, `updateRequest`, `addMessage`, `markConverted` | `compras:signals` (un solo objeto) | ID propio: `uid()` con `Date.now().toString(36)` + contador `seq` incremental. |
| **ToastContext** | `Toast[]` efímeros (no persistidos); `show/success/info/warning/error`, `dismiss` | *(ninguna — correcto, son transitorios)* | El contexto más consumido (32 archivos). |
| **TraceContext** | Bitácora de auditoría `TraceEntry[]` (quién/qué/cuándo/antes→después/por qué), sembrada con 3 ejemplos; `log(entry)` | `compras:trace` | Ver §7 (convención `useTrace().log`). |

Otras claves de `localStorage` fuera de `context/`: `compras:sidebar-panel-open` (`Sidebar.tsx`), `` compras:section:${id} `` (`CollapsibleSection.tsx`), `compras:campaigns` (`CatalogRedundancy.tsx`), y la clave de scope en `ScopeToggle.tsx`. Todas pasan por el mismo hook `useLocalStorage` — no hay reimplementaciones directas de `localStorage.getItem/setItem`.

**Orden de anidamiento** en `AppRoutes.tsx` (de afuera hacia adentro): `AuthProvider` → `ToastProvider` → `DensityProvider` → `DataProvider` → `RoleProvider` → `BuyerProvider` → `NotificationProvider` → `OcDraftProvider` → `PurchaseFlowProvider` → `ClaimsProvider` → `TraceProvider` → `SignalsProvider` → `<Routes>`.

---

## 5. Utilidades (`src/utils`)

| Archivo | Responsabilidad |
|---|---|
| `assortment.ts` | Rol estratégico de categoría, penetración de marca propia, cobertura por cluster de tiendas, altas/salidas de catálogo. |
| `buyScenarios.ts` | Genera 3 escenarios de compra (conservador/recomendado/volumen) con inversión, cobertura y riesgo. |
| `buyerAttribution.ts` | Atribuye causa de quiebres (comprador/proveedor/demanda) de forma determinista por hash. |
| `buyingAlerts.ts` | Alertas contextuales antes de agregar cantidad a una OC (meses de inventario, OC duplicada, proveedor atrasado, capacidad de bodega). |
| `calculations.ts` | Cálculos núcleo: cantidad sugerida, días de cobertura, frase de cobertura, suma de días ISO, fecha de quiebre, capital congelado. |
| `catalogOptimization.ts` | Detecta redundancia de catálogo, sugiere "keepers" y candidatos a liquidar/descontinuar. |
| `channelDemand.ts` | Descompone demanda mensual por canal (tienda/ecommerce/marketplace/empresa/licitaciones). |
| `cn.ts` | Concatenación condicional de clases Tailwind (`cn`). |
| `constants.ts` | Un único valor: `TODAY_ISO` (fecha "hoy" fija de la demo). |
| `dateRange.ts` | Conversión ISO↔Date, atajos de rango de fechas, etiqueta legible de rango, chequeo de pertenencia. |
| `decisionEval.ts` | Evalúa una decisión de compra ya ejecutada vs lo planeado (desviación, error de pronóstico, éxito). |
| `entityLinks.ts` | Resuelve nombre→ruta de detalle para proveedor/categoría/producto, con fallback seguro a la lista. |
| `exportCsv.ts` | Exportación a CSV compatible Excel es-CL (separador `;`, BOM UTF-8). |
| `filters.ts` | Filtros reutilizables de productos/recomendaciones/alertas y extracción de valores únicos para selects. |
| `formatters.ts` | Formato chileno: CLP, CLP compacto, fecha dd/mm/aaaa, porcentaje, número, variación con signo, días, etiqueta de producto, capitalize. |
| `hash.ts` | Hash determinista string→entero (djb2/31) para datos de demo estables. |
| `importCost.ts` | Costo puesto en bodega de una importación completa (FOB→CLP, arancel, flete, portuarios, terrestre, aduana). |
| `landedCost.ts` | Costo puesto en bodega por unidad de producto y margen nominal vs real. |
| `logistics.ts` | Motor de simulación de retiro: bin-packing de camiones, plan de retiro, economía de flete, alertas, comparador de escenarios. |
| `lostOpportunities.ts` | Detecta venta perdida no capturada (SKU que vendía y dejó de comprarse). |
| `negotiation.ts` | Inteligencia de negociación por producto: waterfall de costo, historial, calidad del proveedor, sustitutos. |
| `openToBuy.ts` | Open-to-Buy por categoría: presupuesto − comprometido − borrador en curso, detección de sobregiro. |
| `orderConsolidation.ts` | Coach de consolidación de OC: mínimo de proveedor, candidatos a sumar, fecha límite, venta en riesgo. |
| `paramHealth.ts` | Diagnóstico de reglas de reposición mal configuradas. |
| `purchaseQuality.ts` | Clasifica líneas de OC histórica (corta/saludable/alta/sobrecompra/sin venta). |
| `recommendationReasoning.ts` | Descompone la cantidad recomendada en factores explicables que suman exactamente la sugerencia. |
| `seasonPlan.ts` | Planificador de demanda estacional multi-origen por SKU y resumen ejecutivo de temporada. |
| `seasonTracking.ts` | Seguimiento de ejecución de temporada vs plan, alertas y acciones de replanificación. |
| `seasonality.ts` | Inteligencia estacional del proveedor (24 meses simulados, score, clasificación, YoY). |
| `skuProfile.ts` | Clasificación ABC (peso en venta) y XYZ (predictibilidad) por SKU. |
| `supplierPerf.ts` | Rendimiento de despacho del proveedor calculado desde recepciones. |
| `supplierScore.ts` | Evaluación/clasificación de proveedor combinando OTIF, gap de lead time y reclamos. |
| `teamScore.ts` | Helpers de score/tendencia/carga del equipo: labels, tonos, ligas, badges, OKR, rankings. |
| `tone.ts` | Fuente única de clases Tailwind por tono semántico: `PILL_TONE`, `DOT_TONE`, `VALUE_TONE`, `CHANNEL_BG`. |
| `useDialogA11y.ts` | Hook de accesibilidad compartido para diálogos (Escape, focus trap, restaura foco). |
| `useLocalStorage.ts` | Hook de persistencia sincronizada en `localStorage`. |
| `useUrlState.ts` | Sincroniza un filtro (texto o booleano) con el query string de la URL. |

---

## 6. Datos mock (`src/data`)

34 archivos `mock*.ts` + `logistics.ts`, agrupados por dominio:

- **Compras/Órdenes**: `mockPurchaseOrders.ts`, `mockOcHistory.ts`, `mockReceptions.ts`, `mockDocuments.ts`, `mockApprovals.ts`, `mockBudgets.ts`, `mockRules.ts`, `mockDecisions.ts`.
- **Proveedores**: `mockSuppliers.ts`, `mockNegotiations.ts`, `mockRfq.ts`, `mockPriceLists.ts`, `mockClaims.ts`.
- **Catálogo/Productos**: `mockProducts.ts`, `mockCategories.ts`, `mockInventory.ts`, `mockNpi.ts`.
- **Importaciones/Logística**: `mockImports.ts`, `logistics.ts` (camiones, perfiles logísticos por categoría/SKU, centros de retiro).
- **Equipo/Compradores**: `mockBuyers.ts`, `mockChallenges.ts`, `mockRewards.ts`, `mockLeaderAlerts.ts`.
- **Comercial/Campañas**: `mockCampaignOpportunities.ts`, `mockCampaignPerformance.ts`, `mockCampaignPlans.ts`, `mockChannelMargin.ts`, `mockCompetitionFeed.ts`.
- **Ventas/Demanda/Alertas**: `mockSales.ts`, `mockSignals.ts`, `mockSeasonHistory.ts`, `mockSeasons.ts`, `mockAlerts.ts`.
- **Infraestructura**: `mockWarehouses.ts`.

---

## 7. Convenciones de código

- **Bitácora/auditoría**: cualquier cambio significativo (regla, reclamo, decisión) debe registrarse con `useTrace().log({entity, action, field?, before?, after?, reason?})` (`src/context/TraceContext.tsx`). Se persiste en `compras:trace` y alimenta el módulo de Gobierno.
- **Formato de moneda/fecha/número**: siempre usar `src/utils/formatters.ts` (`formatCurrency`, `formatCurrencyCompact`, `formatDate`, `formatPercent`, `formatNumber`, `formatDelta`, `formatDays`, `productLabel`) — nunca formatear CLP o fechas a mano con `toLocaleString`/concatenación. `formatCurrency` usa `Intl.NumberFormat("es-CL", {style:"currency", currency:"CLP"})`; fechas en formato dd/mm/aaaa desde ISO aaaa-mm-dd.
- **Navegación entre entidades**: usar `src/utils/entityLinks.ts` (`supplierPath`, `categoryPath`, `productPath`) para construir el link de detalle a partir de un nombre/SKU, en vez de armar la ruta a mano — resuelve el id y cae de forma segura al listado si no encuentra coincidencia (nunca a un 404).
- **Persistencia en `localStorage`**: todo estado que debe sobrevivir un refresh pasa por `useLocalStorage<T>(key, initial)` (`src/utils/useLocalStorage.ts`), con prefijo de clave `compras:`. El hook no soporta un inicializador perezoso (`() => T`) — `initial` se evalúa en cada render aunque solo se use en el primer montaje.
- **Tono semántico centralizado**: `src/utils/tone.ts` (`PILL_TONE`, `DOT_TONE`, `VALUE_TONE`, `CHANNEL_BG`) es la fuente única de clases Tailwind por tono (`red`/`amber`/`green`/etc.) para pastillas, puntos y chips de canal — se importa en `Sidebar`, `AppHeader`, `MobileNav`, entre otros.
- **Diálogos accesibles**: `Modal`, `Drawer` y `BottomSheet` comparten `useDialogA11y` (Escape, focus trap, restauración de foco) — cualquier overlay nuevo con semántica de diálogo debería reutilizarlo en vez de reimplementar cierre por click-fuera a mano.
- **Fuente de módulos/rutas**: `navItems.tsx` (`compradorModules`, `liderExtraModules`, `modulesFor(role)`) es la fuente de verdad de qué módulos/vistas existen y con qué rol se ven; `AppRoutes.tsx` debe mantenerse en sincronía manualmente (no hay generación automática, ver hallazgos).
- **Densidad de UI**: `useDensity()` (`compact: boolean`) controla padding/tipografía en `Card`, `PageHeader`, `Table`, `KpiCard`, `Topbar` — nuevos componentes de listado/ficha deberían respetarlo si conviven con vistas densas.
- **CSV**: exportar datos tabulares con `src/utils/exportCsv.ts` (`exportToCsv`), que ya resuelve separador `;` y BOM UTF-8 para que Excel en configuración regional chilena lo abra bien — no generar CSV a mano.
