# Proveedores

Documentación técnica del módulo de proveedores: listado, ficha de detalle y las
secciones de negociación/condiciones/temporadas que se despliegan en pestañas
dentro de la ficha de un proveedor.

## Tabla de contenidos

1. [`src/pages/SuppliersPage.tsx`](#srcpagessupplierspagetsx) — listado de proveedores
2. [`src/pages/SupplierDetailPage.tsx`](#srcpagessupplierdetailpagetsx) — ficha/detalle con pestañas
3. [`src/pages/SupplierDetailSections.tsx`](#srcpagessupplierdetailsectionstsx) — barrel de re-exportación
4. [`src/pages/supplierDetail/GStat.tsx`](#srcpagessupplierdetailgstattsx) — mini stat-tile compartido
5. [`src/pages/supplierDetail/SeasonView.tsx`](#srcpagessupplierdetailseasonviewtsx) — pestaña Temporadas
6. [`src/pages/supplierDetail/SupplierMaster.tsx`](#srcpagessupplierdetailsuppliermastertsx) — pestaña Ficha
7. [`src/pages/supplierDetail/SupplierNegotiation.tsx`](#srcpagessupplierdetailsuppliernegotiationtsx) — cockpit de negociación (pestaña Negociación, parte 1)
8. [`src/pages/supplierDetail/SupplierNegotiationRecord.tsx`](#srcpagessupplierdetailsuppliernegotiationrecordtsx) — registro de rondas (pestaña Negociación, parte 2)
9. [`src/pages/supplierDetail/SupplierTermsAgreements.tsx`](#srcpagessupplierdetailsuppliertermsagreementstsx) — condiciones y acuerdos (pestaña Negociación, parte 3)

---

## `src/pages/SuppliersPage.tsx`

### Ruta y archivo

`/proveedores` (definida en `src/routes/AppRoutes.tsx`, lazy-loaded como `SuppliersPage`).

### Propósito

Listado general de proveedores con foco en cumplimiento, lead time y monto pendiente, para decidir a quién seguir comprando o revisar. Incluye un aviso de proveedores que entran pronto en temporada alta.

### Fuentes de datos

- `src/data/mockSuppliers.ts` — `suppliers` (dataset base, usado como fallback de `useCollection`).
- `src/context/DataContext` — `useCollection<Supplier>("suppliers", mockSuppliers)`: colección editable por el usuario (persistida), con el mock como semilla.
- `src/utils/supplierPerf.ts` — `supplierFulfillment(name)` para la columna "Despacho" (fill rate + SKUs sin despachar).
- `src/utils/seasonality.ts` — `supplierSeasonality(name)` para el bloque "Entran en temporada próximamente".
- `src/utils/formatters.ts` — `formatCurrency`, `formatCurrencyCompact`, `formatDate`, `formatDays`, `formatNumber`, `formatPercent`.
- `src/utils/useUrlState.ts` — filtros persistidos en la URL.

### Estado y navegación

- `useUrlState("q")` → texto de búsqueda (nombre o RUT).
- `useUrlState("estado")` → filtro por `Supplier.status` (`active`, `review`, `delayed`, `blocked`, `inactive`).
- Click en fila → `navigate(/proveedores/:id)`.
- Click en tarjeta de "Entran en temporada" → `Link` a `/proveedores/:id?tab=temporadas` (la pestaña inicial de `SupplierDetailPage` lee ese query param).

### Estructura visual

- `FilterBar` con buscador, selector de estado y resumen de resultados.
- 4 `KpiCard`: proveedores atrasados, bajo cumplimiento (<70%), OC abiertas total, monto pendiente total.
- 3 `MiniRank` (componente local): peor cumplimiento, mayor compra 90 días, lead time más alto — cada uno top-4 sobre el dataset completo (no filtrado).
- `Card` condicional "Entran en temporada próximamente" (solo si hay resultados), con `Badge` rojo/ámbar según `seas.classification.risky`.
- `DataTable` principal (columnas: proveedor, categorías, SKUs, OC abiertas, cumplimiento, despacho, lead time, última compra, compra 90 días, monto pendiente, estado) con `mobileCard` propio para vista móvil.
- `MetricHint` junto a los encabezados de columnas con métricas explicadas (cumplimiento, despacho, lead time, pendiente).

### Lógica de negocio clave

- KPIs (`delayed`, `lowCompliance`, `totalPending`, `openOCs`) se calculan sobre el conjunto **filtrado**, mientras que los tres `MiniRank` se calculan sobre **todos** los proveedores (no respetan el filtro activo).
- "Entran en temporada próximamente": para cada proveedor activo, obtiene `supplierSeasonality(name)` y se queda solo con los que tienen `preSeason` definido; ordena primero por riesgo (`classification.risky`) y luego por días restantes.
- Umbrales de color repetidos inline: cumplimiento `< 70` (rojo) / `< 85` (ámbar) / resto (verde); monto pendiente `> 20000000` (ámbar). Ver hallazgos de limpieza.

### Subcomponentes definidos en el archivo

- `MiniRank` — tarjeta de ranking top-4 con nombre, valor destacado y subtítulo, coloreada por tono (`red`/`green`/`amber`).

---

## `src/pages/SupplierDetailPage.tsx`

### Ruta y archivo

`/proveedores/:id` (lazy-loaded como `SupplierDetailPage`). Lee el tab inicial desde `?tab=` (`useSearchParams`).

### Propósito

Ficha operativa completa de un proveedor: KPIs de desempeño, evaluación OTIF/lead time/reclamos, cockpit de negociación resumido, posición negociadora, y pestañas con detalle (ficha, negociación, temporadas, catálogo, órdenes, recepciones, alertas).

### Fuentes de datos

- `src/data/mockSuppliers.ts` — `suppliers` (búsqueda directa por `id`, sin pasar por `DataContext`).
- `src/data/mockProducts.ts` — `products` filtrados por `supplierName`.
- `src/data/mockPurchaseOrders.ts` — `purchaseOrders` filtradas por `supplierName`.
- `src/data/mockReceptions.ts` — `receptions`, `RECEPTION_STATUS` (badge de estado en pestaña Recepciones).
- `src/data/mockAlerts.ts` — `alerts` filtradas por entidad relacionada o SKU del proveedor.
- `src/data/mockClaims.ts` — `CLAIM_OPEN_STATES` (set de estados considerados "abiertos").
- `src/context/ClaimsContext` — `useClaims().forSupplier(name)` para los reclamos del proveedor.
- `src/utils/supplierScore.ts` — `supplierScore(supplier, claims)`, `SUPPLIER_CLASS` (clasificación y tono del badge).
- `src/utils/formatters.ts` — formateadores de moneda/porcentaje/días/fecha.
- Secciones de pestaña importadas desde `./SupplierDetailSections` (barrel).

### Estado y navegación

- `useParams<{ id }>()` para resolver el proveedor; si no existe, `EmptyState` + botón "Volver a proveedores".
- `useState(tab)` inicializado desde `searchParams.get("tab") ?? "ficha"`; pestañas: `ficha`, `negociacion`, `temporadas`, `productos`, `ordenes`, `recepciones`, `alertas` (con contadores en cada `Tabs` item).
- KPI "OC abiertas" y bloque "OC atrasadas" cambian el tab activo (`setTab("ordenes")`) en vez de navegar.
- Botón "reclamos abiertos" navega a `/reclamos` (fuera de la ficha).
- Enlaces internos: productos (`/productos/:sku`), órdenes de compra (`/comprar/seguimiento?oc=...`), recepciones (`/recepciones?rid=...`).

### Estructura visual

- `PageHeader` con breadcrumbs `Proveedores → {nombre}` y `StatusBadge` de estado.
- 4 `KpiCard`: cumplimiento, lead time, OC abiertas, monto pendiente.
- Banner de reclamos (solo si `supClaims.length > 0`), con tono rojo si hay reclamos abiertos.
- Bloque "Evaluación de desempeño": `Badge` de clasificación (`SUPPLIER_CLASS`) + 4 `ScoreStat` (componente local): OTIF, fill rate, lead time prometido→real, reclamos abiertos.
- Aviso ámbar "Revisar proveedor" condicional (atrasado, en revisión o cumplimiento bajo).
- Bloque "Para atender al proveedor": importancia, venta 30 días, margen promedio, utilidad 30 días, OC atrasadas (clicable).
- Grid de dos `Card`: "Cockpit de negociación" (4 `NegotiationAgendaItem` locales: Costo, Productos detenidos, Cumplimiento, Oportunidad) y "Posición negociadora" (con 4 `SupplierCockpitMetric` locales).
- Grid "Más vendidos (30 días)" / "Productos detenidos".
- `Tabs` de navegación con contadores por sección.
- Contenido de cada pestaña: `SupplierMaster` (ficha), `SupplierNegotiation` + `SupplierNegotiationRecord` + `SupplierTermsAgreements` (negociación), `SeasonView` (temporadas), listas propias inline para catálogo, órdenes, recepciones y `AlertCard` para alertas.

### Lógica de negocio clave

- **Score de desempeño**: delega en `supplierScore(supplier, supClaims)` (`src/utils/supplierScore.ts`), que combina OTIF (`supplierFulfillment` × cumplimiento del maestro), brecha de lead time prometido vs. real, y reclamos abiertos/valor reclamado para clasificar al proveedor en `estrategico | confiable | en_desarrollo | riesgoso | critico | sustituible | bloqueado` (`SUPPLIER_CLASS` define etiqueta y tono del badge).
- **Cockpit de negociación**: cuatro frentes calculados localmente en el componente — alza de costo (`costIncreaseProducts`, SKU con `cost > costoAnterior * 1.05`), productos detenidos/sobrestock (`detenidos`, capital inmovilizado `stalledCapital`), cumplimiento (OC atrasadas + `deliveryCompliance`), y oportunidad de crecimiento con cobertura corta (`growingConstrained`: crecimiento ≥25% y cobertura de stock ≤ 2× lead time).
- **Posición negociadora**: `negotiationPower` ("Media-alta"/"Media"/"Baja") según proporción de productos con equivalencia en otro proveedor (`alternativeProducts`) y volumen de compra 90 días.
- **Importancia del proveedor**: `importance` (`Estratégico`/`Importante`/`Secundario`) según participación de compra 90 días respecto al proveedor con mayor compra del panel (`maxBuy`) y cantidad de SKUs asociados.
- Los umbrales 70/85 (cumplimiento), 15 (lead time) y 20.000.000 (monto pendiente) se repiten como literales en varios bloques del archivo (ver hallazgos de limpieza).

### Subcomponentes definidos en el archivo

- `NegotiationAgendaItem` — tarjeta numerada del cockpit de negociación (título, detalle, "pedir", tono de color).
- `SupplierCockpitMetric` — mini stat-tile de dos líneas (label + valor) sin tono.
- `ScoreStat` — mini stat-tile con label, valor, tono (`good`/`warn`/`bad`/`neutral`) y `hint` opcional; casi idéntico a `GStat` (ver hallazgos).

---

## `src/pages/SupplierDetailSections.tsx`

### Ruta y archivo

No es una página enrutada — es un barrel de re-exportación consumido por `SupplierDetailPage.tsx`.

### Propósito

Reexporta las cinco secciones de pestaña de la ficha de proveedor desde `./supplierDetail/*`, para mantener un único punto de import en `SupplierDetailPage`.

### Fuentes de datos

Ninguna directa; solo re-exporta.

### Estado y navegación

N/A.

### Estructura visual

N/A (archivo de solo re-exportación, 9 líneas).

### Lógica de negocio clave

Ninguna; es un archivo puramente organizativo.

### Subcomponentes definidos en el archivo

Ninguno — reexporta `SupplierNegotiation`, `SeasonView`, `SupplierTermsAgreements`, `SupplierNegotiationRecord`, `SupplierMaster`.

---

## `src/pages/supplierDetail/GStat.tsx`

### Ruta y archivo

No enrutado — componente de presentación compartido, usado por `SeasonView.tsx` y `SupplierNegotiation.tsx`.

### Propósito

Mini stat-tile reutilizable: etiqueta, valor grande, tono opcional (`good`/`warn`/`bad`), subtítulo y `hint` (icono de ayuda) opcionales.

### Fuentes de datos

Ninguna — recibe todo por props.

### Estado y navegación

N/A (componente puro sin estado).

### Estructura visual

Un único bloque `div` con fondo `bg-slate-50`: label (+ hint inline), valor coloreado según tono, subtítulo pequeño opcional.

### Lógica de negocio clave

Ninguna — solo mapea `tone` a una clase de color de texto.

### Subcomponentes definidos en el archivo

- `GStat` — el propio componente exportado (sin subcomponentes internos).

---

## `src/pages/supplierDetail/SeasonView.tsx`

### Ruta y archivo

Sección de la pestaña **Temporadas** dentro de `/proveedores/:id` (`tab=temporadas`).

### Propósito

Analiza la estacionalidad de venta del proveedor: alerta de pre-temporada, KPIs de 12 meses, heatmap mensual, curva de venta, comparación año contra año, estacionalidad por SKU y checklist de pre/temporada/post-temporada.

### Fuentes de datos

- `src/utils/seasonality.ts` — `supplierSeasonality(supplier.name)`: única fuente de datos derivados (serie de 24 meses, score, clasificación, pre-temporada, top productos, SKUs por tipo, recomendación).
- `src/components/business/SeasonalityChart` — `MonthlyBars` para la curva de venta.
- `src/components/business/supplierMetricHelp` — `MetricHint` (fillRate).
- `src/pages/supplierDetail/GStat` — mini stat-tiles de la fila de KPIs.
- `src/utils/formatters.ts` — `formatCurrencyCompact`, `formatDays`, `formatNumber`, `formatPercent`.

### Estado y navegación

Sin estado propio (componente derivado, sin `useState`). Enlaces `Link` a `/productos/:sku` desde "Estacionalidad por producto" y "Top productos de temporada".

### Estructura visual

- Banner ámbar de pre-temporada (condicional a `s.preSeason`).
- Fila de 7 `GStat`: venta 12m, variación vs. 12m previos, margen promedio, quiebres 12m, fill rate, venta perdida, score de temporada (0-100).
- Bloque de clasificación con `Badge` (`s.classification`) y meses clave (peak).
- Heatmap de 12 meses (grid de celdas coloreadas por intensidad de venta, con icono ⚠ por quiebres) + `MonthlyBars` (curva de venta 12 meses).
- Tabla "Comparación año contra año" (`s.yoyByMonth`), resaltando meses peak y variación del último año.
- Lista "Estacionalidad por producto" (`s.skuSeasonality`) con tipo/insight/mes peak/% en temporada.
- 3 tarjetas fijas Pretemporada / Temporada / Postemporada con checklist de acciones hardcodeadas.
- Lista "Top productos de temporada" (`s.topProducts`) con acción sugerida por SKU.
- Bloque final "Conclusión y recomendación" (`s.recommendation`, texto generado).

### Lógica de negocio clave

Toda la lógica de cálculo vive en `supplierSeasonality` (`src/utils/seasonality.ts`), no en este componente: perfiles estacionales por categoría (`construccion`, `jardin`, `herramientas`, `pinturas`, `flat`), factor estacional (`seasonalFactor`), tipo de demanda (`demandType`: constante/estacional/permanente_peak) y generación determinista de 24 meses de historia (usa `hashString` para variar sin `Math.random`). El componente solo consume el resultado y lo despliega.

### Subcomponentes definidos en el archivo

Ninguno — usa `GStat` importado; el resto es JSX inline (incluye un array literal de 3 tarjetas Pretemporada/Temporada/Postemporada mapeado con `.map`).

---

## `src/pages/supplierDetail/SupplierMaster.tsx`

### Ruta y archivo

Sección de la pestaña **Ficha** dentro de `/proveedores/:id` (`tab=ficha`, valor por defecto).

### Propósito

Ficha maestra del proveedor: datos y contactos, evaluación multidimensional (score ponderado), documentos tributarios y acuerdos comerciales.

### Fuentes de datos

- `src/utils/supplierPerf.ts` — `supplierFulfillment(supplier.name)` (usado dentro de `supplierEvaluation` para "cumplimiento de cantidad").
- `src/utils/hash.ts` — `hashString` (semilla determinista para las dimensiones simuladas).
- Resto de datos viene directamente de las propiedades del objeto `Supplier` recibido por props (`contactoComercial`, `contactoLogistica`, `contactoCobranza`, `documentosTributarios`, `acuerdosComerciales`, `marcas`, `minimoCompra`, `condicionPago`, `plazoEntregaDias`).
- `src/utils/formatters.ts` — `formatCurrency`, `formatDate`, `formatDays`, `formatNumber`.

### Estado y navegación

Sin estado ni navegación propios; componente de solo lectura.

### Estructura visual

- `Card` "Ficha del proveedor": grid de datos (RUT, estado, condición de pago, plazo de entrega, mínimo de compra, categorías), marcas representadas (`Badge`), y 3 `ContactCard` locales (Comercial/Logística/Cobranza).
- `Card` "Evaluación del proveedor": barra de progreso por dimensión (6 barras) + badge de score total /100.
- Grid de 2 `Card`: "Documentos tributarios" (vigente/vencido) y "Acuerdos comerciales".

### Lógica de negocio clave

`supplierEvaluation(supplier)` (función local, no en `utils/`) calcula un score ponderado 0-100 sobre 6 dimensiones: cumplimiento de fecha (real, = `deliveryCompliance`), cumplimiento de cantidad (real vía `supplierFulfillment`, con fallback simulado), calidad, exactitud de factura, exactitud documental y estabilidad de precios (estas 4 últimas **simuladas** de forma determinista a partir de `hashString(supplier.id)`, documentado explícitamente en el `CardHeader` como dato de demo). Pesos: `[0.28, 0.22, 0.18, 0.12, 0.1, 0.1]`. `scoreTone(v)` clasifica cada dimensión/score en verde (≥85) / ámbar (≥70) / rojo (resto).

### Subcomponentes definidos en el archivo

- `ContactCard` — tarjeta de contacto (nombre/email/teléfono) o "Sin contacto registrado".
- (funciones auxiliares no-componente: `supplierEvaluation`, `scoreTone`, constante `BAR_COLOR`)

---

## `src/pages/supplierDetail/SupplierNegotiation.tsx`

### Ruta y archivo

Primer bloque de la pestaña **Negociación** dentro de `/proveedores/:id` (`tab=negociacion`).

### Propósito

Vista global del proveedor como cuenta comercial: rol estratégico, resultado comercial, cumplimiento/abastecimiento, participación por categoría, mix de productos, tabla de productos clave y objetivos/palancas sugeridos para la próxima negociación.

### Fuentes de datos

- `src/data/mockSuppliers.ts` — `suppliers` (para ranking por compra y detección de alternativas).
- `src/data/mockProducts.ts` — `products` filtrados por proveedor.
- `src/data/mockCategories.ts` — `categories` (margen promedio por categoría, para comparar).
- `src/data/mockPurchaseOrders.ts` — `purchaseOrders` (OC atrasadas del proveedor).
- `src/utils/supplierPerf.ts` — `supplierFulfillment(supplier.name)`.
- `src/pages/supplierDetail/GStat` — mini stat-tiles.
- `src/components/business/supplierMetricHelp` — `MetricHint` (fillRate, otif, cumplimiento, leadTime).
- `src/utils/formatters.ts`.

### Estado y navegación

`NegotiationProductTable` (subcomponente local) tiene `useState<NegView>("venta")` para alternar el criterio de orden de la tabla (más vendidos / más días de inventario / menor margen / mayor ganancia). Enlaces `Link` a `/productos/:sku` y a `/proveedores/:id` (proveedores alternativos).

### Estructura visual

- Banner "Rol del proveedor" con `Badge` y ranking por compra.
- `Card` "Resultado comercial": 5 `GStat` (venta anual est., venta 30 días, margen promedio, utilidad 30 días, compra anual est.).
- `Card` "Cumplimiento y abastecimiento": 6 `GStat` (fill rate, OTIF, cumplimiento, lead time, OC atrasadas, venta perdida).
- Grid de 2 `Card`: "Participación por categoría" (barras de progreso) y "Mix de productos" (3 `GStat` + top 5 vendidos).
- `Card` "Datos clave para negociar" → tabla `NegotiationProductTable` con selector de vista (chips).
- Grid de 2 `Card`: "Riesgo y dependencia" (2 `GStat` + lista de proveedores alternativos) y "Próxima negociación" (listas de objetivos sugeridos y palancas a favor, generadas por reglas).

### Lógica de negocio clave

- **Rol del proveedor** (`role`): árbol de decisión que cruza `problem` (cumplimiento <70% o fill rate <80%), `strategic` (participación ≥60% del máximo del panel o ≥200 SKUs) y `relevant` (≥30% o ≥100 SKUs) para clasificar en Problemático / Estratégico / Crítico / Reemplazable / De oportunidad, cada uno con un consejo de negociación (`tip`) fijo.
- **OTIF local**: `Math.round((deliveryCompliance * fillRate) / 100)` — cálculo simplificado, distinto (aunque relacionado) del que usa `supplierScore` en `SupplierDetailPage`/`utils/supplierScore.ts`.
- **Objetivos sugeridos** (`objetivos`): lista construida por reglas (fill rate <95%, cumplimiento <85%, lead time ≥12 días, venta perdida >0, productos sin rotación) — cada regla agrega una frase con los valores reales del proveedor.
- **Palancas a favor** (`palancas`): compra anual estimada, cantidad de proveedores alternativos en las mismas categorías, y participación máxima por categoría.
- **Participación por categoría**: compara venta del proveedor vs. venta total de la categoría en todo el catálogo, y compara el margen del proveedor con el margen promedio de la categoría (`mockCategories`).

### Subcomponentes definidos en el archivo

- `NegotiationProductTable` — tabla top-10 de productos ordenable por venta/días de inventario/margen/ganancia, con chips de selección de vista.

---

## `src/pages/supplierDetail/SupplierNegotiationRecord.tsx`

### Ruta y archivo

Segundo bloque de la pestaña **Negociación** dentro de `/proveedores/:id` (`tab=negociacion`).

### Propósito

Registro estructurado de rondas de negociación por proveedor: condición inicial, objetivo, oferta del proveedor, condición final, tipo de beneficio (distingue ahorro real de bonificaciones/plazos/logístico/promo) y estado.

### Fuentes de datos

- `src/data/mockNegotiations.ts` — `NEGOTIATION_LEVER`, `NEGOTIATION_BENEFIT`, `NEGOTIATION_STATUS` (catálogos label/tono), `negotiationsForSupplier(id)` (rondas semilla).
- `src/utils/useLocalStorage.ts` — persiste las rondas bajo la clave `compras:negotiations:{supplier.id}`.
- `src/context/ToastContext` — `useToast()` para confirmar el registro.
- `src/utils/constants.ts` — `TODAY_ISO` (fecha de la nueva ronda).
- `src/utils/formatters.ts` — `formatCurrency`, `formatCurrencyCompact`, `formatDate`.

### Estado y navegación

- `useLocalStorage<NegotiationRound[]>("compras:negotiations:{id}", ...)` — estado persistido, semilla `negotiationsForSupplier(supplier.id)`.
- `useState(creating)` — controla la apertura del modal "Registrar ronda".
- Dentro de `NewRoundModal`: estado local por campo (`lever`, `benefit`, `status`, `initial`, `target`, `supplierOffer`, `final`, `valueClp`, `error`).
- Sin navegación a otras rutas.

### Estructura visual

- `Card` "Registro de negociación" con botón "Registrar ronda" en el header.
- Resumen de 6 celdas: "Ahorro real / año" destacado en verde + 4 categorías de beneficio (bonificación, plazo, logístico, promo) + total de beneficios.
- Lista de rondas: badge de palanca, badge de tipo de beneficio, badge de estado, valor anual, y la cadena inicial → objetivo → oferta del proveedor → final.
- `Modal` (`NewRoundModal`) con formulario: `Select` de palanca/beneficio/estado, `Input` de condición inicial/objetivo/oferta/final/valor.

### Lógica de negocio clave

`summary` (`useMemo`) suma por tipo de beneficio (`byBenefit`) solo las rondas con `status === "acordado"`, y separa explícitamente `real` (`ahorro_real`) de `others` (suma de bonificación + plazo + logístico + promo) — refuerza la idea de que no todo beneficio negociado es ahorro real medible. El campo `responsible` de una ronda nueva se fija al literal `"Catalina Saavedra"` en vez de leerse del contexto de comprador (ver hallazgos).

### Subcomponentes definidos en el archivo

- `NewRoundModal` — formulario modal para registrar una nueva ronda de negociación, con validación mínima (objetivo y condición final obligatorios).

---

## `src/pages/supplierDetail/SupplierTermsAgreements.tsx`

### Ruta y archivo

Tercer bloque de la pestaña **Negociación** dentro de `/proveedores/:id` (`tab=negociacion`).

### Propósito

Condiciones comerciales vigentes (editables) del proveedor y bitácora de acuerdos con seguimiento, ambos persistidos localmente por proveedor.

### Fuentes de datos

- `src/utils/useLocalStorage.ts` — dos claves: `compras:terms:{supplier.id}` (condiciones) y `compras:agreements:{supplier.id}` (acuerdos).
- `src/context/ToastContext` — `useToast()` para confirmaciones/advertencias.
- `src/utils/formatters.ts` — `formatDate`.
- Constante local `DEFAULT_TERMS` como semilla de condiciones comerciales (plazo de pago 30 días, flete "Por pagar (cliente)", mínimo de compra "$500.000", etc.).

### Estado y navegación

- `useLocalStorage<SupplierTerms>` (condiciones) y `useLocalStorage<Agreement[]>` (acuerdos, vacío por defecto).
- `useState(editTerms)` + `useState(draft)` — edición en borrador de las condiciones, con detección de cambios (`termsDirty` vía `JSON.stringify`).
- `useState(newAgr)` — formulario de nuevo acuerdo (o `null` si el modal está cerrado).
- `useState(confirmDiscard)` — confirma descarte de cambios sin guardar al cerrar el modal de condiciones.
- Sin navegación a otras rutas.

### Estructura visual

- Grid de 2 `Card`: "Condiciones comerciales" (8 filas label/valor, con enlace "Editar") y "Acuerdos y seguimiento" (lista de acuerdos + botón "+ Registrar").
- `Modal` "Editar condiciones comerciales" (tamaño `lg`) con 8 campos (`Input` numérico/texto).
- `ConfirmModal` "Descartar cambios" (variante `danger`) cuando se intenta cerrar el modal de condiciones con cambios sin guardar.
- `Modal` "Registrar acuerdo" con fecha, objetivo, lo acordado y próximo seguimiento.

### Lógica de negocio clave

Flujo estándar de edición con confirmación de descarte: `closeTerms()` solo cierra directo si no hay cambios (`termsDirty`); si los hay, abre `ConfirmModal` antes de perderlos. La fecha por defecto de un acuerdo nuevo (`openAgr`) está fijada al literal `"2026-06-26"` en vez de usar la constante `TODAY_ISO` (`"2026-06-24"`, `src/utils/constants.ts`) que sí usa el archivo hermano `SupplierNegotiationRecord.tsx` (ver hallazgos).

### Subcomponentes definidos en el archivo

Ninguno — todo el JSX vive dentro del componente exportado `SupplierTermsAgreements`.

---

## Hallazgos de limpieza de código

Ver lista al final de la respuesta del agente (formato `archivo:línea — hallazgo — acción sugerida`).
