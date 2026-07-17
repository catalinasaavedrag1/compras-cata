# 07 · Qué debe componer el Purchase BFF (requisito #8)

El BFF de Compras existe para **evitar que el front orqueste N llamadas** y para **resolver en
servidor los deep-links y el scoping por rol**. Regla: una vista con datos de ≥2 servicios, o una
tabla que hoy junta mock+localStorage+hash-sim en cliente, es candidata a endpoint compuesto.

## Endpoints compuestos propuestos

### `GET /bff/home?buyer=&scope=` — MyPanel (Inicio + Cartera)
Compone: recomendaciones prioritarias (Purchase Core) + alertas activas (Notification) +
aprobaciones pendientes del rol (Governance) + señales sin atender (Sales) + presupuesto OTB
(Finance) + agenda del día (derivado). **Hoy** la página junta ~6 mocks en cliente.

### `GET /bff/my-performance?buyer=` — MyPerformance
Score + metas/OKR (Team) + decisiones recientes y su resultado (Purchase Core + Sales) + ahorro
negociado (Pricing/Supplier). Atribución (`buyerAttribution`) hoy hash-sim.

### `GET /bff/products/:sku?tab=` — ProductDetail (6 pestañas)
- `resumen`: master Catalog + stock Inventory + venta Sales.
- `negociacion`: waterfall de costo (Pricing) + condiciones/reclamos/quiebres (Supplier) — hoy hash-sim.
- `margen`: margen por canal (Sales) — hoy hash-sim/derivado.
- `senales`: señales de terreno (Sales) — colección+localStorage.
- `relacionados`: sustitutos/complementos (Catalog).
- `actividad`: bitácora del SKU (Governance/audit).

### `GET /bff/suppliers/:id?tab=` — SupplierDetail (7 pestañas)
ficha (Supplier) · evaluación multi-dimensión (Supplier, hash-sim) · temporadas (Planning) ·
productos (Catalog) · órdenes (Purchase Core/SAP) · recepciones (SAP/WMS) · alertas (Notification).
El BFF **une por `supplierId`** órdenes/recepciones/alertas que hoy se filtran en cliente.

### `GET /bff/categories/:id?tab=` — CategoryDetail (9 pestañas)
surtido, rol, proveedores, márgenes, rotación, oportunidades, señales, campañas, actividad —
compone Catalog + Inventory + Sales + Pricing + Marketing.

### `GET /bff/pickup-plan?draft=current` — PlanRetiro
Toma el borrador de OC (Purchase Core) + capacidad/tarifas (Logistics/TMS) y devuelve el plan de
retiro. Hoy es un estimador 100% en front.

### `GET /bff/team/dashboard` — TeamDashboard (líder)
Carga por comprador (Team) + KPIs de cartera agregados (Purchase Core/Sales) + ranking + alertas de
equipo + metas. Guard `lider`.

### `GET /reports/:report?range=` — ReportsPage (8 reportes)
Cada reporte compone agregados de varios servicios; hoy todos derivados en cliente. El BFF debe
devolver el dataset ya agregado y opcionalmente `?format=csv`.

## Qué NO debe ir al BFF
- CRUD directo de una sola entidad (recomendaciones, OC, aprobaciones, reclamos, reglas, premios):
  van directo al servicio dueño. El BFF **compone lecturas**, no reemplaza los `POST/PATCH` de dominio.
- Catálogos maestros simples (products, suppliers, categories) que ya funcionan por `useCollection`.

## Responsabilidades transversales del BFF
1. **Scoping por rol/buyer**: aplicar `scope=mine|all` y `buyer` server-side (hoy en cliente),
   filtrando lo que el rol puede ver.
2. **Resolver deep-links**: aceptar `?oc=`, `?rid=`, `?sku`, `?tab=`, `?cat=`, `?foco=`, `?prov=` y
   precargar la vista con contexto en una sola llamada.
3. **Paginación/orden server-side** para las tablas grandes.
4. **Fan-out + agregación** hacia servicios de dominio, con degradación elegante si un upstream falla.
5. **Emitir bitácora** de las acciones de escritura que orquesta.
