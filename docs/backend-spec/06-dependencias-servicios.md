# 06 · Dependencias con servicios (requisito #9)

Los 8 servicios que el enunciado nombra + los dominios propios detectados en el frontend que **no
calzan** en ninguno de ellos y deben modelarse aparte. Para cada uno: qué le pide el front, qué
entidades lee/escribe, y el estado de la integración hoy.

## Servicios nombrados en el enunciado

### 1. Catalog
- **Provee**: Product (sku maestro), Category (con `buyer`), atributos, roles de producto/categoría,
  surtido, redundancia, NPI/altas.
- **Consumido por**: Products, ProductDetail, Categories, Assortment, CatalogOptimization, NewProducts,
  y como maestro por casi toda escritura de compra.
- **Hoy**: `products`/`categories` como colecciones (products ya cableado). Redundancia/roles/`skuProfile`
  (ABC/XYZ) = hash-sim → **debe ampliarse** con analítica real.

### 2. Inventory
- **Provee**: stock por bodega, en tránsito, rotación, cobertura, distribución por categoría/bodega,
  capacidad de almacén.
- **Consumido por**: Replenishment (cobertura/quiebres), InventoryAnalysis, recepciones (actualiza stock),
  presupuesto.
- **Hoy**: `mockInventory` (KPIs derivados) + `mockWarehouses`. **Requiere integración** con el WMS/ERP real.

### 3. Pricing
- **Provee**: costo maestro, listas de precio, alzas, condiciones, waterfall de costo neto,
  márgenes objetivo por categoría.
- **Consumido por**: PriceIncreases, ProductDetail (negociación/margen), ChannelMargin, Reposición
  (costo sugerido).
- **Hoy**: `price-lists` (localStorage) + waterfall hash-sim. **Debe crearse/integrarse**.

### 4. Supplier
- **Provee**: Supplier (estado active/on_watch/blocked), evaluación multi-dimensión, términos,
  acuerdos, negociaciones, cumplimiento, lead time, estacionalidad.
- **Consumido por**: Suppliers, SupplierDetail (7 tabs), RFQ, Reclamos, Reposición (MOQ/lead time).
- **Hoy**: `suppliers` colección (cableada) + evaluación/estacionalidad hash-sim + términos/acuerdos/
  negociaciones en localStorage. **Ampliar** (evaluación real) + **crear** (términos/acuerdos).

### 5. Sales
- **Provee**: venta por SKU/canal/período, series, señales de terreno, margen por canal, demanda,
  oportunidades perdidas, KPIs de venta.
- **Consumido por**: SalesAnalysis, ChannelMargin, ProductDetail (margen/señales), Reposición
  (venta diaria), LostOpportunities, SeasonsChannels, Decisiones (resultado real).
- **Hoy**: `mockSales`, `mockChannelMargin`, `signals` (colección + localStorage), `channelDemand`
  hash-sim. **Requiere integración** con POS/e-commerce/marketplace.

### 6. SAP B1 (ERP)
- **Provee/recibe**: OC oficiales, recepciones (GRN), facturas, notas de crédito, maestro de
  costo/proveedor, movimientos de stock.
- **Consumido por**: PurchaseOrders (emisión → SAP), Receptions (GRN), Reclamos (nota de crédito),
  PriceIncreases (actualiza costo).
- **Hoy**: solo `apiCreate("purchase-orders")` fire-and-forget. **Integración crítica pendiente**:
  emisión de OC y recepción deben espejar SAP B1.

### 7. Identity
- **Provee**: usuario, sesión, rol (`comprador`/`lider`), comprador activo, permisos.
- **Consumido por**: Login, RoleGate (`/equipo/*`), scoping por `buyer`, todos los guards.
- **Hoy**: `auth/role/buyer` en localStorage, **auth falsa, rol no validado en servidor**. **Crear**
  autenticación real + autorización server-side.

### 8. Notification
- **Provee**: alertas comerciales, notificaciones al usuario, estado leído, enrutamiento a equipo.
- **Consumido por**: Alerts, TeamAlerts, campanita, señales.
- **Hoy**: `alerts` colección + `alert-status`/`notif-read` localStorage. Alertas hoy mock;
  en producción **derivadas por reglas** → depende de Purchase Governance + eventos de dominio.

---

## Dominios propios detectados (no calzan en los 8) → servicios/módulos nuevos

| Servicio nuevo | Responsabilidad | Vistas | Estado hoy |
|---|---|---|---|
| **Purchase Core** | Reposición, borrador OC, OC, decisiones, RFQ, recepción (registro), reclamos | Replenishment, PurchaseOrders, Rfq, Receptions, Claims, Aprendizaje | localStorage / mock — **crear** |
| **Purchase Governance** | Reglas de compra, matriz de aprobación, aprobaciones, bitácora/auditoría | Settings, Governance, Approvals | colección(rules) + `trace`/`approvals` — **ampliar/crear** |
| **Marketing/Comercial** | Planes de campaña, espacios publicitarios, banner, presupuesto por canal, rendimiento (integra Web analytics, Google Ads, Meta/TikTok, mailing, Mercado Libre, POS) | Campaigns, CampaignOpportunities | 100% hash-sim / localStorage — **crear + integrar** |
| **Planning (Temporadas)** | Temporadas, ventanas compra/venta, ajuste forecast, plan por escenario, demanda por canal | SeasonPlanner, SeasonsChannels | mock + hash-sim — **crear** |
| **Logistics/TMS** | Plan de retiro/flota, tarifas, capacidad, torre de control de importaciones | PlanRetiro, Imports | estimador front / mock — **crear + integrar** |
| **DMS (documentos)** | Gestión documental (OC, facturas, certificados, aduana) | Documents, Imports (docs) | mock — **crear** |
| **Team/Performance & Gamification** | Compradores, metas/OKR, score, ligas, retos, premios, ranking, carga | Team/* (todo líder) | colección(buyers) + mock + `rewards` — **crear** |
| **Finance/Budget (OTB)** | Presupuesto abierto para comprar, control mensual | Budget | derivado + `monthlyPurchaseBudget` — **integrar** |

## Grafo de dependencias resumido
- **Purchase Core** es el hub: depende de Catalog (producto), Supplier (proveedor/MOQ), Inventory
  (stock/cobertura), Pricing (costo), y **escribe a SAP B1** (OC/recepción) y **emite eventos** a
  Notification y Governance (bitácora).
- **Purchase Governance** intercepta la emisión de OC (reglas → aprobación) y consume Identity (rol).
- **Marketing** y **Planning** consumen Sales (demanda) y Catalog (producto), y son productores de
  oportunidades hacia Purchase Core.
- **Team** consume eventos de todos los dominios para score/atribución.
