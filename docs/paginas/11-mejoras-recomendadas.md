# Limpieza de código y deuda técnica

Resultado de la revisión del código archivo por archivo. El proyecto ya compila
en modo `strict` con `noUnusedLocals`/`noUnusedParameters`, por lo que **no hay
imports ni variables sin usar** — esa clase de limpieza está garantizada por el
compilador. La revisión se enfocó en lo que el compilador no detecta:
**duplicación**, **código muerto**, **constantes mágicas** y **componentes
demasiado grandes**.

Criterio de aplicación: en esta pasada solo se aplicaron cambios **seguros y que
no alteran el comportamiento** (reutilizar helpers idénticos, extraer constantes
con el mismo valor, eliminar código muerto verificado, colapsar mapas
byte-idénticos). Las mejoras que **cambiarían la salida visual** o implican
**refactors grandes** se documentan abajo como recomendación, sin aplicarlas,
para no arriesgar regresiones en la app desplegada.

---

## 1. Aplicado en esta pasada (seguro, sin cambio de comportamiento)

### Código muerto eliminado (verificado con grep, cero referencias)
- `src/utils/skuProfile.ts` — se eliminó `ABC_TONE` (exportado, nunca importado).
- `src/context/DensityContext.tsx` — se eliminó el helper `dc()` (sin llamadas).
- `src/pages/reports/csv.ts` — se eliminó un comentario huérfano al final del archivo.

### Reutilización de helpers existentes (salida idéntica)
- `src/utils/buyingAlerts.ts` — `fmtNum()` local → `formatNumber` de `formatters.ts`.
- `src/pages/ApprovalsPage.tsx` y `src/pages/DecisionsPage.tsx` — `fmtDate()` local
  (`iso.split("-").reverse().join("/")`) → `formatDate` de `formatters.ts`.
- `src/components/layout/AppHeader.tsx` y `src/components/layout/MobileNav.tsx` —
  el predicado inline "¿ruta hija activa?" → `isPathActive()` de `navItems.tsx`
  (el guard `to !== "/"` era redundante: `startsWith("//")` nunca coincide).

### Constantes con nombre (mismo valor, extraído a un solo lugar)
- `src/utils/constants.ts` — nuevas `DEFAULT_TARGET_COVERAGE_DAYS = 45` y
  `SUPPLIER_PENDING_WARN_CLP = 20_000_000`.
- `DEFAULT_TARGET_COVERAGE_DAYS` cableada en `utils/purchaseQuality.ts` y
  `utils/paramHealth.ts` (ambas usaban el literal `45` como "días objetivo por defecto").
- `SUPPLIER_PENDING_WARN_CLP` cableada en `SuppliersPage.tsx` y `SupplierDetailPage.tsx`.
- `src/utils/filters.ts` — el literal `20` (margen bajo) en dos predicados →
  `LOW_MARGIN_THRESHOLD` (ya exportada por `data/mockPriceLists.ts`).

### Colapso de mapas idénticos
- `src/components/business/PriorityBadge.tsx` — `priorityConfig` y `severityConfig`
  eran byte-idénticos; se unificaron en un único `levelConfig`.

### Accesibilidad
- `src/components/ui/Table.tsx` — la fila clicable de escritorio solo respondía a
  Enter; ahora también a Space, igual que la mobile-card (rol `button` consistente).

### Segunda pasada — consolidación interna (sin cambio visual)
- **Arrays de estado a constantes compartidas**:
  - `EMITTED_STATUSES` (módulo en `PurchaseOrdersPage.tsx`) reemplaza el literal
    `["sent","confirmed","partially_received","with_difference"]` repetido 3 veces.
  - `CLOSED_ORDER_STATUSES` (en `types/purchasing.ts`) reemplaza
    `["received","closed","cancelled"]` en `PurchaseOrdersPage` y `DraftLineContext`.
  - `ARRIVED_STATUSES` (en `data/mockReceptions.ts`) reemplaza el `ARRIVED` local
    duplicado en `ReceptionsPage` y `utils/supplierPerf` (se elimina un import de
    tipo `Reception` que quedó sin uso).
- **`genId(prefix)`** (`utils/genId.ts`): un solo generador de IDs para runtime;
  reemplaza las expresiones inline en `ClaimsContext` y `TraceContext`.
- **`makeToggleSort` + `SortState` compartidos** (`components/ui/Table.tsx`): se
  centraliza el handler de orden por columna; `reports/definitions.ts` lo reexporta
  y `PurchaseAnalysisPage`, `CampaignOpportunitiesPage` y `CampaignPerformance`
  dejan de reimplementar `toggleSort`/`handleSort`/`cycleSort` (este último además
  reemplaza su tipo de estado inline por `SortState`).

### Tercera pasada — constantes y helpers internos (sin cambio visual)
- **Umbrales de proveedor a constantes** (`utils/constants.ts`): `SUPPLIER_COMPLIANCE_CRITICAL`
  (70), `SUPPLIER_COMPLIANCE_WARN` (85) y `SUPPLIER_LEAD_TIME_WARN_DAYS` (15) reemplazan
  los literales repetidos en `SuppliersPage`, `SupplierDetailPage` y `SupplierNegotiation`
  (mismos valores; se dejan aparte `otif < 85` y `fillRate < 80`, que son otras métricas).
- **`projectedCoverageDays()`** (`replenishment/helpers.ts`): unifica la fórmula de
  cobertura proyectada repetida en 3 sitios de `replenishment/components.tsx`.
- **`stockCapital()`** local en `InventoryAnalysisPage`: reemplaza el cálculo
  `availableStock × cost` repetido 4 veces (distinto de `frozenCapital`, que es el
  excedente sobre el máximo).

---

## 2. Recomendado — cambia salida visual (documentado, no aplicado)

Estos casos son duplicación real, pero unificarlos alteraría números o estilos
visibles; requieren decisión de producto antes de tocarlos.

- **Umbral de "margen bajo" divergente**: se usa `20` (`filters.ts`, ya unificado),
  `25` (`ProductsPage`, `replenishment/helpers.ts`) y `28` (`CategoriesPage`) para
  el mismo concepto de coloreo. Unificar a un solo valor cambiaría colores en varias
  pantallas. Decidir el valor canónico y aplicarlo.
- **`GStat` vs `ScoreStat`** (`supplierDetail/GStat.tsx` y `SupplierDetailPage.tsx`):
  mismo propósito pero estilos distintos (fondo `bg-slate-50` vs borde, `text-lg` vs
  `text-base`). Unificar requiere elegir un estilo.
- **Sets de etiquetas de estado** (`StatusBadge`, `statusInfo.ts`, `RecommendationBadge`):
  tres redacciones distintas para los mismos `RecommendationStatus` (p. ej. "Crítico"
  vs "Comprar urgente"). Definir un set canónico.

---

## 3. Recomendado — refactors de tamaño (documentado, no aplicado)

Componentes de más de ~600 líneas que convendría descomponer (patrón ya usado en
el repo con subcomponentes/`*Sections.tsx`). No se hicieron para no arriesgar
regresiones en una sola pasada; abordar de a uno con verificación visual:

| Archivo | Líneas aprox. | Sugerencia |
|---|---|---|
| `pages/MyPanelPage.tsx` | 1821 | Extraer secciones de la portada a subcomponentes. |
| `pages/PurchaseOrdersPage.tsx` | 1329 | Extraer `createOrder` (agrupación + criterios + build) y el body del Drawer. |
| `pages/CampaignsPage.tsx` | 1154 | Extraer los dos modales (producto y campaña). |
| `pages/ReportsPage.tsx` | 1112 | Mover las 8 definiciones de columnas a `reports/columns.ts`. |
| `pages/PriceIncreasesPage.tsx` | 674 | Extraer selector de lista, tarjeta resumen y modal de carga. |
| `pages/productDetail/components.tsx` (`NegotiationPanel`) | ~590 | Un subcomponente por tarjeta. |
| `pages/SupplierDetailPage.tsx` | 769 | Extraer los tab-bodies inline (catálogo/órdenes/recepciones/alertas). |
| `pages/replenishment/components.tsx` (`RecommendationDecisionDrawer`) | ~380 | Mover cálculos a un hook; dejar el componente presentacional. |

---

## 4. Recomendado — duplicación menor y constantes mágicas (documentado)

Extraíbles a helper/constante compartida cuando se retome cada módulo:

- **Micro-componentes de "stat/field"** repetidos: `MiniField`/`DField`
  (`NewProductsPage`), `MiniStat`/`NStat` (`productDetail`, `seasonPlanner`),
  avatar de comprador (8 usos en `Buyers`/`Workload`/`TeamDashboard`/`Goals`),
  `SeasonBanner` (`RankingPage` y `MyPerformancePage`). Extraer componentes
  compartidos (`<BuyerAvatar>`, `<SeasonBanner>`, `<StatBox>`).
- **`actor: "Catalina Saavedra"` hardcodeado** al registrar en la bitácora
  (`ProductDetailPage`, `NewProductsPage`, `ClaimsPage`, `SupplierNegotiationRecord`,
  y ~23 archivos más): leer el comprador actual desde `useBuyer()`.
- **Fechas hardcodeadas** en vez de `TODAY_ISO`/derivadas: `ClaimsPage`
  (`new Date().toISOString()`), `SupplierTermsAgreements` (`"2026-06-26"`),
  `ProductsPage` (`"2026-04-01"`), `RfqPage` (`"2026-07-08"` y el año `"2026"` en
  la generación de IDs).
- ~~**Generación de IDs** duplicada~~ ✓ aplicado (`genId` en `utils/genId.ts`).
  Queda `SignalsContext` con su propia estrategia `uid()` (secuencial): se deja
  como está para no cambiar el formato de sus IDs.
- ~~**Lógica de orden de sort** reimplementada~~ ✓ aplicado (`makeToggleSort` +
  `SortState` compartidos desde `Table.tsx`).
- **Fórmulas de cobertura/riesgo** en `replenishment/components.tsx`: cobertura
  proyectada ✓ aplicado (`projectedCoverageDays`). Queda el "riesgo de quiebre" (×5):
  no se unificó porque los sitios difieren (algunos 3 niveles ≤lead/≤2×lead con tonos,
  otros 2 niveles) y producen salidas visibles distintas.
- ~~**Umbrales de proveedor** repetidos como literales~~ ✓ aplicado
  (`SUPPLIER_COMPLIANCE_CRITICAL`/`WARN`, `SUPPLIER_LEAD_TIME_WARN_DAYS`).
- ~~**Colisión de nombre `CHANNEL_META`**~~ ✓ aplicado: el de `data/mockCampaignPlans.ts`
  (canales de promo) se renombró a `PROMO_CHANNEL_META`; el de `utils/channelDemand.ts`
  (canales de demanda) queda como `CHANNEL_META`. Ya no colisionan.
- ~~**Arrays de estado** duplicados~~ ✓ aplicado (`CLOSED_ORDER_STATUSES`,
  `ARRIVED_STATUSES`, `EMITTED_STATUSES`).
- **Markup de diálogos** (header/footer) casi idéntico en `Modal`/`Drawer`/`BottomSheet`:
  extraer `DialogHeader`/`DialogFooter`. `FieldLabel`/`useFieldId` para `Input`/`Select`.
- ~~**`useClickOutside`** para `MoreActions`/`DateRangePicker`~~ ✓ aplicado
  (`utils/useClickOutside.ts`; el callback se lee desde un ref para conservar las
  mismas dependencias `[active]` del efecto original — cierre por clic-fuera/Escape idéntico).

---

## 5. Observaciones de consistencia (no bugs, revisar con producto)

- ~~`SettingsPage` — la edición manual de una regla **no** registra en la bitácora~~
  ✓ aplicado: `onSave` ahora compara la regla original vs la editada y registra en la
  bitácora cada parámetro cambiado (`targetInventoryDays`/`minStock`/`maxStock`/`minMargin`/
  `leadTimeDays`/`notes`), igual que el auto-fix (acción "Editó parámetro").
- `PurchaseOrdersPage` — los umbrales de aprobación en `createOrder`
  (`>= $5M`, cobertura `> obj×1.3`) no coinciden con el texto de política en
  `GovernancePage` ("OC sobre $10M", "> 90 días"). Unificar en constantes compartidas.
- `MobileBottomNav` y `AppRoutes`/`navItems` mantienen listas de navegación por
  separado: pueden divergir. Centralizar la fuente de verdad de rutas.
