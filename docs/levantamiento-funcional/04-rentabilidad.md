# Módulo: Rentabilidad

> Levantamiento funcional realizado exclusivamente desde el frontend (React + TypeScript, en español), sobre datos **mock/simulados** deterministas. No se modificó código. Cuando un dato no está definido en el código se marca como **Definición pendiente**; cuando se infiere razonablemente pero no está explícito, se marca como **Suposición**.

Este módulo agrupa las pantallas orientadas a analizar la **rentabilidad y el desempeño comercial** de la compra: ranking de venta y liquidación, análisis de ventas, margen por canal, estacionalidad y canales, variaciones de costo (alzas de precio) y presupuesto (Open-to-Buy).

Roles del sistema: `comprador` y `lider`. En este módulo solo algunas pantallas aplican lógica explícita de rol/alcance (ver cada pantalla).

---

## 1. Pantalla: Ranking & liquidación

### Nombre
Ranking & liquidación (título en encabezado: **"Ranking & liquidación"**).

### Ruta(s)
`/analisis-compra`

### Módulo
Rentabilidad.

### Objetivo funcional
"Comprar bien": identificar los **top productos, proveedores y marcas** por venta de los últimos 30 días y detectar qué productos conviene **liquidar o descontinuar** (sin rotación, margen bajo/negativo o sobrestock).

### Tipo de usuario
`comprador` y `lider`. La pantalla aplica **alcance por rol** de forma explícita:
- `lider`: ve **todo el catálogo**.
- `comprador`: ve solo **sus categorías** (`myCategories` del `BuyerContext`), filtrando los productos cuya `category` esté en sus categorías asignadas.

El texto del encabezado refleja el alcance: "Alcance: todo el catálogo" o "Alcance: tus categorías".

### Descripción detallada
La página toma la colección `products` (vía `useCollection`, con fallback a `mockProducts`), la restringe según el rol (`scoped`) y sobre ese conjunto calcula KPIs, rankings agregados y la lista de candidatos a liquidación. La navegación entre vistas se hace por **tabs** (pestañas), y el estado de la pestaña y de los filtros se persiste en la URL (`useUrlState`).

### Información que muestra
- **KPIs (4 tarjetas):**
  1. **SKUs en alcance**: cantidad de productos del alcance (`scoped.length`). Descripción = etiqueta del alcance.
  2. **Venta 30d**: suma de `salesLast30Days × price` sobre el alcance (formato compacto).
  3. **Candidatos a liquidar**: cantidad de candidatos a liquidación. Tarjeta cliqueable → cambia a la pestaña "Liquidar / descontinuar".
  4. **Sin rotación (30d)**: cantidad de productos con `salesLast30Days === 0` y `availableStock > 0`. Tarjeta cliqueable → pestaña "Liquidar".
- **Tabla de Top productos** (hasta 100): Producto (nombre + SKU), Categoría, Marca, Proveedor (enlace), Venta 30d (unidades), Stock, Cobertura (días), Margen %, Rotación (badge Alta/Media/Baja).
- **Tabla de Top proveedores** (agregado): Proveedor (enlace), Nº SKUs, Venta 30d (CLP), Margen prom. %, Valor stock.
- **Tabla de Top marcas** (agregado): Marca, Nº SKUs, Venta 30d (CLP), Margen prom. %, Valor stock.
- **Tabla de Liquidar / descontinuar**: Producto (nombre + SKU + categoría), Motivo (badge), Métrica clave (valor + etiqueta), Acción (botón).

### Secciones/bloques
1. Encabezado (`PageHeader`) con título y descripción con alcance.
2. Grid de 4 KPIs (`KpiCard`).
3. Barra de pestañas (`Tabs`): "Top productos", "Top proveedores", "Top marcas", "Liquidar / descontinuar" (cada una con contador).
4. Contenido según la pestaña activa:
   - **Top productos**: `FilterBar` + aviso de "Mostrando top N" (si aplica) + `Card` con `DataTable`.
   - **Top proveedores**: `Card` con `CardHeader` + `DataTable`.
   - **Top marcas**: `Card` con `CardHeader` + `DataTable`.
   - **Liquidar / descontinuar**: `HelpNote` con criterios + `Card` con `DataTable`.

### Filtros disponibles
Aplican solo en la pestaña **Top productos** (`FilterBar`):
- **Búsqueda de texto** (por SKU, nombre o marca).
- **Categoría** (select, valores únicos del alcance).
- **Marca** (select, valores únicos del alcance).
- **Proveedor** (select, valores únicos del alcance con proveedor asignado).
- **Botón "Limpiar"** (`onClear` → resetea búsqueda, categoría, marca y proveedor).

Las pestañas Top proveedores, Top marcas y Liquidar **no** tienen `FilterBar` propia; muestran el agregado del alcance completo.

### Acciones del usuario
- Cambiar de pestaña.
- Cliquear los KPIs "Candidatos a liquidar" / "Sin rotación" para saltar a la pestaña de liquidación.
- Buscar y filtrar productos.
- Ordenar tablas por columna (orden por defecto: productos por Venta 30d desc.; proveedores/marcas por Venta 30d desc.).
- Cliquear una fila de producto → navega a la ficha del producto (`productPath(sku)`).
- Cliquear una fila/enlace de proveedor → navega a la ficha del proveedor (`supplierPath`).
- En liquidación, cliquear el botón de acción sugerida (navegación contextual, ver más abajo).

### Botones y controles
- `Tabs` (4 pestañas con contador).
- `KpiCard` cliqueables (2 de las 4).
- `FilterBar` (input de búsqueda, 3 selects, botón Limpiar).
- Encabezados de columna ordenables (`DataTable`).
- Botón de acción por candidato (`Button` size sm, variante secondary): etiqueta variable ("Revisar surtido", "Ver producto", "Crear campaña de liquidación").

### Tablas / tarjetas / formularios / componentes
- Tablas: `DataTable` (productos, proveedores, marcas, liquidación) con versión `mobileCard`.
- Tarjetas: `KpiCard`, `Card`, `CardHeader`.
- Otros: `Badge` (rotación y motivos), `HelpNote` (criterios de liquidación), `Tabs`, `FilterBar`.
- No hay formularios de entrada de datos (solo filtros).

### Campos de formularios
No aplica (no hay formularios de captura). Los únicos campos son los controles de filtro (texto + 3 selects).

### Estados posibles
- **Con datos**: siempre habrá productos con los mocks actuales.
- **Filtro sin resultados** en la tabla de productos: `DataTable` mostraría su mensaje por defecto (no se pasa `emptyMessage` en la de productos). **Suposición**: muestra un vacío estándar del componente.
- **Sin candidatos a liquidar**: `emptyMessage` = "No hay productos para liquidar o descontinuar en tu alcance." (posible si el alcance no genera candidatos; con los mocks actuales normalmente sí hay).
- **Truncado**: si hay más de 100 productos filtrados, se muestra aviso "Mostrando top 100 de N".
- **Alcance vacío (comprador sin categorías)**: no hay manejo explícito; se mostrarían tablas/KPIs en cero. **Suposición**.

### Navegación hacia otras pantallas
- Ficha de producto: `/productos/:sku` (clic en fila o en enlaces).
- Ficha de proveedor: `supplierPath(nombre)` (clic en fila/enlace de proveedor).
- Acciones de liquidación (según motivo):
  - Sin rotación → **`/surtido-redundante`** ("Revisar surtido").
  - Margen bajo/negativo → ficha del producto ("Ver producto").
  - Sobrestock → **`/campanas`** ("Crear campaña de liquidación").

### Flujo funcional completo
1. Se cargan los productos y se restringe el conjunto según el rol.
2. Se calculan KPIs (SKUs, venta 30d, candidatos, sin rotación).
3. El usuario explora rankings por pestaña; puede filtrar/buscar/ordenar (pestaña productos).
4. Para liquidación, cada producto pasa por `buildLiquidationCandidate`, que asigna motivo, severidad, métrica y acción.
5. Los candidatos se ordenan por **severidad** (mayor primero) y se listan con su acción sugerida.
6. El usuario navega a la pantalla de acción correspondiente o a la ficha del producto/proveedor.

### Reglas de negocio inferibles
- **Rotación (badge):** `≥ 8` = Alta rotación (verde); `≥ 4` = Media (ámbar); `< 4` = Baja (rojo).
- **Umbral de margen bajo:** `LOW_MARGIN_PCT = 20` (%). Márgenes bajo 20% se resaltan.
- **Umbral de sobrestock:** `OVERSTOCK_COVERAGE_DAYS = 120` días de cobertura.
- **Criterios de liquidación** (excluyentes, evaluados en orden):
  1. **Sin rotación**: `salesLast30Days === 0` y `availableStock > 0`. Métrica = capital detenido (`availableStock × cost`). Severidad = `3 + min(capital/1.000.000, 5)`.
  2. **Margen bajo/negativo**: `margin < 20`. Severidad `4` si margen `≤ 0` (etiqueta "Margen negativo"), si no `2` ("Margen bajo"). Métrica = margen %.
  3. **Sobrestock**: `cobertura ≥ 120` días y `salesLast30Days > 0`. Severidad = `1 + min(cobertura/200, 2)`. Métrica = cobertura en días.
- **Venta 30d valorizada** = `salesLast30Days × price` (usa precio de venta, no costo).
- **Valor de stock** (agregados) = `cost × availableStock`.
- **Cobertura** = `coverageDays(availableStock, salesLast30Days)` (utilidad `calculations`), tope visual de "+999 días".
- **Top productos** limitado a 100 (`TOP_LIMIT`).
- Agregación de proveedor/marca: los sin valor se agrupan como **"Sin asignar"** (no navegable).

### Validaciones
No hay validaciones de entrada (solo filtros de texto/selección). No hay escritura de datos.

### Permisos/restricciones
- Alcance por rol (comprador = sus categorías; líder = todo). No hay otras restricciones ni acciones destructivas.

### Dudas / definiciones pendientes
- **Definición pendiente**: la acción "Crear campaña de liquidación" y "Revisar surtido" solo navegan; no se documenta aquí el comportamiento de destino (fuera de este módulo).
- **Suposición**: el `emptyMessage` de la tabla de productos filtrados usa el default del componente.

---

## 2. Pantalla: Análisis de ventas

### Nombre
Análisis de ventas (título: **"Análisis de ventas"**).

### Ruta(s)
`/ventas`

### Módulo
Rentabilidad.

### Objetivo funcional
Dar **señales de venta para comprar mejor**: qué categorías/productos crecen, cuáles caen, dónde se pierde venta por quiebre de stock y qué productos son estacionales.

### Tipo de usuario
`comprador` y `lider`. **No** aplica lógica de rol/alcance en esta pantalla (usa datos agregados globales de `mockSales`). Los datos son totalmente **mock**.

### Descripción detallada
Combina KPIs de venta, un resumen ejecutivo, tarjetas de "señales accionables" con enlace directo a la acción, y varias vistas por pestaña (categorías, proveedores, productos, crecimiento, caída, venta perdida, temporada). Un selector de **período** (30/90/180 días) cambia las cifras mostradas.

### Información que muestra
- **Selector de período** (30d / 90d / 180d) en el encabezado.
- **Resumen ejecutivo** (barra): venta del período (`formatCurrency`), "+8,4% vs período anterior" (solo en 30d, **valor fijo hardcodeado**), venta perdida por quiebre, margen promedio.
- **KPIs (4 tarjetas cliqueables):**
  1. **Venta perdida** (`lostSalesByStockout`) → pestaña "perdida".
  2. **Alta venta + bajo stock** (conteo) → pestaña "productos".
  3. **En crecimiento** (conteo `growingProducts`) → pestaña "crecimiento".
  4. **En caída** (conteo `decliningProducts`) → pestaña "caida".
- **Pestañas** (con contadores): Resumen, Categorías, Proveedores, Productos, Crecimiento, Caída, Venta perdida, Temporada.
- **Resumen** (pestaña): tarjeta "Señales para comprar mejor" (4 señales con enlace) + tarjeta "Venta por categoría" (BarList top 6).
- **Categorías**: lista de categorías ordenadas por venta del período, con quiebres/riesgo y crecimiento (delta con color).
- **Proveedores**: lista con venta 90 días, participación (%) y barra de participación.
- **Productos**: grid de top productos con venta, unidades, stock y badge "Alta venta + bajo stock" cuando aplica.
- **Crecimiento / Caída / Temporada**: `TrendList` con producto, delta, categoría, stock, cobertura y nota.
- **Venta perdida**: lista de productos en quiebre con venta activa y venta perdida/mes estimada, o `EmptyState` si no hay.

### Secciones/bloques
Encabezado + selector de período; barra de resumen ejecutivo; grid de 4 KPIs; barra de pestañas; contenido por pestaña.

### Filtros disponibles
- **Período** (30/90/180 días) — afecta cifras de resumen, KPI de venta y listas por categoría/BarList.
- **Pestañas** como selector de vista.
- **No** hay `FilterBar` ni búsqueda de texto en esta pantalla.

### Acciones del usuario
- Cambiar período.
- Cambiar de pestaña (también vía KPIs cliqueables).
- Cliquear una señal, categoría, proveedor o producto → navegación (enlaces `Link`).

### Botones y controles
- `Tabs` de período (30/90/180) en el encabezado.
- `KpiCard` cliqueables (4).
- `Tabs` principal (8 pestañas).
- Botón "Ver todas" (en tarjeta de venta por categoría) → pestaña categorías.
- Enlaces de navegación en cada ítem.

### Tablas / tarjetas / formularios / componentes
- `KpiCard`, `Card`/`CardBody`/`CardHeader`, `BarList`, `Tabs`, `Badge`, `EmptyState`.
- Componente interno `TrendList` (crecimiento/caída/temporada).
- No hay tablas `DataTable` ni formularios.

### Campos de formularios
No aplica (no hay formularios).

### Estados posibles
- **Con datos** (siempre, mocks).
- **Venta perdida vacía**: `EmptyState` "Sin venta perdida / No hay productos en quiebre con venta activa." (posible si ningún producto cumple `availableStock ≤ 0` y `salesLast30Days > 0`).
- **Resumen ejecutivo**: la línea "+8,4% vs período anterior" solo aparece en período 30d.

### Navegación hacia otras pantallas
- Señales: `/reposicion?cat=...` ("Ver reposición"), `/inventario` ("Revisar inventario"), `/reposicion?foco=urgent` ("Comprar críticos"), `/productos/:sku` ("Ver producto").
- Categorías → `/reposicion?cat=...`.
- Proveedores → `supplierPath(nombre)`.
- Productos / trends / venta perdida → `/productos/:sku`.

### Flujo funcional completo
1. El usuario elige un período.
2. Ve el resumen ejecutivo y KPIs; identifica señales.
3. Cliquea una señal o pestaña para profundizar.
4. Desde cualquier ítem navega a la acción sugerida (reposición, inventario, ficha).

### Reglas de negocio inferibles
- **Señales** derivadas: categoría que más crece / más cae (`salesByCategory` ordenado por `growth`); venta perdida por quiebre; primer producto en crecimiento.
- **Venta perdida por producto** = `salesLast30Days × price` para productos con `availableStock ≤ 0` y `salesLast30Days > 0`, ordenado desc.
- **Alta venta + bajo stock**: `coverageDays(stock, ventas30) ≤ supplierLeadTimeDays × 1,5` (riesgo de quiebre relativo al lead time del proveedor).
- **Delta de crecimiento**: verde si `≥ 0`, rojo si `< 0`.
- KPIs de venta globales fijos en `salesKpis` (mock): venta 30/90/180 días, margen promedio 33,7%, venta perdida 14,6M, etc.

### Validaciones
No aplica (solo navegación/selección).

### Permisos/restricciones
Ninguna específica; misma vista para ambos roles. **Suposición**: no hay filtrado por comprador aquí.

### Dudas / definiciones pendientes
- **Definición pendiente**: el "+8,4% vs período anterior" está **hardcodeado** solo para 30d; no hay cálculo real de variación vs período anterior.
- **Definición pendiente**: las listas de crecimiento/caída/temporada provienen de arreglos mock curados, no de un cálculo sobre el catálogo.

---

## 3. Pantalla: Margen por canal

### Nombre
Margen por canal (título: **"Margen por canal"**).

### Ruta(s)
`/margen-canal`

### Módulo
Rentabilidad.

### Objetivo funcional
Comparar, **por producto**, el precio final y el margen en los tres canales de venta — **Marketplace, Web/Ecommerce y Tienda física** — mostrando cada SKU una sola vez con sus canales lado a lado, y sugiriendo precio/acción cuando un canal queda bajo el objetivo.

### Tipo de usuario
`comprador` y `lider`. Aplica **alcance por comprador** mediante un selector "Viendo": "Mis categorías (comprador actual)", "Todos los compradores", o un comprador específico. El alcance filtra por el campo `buyer` de cada fila de margen.

### Descripción detallada
Toma `channelMargins` (una fila por SKU×canal, derivada del catálogo), agrupa por SKU y calcula un **estado general** por SKU. Presenta KPIs cliqueables (que fijan filtros), pestañas por estado general y tarjetas comparativas por SKU con los 3 canales. Permite exportar y crear una "tarea de revisión" (toast simulado).

### Información que muestra
- Selector de alcance ("Viendo") + etiqueta del alcance.
- **KPIs (6, solo escritorio, cliqueables)**: Bajo margen, Margen negativo, Sobre marginados, Bajo margen · Marketplace, Bajo margen · Web, Bajo margen · Tienda. Cada uno fija filtros (estado/canal).
- **Pestañas por estado general del SKU**: Todos, Requieren revisión, Margen negativo, Diferencia entre canales, Sobre marginados (con contadores).
- **Tarjeta por SKU** (`SkuCard`): SKU, badge de estado general, nombre (enlace a ficha), categoría (enlace), proveedor (enlace) u "Sin proveedor", objetivo %, comprador; problema principal (canal peor + estado + pts vs objetivo); rango de precio y margen entre canales; **3 columnas de canal** (precio final, margen %, diferencia en pts, comisión, precio sugerido si bajo/negativo); conclusión/acción cuando el estado general no es "ok".

### Secciones/bloques
1. Encabezado con `ExportButton` y ayuda (`InfoHint`).
2. Bloque de alcance (`Select` "Viendo" + etiqueta).
3. `FilterBar` (búsqueda + selects + toggles + resumen).
4. Grid de 6 KPIs (solo `md+`).
5. Pestañas por estado general.
6. Lista de `SkuCard` o `EmptyState`.

### Filtros disponibles
`FilterBar`:
- Búsqueda de texto (SKU o nombre de producto).
- **Canal** (Marketplace / Web / Tienda).
- **Estado margen** (Margen negativo / Bajo margen / Margen normal / Sobre marginado).
- **Categoría** (valores únicos).
- **Proveedor** (valores únicos con proveedor).
- **Toggles**: "Con comisión" (`commission > 0`), "Con descuento" (`discount > 0`).
- Botón "Limpiar".

Adicional: selector de **alcance** ("Viendo") y **pestañas** por estado general. Filtros y alcance se persisten en URL (`useUrlState`/`useUrlToggle`).

### Acciones del usuario
- Cambiar alcance.
- Buscar/filtrar/togglear.
- Cliquear KPIs para fijar estado/canal.
- Cambiar pestaña por estado general.
- **Exportar** (CSV/descarga vía `ExportButton`).
- Por tarjeta: "Ver detalle" → ficha del producto (`/productos/:sku?tab=margen`); "Crear tarea" → `toast.success` (simulado).
- Enlaces a producto, categoría, proveedor.

### Botones y controles
- `ExportButton` (encabezado).
- `Select` de alcance.
- `FilterBar` (búsqueda, 4 selects, 2 toggles, Limpiar).
- 6 `KpiCard` cliqueables.
- `Tabs` (5).
- Por tarjeta: `Button` "Crear tarea" (secondary) y "Ver detalle" (primary).

### Tablas / tarjetas / formularios / componentes
- `KpiCard`, `Card`/`CardBody`, `SkuCard` (tarjeta compuesta con 3 sub-tarjetas de canal), `Badge`, `Button`, `Select`, `Tabs`, `FilterBar`, `InfoHint`, `ExportButton`, `EmptyState`.
- No hay formulario de captura (la "tarea" no abre formulario; dispara toast directo).

### Campos de formularios
No aplica (sin formulario). Los campos son los controles de filtro y el selector de alcance.

### Estados posibles (según estado de margen)
Estados de margen por canal (`MARGIN_STATUS`): **negative** (Margen negativo), **low** (Bajo margen), **normal** (Margen normal), **over** (Sobre marginado).

Estado **general por SKU** (`GENERAL_STATUS`): **negative**, **review** (Requiere revisión), **spread** (Diferencia entre canales), **over** (Sobre marginado), **ok** (Correcto).
- **Sin resultados** (filtros): `EmptyState` "Sin resultados / No hay productos con estos filtros."
- Datos mock: siempre hay SKUs; el estado "ok" no tiene pestaña propia (se ve en "Todos").

### Navegación hacia otras pantallas
- Ficha de producto con tab de margen: `/productos/:sku?tab=margen`.
- Ficha de categoría (`categoryPath`) y de proveedor (`supplierPath`).

### Flujo funcional completo
1. El usuario elige alcance (mis categorías / todos / un comprador).
2. Filtra por canal/estado/categoría/proveedor o cliquea un KPI.
3. Explora tarjetas por SKU; identifica el canal problemático y el precio sugerido.
4. Crea una tarea de revisión (simulada) o abre la ficha de margen del producto.
5. Puede exportar el conjunto en alcance.

### Reglas de negocio inferibles (derivadas del mock `mockChannelMargin`)
- Cada SKU se modela en 3 canales con precios distintos: marketplace = `price × 0,96`, web = `price`, tienda = `price × 1,08`.
- **Comisión marketplace** = `13%` del precio marketplace; web y tienda sin comisión.
- **Descuentos**: marketplace 4% si `salesLast30Days > 50`; web 5% si `purchaseStatus === "overstock"`.
- **Margen %** = `(finalPrice − cost − commission) / finalPrice`.
- **Precio sugerido** = `(cost + commission) / (1 − target/100)`.
- **Estado por canal** (`statusFor`): `< 0` → negative; `< target − 3` → low; `> target + 6` → over; resto → normal.
- **Estado general del SKU** (`generalStatusFor`): si algún canal negative → negative; si alguno low → review; si `max(margen) − min(margen) ≥ 15 pts` → spread; si todos over → over; si alguno over → spread; si no → ok.
- **Objetivo de margen por categoría** (`TARGET_BY_CATEGORY`): p. ej. Herramientas eléctricas 32%, Electricidad/Jardín/Seguridad 30%, Ferretería/Gasfitería 28%, Pinturas/Maderas 25%, Construcción 22%, Agrícola 27% (default 25%).
- En las tarjetas, el canal con mejor margen se resalta en verde y el peor en rojo (solo si hay diferencia).

### Validaciones
No hay validaciones de entrada. "Crear tarea" no valida ni persiste (toast simulado).

### Permisos/restricciones
- Alcance por comprador (selector). No hay restricción por rol para exportar o crear tareas (ambos roles pueden). **Suposición**: no hay control de permisos diferenciado.

### Dudas / definiciones pendientes
- **Definición pendiente**: "Crear tarea de revisión de margen" solo muestra un toast; no crea entidad real ni se documenta su destino.
- **Definición pendiente**: la exportación (formato exacto del archivo) depende de `ExportButton` (fuera de este archivo).

---

## 4. Pantalla: Temporadas y canales

### Nombre
Temporadas y canales (título: **"Temporadas y canales"**).

### Ruta(s)
`/temporadas`

### Módulo
Rentabilidad.

### Objetivo funcional
Diagnóstico de **estacionalidad por canal**: mostrar cuándo sube la demanda de una categoría y por qué canal se compra (tienda, ecommerce, marketplace, empresa/B2B y licitaciones), y cómo repartir la compra sugerida entre canales.

### Tipo de usuario
`comprador` y `lider`. Aplica **alcance de categorías** mediante `ScopeToggle` / `useCategoryScope` ("Mías" vs "Todas"): el comprador puede ver solo sus categorías o todas.

### Descripción detallada
El usuario elige una categoría (dentro de su alcance) y ve: KPIs de demanda, un gráfico de demanda mensual (barras), un gráfico apilado de demanda por canal y mes, la mezcla de canales (participación + timing de peak) y el reparto de la compra sugerida por canal. Es explícitamente un **diagnóstico**; para convertirlo en compra remite a "Planificar temporada".

### Información que muestra
- **KPIs (4):** Demanda mensual (u.), Mes peak (con factor estacional ×), Canales digitales (% ecommerce+marketplace), Proyectos (% empresa+licitaciones).
- **Gráfico "Temporada del año"** (`MonthlyBars`): demanda total por mes (unidades), barra oscura = mes peak; badge de tipo de demanda (constante / estacional / permanente con peak).
- **Gráfico "Demanda por canal y mes"** (`StackedChannelBars` + `ChannelLegend`): descomposición mensual por canal.
- **"Mezcla de canales"**: por canal, barra de participación (%), unidades/mes y meses peak; nota con descripción del canal principal.
- **"Compra sugerida por canal"**: compra sugerida del mes (CLP) repartida por canal (tarjetas con % y monto compacto) + `HelpNote` con recomendación.

### Secciones/bloques
1. Encabezado con `ScopeToggle`, `Select` de categoría y ayuda (`InfoHint` con enlace a Planificar temporada).
2. Grid de 4 KPIs.
3. Grid de 2 gráficos (temporada del año / demanda por canal y mes).
4. Tarjeta "Mezcla de canales".
5. Tarjeta "Compra sugerida por canal" + HelpNote.

### Filtros disponibles
- **Alcance de categorías** (`ScopeToggle`: Mías / Todas).
- **Selector de categoría** (`Select`).
- No hay búsqueda de texto ni filtros de estado.

### Acciones del usuario
- Cambiar alcance (mías/todas).
- Seleccionar categoría.
- Cliquear enlace "Planificar temporada" → `/comprar/temporada`.

### Botones y controles
- `ScopeToggle`.
- `Select` de categoría.
- `InfoHint` (ayuda) con enlace.
- Badge de tipo de demanda.
- Gráficos (`MonthlyBars`, `StackedChannelBars`, `ChannelLegend`) — visualización, no interactivos para captura de datos.

### Tablas / tarjetas / formularios / componentes
- `KpiCard`, `Card`/`CardBody`/`CardHeader`, `Badge`, `HelpNote`, `InfoHint`, `ScopeToggle`, `Select`, y componentes de gráfico `SeasonalityChart` (MonthlyBars, StackedChannelBars, ChannelLegend).
- No hay tablas `DataTable` ni formularios de captura.

### Campos de formularios
No aplica.

### Estados posibles
- **Con categoría seleccionada**: vista completa (por defecto, primera categoría en alcance).
- **Sin categorías en alcance**: estado alternativo — encabezado + `Card` con mensaje "No hay categorías en tu alcance. Cambia a 'Todas' para explorar la demanda por canal." (ocurre si el comprador no tiene categorías y el alcance es "Mías").
- No hay estados de carga/error (datos deterministas locales).

### Navegación hacia otras pantallas
- **`/comprar/temporada`** ("Planificar temporada"), desde la ayuda y desde la recomendación.

### Flujo funcional completo
1. El usuario define alcance y elige categoría.
2. Ve el diagnóstico de estacionalidad (mensual y por canal) y la mezcla de canales.
3. Ve cómo se repartiría la compra sugerida del mes por canal.
4. Salta a "Planificar temporada" para ejecutar la compra.

### Reglas de negocio inferibles (utils `channelDemand` y `seasonality`)
- **Canales de demanda**: tienda, ecommerce, marketplace, empresa (B2B), licitaciones, cada uno con perfil estacional mensual propio (ej. ecommerce peak en CyberDay/mayo y fin de año; licitaciones peak marzo-abril y oct-nov).
- **Mezcla por familia de categoría** (`mixForCategory`): construcción, ferretería/herramientas, jardín/agrícola, instalación (pintura/gasfitería/electricidad) y default; cada mezcla suma 1.
- **Demanda base** = suma de `salesLast30Days` de los productos de la categoría; **precio medio** ponderado por venta.
- **Digital %** = ecommerce + marketplace; **Proyectos %** = empresa + licitaciones.
- **Mes peak** = mes de mayor demanda total.
- **Factor estacional** (`seasonalFactor`, 2 meses adelante vs promedio anual): "Entra en temporada" si `≥ 1,05`; "Sale de temporada" si `≤ 0,95`; si no "Demanda pareja".
- **Tipo de demanda** (`demandType`): constante (`ratio < 1,12`), permanente con peak (`min ≥ 0,6`), estacional (resto).
- **Compra sugerida por canal** = `suggestedPurchase × mixPct` de cada canal.
- La compra sugerida de la categoría proviene de `selected.suggestedPurchase` (mock de categorías).

### Validaciones
No aplica (sin captura de datos).

### Permisos/restricciones
- Alcance de categorías por comprador. Sin restricciones adicionales por rol.

### Dudas / definiciones pendientes
- **Definición pendiente**: la ejecución real de la compra ("Planificar temporada") está en otro módulo (`/comprar/temporada`).
- **Suposición**: los datos de canal son estimación determinista en frontend, no transacciones reales (declarado en el código).

---

## 5. Pantalla: Alzas de precio (Variaciones de costo)

### Nombre
Alzas de precio (título: **"Alzas de precio"**). En el menú del módulo figura como "Variaciones de costo".

### Ruta(s)
`/alzas-precio`

### Módulo
Rentabilidad.

### Objetivo funcional
Gestionar los **cambios de costo** que envían los proveedores: recibir una nueva lista de precios, comparar costo nuevo vs costo actual, detectar alzas/bajas, medir el impacto en el margen (asumiendo que el precio de venta **no cambia**) y **aprobar o rechazar** el cambio.

### Tipo de usuario
`comprador` y `lider`. **No** hay lógica explícita de rol/alcance en esta pantalla. Los cambios de estado se **persisten en localStorage** (`compras:price-lists`), es decir, sobreviven a recargas del navegador (dentro de la demo).

### Descripción detallada
Muestra KPIs globales sobre listas pendientes, un selector de listas (por proveedor, con estado y nº de productos), el resumen de la lista activa, una tabla de ítems (producto, costo actual→nuevo, margen actual→nuevo, precio sugerido) con filtros, y acciones para aprobar/rechazar/volver a pendiente. Incluye un **modal "Cargar lista de precios"** que simula la recepción de una lista generando una vista previa a partir del catálogo.

### Información que muestra
- **KPIs (4):** Listas pendientes, Productos afectados (en pendientes), Alza promedio (costo, pendientes), Margen bajo (`< 20%`) si no se ajusta el precio.
- **Selector de listas** (botones por proveedor con badge de estado y nº de productos).
- **Resumen de la lista activa**: proveedor (enlace), estado, id, vigente desde; Productos, Alza prom., Alzas/bajas, Impacto margen (pts), Margen bajo.
- **Tabla de ítems**: Producto (enlace + SKU + categoría), Costo actual → nuevo (con delta y flecha), Margen actual → nuevo (con aviso "Quedaría bajo 20%"), Precio venta sugerido (con objetivo de categoría).
- **Panel de acciones** de la lista según estado.
- **Modal de carga**: selector de proveedor + alza base + vista previa (Productos, Alza prom., En alza, Margen bajo).

### Secciones/bloques
Encabezado (con botón "Cargar lista" y ayuda); grid de 4 KPIs; selector de listas; resumen de lista activa; `FilterBar`; tabla de ítems; panel de acciones; modal de carga.

### Filtros disponibles
`FilterBar` (sobre la lista activa):
- Búsqueda de texto (SKU o producto).
- **Categoría** (valores únicos de la lista).
- **Tipo de cambio**: "Solo alzas" (`alzaPct > 0`), "Solo bajas" (`alzaPct < 0`), "Quedan con margen bajo (< 20%)".
- Botón "Limpiar".
- Ordenamiento de tabla por columna (por defecto `alzaPct` desc.).

### Acciones del usuario
- Abrir modal "Cargar lista de precios" y **cargar** una lista simulada.
- Seleccionar una lista.
- Filtrar/buscar/ordenar ítems.
- **Aprobar alza** / **Rechazar** (si pendiente) o **Volver a pendiente** (si ya decidida).
- Navegar a ficha de producto, categoría o proveedor (enlaces).

### Botones y controles
- Botón "Cargar lista de precios" (encabezado y en `EmptyState`).
- `InfoHint` de ayuda.
- Botones-tarjeta del selector de listas.
- `FilterBar` (búsqueda, 2 selects, Limpiar).
- `DataTable` con orden por columna.
- Botones de acción: "Rechazar" (secondary), "Aprobar alza" (primary con check), "Volver a pendiente" (secondary).
- Modal: `Select` proveedor, `Select` alza base, botones "Cancelar" y "Cargar lista" (deshabilitado si la vista previa no tiene ítems).

### Tablas / tarjetas / formularios / componentes
- `KpiCard`, `Card`/`CardBody`, `DataTable` (+ `mobileCard`), `FilterBar`, `Badge`, `Button`, `Modal`, `Select`, `HelpNote`, `InfoHint`, `EmptyState`.
- **Formulario (modal de carga)**: es el único formulario real del módulo.

### Campos de formularios (modal "Cargar lista de precios")
- **Proveedor** (`Select`, opciones = proveedores del catálogo con productos, `SUPPLIERS_WITH_PRODUCTS`; valor inicial = primero).
- **Alza base de la lista** (`Select`, opciones `ALZA_OPTIONS`): "Alza moderada (~4%)", "Alza media (~8%)" (default), "Alza fuerte (~12%)", "Baja general (~-3%)".
- Vista previa (solo lectura): Productos, Alza prom., En alza, Margen bajo.

### Estados posibles
- **Estado de lista** (`PriceListEstado`): **pendiente** (ámbar), **aprobada** (verde), **rechazada** (rojo). Los tres se pueden alcanzar desde la UI.
- **Sin listas**: `EmptyState` "No hay listas de precios" con botón de carga (posible solo si se vaciara el localStorage; el mock siembra 4 listas pendientes).
- **Filtro sin resultados en la tabla**: `emptyMessage` "No hay productos con estos filtros en esta lista."
- **Modal sin productos del proveedor**: `EmptyState` "Sin productos" y botón "Cargar lista" deshabilitado; además `toast.warning` si se intenta cargar.

### Navegación hacia otras pantallas
- Ficha de producto (`productPath`), categoría (`categoryPath`), proveedor (`supplierPath`).
- No navega a otras pantallas del flujo de compra; las acciones son **in-place** (cambio de estado + toasts simulados).

### Flujo funcional completo
1. (Opcional) El usuario carga una lista simulada: elige proveedor y alza base, ve la vista previa y confirma → se agrega una lista **pendiente** al inicio y queda seleccionada.
2. Selecciona una lista; revisa el resumen (alza prom., impacto en margen, margen bajo).
3. Filtra los ítems (alzas/bajas/margen bajo) y ordena.
4. Decide: **Aprobar** (toast: se actualizaría el costo y se notificaría a precios/catálogo — simulado) o **Rechazar** (toast: se mantiene el costo vigente). Puede **volver a pendiente**.
5. Los cambios de estado persisten en localStorage.

### Reglas de negocio inferibles (mock `mockPriceLists`)
- **Costo nuevo** = `costoActual × (1 + deltaPct/100)`, redondeado a CLP entero.
- **Alza %** = variación del costo (positiva = alza, negativa = baja, cero = sin cambio).
- **Margen actual** = `(price − costoActual) / price`; **Margen nuevo** = `(price − costoNuevo) / price` (precio de venta constante).
- **Precio venta sugerido** = `costoNuevo / (1 − target/100)` para mantener el margen objetivo de la categoría.
- **Umbral de margen bajo** = `LOW_MARGIN_THRESHOLD = 20%`; los ítems que quedan bajo 20% se resaltan (fila rosada + aviso).
- **Objetivo por categoría** = `TARGET_MARGIN_BY_CATEGORY` (mismos valores que Margen por canal; default 25%).
- **Resumen de lista** (`summarizeList`): nº productos, alza promedio, en alza, en baja, con margen bajo, impacto en margen (pts = promedio de `margenNuevo − margenActual`).
- Al cargar, los ítems se generan con un patrón determinista de ajustes sobre el alza base (mayoría alzas, algunas bajas, algún "sin cambio"); id nuevo `PL-DEMO-N`, vigente desde `2026-07-15`.
- Listas sembradas: FerrePro Chile (+9%), Distribuidora Maule (+6%), Proveedor Andes (+12%), Herramientas Global (+4%), todas pendientes.

### Validaciones
- El botón "Cargar lista" del modal se **deshabilita** si la vista previa no tiene ítems.
- Al cargar, si el proveedor no tiene productos en catálogo → `toast.warning` y no se crea la lista.
- `parseFloat(upAlza) || 0` protege contra alza no numérica.
- No hay más validaciones (no se valida rango del alza ni fechas manualmente; el alza base viene de un select cerrado).

### Permisos/restricciones
- **Definición pendiente**: no se distingue por rol quién puede **aprobar/rechazar** alzas. En un retailer normalmente la aprobación de alzas sería atribución del `lider`, pero el código **no** restringe la acción por rol (ambos pueden). Se marca como pendiente de definición.

### Dudas / definiciones pendientes
- **Definición pendiente**: la aprobación no actualiza realmente el costo del catálogo ni notifica a precios/catálogo (es simulado, declarado en la ayuda y toasts).
- **Definición pendiente**: en producción la carga sería por archivo (Excel/CSV) o integración; aquí es una generación demo desde el catálogo.
- **Definición pendiente**: alcance por comprador/categoría no está implementado (se ven todas las listas).

---

## 6. Pantalla: Presupuesto por categoría (Open-to-Buy)

### Nombre
Presupuesto por categoría (título: **"Presupuesto por categoría"**). En el menú del módulo figura como "Presupuesto".

### Ruta(s)
`/presupuesto`

### Módulo
Rentabilidad.

### Objetivo funcional
**Open-to-Buy (OTB)**: mostrar cuánto puede comprar el usuario en cada categoría tras descontar lo ya **comprometido** (OC emitidas) y lo que está **en borrador**. El objetivo es evitar sobregirar el presupuesto antes de emitir una orden.

### Tipo de usuario
`comprador` y `lider`. **No** hay filtrado explícito por rol; se muestran todas las categorías. El OTB se calcula **en vivo** combinando presupuesto semilla + OC creadas en la sesión (localStorage `compras:po-created`) + borrador actual (`OcDraftContext`).

### Descripción detallada
Selecciona un mes, calcula el OTB por categoría (`computeOtb`) y muestra KPIs globales del mes, avisos contextuales (borrador en curso, categorías que quedarían excedidas) y una tabla por categoría con presupuesto, comprometido, en borrador, disponible (OTB), % usado (barra) y estado (semáforo).

### Información que muestra
- **Selector de mes** (`BUDGET_MONTHS`: junio 2026 y mayo 2026).
- **KPIs (4):** Presupuesto del mes; Comprometido (con % usado incluyendo borrador); En borrador (con nº de SKU sin emitir); Disponible (OTB) total.
- **Avisos (`HelpNote`)**: resumen del borrador en curso (monto y categorías) y categorías que quedarían sobre presupuesto.
- **Tabla por categoría**: Categoría, Presupuesto, Comprometido, En borrador, Disponible (OTB), % usado (barra `UsageBar`), Estado (badge).

### Secciones/bloques
Encabezado (con selector de mes y ayuda `InfoHint`); grid de 4 KPIs; avisos de borrador/excedidas; `FilterBar`; `Card` con `DataTable`.

### Filtros disponibles
`FilterBar`:
- Búsqueda de texto (nombre de categoría).
- **Estado** (En presupuesto / Ajustado / Excedido).
- Botón "Limpiar".
- Ordenamiento de tabla por columna (por defecto los datos se ordenan por presupuesto desc.).

Nota: el mes **no** es parte de `FilterBar` (es un `Select` en el encabezado). Los KPIs y avisos usan el **mes completo** (no se filtran); solo la tabla aplica búsqueda/estado.

### Acciones del usuario
- Cambiar el mes.
- Buscar/filtrar por estado.
- Ordenar la tabla.
- No hay acciones de escritura en esta pantalla (es consulta; el borrador se arma en otras pantallas).

### Botones y controles
- `Select` de mes.
- `InfoHint` de ayuda.
- `FilterBar` (búsqueda, 1 select, Limpiar).
- `DataTable` con orden por columna.
- No hay botones de acción/CTA.

### Tablas / tarjetas / formularios / componentes
- `KpiCard`, `Card`, `DataTable` (+ `mobileCard`), `FilterBar`, `HelpNote`, `InfoHint`, `Badge`, `Select`, componente interno `UsageBar` (barra de % usado).
- No hay formularios de captura.

### Campos de formularios
No aplica.

### Estados posibles
- **Estado de presupuesto por categoría** (`BudgetStatus`): **ok** (En presupuesto, verde), **ajustado** (ámbar), **excedido** (rojo). Se derivan del % usado (y en el mock base también de proyección).
- **Con borrador en curso**: aviso de borrador + filas resaltadas (fondo brand) + columna "En borrador" con monto.
- **Con categorías excedidas**: aviso rojo + filas resaltadas (fondo rosado).
- **Sin resultados** (filtros): `emptyMessage` "No hay categorías que coincidan con los filtros."
- **Sin borrador**: KPI "En borrador" = 0 y descripción "Sin borrador en curso"; no aparece el aviso de borrador.
- **OTB total negativo**: KPI Disponible en rojo con "Presupuesto sobregirado".

### Navegación hacia otras pantallas
- No hay enlaces de navegación salientes desde esta pantalla (es una vista de consulta). El vínculo con el borrador/OC es a través del **estado compartido** (contexto y localStorage), no por navegación.

### Flujo funcional completo
1. El usuario elige el mes.
2. Se calcula el OTB por categoría: `comprometido = base del mes + OC creadas este mes en la sesión`; `en borrador = neto de líneas del borrador por categoría`; `disponible = presupuesto − comprometido − borrador`.
3. Los KPIs muestran la foto global del mes; los avisos alertan sobre borrador y excedidas.
4. La tabla permite revisar categoría por categoría antes de emitir una OC.

### Reglas de negocio inferibles
- **Comprometido** = OC aprobadas/emitidas que reservan caja. Estados de OC que cuentan como comprometido (`COMMITTED_STATUSES`): draft, pending_approval, approved, sent, confirmed, partially_received, with_difference, delayed.
- **Recibido** = mercadería recepcionada (subconjunto de lo comprometido).
- **Disponible (OTB)** = `presupuesto − comprometido − enBorrador`.
- **% usado** = `(comprometido + enBorrador) / presupuesto × 100`.
- **Semáforo** (`deriveStatus` en OTB): `usadoPct > 100` → excedido; `≥ 85` → ajustado; resto → ok. (El mock base `mockBudgets` añade además una proyección de cierre para el semáforo inicial: `proyeccionPct > 105` excedido, `≥ 95` ajustado.)
- KPI Comprometido tono: `> 100%` bad, `≥ 85%` warn, si no good.
- Presupuestos semilla por categoría (mock determinista), con Agrícola sembrada > 100% para demostrar el estado "excedido"; junio se calcula al día 24/30 (mes en curso), mayo como mes cerrado.

### Validaciones
No aplica (sin captura de datos ni acciones de escritura).

### Permisos/restricciones
- No hay restricciones por rol. **Suposición**: ambos roles ven todas las categorías (no se filtra por comprador).

### Dudas / definiciones pendientes
- **Definición pendiente**: no hay edición de presupuesto ni acciones (aprobar/emitir) desde esta pantalla; solo consulta.
- **Suposición**: el borrador y las OC creadas provienen de otros módulos (contexto `OcDraftContext` y localStorage `compras:po-created`); su alimentación no ocurre en esta pantalla.

---

## Resumen del Módulo: Rentabilidad

### Objetivo
Entregar al equipo de compras una visión integral de la **rentabilidad y el desempeño comercial** de la compra: qué vende y qué no, qué margen deja por producto y canal, cuándo y por qué canal sube la demanda, cómo afectan las alzas de costo del proveedor al margen, y cuánto presupuesto queda disponible (OTB) para seguir comprando. Es un módulo mayoritariamente **analítico/de consulta**, con pocas acciones de escritura (aprobación de alzas y creación simulada de tareas), todo sobre **datos mock deterministas**.

### Pantallas
1. **Ranking & liquidación** (`/analisis-compra`) — Top productos/proveedores/marcas y candidatos a liquidar/descontinuar.
2. **Análisis de ventas** (`/ventas`) — Señales de venta: crecimiento, caída, venta perdida por quiebre, temporada.
3. **Margen por canal** (`/margen-canal`) — Precio y margen por SKU en marketplace, web y tienda, con precio sugerido.
4. **Temporadas y canales** (`/temporadas`) — Diagnóstico de estacionalidad y mezcla de canales por categoría.
5. **Alzas de precio** (`/alzas-precio`) — Recepción, revisión y aprobación/rechazo de listas de precios de proveedores.
6. **Presupuesto por categoría** (`/presupuesto`) — Open-to-Buy por categoría (presupuesto − comprometido − borrador).

### Flujo principal
El comprador diagnostica el desempeño (ventas, ranking, margen por canal, estacionalidad), detecta problemas de rentabilidad (margen bajo/negativo, sobrestock, venta perdida, alzas de costo que erosionan el margen) y verifica el presupuesto disponible (OTB) antes de comprar. Varias pantallas remiten a la ejecución en otros módulos (reposición, campañas, planificar temporada, surtido redundante), y la aprobación de alzas actualizaría costos (simulado). El presupuesto refleja **en vivo** el borrador de compra armado en otros módulos.

### Funcionalidades principales
- Ranking de venta por producto/proveedor/marca con alcance por rol.
- Detección y priorización de candidatos a liquidar/descontinuar (por severidad).
- Análisis de ventas por período (30/90/180) con señales accionables.
- Comparación de margen por canal con estado, precio sugerido y acción.
- Diagnóstico de estacionalidad y reparto de compra sugerida por canal.
- Gestión de alzas de precio con impacto en margen y aprobación/rechazo (persistido en localStorage).
- Open-to-Buy por categoría con semáforo y avisos de sobregiro.

### Funcionalidades secundarias
- Exportación (Margen por canal).
- Creación de "tarea de revisión de margen" (toast simulado).
- Carga simulada de listas de precios (modal con vista previa).
- KPIs cliqueables que fijan filtros o cambian de pestaña.
- Persistencia de filtros/pestañas en la URL (varias pantallas) y de decisiones en localStorage.

### Dependencias con otros módulos
- **Catálogo de productos** (`mockProducts`) y **categorías** (`mockCategories`): base de casi todos los cálculos (venta, margen, cobertura, stock, objetivos por categoría).
- **Proveedores** (`mockSuppliers`, lead time, fill rate): usados en riesgo de quiebre, estacionalidad y enlaces.
- **BuyerContext / RoleContext**: alcance por comprador y por rol (Ranking, Margen por canal, Temporadas).
- **OcDraftContext** y **OC creadas** (`compras:po-created` en localStorage): alimentan el Open-to-Buy del Presupuesto.
- **Navegación saliente** hacia otros módulos: Reposición (`/reposicion`), Inventario (`/inventario`), Campañas (`/campanas`), Surtido redundante (`/surtido-redundante`), Planificar temporada (`/comprar/temporada`), y fichas de producto/categoría/proveedor.
- **ToastContext**: notificaciones simuladas (Margen por canal, Alzas de precio).

> **Nota transversal sobre datos mock:** todas las cifras (ventas, márgenes, presupuestos, alzas, demanda por canal) son deterministas y se derivan del catálogo o de semillas fijas; no hay backend ni datos transaccionales reales. Estados como "sin listas de precios" o "sin categorías en alcance" existen en el código pero rara vez se ven con los mocks sembrados por defecto.
