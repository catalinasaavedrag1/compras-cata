# Mejoras de usabilidad — Plataforma de Compras

Documento que resume el rediseño de experiencia (UX) orientado a que un comprador de retail **entienda la pantalla en segundos, sepa qué hacer y avance con pocos clics**. Foco: herramienta operacional, no dashboard decorativo.

---

## Problemas de usabilidad detectados y cómo se resolvieron

| Problema detectado | Solución implementada |
|---|---|
| El comprador no veía "lo suyo" al entrar | Vista **Mi panel** por comprador: categorías asignadas, tareas, riesgo de quiebre, sobrestock, OC sin recibir y proveedores por revisar. |
| Números sin acción (no se podía profundizar) | **KPIs cliqueables** (`KpiCard` con `to`) que llevan a la lista filtrada correspondiente. |
| Estados técnicos sin significado | `StatusBadge` + `StateLegend` + `statusInfo` con descripción en lenguaje de negocio. |
| Acciones sin feedback | **Toasts** (`ToastProvider`) tras agregar a OC, ignorar, resolver alertas, crear campaña, exportar, etc. |
| Tablas como base de datos cruda | `DataTable` con orden por columna, **orden por urgencia por defecto**, selección múltiple, acciones masivas y mensajes vacíos por contexto. |
| Filtros que abruman | `FilterBar` con **filtros principales + "Más filtros" colapsable**, contador de filtros activos y "Limpiar filtros". |
| No se sabía cuándo quiebra un producto | **Fecha estimada de quiebre** por SKU (`estimatedStockoutDate`) en Productos, Reposición y Mi panel. |
| La cantidad sugerida no se entendía | Etiqueta **"para ~N días"** + explicación de que incluye el lead time del proveedor. |
| Acciones destructivas sin red de seguridad | `ConfirmModal` (ej. eliminar campaña). |
| No se podía volver / ubicarse en subpáginas | `Breadcrumbs` en el `PageHeader` (ej. detalle de producto). |
| Filtros se perdían al navegar | **Filtros en la URL** (`useUrlState` / `useUrlToggle`): back y links compartibles. |
| Búsqueda inútil | **Buscador global** en el Topbar con resultados instantáneos (productos, proveedores, OC) y salto al detalle. |
| Datos se perdían al recargar | Persistencia en `localStorage`: borrador de OC, alertas, OC creadas, campañas, comprador, sugerencias ignoradas. |

## Navegación

- **Sidebar agrupado** por propósito: Inicio (Dashboard, Mi panel) · Gestión de compra (Reposición, Campañas, Órdenes, Proveedores) · Catálogo (Productos, Categorías) · Análisis (Inventario, Ventas, Alertas) · Configuración (Reglas).
- Cada ítem tiene icono y tooltip; el agrupamiento se replica en móvil.
- **Sidebar colapsable** (estado recordado en `localStorage`): en modo colapsado queda fijo —no se expande solo al pasar el mouse, evitando que tape el contenido por accidente— y cada icono muestra un **tooltip instantáneo** (etiqueta + descripción) a la derecha, sin el retardo del `title` nativo. Atajo de teclado **`[`** para colapsar/expandir sin usar el mouse.
- **Topbar** con buscador global, **selector de comprador** (cambia el contexto de "Mi panel"), fecha y avatar con iniciales.
- `Breadcrumbs` donde corresponde.

## Tablas

- Encabezados simples; columnas clave primero; secundarias se ocultan en móvil (`hideOnMobile`).
- Orden por columna (▲▼) y **orden por urgencia por defecto**.
- Estados y prioridades como **badges** con color y significado consistente.
- Selección múltiple + **barra de acciones masivas** (agregar a OC, ignorar) en Reposición.
- Acciones rápidas por fila con verbos claros (Agregar a OC, Ajustar, Ignorar, Ver producto).
- Contador de resultados + filtros activos; mensaje vacío contextual por pestaña/filtro.

## Formularios y flujos

- **Crear campaña** (`CampaignBuilderModal`): secciones (datos → canales → productos en descuento), ayuda contextual, validación con mensajes claros ("Ponle un nombre…", "Agrega al menos un producto…"), placeholders de ejemplo y badge de alerta si hay productos con stock bajo.
- **Crear OC desde sugerencias** (drawer) con ajuste de cantidades y total en vivo.
- `Button` con estado de **carga** (`loading`) y deshabilitado durante la acción.

## Estados, mensajes y feedback

- Estados con nombre claro, color consistente y descripción (leyenda / badges).
- Toasts de éxito/info tras cada acción.
- Mensajes de validación que explican qué corregir.
- **Empty states con acción sugerida** (ej. "Aún no has creado campañas → Crear campaña"; "No hay alertas activas → Ir a reposición").

## Catálogo optimizado (productos redundantes)

- Vista **Catálogo optimizado** (`/catalogo-optimizado`) para racionalizar el surtido por **exceso de variedad**: dentro de un mismo tipo de producto (categoría → subcategoría) basta con una opción por **gama de precio** (económica/media/premium). Se conserva la mejor de cada gama por venta, rotación y margen; las demás de la misma gama **sobran** y se sugiere **Liquidar** (con stock) o **Descontinuar** (sin ventas/stock).
- Caso de **surtido invertido**: si el mejor de su gama está marcado *no comprar*/descontinuado mientras se mantiene uno peor, se marca **Reactivar compra**.
- Resumen con **capital inmovilizado liberable** y % del surtido redundante; grupos ordenados por mayor capital a liberar. Filtro por categoría en la URL. Acciones: **exportar CSV** y **crear campaña de liquidación** (precarga los redundantes con stock).
- La misma vista está disponible como pestaña **"Optimizar surtido"** en el detalle de cada categoría.
- **Conectada con otras vistas**: filtros por acción (Todos/Liquidar/Descontinuar/Reactivar); chip de estado en el **detalle de producto** ("Redundante · …" / "Reactivar compra") que enlaza a la vista; chip de **capital liberable** en el Dashboard; y crea **campañas** que aparecen en "Mis campañas".
- Lógica pura en `utils/catalogOptimization.ts` (incl. `skuOptimizationStatus`); UI reutilizable en `components/business/CatalogRedundancy.tsx`.

## Guía al usuario

- Bloque **"Qué revisar primero" / "Todas mis tareas"** (`PriorityGuide`) ordenado por urgencia, con conteo en vivo; lo resuelto se marca en verde.
- `HelpNote` corto por pantalla explicando conceptos (sobrestock, margen bajo, cobertura, lead time) sin saturar.
- **Decisión recomendada** destacada en el detalle de producto.

## Componentes reutilizables (consistencia)

`PageHeader`, `Breadcrumbs`, `FilterBar`, `DataTable`, `StatusBadge`, `PriorityBadge`/`SeverityBadge`, `RecommendationBadge`, `KpiCard` (cliqueable), `HelpNote`, `StateLegend`, `PriorityGuide`, `ExportButton`, `Button` (con loading), `Modal`, `ConfirmModal`, `Drawer`, `Tabs`, `EmptyState`, `Toaster`, `BarList`, `CampaignBuilderModal`.

Contextos: `ToastContext`, `OcDraftContext`, `BuyerContext`.

## Velocidad percibida

- Sin recargas: navegación SPA; cambios de tabla sin recargar la pantalla.
- Filtros persistidos al volver atrás.
- Datos mock síncronos (no hay espera real). El `Button` con `loading` y el patrón de toasts quedan listos para cuando se conecte el backend.

## Cómo lo usa un comprador (flujo ideal)

1. Entra a **Mi panel** y ve sus tareas ordenadas por urgencia.
2. Revisa **riesgo de quiebre**: SKU, fecha estimada de quiebre y compra sugerida "para ~N días".
3. Agrega a OC los críticos (toast de confirmación; contador en el Topbar).
4. Va a **Órdenes de compra**, crea la OC desde el borrador y sigue las atrasadas.
5. Revisa **proveedores** con bajo cumplimiento.
6. Antes de un evento, usa **Campañas y oportunidades**: crea la campaña, sube productos con descuento y elige canales (web, marketplace, Google Ads, Meta…).

## Pendientes / próximas iteraciones sugeridas

Algunas piezas del spec ampliado requieren extender el modelo de datos y se proponen como siguientes incrementos:

- **Detail drawers** (SKU / OC / proveedor / tarea) como panel lateral, además de las páginas de detalle actuales.
- **Tablero de tareas** con estados editables (pendiente, en gestión, resuelta, postergada) y vista calendario/agenda.
- Campos de inventario adicionales por SKU: **stock en tránsito, reservado, venta 7 días**, OC relacionada y fecha estimada de llegada (hoy se derivan parcialmente).
- **Compras sugeridas** con filtros rápidos por horizonte (15/30/60 días) y por ventana de quiebre (7/15/30 días), y fecha recomendada para emitir la OC.
- Buckets de **proveedores por revisar** (esta semana / este mes / próximos 2 meses) con próxima revisión recomendada.
- Skeleton loaders reales al integrar API.
- Conversión de tablas a tarjetas en móvil.
