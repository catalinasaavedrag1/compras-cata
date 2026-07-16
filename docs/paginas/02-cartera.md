# Cartera de productos y surtido

Documentación técnica de las vistas de catálogo, detalle de producto, categorías y gestión de surtido (category management) de compras-cata.

## Tabla de contenidos

1. [ProductsPage.tsx — `/productos`](#productspagetsx)
2. [ProductDetailPage.tsx — `/productos/:sku`](#productdetailpagetsx)
3. [productDetail/components.tsx — subcomponentes de detalle](#productdetailcomponentstsx)
4. [CategoriesPage.tsx — `/categorias`](#categoriespagetsx)
5. [CategoryDetailPage.tsx — `/categorias/:id`](#categorydetailpagetsx)
6. [AssortmentPage.tsx — `/surtido`](#assortmentpagetsx)
7. [CatalogOptimizationPage.tsx — `/surtido-redundante`](#catalogoptimizationpagetsx)
8. [NewProductsPage.tsx — `/nuevos-productos`](#newproductspagetsx)

---

## ProductsPage.tsx

`src/pages/ProductsPage.tsx`

### Ruta y archivo

`/productos` (registrada en `src/routes/AppRoutes.tsx`).

### Propósito

Listado maestro de SKUs con stock, margen, rotación, quiebre estimado y estado comercial/de compra, para que el comprador audite y filtre su cartera de productos.

### Fuentes de datos

- `src/data/mockProducts.ts` (`products`), leído a través de `useCollection<Product>("products", mockProducts)` de `src/context/DataContext.tsx` (usa backend si está disponible, si no cae al mock).
- `src/utils/filters.ts` (`filterProducts`, `uniqueValues`).
- `src/utils/calculations.ts` (`coverageDays`, `estimatedStockoutDate`).
- `src/utils/constants.ts` (`TODAY_ISO`).
- `src/utils/formatters.ts` (`formatCurrency`, `formatDate`, `formatNumber`, `formatPercent`).
- `src/utils/entityLinks.ts` (`categoryPath`).
- `src/utils/exportCsv.ts` (`exportToCsv`).
- `src/utils/useUrlState.ts` (`useUrlState`, `useUrlToggle`).
- `src/context/ToastContext.tsx` (`useToast`).
- `src/components/business/ScopeToggle.tsx` (`useCategoryScope`, alcance "mi cartera"/"todas").

### Estado y navegación

- Filtros persistidos en la URL vía `useUrlState`: `q` (búsqueda), `cat`, `sub`, `marca`, `prov`, `comercial` (estado comercial), `compra` (estado de compra); `stock` como toggle booleano (`useUrlToggle`, sin stock).
- `toggles` en `useState` local (no en URL): `lowMargin`, `noSupplier`, `noSales`, `outdatedCost` — filtro de costo desactualizado usa el literal `"2026-04-01"` en línea (no `TODAY_ISO`).
- `scope`/`setScope` de `useCategoryScope()` (persistido en `localStorage` bajo `compras:scope`, compartido entre vistas).
- Clic en fila navega a `/productos/:sku`; el nombre de categoría enlaza a `categoryPath(p.category)` (→ `/categorias/:id`).
- Botón "Exportar a CSV" en `MoreActions`, dispara `exportToCsv` y un toast de confirmación.

### Estructura visual

- `PageHeader` con `ScopeToggle` y menú `MoreActions` (exportar).
- `FilterBar`: búsqueda, 6 selects (categoría, subcategoría, marca, proveedor, estado comercial, estado compra) y 5 toggles (sin stock, margen bajo, sin proveedor, sin venta, sin costo actualizado).
- 4 `KpiCard`: SKUs en vista, margen bajo (<25%), sin proveedor, sin venta (30d) — las tres últimas son clicables y alternan el toggle correspondiente.
- `DataTable` con 10 columnas (producto, proveedor, costo/precio, margen, stock disp./total, venta mes, quiebre estimado, rotación, estado comercial, estado compra) y `mobileCard` para vista angosta.

### Lógica de negocio clave

- Alcance por defecto: `inScope(p.category)` de `useCategoryScope` limita a las categorías asignadas al comprador salvo que se cambie a "Todas".
- Filtrado combinado: `filterProducts` (texto + selects + `lowMargin`/`noSupplier`/`noSales`) más dos filtros adicionales aplicados manualmente en el componente (`outdatedCost` contra fecha fija, `outOfStock` contra `availableStock <= 0`).
- Columna "Quiebre estimado": si `availableStock <= 0` y hay venta, marca "En quiebre"; si no, usa `estimatedStockoutDate` + `coverageDays` para colorear según el lead time del proveedor (rojo si cobertura ≤ lead time, ámbar si ≤ 2×lead time).
- KPIs de margen bajo/sin proveedor/sin venta se recalculan sobre el resultado ya filtrado (`filtered`), no sobre el universo completo.

### Subcomponentes definidos en el archivo

- Ninguno; todo el render vive en `ProductsPage` (columnas y `mobileCard` definidos inline).

---

## ProductDetailPage.tsx

`src/pages/ProductDetailPage.tsx`

### Ruta y archivo

`/productos/:sku` (registrada en `AppRoutes.tsx`).

### Propósito

Ficha 360° de un SKU: decisión de compra recomendada, KPIs de stock/margen, historial, margen por canal, señales de venta, entidades relacionadas y panel de negociación.

### Fuentes de datos

- `src/data/mockProducts.ts` (`getProductBySku`, `products`).
- `src/data/mockRecommendations.ts` (`recommendations`).
- `src/data/mockAlerts.ts` (`alerts`).
- `src/data/mockPurchaseOrders.ts` (`purchaseOrders`).
- `src/data/mockChannelMargin.ts` (`channelMarginsForSku`, `CHANNEL_LABELS`, `MARGIN_STATUS`).
- `src/services` (`signalService.bySku`).
- `src/shared/entities.ts` (`relatedEntitiesForProduct`).
- `src/utils/catalogOptimization.ts` (`skuOptimizationStatus`, `ACTION_LABEL`, `TIER_LABEL`).
- `src/utils/entityLinks.ts` (`supplierPath`).
- `src/utils/constants.ts` (`TODAY_ISO`).
- `src/utils/formatters.ts`.
- `src/context/OcDraftContext.tsx` (`useOcDraft`), `src/context/ToastContext.tsx`, `src/context/TraceContext.tsx` (`useTrace`).
- `src/pages/productDetail/components.tsx` (`DecisionBanner`, `MiniStat`, `NegotiationPanel`, `Row`).

### Estado y navegación

- `tab` en `useState`, inicializado desde el query param `tab` de la URL (`useSearchParams`) pero **no** se sincroniza de vuelta a la URL al cambiar de pestaña (solo lee el valor inicial).
- Pestañas: `resumen`, `negociacion`, `margen`, `senales`, `relacionados`, `actividad`.
- Navegación saliente: breadcrumb a `/productos`, link a proveedor (`supplierPath`), badge de redundancia/reactivación a `/surtido-redundante?cat=...`, link a `/margen-canal?q=sku`, link a `/senales-ventas`, links a OC relacionadas (`/comprar/seguimiento?oc=...`) y a `/reglas` (cambiar parámetros de reposición).
- `MoreActions` con acciones contextuales (`productActions`) que dependen de `multiLocation` e `isOverstock`; cada acción llama `runAction`, que registra en `TraceContext.log` (actor hardcodeado `"Catalina Saavedra"`) y muestra un toast.

### Estructura visual

- `PageHeader` con breadcrumbs, acción "Agregar a OC" y `MoreActions`.
- Fila de chips: SKU, `StatusBadge` comercial/compra, proveedor o badge "Sin proveedor asignado", badge de redundancia/reactivación de surtido.
- `DecisionBanner` (de `productDetail/components.tsx`) resume la acción recomendada.
- `Tabs` con contadores por pestaña.
- Tab **Resumen**: 8 `KpiCard`, tarjeta "Recomendación de compra", tarjeta "Stock por ubicación" (barras disponible/comprometido), 3 tarjetas de historial (ventas, compras, costo — datos simulados en el propio componente), alertas relacionadas y OC relacionadas.
- Tab **Negociación**: delega en `NegotiationPanel`.
- Tab **Margen por canal**: grid de tarjetas por canal con `Row` (precio, costo, comisión, descuento, margen, objetivo, venta 30d) y precio sugerido si el margen está bajo/negativo.
- Tab **Señales de ventas**, **Relacionados** (`RelatedEntitiesPanel`) y **Actividad** (`ActivityTimeline`).

### Lógica de negocio clave

- `salesHistory`, `purchaseHistory` y `costHistory` son series de 3 puntos **calculadas/simuladas en el propio componente** (no en `utils/`), p. ej. `costHistory` asume variaciones fijas de −6 %/−11 % sobre el costo actual.
- `activity` combina evento de costo, historial de compras y alertas relacionadas, ordenado por fecha descendente con `.sort((a,b) => (a.date < b.date ? 1 : -1))`.
- `isOverstock` = `purchaseStatus === "overstock"` OR `productStatus === "no_sales"` OR `inventoryDays > 180` — condiciona qué acciones contextuales aparecen en `MoreActions`.
- `optStatus` (vía `skuOptimizationStatus`) conecta con el módulo de surtido redundante para mostrar si el SKU es redundante o candidato a reactivar.
- `bestChannel`/`worstChannel` se obtienen ordenando copias de `channelMargin` por `marginPct` ascendente/descendente.

### Subcomponentes definidos en el archivo

- Ninguno; usa los definidos en `productDetail/components.tsx`.

---

## productDetail/components.tsx

`src/pages/productDetail/components.tsx`

### Ruta y archivo

No tiene ruta propia: contiene subcomponentes exclusivos de `ProductDetailPage.tsx`.

### Propósito

Aloja el banner de decisión recomendada y el panel de negociación (el bloque más grande y con más lógica de negocio de la ficha de producto).

### Fuentes de datos

- `src/data/mockProducts.ts` (`products`), `src/data/mockSuppliers.ts` (`suppliers`, `getSupplierByName`), `src/data/mockRules.ts` (`purchaseRules`, `resolveRuleForProduct`), `src/data/mockReceptions.ts` (`receptions`).
- `src/utils/supplierPerf.ts` (`supplierFulfillment`), `src/utils/negotiation.ts` (`productNegotiation`), `src/utils/seasonality.ts` (`seasonalFactor`, `demandType`), `src/utils/calculations.ts` (`coverageDays`), `src/utils/tone.ts` (`VALUE_TONE`).
- `src/utils/formatters.ts` (varios).

### Estado y navegación

- Sin estado propio (componentes de presentación puros, reciben `product`/`rec` por props).
- Enlaces salientes: sustitutos y proveedores alternativos a `/productos/:sku` y `/proveedores/:id`; estacionalidad del proveedor a `/proveedores/:id?tab=temporadas`.

### Estructura visual

- `DecisionBanner`: banner de 4 variantes (comprar, no comprar por sobrestock, asignar proveedor, sin acción) según el estado del producto y la recomendación.
- `NegotiationPanel`: 5 filas de tarjetas — Venta y demanda, Margen y precio, Inventario, Proveedor (con condiciones), Costo neto real (waterfall), Precio/costo/historial, Stock por tienda/CD, Calidad y condiciones del proveedor, Demanda futura (con estacionalidad), Productos sustitutos, Proveedores alternativos, Objetivos de negociación + próxima decisión sugerida.
- Subcomponentes de estadística reutilizados dentro del panel: `NStat` (bloque valor/tono), `MiniStat` (bloque simple centrado), `Row` (fila etiqueta/valor con tono).

### Lógica de negocio clave

- `NegotiationPanel` calcula en línea (no en `utils/`): tendencia de venta (`salesLast30Days` vs promedio de `salesLast90Days`), ranking del SKU por venta 30d contra todo el catálogo (`products.sort(...).findIndex(...)`), brecha de margen contra el objetivo de `resolveRuleForProduct` (`utils/mockRules` — la regla resuelta expone `minMargin`), costo objetivo para alcanzar ese margen, unidades en tránsito (sumando `receptions` con estado `in_transit`/`scheduled`) y venta perdida estimada por quiebre (`sales30 * price`).
- Delegación a utilidades para el resto: costo neto real e historial de precio/proveedor via `productNegotiation` (`utils/negotiation.ts`), estacionalidad vía `seasonalFactor`/`demandType` (`utils/seasonality.ts`).
- Lista `objetivos` (argumentos de negociación) y `decisiones` (chips de próxima acción) se arman con reglas condicionales encadenadas directamente en el componente.
- `DecisionBanner` reimplementa su propia lógica de decisión (no reutiliza `recommendations`/`purchaseStatus` de forma centralizada): 4 ramas secuenciales evaluadas con `if` sobre `rec`, `purchaseStatus`, `supplierName` y `salesLast30Days`.

### Subcomponentes definidos en el archivo

- `Row` — fila etiqueta/valor con tono opcional (usada en la pestaña de margen por canal de `ProductDetailPage` y dentro del panel de negociación).
- `MiniStat` — bloque de estadística simple (etiqueta + valor), usado en la tarjeta "Recomendación de compra".
- `NStat` (interno, no exportado) — bloque de estadística con tono y subtítulo, usado extensamente en `NegotiationPanel`.
- `NegotiationPanel` — panel completo de negociación (componente exportado más grande del archivo, ~590 líneas).
- `DecisionBanner` — banner de decisión recomendada con 4 variantes.

---

## CategoriesPage.tsx

`src/pages/CategoriesPage.tsx`

### Ruta y archivo

`/categorias` (registrada en `AppRoutes.tsx`).

### Propósito

Vista de salud comercial por categoría (venta, margen, quiebres, rotación, compra sugerida) con rankings destacados y acceso directo a reposición/surtido por categoría.

### Fuentes de datos

- `src/data/mockCategories.ts` (`categories`).
- `src/utils/formatters.ts` (`formatCurrency`, `formatCurrencyCompact`, `formatNumber`, `formatPercent`).
- `src/components/business/ScopeToggle.tsx` (`useCategoryScope`).
- `src/components/business/BarList.tsx`, `src/components/business/InfoHint.tsx`.

### Estado y navegación

- Sin filtros propios en URL; solo `scope`/`setScope` de `useCategoryScope` (mismo `localStorage` compartido `compras:scope`).
- Clic en fila navega a `/categorias/:id`; columna "Acción" enlaza a `/comprar/decisiones?cat=...` (reposición) y `/surtido-redundante?cat=...` (surtido), con `stopPropagation` para no disparar la navegación de fila.

### Estructura visual

- `PageHeader` con `ScopeToggle` y `InfoHint` ("Cómo leer esta vista").
- 4 `RankCard` (top 5 cada una, vía `BarList`): categorías críticas (quiebre+riesgo), mayor venta 30d, peor margen, mayor inventario inmovilizado.
- `DataTable` de detalle por categoría: nombre/comprador, SKUs, venta 30/90d, margen, inventario, badges rojo/ámbar/violeta (quiebre/riesgo/sobrestock), rotación, compra sugerida, estado, acciones. Con `mobileCard` equivalente.

### Lógica de negocio clave

- Cuatro listas ordenadas localmente sin util compartido: por `stockoutSkus + riskSkus` (críticas), por `salesLast30Days`, por `averageMargin` ascendente (peor primero), por `inventoryValue`.
- Coloreo de margen bajo con umbral **28** (`c.averageMargin < 28`), distinto del umbral **25** usado para el mismo concepto en `ProductsPage.tsx`/`ProductDetailPage.tsx` (ver hallazgos de limpieza).
- `RankCard`/`items` construidos inline mapeando cada lista ordenada a `{label, value, display, tone}` para `BarList`.

### Subcomponentes definidos en el archivo

- `RankCard` — tarjeta con `CardHeader` + `BarList`, reutilizada 4 veces para los rankings.

---

## CategoryDetailPage.tsx

`src/pages/CategoryDetailPage.tsx`

### Ruta y archivo

`/categorias/:id` (registrada en `AppRoutes.tsx`).

### Propósito

Ficha de una categoría con productos, roles de producto, crecimiento, productos detenidos, marcas, optimización de surtido, reposición sugerida, proveedores y alertas — todo acotado a esa categoría.

### Fuentes de datos

- `src/data/mockCategories.ts` (`categories`), `src/data/mockProducts.ts` (`products`), `src/data/mockSuppliers.ts` (`suppliers`), `src/data/mockRecommendations.ts` (`recommendations`), `src/data/mockAlerts.ts` (`alerts`).
- `src/utils/catalogOptimization.ts` (`analyzeCatalog`, usado solo para el contador `redundantCount` del tab).
- `src/components/business/CatalogRedundancy.tsx` (reutilizado íntegro para el tab "Optimizar surtido").
- `src/context/OcDraftContext.tsx`, `src/context/ToastContext.tsx`.
- `src/utils/formatters.ts`.

### Estado y navegación

- `tab` en `useState` local (no sincronizado con la URL, a diferencia de `ProductDetailPage`), tabs: `productos`, `clave`, `crecimiento`, `detenidos`, `marcas`, `optimizar`, `reposicion`, `proveedores`, `alertas`.
- Los `KpiCard` "Compra sugerida" cambian el tab activo (`setTab("reposicion")`) en vez de navegar.
- Navega a `/productos/:sku`, `/proveedores/:id`, y agrega ítems al borrador de OC (`addItem` + toast con acción "Ver borrador OC" → `/comprar/borradores`).

### Estructura visual

- `PageHeader` con breadcrumb a `/categorias` y `StatusBadge` de categoría.
- 4 `KpiCard`: compra sugerida, SKUs en quiebre, venta 30 días, inventario.
- `Tabs` con contadores por pestaña.
- Listas de tarjeta por fila (`Card` + lista de `Link`) para productos, productos clave, crecimiento, detenidos, proveedores; tarjetas simples para marcas; `CatalogRedundancy` embebido para "Optimizar surtido"; filas con botón "Agregar" para reposición; grid de `AlertCard` para alertas.

### Lógica de negocio clave

- **Clasificación de "rol de producto" calculada inline en el componente** (no en `utils/`), a diferencia del patrón ya existente para roles de categoría (`classifyCategoryRoles` en `src/utils/assortment.ts`): para cada producto calcula `growth` (venta 30d vs. `salesLast90Days/3`) y asigna `role` con una cascada de condiciones — "Detenido" (sin venta con stock), "Emergente" (`growth >= 0.25`), "Deterioro" (`growth <= -0.25` con stock), "Margen" (`margin >= 34` y venta > 0), "Tractor" (`salesLast30Days >= 40`), o "Riesgo" (resto).
- **Agregación por marca (`catBrandRows`) también calculada inline**: venta, utilidad, margen y quiebres por marca dentro de la categoría, ordenada por venta.
- Tab "Crecimiento" reutiliza el mismo `growth` calculado para "clave" filtrando `>= 0.25`; tab "Detenidos" filtra `role === "Detenido"`.
- `redundantCount` para el badge del tab "Optimizar surtido" se obtiene descartando el resto del resultado de `analyzeCatalog` (solo usa `.candidateCount`), mientras el tab en sí vuelve a llamar internamente a `analyzeCatalog` a través de `CatalogRedundancy` — el análisis se ejecuta dos veces por render cuando ese tab está activo.

### Subcomponentes definidos en el archivo

- Ninguno; todo el render vive en `CategoryDetailPage`.

---

## AssortmentPage.tsx

`src/pages/AssortmentPage.tsx`

### Ruta y archivo

`/surtido` (registrada en `AppRoutes.tsx`).

### Propósito

Centraliza las decisiones de "qué surtido llevar" (category management): rol estratégico de cada categoría, cobertura de surtido por tienda/cluster, penetración de marca propia y line review (altas y salidas).

### Fuentes de datos

- `src/data/mockCategories.ts` (`categories`), `src/data/mockProducts.ts` (`products`).
- `src/utils/assortment.ts` (`classifyCategoryRoles`, `CATEGORY_ROLE_META`, `privateLabelByCategory`, `assortmentByCluster`, `newProducts`, `exitCandidates`).
- `src/utils/entityLinks.ts` (`categoryPath`, `productPath`).
- `src/utils/formatters.ts`.
- `src/components/business/ScopeToggle.tsx` (`useCategoryScope`), `src/components/business/HelpNote.tsx`.

### Estado y navegación

- `tab` en `useState` local (no persistido en URL): `rol`, `tiendas`, `marca-propia`, `line-review`.
- `scope`/`setScope` de `useCategoryScope` (mismo `localStorage` `compras:scope`), aplicado tanto a `categories` como a `products` antes de pasarlos a cada tab.
- Enlaces salientes: categoría/producto a sus fichas (`categoryPath`, `productPath`); tab "Altas y salidas" enlaza a `/surtido-redundante`.

### Estructura visual

- `PageHeader` con `ScopeToggle`; `Tabs` de 4 pestañas.
- **RoleTab**: `HelpNote` explicativa, 4 `KpiCard` (conteo por rol) y `DataTable` con categoría, rol (badge), foco, venta 30d, margen, SKUs.
- **StoresTab**: `HelpNote`, grid de tarjetas por cluster con badge de brechas y lista de SKUs vendedores ausentes en ese cluster.
- **PrivateLabelTab**: `HelpNote`, 4 `KpiCard` (mix surtido, mix venta, venta marca propia, categorías) y `DataTable` con `MixBar` (barra de progreso) por categoría.
- **LineReviewTab**: `HelpNote`, dos `Card` con `ChangeTable` (altas NPI y candidatos a salida).

### Lógica de negocio clave

- Toda la lógica de negocio de esta página vive en `src/utils/assortment.ts` (buena separación): rol de categoría relativo al conjunto (top 30% por venta = tráfico; resto por mediana de margen/SKUs activos), penetración de marca propia (`PRIVATE_LABEL_BRANDS` + flag `marcaPropia`) con margen ponderado por unidades vendidas, brechas de surtido por cluster (`clusterOf` mapea nombre de ubicación → zona por palabra clave; SKU "vendedor" = `salesLast30Days >= 10`), altas NPI (`productStatus === "new"`) y candidatos a salida (descontinuado, sin venta, sin venta en 90d con stock, o `purchaseStatus === "do_not_buy"`).
- El componente solo filtra por alcance (`inScope`) y memoiza (`useMemo`) las llamadas a esas utilidades.

### Subcomponentes definidos en el archivo

- `RoleTab` — pestaña "Rol de categoría".
- `StoresTab` — pestaña "Surtido por tienda".
- `MixBar` — barra de progreso de mix (% marca propia) usada en `PrivateLabelTab`.
- `PrivateLabelTab` — pestaña "Marca propia".
- `ChangeTable` — tabla genérica reutilizada para altas y salidas.
- `LineReviewTab` — pestaña "Altas y salidas".

---

## CatalogOptimizationPage.tsx

`src/pages/CatalogOptimizationPage.tsx`

### Ruta y archivo

`/surtido-redundante` (registrada en `AppRoutes.tsx`; `/catalogo-optimizado` redirige aquí con `<Navigate replace>`).

### Propósito

Punto de entrada global a la detección de SKUs redundantes del catálogo (variedad excesiva dentro de una misma subcategoría/gama de precio), delegando toda la vista en `CatalogRedundancy`.

### Fuentes de datos

- `src/data/mockProducts.ts` (`products`).
- `src/utils/useUrlState.ts` (`useUrlState`).
- `src/components/business/ScopeToggle.tsx` (`useCategoryScope`).
- `src/components/business/CatalogRedundancy.tsx` (componente compartido con el tab "Optimizar surtido" de `CategoryDetailPage.tsx`).

### Estado y navegación

- Filtro de categoría en URL (`cat`, vía `useUrlState`), poblado dinámicamente con las categorías presentes en el alcance actual.
- `scope`/`setScope` de `useCategoryScope` (mismo `localStorage` compartido).
- Sin navegación propia adicional; toda la navegación (a fichas de producto, campañas, etc.) ocurre dentro de `CatalogRedundancy`.

### Estructura visual

- `PageHeader` con `ScopeToggle` + `Select` de categoría.
- `CatalogRedundancy` (KPIs de resumen, filtros por acción, tarjetas por grupo redundante, exportar CSV, crear campaña de liquidación).

### Lógica de negocio clave

- Toda la lógica de detección de redundancia vive en `src/utils/catalogOptimization.ts` (`analyzeCatalog`): agrupa productos por categoría+subcategoría, reparte cada grupo en 3 gamas de precio (baja/media/alta) por percentil relativo al rango de precios del grupo, conserva el mejor por gama (`better`: venta 30d → rotación → margen) y marca el resto como candidato a liquidar (con stock) o descontinuar (sin ventas / descontinuado), con severidad alta si está muerto o `inventoryDays >= 120`.
- El componente en sí solo filtra por alcance y por categoría seleccionada antes de pasar la lista a `CatalogRedundancy`.

### Subcomponentes definidos en el archivo

- Ninguno.

---

## NewProductsPage.tsx

`src/pages/NewProductsPage.tsx`

### Ruta y archivo

`/nuevos-productos` (registrada en `AppRoutes.tsx`).

### Propósito

Gestiona el pipeline de incorporación de productos nuevos (NPI: propuesta → aprobada → piloto → evaluación → escalado/rechazada) y los candidatos a salida del surtido (line review), con acción de "programar salida".

### Fuentes de datos

- `src/data/mockNpi.ts` (`productIntros`, `NPI_STAGE`, `npiMargin`, tipo `ProductIntro`).
- `src/data/mockProducts.ts` (`products`).
- `src/utils/assortment.ts` (`exitCandidates`, la misma función usada en `AssortmentPage`'s `LineReviewTab`).
- `src/utils/entityLinks.ts` (`productPath`).
- `src/context/ToastContext.tsx`, `src/context/TraceContext.tsx` (`useTrace`).
- `src/utils/constants.ts` (`TODAY_ISO`).
- `src/utils/formatters.ts`.

### Estado y navegación

- `tab` (`useState`): `altas` | `salidas`.
- `detail` (`useState<ProductIntro | null>`): controla el modal de detalle de una propuesta NPI.
- `scheduled` (`useState<Set<string>>`): SKUs con salida ya programada en la sesión actual (no persiste en `localStorage`, se pierde al recargar).
- `scheduleExit` registra en `TraceContext.log` (actor hardcodeado `"Catalina Saavedra"`, igual que en `ProductDetailPage.tsx`) y dispara un toast.
- Navega a `/productos/:sku` desde los candidatos a salida.

### Estructura visual

- `PageHeader`; 4 `KpiCard` (en incorporación, en piloto, escalados, candidatos a salida).
- `Tabs` con 2 pestañas.
- Tab **Incorporación**: lista de `Card`-botón por propuesta NPI (badges de etapa y riesgo, `MiniField` de margen/compra inicial/piloto/pronóstico); clic abre `NpiDetailModal`.
- Tab **Salidas**: lista de candidatos a salida con botón "Programar salida" (deshabilitado una vez programado).
- `NpiDetailModal`: pipeline visual de 5 etapas (excluye "rechazada"), grid de `DField` con detalle económico y de piloto.

### Lógica de negocio clave

- `npiMargin` (definida en `mockNpi.ts`, no en `utils/`) calcula el margen sobre `suggestedPrice`/`cost` de la propuesta.
- `exitCandidates` (de `utils/assortment.ts`) es la misma fuente que alimenta el tab "Altas y salidas" de `AssortmentPage.tsx`: esta página muestra el mismo listado de candidatos a salida con una acción adicional ("Programar salida") que las otras vistas no ofrecen.
- El pipeline del modal (`stages` = `["propuesta","aprobada","piloto","evaluacion","escalado"]`) está codificado a mano en vez de derivarse del campo `order` que ya existe en `NPI_STAGE` (`mockNpi.ts`), duplicando el orden como fuente de verdad.
- "Programar salida" es una acción puramente de UI/bitácora: no cambia `purchaseStatus` del producto ni ningún dato persistente más allá del `Set` en memoria y la entrada en `TraceContext`.

### Subcomponentes definidos en el archivo

- `NpiDetailModal` — modal de detalle de una propuesta NPI con pipeline de etapas.
- `MiniField` — campo pequeño etiqueta/valor usado en las tarjetas de la lista "Incorporación".
- `DField` — campo etiqueta/valor usado en la grilla del modal de detalle (misma forma que `MiniField` con tipografía distinta).

---

## Hallazgos de limpieza (clean code)

Ver lista de hallazgos en la respuesta final. Todos son de bajo riesgo (no cambian comportamiento) y están acotados a los archivos asignados en esta revisión.
