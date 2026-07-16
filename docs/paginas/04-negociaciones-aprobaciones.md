# Negociaciones y aprobaciones

Documentación técnica de las páginas de cotización a proveedores, gestión de alzas de precio, auditoría de decisiones de compra y aprobaciones de compras fuera de criterio.

## Tabla de contenidos

- [Cotizaciones — `RfqPage`](#cotizaciones--rfqpage)
- [Alzas de precio — `PriceIncreasesPage`](#alzas-de-precio--priceincreasespage)
- [Historial de decisiones — `DecisionsPage`](#historial-de-decisiones--decisionspage)
- [Aprobaciones de compra — `ApprovalsPage`](#aprobaciones-de-compra--approvalspage)

---

## Cotizaciones — `RfqPage`

### Ruta y archivo

- Archivo: `src/pages/RfqPage.tsx`
- Rutas (`src/routes/AppRoutes.tsx`): `/cotizaciones` y `/comprar/cotizaciones` (ambas apuntan al mismo componente lazy `RfqPage`).

### Propósito

Gestiona el ciclo de vida de las cotizaciones (RFQ, *Request for Quotation*) a proveedores: creación, seguimiento del estado, comparación lado a lado de las ofertas recibidas por línea y conversión de la mejor oferta en un borrador de orden de compra (OC).

### Fuentes de datos

- `src/data/mockRfq.ts`: semillas `rfqs`, tipos `Rfq`/`RfqLine`/`RfqResponse`/`RfqStatus`, helpers `pickBestForLine` y `respondedSupplierCount`, y los mapas `RFQ_STATUS_LABELS`/`RFQ_STATUS_TONE`.
- `src/data/mockProducts.ts`: catálogo `products`, usado para buscar/seleccionar productos al crear una RFQ.
- `src/data/mockSuppliers.ts`: catálogo `suppliers`, usado para invitar proveedores al crear una RFQ.
- `src/context/OcDraftContext.ts` (`useOcDraft`): `addItem` para agregar líneas ganadoras al borrador de OC al convertir.
- `src/context/ToastContext.tsx` (`useToast`): notificaciones de éxito/información tras crear, cambiar de estado o convertir una RFQ.
- `src/context/BuyerContext.tsx` (`useBuyer`): nombre del comprador activo, usado como `comprador` de la RFQ creada.
- `src/utils/useLocalStorage.ts`: persistencia de RFQs creadas y de overrides de estado.
- `src/utils/constants.ts`: `TODAY_ISO`, fecha de creación de nuevas RFQs.
- `src/utils/formatters.ts`: `formatCurrency`, `formatDate`, `formatDays`, `formatNumber`.

### Estado y navegación

- `useLocalStorage<Rfq[]>("compras:rfq", [])` — `createdRfqs`: RFQs creadas por el usuario en esta sesión/dispositivo.
- `useLocalStorage<Record<string, RfqStatus>>("compras:rfq-status", {})` — `statusOverrides`: cambios de estado aplicados sobre las RFQs (tanto semillas como creadas), indexados por `id`.
- `useState("todas")` — `tab`: pestaña activa (`todas`, `borrador`, `enviadas`, `respondidas`, `negociacion`, `aprobadas`), definida en el arreglo constante `TABS`, cada una asociada a un subconjunto de `RfqStatus`.
- `useState(false)` — `createOpen`: visibilidad del modal de creación.
- `useState<string | null>(null)` — `detailId`: id de la RFQ mostrada en el drawer de comparación (`null` = cerrado).
- Navegación: `useNavigate()` se usa en la acción del toast tras convertir una RFQ, para llevar al usuario a `/comprar/borradores` ("Ver borrador OC").
- La lista combinada (`all`) mezcla `createdRfqs` primero y luego las semillas `seedRfqs`, aplicando `statusOverrides` por encima; se recalcula con `useMemo`.

### Estructura visual

- **KPIs** (`KpiCard`, grilla 2×4 en desktop): "Por responder" (enviada + respondida_parcial), "En negociación", "Por vencer (≤ 7 días)" (calculado con `daysUntil` local sobre estados abiertos), "Convertidas a OC". Los tres primeros son clicables y cambian la pestaña activa.
- **Tabs** (componente `Tabs`) con conteo por estado (`counts`, memoizado).
- **Tabla** (`DataTable`) de RFQs: columnas N° cotización/comprador, fecha/vencimiento (con aviso ámbar si vence en ≤ 7 días y el estado sigue abierto), cantidad de productos, cantidad de proveedores invitados/respondidos, badge de estado, acción "Comparar"/"Ver detalle". Incluye `mobileCard` para vista angosta.
- **Modal** `CreateRfqModal`: nombre/referencia opcional, buscador y selector múltiple de productos (checklist con chips de seleccionados), selector múltiple de proveedores (chips toggle), fecha de vencimiento.
- **Drawer** `ComparisonDrawer`: badges de proveedores invitados (verde si respondió), y por cada línea del RFQ una tabla comparativa (`LineComparison`) de las respuestas recibidas.

### Lógica de negocio clave

**Comparación de ofertas (`pickBestForLine`, en `mockRfq.ts`):** para cada línea, filtra solo las respuestas `disponible: true`; determina la más barata (`cheapest`, menor `costoUnitario`) y la más rápida (`fastest`, menor `plazoDias`). Si ambas corresponden a proveedores distintos, calcula la brecha de plazo (`plazoGap`) y el sobrecosto porcentual de la más rápida (`extraCostPct`); si el plazo se acorta en ≥ 5 días y el sobrecosto es de hasta un 8 %, genera un `tradeoffNote` de advertencia ("lo más barato no siempre es lo mejor"). `LineComparison` resalta la fila más barata con fondo verde y badge "Mejor precio", y la más rápida (si es un proveedor distinto) con badge "Más rápido".

**Estados y transiciones:** `RfqStatus` tiene 9 valores (`borrador` → `enviada` → `respondida_parcial`/`respondida` → `en_negociacion` → `aprobada` → `convertida`, más `rechazada`/`vencida` como terminales alternativos). Las transiciones manuales desde la UI son: "Marcar en negociación" (visible solo si `respondida`/`respondida_parcial`), "Aprobar" (visible si no está ya `aprobada`/`convertida` y tiene respuestas) y "Convertir a OC" (visible si el estado está en `APROBABLE = ["respondida", "respondida_parcial", "en_negociacion", "aprobada"]` y hay respuestas). Todas las transiciones se guardan en `statusOverrides` vía `setEstado`.

**Conversión a OC (`convertToOc`):** recorre cada línea de la RFQ, obtiene las respuestas de esa línea, toma la `cheapest` de `pickBestForLine`, y si existe agrega un ítem al borrador de OC con `quantity = max(qtyRequested, minimoCompra del proveedor)` y `unitCost = costoUnitario`. Al terminar marca la RFQ como `convertida` y cierra el drawer.

**Numeración de RFQs nuevas:** `handleSave` en `CreateRfqModal` arma un correlativo con `String(9 + existingCount).padStart(4, "0")` y construye `id`/`numero` con el prefijo fijo `RFQ-2026-`/`COT-2026-` (continúa la numeración de las 8 semillas existentes, que van de `0001` a `0008`).

### Subcomponentes definidos en el archivo

- `ComparisonDrawer` — drawer de comparación de ofertas de una RFQ, con acciones de negociar/aprobar/convertir según el estado.
- `LineComparison` — tabla comparativa de respuestas de proveedores para una línea de producto, con resaltado de mejor precio/plazo y nota de trade-off.
- `CreateRfqModal` — modal de creación de una nueva RFQ (selección de productos, proveedores y fecha de vencimiento).

---

## Alzas de precio — `PriceIncreasesPage`

### Ruta y archivo

- Archivo: `src/pages/PriceIncreasesPage.tsx`
- Ruta: `/alzas-precio`.

### Propósito

Recibe (simuladamente) listas de precios nuevas de un proveedor, compara el costo nuevo contra el vigente por producto, mide el impacto en margen y en el precio de venta sugerido, y permite aprobar o rechazar la lista completa.

### Fuentes de datos

- `src/data/mockPriceLists.ts`: semillas `PRICE_LISTS`, `SUPPLIERS_WITH_PRODUCTS`, `TARGET_MARGIN_BY_CATEGORY`, `LOW_MARGIN_THRESHOLD`, funciones `buildPriceListItems` y `summarizeList`, y los tipos `PriceList`/`PriceListItem`/`PriceListEstado`.
- `src/utils/entityLinks.ts`: `productPath`, `categoryPath`, `supplierPath` para enlazar cada ítem/lista a su ficha.
- `src/context/ToastContext.tsx` (`useToast`): confirmación al aprobar/rechazar/cargar una lista.
- `src/utils/useLocalStorage.ts`: persistencia de las listas (incluye estado de aprobación) bajo la clave `compras:price-lists`.
- `src/utils/filters.ts`: `uniqueValues`, para construir las opciones de categoría del filtro.
- `src/utils/formatters.ts`: `formatCurrency`, `formatPercent`, `formatDelta`, `formatDate`.

### Estado y navegación

- `useLocalStorage<PriceList[]>("compras:price-lists", PRICE_LISTS)` — `lists`: única fuente de verdad de las listas (semillas + cargadas), con su `estado` (`pendiente`/`aprobada`/`rechazada`) persistido.
- `useState(lists[0]?.id ?? "")` — `selId`: id de la lista seleccionada actualmente (selector tipo "cards", no es un componente `Tabs`).
- `useState("")` — `query`: texto de búsqueda (SKU/nombre) sobre los ítems de la lista activa.
- `useState("")` — `category`: filtro de categoría.
- `useState("")` — `tipo`: filtro de tipo de cambio (`"alza" | "baja" | "margen-bajo"`, valores de string sin enum dedicado).
- `useState({ key: "alzaPct", dir: "desc" })` — `sort`: orden de la tabla de ítems (ciclado por `cycleSort`).
- `useState(false)` / `useState(SUPPLIERS_WITH_PRODUCTS[0] ?? "")` / `useState("8")` — `uploadOpen`, `upProveedor`, `upAlza`: estado del modal de carga simulada de una nueva lista.
- No usa `useUrlState`: los filtros no se reflejan en la URL (a diferencia de `DecisionsPage`).

### Estructura visual

- **KPIs** (`KpiCard`, grilla 2×4): "Listas pendientes", "Productos afectados" (suma de ítems de listas pendientes), "Alza promedio" (global, sobre listas pendientes), "Margen bajo (<20%)" (constante `LOW_MARGIN_THRESHOLD`).
- **Selector de listas**: fila de tarjetas-botón (no usa el componente `Tabs`) con proveedor, badge de estado y cantidad de productos por lista.
- **Card resumen** de la lista activa: proveedor (enlazado), badge de estado, id, vigencia, y 5 métricas (`summarizeList`): productos, alza promedio, alzas/bajas, impacto en margen (pts), cantidad con margen bajo.
- **`FilterBar`**: buscador + selects de categoría y tipo de cambio.
- **Tabla** (`DataTable`) de ítems: producto (enlazado a ficha y categoría), costo actual → nuevo con badge de alza/baja, margen actual → nuevo (resaltado rojo si queda bajo el umbral), precio de venta sugerido. Filas con margen bajo llevan fondo rosado (`rowClassName`). Incluye `mobileCard`.
- **Card de acciones**: mensaje contextual según estado + botones "Rechazar"/"Aprobar alza" (si `pendiente`) o "Volver a pendiente" (si ya decidida).
- **Modal** de carga de lista: selects de proveedor y alza base (`ALZA_OPTIONS`), con vista previa en vivo (`buildPriceListItems` + `summarizeList`) antes de confirmar.
- **`EmptyState`** cuando no hay listas o no hay productos del proveedor elegido en el catálogo.

### Lógica de negocio clave

**Derivación de costo/margen (`mockPriceLists.ts`, usada por la página):** cada ítem de lista deriva `costoNuevo` del `costoActual` del catálogo aplicando un delta % determinista; el `margenNuevoPct` asume que el **precio de venta no cambia**, por lo que un alza de costo erosiona directamente el margen. El `precioVentaSugerido` se calcula para sostener el margen objetivo de la categoría (`TARGET_MARGIN_BY_CATEGORY`, con 25 % de default vía `targetFor`).

**Aprobación/rechazo (`setEstado`):** cambia el `estado` de la lista completa (no por ítem) entre `pendiente`/`aprobada`/`rechazada`, actualizando el array `lists` en localStorage y disparando un toast distinto según el nuevo estado. Es una simulación: el comentario del código aclara que en producción esto actualizaría el costo del catálogo y notificaría a precios/catálogo.

**Carga simulada (`handleUpload`):** genera una nueva `PriceList` con id `PL-DEMO-${lists.length + 1}`, tomando los productos del proveedor elegido y aplicando la alza base seleccionada (`ALZA_OPTIONS`, valores fijos de referencia: 4 %, 8 %, 12 %, −3 %) a través de `buildPriceListItems`, que además le suma un patrón determinista de variación por posición de producto (definido en `mockPriceLists.ts`) para simular que no todos los productos suben igual.

### Subcomponentes definidos en el archivo

Ninguno: toda la UI (selector de listas, resumen, tabla, modal de carga) está inline dentro de la función `PriceIncreasesPage`; solo se definen funciones auxiliares no-componente (`targetFor`, y `columns`/`mobileCard` como variables locales con JSX).

---

## Historial de decisiones — `DecisionsPage`

### Ruta y archivo

- Archivo: `src/pages/DecisionsPage.tsx`
- No tiene ruta propia directa: `/decisiones` redirige (`Navigate replace`) a `/aprendizaje?tab=decisiones`. `DecisionsPage` se renderiza embebida por `src/pages/AprendizajePage.tsx` cuando la sub-pestaña `tab=decisiones` está activa (prop `embedded` oculta el `PageHeader` propio y usa el de `AprendizajePage`). La otra sub-pestaña de `AprendizajePage` ("Calidad de compra") es `PurchaseQualityPage`, un archivo distinto no incluido en esta revisión.

### Propósito

Muestra el historial auditable de decisiones de compra: qué sugería el sistema, qué se compró realmente, el motivo del desvío, quién compró/aprobó, y el resultado medido después (para evitar repetir errores).

### Fuentes de datos

- `src/data/mockDecisions.ts`: `OUTCOME_META`, tipo `DecisionOutcome`.
- `src/context/PurchaseFlowContext.tsx` (`usePurchaseFlow`): `decisions` (semillas + decisiones creadas al aprobar/rechazar aprobaciones vinculadas).
- `src/context/BuyerContext.tsx` (`useBuyer`) y `src/context/RoleContext.tsx` (`useRole`): determinan el alcance visible (ver más abajo).
- `src/utils/useUrlState.ts`: filtros persistidos en query string.
- `src/utils/entityLinks.ts`: `supplierPath`.
- `src/utils/formatters.ts`: `formatNumber`, `formatCurrencyCompact`.
- `src/utils/decisionEval.ts`: `evaluateDecision`, motor de evaluación previsto-vs-real.

### Estado y navegación

- `useUrlState("q")` — `query`: texto de búsqueda (producto, SKU, comprador, proveedor), reflejado en la URL.
- `useUrlState("resultado")` — `outcome`: filtro por `DecisionOutcome` (`bueno`/`sobrestock`/`corto`/`pendiente`), también en la URL — de ahí que `AprendizajePage` pueda enlazar directo a `/aprendizaje?tab=decisiones`.
- Sin estado local propio de UI (todo el filtrado se deriva de `decisions`, `buyer`, `role`, `query`, `outcome` con `.filter()` directos, no memoizados salvo `selects`).
- Alcance por rol: si `role !== "lider"`, la lista base (`all`) se reduce a las decisiones cuyo `buyerName === buyer` (cada comprador ve solo su propio historial; el líder ve el del equipo completo).

### Estructura visual

- **KPIs** (`KpiCard`, grilla 2×4): "Decisiones registradas", "Compró bien" (`bueno`), "Sobrecompras" (`sobrestock`), "Compras cortas" (`corto`) — conteos sobre `all` (no sobre `filtered`).
- **`FilterBar`**: buscador + select de resultado (`OUTCOME_META`).
- **Lista de `Card`** (una por decisión, sin tabla): encabezado con producto (enlazado), badge de resultado, fecha/comprador/aprobador/proveedor (enlazado); grilla de 3 métricas (sugerido / comprado / desvío ± %); bloque opcional "Evaluación de la compra" (solo si `evalr.measured`) con 4 `EvalMetric` y chips de checks ok/no-ok; motivo del desvío, resultado y (si existe) aprendizaje destacado en verde.
- **`EmptyState`** si no hay decisiones que coincidan con los filtros.

### Lógica de negocio clave

**Evaluación previsto-vs-real (`evaluateDecision`, en `src/utils/decisionEval.ts`):** solo se activa (`measured = true`) si el `outcome` no es `pendiente` y existen `demandForecast`/`demandActual`. Calcula: desviación de cantidad vs sugerido (abs. y %), error de pronóstico % (`(real − proyectado) / proyectado`), valor de sobrestock inmovilizado (`remainingUnits × unitCost`), y delta de margen (real − previsto). Deriva 6 checks booleanos (llegó a tiempo, se vendió lo esperado, no generó sobrestock, no hubo quiebre, pronóstico acertado, ajuste razonable vs sugerido) con distintos umbrales de tolerancia hardcodeados (12 %, 15 %, 25 %, etc.) y, según qué combinación de checks falla, sugiere una única `ruleToChange` en texto libre (p. ej. "revisar el gatillo de compra por volumen").

**Cálculo de desvío en pantalla:** `diff = purchasedQty − suggestedQty` y `diffPct` se recalculan localmente en el render de cada card (no vía `evaluateDecision`), coloreados según signo (violeta si sobrecompra, rojo si compra corta).

### Subcomponentes definidos en el archivo

- `EvalMetric` — tarjeta pequeña de una métrica de evaluación (label + valor coloreado según tono good/bad/warn).

---

## Aprobaciones de compra — `ApprovalsPage`

### Ruta y archivo

- Archivo: `src/pages/ApprovalsPage.tsx`
- Rutas: `/aprobaciones` y `/comprar/aprobaciones` (mismo componente).

### Propósito

Bandeja de solicitudes de compra que se salieron de criterio (monto, cobertura, margen, proveedor, desvío vs. sugerido, temporada o producto nuevo); el comprador ya dejó una justificación y aquí el líder aprueba, rechaza o pide ajustes, dejando todo trazado hacia el historial de decisiones.

### Fuentes de datos

- `src/data/mockApprovals.ts`: tipos `ApprovalRequest`/`ApprovalCriterion`, mapa `CRITERION_LABEL`.
- `src/context/PurchaseFlowContext.tsx` (`usePurchaseFlow`): `approvals`, `approvalState`, `observations`, `setApprovalState` — fuente única de verdad del estado de cada solicitud y del vínculo con `decisions`.
- `src/context/BuyerContext.tsx` (`useBuyer`) y `src/context/RoleContext.tsx` (`useRole`): alcance por comprador/líder y gate de permisos de aprobación.
- `src/context/ToastContext.tsx` (`useToast`): feedback de cada decisión tomada.
- `src/utils/entityLinks.ts`: `supplierPath`.
- `src/utils/formatters.ts`: `formatCurrency`, `formatCurrencyCompact`, `formatNumber`.

### Estado y navegación

- Estado de aprobación (`ApprovalState`, re-exportado como alias local `Decision`) vive en `PurchaseFlowContext`, no en la página: `approvalState` (`Record<id, ApprovalState>`) y `observations` (`Record<id, string>`), ambos persistidos por el contexto vía `useLocalStorage` (claves `compras:approvals` y `compras:approval-notes`).
- `useState<Decision | "todas">("pendiente")` — `filter`: filtro de estado activo, mostrado como fila de chips (no usa el componente `Tabs`); por defecto arranca en `pendiente` (la bandeja activa).
- `useState<ApprovalRequest | null>(null)` — `observeTarget`: solicitud abierta en el modal "Devolver con observación" (`null` = cerrado).
- Alcance por rol: si `role !== "lider"`, `approvalRequests` se filtra a `buyerName === buyer` (cada comprador ve solo lo suyo; el líder ve todo el equipo). Independientemente del alcance, `canApprove = role === "lider"` controla si se muestran los botones de acción o un aviso de solo-lectura con `IconLock`.

### Estructura visual

- **KPIs** (`KpiCard`, grilla 2×4): "En bandeja" (estados abiertos), "Monto en aprobación" (suma de `amount` de pendientes), "Aprobadas", "Total solicitudes".
- **Chips de filtro**: botones redondeados por cada `ApprovalState` + "Todas" (estilo pill, distinto del componente `Tabs` usado en `RfqPage`).
- **Lista de `Card`** (una por solicitud): encabezado con producto (enlazado), badge de estado (oculto si `pendiente`), fecha/comprador/proveedor (enlazado), monto y detalle de cantidad/costo unitario a la derecha; bloque **"Fuera de criterio"** con una fila por cada `ApprovalCriterion` roto (punto de color + etiqueta + valor vs. límite + delta, vía `criterionBreach`); justificación del comprador; bloque de observación del líder (si existe y el estado lo amerita); zona de acciones condicionada por rol y estado.
- **Modal** `ObserveModal`: textarea obligatorio para devolver la solicitud con observación.
- **`EmptyState`** si no hay solicitudes en el filtro activo.

### Lógica de negocio clave

**Máquina de estados (`ApprovalState`, definida en `PurchaseFlowContext.tsx`):** `pendiente` → (`en_analisis` | `observada` | `aprobada` | `rechazada`). `OPEN_STATES = ["pendiente", "en_analisis", "observada"]` son los estados que aún esperan decisión del líder y muestran acciones; `aprobada`/`rechazada` son terminales pero reversibles manualmente vía "Revertir a pendiente" (solo visible si `canApprove`). Transiciones disponibles desde la bandeja activa: **Aprobar**, **Rechazar**, **Observar** (abre `ObserveModal`, exige nota no vacía, pasa a `observada` guardando el texto en `observations`) y **Poner en análisis** (a `en_analisis`, oculto si ya está en ese estado). Todas las transiciones pasan por `decide()`/`submitObservation()` → `setApprovalState(id, estado, nota?)` del contexto, que además, si el `id` empieza con `APR-` y el nuevo estado es `aprobada`/`rechazada`, actualiza la `PurchaseDecision` vinculada (mismo id con prefijo `DEC-`) — así una aprobación/rechazo del líder se refleja automáticamente en el historial de decisiones (`DecisionsPage`).

**Helper `criterionBreach(request, criterion)`:** dado un `ApprovalRequest` y uno de sus `ApprovalCriterion`, devuelve un objeto `Breach` (`dot`, `value`, `limit?`, `delta?`, `deltaTone?`) que describe *por qué* rompió ese criterio y *cuánto* se pasó, con una rama `switch` por criterio:
  - `desvio_sugerido`: compara `requestedQty` contra `suggestedQty` (o marca "compra nueva" si `suggestedQty === 0`), delta en %.
  - `cobertura_excesiva`: `coberturaResultante − coberturaObjetivo`, en días.
  - `margen_bajo`: `margin − minMargin`, en puntos (severidad `bad`, punto rojo).
  - `monto_alto`: solo muestra el monto vs. "sobre tu alzada" (sin delta calculado).
  - `proveedor_revision`, `fuera_temporada`, `producto_nuevo`: criterios binarios, sin magnitud — solo texto descriptivo.
  Esto evita mostrar todos los indicadores de la solicitud por igual: solo se listan (y se cuantifican cuando aplica) los criterios que efectivamente se salieron de rango.

### Subcomponentes definidos en el archivo

- `ObserveModal` — modal para devolver una solicitud al comprador con una observación obligatoria del líder.
