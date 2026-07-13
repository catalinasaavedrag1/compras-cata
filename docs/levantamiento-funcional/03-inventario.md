# Módulo: Inventario

> Levantamiento funcional derivado exclusivamente del frontend (React + TypeScript, datos mock, en español). No se modificó código. Cuando algo no puede determinarse desde el código se marca como **Definición pendiente** o **Suposición**. La plataforma es una demo de compras para un retailer chileno de mejoramiento del hogar; toda la información proviene de datos mock deterministas.

El módulo "Inventario" agrupa cuatro pantallas: **Cobertura & sobrestock** (`/inventario`), **Venta no capturada** (`/venta-no-capturada`), **Recepciones** (`/recepciones`, compartida con el módulo Comprar) y **Documentos** (`/documentos`). El agrupamiento se confirma en la navegación (`src/components/layout/navItems.tsx`, key `"inventario"`, label "Inventario", `to: "/inventario"`, hint "Cobertura, sobrestock, sin movimiento, recepciones y venta perdida"). Dentro del módulo, "Recepciones" y "Documentos" están marcadas `secondary: true` (accesos útiles pero no principales); "Cobertura & sobrestock" y "Venta no capturada" son las sub-pestañas primarias.

---

## Pantalla 1 — Análisis de inventario (Cobertura & sobrestock)

### Nombre
Análisis de inventario. Título visible en pantalla: **"Análisis de inventario"** (`PageHeader title`). En el menú de navegación aparece como **"Cobertura & sobrestock"** (subítem `to: "/inventario"`, hint "Capital inmovilizado, sobrestock, stock muerto y quiebres"). Descripción bajo el título: **"Capital inmovilizado, sobrestock, stock muerto y quiebres."**

### Ruta(s)
- `/inventario` (única ruta; `src/routes/AppRoutes.tsx:258`).
- Archivo: `src/pages/InventoryAnalysisPage.tsx`.
- Fuentes de datos: `src/data/mockInventory.ts` (agregados) y `src/data/mockProducts.ts` (`products`). Cálculo `frozenCapital` en `src/utils/calculations.ts`.

### Módulo
Inventario.

### Objetivo funcional
Dar una foto del capital inmovilizado en inventario y del riesgo asociado: cuánto vale el inventario, cuánto está en sobrestock (capital a liberar), cuánto es stock muerto y cuántos SKUs están en quiebre. Ayuda a priorizar dónde liberar caja (sobrestock / stock muerto) y dónde hay urgencia de reposición (quiebre). No ejecuta acciones de compra: deriva a otros módulos para actuar.

### Tipo de usuario
No hay lógica de rol en esta pantalla (no importa `useRole` ni `useBuyer`). Es visible e idéntica para ambos roles (`comprador` y `lider`). **Suposición:** pensada para analizar la cartera completa; no distingue alcance por comprador ni filtra por dueño.

### Descripción detallada
Pantalla de solo lectura/análisis (no realiza escrituras ni modifica el borrador de OC). Se compone, de arriba abajo, de: (1) un encabezado `PageHeader`; (2) una fila de 4 KPIs "hero" (`KpiCard`), dos de ellos cliqueables; (3) una fila de 3 "chips" en scroll horizontal con desglose de capital; (4) una tarjeta `Card` "Inventario valorizado" con un `Tabs` de corte y dos `BarList` lado a lado; (5) una tarjeta `Card` "Productos con más inventario inmovilizado" con un `DataTable` de top 6; y (6) una grilla de tres `ListCard` finales (Sobrestock / Sin venta en 90 días / Stock crítico). Los KPIs y cortes provienen de agregados fijos en `mockInventory.ts`; las tablas y listas se derivan en vivo desde `products`.

### Información que muestra
- **KPIs hero (4)** — grid `grid-cols-2 md:grid-cols-4`:
  - **"Inventario valorizado"** = `formatCurrencyCompact(inventoryKpis.totalInventoryValue)` (mock: $334.900.000). Descripción `${inventoryKpis.averageInventoryDays} días prom.` (mock: 62). Tono `info`, ícono `IconInventory`. **No cliqueable.**
  - **"Sobrestock"** = `inventoryKpis.overstockValue` (mock: $58.300.000). Descripción **"Liberar capital"**. Tono `warn`, ícono `IconBox`. **Cliqueable** → `to="/comprar/decisiones?foco=overstock"`.
  - **"Stock muerto"** = `inventoryKpis.deadStockValue` (mock: $12.800.000). Descripción **"Sin venta 90 días"**. Tono `bad`, ícono `IconAlerts`. **No cliqueable.**
  - **"SKUs con quiebre"** = `formatNumber(criticalStock.length)` (conteo derivado de `products`). Descripción **"Ver sin stock"**. Tono `bad`, ícono `IconAlerts`. **Cliqueable** → `to="/productos?stock=1"`.
- **Chips de detalle de capital (3)** en scroll horizontal (`no-scrollbar`), solo informativos:
  - **"Disponible:"** `availableStockValue` (mock $298.400.000).
  - **"Comprometido:"** `committedStockValue` (mock $36.500.000).
  - **"Stock lento:"** `slowStockValue` (mock $41.700.000).
- **Tarjeta "Inventario valorizado"** (descripción de header: "Distribución del inventario según el corte seleccionado"): dos `BarList` — izquierda "Inventario valorizado" (barras `tone: "blue"`, valor `g.inventoryValue`) y derecha "Sobrestock (capital a liberar)" (barras `tone: "violet"`, valor `g.overstockValue`). El set de barras depende del corte seleccionado (ver Filtros).
- **Tarjeta "Productos con más inventario inmovilizado"** (descripción de header: "Capital detenido en stock. Prioridad para liberar caja."): `DataTable` con los 6 productos de mayor `availableStock * cost`.
- **Tres `ListCard`:** Sobrestock (subtítulo "Stock sobre el máximo", badge `violet`), Sin venta en 90 días (subtítulo "Candidatos a stock muerto", badge `amber`), Stock crítico (subtítulo "Quiebre con venta activa", badge `red`). Cada una muestra su conteo y la lista de productos.

### Secciones/bloques
1. `PageHeader` (título + descripción; sin `InfoHint`).
2. Grid de 4 `KpiCard` (hero).
3. Fila de chips (Disponible / Comprometido / Stock lento).
4. `Card` "Inventario valorizado" con `Tabs` (corte) + 2 `BarList`.
5. `Card` "Productos con más inventario inmovilizado" con `DataTable`.
6. Grid de 3 `ListCard` (Sobrestock / Sin venta 90 días / Stock crítico).

### Filtros disponibles
- **Pestañas de corte** (`Tabs`, constante `GROUP_TABS`, estado local `group` con `useState`, default `"category"`): **"Por categoría"** (`inventoryByCategory`, 10 grupos), **"Por tienda/bodega"** (`inventoryByWarehouse`, 3 bodegas: Centro de Distribución, Balmaceda San Javier, Chorrillos San Javier), **"Por rotación"** (`inventoryByRotation`, 4 buckets: "Alta rotación (>10)", "Rotación media (4-10)", "Baja rotación (1-4)", "Sin rotación (<1)"). Cambian ambas `BarList`.
- El estado del corte **no** se sincroniza con la URL (es `useState` local, se pierde al navegar).
- No hay barra de búsqueda, ni filtros por proveedor/fecha, ni selección de comprador.

### Acciones del usuario
- Cambiar el corte de la visualización (pestañas `Tabs`).
- Clic en KPI "Sobrestock" → navega a `/comprar/decisiones?foco=overstock`.
- Clic en KPI "SKUs con quiebre" → navega a `/productos?stock=1`.
- Clic en una fila de la tabla de inmovilizados → `onRowClick` → `navigate("/productos/{sku}")`.
- Clic en la celda "Producto" (SKU + nombre) → `Link` a `/productos/{sku}`.
- Clic en cualquier ítem de las tres `ListCard` → `Link` a `/productos/{sku}`.
- No existen acciones de escritura (no agrega a OC, no exporta, no edita, no reordena).

### Botones y controles
- `Tabs` (selector de corte, 3 opciones). No hay botones de acción propiamente tales; los KPIs cliqueables, las filas y los enlaces actúan como navegación. Los conteos de las `ListCard` se muestran con `Badge`. Los KPIs "Inventario valorizado" y "Stock muerto" no son cliqueables (no tienen `to`).

### Tablas/tarjetas/formularios/componentes
- Componentes: `PageHeader`, `KpiCard`, `Card`/`CardBody`/`CardHeader`, `Tabs`, `BarList`, `DataTable` (`Table`), `StatusBadge`, `Badge`, íconos (`IconInventory`, `IconBox`, `IconAlerts`).
- **Tabla "Productos con más inventario inmovilizado"** — columnas (`frozenColumns`):
  - **Producto** (`key: "product"`): SKU (mono, gris) + nombre, todo enlazado a `/productos/{sku}`.
  - **Stock disp.** (`key: "stock"`, alineado derecha): `formatNumber(availableStock)`.
  - **Venta mes** (`key: "sales"`, derecha, `hideOnMobile`): `formatNumber(salesLast30Days)`.
  - **Días inv.** (`key: "days"`, derecha): `formatNumber(inventoryDays)`.
  - **Capital inmovilizado** (`key: "capital"`, derecha, semibold): `formatCurrency(availableStock * cost)`.
  - **Sobre máximo** (`key: "excess"`, derecha, `hideOnMobile`): `frozenCapital(availableStock, maxStock, cost)`; si > 0 en ámbar, si no un guion "—" gris.
  - **Estado** (`key: "status"`): `StatusBadge kind="purchase"` con `p.purchaseStatus`, `dot={false}`.
  - Ninguna columna es `sortable`; el orden lo fija el cálculo (top 6 por capital inmovilizado).
  - **Vista móvil** (`mobileCard`): SKU, nombre truncado, "Disp. X · Y días inv." y capital compacto.
- **`ListCard`** (componente local del archivo): `CardHeader` con título, descripción/subtítulo y un `Badge` de conteo (`products.length`); `CardBody` con la lista de productos (cada uno es `Link` a `/productos/{sku}` mostrando nombre truncado, "Disp. X · Y días inv." y `formatCurrencyCompact(availableStock * cost)`); estado vacío "Sin productos en esta categoría.".
- No hay formularios en esta pantalla.

### Campos de formularios
No aplica (no hay formularios ni inputs de texto; el único control es el `Tabs` de corte).

### Estados posibles
- **Corte activo:** `category` (default) / `warehouse` / `rotation`.
- **`purchaseStatus`** por producto (tipo `PurchaseStatus`): `buy`, `do_not_buy`, `review`, `on_demand`, `overstock` — se muestran vía `StatusBadge`. En la lógica de esta pantalla solo se filtra explícitamente `overstock` (para la `ListCard` de Sobrestock).
- **`ListCard` vacía:** "Sin productos en esta categoría." (se muestra si el filtro correspondiente no arroja productos).
- **Dependencia del mock:** dado que `products` es fijo, la aparición de sobrestock, sin-venta-90 y stock crítico está predeterminada; no puede provocarse por interacción del usuario. Si el mock no tuviera productos en quiebre, el KPI y la tarjeta mostrarían 0 / estado vacío.
- **No hay** estados de carga, error, spinner ni skeleton (datos síncronos en memoria).

### Navegación hacia otras pantallas
- `/comprar/decisiones?foco=overstock` (desde KPI Sobrestock) — módulo Comprar.
- `/productos?stock=1` (desde KPI SKUs con quiebre) — módulo Productos.
- `/productos/{sku}` (fila de tabla vía `onRowClick`, celda Producto, ítems de las tres `ListCard`) — ficha de producto.

### Flujo funcional completo
1. El usuario entra a `/inventario` y ve la foto de capital (4 KPIs) y el desglose (chips).
2. Cambia el corte (categoría / bodega / rotación) para ver dónde se concentran el inventario y el sobrestock.
3. Identifica los 6 productos con más capital inmovilizado en la tabla y salta a la ficha de cada uno.
4. Revisa las tres listas de riesgo (sobrestock, sin venta 90 días, stock crítico) para decidir acciones.
5. Para actuar sobre el sobrestock salta a `/comprar/decisiones?foco=overstock`; para revisar quiebres a `/productos?stock=1`. Las acciones concretas ocurren en esos módulos, no aquí.

### Reglas de negocio inferibles
- **Capital inmovilizado** de un producto = `availableStock * cost`.
- **Sobre máximo / capital congelado** (`frozenCapital`) = `max(0, availableStock - maxStock) * cost`. Solo cuenta el excedente sobre el stock máximo.
- **Top inmovilizado:** `[...products]` mapeado a `{p, frozen: availableStock * cost}`, ordenado desc por `frozen` y `slice(0,6)`.
- **Sobrestock (lista):** `products.filter(p => p.purchaseStatus === "overstock")`.
- **Sin venta 90 días (lista):** `products.filter(p => p.salesLast90Days <= 6)` — **umbral literal 6 unidades en 90 días** (candidatos a stock muerto).
- **Stock crítico / quiebre (lista y KPI "SKUs con quiebre"):** `products.filter(p => p.availableStock <= 0 && p.salesLast30Days > 0)` — sin stock pero con venta activa en los últimos 30 días.
- **Coexistencia de dos fuentes:** los agregados de KPIs y cortes (`inventoryKpis`, `inventoryByCategory/Warehouse/Rotation`) son cifras mock **fijas** y **no** se recalculan desde `products`. El KPI "Stock muerto" ($12.800.000) es una constante, no está ligado al conteo de la lista "Sin venta en 90 días" (que sí se calcula desde productos). **Suposición:** en producción estos agregados vendrían del backend y serían la fuente única.

### Validaciones
No hay entradas de usuario que validar (sin formularios ni inputs de texto). No aplica.

### Permisos/restricciones
- No hay control de rol/permiso en el componente. Ambos roles ven exactamente lo mismo.
- **Definición pendiente:** si en producción esta vista debería restringirse o filtrarse por comprador/perfil.

### Dudas / definiciones pendientes
- El corte "Por tienda/bodega" lista solo 3 ubicaciones (Centro de Distribución, Balmaceda San Javier, Chorrillos San Javier). Coincide con las bodegas de recepciones; **Suposición:** es el set real de bodegas del retailer.
- Coexistencia de agregados fijos (`inventoryKpis`) y listas calculadas desde `products` puede producir inconsistencias numéricas entre KPIs y tablas. **Definición pendiente:** fuente única de verdad.
- El KPI "Stock muerto" no es cliqueable aunque conceptualmente se relaciona con la lista "Sin venta en 90 días". **Definición pendiente:** si debería enlazar a algún destino.
- El corte no persiste en la URL (estado local). **Definición pendiente:** si debiera ser compartible por deep-link.

---

## Pantalla 2 — Venta no capturada

### Nombre
Venta no capturada. Título en pantalla: **"Venta no capturada"** (`PageHeader title`). El archivo se llama `LostOpportunitiesPage` y el tipo interno es `LostOpportunity`; el concepto es "oportunidades no capturadas". En navegación aparece como "Venta no capturada" (hint "Productos que vendían, quedaron sin stock y no se recompraron"). Descripción bajo el título: **"Productos que vendían, quedaron sin stock y no se recompraron — mientras la categoría siguió vendiendo. Venta que se pierde por no reponer, no por falta de demanda."**

### Ruta(s)
- `/venta-no-capturada` (`src/routes/AppRoutes.tsx:230`).
- **Redirección:** la ruta antigua **`/oportunidades-perdidas`** redirige con `<Navigate replace>` a `/venta-no-capturada` (`AppRoutes.tsx:234-235`). *(Corrección respecto de versiones previas del documento: la ruta que redirige es `/oportunidades-perdidas`, no `/oportunidades`.)*
- Archivo: `src/pages/LostOpportunitiesPage.tsx`; lógica de detección en `src/utils/lostOpportunities.ts`.

### Módulo
Inventario.

### Objetivo funcional
Detectar productos que **vendían históricamente, quedaron sin stock y no se recompraron, mientras la categoría siguió vendiendo** — venta que se pierde por no reponer, no por falta de demanda — cuantificar la venta perdida estimada por mes y permitir agregarlos al borrador de orden de compra ("Reponer").

### Tipo de usuario
Sin lógica de rol explícita; visible e idéntica para `comprador` y `lider`. Usa el contexto de borrador de OC (`useOcDraft`), que es transversal, y el de toasts (`useToast`). **Suposición:** orientada al comprador que repone. No hay filtro por dueño/cartera.

### Descripción detallada
Lista de "oportunidades" derivadas del maestro de productos (`products`) por un patrón heurístico (memoizado: `useMemo(() => lostOpportunities(), [])`). Encabezado con `InfoHint`; 3 KPIs; una `FilterBar` (búsqueda + select de motivo); y una lista de tarjetas `Card`, una por oportunidad, cada una con nombre (enlace), badge de motivo, categoría · proveedor (enlaces) · "vendía ~X/mes · ahora Y/mes", un insight en lenguaje natural, la venta perdida ($/mes en rosa) y un botón "Reponer" que agrega al borrador de OC. Si no hay resultados, `EmptyState`.

### Información que muestra
- **KPIs (3)** — grid `grid-cols-2 lg:grid-cols-3`, todos con ícono `IconBulb`:
  - **"Oportunidades detectadas"** = `formatNumber(all.length)` (total detectado). Tono `warn`.
  - **"Venta perdida estimada"** = `${formatCurrencyCompact(ventaPerdidaTotal)}/mes`, con `ventaPerdidaTotal = all.reduce((a,o)=>a+o.ventaPerdida,0)` (suma sobre el total, no sobre lo filtrado). Tono `bad`.
  - **"Por reponer urgente"** = `formatNumber(all.filter(o => o.tone === "red").length)`. Tono `bad`.
- **Por cada oportunidad (tarjeta `Card`):**
  - Nombre del producto (`Link` a `/productos/{sku}`) + `Badge tone={o.tone}` con `o.motivo`.
  - Línea: categoría (`Link` a `categoryPath`) · proveedor (`Link` a `supplierPath`) · "vendía ~{histMonthly}/mes · ahora {recent}/mes".
  - Insight (`o.insight`).
  - "Venta perdida {formatCurrency(o.ventaPerdida)}/mes" (en `text-rose-600`).
  - Botón **Reponer** / **En OC**.
- **`FilterBar` summary:** `"{N} oportunidad(es) · {$X}/mes en juego"` calculado sobre **los resultados filtrados** (`filtered.reduce(...)`). El texto usa singular "oportunidad" cuando `filtered.length === 1`, si no "oportunidades".

### Secciones/bloques
1. `PageHeader` con `InfoHint` (label "Qué es venta no capturada").
2. Grid de 3 `KpiCard`.
3. `FilterBar` (búsqueda + select de motivo + limpiar).
4. Lista de tarjetas (`Card`/`CardBody`) o `EmptyState` si `filtered.length === 0`.

### Filtros disponibles
- **Búsqueda de texto** (`query`, `useUrlState("q")` — sincronizada con URL): filtra por `name`, `sku` o `category` (`\`${o.name} ${o.sku} ${o.category}\`.toLowerCase().includes(...)`), case-insensitive. Placeholder: "Buscar producto, SKU o categoría".
- **Select "Motivo"** (`motivo`, `useUrlState("motivo")`): opciones = motivos únicos presentes en los datos (`[...new Set(all.map(o => o.motivo))]`). Motivos posibles: "Sin stock y sin recompra", "Agotado, venta cayó", "Categoría creciendo sin reposición".
- **Limpiar** (`onClear`): resetea `query` y `motivo`.

### Acciones del usuario
- Buscar por texto; filtrar por motivo; limpiar filtros.
- Clic en nombre del producto → `/productos/{sku}`.
- Clic en categoría → `categoryPath(o.category)`.
- Clic en proveedor → `supplierPath(o.supplierName)`.
- Botón **"Reponer"** → `reponer(sku, name, supplierName, histMonthly)`: llama `addItem` con `{ sku, productName: name, supplierName, quantity: histMonthly, unitCost: getProductBySku(sku)?.cost ?? 0 }` y muestra toast de éxito `"{name} agregado al borrador de OC ({histMonthly} u.)"`. Tras agregar, el botón cambia a "En OC" y queda deshabilitado (`hasItem(sku)`).

### Botones y controles
- `FilterBar` (input de búsqueda + un select "Motivo" + botón limpiar).
- Botón **Reponer / En OC** por tarjeta: `size="sm"`, `variant` primary (Reponer) → secondary (En OC), ícono `IconPlus` → `IconCheck`, `disabled` cuando `hasItem(sku)`.
- Enlaces de producto / categoría / proveedor.

### Tablas/tarjetas/formularios/componentes
- Componentes: `PageHeader`, `InfoHint`, `KpiCard`, `FilterBar`, `Card`/`CardBody`, `Badge`, `Button`, `EmptyState`, íconos (`IconBulb`, `IconCheck`, `IconPlus`).
- No hay tabla; el listado es de tarjetas. No hay formulario propio: la única "escritura" es agregar al borrador de OC vía contexto (`OcDraftContext`).

### Campos de formularios
No hay formulario editable. Controles: input de búsqueda (`q`) y select de motivo (`motivo`). Los datos que se envían al borrador de OC por cada "Reponer" son: `sku`, `productName` (= nombre), `supplierName`, `quantity` (= `histMonthly`), `unitCost` (= `product.cost ?? 0`).

### Estados posibles
- **Con resultados:** lista de tarjetas.
- **Sin resultados:** `EmptyState` título "Sin oportunidades no capturadas" / descripción "No hay productos que cumplan el patrón con los filtros actuales."
- **Botón por ítem:** "Reponer" (no está en OC) vs. "En OC" (deshabilitado, ya agregado).
- **Motivo/tono por oportunidad** (mutuamente excluyentes, ver Reglas): `red` "Sin stock y sin recompra"; `amber` "Agotado, venta cayó"; `blue` "Categoría creciendo sin reposición".
- **Dependiente del mock:** el conjunto de oportunidades es determinista (deriva de `products`); `mesesSinCompra` se simula con `2 + (hashString(sku) % 5)` → rango 2–6 meses. No hay estados de carga/error.

### Navegación hacia otras pantallas
- `/productos/{sku}` (nombre del producto).
- Ruta de categoría (`categoryPath`).
- Ruta de proveedor (`supplierPath`).
- El toast de éxito no navega, pero el ítem queda en el borrador de OC (gestionable en el módulo Comprar → borradores / seguimiento).

### Flujo funcional completo
1. Al montar, `lostOpportunities()` calcula el conjunto (memoizado).
2. El usuario ve total, venta perdida estimada y urgentes (KPIs).
3. Filtra por texto o motivo si lo necesita.
4. Por cada oportunidad revisa el insight (por qué es oportunidad y no falta de demanda) y la venta perdida.
5. Pulsa "Reponer" para agregar el producto al borrador de OC con la cantidad histórica sugerida; recibe confirmación (toast) y el botón queda como "En OC".
6. El cierre del flujo (emitir la OC) ocurre en el módulo Comprar.

### Reglas de negocio inferibles (patrón de detección, `lostOpportunities.ts`)
Un producto es "oportunidad no capturada" solo si cumple **todas** las condiciones:
- **Vendía antes:** `histMonthly >= 8`, con `histMonthly = round(max(salesLast90Days/3, salesLast180Days/6))` (run-rate mensual histórico, `histMonthlyOf`).
- **Sin stock:** `availableStock <= max(2, reorderPoint * 0.25)`.
- **Venta cayó:** `recent (= salesLast30Days) <= histMonthly * 0.5`.
- **Categoría viva:** `(venta reciente total de la categoría) - recent > 0` (la categoría sigue vendiendo descontando este producto). La venta reciente por categoría se acumula en `catRecent` sumando `salesLast30Days` de todos los productos de la categoría.
- **Venta perdida** = `round((histMonthly - recent) * price)` ($/mes).
- **Meses sin compra** = `2 + (hashString(sku) % 5)` → 2..6 (simulado, no es dato real).
- **Clasificación de motivo/acción/tono:**
  - `recent === 0 && availableStock <= 0` → motivo "Sin stock y sin recompra" / acción "Reponer stock base" / tono `red`.
  - `availableStock <= 0` (resto) → motivo "Agotado, venta cayó" / acción "Comprar ahora" / tono `amber`.
  - resto → motivo "Categoría creciendo sin reposición" / acción "Reactivar compra" / tono `blue`.
- **Insight** (plantilla exacta): `"Vendía ~{histMonthly} u./mes y dejó de comprarse hace {mesesSinCompra} meses. La categoría {category} siguió vendiendo, así que no es falta de demanda: es una oportunidad no capturada de ~{round(ventaPerdida/1000)}k/mes. {accion}."`.
- La lista final se ordena por `ventaPerdida` **descendente**.
- **Cantidad sugerida a reponer** = `histMonthly` (venta mensual histórica), **no** un cálculo por lead time.

### Validaciones
- El botón "Reponer" se deshabilita si el producto ya está en el borrador (`hasItem(sku)`), evitando duplicados.
- `unitCost` cae a 0 si el producto no se encuentra por SKU (`getProductBySku(sku)?.cost ?? 0`).
- No hay validación de formulario (no hay campos editables).

### Permisos/restricciones
- No hay control de rol. Cualquier usuario puede agregar al borrador de OC.
- **Definición pendiente:** si el rol `comprador` debería limitarse a productos de su cartera (aquí no hay filtro por comprador ni por `buyer`).

### Dudas / definiciones pendientes
- `mesesSinCompra` es **simulado** por hash del SKU (no es un dato real). En producción debería venir del historial de compras.
- Los umbrales heurísticos (`histMonthly >= 8`, `availableStock <= max(2, reorderPoint*0.25)`, `recent <= histMonthly*0.5`) son constantes hardcodeadas; **Definición pendiente:** si deben ser parametrizables por categoría/negocio.
- El borrador de OC generado aquí se consolida en el módulo Comprar; el detalle de esa gestión queda fuera de esta pantalla.

---

## Pantalla 3 — Documentos centralizados

### Nombre
Documentos centralizados. Título en pantalla: **"Documentos centralizados"** (`PageHeader title`). En navegación: "Documentos" (hint "Cotizaciones, OC, guías, facturas, listas y contratos"). Descripción bajo el título: **"Cotizaciones, órdenes de compra, guías, facturas, contratos y más, en un solo repositorio buscable."**

### Ruta(s)
- `/documentos` (`src/routes/AppRoutes.tsx:256`).
- Archivo: `src/pages/DocumentsPage.tsx`; datos en `src/data/mockDocuments.ts`.

### Módulo
Inventario (sub-pestaña `secondary` bajo la sección Inventario de la navegación).

### Objetivo funcional
Centralizar en un repositorio buscable los documentos del proceso de compra que hoy viven dispersos en correos y planillas Excel: cotizaciones, órdenes de compra, guías de despacho, facturas, notas de crédito, listas de precios, acuerdos comerciales, contratos, fichas técnicas, certificados y correos. Permite buscar, filtrar y (en demo) ver/descargar.

### Tipo de usuario
Sin lógica de rol; visible e idéntica para ambos roles. **Suposición:** repositorio transversal del área de compras.

### Descripción detallada
Pantalla de repositorio documental: encabezado con `InfoHint`; 4 KPIs por tipo mayor (conteos sobre el total); una `FilterBar` (búsqueda + rango de fechas + selects Tipo y Proveedor); un `Card` que contiene un `Tabs` por tipo (sincronizado con el select Tipo) y un `DataTable` de documentos. Cada fila tiene acciones "Ver" y "Descargar", ambas simuladas (muestran un toast `info` "Demo: documento simulado").

### Información que muestra
- **KPIs (4)** — grid `grid-cols-2 lg:grid-cols-4`, ícono `IconOrders`, conteos con `countBy` sobre el **total** de `documents`:
  - **"Cotizaciones"** = `countBy("cotizacion")` (mock: 4). Descripción "Comparación de precios". Tono `info`.
  - **"Órdenes de compra"** = `countBy("orden_compra")` (mock: 5). Descripción "Compromisos emitidos". Tono `info`.
  - **"Facturas"** = `countBy("factura")` (mock: 5). Descripción "Documentos tributarios". Tono `good`.
  - **"Contratos y acuerdos"** = `countBy("contrato") + countBy("acuerdo")` (mock: 3 + 2 = 5). Descripción "Condiciones vigentes". Tono `neutral`.
- **Tabla de documentos** (`filtered`): Documento (ícono + nombre), Tipo (badge), Proveedor, Relacionado, Fecha, Tamaño, Acción (Ver + Descargar).

### Secciones/bloques
1. `PageHeader` con `InfoHint` (label "Qué es este repositorio").
2. Grid de 4 `KpiCard`.
3. `FilterBar` (búsqueda + rango de fechas + selects Tipo y Proveedor).
4. `Card` con `Tabs` por tipo (borde superior) + `DataTable`.

### Filtros disponibles
- **Búsqueda de texto** (`query`, `useState` local — **no** sincronizada con URL): filtra por `nombre`, `proveedor` o `relacionado` (substring, case-insensitive). Placeholder: "Buscar por nombre, proveedor u OC".
- **Rango de fechas** (`range: IsoRange {from, to}`, `useState`): filtra `d.fecha` con `inRange`. Label del control: "Todas las fechas".
- **Select "Tipo"** (`tipo`, `useState`): opciones = `DOC_TYPE_ORDER` con etiquetas `TYPE_LABELS`. **Comparte estado con las pestañas** (`Tabs value={tipo} onChange={setTipo}`).
- **Select "Proveedor"** (`proveedor`, `useState`): opciones = `documentSuppliers` (8 proveedores mock).
- **Pestañas por tipo** (`Tabs`, constante `TYPE_TABS`): "Todos" (value `""`) + un tab por cada tipo de `DOC_TYPE_ORDER`; mismo estado `tipo` que el select.
- **Limpiar** (`clearFilters`): resetea `query`, `tipo`, `proveedor` y `range`.

### Acciones del usuario
- Buscar; filtrar por tipo (pestaña o select), por proveedor y por rango de fechas; limpiar.
- Ordenar la tabla por columnas `sortable` (Documento, Tipo, Proveedor, Relacionado, Fecha, Tamaño).
- Botón **"Ver"** (por fila) → `handleDownload` → toast `info` "Demo: documento simulado".
- Botón **"Descargar"** (por fila) → mismo `handleDownload` → mismo toast.

### Botones y controles
- `FilterBar` (input, date range, dos selects, botón limpiar).
- `Tabs` de tipo (12 pestañas: "Todos" + 11 tipos).
- Por fila: botón **"Ver"** (`variant="ghost"`, `IconEye`) y **"Descargar"** (`variant="secondary"`, `IconDownload`). En móvil, la misma pareja dentro de la tarjeta.
- Encabezados de columna clicables para ordenar (columnas `sortable`).

### Tablas/tarjetas/formularios/componentes
- Componentes: `PageHeader`, `InfoHint`, `KpiCard`, `Card`, `Tabs`, `DataTable`, `FilterBar`, `Badge`, `Button`, íconos (`IconOrders`, `IconMail`, `IconDownload`, `IconEye`).
- **Tabla** — columnas (`columns`):
  - **Documento** (`nombre`, `sortable`, `sortValue: d.nombre`): ícono en recuadro (`IconMail` si `tipo === "correo"`, si no `IconOrders`) + nombre del archivo.
  - **Tipo** (`sortable`, `sortValue: TYPE_LABELS[d.tipo]`): `Badge tone={TYPE_TONES[d.tipo]}` con `TYPE_LABELS[d.tipo]`.
  - **Proveedor** (`hideOnMobile`, `sortable`).
  - **Relacionado** (`hideOnMobile`, `sortable`): texto mono (una OC, un proveedor o una categoría).
  - **Fecha** (derecha, `sortable`, `sortValue: d.fecha`): `formatDate(d.fecha)`.
  - **Tamaño** (derecha, `hideOnMobile`, `sortable`): `d.tamano` (KB/MB).
  - **Acción** (derecha, no sortable): botones Ver + Descargar.
  - **Vista móvil** (`mobileCard`): ícono, nombre, "proveedor · relacionado", badge de tipo, "fecha · tamaño" y botones Ver/Descargar.
- No hay formulario de carga/subida de documentos.

### Campos de formularios
No hay formulario de datos. Controles de filtro: texto de búsqueda (`query`), rango `from`/`to`, `tipo`, `proveedor`.

### Estados posibles
- **Con resultados:** tabla poblada.
- **Sin resultados:** `emptyMessage` "No hay documentos que coincidan con los filtros. Prueba ampliar el rango de fechas o quitar el tipo."
- **Tipos de documento (11)** con etiqueta y tono de badge (`TYPE_LABELS` / `TYPE_TONES`): Cotización (blue), Orden de compra (violet), Guía de despacho (amber), Factura (green), Nota de crédito (red), Lista de precios (neutral), Acuerdo comercial (blue), Contrato (slate), Ficha técnica (neutral), Certificado (green), Correo (neutral). Todos presentes en el mock (`SEEDS`, 40 documentos).
- **Acciones Ver/Descargar:** solo simuladas (toast). **No existe** visualización ni descarga real por ser demo con datos mock.
- No hay estados de carga/error (datos en memoria).

### Navegación hacia otras pantallas
- Ninguna navegación de ruta desde esta pantalla. Las acciones "Ver"/"Descargar" no navegan; solo muestran un toast. El campo "Relacionado" referencia OC/proveedor/categoría por texto pero **no** es enlace navegable.

### Flujo funcional completo
1. El usuario entra a `/documentos` y ve el conteo por tipo mayor (KPIs).
2. Busca por nombre, proveedor u OC; filtra por tipo (pestaña o select), proveedor y fecha.
3. Ordena por columna si lo necesita.
4. Pulsa "Ver" o "Descargar" en un documento → en demo, recibe el toast "Demo: documento simulado".

### Reglas de negocio inferibles
- Los documentos se ordenan por fecha **descendente** al construir el mock (`.sort((a,b) => b.fecha.localeCompare(a.fecha))`).
- Los KPIs cuentan sobre el **total** de documentos (no sobre los filtrados): dan la "foto del repositorio".
- "Contratos y acuerdos" agrupa dos tipos (`contrato` + `acuerdo`) en un solo KPI.
- El id se deriva del índice: `DOC-{i+1 con padStart(4,"0")}`.
- El nombre de archivo (`buildName`) = `{TYPE_LABELS[tipo]} {detalle}.{ext}`, con extensión `eml` para correo, `xlsx` para lista de precios, `pdf` para el resto.
- El campo "Relacionado" puede ser una OC (ej. "OC-2026-0143"), un proveedor o una categoría, según el seed.
- Tamaño (`formatSize`): si `kb >= 1024` → "{kb/1024} MB" (formato `es-CL`, 1 decimal), si no "{kb} KB".
- `documentSuppliers` = los 8 proveedores de `SUPPLIERS` (Proveedor Andes, FerrePro Chile, Distribuidora Maule, Industrial del Sur, Herramientas Global, Pinturas Nacionales, Agroinsumos Central, Materiales del Pacífico).

### Validaciones
- No hay validaciones de formulario (solo filtros). El filtro de fecha usa `inRange`; la búsqueda es case-insensitive y por substring sobre nombre/proveedor/relacionado.

### Permisos/restricciones
- Sin control de rol. **Definición pendiente:** si ciertos documentos (contratos, acuerdos) deberían restringirse por perfil (p. ej., solo `lider`).

### Dudas / definiciones pendientes
- Ver/Descargar están **sin implementar** (demo, ambos botones llaman al mismo `handleDownload`). **Definición pendiente:** comportamiento real (visor, descarga, permisos).
- No hay carga/subida ni edición de documentos. **Definición pendiente:** si el repositorio debe permitir agregar documentos.
- "Relacionado" no es navegable. **Definición pendiente:** si debería enlazar a la OC/proveedor/categoría.
- Los filtros de esta pantalla usan `useState` local (no URL); **Definición pendiente:** si deben ser compartibles por deep-link como en Venta no capturada.

---

## Pantalla 4 — Recepciones (compartida con el módulo Comprar)

> Esta pantalla es **compartida**: se sirve tanto en `/recepciones` (módulo Inventario) como en `/comprar/recepciones` (módulo Comprar), con el **mismo componente** `ReceptionsPage`. Aquí se documenta en resumen; **el detalle funcional exhaustivo corresponde al levantamiento del módulo Comprar**. Se verificó que lo indicado abajo coincide con el código.

### Nombre
Recepciones. Título en pantalla: **"Recepciones"** (`PageHeader title`). Descripción según rol: líder → "Qué llegó, qué SKUs no despachó cada proveedor y qué encargado de compra debe reordenarlos. Visión global del equipo."; comprador → "Qué viene en camino, qué llegó y qué SKUs el proveedor no despachó para que no se queden sin reponer."

### Ruta(s)
- `/recepciones` (`AppRoutes.tsx:226`) y `/comprar/recepciones` (`AppRoutes.tsx:227`) — ambas renderizan `ReceptionsPage` (sin diferencia de comportamiento).
- Deep-link: `?rid=REC-XXX` abre directamente el `Drawer` de detalle de esa recepción (efecto `useEffect` sobre `searchParams.get("rid")`).
- Archivos: `src/pages/ReceptionsPage.tsx`, `src/pages/receptions/ReceptionDetail.tsx`, `src/pages/receptions/helpers.ts`; datos en `src/data/mockReceptions.ts`; rendimiento de proveedor en `src/utils/supplierPerf.ts`.

### Módulo
Compartida entre Inventario y Comprar (en Inventario aparece como sub-pestaña `secondary`).

### Objetivo funcional
Controlar qué mercadería viene en camino, qué llegó y cómo llegó (completa / parcial / con problemas / atrasada), destacar los **SKUs que el proveedor no despachó** para reordenarlos y evitar quiebres, y (para el líder) ver qué proveedor no cumplió y qué comprador debe reponer.

### Tipo de usuario
- **Comprador (`comprador`):** `scope` forzado a `"mias"` (solo sus recepciones); aterriza en la vista "Por llegar" (`tab` default `"arriving"`). No ve el selector de alcance.
- **Líder (`lider`):** ve un `Select` "Viendo" (Todo el equipo / Mis recepciones ({buyer}) / por comprador); aterriza en "No despachado" (`tab` default `"undelivered"`).
- Depende de `useRole` y `useBuyer`.

### Descripción detallada (breve)
Encabezado que cambia según rol; selector "Viendo" (solo líder); `FilterBar` (búsqueda + rango de fechas + select Proveedor); 5 KPIs que actúan como **selector de vista** (No despachado / Por llegar / Atrasadas / Con problemas / Recibidas); línea de contexto "Mostrando {vista} · {N} · {scopeLabel}" con botón "Ver todas"; y un cuerpo que varía:
- **Vista "No despachado":** `HelpNote`; (solo si `byBuyer.length > 1`) `CollapsibleSection` "Responsables de reordenar" agrupando SKUs faltantes por comprador; tarjetas por proveedor con su rendimiento (`supplierFulfillment`) y las líneas sin despachar, cada una con botón "Reordenar".
- **Otras vistas:** `HelpNote` + `DataTable` de recepciones con barra de % de recepción; al hacer clic abre un `Drawer` con `ReceptionDetail`.

### Información que muestra
- **KPIs/conteos** (`counts`): No despachado (`undeliveredLines.length` = líneas con `received < expected` en recepciones ARRIVED), Por llegar (`in_transit` + `scheduled`), Atrasadas (`delayed`), Con problemas (`with_issues` + `partial`), Recibidas (`received`), Todas (`byFilters.length`).
- **Tabla** (`columns`): Orden/Proveedor (+ comprador si scope "todos", si no bodega), Esperada/Recibida (`hideOnMobile`), Recepción (`unitsReceived/unitsExpected` + barra % con `pct` y aviso "N SKUs sin despachar"), Calidad (Conforme / Con observación según `qualityOk`), Estado (`Badge` de `RECEPTION_STATUS`), "Ver detalle →".
- **`FilterBar` summary:** `"{undelivered} SKUs sin despachar · {arriving} por llegar · {delayed} atrasadas"`.
- **`ReceptionDetail` (Drawer):** alerta de impacto en cobertura (SKUs bajo cobertura mínima); fechas/estado; panel de rendimiento del proveedor (Despacho completo `fillRate%`, Entrega a tiempo `compliance%`, SKUs sin despachar hist. `undeliveredSkus`); nota de calidad (`qualityNote`); detalle por producto con estado de línea (`lineStatus`) y botón "Reordenar".

### Filtros disponibles
- Búsqueda por OC/proveedor/comprador (`q`, `useUrlState`). Rango de fechas (`desde`/`hasta`) sobre `refDate` (recibida si llegó, si no esperada). Select Proveedor (`prov`). Selector de alcance "Viendo" (`alcance`, solo líder). Vista activa (`tab`) vía KPIs. Todos sincronizados con la URL (`useUrlState`).

### Acciones del usuario
- Cambiar alcance (líder), vista (clic en KPIs), filtros; "Ver todas" (fija `tab="all"`).
- Abrir detalle (clic en fila → `setDetail`) / cerrar `Drawer` (limpia `?rid`).
- **Reordenar** un SKU no despachado → `reorder(sku, name, supplierName, missing)`: si ya está, toast info "{name} ya está en el borrador de OC"; si no, `addItem` (cantidad = faltante) + toast de éxito con acción "Ver borrador OC" → `navigate("/comprar/seguimiento")`.
- **"Reordenar todo lo no despachado"** desde el footer del `Drawer` (itera `missingOf(detail)`).
- (Líder) botón "Ver" para saltar al alcance de un comprador (`setScope`).

### Botones y controles
- `Select` "Viendo" (solo líder). `FilterBar` (input + date range + select proveedor + limpiar). 5 `KpiCard` con `active`/`onClick` (selector de vista). Botón "Ver todas". Botón "Reordenar"/"En OC" por línea. Footer del `Drawer` "Reordenar todo lo no despachado". Botones "Ver" en agrupación por comprador. En `ReceptionDetail`, botón por SKU "Reordenar {N} u." / "En borrador de OC".

### Estados posibles
- Estados de recepción (`RECEPTION_STATUS`): `scheduled` (Programada, neutral), `in_transit` (En tránsito, blue), `received` (Recibida, green), `partial` (Parcial, amber), `with_issues` (Con problemas, red), `delayed` (Atrasada, red).
- Estado por línea (`lineStatus`): `received >= expected` → "Completo" (green); `received === 0` → "No despachado" (red); resto → "Parcial" (amber).
- Calidad: Conforme / Con observación (según `qualityOk`).
- Rendimiento de proveedor (`supplierFulfillment.ratingLabel`/`tone`): `fillRate >= 98 && compliance >= 85` → "Cumple bien" (green); `fillRate >= 90 && compliance >= 70` → "Irregular" (amber); resto → "No cumple siempre" (red).
- Vacíos: "Sin SKUs pendientes por despachar. 🎉" (vista No despachado) y "No hay recepciones en esta vista." (tabla).
- Botón por SKU: "Reordenar" vs. "En OC" / "En borrador de OC" (deshabilitado si `hasItem`).

### Navegación hacia otras pantallas
- `/productos/{sku}` (detalle por producto en `ReceptionDetail`), ruta de proveedor (`supplierPath`), `/comprar/seguimiento` (desde la acción del toast del borrador de OC). Deep-link `?rid=`.

### Flujo funcional completo
1. El usuario abre `/recepciones` (o `/comprar/recepciones`); ve KPIs y aterriza en la vista según su rol.
2. Filtra/cambia de vista; en "No despachado" revisa proveedores incumplidores (y, si es líder, responsables).
3. Reordena SKUs faltantes al borrador de OC (cantidad = faltante) o abre el detalle para ver impacto en cobertura.
4. Cierra el flujo (emitir OC) en el módulo Comprar.

### Reglas de negocio inferibles (resumen)
- "Por llegar" = `in_transit` + `scheduled` (constante `ARRIVING`); "Llegadas/ARRIVED" = `received` + `partial` + `with_issues`.
- SKU no despachado = línea con `received < expected` en recepción ARRIVED; faltante = `expected - received`.
- Cantidad a reordenar = faltante (o `expected - received` en "Reordenar todo").
- `pct(r)` = `round(unitsReceived / unitsExpected * 100)` (0 si `unitsExpected <= 0`).
- Impacto en cobertura (`ReceptionDetail`): un SKU faltante está "en riesgo" si `coverageDays(availableStock, salesLast30Days) <= max(7, supplierLeadTimeDays)`; se ignora si `salesLast30Days <= 0`.
- `coverageDays` = `round(availableStock / (monthlySales/30) * 10)/10`; 999 si sin venta y con stock.
- Fill rate / cumplimiento del proveedor calculados en `supplierFulfillment` (ver módulo Comprar).

### Validaciones
- El botón "Reordenar" se deshabilita si `hasItem(sku)`; el helper `reorder` además hace early-return con toast si ya existe.
- `unitCost` cae a 0 si no se encuentra el producto (`getProductBySku(sku)?.cost ?? 0`).

### Permisos/restricciones
- El comprador queda restringido a `scope = "mias"` (se sobrescribe cualquier valor de URL); el selector "Viendo", la sección "Responsables de reordenar" y la columna "resp." (scope "todos") son exclusivos del líder.

### Remisión
**El detalle exhaustivo de esta pantalla (columnas completas, drawer, agrupaciones por proveedor/comprador, cálculo de rendimiento de proveedor, flujo de reorden) se documenta en el levantamiento del módulo Comprar**, ya que la ruta canónica de acción es `/comprar/recepciones` y el reorden alimenta el borrador de OC del módulo Comprar. Aquí se incluye por estar también expuesta en `/recepciones` dentro de la navegación de Inventario.

### Dudas / definiciones pendientes
- Al ser el mismo componente en dos rutas, no hay diferencia de comportamiento entre `/recepciones` y `/comprar/recepciones`. **Definición pendiente:** si deberían diferenciarse por módulo.

---

## RESUMEN DEL MÓDULO: Inventario

### Objetivo
Dar visibilidad y control sobre el capital inmovilizado y el riesgo de inventario del retailer: cuánto vale el inventario y dónde está el sobrestock/stock muerto (Análisis de inventario), qué venta se está perdiendo por no reponer productos que aún tienen demanda (Venta no capturada), qué mercadería llega/llegó y qué no despachó el proveedor (Recepciones), y dónde encontrar cualquier respaldo documental del proceso de compra (Documentos). Todo sobre datos mock deterministas.

### Pantallas
1. **Análisis de inventario** (`/inventario`) — Cobertura, sobrestock, stock muerto, quiebres. Solo análisis; deriva a otros módulos para actuar.
2. **Venta no capturada** (`/venta-no-capturada`, redirige desde `/oportunidades-perdidas`) — Oportunidades de reposición con acción "Reponer" (agrega al borrador de OC).
3. **Recepciones** (`/recepciones`, compartida con `/comprar/recepciones`) — Seguimiento de recepciones y reorden de SKUs no despachados. Detalle en módulo Comprar.
4. **Documentos centralizados** (`/documentos`) — Repositorio buscable de documentos de compra (Ver/Descargar simulados).

### Flujo principal
Detectar riesgo/oportunidad (inventario inmovilizado, venta perdida, SKUs no despachados) → priorizar → actuar: en Venta no capturada y Recepciones se agrega el producto al **borrador de orden de compra** (contexto `OcDraft`), que se consolida en el módulo Comprar; desde Análisis de inventario se salta a `/comprar/decisiones` o `/productos`. Documentos sirve de respaldo transversal.

### Funcionalidades principales
- KPIs de capital y riesgo de inventario, con cortes por categoría/bodega/rotación (10/3/4 grupos).
- Detección heurística de venta no capturada con estimación de venta perdida mensual y reposición al borrador de OC.
- Seguimiento de recepciones con identificación de SKUs no despachados y reorden.
- Repositorio documental (40 docs, 11 tipos) buscable y filtrable por tipo, proveedor y fecha.

### Funcionalidades secundarias
- Listas de riesgo (sobrestock, sin venta 90 días, stock crítico) con enlaces a la ficha de producto.
- Alerta de impacto en cobertura al ver el detalle de una recepción parcial.
- Panel de rendimiento del proveedor (fill rate, cumplimiento) en recepciones.
- Ordenamiento de la tabla de documentos; deep-links (`?rid=` en recepciones, `?foco=`/`?stock=` desde KPIs de inventario).
- Vistas por rol en Recepciones (comprador vs. líder).

### Dependencias con otros módulos
- **Comprar:** el borrador de OC (`OcDraftContext`, `/comprar/seguimiento`), la pantalla de decisiones (`/comprar/decisiones?foco=overstock`) y la propia pantalla de Recepciones (`/comprar/recepciones`).
- **Productos:** fichas de producto (`/productos/{sku}`) y listado con filtro de stock (`/productos?stock=1`); todo el módulo deriva datos de `mockProducts`.
- **Proveedores:** enlaces a ficha de proveedor (`supplierPath`) y cálculo de rendimiento (`supplierPerf`, maestro `mockSuppliers`).
- **Categorías:** enlaces a ficha de categoría (`categoryPath`) desde Venta no capturada.
- **Contextos transversales:** `RoleContext`, `BuyerContext`, `OcDraftContext`, `ToastContext`.

---

## Verificación de cobertura

Auditoría del documento contra el código real (`InventoryAnalysisPage.tsx`, `LostOpportunitiesPage.tsx`, `DocumentsPage.tsx`, `ReceptionsPage.tsx`, `receptions/*`, más datos y utils de soporte).

**Correcciones aplicadas frente a versiones previas del documento:**
- La ruta antigua que redirige a `/venta-no-capturada` es **`/oportunidades-perdidas`** (`AppRoutes.tsx:234-235`), no `/oportunidades` (que no existe como redirect; sí existe `/mi-cartera/oportunidades`, una pantalla distinta).

**Verificado como correcto y ampliado:**
- Rutas y líneas de `AppRoutes.tsx`: `/recepciones` (226), `/comprar/recepciones` (227), `/venta-no-capturada` (230), `/documentos` (256), `/inventario` (258). ✔
- KPIs de inventario, cliqueabilidad real (solo Sobrestock y SKUs con quiebre tienen `to`), valores mock (`inventoryKpis`) y chips exactos. ✔ Se añadieron los buckets de rotación y el nº de grupos por corte (10/3/4).
- Umbrales reales: sin venta 90d `salesLast90Days <= 6`; quiebre `availableStock <= 0 && salesLast30Days > 0`; `frozenCapital = max(0, availableStock - maxStock) * cost`; top 6 por `availableStock * cost`. ✔
- Patrón completo de venta no capturada (`histMonthly >= 8`, `availableStock <= max(2, reorderPoint*0.25)`, `recent <= histMonthly*0.5`, categoría viva), `histMonthly = round(max(s90/3, s180/6))`, venta perdida `round((histMonthly-recent)*price)`, `mesesSinCompra = 2 + hash%5` (2–6, simulado), clasificación motivo/acción/tono y plantilla exacta del insight. ✔ Ampliado.
- Documentos: 40 seeds, 11 tipos con `TYPE_LABELS`/`TYPE_TONES`, KPIs (4/5/5/5 = cotización/OC/factura/contrato+acuerdo), 8 proveedores, `buildName`/`formatSize`, orden por fecha desc, filtros con `useState` local (no URL), Tabs sincronizadas con select Tipo, Ver/Descargar simulados. ✔ Ampliado.
- Recepciones: estados y tonos (`RECEPTION_STATUS`), `lineStatus` (Completo/No despachado/Parcial), umbrales de rating de proveedor (98/85, 90/70), impacto de cobertura `<= max(7, supplierLeadTimeDays)`, deep-link `?rid=`, restricciones por rol, textos de vacío y summary. ✔ Verificado en resumen y remitido al módulo Comprar.

**Elementos confirmados como inexistentes / demo (no son omisiones):**
- Sin estados de carga/error/spinner en ninguna pantalla (datos síncronos en memoria).
- Sin control de rol en Análisis de inventario, Venta no capturada ni Documentos.
- Ver/Descargar de documentos y emisión final de OC no se ejecutan realmente.
- No hay carga/subida ni edición de documentos; "Relacionado" no es navegable.

> **Nota general sobre datos mock:** todas las cifras (inventario valorizado, sobrestock, stock muerto, venta perdida, recepciones, documentos) provienen de archivos mock deterministas (`mockInventory.ts`, `mockProducts.ts`, `mockReceptions.ts`, `mockDocuments.ts`) sin llamadas a backend. Acciones como "Ver"/"Descargar" documentos y la emisión final de OC no se ejecutan realmente en la demo. No existen estados de carga ni de error de red en ninguna de las cuatro pantallas.
