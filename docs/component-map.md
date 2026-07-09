# Component Map

## Base UI

- Button: acciones primarias, secundarias y ghost.
- Input / Select: formularios y filtros.
- Tabs: segmentos de vista o foco.
- Badge: estado compacto con texto.
- Drawer: detalle lateral y decisiones.
- Modal: confirmaciones o ediciones cortas.
- Table: escritorio con sorting y mobile cards.
- EmptyState: seccion sin datos con explicacion util.
- Skeleton: carga de pagina, KPI y tabla.

## Componentes de negocio actuales

- KpiCard
- FilterBar
- PriorityGuide
- StatusBadge
- RecommendationBadge
- PriorityBadge
- StateLegend
- AlertCard
- CatalogRedundancy

## Componentes a consolidar

- PriorityList: maximo 5 prioridades en Inicio.
- DecisionItem: alerta + recomendacion + accion.
- RecommendationDrawer: explicacion de compra.
- ScenarioSimulator: cantidad, cobertura, capital y riesgo.
- BudgetProgress: presupuesto con estado y accion.
- CategoryHealthRow: salud por categoria.
- SupplierScorecard: proveedor, cumplimiento, lead time y problemas.
- Product360Summary: bloque reutilizable para SKU.
- PortfolioHealth: salud de cartera por dimensiones.
- KeyProductRoleRow: producto estrella, tractor, margen, emergente, deterioro, detenido o riesgo.
- SupplierNegotiationCockpit: agenda, poder negociador, productos clave y productos detenidos.

## Reglas

- No crear otro Card/KPI/Table si ya existe una base.
- No meter explicaciones largas dentro de celdas.
- No usar badges distintos para conceptos iguales.
- No exponer mas de 8 columnas principales sin justificacion.
