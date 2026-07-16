# Documentación técnica — página por página

Referencia de código de la plataforma de compras, organizada por módulo. Cada
documento describe, para cada archivo/página: **ruta**, **propósito**, **fuentes
de datos**, **estado y navegación**, **estructura visual**, **lógica de negocio
clave** (citando la función util correspondiente) y los **subcomponentes**
definidos en el archivo.

Se generó revisando el código archivo por archivo. Complementa —no reemplaza— la
documentación conceptual de alto nivel (`ARQUITECTURA.md`, `README_COMPRAS.md`,
`docs/information-architecture.md`, `docs/component-map.md`).

## Índice

| # | Documento | Cubre |
|---|-----------|-------|
| 01 | [inicio-equipo](./01-inicio-equipo.md) | Inicio (portada de trabajo), panel del líder, carga del equipo, alertas de equipo, compradores, objetivos |
| 02 | [cartera](./02-cartera.md) | Productos, ficha de producto, categorías, ficha de categoría, surtido, optimización de catálogo, nuevos productos (NPI) |
| 03 | [inventario-plan](./03-inventario-plan.md) | Análisis de inventario, plan de compra / reposición, presupuesto (OTB), venta no capturada, señales de ventas |
| 04 | [negociaciones-aprobaciones](./04-negociaciones-aprobaciones.md) | Cotizaciones (RFQ), alzas de precio, decisiones, aprobaciones (máquina de estados) |
| 05 | [ordenes-config](./05-ordenes-config.md) | Órdenes de compra (proceso necesidad→emitida), borrador de OC, gobierno/bitácora, reglas y parámetros, documentos |
| 06 | [entregas](./06-entregas.md) | Recepciones, detalle de recepción, plan de retiro, importaciones (landed), reclamos a proveedores |
| 07 | [proveedores](./07-proveedores.md) | Lista de proveedores, ficha 360, cockpit de negociación, registro de negociación, acuerdos comerciales |
| 08 | [temporadas-campanas](./08-temporadas-campanas.md) | Temporadas y canales, planificador de temporada, campañas, oportunidades de campaña, desempeño, margen por canal |
| 09 | [analisis-miplan](./09-analisis-miplan.md) | Rentabilidad/ranking, ventas, reportes (export CSV), aprendizaje, calidad de compra, mi desempeño, alertas, login |
| 10 | [fundamentos](./10-fundamentos.md) | Sistema de diseño (ui), componentes de negocio, layout/navegación, contextos, utilidades, datos mock y convenciones |
| 11 | [mejoras-recomendadas](./11-mejoras-recomendadas.md) | Registro de la limpieza de código aplicada y deuda técnica pendiente detectada en la revisión |

## Cómo se organiza el código

```
src/
  components/
    ui/         primitivos del sistema de diseño (Button, Card, Modal, Drawer,
                Tabs, Table, Badge, Select, Input, PageHeader, MoreActions, ...)
    business/   componentes de dominio (KpiCard, PurchaseProcessBar,
                SupplierOrderCoach, SeasonalityChart, PriorityBadge, ...)
    layout/     shell de la app (Sidebar, Topbar/AppHeader, MobileNav,
                MobileBottomNav, NotificationCenter, navItems)
  context/      estado global (Auth, Buyer, Role, Toast, Notification, OcDraft,
                PurchaseFlow, Claims, Trace, Signals, Density, Data)
  data/         datos mock por dominio (mock*.ts)
  pages/        vistas por módulo (+ subcarpetas con sus componentes/helpers)
  utils/        formatters, calculations, filters, scoring y hooks
  routes/       AppRoutes (rutas + lazy loading)
  types/        tipos de dominio
```

## Convenciones transversales

- **Formato chileno**: usa siempre los helpers de `src/utils/formatters.ts`
  (`formatCurrency`, `formatNumber`, `formatDate`, `formatPercent`, `formatDelta`)
  en vez de reimplementar `toLocaleString`.
- **Fecha "de hoy"**: `TODAY_ISO` en `src/utils/constants.ts` (la demo está fijada
  al 24/06/2026). No uses `new Date()` para fechas de negocio.
- **Navegación entre entidades**: `src/utils/entityLinks.ts` resuelve
  nombre → ruta de ficha (proveedor, categoría, producto).
- **Bitácora/trazabilidad**: registra cambios con `useTrace().log({...})`.
- **Persistencia local**: `useLocalStorage(clave, seed)` con datos mock por defecto.
- **Estricto**: el proyecto compila con `strict`, `noUnusedLocals` y
  `noUnusedParameters`; no hay imports ni variables sin usar.
