# Arquitectura frontend — Plataforma de Compras

Plataforma modular y **conectada**: no son pantallas aisladas, sino un sistema donde cada dato relevante es cliqueable, abre su detalle y permite navegar a lo relacionado.

## Capas

```
src/
  components/
    ui/         # primitivos reutilizables (Button, Card, Modal, Drawer, Tabs,
                #   DataTable, ConfirmModal, Breadcrumbs, Toaster, icons, ...)
    layout/     # AppLayout, Sidebar, Topbar, MobileNav, MobileBottomNav,
                #   NotificationCenter, navItems
    business/   # componentes de dominio (KpiCard, StatusBadge, FilterBar,
                #   HelpNote, PriorityGuide, ExportButton, CampaignBuilderModal...)
  shared/
    entities.ts             # modelo de navegación contextual entre módulos
    components/             # RelatedEntitiesPanel, ActivityTimeline
  services/                 # capa de datos desacoplada (apiClient + *Service)
  context/                  # estado global (stores): Toast, OcDraft, Buyer, Notification
  data/                     # datos mock
  pages/                    # vistas por módulo
  utils/                    # formatters, calculations, filters, hooks (useUrlState, useLocalStorage)
  routes/                   # AppRoutes
  types/                    # tipos de dominio
```

> Nota: las páginas viven hoy en `pages/` (no en `modules/<m>/pages`). El proyecto
> nació monolítico y se le añadieron las capas conectivas (services + shared/entities
> + context) de forma aditiva para no romper la app. La migración física a
> `modules/<modulo>/...` es el siguiente refactor recomendado y es directa porque la
> lógica de datos ya está desacoplada en `services/`.

## Capa de servicios (`src/services`)

Los componentes **no** consumen los datos mock directamente, sino los servicios:
`productService`, `supplierService`, `categoryService`, `purchaseOrderService`,
`recommendationService`, `alertService`, `campaignOpportunityService`.

`apiClient.getMock()` devuelve hoy datos locales. Para conectar un backend real solo
se cambia esta capa (p. ej. `getMockAsync` → `fetch().then(r => r.json())`) sin tocar
las vistas.

## Navegación contextual (`src/shared/entities.ts`)

Define `EntityRef` (referencia genérica: `entityType`, `entityId`, `moduleKey`,
`displayName`, `status`, `route`) y un `moduleRegistry`. La función
`relatedEntitiesForProduct(sku)` resuelve las entidades vinculadas (proveedor,
categoría, recomendación, órdenes, alertas, campañas) para poder saltar de un módulo
a otro. Es el punto único para extender relaciones a futuro.

`RelatedEntitiesPanel` consume estos `EntityRef[]` y los renderiza agrupados y
cliqueables. `ActivityTimeline` muestra la actividad/auditoría de una entidad.

## Estado global (stores vía Context)

- `ToastContext` — feedback de acciones.
- `OcDraftContext` — borrador de orden de compra (persistido).
- `BuyerContext` — comprador actual + sus categorías (persistido).
- `NotificationContext` — notificaciones derivadas de alertas y OC atrasadas, cada una
  con ruta de navegación contextual (persistencia de leídas).

Todos persisten en `localStorage` vía `useLocalStorage`. Los filtros viven en la URL
(`useUrlState` / `useUrlToggle`) para no perder contexto al navegar y poder compartir vistas.

## Conexión entre módulos (ejemplos vivos)

- **Detalle de producto** → tabs Resumen / Relacionados / Actividad; el panel de
  relacionados enlaza a proveedor, categoría, OC, alertas, campañas y reposición.
- **Notificación** (campana del Topbar) → abre el producto u OC afectado.
- **Búsqueda global** (Topbar / menú móvil) → productos, proveedores, OC; salta al detalle.
- **KPIs** del Dashboard y Mi panel → navegan a la lista filtrada correspondiente.
- **Alertas** → acción directa (Agregar a OC, Ver producto, Revisar proveedor).
- **Mi panel** del comprador → conecta categorías, riesgo de quiebre, OC y proveedores.

## Componentes reutilizables clave

Layout: `AppLayout`, `Sidebar`, `Topbar`, `MobileNav`, `MobileBottomNav`, `NotificationCenter`.
UI: `Button` (con `loading`), `Card`, `Modal`, `ConfirmModal`, `Drawer`, `Tabs`,
`DataTable` (orden, selección, acciones masivas, **modo tarjeta en móvil**), `Breadcrumbs`,
`EmptyState`, `Toaster`, `Tooltip`, `Input`, `Select`, `Badge`.
Negocio: `KpiCard` (cliqueable), `StatusBadge`, `PriorityBadge`, `RecommendationBadge`,
`FilterBar` (filtros principales + "Más filtros" colapsable + chips/contador),
`HelpNote`, `StateLegend`, `PriorityGuide`, `ExportButton`, `RelatedEntitiesPanel`,
`ActivityTimeline`, `CampaignBuilderModal`.

## Experiencia móvil

- **Navegación inferior** (`MobileBottomNav`) con secciones clave al alcance del pulgar.
- **Tablas → tarjetas** en pantallas chicas vía `DataTable mobileCard`.
- Buscador global accesible desde el menú móvil.
- Modales y drawers a ancho completo; objetivos táctiles cómodos.

## Cómo agregar un módulo nuevo

1. Añadir su `*Service` en `services/`.
2. Crear su página en `pages/` (o `modules/<m>/pages` al migrar).
3. Registrar la ruta en `routes/AppRoutes.tsx` y el ítem en `navItems`.
4. Si se relaciona con otros, extender `shared/entities.ts` (registry + resolver).
5. Reutilizar `PageHeader`, `FilterBar`, `DataTable`, `StatusBadge`, etc. para mantener consistencia.
