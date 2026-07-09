# Buyer Workspace Frontend Product Audit

## Alcance

Auditoria frontend de Buyer Workspace como herramienta de decision para compradores retail. No cubre backend, APIs, contratos, infraestructura ni integraciones.

## Stack identificado

- Framework: React 18 + TypeScript.
- Build: Vite.
- Routing: React Router.
- Estilos: Tailwind CSS con componentes propios.
- Estado frontend: React Context, hooks y mocks locales.
- Datos: `src/data/mock*.ts` y utilidades de calculo en `src/utils`.
- Layout: `AppLayout` con sidebar desktop, header contextual, mobile drawer y bottom nav.

## Mapa de navegacion actual

Navegacion principal:

- Inicio
- Mi cartera
- Comprar
- Inventario
- Rentabilidad
- Catalogo
- Proveedores
- Mi plan
- Lider y Equipo para rol lider

Navegacion contextual por modulo:

- Comprar: Sugerencias, Cotizaciones, Ordenes, Aprobaciones, Historial decisiones, Reglas.
- Inventario: Cobertura & sobrestock, Venta no capturada, Recepciones, Documentos.
- Rentabilidad: Ranking & liquidacion, Ventas, Margen por canal, Variaciones de costo, Presupuesto.
- Catalogo: Duplicidad, Campanas, Productos a potenciar.
- Proveedores: Performance.
- Mi plan: Metas, Alertas, Senales ventas, Resultados.

## Mapa de pantallas

- Inicio y Mi cartera: `MyPanelPage`, con comportamiento segun ruta.
- Comprar: `ReplenishmentPage`, `RfqPage`, `PurchaseOrdersPage`, `ApprovalsPage`, `AprendizajePage`, `SettingsPage`.
- Inventario: `InventoryAnalysisPage`, `LostOpportunitiesPage`, `ReceptionsPage`, `DocumentsPage`.
- Rentabilidad: `PurchaseAnalysisPage`, `SalesAnalysisPage`, `ChannelMarginPage`, `PriceIncreasesPage`, `BudgetPage`.
- Catalogo: `CatalogOptimizationPage`, `CampaignsPage`, `CampaignOpportunitiesPage`, `ProductsPage`, `CategoriesPage`.
- Proveedores: `SuppliersPage`, `SupplierDetailPage`.
- Mi plan: `MyPerformancePage`, `AlertsPage`, `SalesSignalsPage`, `ReportsPage`.

## Componentes globales

- Layout: `Sidebar`, `AppHeader`, `MobileNav`, `MobileBottomNav`.
- UI base: `Button`, `Input`, `Select`, `Table`, `Card`, `Tabs`, `Drawer`, `Modal`, `Badge`, `EmptyState`, `Skeleton`, `BottomSheet`.
- Negocio: `KpiCard`, `FilterBar`, `PriorityGuide`, `StatusBadge`, `RecommendationBadge`, `PriorityBadge`, `StateLegend`, `AlertCard`, `CatalogRedundancy`.

## Hallazgos

### Duplicaciones

- Inicio y Mi cartera comparten demasiados conceptos: quiebres, cobertura, sobrestock, OC, proveedores, tareas y accion recomendada.
- Comprar mezcla recomendacion, presupuesto, filtros, explicacion y acciones masivas en un mismo plano visual.
- Algunas vistas secundarias aparecen como si fueran modulos principales, aumentando carga cognitiva.

### Jerarquia visual

- Muchas pantallas usan varias cards con peso similar. Esto dificulta entender que decision tomar primero.
- Existen KPIs sin comparacion o sin contexto de decision en algunas pantallas.
- Las alertas, recomendaciones, tareas y aprobaciones no siempre tienen tratamiento visual suficientemente distinto.

### Densidad y legibilidad

- Las tablas pueden superar el limite recomendado de columnas visibles.
- Varias filas combinan metricas, explicaciones y acciones dentro de la misma celda.
- En mobile hay soporte de tarjetas en `DataTable`, pero varias pantallas siguen heredando densidad de escritorio.

### Navegacion

- La arquitectura modular actual es correcta como direccion: sidebar para modulos y top nav contextual.
- Todavia hay riesgo de que submodulos secundarios compitan con rutas principales.
- El usuario necesita menos caminos simultaneos y mas flujo: observar, entender, priorizar, decidir, ejecutar, revisar.

### Interaccion

- Existen modales y drawers reutilizables, pero la decision principal de compra todavia necesita vivir en un drawer explicativo.
- Falta consolidar patrones de simulacion: cantidad, cobertura, capital, riesgo e impacto.
- Varias acciones dicen "Ver" o "Ajustar" cuando podrian ser mas especificas.

### Estados

- Hay `EmptyState` y `Skeleton`, pero falta una regla documentada de uso por pantalla.
- No hay patron visible de error parcial por seccion.

### Accesibilidad

- Hay foco visible global.
- Drawers/modales usan manejo basico de dialogo.
- Debe cuidarse que criticidad no dependa solo del color: usar texto, icono y badge.

## Oportunidades prioritarias

1. Convertir Inicio en bandeja de prioridades, no dashboard.
2. Convertir Mi cartera en salud del negocio, con explicacion de resultado.
3. Convertir Comprar en workspace operacional de punta a punta: decisiones, cotizaciones, borrador, aprobaciones, seguimiento y recepciones.
4. Reducir columnas visibles en tablas criticas a maximo 8.
5. Consolidar filtros: busqueda + 2 a 4 filtros visibles + mas filtros.
6. Usar progressive disclosure para detalles de proveedor, margen, lead time y razon.
7. Formalizar el uso de cards: principal, secundario y detalle.
8. Crear mapas de componente para evitar duplicados.

## Componentes a reutilizar

- `DataTable` con `mobileCard`.
- `FilterBar` con filtros avanzados.
- `Drawer` para decisiones y detalle.
- `KpiCard` para metricas con accion.
- `PriorityGuide` para tareas ordenadas.
- `EmptyState` y `Skeleton`.

## Componentes a consolidar

- Priority list / priority card.
- Recommendation drawer.
- Scenario simulator.
- Budget progress.
- Category health row.
- Supplier scorecard row.

## Componentes que deben desaparecer o bajar de nivel

- Cards de KPI sin contexto o accion.
- Columnas de detalle que repiten informacion ya disponible en drawer.
- Bloques de ayuda siempre visibles que no cambian la decision.
- Submodulos secundarios expuestos como navegacion primaria.

## Arquitectura futura propuesta

Cada pantalla debe tener una pregunta principal:

- Inicio: Que debo resolver hoy?
- Mi cartera: Como esta funcionando mi negocio?
- Comprar: Que debo comprar y que debo revisar antes?
- Inventario: Donde tengo riesgo, exceso o capital inmovilizado?
- Rentabilidad: Que productos funcionan bien o mal?
- Catalogo: Que productos conservar, revisar o eliminar?
- Proveedores: Que proveedor necesita atencion?
- Mi plan: Que objetivos tengo y que tan lejos estoy?

Patron por pantalla:

1. Resumen accionable.
2. Excepciones priorizadas.
3. Decision o siguiente accion.
4. Detalle via drawer, tabla compacta o pagina 360.

## Wireframes conceptuales

Inicio:

```text
Header: Hola + fecha + prioridades del dia
PriorityList: maximo 5 items
Pendientes: lista compacta
Excepciones: venta acelerada / venta lenta / quiebre / sobrestock
Resumen: 4 indicadores compactos
```

Comprar:

```text
Header + proceso de compra
Presupuesto
Centro de decision
Resumen de compra: 4 cards
Filtros simples
Tabla compacta
RecommendationDrawer + ScenarioSimulator
```

Borrador OC:

```text
Compra en curso
Proveedor / proveedores
Valor OC + presupuesto + cobertura futura
Advertencias antes de formalizar
Lineas editables por proveedor
Accion: enviar a aprobacion o crear borrador
```

Mi cartera:

```text
Resultado economico
Salud de inventario
Tendencia principal
Salud por categoria
Que explica mi resultado
Productos clave por rol
Marcas, proveedores y oportunidades
Salud de cartera
```

Category workspace:

```text
Resumen economico de categoria
Productos clave
Crecimiento
Productos detenidos
Marcas
Proveedores
Surtido
Reposicion
```
