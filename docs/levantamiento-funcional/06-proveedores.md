# Módulo: Proveedores

> Levantamiento funcional basado exclusivamente en el frontend (React + TypeScript, en español). Plataforma de compras para un retailer chileno de mejoramiento del hogar (la app se refiere a la empresa como "Mimbral"). Todos los datos son **mock** (mock data). No se modificó código.
>
> Archivos analizados:
> - `src/pages/SuppliersPage.tsx`
> - `src/pages/SupplierDetailPage.tsx`
> - `src/pages/SupplierDetailSections.tsx` (barrel de re-exportación)
> - `src/pages/supplierDetail/SupplierNegotiation.tsx`
> - `src/pages/supplierDetail/SeasonView.tsx`
> - `src/pages/supplierDetail/SupplierTermsAgreements.tsx`
> - `src/pages/supplierDetail/SupplierMaster.tsx`
> - `src/pages/supplierDetail/GStat.tsx`
> - Apoyo: `src/types/purchasing.ts`, `src/data/mockSuppliers.ts`, `src/components/business/supplierMetricHelp.tsx`, `src/utils/supplierPerf.ts`, `src/utils/seasonality.ts`, `src/routes/AppRoutes.tsx`, `src/components/layout/navItems.tsx`.

---

## Nota general sobre datos y persistencia (aplica a todo el módulo)

- **Fuente de datos de proveedores**: colección `suppliers` en `src/data/mockSuppliers.ts`.
  - `SuppliersPage` lee los proveedores vía `useCollection<Supplier>("suppliers", mockSuppliers)` (contexto `DataContext`), lo que permitiría overrides en runtime.
  - `SupplierDetailPage` y todas sus secciones leen **directamente** el array mock `suppliers` (no usan `useCollection`). Suposición: en esta demo ambos coinciden porque no hay mutaciones sobre la colección de proveedores.
- **Métricas comerciales derivadas** (venta, utilidad, margen, quiebres, estacionalidad, fill rate, OTIF, score de evaluación) se **calculan en el frontend** cruzando el proveedor con `mockProducts`, `mockPurchaseOrders`, `mockReceptions`, `mockAlerts`, `mockCategories` y utilidades (`supplierFulfillment`, `supplierSeasonality`, `hashString`). Varias de ellas son **simuladas/deterministas** (ver cada pantalla).
- **Persistencia local real**: únicamente las **Condiciones comerciales** y los **Acuerdos y seguimiento** se persisten en `localStorage` (`useLocalStorage`), con claves `compras:terms:<idProveedor>` y `compras:agreements:<idProveedor>`. Es la única escritura de datos del módulo; el resto es solo lectura.
- **Tipo de dato `Supplier`** (`src/types/purchasing.ts`), campos principales:
  - Base: `id`, `name`, `rut`, `categories[]`, `associatedSkus`, `openPurchaseOrders`, `deliveryCompliance` (0–100), `averageLeadTimeDays`, `lastPurchaseDate`, `purchasedAmountLast90Days`, `pendingAmount`, `status`.
  - Maestro (opcionales): `contactoComercial`, `contactoLogistica`, `contactoCobranza` (`{nombre,email,telefono}`), `condicionPago`, `plazoEntregaDias`, `minimoCompra`, `minimoCompraTipo` (`"monto" | "unidades"`), `marcas[]`, `documentosTributarios[]` (`{tipo,numero,vigente,vence?}`), `acuerdosComerciales[]` (`{titulo,detalle}`).
- **Estados del proveedor** (`SupplierStatus`): `active` (Activo), `review` (Revisar), `delayed` (Atrasado), `blocked` (Bloqueado), `inactive` (Sin compras).

---

## Pantalla 1 — Performance de proveedores (listado)

### Nombre
Proveedores (Performance de proveedores).

### Ruta(s)
- `/proveedores` (registrada en `src/routes/AppRoutes.tsx`).
- Acceso desde el menú lateral: grupo "Proveedores" → "Performance" (`navItems.tsx`).

### Módulo
Proveedores.

### Objetivo funcional
Dar al comprador una vista comparativa del desempeño de todos los proveedores con foco en **cumplimiento, lead time, despacho (fill rate) y monto pendiente**, para decidir a quién seguir comprando, a quién revisar y con quién negociar antes de la temporada alta. El encabezado lo declara: "Información para decidir si seguir comprando a cada uno."

### Tipo de usuario
No se detectó gate de rol en la ruta ni en el ítem de navegación (`navItems.tsx` no define `roles` para la clave `proveedores`). **Suposición**: accesible tanto a `comprador` como a `lider`. La copy está redactada desde la óptica del comprador ("qué llevar a negociar", "tienes X alternativas").

### Descripción detallada
Página compuesta por: encabezado, barra de filtros con resumen, fila de 4 KPIs, tres mini-rankings, un panel condicional de proveedores que entran en temporada, y una tabla principal de proveedores (con vista alternativa en tarjetas para móvil). Toda métrica se recalcula sobre el resultado filtrado (KPIs) o sobre el universo completo (rankings/temporada).

### Información que muestra
- **KPIs (sobre resultado filtrado)**:
  - Proveedores atrasados: nº con `status === "delayed"`.
  - Bajo cumplimiento (<70%): nº con `deliveryCompliance < 70`.
  - OC abiertas (total): suma de `openPurchaseOrders`.
  - Monto pendiente total: suma de `pendingAmount` (formato compacto).
- **Mini-rankings (sobre universo completo, top 4)**:
  - Peor cumplimiento: ordenado ascendente por `deliveryCompliance`; subtítulo "N OC abiertas".
  - Mayor compra (90 días): ordenado desc. por `purchasedAmountLast90Days`; subtítulo "N SKUs".
  - Lead time más alto: ordenado desc. por `averageLeadTimeDays`; subtítulo "Cumple X%".
- **Panel "Entran en temporada próximamente"** (condicional): proveedores no inactivos con pre-temporada detectada por `supplierSeasonality(name)`; muestra mes de temporada alta, días al peak, fill % y lead time; badge "Riesgo de quiebre" (rojo) o "Preparar compra" (ámbar) según `classification.risky`.
- **Tabla de proveedores** (columnas): Proveedor (nombre + RUT), Categorías (badges), SKUs, OC abiertas, Cumplimiento (coloreado por umbral), Despacho (fill rate desde `supplierFulfillment` + "N SKU sin despachar"), Lead time, Última compra, Compra 90 días, Monto pendiente (ámbar si > 20.000.000), Estado (badge).

### Secciones/bloques
1. `PageHeader` (título "Proveedores" + descripción).
2. `FilterBar` (búsqueda + select de estado + resumen + limpiar).
3. Grid de 4 `KpiCard`.
4. Grid de 3 `MiniRank` (componente local).
5. `Card` "Entran en temporada próximamente" (condicional a `entranTemporada.length > 0`).
6. `Card` con `DataTable` (tabla principal + `mobileCard`).

### Filtros disponibles
- **Búsqueda de texto** (`q` en URL, `useUrlState`): filtra por `name` + `rut` (case-insensitive). Placeholder "Buscar por nombre o RUT".
- **Estado** (`estado` en URL): select con opciones Activo (`active`), Revisar (`review`), Atrasado (`delayed`), Bloqueado (`blocked`), Sin compras (`inactive`).
- Botón **Limpiar** que resetea query y estado.
- El estado del filtro se persiste en la URL (querystring), permitiendo compartir/deep-link.

### Acciones del usuario
- Escribir en el buscador y elegir estado para filtrar.
- Limpiar filtros.
- Hacer clic en una fila de la tabla → navega a `/proveedores/:id` (`onRowClick`).
- Hacer clic en un proveedor del panel de temporada → navega a `/proveedores/:id?tab=temporadas` (deep-link a la pestaña Temporadas).
- Consultar ayuda contextual de métricas (íconos ⓘ `MetricHint`) en encabezados/KPIs: cumplimiento, despacho, leadTime, pendiente.

### Botones y controles
- Input de búsqueda, select de estado, botón "Limpiar" (dentro de `FilterBar`).
- Íconos de ayuda `MetricHint` (popover informativo, sin acción de negocio).
- Filas clicables (no hay botón explícito; toda la fila es el control de navegación).

### Tablas / tarjetas / formularios / componentes
- **Tabla**: `DataTable` con columnas `Column<Supplier>[]`, `rowKey = s.id`, `onRowClick`, y `mobileCard` (render alternativo en móvil que muestra Cumple, Despacho, Lead time y OC abiertas).
- **Tarjetas**: `KpiCard` (x4), `MiniRank` (x3, componente local que lista nombre/valor/subtítulo con tono rojo/verde/ámbar), `Card` de temporada con enlaces.
- **Badges**: `Badge` (categorías, temporada), `StatusBadge kind="supplier"` (estado).
- No hay formularios en esta pantalla.

### Campos de formularios
No aplica (pantalla de solo lectura/consulta; el único "input" es la búsqueda y el select de estado, no un formulario de datos).

### Estados posibles (existentes vs. no aplican por mock)
- **Con resultados**: tabla poblada (caso normal con datos mock).
- **Filtrado sin coincidencias**: la tabla quedaría vacía; el resumen mostraría "0 proveedores". *(Depende del componente `DataTable`; no se observa un `EmptyState` explícito en esta página.)* — **Definición pendiente**: comportamiento visual exacto de la tabla sin filas.
- **Panel de temporada oculto**: si ningún proveedor tiene pre-temporada, el bloque no se renderiza.
- **Estados de proveedor**: los 5 estados (`active/review/delayed/blocked/inactive`) existen en el tipo; su aparición depende de los datos mock cargados.
- Estados de **carga/error de red no aplican**: datos mock en memoria (sin fetch asíncrono).

### Navegación hacia otras pantallas
- Fila de tabla → `/proveedores/:id` (Detalle).
- Panel temporada → `/proveedores/:id?tab=temporadas`.
- Entrada por menú lateral y por búsqueda global del `Topbar` (`to: /proveedores/${s.id}`).

### Flujo funcional completo
1. El usuario abre "Proveedores".
2. Ve KPIs y rankings del conjunto; opcionalmente filtra por nombre/RUT o estado (los KPIs se recalculan sobre el subconjunto filtrado; rankings y temporada usan el universo completo).
3. Detecta proveedores críticos (peor cumplimiento, lead time alto) o próximos a temporada.
4. Hace clic para abrir la ficha del proveedor y profundizar/preparar negociación.

### Reglas de negocio inferibles
- **Semáforo de cumplimiento**: <70% rojo, 70–84% ámbar, ≥85% verde.
- **Monto pendiente** > 20.000.000 se resalta en ámbar (umbral de riesgo de concentración).
- **Fill rate / despacho**: proviene de `supplierFulfillment(name)`; si no hay órdenes arribadas se muestra "—". Si hay SKUs sin despachar se indica el conteo en rojo.
- **Ordenamiento de temporada**: prioriza proveedores "risky" y luego menor cantidad de días al peak (los más urgentes primero).
- **Rankings** siempre top 4.

### Validaciones
No hay validaciones de formulario (solo filtros). La búsqueda hace trim y comparación case-insensitive.

### Permisos/restricciones
No se observan restricciones por rol en el código de la página ni en la definición de ruta/nav. **Suposición**: sin gating específico.

### Dudas / definiciones pendientes
- ¿La ruta debe estar restringida a algún rol? (hoy no lo está).
- Comportamiento exacto de `DataTable` cuando el filtro no arroja resultados (¿empty state?).
- La divergencia entre `useCollection` (listado) y lectura directa del mock (detalle) podría causar inconsistencias si en el futuro se editan proveedores en runtime.

---

## Pantalla 2 — Detalle / Ficha de proveedor

### Nombre
Detalle de proveedor (ficha del proveedor con pestañas).

### Ruta(s)
- `/proveedores/:id`.
- Soporta deep-link a pestaña vía querystring `?tab=<valor>` (leído en el estado inicial: `searchParams.get("tab") ?? "ficha"`). Valores usados en la app: `ficha`, `negociacion`, `temporadas`, `productos`, `ordenes`, `recepciones`, `alertas`.

### Módulo
Proveedores.

### Objetivo funcional
Consolidar en una sola ficha toda la información para **atender, evaluar y negociar** con un proveedor: KPIs de servicio, resumen comercial, cockpit de negociación, posición negociadora, más vendidos / productos detenidos, y pestañas de profundización (ficha maestra, negociación, temporadas, catálogo, órdenes, recepciones y alertas).

### Tipo de usuario
Igual que el listado: sin gate de rol detectado. **Suposición**: `comprador` y `lider`. Copy orientada al comprador que prepara reuniones con el proveedor.

### Descripción detallada
La página resuelve el proveedor por `id`. Si no existe, muestra `EmptyState` "Proveedor no encontrado" con botón para volver. Si existe, cruza el proveedor con productos, órdenes, recepciones y alertas (por `supplierName`/`relatedEntity`/`relatedSku`) y renderiza una cabecera fija (KPIs + resúmenes + cockpit) siempre visible, más un `Tabs` que conmuta el contenido inferior.

### Información que muestra

**Cabecera (siempre visible):**
- `PageHeader` con breadcrumb Proveedores → nombre, subtítulo "RUT · categorías", y `StatusBadge` de estado como acción.
- **4 KPIs**: Cumplimiento (semáforo por umbral, "Entregas a tiempo"), Lead time (ámbar si ≥15 días, "Promedio de entrega"), OC abiertas (clic → pestaña Órdenes; `active` cuando la pestaña Órdenes está seleccionada), Monto pendiente (ámbar si > 20.000.000).
- **Banner de revisión** (condicional): aparece si `status` es `delayed`/`review` o `deliveryCompliance < 70`. Muestra cumplimiento, lead time alto (si ≥15), nº de SKU en quiebre y última compra.
- **Panel "Para atender al proveedor"** (5 métricas): Importancia (badge Estratégico/Importante/Secundario), Venta 30 días, Margen promedio, Utilidad 30 días, y OC atrasadas (botón → pestaña Órdenes; rojo si > 0).
- **Cockpit de negociación** (Card): 4 ítems de agenda numerados —
  1. **Costo**: nº SKU con alza >5% e impacto potencial en margen.
  2. **Productos detenidos**: nº SKU y capital inmovilizado.
  3. **Cumplimiento**: OTIF (aquí usa `deliveryCompliance`) y nº OC atrasadas.
  4. **Oportunidad**: nº SKU que crecen >25% con cobertura corta.
  Cada ítem incluye texto "Pedir: ..." (qué solicitar) y un tono (verde/ámbar/rojo/azul/neutral).
- **Posición negociadora** (Card): "Posición" (Media-alta / Media / Baja) con % de productos con alternativa; frase de concentración (top productos concentran X% de venta e Y% de utilidad); métricas Compras 90d, Productos activos, Alternativas, Detenidos.
- **Más vendidos (30 días)** (Card): top 5 por venta 30d con unidades y margen; enlace a `/productos/:sku`.
- **Productos detenidos** (Card): SKUs en sobrestock o sin venta con stock; badge "Sin venta"/"Sobrestock"; muestra hasta 5 y "+N más · ver pestaña Productos".

**Contenido por pestaña** (ver secciones específicas más abajo): Ficha, Negociación, Temporadas, Catálogo, Órdenes, Recepciones, Alertas.

### Secciones/bloques
1. `PageHeader` + `StatusBadge`.
2. Grid de 4 `KpiCard`.
3. Banner de revisión (condicional).
4. Panel "Para atender al proveedor" (5 celdas; la última es botón).
5. Cockpit de negociación (`NegotiationAgendaItem` x4).
6. Posición negociadora (`SupplierCockpitMetric` x4).
7. Más vendidos / Productos detenidos.
8. `Tabs` (7 pestañas) + contenido conmutado.

### Filtros disponibles
- No hay filtros de búsqueda en la ficha. El único "selector" es el `Tabs` (pestañas) y, dentro de la pestaña Negociación, un conmutador de vista de la tabla (Más vendidos / Más días de inventario / Menor margen / Mayor ganancia).

### Acciones del usuario
- Cambiar de pestaña (`Tabs`).
- Clic en KPI "OC abiertas" o en la celda "OC atrasadas" → salta a pestaña Órdenes.
- Navegar a productos (`/productos/:sku`), a otros proveedores alternativos (`/proveedores/:id`), a seguimiento de OC (`/comprar/seguimiento?oc=...`) y a recepciones (`/recepciones?rid=...`).
- En pestaña Negociación: **editar condiciones comerciales** y **registrar acuerdos** (única escritura de datos del módulo).
- Volver a proveedores desde el estado "no encontrado" o desde el breadcrumb.

### Botones y controles
- `Tabs` con contadores (Catálogo, Órdenes, Recepciones, Alertas muestran `count`).
- KPI "OC abiertas" clicable; celda "OC atrasadas" es un `<button>`.
- Botones "Editar" (condiciones) y "+ Registrar" (acuerdo) en la pestaña Negociación (sección Términos/Acuerdos).
- Conmutador de vistas (chips) en la tabla "Datos clave para negociar".
- Enlaces (`Link`) en listados y tablas.
- `MetricHint` (ayuda) en varios indicadores.

### Tablas / tarjetas / formularios / componentes
- Tarjetas KPI, `Card`/`CardHeader`/`CardBody`, `Badge`, `StatusBadge`, `AlertCard`, `EmptyState`, `Tabs`, `Button`, `Modal`, `ConfirmModal`, `Input`, `GStat`, `MonthlyBars` (gráfico de barras de estacionalidad), heatmap de 12 meses.
- Tablas: "Datos clave para negociar" (Negociación) y "Comparación año contra año" (Temporadas).
- Formularios (modales) en pestaña Negociación: editar condiciones comerciales y registrar acuerdo.

### Campos de formularios
Ver sección **Pestaña Negociación → Condiciones y acuerdos** (los únicos formularios del módulo).

### Estados posibles (existentes vs. no aplican por mock)
- **Proveedor no encontrado**: `EmptyState` + botón "Volver a proveedores" (existe).
- **Banner de revisión** visible/oculto según estado y cumplimiento.
- Cada pestaña tiene su **estado vacío** propio (Catálogo, Órdenes, Recepciones, Alertas usan `EmptyState`; Más vendidos y Productos detenidos usan texto "Sin ventas registradas" / "Sin sobrestock...").
- Estados de carga/error de red **no aplican** (datos mock).

### Navegación hacia otras pantallas
- Breadcrumb → `/proveedores`.
- `/productos/:sku` (detalle de producto) desde múltiples listados.
- `/proveedores/:id` (otros proveedores alternativos, en Negociación).
- `/comprar/seguimiento?oc=<number>` (seguimiento de OC) desde pestaña Órdenes.
- `/recepciones?rid=<id>` desde pestaña Recepciones.
- Deep-link entrante `?tab=...` (p. ej. desde el listado, MyPanel `?tab=negociacion`, CategoryDetail, etc.).

### Flujo funcional completo
1. Llega el usuario (desde listado, temporada, búsqueda global, categoría o panel personal).
2. Lee KPIs de servicio y el resumen "Para atender al proveedor".
3. Revisa el cockpit de negociación (qué pedir) y la posición negociadora (cuánta palanca tiene).
4. Profundiza en pestañas: ficha maestra, negociación detallada, temporadas, catálogo, órdenes, recepciones, alertas.
5. Registra condiciones/acuerdos negociados (se persisten localmente).

### Reglas de negocio inferibles
- **Importancia** (`importance`): `share ≥ 0.6` o `associatedSkus ≥ 200` → Estratégico; `share ≥ 0.3` o `≥ 100` → Importante; resto Secundario. `share = compra90d / máx compra90d del panel`.
- **Posición negociadora** (`negotiationPower`): si ≥45% de productos tienen equivalencias → "Media-alta"; si compra90d > 120.000.000 → "Media"; resto "Baja".
- **Productos detenidos**: `purchaseStatus === "overstock"` o (ventas 30d = 0 y stock > 0).
- **Alza de costo**: `cost > costoAnterior * 1.05` (>5%).
- **Oportunidad restringida** (`growingConstrained`): crecimiento ≥25% (vs. venta 90d/3), con venta 30d > 0 y cobertura ≤ `supplierLeadTimeDays * 2`.
- **SKU en quiebre / riesgo**: `availableStock ≤ 0` y `salesLast30Days > 0`.
- Umbrales de color reutilizados: cumplimiento 70/85, lead time 15, pendiente 20M.

### Validaciones
Solo en los formularios de la pestaña Negociación (ver detalle allí). El resto es lectura.

### Permisos/restricciones
Sin gating de rol detectado. La capacidad de editar condiciones/registrar acuerdos está disponible sin verificación de rol en el componente.

### Dudas / definiciones pendientes
- En el cockpit el ítem "Cumplimiento" etiqueta el valor como **OTIF** pero usa `deliveryCompliance` (puntualidad), mientras que la pestaña Negociación sí calcula un OTIF combinando cumplimiento × fill. Posible inconsistencia de nomenclatura. **Definición pendiente**.
- La ficha usa `suppliers` mock directo (no `useCollection`), a diferencia del listado.

---

### Pestaña "Ficha" — Ficha maestra + evaluación (`SupplierMaster`)

- **Objetivo**: datos maestros, contactos, condiciones, documentos tributarios, acuerdos marco y evaluación multidimensional.
- **Información que muestra**:
  - **Ficha del proveedor**: RUT, Estado (badge), Condición de pago (`condicionPago`), Plazo de entrega (`plazoEntregaDias` o, en su defecto, `averageLeadTimeDays`), Mínimo de compra (formateado según `minimoCompraTipo`: unidades o monto CLP; "—" si nulo), Categorías. Bloque "Marcas que representa" (badges) si existen.
  - **Contactos** (3 `ContactCard`): Comercial, Logística, Cobranza (nombre, email, teléfono; "Sin contacto registrado" si falta).
  - **Evaluación del proveedor** (score 0–100): barra por dimensión con semáforo (verde ≥85, ámbar ≥70, rojo <70) y badge de score total.
    - Dimensiones y pesos: Cumplimiento de fecha (0.28), Cumplimiento de cantidad (0.22), Calidad (0.18), Exactitud de factura (0.12), Exactitud documental (0.10), Estabilidad de precios (0.10).
    - **Datos mock/simulados**: "Fecha" usa `deliveryCompliance` y "cantidad" usa `fillRate` (datos reales del mock); **Calidad, factura, documental y precios son simulados de forma determinista** a partir de `hashString(supplier.id)`. La propia card lo declara: "Fecha y cantidad son datos reales; el resto es simulado (demo)."
  - **Documentos tributarios**: lista `documentosTributarios` (tipo, número, vence opcional, badge Vigente/Vencido). "Sin documentos registrados" si vacío.
  - **Acuerdos comerciales**: lista `acuerdosComerciales` (título + detalle). "Sin acuerdos registrados" si vacío.
- **Acciones**: solo lectura (no hay controles interactivos en esta pestaña).
- **Estados vacíos**: contactos sin registro, sin documentos, sin acuerdos, sin marcas.
- **Reglas de negocio**: semáforo de evaluación 70/85; ponderación fija de dimensiones.
- **Dudas**: la evaluación no es 100% real (parcialmente simulada). No hay acción para recalcular o editar la evaluación.

---

### Pestaña "Negociación" — Cuenta comercial + condiciones/acuerdos

Combina dos componentes: `SupplierNegotiation` (arriba) y `SupplierTermsAgreements` (abajo).

#### 2A. `SupplierNegotiation` — vista de cuenta comercial (solo lectura)
- **Objetivo**: ver el proveedor como cuenta comercial para preparar la negociación.
- **Información que muestra**:
  - **Rol del proveedor** (badge + consejo): Problemático (rojo, si tiene problema y es relevante), Estratégico (violeta), Crítico (ámbar), Reemplazable (azul, si hay alternativas), De oportunidad (slate). Muestra ranking "#N por compra".
  - **Resultado comercial** (`GStat`): Venta anual estimada (venta 30d × 12), Venta 30 días, Margen promedio (ámbar si <25%), Utilidad 30 días, Compra anual estimada (compra 90d × 4).
  - **Cumplimiento y abastecimiento**: Fill rate (`supplierFulfillment`; "—" si sin órdenes arribadas), OTIF (= cumplimiento × fill / 100), Cumplimiento, Lead time, OC atrasadas, Venta perdida (por quiebres) con nº SKU en quiebre.
  - **Participación por categoría**: barra de % de participación del proveedor en la venta de cada categoría, con comparación de margen proveedor vs. margen de la categoría (`mockCategories`).
  - **Mix de productos**: En quiebre / Sin rotación / En caída + Top vendidos (top 5, enlaces a producto).
  - **Datos clave para negociar** (tabla, top 10): conmutable por chips — Más vendidos, Más días de inventario, Menor margen, Mayor ganancia. Columnas: Producto, Venta 30d, Días inv. (ámbar si ≥90), Margen (rojo <20, ámbar <30), Ganancia 30d. La columna activa se resalta.
  - **Riesgo y dependencia**: Dependencia (Alta ≥40% / Media ≥20% / Baja) según participación en su categoría top; Alternativas (nº proveedores que cubren sus categorías, excluyendo inactivos y a sí mismo) con lista enlazada.
  - **Próxima negociación**: Objetivos sugeridos (generados dinámicamente según fill<95, cumplimiento<85, lead≥12, venta perdida>0, sin rotación>0, y palanca de volumen) y Palancas a tu favor (volumen anual + ranking, nº alternativas, participación en categoría top).
- **Reglas de negocio inferibles**:
  - Rol: `problem = deliveryCompliance < 70 || fillRate < 80`; `strategic = share ≥ 0.6 || SKUs ≥ 200`; `relevant = share ≥ 0.3 || SKUs ≥ 100`.
  - Alternativas: mismo criterio de categorías compartidas, excluyendo `inactive`.
  - Venta/compra anual son **estimaciones** (×12 y ×4). **Suposición** de anualización simple.
- **Datos mock**: OTIF, participación, venta perdida, etc., derivados de mocks; fill rate viene de `supplierFulfillment` (calculado sobre recepciones mock).
- **Acciones**: navegar a productos y a proveedores alternativos; conmutar la vista de la tabla. Solo lectura de datos.

#### 2B. `SupplierTermsAgreements` — Condiciones comerciales y acuerdos (EDITABLE / persistente)
- **Objetivo**: registrar y consultar las condiciones comerciales acordadas y el historial de acuerdos/seguimientos. **Única funcionalidad de escritura del módulo.**
- **Persistencia**: `localStorage` vía `useLocalStorage`:
  - `compras:terms:<supplier.id>` (objeto `SupplierTerms`).
  - `compras:agreements:<supplier.id>` (array `Agreement`).
- **Condiciones comerciales (card + modal de edición)**:
  - Valores por defecto (`DEFAULT_TERMS`): plazo de pago 30 días, flete "Por pagar (cliente)", mínimo "$500.000", descuento base 0%, rebate "Sin rebate vigente", devoluciones "Solo por falla · 30 días", marketing "Sin apoyo acordado", ejecutivo "—".
  - Se muestran 8 filas: Plazo de pago, Descuento base, Flete, Mínimo de compra, Rebate/bonificación, Devoluciones, Apoyo marketing, Ejecutivo asignado.
  - **Campos del formulario (modal "Editar condiciones comerciales")**:
    - Plazo de pago (días) — `Input type=number`, `min=0`.
    - Descuento base (%) — `Input type=number`, `min=0`.
    - Flete — texto.
    - Mínimo de compra — texto (string libre, incluye símbolo).
    - Rebate / bonificación — texto.
    - Devoluciones — texto.
    - Apoyo marketing — texto.
    - Ejecutivo asignado — texto.
  - **Controles**: botón "Editar" abre el modal; footer con "Cancelar" y "Guardar" (deshabilitado si no hay cambios: muestra "Sin cambios").
  - **Validación / control de cambios**: `termsDirty` compara `draft` vs `terms` (JSON). Al cerrar con cambios sin guardar, abre `ConfirmModal` "Descartar cambios" (Descartar / Seguir editando). Al guardar, toast de éxito "Condiciones comerciales actualizadas".
- **Acuerdos y seguimiento (card + modal de registro)**:
  - Lista cronológica (más reciente primero) de acuerdos: fecha, badge "Seguir <fecha>" si hay `followUp`, Objetivo, y Acordado (si existe).
  - Estado vacío: "Sin acuerdos registrados...".
  - **Campos del formulario (modal "Registrar acuerdo")**:
    - Fecha — `Input type=date` (valor inicial fijo `"2026-06-26"`).
    - Objetivo / lo pedido — texto (placeholder "Ej: Bajar costo 5% y fill 95%").
    - Lo acordado — texto (placeholder "Ej: 3% + despacho semanal").
    - Próximo seguimiento — `Input type=date`.
  - **Validación**: al guardar, si `objective` está vacío → toast de advertencia "Indica al menos el objetivo" y no guarda. Con objetivo válido → prepend a la lista, toast "Acuerdo registrado".
  - **Controles**: botón "+ Registrar", footer "Cancelar"/"Guardar".
- **Estados posibles**: sin acuerdos (vacío) / con acuerdos; condiciones por defecto vs. editadas; modal con cambios (dirty) vs. sin cambios.
- **Reglas de negocio**: el `id` del acuerdo se genera con `ag${Date.now()}`; objetivo es obligatorio, resto opcional; datos aislados por proveedor.
- **Dudas / pendientes**:
  - La **fecha por defecto del acuerdo está hardcodeada** en `"2026-06-26"` (no usa la fecha actual). **Definición pendiente / posible bug** (hoy es 2026-07-13).
  - No hay edición ni borrado de acuerdos existentes (solo alta y visualización).
  - Persistencia local por navegador: los datos no se comparten entre usuarios/dispositivos (limitación de la demo mock).

> Nota: al final de `SupplierTermsAgreements.tsx` hay un comentario sobre una "Evaluación del proveedor (score 0–100)" con dimensiones reales y simuladas; la implementación de esa evaluación reside en `SupplierMaster.tsx` (pestaña Ficha).

---

### Pestaña "Temporadas" — Estacionalidad (`SeasonView`)
- **Objetivo**: analizar la estacionalidad del proveedor y qué negociar antes del peak. Toda la data proviene de `supplierSeasonality(supplier.name)`, que **genera 24 meses de venta/margen/quiebres/fill de forma determinista según perfil de categoría** (construcción, jardín, herramientas, pinturas, plano). Es **data simulada** (mock/demo).
- **Información que muestra**:
  - **Alerta de pre-temporada** (condicional): "Entra en temporada alta en ~N días (peak histórico en <mes>)", con fill y lead time; recomienda negociar OC y stock reservado ahora.
  - **KPIs (7 `GStat`)**: Venta 12m, variación vs 12m previos, Margen prom., Quiebres 12m, Fill rate, Venta perdida (12m), Score temporada (0–100, semáforo 80/60).
  - **Clasificación de comportamiento** (badge): constante / permanente_peak / estacional (según `classification`), con "Meses clave".
  - **Heatmap de 12 meses**: intensidad de venta (más oscuro = más venta) y ⚠ con nº de quiebres por mes.
  - **Curva de venta 12 meses** (`MonthlyBars`), destacando meses ≥110% del promedio.
  - **Comparación año contra año** (tabla): venta del mismo mes por año, con variación del último año vs. el anterior; filas de peak resaltadas.
  - **Estacionalidad por producto**: cada SKU clasificado (campañero/estacional/permanente) con insight, mes peak y % en temporada; enlaces a producto.
  - **Guía Pre / Temporada / Post**: tres tarjetas con checklist de acciones por fase.
  - **Top productos de temporada**: SKUs que explican la temporada con acción sugerida (badge).
  - **Conclusión y recomendación**: texto generado (`recommendation`).
- **Acciones**: navegar a productos; consultar ayuda de fill rate. Solo lectura.
- **Estados vacíos**: "Sin productos para clasificar" / "Sin ventas registradas" según corresponda; alerta de pre-temporada solo si aplica.
- **Reglas de negocio inferibles**: semáforos de score temporada (80/60), margen (<25 ámbar), quiebres (≥8 rojo), fill (<90 rojo); destaque de meses peak (≥110% del promedio).
- **Datos mock**: **toda la serie temporal es simulada** por perfil de categoría — dejar claro que no representa historia real.

---

### Pestaña "Catálogo" (productos del proveedor)
- Lista los productos con `supplierName === supplier.name`. Estado vacío `EmptyState` "Sin productos".
- Por producto muestra: nombre + SKU (enlace a `/productos/:sku`), categoría, disponible, venta/mes, costo, delta de costo vs. `costoAnterior` (▲/▼ %), descuento vigente (%), código proveedor, EAN (código de barras), unidad de compra/venta, múltiplo de compra, nº de equivalentes en otros proveedores (con tooltip de costos), y `StatusBadge kind="purchase"` del estado de compra.
- **Objetivo declarado**: "Cómo compra Mimbral cada producto a este proveedor: código, unidades, múltiplo, costo y equivalencias."
- Solo lectura.

### Pestaña "Órdenes"
- Lista OC con `supplierName === supplier.name`. Estado vacío "Sin órdenes".
- Por OC: número, fecha esperada, monto total, badge de días de atraso (si `delayedDays > 0`), `StatusBadge kind="purchaseOrder"`.
- Enlace a `/comprar/seguimiento?oc=<number>`.

### Pestaña "Recepciones"
- Lista recepciones del proveedor. Estado vacío "Sin recepciones".
- Por recepción: nº OC, bodega, fecha esperada, conforme/observación (`qualityOk`), badge de estado (`RECEPTION_STATUS`).
- Enlace a `/recepciones?rid=<id>`.

### Pestaña "Alertas"
- Muestra `AlertCard` (compact) para alertas cuyo `relatedEntity` es el proveedor o cuyo `relatedSku` pertenece a sus SKUs. Estado vacío "Sin alertas".

---

## Resumen del módulo

### Objetivo
Gestionar la relación con proveedores desde la óptica de compras: medir su desempeño (cumplimiento, lead time, despacho/fill, OTIF, monto pendiente), entender su valor comercial (venta, margen, utilidad, participación), preparar y registrar negociaciones, y anticipar temporadas. Sirve para decidir a quién comprar, a quién revisar/penalizar y con quién crecer.

### Pantallas
1. **Performance de proveedores** (`/proveedores`): listado comparativo con KPIs, rankings, alerta de temporada y tabla filtrable.
2. **Detalle / ficha de proveedor** (`/proveedores/:id`): cabecera con KPIs + cockpit de negociación, y 7 pestañas: **Ficha** (maestro + evaluación), **Negociación** (cuenta comercial + condiciones/acuerdos editables), **Temporadas** (estacionalidad simulada), **Catálogo**, **Órdenes**, **Recepciones**, **Alertas**.

### Flujo principal
Listado → filtrar/detectar proveedores críticos o próximos a temporada → abrir ficha → revisar KPIs, cockpit y posición negociadora → profundizar por pestañas → registrar condiciones comerciales y acuerdos negociados (persistidos en localStorage).

### Funcionalidades principales
- Ranking y semáforos de desempeño de proveedores (cumplimiento, lead time, despacho, pendiente).
- Ficha 360°: datos maestros, contactos, documentos tributarios, acuerdos marco y **evaluación multidimensional 0–100** (parcialmente simulada).
- **Cockpit de negociación** con agenda priorizada (costo, detenidos, cumplimiento, oportunidad) y posición negociadora (dependencia/alternativas/concentración).
- **Condiciones comerciales y acuerdos editables y persistentes** (única escritura del módulo, en localStorage por proveedor).
- Análisis de **estacionalidad** (heatmap, curva, comparación año a año, clasificación por SKU) — data simulada.

### Funcionalidades secundarias
- Alerta de proveedores que entran en temporada (listado) con deep-link a la pestaña Temporadas.
- Detección de productos detenidos, en quiebre, sin rotación y en caída.
- Tabla "datos clave para negociar" conmutable por criterio.
- Vista de catálogo con detalles de compra (código proveedor, EAN, unidades, múltiplo, equivalencias, delta de costo).
- Listados de OC, recepciones y alertas del proveedor con enlaces cruzados.
- Ayuda contextual de métricas (`MetricHint`: cumplimiento, despacho, fill rate, OTIF, lead time, pendiente).

### Dependencias con otros módulos
- **Productos** (`mockProducts` / `/productos/:sku`): cruces por `supplierName`; enlaces al detalle de producto.
- **Órdenes de compra** (`mockPurchaseOrders` / `/comprar/seguimiento`): OC abiertas, atrasadas y monto pendiente.
- **Recepciones** (`mockReceptions` / `/recepciones`): fill rate, OTIF y pestaña Recepciones.
- **Alertas** (`mockAlerts`): pestaña Alertas y motivo de revisión.
- **Categorías** (`mockCategories`): participación y comparación de margen; enlaces desde `CategoryDetailPage`.
- **Mi cartera / Mi panel** (`myPanel`): deep-links a `/proveedores/:id?tab=negociacion` y foco "proveedores".
- **Búsqueda global** (`Topbar`): acceso directo a la ficha.
- **Utilidades**: `supplierPerf` (fill rate/despacho), `seasonality` (temporadas simuladas), `hash` (evaluación simulada), `formatters`, `useUrlState`, `useLocalStorage`, `DataContext`.

### Definiciones pendientes / hallazgos transversales
- **Datos mock**: performance, evaluación (dimensiones no-reales) y estacionalidad completa son simulados/deterministas; solo cumplimiento, lead time, fill (desde recepciones) y datos maestros vienen de mocks "de negocio".
- **Fecha hardcodeada** `"2026-06-26"` como default al registrar acuerdos (no usa fecha actual).
- **Nomenclatura OTIF** inconsistente entre el cockpit (usa cumplimiento) y la pestaña Negociación (calcula OTIF real).
- **Inconsistencia de fuente**: listado usa `useCollection`, detalle usa el array mock directo.
- **Sin gating de rol** detectado; ambos roles (`comprador`/`lider`) accederían por igual.
- Los acuerdos no se pueden editar ni eliminar; la persistencia es local (por navegador).
