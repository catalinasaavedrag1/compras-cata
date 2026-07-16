# Órdenes de compra, configuración y gobierno

Referencia técnica de las páginas que cierran el proceso de compra (borrador → orden → seguimiento), la configuración de reglas de reposición y el módulo de gobierno/trazabilidad, más el repositorio de documentos.

## Tabla de contenidos

1. [PurchaseOrdersPage — Órdenes de compra](#1-purchaseorderspage--órdenes-de-compra)
2. [PurchaseOrdersSections — OcDetailModal](#2-purchaseorderssections--ocdetailmodal)
3. [DraftLineContext — contexto de línea del borrador](#3-draftlinecontext--contexto-de-línea-del-borrador)
4. [GovernancePage — Gobierno y trazabilidad](#4-governancepage--gobierno-y-trazabilidad)
5. [SettingsPage — Reglas de compra](#5-settingspage--reglas-de-compra)
6. [DocumentsPage — Documentos centralizados](#6-documentspage--documentos-centralizados)

---

## 1. PurchaseOrdersPage — Órdenes de compra

### Ruta y archivo
`src/pages/PurchaseOrdersPage.tsx` (1329 líneas). Registrada en `src/routes/AppRoutes.tsx` bajo cuatro rutas que renderizan el mismo componente, diferenciando pestaña/título por `pathname`:
- `/ordenes-compra` — vista general ("Todas").
- `/comprar/borradores` — pestaña `draft`.
- `/comprar/ordenes` — pestaña `all` (vista "Órdenes").
- `/comprar/seguimiento` — pestaña `open` (vista "Seguimiento").

### Propósito
Página central del ciclo de compra: lista y filtra las órdenes de compra (OC) existentes, y aloja el editor ("Drawer") donde se construye y formaliza un nuevo borrador de OC a partir del borrador global (`OcDraftContext`).

### Fuentes de datos
- `src/data/mockPurchaseOrders.ts` — `purchaseOrders as mockPOs` (semilla de OC).
- `src/data/mockRecommendations.ts` — `recommendations` (sugeridas, usadas para comparar cantidad pedida vs. sugerida y para el panel de "sugerencias para agregar").
- `src/data/mockRfq.ts` — `rfqs` (para contar cotizaciones abiertas en la barra de proceso).
- `src/data/mockProducts.ts` — `getProductBySku`, `products as allProducts` (stock, venta, costo, lead time por SKU).
- `src/data/mockSuppliers.ts` — `suppliers as mockSuppliers` (mínimo de compra, lead time promedio del proveedor).
- `src/data/mockRules.ts` — `purchaseRules`, `resolveRuleForProduct` (regla aplicable a cada SKU: cobertura objetivo y margen mínimo, usados al calcular criterios de aprobación).
- `src/context/DataContext.tsx` — `useCollection<PurchaseOrder>("purchase-orders", mockPOs)` (semilla combinable con backend si `backendEnabled`).
- `src/context/OcDraftContext.tsx` — `useOcDraft()` (ítems del borrador, totales, metadatos de cabecera) y `lineNet`.
- `src/context/ToastContext.tsx` — `useToast()`.
- `src/context/PurchaseFlowContext.tsx` — `usePurchaseFlow()` (`addApproval`, `addDecision`, `approvals`, `approvalState`).
- `src/context/BuyerContext.tsx` — `useBuyer()` (comprador activo; filtra qué OC ve).
- `src/context/RoleContext.tsx` — `useRole()` (rol activo; el líder ve todas las OC del equipo).
- `src/services/apiClient.ts` — `apiCreate`, `backendEnabled` (best-effort: si hay backend, sincroniza la OC creada).
- `src/utils/openToBuy.ts` — `draftBudgetImpact` (impacto del borrador sobre el presupuesto/Open-to-Buy).
- `src/utils/orderConsolidation.ts` — `supplierMinimumStatus`, `consolidationCandidates`, `earliestOrderBy`, `orderSalesAtRisk`.
- `src/utils/entityLinks.ts` — `supplierPath`.
- `src/utils/calculations.ts` — `coverageDays`, `addDaysISO`.
- `src/utils/dateRange.ts` — `inRange`, tipo `IsoRange`.
- `src/utils/constants.ts` — `TODAY_ISO`.
- `src/utils/useLocalStorage.ts` — `useLocalStorage`.
- `src/utils/formatters.ts` — `formatCurrency`, `formatCurrencyCompact`, `formatDate`, `formatNumber`.
- `src/components/business/LogisticsPlan.tsx` — `usePickupPlan`, `LogisticsSummary`, `LogisticsAdvice`, `LogisticsInlineSummary`, `TruckOptimizer` (plan de retiro/transporte del borrador).
- `src/components/business/SupplierOrderCoach.tsx` — recomendaciones para completar mínimo de proveedor y consolidar SKUs.
- `src/pages/PurchaseOrdersSections.tsx` — `OcDetailModal`.
- `src/pages/purchaseOrders/DraftLineContext.tsx` — `DraftLineContext`, `DraftMetric`, `DraftWarning`.

### Estado y navegación
- `tab` (`useState`): pestaña activa (`all` | `draft` | `open` | `delayed` | `received`); se inicializa según `pathname` y se re-sincroniza en un `useEffect` cuando cambia la ruta.
- `dates` (`useState<IsoRange>`): rango de fecha de creación para filtrar.
- `drawerOpen` (`useState`): visibilidad del editor de borrador.
- `prodSearch` (`useState`): texto de búsqueda de productos para agregar al borrador.
- `detail` (`useState<PurchaseOrder | null>`): OC mostrada en `OcDetailModal`.
- `createdNumber` (`useState<string | null>`): banner de confirmación tras crear borrador(es).
- `draftContextSku` / `draftContextTab` (`useState`): SKU y pestaña activos en el panel `DraftLineContext` dentro del drawer.
- `createdOrders` (`useLocalStorage`, clave `compras:po-created`): OC creadas por el usuario en la sesión (persisten en `localStorage`).
- `statusOverrides` (`useLocalStorage`, clave `compras:po-status`): cambios de estado manuales sobre OC semilla (p. ej. "Marcar como enviada").
- Deep-link `?oc=OC-XXXX` vía `useSearchParams`: abre automáticamente el detalle de esa orden (`useEffect` sobre `ocParam`); `closeDetail` limpia el parámetro de la URL al cerrar.
- Navegación saliente con `useNavigate`: a `/comprar/decisiones`, `/comprar/plan-retiro`, `/comprar/aprobaciones`, `/productos/:sku`, y enlaces con `Link` a `supplierPath(...)` y `/presupuesto`.
- **DraftLineContext**: subcomponente que se muestra dentro del Drawer para la línea seleccionada del borrador (`selectedDraftItem`). Expone 5 sub-pestañas internas controladas por `draftContextTab` (`resumen`, `escenarios`, `inventario`, `venta`, `proveedor`) — ver sección 3.

### Estructura visual
- `PageHeader` con título/descripción dinámicos según ruta y acción "Nuevo borrador de OC" (con contador de ítems).
- **`PurchaseProcessBar`**: barra de 7 etapas del proceso de compra (Necesidad → Preparación → Borrador → Retiro → Aprobación → Órdenes → Emitidas → Por recibir), cada una como link con contador y tono de color (`red`/`amber`/`blue`/`green`/`neutral`) según urgencia; resalta la etapa activa según `pathname`.
- Banner de confirmación post-creación (verde, dismissible).
- Card "Compra en curso" (solo si `count > 0`): resumen del borrador (proveedor principal, SKU, monto, cobertura futura promedio), acceso al plan de retiro, 4 `DraftMetric` y una lista de `DraftWarning` (solapes con OC abiertas, exceso vs. sugerido, cobertura > 90 días, sobregiro de OTB).
- 4 `KpiCard` (Monto en curso, Atrasadas, Borradores, Total OC) que también actúan como selectores de pestaña.
- `Tabs` (5 pestañas) + `DateRangePicker`.
- `Card` con `DataTable` de OC (columnas: N° OC/comprador, proveedor, fechas, SKUs, bodega, monto, atraso, venta en riesgo, estado, acción "Ver detalle"); fila roja tenue si `status === "delayed"`; `mobileCard` para vista angosta.
- **Drawer** "Borrador de orden de compra": buscador de productos, datos de cabecera (bodega, condición de pago, fecha esperada, observaciones), `DraftLineContext` de la línea seleccionada, líneas agrupadas por proveedor (con `SupplierOrderCoach` por grupo), totales, plan de retiro en vivo (`TruckOptimizer`, `LogisticsSummary`, `LogisticsAdvice`) y sugerencias pendientes de agregar.
- `OcDetailModal` (modal de detalle de una OC), montado al final del componente.

### Lógica de negocio clave
- **Estado derivado por aprobación**: una OC `pending_approval` pasa a `approved` cuando todas sus aprobaciones vinculadas (`APR-<número>-<índice>`) están `aprobada` (`approvalDerivedStatus`).
- **Alcance por rol**: el comprador solo ve sus propias OC (`o.buyerName === buyer`); el líder ve las de todo el equipo.
- **Venta en riesgo** (`riskByOrder`/`orderSalesAtRisk`): en las vistas "En curso" y "Atrasadas", las OC se ordenan por venta mensual en riesgo de quiebre (no solo por días de atraso), priorizando el impacto comercial real.
- **Creación de OC (`createOrder`)**: agrupa las líneas del borrador por proveedor (una OC nunca mezcla proveedores); por cada línea calcula la cantidad sugerida, el desvío, la cobertura resultante y el margen, y evalúa 4 criterios de aprobación (`desvio_sugerido`, `monto_alto`, `cobertura_excesiva`, `margen_bajo`). Si alguna línea de un grupo dispara un criterio, la OC nace en estado `pending_approval` en vez de `draft`, y se registra una `ApprovalRequest` y una `PurchaseDecision` (para medición posterior en Aprendizaje de compra). Genera un número `OC-2026-NNNN` correlativo a partir de `143 + createdOrders.length + seq`.
- **Open-to-Buy en vivo**: `draftBudgetImpact` recalcula, en cada cambio del borrador, cuánto presupuesto por categoría consume y si sobregira alguna categoría, antes de emitir.
- **Plan de retiro en vivo**: `usePickupPlan` recalcula camiones/alertas de transporte a medida que cambian las líneas del borrador.
- **Coach de proveedor** (`SupplierOrderCoach` + `orderConsolidation.ts`): por cada grupo de proveedor en el borrador, sugiere si falta para el mínimo de compra, candidatos de consolidación (otros SKU del proveedor por quebrar) y la fecha límite de emisión.

### Subcomponentes definidos en el archivo
- `PurchaseOrdersPage` — componente de página (único export).

*(Todos los demás bloques visuales son JSX inline dentro de `PurchaseOrdersPage`; los únicos subcomponentes extraídos a otros archivos son `OcDetailModal` y `DraftLineContext`/`DraftMetric`/`DraftWarning`, documentados en las secciones 2 y 3.)*

---

## 2. PurchaseOrdersSections — OcDetailModal

### Ruta y archivo
`src/pages/PurchaseOrdersSections.tsx`. No es una ruta propia: se importa y monta desde `PurchaseOrdersPage` (`OcDetailModal`).

### Propósito
Modal de detalle de una orden de compra: datos generales, documentos adjuntos, líneas (con diferencias de recepción si aplica), factura asociada y bitácora de auditoría.

### Fuentes de datos
- `src/data/mockOcHistory.ts` — `buildOcAudit(detail)`: reconstruye de forma determinista (sin `Math.random`/`Date.now`) el historial de hitos de la OC (creación, edición, aprobación, sincronización SAP, envío, confirmación del proveedor, recepción) y la factura asociada, en función del `status` de la OC.
- `src/utils/formatters.ts` — `formatCurrency`, `formatDate`, `formatNumber`.

### Estado y navegación
No mantiene estado propio; recibe `detail`, `onClose`, `onMarkSent` como props desde `PurchaseOrdersPage`. Usa `useNavigate` para el botón "Ver aprobaciones" (→ `/comprar/aprobaciones`) cuando `detail.status === "pending_approval"`.

### Estructura visual
`Modal` con: alerta ámbar si está pendiente de aprobación; grid de campos (`DetailField`: estado, comprador, fechas, monto, N° SKUs, descuento, condición de pago); comentarios; documentos adjuntos (chips); tabla de líneas (pedido vs. recibido si hay diferencias); factura asociada (con badge de conciliación); línea de tiempo de auditoría (`ol` con puntos).

### Lógica de negocio clave
- El pie del modal ofrece "Marcar como enviada" solo si el estado es `draft`, `approved` o `confirmed`, y "Ver aprobaciones" solo si está `pending_approval`.
- `buildOcAudit` infiere qué hitos "ya ocurrieron" a partir de un ranking de estados (`RANK`), generando una traza plausible y estable para cada OC de la demo.

### Subcomponentes definidos en el archivo
- `OcDetailModal` — modal de detalle de OC (export principal).
- `DetailField` — par etiqueta/valor reutilizado en la grilla de datos.

---

## 3. DraftLineContext — contexto de línea del borrador

### Ruta y archivo
`src/pages/purchaseOrders/DraftLineContext.tsx`. No es una ruta; se monta dentro del Drawer de `PurchaseOrdersPage` para la línea del borrador seleccionada.

### Propósito
Panel de análisis "en contexto" de una línea del borrador de OC: compara la cantidad elegida contra la sugerida, muestra escenarios de compra, inventario, venta y datos del proveedor, para decidir la cantidad antes de emitir.

### Fuentes de datos
- `src/data/mockProducts.ts` — `getProductBySku`.
- `src/data/mockRecommendations.ts` — `recommendations` (cantidad sugerida).
- `src/data/mockSuppliers.ts` — `suppliers as mockSuppliers` (cumplimiento, lead time).
- `src/utils/calculations.ts` — `coverageDays`.
- `src/utils/buyScenarios.ts` — `buyScenarios`, tipo `RiskLevel` (3 escenarios: conservador, recomendado, por volumen).
- `src/utils/cn.ts` — utilidad de clases condicionales.
- `src/utils/formatters.ts` — `formatCurrency`, `formatCurrencyCompact`, `formatNumber`.
- `src/context/OcDraftContext.tsx` — `lineNet`, tipo `OcDraftItem`.
- `src/components/business/LandedCost.tsx` — `LandedCostBreakdown` (rentabilidad/costo total puesto en bodega, pestaña "Proveedor").

### Estado y navegación
No mantiene estado propio (componente controlado): recibe `item`, `orders`, `tab`, `onTabChange`, `onQuantityChange`, `onOpenProduct` desde `PurchaseOrdersPage`. El botón "Ver SKU 360" invoca `onOpenProduct` (navega a `/productos/:sku` desde el padre).

### Estructura visual
Panel con 5 sub-pestañas vía `Tabs`:
- **Resumen**: 4 `DraftMetric` (stock, cobertura actual, cobertura futura, OC abiertas del mismo SKU/proveedor).
- **Escenarios**: 3 tarjetas (`buyScenarios`) con inversión, cobertura, riesgo de quiebre/sobrestock y ahorro por volumen; botón "Aplicar" que llama `onQuantityChange`.
- **Inventario**: stock por ubicación (hasta 3) + aviso si hay OC abiertas con el mismo SKU.
- **Venta**: venta 30d/90d, rotación, variación vs. sugerido.
- **Proveedor**: cumplimiento/lead time del proveedor + `LandedCostBreakdown`.
Al final, un input de cantidad y la cobertura proyectada tras comprar.

### Lógica de negocio clave
- `openOrders`: OC del mismo proveedor y SKU que no están en un estado terminal (`received`, `closed`, `cancelled`) — evita comprar duplicado.
- `deltaVsSuggested`: diferencia entre la cantidad elegida y la sugerida por el sistema.
- Los escenarios de compra (`buyScenarios`) cuantifican el costo completo de un descuento por volumen: más inversión y riesgo de sobrestock a cambio del ahorro.

### Subcomponentes definidos en el archivo
- `DraftLineContext` — panel principal (export).
- `ScenarioRow` — fila etiqueta/valor dentro de una tarjeta de escenario.
- `DraftMetric` — tarjeta de métrica reutilizada también por `PurchaseOrdersPage` (exportada).
- `DraftWarning` — fila de advertencia con badge de conteo, reutilizada también por `PurchaseOrdersPage` (exportada).

---

## 4. GovernancePage — Gobierno y trazabilidad

### Ruta y archivo
`src/pages/GovernancePage.tsx` → ruta `/gobierno` en `AppRoutes.tsx`.

### Propósito
Documenta quién puede hacer qué (roles y permisos), qué compras requieren aprobación (matriz) y expone la bitácora de cambios de la plataforma.

### Fuentes de datos
- `src/context/TraceContext.tsx` — `useTrace()` → `entries` (bitácora persistida en `localStorage`, clave `compras:trace`, con semilla de 3 registros).
- `src/utils/formatters.ts` — `formatDate`.
- Datos de roles/permisos y matriz de aprobación están **hardcodeados en el propio archivo** (`PERMISOS`, `MATRIZ`), no provienen de `src/data`.

### Estado y navegación
- `tab` (`useState`): `roles` | `matriz` | `bitacora`. Sin persistencia ni parámetros de URL.

### Estructura visual
`PageHeader` + `Tabs` (3 pestañas, la de bitácora con contador) + `Card` por pestaña:
- **Roles y permisos**: tabla `Acción / Comprador / Líder de Compras` con `PermCell` (check/cruz).
- **Matriz de aprobación**: lista de tarjetas por criterio (`Badge` + umbral + aprobador).
- **Bitácora**: lista cronológica (`entries`) con acción, entidad, campo antes→después, motivo, fecha y actor; `EmptyState` si no hay registros.

### Lógica de negocio clave
- **Matriz de aprobación (`MATRIZ`)**: describe en texto los 6 criterios que disparan aprobación — monto alto ("OC sobre $10M"), desvío sobre la sugerencia ("> 20% del sugerido"), cobertura excesiva ("> 90 días de cobertura"), margen bajo, proveedor en revisión y fuera de temporada. Estos textos son **documentación estática**; los criterios realmente evaluados al crear una OC viven en `PurchaseOrdersPage.createOrder` (ver hallazgo de inconsistencia más abajo).
- **Bitácora**: es de solo lectura en esta página; se alimenta desde otras páginas que llaman a `useTrace().log(...)` (p. ej. `SettingsPage` al aplicar una corrección de regla).

### Subcomponentes definidos en el archivo
- `GovernancePage` — componente de página (export).
- `PermCell` — ícono check/cruz para la tabla de permisos.

---

## 5. SettingsPage — Reglas de compra

### Ruta y archivo
`src/pages/SettingsPage.tsx` → ruta `/reglas` en `AppRoutes.tsx`.

### Propósito
Configura y diagnostica las reglas que gobiernan la reposición sugerida (días objetivo, stock mín/máx, margen mínimo, lead time) por ámbito (global, categoría, proveedor, marca, canal), y simula el impacto de cambiar el parámetro global de días objetivo antes de aplicarlo.

### Fuentes de datos
- `src/data/mockRules.ts` — `purchaseRules as seedRules`, `specialRules` (excepciones de negocio: productos nuevos, estacionales, baja venta, sobrestock, proveedores atrasados).
- `src/data/mockProducts.ts` — `products` (para calcular SKU afectados por cada regla y lead time real por categoría).
- `src/data/mockRecommendations.ts` — `recommendations` (compra sugerida afectada por cada regla, y proyección del simulador).
- `src/utils/paramHealth.ts` — `ruleParamIssues` (diagnóstico automático: lead time subestimado, MOQ mayor que la demanda, estacionales bajo regla fija, cobertura objetivo alta, sin stock de seguridad).
- `src/utils/formatters.ts` — `formatCurrencyCompact`, `formatDate`, `formatDays`, `formatNumber`, `formatPercent`.
- `src/utils/tone.ts` — `VALUE_TONE`.
- `src/utils/entityLinks.ts` — `supplierPath`, `categoryPath`.
- `src/utils/cn.ts` — clases condicionales.
- `src/utils/constants.ts` — `TODAY_ISO`.
- `src/context/ToastContext.tsx` — `useToast()`.
- `src/context/TraceContext.tsx` — `useTrace()` → `log` (registra cada campo corregido en la bitácora, antes→después).

### Estado y navegación
- `rules` (`useState<PurchaseRule[]>`, inicializado con `seedRules`): estado local, **no persiste** en `localStorage` (se pierde al recargar).
- `onlyAlerts` (`useState`): filtro "solo reglas con alerta" (toggleable desde el KPI "Requieren revisión").
- `scopeFilter` (`useState`): filtro por tipo de ámbito (`all`/`category`/`supplier`/`brand`/`channel`/`global`), controlado por `Tabs`.
- `editing` (`useState<PurchaseRule | null>`): regla abierta en el `RuleEditDrawer`.
- `simDays` (`useState<number>`): días objetivo simulados en el simulador de impacto (no persiste; se resetea a `baseTargetDays` en cada carga).
- Dentro de `RuleEditDrawer`: `draft` (copia editable de la regla) y `confirmDiscard` (`ConfirmModal` de guardia si hay cambios sin guardar al cerrar).
- Sin rutas ni parámetros de URL adicionales.

### Estructura visual
- 4 `KpiCard` (con regla propia, requieren revisión —clickeable, alterna `onlyAlerts`—, días objetivo prom., lead time prom.).
- Card "Simular días objetivo de inventario": selector de días (`simOptions`), total proyectado y desglose por categoría (`projection.rows`).
- Card "Qué reglas revisar" (solo si hay alertas): grilla de botones por regla con badge de salud.
- Card "Parámetros a corregir" (solo si `paramIssues.length > 0`): lista con severidad, detalle, sugerencia y botón "Aplicar" (si `issue.fix` existe) o "Revisar".
- `Tabs` de filtro por ámbito.
- Layout 2 columnas: `DataTable` de reglas (columnas: ámbito, días obj., stock mín/máx, margen mín., lead time, impacto en SKU/compra, fecha modificación, estado de salud, acción "Editar") + panel lateral fijo ("Cómo se calcula" y "Excepciones y reglas especiales").
- `RuleEditDrawer`: formulario de edición con validaciones (`errors`), advertencias (`warnings`), impacto estimado (SKU afectados, % cambio en compra sugerida, riesgo) y enlace a productos afectados; `ConfirmModal` al descartar cambios.

### Lógica de negocio clave
- **Fórmula base**: `Cantidad = venta diaria × (lead time + días objetivo) − stock disponible`, acotada por stock mín/máx y ajustada por margen, temporada, sobrestock, baja rotación y atraso del proveedor (documentado en texto, no ejecutado en esta página).
- **Precedencia de reglas** (`resolveRuleForProduct` en `mockRules.ts`, usado desde otras páginas): proveedor > marca > categoría > global.
- **Salud de regla** (`healthOf`): `incoherent` si `maxStock < minStock`; `overstock_risk` si `targetInventoryDays >= 55`; `stockout_risk` si `0 < targetInventoryDays <= 20`; `high_lead` si `leadTimeDays >= 15`; si no, `ok`.
- **Diagnóstico de parámetros** (`ruleParamIssues`): compara la regla contra la realidad de sus productos (lead time p90 real, MOQ vs. demanda, estacionalidad, cobertura, stock de seguridad) y ofrece una corrección de un clic (`fix`) cuando es posible.
- **Simulador**: proyecta la compra sugerida por categoría escalando `(lead + simDays) / (lead + baseTargetDays)` sobre el gasto sugerido base — una previsualización sin aplicar el cambio.
- **Bitácora**: `applyFix` y el guardado del `RuleEditDrawer` no llaman explícitamente a `log(...)` en el guardado manual (`onSave` del Drawer no registra en `TraceContext`, solo `applyFix` sí) — ver hallazgo abajo.

### Subcomponentes definidos en el archivo
- `SettingsPage` — componente de página (export).
- `affectedProductsLink` — función pura: URL de productos filtrados según ámbito de la regla.
- `RuleEditDrawer` — drawer de edición de una regla, con su propio estado de borrador y validación.
- `Row` — fila etiqueta/valor en el bloque "Impacto estimado".

---

## 6. DocumentsPage — Documentos centralizados

### Ruta y archivo
`src/pages/DocumentsPage.tsx` → ruta `/documentos` en `AppRoutes.tsx`.

### Propósito
Repositorio buscable de documentos del proceso de compra (cotizaciones, OC, guías, facturas, notas de crédito, contratos, fichas técnicas, certificados, correos) que hoy viven dispersos en correo/planillas.

### Fuentes de datos
- `src/data/mockDocuments.ts` — `documents`, `documentSuppliers`, `DOC_TYPE_ORDER`, `TYPE_LABELS`, `TYPE_TONES`, tipos `DocType`/`ProcurementDoc` (datos deterministas, sin `Math.random`/`Date.now`).
- `src/utils/dateRange.ts` — `inRange`, tipo `IsoRange`.
- `src/utils/formatters.ts` — `formatDate`.
- `src/context/ToastContext.tsx` — `useToast()` (usado solo para simular acciones de descarga/ver).

### Estado y navegación
- `query` (`useState`): texto de búsqueda libre (nombre, proveedor, relacionado).
- `tipo` (`useState`): filtro de tipo de documento, compartido entre `Tabs` y el `Select` del `FilterBar`.
- `proveedor` (`useState`): filtro por proveedor.
- `range` (`useState<IsoRange>`): filtro de fecha.
- Sin persistencia (`useLocalStorage`) ni parámetros de URL; `clearFilters` resetea los cuatro filtros a su valor inicial.

### Estructura visual
- `PageHeader` con `InfoHint`.
- 4 `KpiCard` (cotizaciones, órdenes de compra, facturas, contratos y acuerdos) — puramente informativos, no filtran al hacer clic.
- `FilterBar` (búsqueda, rango de fechas, selects de tipo y proveedor) con contador de resultados y botón limpiar.
- `Card` con `Tabs` de tipo (encabezado de la tabla) + `DataTable` (columnas: documento con ícono, tipo, proveedor, relacionado, fecha, tamaño, acciones "Ver"/"Descargar"); `mobileCard` para vista angosta.

### Lógica de negocio clave
- Filtrado combinado (texto + tipo + proveedor + rango de fecha) en un único `useMemo`.
- Las acciones "Ver" y "Descargar" están simuladas (`handleDownload` solo dispara un `toast.info`); no hay descarga real de archivos en la demo.
- Los KPI cuentan sobre el total de `documents` (no sobre `filtered`), por lo que no cambian al filtrar.

### Subcomponentes definidos en el archivo
- `DocumentsPage` — componente de página (único export; no define subcomponentes adicionales).

---

## Hallazgos de código (clean-code)

Ver lista de hallazgos en la respuesta del agente. No se realizó ninguna modificación de archivos `.ts`/`.tsx`; este documento es de solo lectura/documentación.
