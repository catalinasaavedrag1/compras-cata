# Especificación técnico-funcional para backend — Plataforma de Compras

> Documento de análisis. **No es implementación.** Su objetivo es permitir, en el
> paso siguiente, diseñar contratos de API y modelo de datos **sin improvisaciones**.
> Extraído del frontend real (React 18 + TS + Vite), hoy alimentado por datos mock.

Fecha ancla de la demo: `TODAY_ISO = 2026-06-24` (el backend debe exponer fecha de servidor real).

## Índice
1. [`01-rutas-y-vistas.md`](01-rutas-y-vistas.md) — todas las rutas, vistas, params, deep-links, guards, tablas, modales, formularios, filtros.
2. [`02-mocks-y-persistencia.md`](02-mocks-y-persistencia.md) — mocks, entidades, colecciones existentes, claves `localStorage`, qué persiste vs qué se deriva.
3. [`03-lecturas-escrituras.md`](03-lecturas-escrituras.md) — operaciones de lectura y escritura por dominio, con su máquina de estados.
4. [`04-endpoints-por-vista.md`](04-endpoints-por-vista.md) — endpoints propuestos por vista (sin implementar).
5. [`05-matriz.md`](05-matriz.md) — matriz frontend → endpoint → servicio → entidad → fuente de datos.
6. [`06-dependencias-servicios.md`](06-dependencias-servicios.md) — dependencias con Catalog, Inventory, Pricing, Supplier, Sales, SAP B1, Identity, Notification (+ servicios nuevos detectados).
7. [`07-bff-composicion.md`](07-bff-composicion.md) — qué endpoints debe componer el Purchase BFF.
8. [`08-clasificacion.md`](08-clasificacion.md) — cada necesidad clasificada: existe / ampliar / crear / integrar / definir.
9. [`09-orden-implementacion.md`](09-orden-implementacion.md) — orden de implementación por flujos verticales end-to-end.
10. [`10-decisiones-pendientes.md`](10-decisiones-pendientes.md) — decisiones de negocio/modelado abiertas, con alternativa razonable propuesta.

> **Paso siguiente — diseño de arquitectura:** [`../arquitectura-backend/README.md`](../arquitectura-backend/README.md)
> toma esta especificación + la verificación real de los microservicios existentes y define la
> arquitectura de `purchase-service` y `purchase-bff-service` (delimitación de dominio, responsabilidades,
> flujos, matriz, entidades, datos externos, eventos, riesgos y propuesta final). Aún sin código.

---

## Resumen ejecutivo

### El punto de partida ya trae una "costura de backend"
El repo **no parte de cero**: incluye un backend de referencia y una capa de servicios diseñada para conectar una API real.

- **`server/index.ts`** — API REST **genérica por colección**: `GET /api/:collection` (con filtro `?campo=valor`), `GET /api/:collection/:id`, `POST`, `PATCH` (merge), `DELETE`, `GET /api/health`. Persistencia en `db.json`.
- **`server/seed.ts`** — siembra **13 colecciones canónicas** con su campo id (`ID_FIELD`):
  `products`(sku) · `suppliers`(id) · `categories`(id) · `purchase-orders`(id) · `recommendations`(id) · `alerts`(id) · `campaign-opportunities`(id) · `signals`(id) · `approvals`(id) · `decisions`(id) · `buyers`(id) · `rules`(id) · `receptions`(id).
- **`src/services/apiClient.ts`** — `apiGet/apiGetOne/apiCreate/apiPatch/apiDelete/apiHealth`, flag `backendEnabled` (según `VITE_API_URL`).
- **`src/context/DataContext.tsx`** — `useCollection(collection, fallbackMock)` hidrata desde API o cae al mock.
- **`src/services/index.ts`** — capa de dominio, pero **hoy solo 8 servicios de lectura** están cableados (`product, supplier, category, purchaseOrder, recommendation, alert, campaignOpportunity, signal`), todos `list/getBy…` con `getMock()`. No hay create/update por servicio.

### Brecha real hoy
- **`useCollection` solo lo usan 3 páginas** (`ProductsPage`→products, `SuppliersPage`→suppliers, `PurchaseAnalysisPage`→products). El resto **importa los mocks directamente**, sin pasar por la costura.
- **La persistencia real son ~30 claves `localStorage` `compras:*`** (borrador OC, OC creadas, aprobaciones, decisiones, reclamos, listas de precio, campañas, RFQ, negociaciones, acuerdos, señales, ajustes de forecast, estado de alertas, bitácora, sesión/rol/comprador, premios…). Cada una es una **entidad transaccional** candidata a endpoint de escritura.
- **Único write a backend hoy**: `apiCreate("purchase-orders", …)` condicional y *fire-and-forget* en `createOrder` (`PurchaseOrdersPage.tsx`).
- **Muchas transiciones de estado son solo runtime o solo mock** (p. ej. una OC solo llega a `draft`/`pending_approval`/`sent` desde la UI; `approved` es derivado no persistido; el resto de estados de OC y **todos** los de recepción solo existen en la semilla).
- **Gran parte de la "inteligencia" es determinista-simulada en el front** (hash del SKU): panel de negociación, evaluación de proveedor (varias dimensiones), rendimiento de campañas, atribución de quiebres, meses sin compra, temporada anterior. En producción requiere servicios reales.

### Modelo de dominio ya tipado
`src/types/purchasing.ts` + `team.ts` definen ~35 entidades y ~50 enums de estado, incluidas las máquinas de estado: `PurchaseOrderStatus`, `ApprovalCriterion`/`ApprovalState`, `ReceptionStatus`, `ClaimStatus`/`ClaimResolution`, `RfqStatus`, `RecommendationStatus`, `CampaignOpportunityStatus`, `ImportStage`, `PurchaseStatus`, `SupplierStatus`, `NegotiationStatus`, `SignalStatus`, `AlertStatus`, `GoalStatus`, etc.

### Servicios objetivo
Además de los 8 solicitados (**Catalog, Inventory, Pricing, Supplier, Sales, SAP B1, Identity, Notification**), el análisis detectó **dominios propios de la plataforma** que no calzan en ninguno de esos y deben modelarse como servicios/módulos:

- **Purchase Core / BFF** — recomendaciones de reposición, borrador de OC, OC, aprobaciones, decisiones, RFQ, plan de retiro, recepciones (registro), reclamos.
- **Purchase Governance** — reglas de compra, matriz de aprobación, bitácora/trazabilidad.
- **Marketing/Comercial (Campañas)** — planes de campaña, presupuesto por canal, inventario de espacios publicitarios, posición de banner, rendimiento (integra Web analytics, Google Ads, Meta/TikTok, mailing, Mercado Libre, POS). **Servicio nuevo, hoy 100% simulado.**
- **Planning (Temporadas)** — temporadas, ventanas de compra/venta, ajuste de forecast, plan por escenario.
- **Team/Performance & Gamification** — compradores, metas/OKR, score, ligas, retos, premios, ranking. Posible módulo separado.
- **DMS (documentos)** — gestión documental, hoy sin backend.
- **Logistics/TMS** — plan de retiro/flota, hoy estimador en front.

### Las 3 decisiones de modelado más urgentes (ver doc 10)
1. **Enlaces por string vs FK reales** entre OC ↔ Aprobación/Decisión (`APR-<n>-<i>`), Recepción→OC (`poNumber`), Reclamo→OC/Recepción. Introducir claves foráneas.
2. **Tres taxonomías de canal** incompatibles: promo (`redes/ml/web/tienda`), demanda (`tienda/ecommerce/marketplace/empresa/licitaciones`), margen (`marketplace/web/store`), más el enum extendido `CampaignChannel`. Reconciliar.
3. **Dos modelos de "campaña"** sin relación (`CampaignPlan` vs `CreatedCampaign`) y **dos costeos "landed"** (`importCost` a nivel orden CLP vs `landedCost` por unidad con logística). Unificar.
