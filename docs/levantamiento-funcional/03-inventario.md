# Módulo: Inventario

> Levantamiento funcional derivado exclusivamente del frontend (React + TypeScript, datos mock, en español). No se modificó código. Cuando algo no puede determinarse desde el código se marca como **Definición pendiente** o **Suposición**. La plataforma es una demo de compras para un retailer chileno de mejoramiento del hogar; toda la información proviene de datos mock deterministas.

El módulo "Inventario" agrupa cuatro pantallas: **Cobertura & sobrestock** (`/inventario`), **Venta no capturada** (`/venta-no-capturada`), **Recepciones** (`/recepciones`, compartida con el módulo Comprar) y **Documentos** (`/documentos`). El agrupamiento se confirma en la navegación (`src/components/layout/navItems.tsx`, key `"inventario"`, hint "Cobertura, sobrestock, sin movimiento, recepciones y venta perdida").

---

## Pantalla 1 — Análisis de inventario (Cobertura & sobrestock)

### Nombre
Análisis de inventario. Título visible en pantalla: **"Análisis de inventario"**. En el menú de navegación aparece como **"Cobertura & sobrestock"** (subítem `to: "/inventario"` dentro de la sección Inventario).

### Ruta(s)
- `/inventario` (única ruta; `src/routes/AppRoutes.tsx:258`).
- Archivo: `src/pages/InventoryAnalysisPage.tsx`.

### Módulo
Inventario.

### Objetivo funcional
Dar una foto del capital inmovilizado en inventario y del riesgo asociado: cuánto vale el inventario, cuánto está en sobrestock (capital a liberar), cuánto es stock muerto y cuántos SKUs están en quiebre. Ayuda a priorizar dónde liberar caja (sobrestock / stock muerto) y dónde hay urgencia de reposición (quiebre). Descripción declarada: "Capital inmovilizado, sobrestock, stock muerto y quiebres."

### Tipo de usuario
No hay lógica de rol en esta pantalla (no usa `useRole` ni `useBuyer`). Es visible para ambos roles (`comprador` y `lider`) por igual. **Suposición:** pensada principalmente para analizar la cartera; no distingue alcance por comprador.

### Descripción detallada
Pantalla de solo análisis (no realiza acciones de escritura). Se compone de: un encabezado; una fila de 4 KPIs hero; una fila de "chips" con desglose de capital; una tarjeta con visualización del inventario valorizado y sobrestock por corte (con pestañas); una tabla de productos con más capital inmovilizado; y tres tarjetas-lista finales (sobrestock, sin venta 90 días, stock crítico). Todo se calcula a partir de `mockInventory.ts` (KPIs y cortes agregados) y `mockProducts.ts` (productos individuales).

### Información que muestra
- **KPIs hero (4):**
  - "Inventario valorizado" = `inventoryKpis.totalInventoryValue` (mock: $334.900.000), descripción `${averageInventoryDays} días prom.` (mock: 62 días). Tono info.
  - "Sobrestock" = `inventoryKpis.overstockValue` (mock: $58.300.000), descripción "Liberar capital". Tono warn. Es cliqueable, navega a `/comprar/decisiones?foco=overstock`.
  - "Stock muerto" = `inventoryKpis.deadStockValue` (mock: $12.800.000), descripción "Sin venta 90 días". Tono bad. No cliqueable.
  - "SKUs con quiebre" = cantidad de `criticalStock` (productos con `availableStock <= 0 && salesLast30Days > 0`), descripción "Ver sin stock". Tono bad. Cliqueable, navega a `/productos?stock=1`.
- **Chips de detalle de capital (3):** Disponible (`availableStockValue`, mock $298.400.000), Comprometido (`committedStockValue`, mock $36.500.000), Stock lento (`slowStockValue`, mock $41.700.000). Solo informativos, en scroll horizontal.
- **Tarjeta "Inventario valorizado":** dos BarList lado a lado — "Inventario valorizado" (barras azules por grupo) y "Sobrestock (capital a liberar)" (barras violeta por grupo). Los datos dependen del corte seleccionado en las pestañas.
- **Tabla "Productos con más inventario inmovilizado":** top 6 productos ordenados por capital inmovilizado (`availableStock * cost`) descendente.
- **Tres tarjetas-lista finales:** Sobrestock, Sin venta en 90 días, Stock crítico, cada una con un badge de conteo y una lista de productos.

### Secciones/bloques
1. `PageHeader` (título + descripción).
2. Grid de 4 `KpiCard` (hero).
3. Fila de chips (Disponible / Comprometido / Stock lento).
4. `Card` "Inventario valorizado" con `Tabs` (corte) + 2 `BarList`.
5. `Card` "Productos con más inventario inmovilizado" con `DataTable`.
6. Grid de 3 `ListCard` (Sobrestock / Sin venta 90 días / Stock crítico).

### Filtros disponibles
- **Pestañas de corte** (`Tabs`, estado `group`, default `"category"`): "Por categoría", "Por tienda/bodega", "Por rotación". Cambian los datos de las dos BarList entre `inventoryByCategory`, `inventoryByWarehouse` e `inventoryByRotation`.
- No hay barra de búsqueda, ni filtros por proveedor/fecha, ni selección de comprador en esta pantalla.

### Acciones del usuario
- Cambiar el corte de la visualización (pestañas).
- Clic en KPI "Sobrestock" → navega a `/comprar/decisiones?foco=overstock`.
- Clic en KPI "SKUs con quiebre" → navega a `/productos?stock=1`.
- Clic en una fila de la tabla de inmovilizados → navega a `/productos/{sku}` (`onRowClick`).
- Clic en el nombre/SKU dentro de la celda "Producto" → `Link` a `/productos/{sku}`.
- Clic en cualquier ítem de las tarjetas-lista → `Link` a `/productos/{sku}`.
- No existen acciones de escritura (no agrega a OC, no exporta, no edita).

### Botones y controles
- `Tabs` (selector de corte). No hay botones de acción propiamente tal; las KPIs cliqueables y las filas/enlaces actúan como navegación. Los conteos en tarjetas-lista se muestran con `Badge`.

### Tablas/tarjetas/formularios/componentes
- Componentes: `PageHeader`, `KpiCard`, `Card`/`CardBody`/`CardHeader`, `Tabs`, `BarList`, `DataTable` (`Table`), `StatusBadge`, `Badge`, íconos (`IconInventory`, `IconBox`, `IconAlerts`).
- **Tabla "Productos con más inventario inmovilizado"** — columnas:
  - Producto (SKU + nombre, enlazado).
  - Stock disp. (`availableStock`, alineado a la derecha).
  - Venta mes (`salesLast30Days`, oculto en móvil).
  - Días inv. (`inventoryDays`).
  - Capital inmovilizado (`availableStock * cost`, formateado como moneda).
  - Sobre máximo (`frozenCapital(availableStock, maxStock, cost)`; si > 0 se muestra en ámbar, si no un guion). Oculto en móvil.
  - Estado (`StatusBadge kind="purchase"` con `purchaseStatus`).
  - Vista móvil: tarjeta con SKU, nombre, disponible + días inv. y capital compacto.
- **ListCard** (componente local): título, subtítulo, badge de conteo y lista de productos con nombre, "Disp. X · Y días inv." y capital compacto; si vacío muestra "Sin productos en esta categoría."
- No hay formularios en esta pantalla.

### Campos de formularios
No aplica (no hay formularios).

### Estados posibles
- **Corte activo:** categoría (default) / tienda-bodega / rotación.
- **`purchaseStatus`** por producto (tipo `PurchaseStatus`): `buy`, `do_not_buy`, `review`, `on_demand`, `overstock` — se muestran vía `StatusBadge`. En esta pantalla solo se filtra explícitamente `overstock`.
- **Tarjetas-lista** con estado vacío: "Sin productos en esta categoría." (existe en el código; se muestra si el filtro no arroja productos).
- **Estados que dependen de los datos mock:** dado que `mockProducts` es fijo, la aparición de sobrestock, sin-venta-90 y stock crítico está preddeterminada. Si el mock no contuviera ningún producto en quiebre, el KPI y la tarjeta mostrarían 0/estado vacío, pero no puede provocarse por interacción del usuario.
- No hay estados de carga/error/spinner (datos síncronos en memoria).

### Navegación hacia otras pantallas
- `/comprar/decisiones?foco=overstock` (desde KPI Sobrestock) — módulo Comprar.
- `/productos?stock=1` (desde KPI SKUs con quiebre) — módulo Productos.
- `/productos/{sku}` (fila de tabla, celda Producto, ítems de tarjetas-lista) — ficha de producto.

### Flujo funcional completo
1. El usuario entra a `/inventario` y ve la foto de capital (4 KPIs) y el desglose (chips).
2. Puede cambiar el corte (categoría / bodega / rotación) para ver dónde se concentra el inventario y el sobrestock.
3. Identifica los 6 productos con más capital inmovilizado en la tabla y puede ir a la ficha de cada uno.
4. Revisa las tres listas de riesgo (sobrestock, sin venta 90 días, stock crítico) para decidir acciones.
5. Para actuar sobre el sobrestock, salta a `/comprar/decisiones?foco=overstock`; para revisar quiebres, a `/productos?stock=1`. Las acciones concretas ocurren en esos otros módulos, no aquí.

### Reglas de negocio inferibles
- **Capital inmovilizado** de un producto = `availableStock * cost`.
- **Sobre máximo / capital congelado** = `max(0, availableStock - maxStock) * cost` (`frozenCapital`). Solo cuenta el excedente sobre el stock máximo.
- **Sobrestock (lista):** productos con `purchaseStatus === "overstock"`.
- **Sin venta 90 días:** productos con `salesLast90Days <= 6` (umbral 6 unidades en 90 días; candidatos a stock muerto).
- **Stock crítico / quiebre:** `availableStock <= 0 && salesLast30Days > 0` (sin stock pero con venta activa reciente).
- **Top inmovilizado:** los 6 mayores por `availableStock * cost`.
- Los valores agregados de KPIs y cortes (`inventoryKpis`, `inventoryByCategory/Warehouse/Rotation`) son cifras mock fijas y **no** se recalculan desde `mockProducts`; conviven dos fuentes (agregados fijos vs. listas derivadas de productos). **Suposición:** en producción estos agregados vendrían del backend.

### Validaciones
No hay entradas de usuario que validar (sin formularios ni inputs de texto). No aplica.

### Permisos/restricciones
- No hay control de rol/permiso en el componente. Ambos roles ven lo mismo.
- **Definición pendiente:** si en producción esta vista debería restringirse por comprador o por perfil.

### Dudas / definiciones pendientes
- ¿Por qué el corte "Por tienda/bodega" lista solo 3 ubicaciones (Centro de Distribución, Balmaceda San Javier, Chorrillos San Javier)? Coincide con las bodegas de recepciones; **Suposición:** es el set real de bodegas del retailer.
- Coexistencia de agregados fijos (`inventoryKpis`) y listas calculadas desde productos puede producir inconsistencias numéricas entre KPIs y tablas. Definición pendiente sobre la fuente única de verdad.
- El KPI "Stock muerto" no es cliqueable aunque conceptualmente se relaciona con la lista "Sin venta en 90 días"; **Definición pendiente:** si debería enlazar a algún destino.

---

## Pantalla 2 — Venta no capturada

### Nombre
Venta no capturada. Título en pantalla: **"Venta no capturada"**. (El archivo se llama `LostOpportunitiesPage`; internamente el concepto es "oportunidades no capturadas".)

### Ruta(s)
- `/venta-no-capturada` (`src/routes/AppRoutes.tsx:230`).
- Existe una ruta antigua `/oportunidades` que redirige (`Navigate`) a `/venta-no-capturada` (`AppRoutes.tsx:235`).
- Archivo: `src/pages/LostOpportunitiesPage.tsx`; lógica de datos en `src/utils/lostOpportunities.ts`.

### Módulo
Inventario.

### Objetivo funcional
Detectar productos que **vendían históricamente, quedaron sin stock y no se recompraron, mientras la categoría siguió vendiendo** — es decir, venta que se pierde por no reponer (no por falta de demanda) — y permitir agregarlos al borrador de orden de compra ("Reponer"). Cuantifica la venta perdida estimada por mes.

### Tipo de usuario
Sin lógica de rol explícita; visible para `comprador` y `lider`. Usa el contexto de borrador de OC (`useOcDraft`), que es transversal. **Suposición:** orientada al comprador que repone.

### Descripción detallada
Lista de "oportunidades" derivadas del maestro de productos por un patrón heurístico. Cada oportunidad se muestra como una tarjeta con nombre, motivo (badge), categoría, proveedor, venta histórica vs. reciente, un insight en lenguaje natural, la venta perdida estimada ($/mes) y un botón "Reponer" que agrega el producto al borrador de OC.

### Información que muestra
- **KPIs (3):**
  - "Oportunidades detectadas" = `all.length` (total de oportunidades encontradas). Tono warn.
  - "Venta perdida estimada" = suma de `ventaPerdida` de todas, formateada como `${monto}/mes`. Tono bad.
  - "Por reponer urgente" = cantidad con `tone === "red"`. Tono bad.
- **Por cada oportunidad (tarjeta):** nombre (enlace a producto), badge de motivo, categoría (enlace) · proveedor (enlace) · "vendía ~X/mes · ahora Y/mes", insight, "Venta perdida $X/mes" (en rosa) y botón Reponer/En OC.
- El `FilterBar` muestra un `summary`: "N oportunidad(es) · $X/mes en juego" con los resultados filtrados.

### Secciones/bloques
1. `PageHeader` con `InfoHint` ("Qué es venta no capturada").
2. Grid de 3 `KpiCard`.
3. `FilterBar` (búsqueda + select de motivo).
4. Lista de tarjetas (`Card`) o `EmptyState` si no hay resultados.

### Filtros disponibles
- **Búsqueda de texto** (`query`, sincronizada con URL vía `useUrlState("q")`): filtra por nombre, SKU o categoría (`name sku category`).
- **Select "Motivo"** (`motivo`, `useUrlState("motivo")`): opciones derivadas de los motivos presentes en los datos (`[...new Set(all.map(o => o.motivo))]`). Los motivos posibles son: "Sin stock y sin recompra", "Agotado, venta cayó", "Categoría creciendo sin reposición".
- **Limpiar** (`onClear`): resetea query y motivo.

### Acciones del usuario
- Buscar por texto; filtrar por motivo; limpiar filtros.
- Clic en nombre del producto → `/productos/{sku}`.
- Clic en categoría → `categoryPath(category)`.
- Clic en proveedor → `supplierPath(supplierName)`.
- Botón **"Reponer"**: agrega el producto al borrador de OC (`addItem`) con cantidad = `histMonthly` (venta mensual histórica) y `unitCost = producto.cost ?? 0`; muestra toast de éxito "{nombre} agregado al borrador de OC (X u.)". Tras agregar, el botón pasa a "En OC" y queda deshabilitado (`hasItem(sku)`).

### Botones y controles
- `FilterBar` (input de búsqueda + select motivo + botón limpiar).
- Botón **Reponer / En OC** por tarjeta: `variant` primary→secondary, ícono `IconPlus`→`IconCheck`, `disabled` cuando ya está en el borrador.
- Enlaces de producto/categoría/proveedor.

### Tablas/tarjetas/formularios/componentes
- Componentes: `PageHeader`, `InfoHint`, `KpiCard`, `FilterBar`, `Card`/`CardBody`, `Badge`, `Button`, `EmptyState`, íconos (`IconBulb`, `IconCheck`, `IconPlus`).
- No hay tabla; el listado es de tarjetas. No hay formulario propio (la única "escritura" es agregar al borrador de OC vía contexto).

### Campos de formularios
No hay formulario. El único input es la búsqueda de texto y el select de motivo. Los datos que se envían al borrador de OC por cada "Reponer" son: `sku`, `productName`, `supplierName`, `quantity` (= `histMonthly`), `unitCost` (= `product.cost`).

### Estados posibles
- **Con resultados:** lista de tarjetas.
- **Sin resultados:** `EmptyState` "Sin oportunidades no capturadas" / "No hay productos que cumplan el patrón con los filtros actuales."
- **Botón por ítem:** "Reponer" (no está en OC) vs. "En OC" (deshabilitado, ya agregado).
- **Motivo/tono por oportunidad:** `red` ("Sin stock y sin recompra", cuando `recent === 0 && availableStock <= 0`), `amber` ("Agotado, venta cayó", cuando `availableStock <= 0`), `blue` ("Categoría creciendo sin reposición", resto).
- **Dependiente de mock:** el conjunto de oportunidades es determinista (deriva de `mockProducts`); `mesesSinCompra` se simula con un hash del SKU (2–6 meses). No hay estados de carga/error.

### Navegación hacia otras pantallas
- `/productos/{sku}` (nombre del producto).
- Ruta de categoría (`categoryPath`).
- Ruta de proveedor (`supplierPath`).
- El toast de éxito no navega, pero el ítem queda en el borrador de OC (visible/gestionable en el módulo Comprar → seguimiento/borrador de OC).

### Flujo funcional completo
1. El sistema calcula oportunidades (`lostOpportunities()`) al montar (memoizado).
2. El usuario ve el total, la venta perdida estimada y las urgentes (KPIs).
3. Filtra por texto o motivo si lo necesita.
4. Por cada oportunidad revisa el insight (por qué es oportunidad y no falta de demanda) y la venta perdida.
5. Pulsa "Reponer" para agregar el producto al borrador de OC con la cantidad histórica sugerida; recibe confirmación (toast) y el botón queda como "En OC".
6. El cierre del flujo (emitir la OC) ocurre en el módulo Comprar.

### Reglas de negocio inferibles (patrón de detección, `lostOpportunities.ts`)
Un producto es "oportunidad no capturada" solo si cumple **todas**:
- **Vendía antes:** `histMonthly >= 8`, con `histMonthly = round(max(salesLast90Days/3, salesLast180Days/6))` (run-rate mensual histórico).
- **Sin stock:** `availableStock <= max(2, reorderPoint * 0.25)`.
- **Venta cayó:** `recent (salesLast30Days) <= histMonthly * 0.5`.
- **Categoría viva:** la venta reciente de la categoría descontando este producto es > 0.
- **Venta perdida** = `round((histMonthly - recent) * price)` ($/mes).
- **Clasificación de motivo/tono/acción:**
  - `recent === 0 && availableStock <= 0` → "Sin stock y sin recompra" / "Reponer stock base" / rojo.
  - `availableStock <= 0` → "Agotado, venta cayó" / "Comprar ahora" / ámbar.
  - resto → "Categoría creciendo sin reposición" / "Reactivar compra" / azul.
- La lista se ordena por `ventaPerdida` descendente.
- **Cantidad sugerida a reponer** = `histMonthly` (la venta mensual histórica), no un cálculo de lead time.

### Validaciones
- El botón "Reponer" se deshabilita si el producto ya está en el borrador (`hasItem(sku)`), evitando duplicados.
- `unitCost` cae a 0 si el producto no se encuentra por SKU (`getProductBySku(sku)?.cost ?? 0`).
- No hay validación de formulario (no hay campos editables).

### Permisos/restricciones
- No hay control de rol. Cualquier usuario puede agregar al borrador de OC.
- **Definición pendiente:** si el rol `comprador` debería estar limitado a productos de su cartera (aquí no hay filtro por comprador).

### Dudas / definiciones pendientes
- `mesesSinCompra` es **simulado** por hash del SKU (no es un dato real). En producción debería venir del historial de compras.
- El umbral "vendía antes" (≥8/mes) y demás umbrales son heurísticos y podrían ser parametrizables. Definición pendiente.
- El borrador de OC generado aquí se consolida en el módulo Comprar; el detalle de esa gestión queda fuera de esta pantalla.

---

## Pantalla 3 — Documentos centralizados

### Nombre
Documentos centralizados. Título en pantalla: **"Documentos centralizados"**. En navegación: "Documentos".

### Ruta(s)
- `/documentos` (`src/routes/AppRoutes.tsx:256`).
- Archivo: `src/pages/DocumentsPage.tsx`; datos en `src/data/mockDocuments.ts`.

### Módulo
Inventario (agrupado bajo la sección Inventario de la navegación).

### Objetivo funcional
Centralizar en un repositorio buscable los documentos del proceso de compra que hoy viven dispersos en correos y planillas Excel: cotizaciones, órdenes de compra, guías de despacho, facturas, notas de crédito, listas de precios, acuerdos, contratos, fichas técnicas, certificados y correos. Permite buscar, filtrar y (en demo) ver/descargar.

### Tipo de usuario
Sin lógica de rol; visible para ambos roles. **Suposición:** repositorio transversal del área de compras.

### Descripción detallada
Pantalla de repositorio documental: 4 KPIs por tipo mayor, una barra de filtros (búsqueda + rango de fechas + tipo + proveedor), pestañas por tipo, y una tabla de documentos con acciones "Ver" y "Descargar" (ambas simuladas — muestran un toast "Demo: documento simulado").

### Información que muestra
- **KPIs (4):** conteos por tipo sobre el total de documentos:
  - "Cotizaciones" = `countBy("cotizacion")`, descripción "Comparación de precios", tono info.
  - "Órdenes de compra" = `countBy("orden_compra")`, "Compromisos emitidos", tono info.
  - "Facturas" = `countBy("factura")`, "Documentos tributarios", tono good.
  - "Contratos y acuerdos" = `countBy("contrato") + countBy("acuerdo")`, "Condiciones vigentes", tono neutral.
- **Tabla de documentos** (los filtrados): Documento (ícono según tipo + nombre), Tipo (badge), Proveedor, Relacionado (OC/proveedor/categoría), Fecha, Tamaño, Acción.

### Secciones/bloques
1. `PageHeader` con `InfoHint` ("Qué es este repositorio").
2. Grid de 4 `KpiCard`.
3. `FilterBar` (búsqueda + rango de fechas + selects Tipo y Proveedor).
4. `Card` con `Tabs` por tipo + `DataTable`.

### Filtros disponibles
- **Búsqueda de texto** (`query`, estado local `useState`): filtra por nombre, proveedor o relacionado.
- **Rango de fechas** (`range: IsoRange {from,to}`): filtra por `d.fecha` con `inRange` (etiqueta "Todas las fechas").
- **Select "Tipo"**: opciones = `DOC_TYPE_ORDER` con etiquetas `TYPE_LABELS`. Está sincronizado con las pestañas (mismo estado `tipo`).
- **Select "Proveedor"**: opciones = `documentSuppliers` (8 proveedores mock).
- **Pestañas por tipo** (`Tabs`): "Todos" + un tab por cada tipo; comparten el estado `tipo` con el select.
- **Limpiar** (`clearFilters`): resetea query, tipo, proveedor y rango.

### Acciones del usuario
- Buscar; filtrar por tipo (pestaña o select), por proveedor y por rango de fechas; limpiar.
- Ordenar la tabla por columnas sortables (Documento, Tipo, Proveedor, Relacionado, Fecha, Tamaño).
- Botón **"Ver"** (por fila) → `handleDownload` → toast "Demo: documento simulado".
- Botón **"Descargar"** (por fila) → mismo `handleDownload` → toast "Demo: documento simulado".

### Botones y controles
- `FilterBar` (input, date range, dos selects, botón limpiar).
- `Tabs` de tipo.
- Por fila: botón "Ver" (ghost, `IconEye`) y "Descargar" (secondary, `IconDownload`). En móvil, la misma pareja en la tarjeta.
- Encabezados de columna clicables para ordenar (columnas `sortable`).

### Tablas/tarjetas/formularios/componentes
- Componentes: `PageHeader`, `InfoHint`, `KpiCard`, `Card`, `Tabs`, `DataTable`, `FilterBar`, `Badge`, `Button`, íconos (`IconOrders`, `IconMail`, `IconDownload`, `IconEye`).
- **Tabla** columnas: Documento (ícono `IconMail` si tipo `correo`, si no `IconOrders`; + nombre), Tipo (`Badge` con `TYPE_TONES`/`TYPE_LABELS`), Proveedor (oculto móvil), Relacionado (mono, oculto móvil), Fecha (formateada, alineada derecha), Tamaño (oculto móvil), Acción (Ver + Descargar).
- Vista móvil: tarjeta con ícono, nombre, proveedor · relacionado, badge de tipo, fecha · tamaño, y botones Ver/Descargar.
- No hay formulario de carga/subida de documentos.

### Campos de formularios
No hay formulario de datos. Controles de filtro: texto de búsqueda, rango `from`/`to`, tipo, proveedor.

### Estados posibles
- **Con resultados:** tabla poblada.
- **Sin resultados:** `emptyMessage` "No hay documentos que coincidan con los filtros. Prueba ampliar el rango de fechas o quitar el tipo."
- **Tipos de documento** (11): cotización, orden de compra, guía de despacho, factura, nota de crédito, lista de precios, acuerdo comercial, contrato, ficha técnica, certificado, correo. Todos presentes en el mock (`SEEDS`, 40 documentos).
- **Acciones Ver/Descargar:** solo simuladas (toast). **No existe** visualización ni descarga real de archivos por ser demo con datos mock.
- No hay estados de carga/error (datos en memoria).

### Navegación hacia otras pantallas
- Ninguna navegación de ruta desde esta pantalla. Las acciones "Ver"/"Descargar" no navegan; solo muestran un toast informativo. Los documentos referencian OC/proveedores/categorías por texto (`relacionado`) pero **no** son enlaces navegables.

### Flujo funcional completo
1. El usuario entra a `/documentos` y ve el conteo por tipo mayor (KPIs).
2. Busca por nombre, proveedor u OC; filtra por tipo (pestaña o select), proveedor y fecha.
3. Ordena por columna si lo necesita.
4. Pulsa "Ver" o "Descargar" en un documento → en demo, recibe el toast "Demo: documento simulado".

### Reglas de negocio inferibles
- Los documentos se ordenan por fecha descendente al construir el mock (`sort((a,b) => b.fecha.localeCompare(a.fecha))`).
- Los KPIs cuentan sobre el **total** de documentos (no sobre los filtrados) — dan la "foto del repositorio".
- "Contratos y acuerdos" agrupa dos tipos en un solo KPI.
- El nombre de archivo se deriva del tipo + detalle + extensión (`eml` para correo, `xlsx` para lista de precios, `pdf` para el resto).
- El campo "Relacionado" puede ser una OC (ej. "OC-2026-0143"), un proveedor o una categoría, según el tipo de documento.
- Tamaño se formatea a KB/MB desde `kb` del seed.

### Validaciones
- No hay validaciones de formulario (solo filtros). El filtro de fecha usa `inRange`; búsqueda es case-insensitive y por substring.

### Permisos/restricciones
- Sin control de rol. **Definición pendiente:** si ciertos documentos (contratos, acuerdos) deberían restringirse por perfil (p. ej., solo `lider`).

### Dudas / definiciones pendientes
- Ver/Descargar están **sin implementar** (demo). Definición pendiente del comportamiento real (visor, descarga, permisos).
- No hay carga/subida ni edición de documentos. **Definición pendiente:** si el repositorio debe permitir agregar documentos.
- "Relacionado" no es navegable; **Definición pendiente:** si debería enlazar a la OC/proveedor/categoría.

---

## Pantalla 4 — Recepciones (compartida con el módulo Comprar)

> Esta pantalla es **compartida**: se sirve tanto en `/recepciones` (módulo Inventario) como en `/comprar/recepciones` (módulo Comprar), con el **mismo componente** `ReceptionsPage`. Aquí se documenta brevemente; **el detalle funcional completo corresponde al levantamiento del módulo Comprar**.

### Nombre
Recepciones. Título en pantalla: **"Recepciones"**.

### Ruta(s)
- `/recepciones` (`AppRoutes.tsx:226`) y `/comprar/recepciones` (`AppRoutes.tsx:227`) — ambas renderizan `ReceptionsPage`.
- Deep-link: `?rid=REC-XXX` abre directamente el detalle de esa recepción.
- Archivos: `src/pages/ReceptionsPage.tsx`, `src/pages/receptions/ReceptionDetail.tsx`, `src/pages/receptions/helpers.ts`; datos en `src/data/mockReceptions.ts`; rendimiento de proveedor en `src/utils/supplierPerf.ts`.

### Módulo
Compartida entre Inventario y Comprar.

### Objetivo funcional
Controlar qué mercadería viene en camino, qué llegó y cómo llegó (completa / parcial / con problemas de calidad / atrasada), destacar los **SKUs que el proveedor no despachó** para reordenarlos y evitar quiebres, y (para el líder) ver qué proveedor no cumplió y qué comprador debe reponer.

### Tipo de usuario
- **Comprador (`comprador`):** solo ve sus propias recepciones (`scope` forzado a `"mias"`); aterriza en la vista "Por llegar". No ve el selector de alcance.
- **Líder (`lider`):** ve un selector "Viendo" (Todo el equipo / Mis recepciones / por comprador); aterriza en la vista "No despachado" (accionable: responsables + proveedores incumplidores).
- Depende de `useRole` y `useBuyer`.

### Descripción detallada (breve)
Encabezado que cambia según rol; selector de alcance (solo líder); `FilterBar` (búsqueda + rango + proveedor); 5 KPIs que actúan como **selector de vista** (No despachado / Por llegar / Atrasadas / Con problemas / Recibidas); línea de contexto "Mostrando …"; y el cuerpo, que varía:
- **Vista "No despachado":** nota de ayuda; (para líder, si aplica) sección colapsable "Responsables de reordenar" agrupando SKUs faltantes por comprador; tarjetas por proveedor con su rendimiento (`supplierFulfillment`) y las líneas sin despachar, cada una con botón "Reordenar".
- **Otras vistas:** tabla de recepciones (`DataTable`) con barra de % de recepción, calidad y estado; al hacer clic abre un `Drawer` con `ReceptionDetail`.

### Información que muestra
- KPIs/conteos: No despachado (líneas con `received < expected` en recepciones ya llegadas), Por llegar (`in_transit`/`scheduled`), Atrasadas (`delayed`), Con problemas (`with_issues`/`partial`), Recibidas (`received`), Todas.
- Tabla: Orden/Proveedor (+ comprador o bodega), Esperada/Recibida, Recepción (`unitsReceived/unitsExpected` + barra %), Calidad (Conforme / Con observación según `qualityOk`), Estado (badge `RECEPTION_STATUS`), "Ver detalle →".
- Detalle (`ReceptionDetail`): alerta de impacto en cobertura (SKUs bajo cobertura mínima), fechas/estado, panel de rendimiento del proveedor (fill rate, cumplimiento a tiempo, SKUs sin despachar hist.), nota de calidad, y detalle por producto con estado por línea (Completo/Parcial/No despachado) y botón "Reordenar".

### Filtros disponibles
- Búsqueda por OC/proveedor/comprador (`q`). Rango de fechas (esperada/recibida, `desde`/`hasta`). Select Proveedor (`prov`). Selector de alcance (`alcance`, solo líder). Vista activa (`tab`) vía KPIs. Todos sincronizados con la URL (`useUrlState`).

### Acciones del usuario
- Cambiar alcance (líder), vista (KPIs), filtros; "Ver todas".
- Abrir detalle (clic en fila) / cerrar drawer.
- **Reordenar** un SKU no despachado → agrega al borrador de OC (`addItem`, cantidad = faltante) con toast que ofrece "Ver borrador OC" (`/comprar/seguimiento`).
- **"Reordenar todo lo no despachado"** desde el footer del drawer.
- (Líder) botón "Ver" para saltar al alcance de un comprador.

### Estados posibles
- Estados de recepción (`ReceptionStatus`): `scheduled` (Programada), `in_transit` (En tránsito), `received` (Recibida), `partial` (Parcial), `with_issues` (Con problemas), `delayed` (Atrasada).
- Estado por línea: Completo / Parcial / No despachado (`lineStatus`).
- Calidad: Conforme / Con observación (`qualityOk`).
- Rendimiento de proveedor: "Cumple bien" (verde) / "Irregular" (ámbar) / "No cumple siempre" (rojo).
- Vacíos: "Sin SKUs pendientes por despachar. 🎉" (vista No despachado) y "No hay recepciones en esta vista." (tabla).
- Botón por SKU: "Reordenar" vs. "En OC"/"En borrador de OC" (deshabilitado si `hasItem`).

### Navegación hacia otras pantallas
- `/productos/{sku}` (detalle por producto), ruta de proveedor (`supplierPath`), `/comprar/seguimiento` (desde el toast del borrador de OC). Deep-link `?rid=`.

### Reglas de negocio inferibles (resumen)
- "Por llegar" = estados `in_transit` + `scheduled`; "Llegadas" = `received` + `partial` + `with_issues`.
- SKU no despachado = línea con `received < expected` en recepción llegada; faltante = `expected - received`.
- Cantidad a reordenar = faltante (o `expected - received` en "Reordenar todo").
- Impacto en cobertura: un SKU faltante está "en riesgo" si `coverageDays(availableStock, salesLast30Days) <= max(7, supplierLeadTimeDays)`.
- Fill rate / cumplimiento del proveedor calculados en `supplierFulfillment` (ver módulo Comprar).

### Permisos/restricciones
- El comprador queda restringido a `scope = "mias"`; el selector de alcance y las agrupaciones de equipo son exclusivos del líder.

### Remisión
**El detalle exhaustivo de esta pantalla (columnas, drawer, agrupaciones, cálculo de rendimiento de proveedor, flujo de reorden) se documenta en el levantamiento del módulo Comprar**, ya que la ruta canónica de acción es `/comprar/recepciones` y el reorden alimenta el borrador de OC del módulo Comprar. Aquí se incluye por estar también expuesta en `/recepciones` dentro de la navegación de Inventario.

### Dudas / definiciones pendientes
- Al ser el mismo componente en dos rutas, no hay diferencia de comportamiento entre `/recepciones` y `/comprar/recepciones`. **Definición pendiente:** si deberían diferenciarse por módulo.

---

## RESUMEN DEL MÓDULO: Inventario

### Objetivo
Dar visibilidad y control sobre el capital inmovilizado y el riesgo de inventario del retailer: cuánto vale el inventario y dónde está el sobrestock/stock muerto (Análisis de inventario), qué venta se está perdiendo por no reponer productos que aún tienen demanda (Venta no capturada), qué mercadería llega/llegó y qué no despachó el proveedor (Recepciones), y dónde encontrar cualquier respaldo documental del proceso de compra (Documentos). Todo sobre datos mock deterministas.

### Pantallas
1. **Análisis de inventario** (`/inventario`) — Cobertura, sobrestock, stock muerto, quiebres. Solo análisis.
2. **Venta no capturada** (`/venta-no-capturada`, redirige desde `/oportunidades`) — Oportunidades de reposición con acción "Reponer" (agrega al borrador de OC).
3. **Recepciones** (`/recepciones`, compartida con `/comprar/recepciones`) — Seguimiento de recepciones y reorden de SKUs no despachados. Detalle en módulo Comprar.
4. **Documentos centralizados** (`/documentos`) — Repositorio buscable de documentos de compra (Ver/Descargar simulados).

### Flujo principal
Detectar riesgo/oportunidad (inventario inmovilizado, venta perdida, SKUs no despachados) → priorizar → actuar: en Venta no capturada y Recepciones se agrega el producto al **borrador de orden de compra** (contexto `OcDraft`), que se consolida en el módulo Comprar; desde Análisis de inventario se salta a `/comprar/decisiones` o `/productos` para actuar. Documentos sirve de respaldo transversal.

### Funcionalidades principales
- KPIs de capital y riesgo de inventario, con cortes por categoría/bodega/rotación.
- Detección heurística de venta no capturada con estimación de venta perdida mensual y reposición al borrador de OC.
- Seguimiento de recepciones con identificación de SKUs no despachados y reorden.
- Repositorio documental buscable y filtrable por tipo, proveedor y fecha.

### Funcionalidades secundarias
- Listas de riesgo (sobrestock, sin venta 90 días, stock crítico) con enlaces a la ficha de producto.
- Alerta de impacto en cobertura al ver el detalle de una recepción parcial.
- Panel de rendimiento del proveedor (fill rate, cumplimiento) en recepciones.
- Ordenamiento de la tabla de documentos; deep-links (`?rid=` en recepciones, `?foco=`/`?stock=` en navegación de KPIs).
- Vistas por rol en Recepciones (comprador vs. líder).

### Dependencias con otros módulos
- **Comprar:** el borrador de OC (`OcDraftContext`, `/comprar/seguimiento`), la pantalla de decisiones (`/comprar/decisiones?foco=overstock`) y la propia pantalla de Recepciones (`/comprar/recepciones`).
- **Productos:** fichas de producto (`/productos/{sku}`) y listado con filtro de stock (`/productos?stock=1`); todo el módulo deriva datos de `mockProducts`.
- **Proveedores:** enlaces a la ficha de proveedor (`supplierPath`) y cálculo de rendimiento (`supplierPerf`, maestro `mockSuppliers`).
- **Categorías:** enlaces a la ficha de categoría (`categoryPath`) desde Venta no capturada.
- **Contextos transversales:** `RoleContext`, `BuyerContext`, `OcDraftContext`, `ToastContext`.

---

> **Nota general sobre datos mock:** todas las cifras (inventario valorizado, sobrestock, stock muerto, venta perdida, recepciones, documentos) provienen de archivos mock deterministas (`mockInventory.ts`, `mockProducts.ts`, `mockReceptions.ts`, `mockDocuments.ts`) sin llamadas a backend. Acciones como "Ver"/"Descargar" documentos y la emisión final de OC no se ejecutan realmente en la demo. No existen estados de carga ni de error de red en ninguna de las cuatro pantallas.
