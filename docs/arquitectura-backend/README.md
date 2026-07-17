# Arquitectura Backend — Plataforma de Compras

> **Rol de este documento.** Diseño de arquitectura **previo a la implementación**. No contiene
> código, controladores, DTOs, tablas ni APIs. Su objetivo es dejar la arquitectura completamente
> definida para que el paso siguiente —contratos de API y modelo de dominio— se haga **sin improvisar**.
>
> **Base de trabajo.** Se construye sobre la especificación técnico-funcional del frontend
> (`docs/backend-spec/`) y sobre la **verificación real** de los microservicios existentes en el
> monorepo `Microservicios` (código, no supuestos). No se re-analiza el frontend.
>
> **Restricción de alcance.** Solo se crean **dos** servicios nuevos: `purchase-service` y
> `purchase-bff-service` (ambos ya existen como carpetas vacías en el monorepo). Todo lo demás se
> **reutiliza**. No se proponen microservicios nuevos salvo justificación técnica muy sólida.

---

## 0. Contexto verificado del ecosistema (fuente de verdad)

Antes de delimitar el dominio, se fijó la realidad de los servicios que el enunciado nombra
(`catalog-service-v1`, `customer-service`, `inventory-service-v3`, `oms-service`, `pricing-service`,
`finance-service`) y de los transversales del ecosistema. Esto **cambia** varias suposiciones del
análisis original (que hablaba de "Supplier Service", "Sales", "Notification" genéricos).

| Servicio | Stack real | Qué **posee** (verificado en código) | Qué **NO** posee |
|---|---|---|---|
| **catalog-service-v1** | Express + Prisma + MSSQL + Kafka | Product, Sku, Brand, Category, Attribute; eventos `catalog.sku.*`, `catalog.product.*` | Precio, costo, proveedor, margen |
| **pricing-service** | NestJS + Prisma + MSSQL + Kafka (Outbox) | `BasePrice` (cost, listPrice, **markup**), `PriceSheet` (listas ↔ SAP PriceList), `PriceChange` (histórico), **`PriceAudit` (aprobar/rechazar por umbral)**; eventos `pricing.price.*`, `pricing.price-audit.*` | Proveedor; sin motor de promociones |
| **inventory-service-v3** | NestJS + Prisma + MSSQL + Kafka + SAP B1 | Stock físico por SKU+bodega, `inTransit`, `StockReservation` (física), `StockMovement`, `OrderReceiving`, `Supplying`, `SecurityStock`, `StockDecision`; eventos `inventory.stock.updated`, `inventory.availability.changed` | **Cobertura, rotación, punto de reorden, capacidad** (todo cálculo/analítica) |
| **finance-service** | Express + MSSQL/MySQL + SAP + SOAP/DTE | Facturación de **venta** (DTE), notas de crédito, pagos, *finance waves*; fuerte integración SAP B1 (Service Layer + mappers `toSap*`) | **Presupuesto/OTB, cuentas por pagar** (es lado venta/AR) |
| **oms-service** | Express + MSSQL + Kafka | `Orders`, `PreOrder` (cotizaciones), ciclo de vida y orquestación de fulfillment de **venta** | **Órdenes de compra**; "Seller" = seller de marketplace, **no proveedor** |
| **customer-service** | Express + MSSQL + Kafka + Zod | Cliente → SAP `BusinessPartners`; MasterData (payment terms, price lists, customer groups); crédito | **Proveedores** (ruta `cSupplier` es código muerto); identidad |
| **id-service** | Express + MSSQL + JWT/Bcrypt + Kafka | Identidad, RBAC (usuarios, roles, plataformas, módulos, endpoints); integra con API Gateway | — |
| **trace-service** | NestJS | Auditoría/trazas operacionales de todos los servicios | — |
| **notification-service** / **email-service** | NestJS / Node | Despacho de notificaciones (WebSocket/push) y correo | — |
| **comerce-service** | Express | **Configuración comercial: empresas, tiendas, canales de venta, bodegas/locations** | — |
| **tms-service** | — | Transporte, rutas, capacidad | — |
| **promotion-service** / **marketing-automation-service** | — | Promociones y automatización de marketing | — |
| **document-generator-service** | — | Generación/gestión de documentos | — |
| **sap-outbox-worker** | Node | **Puente SAP→Kafka de compras**: publica `PurchaseOrder.Cancelled` (ObjType=22) desde `Integration.IntegrationOutbox` | — |
| **analysis-service** | — | Analítica de venta/negocio | — |

### Cinco hallazgos que reorientan el diseño

1. **SAP B1 es el sistema de registro de la Orden de Compra** (ObjType 22), y ya existe
   `sap-outbox-worker` que bridgea eventos de OC de SAP a Kafka. → `purchase-service` **no inventa**
   el ciclo SAP: lo **origina/espeja**, y consume los eventos que SAP ya emite.
2. **El proveedor (proveedor / vendor) no tiene dueño en el ecosistema.** No hay `supplier-service`;
   `customer-service` está anclado a `cCustomer`. → Es el **único gran vacío de maestro** que la
   plataforma debe resolver.
3. **"Alzas de precio" ya existe** como `PriceAudit` (aprobar/rechazar por umbral) en `pricing-service`.
   → La pantalla `PriceIncreases` **no** es responsabilidad de compras; el BFF la orquesta contra pricing.
4. **Presupuesto/OTB no es de finance-service** (que es venta/AR). → OTB es un vacío de **planificación
   de compra**; su lugar natural es `purchase-service`.
5. **Cobertura, punto de reorden, rotación, "meses sin compra", velocidad de venta** no los calcula
   ningún servicio: inventory da el **stock crudo**, analysis/oms dan la **venta cruda**. → El **motor
   de decisión de reposición** (la inteligencia) es el corazón nuevo de `purchase-service`.

### Convenciones del ecosistema que `purchase-service` debe adoptar
- **Stack**: NestJS (hexagonal) + Prisma + **SQL Server** + KafkaJS — igual que `pricing`, `inventory-v3`, `oms-v2`.
- **Mensajería**: Kafka con **patrón Outbox transaccional** + tabla de **idempotencia** de eventos procesados (como `dom_outbox_events`/`dom_processed_events` y el Outbox de pricing).
- **Modelo híbrido**: **HTTP síncrono** para decisiones que bloquean (validar, disparar aprobación, emitir) + **Kafka** para continuar/auditar/reintentar (como oms↔dom↔inventory).
- **Auth**: delegada a `id-service` vía API Gateway (headers estilo Janis + permisos `dominio:recurso:accion`).
- **Auditoría**: emitir a `trace-service` (no reinventar bitácora).
- **Notificaciones**: emitir eventos; el despacho es de `notification-service`/`email-service`.

---

## 1. Delimitación del dominio

Criterio de corte: **quién es dueño del dato y de la regla**. Un servicio no ejecuta responsabilidades
de otro (principio explícito del monorepo: *"OMS no toca stock · SAP no toca posiciones · Inventory no
toca facturas"*). Se aplica el mismo rigor a compras.

| Responsabilidad | Servicio responsable | Justificación | Por qué **no** pertenece a otro |
|---|---|---|---|
| Motor de recomendación de reposición (punto de reorden, cobertura, cantidad sugerida, prioridad) | **purchase-service** | Es la decisión de compra; combina stock + venta + MOQ + política. Ningún servicio lo calcula hoy. | Inventory solo tiene stock crudo (sin cobertura/reorden); analysis solo venta. La *decisión* no es de ninguno. |
| Borrador de OC (carrito) y Orden de Compra (registro de plataforma) | **purchase-service** (SAP B1 = system of record) | El ciclo de compra, agrupación por proveedor, costeo y estados viven en compras; SAP es el libro oficial. | oms-service es **venta**; finance es facturación de venta; no modelan OC. |
| Reglas de gobierno de compra + matriz de aprobación + estado de aprobación | **purchase-service** (módulo Governance) | La política de compra (montos, cobertura, proveedor nuevo) y quién aprueba es intrínseca al dominio. | Ningún servicio de gobierno genérico existe; id-service da *identidad/rol*, no política de compra. |
| Decisiones de compra y su resultado (aprendizaje) | **purchase-service** | Cierra el ciclo: proyección al comprar vs resultado real (leído de venta/stock). | El resultado se *lee* de analysis/inventory, pero la *decisión* y su evaluación son de compras. |
| RFQ / cotizaciones y adjudicación → OC | **purchase-service** (módulo Sourcing) | Proceso de abastecimiento propio de compras. | No existe servicio de sourcing; oms cotiza **venta** (PreOrder), no compra. |
| Recepción de mercadería (registro de compra contra OC) | **purchase-service** ⟷ **inventory-service-v3** ⟷ **SAP (GRN)** | Compras registra la recepción contra la OC y concilia diferencias; el efecto de stock y el GRN contable son de inventory/SAP. | Inventory mueve stock pero no conoce la OC de compra ni el reclamo; SAP es GRN contable. |
| Reclamos a proveedor | **purchase-service** | Nace de una recepción/OC con diferencia; es relación proveedor-compra. | La **nota de crédito** resultante es de finance/SAP, pero el reclamo (gestión) es de compras. |
| **Maestro de proveedor** (identidad, RUT, condiciones) | **SAP B1 `BusinessPartners` (cSupplier)** como system of record, expuesto por **purchase-service** (adapter) | SAP ya es dueño de partners; compras es el **único consumidor** de proveedores. | customer-service está anclado a cliente; crear `supplier-service` viola la restricción de 2 servicios. |
| **Relación de compra con el proveedor** (evaluación, términos, acuerdos, negociaciones, cumplimiento) | **purchase-service** (módulo Supplier Relationship) | Es data transaccional de compras sobre el proveedor, no identidad. | No es maestro (SAP) ni cliente (customer-service); es propia del acto de comprar. |
| Presupuesto abierto para comprar (**OTB**) | **purchase-service** (módulo Budget) | Es un límite de **planificación de compra**, acoplado a recomendación y emisión. | finance-service es venta/AR; no tiene presupuesto de compra. |
| Planificación de temporada / ajuste de forecast / demanda por canal | **purchase-service** (módulo Planning) | Determina cuánto y cuándo comprar por temporada; input directo de la recomendación. | Ningún servicio de planning existe; la demanda cruda se **lee** de analysis, el plan es de compras. |
| Señales de venta de terreno (input a la decisión) | **purchase-service** (módulo Signals) + **notification-service** (despacho) | Es colaboración comprador-vendedor que alimenta la compra. | El hilo/entrega es de notification; el contenido de compra es del comprador. |
| Desempeño del equipo de compra, metas/OKR, ranking, gamificación, carga | **purchase-service** (módulo Team/Performance) | Métricas derivadas de eventos de compra; "buyer" es un rol de id-service pero su desempeño de compra es propio. | No calza en id-service (identidad) ni en analytics genérico; crear servicio nuevo viola la restricción. |
| **Producto / SKU / categoría / atributos / surtido base** | **catalog-service-v1** | Ya es el maestro. | Compras **lee**, no duplica el maestro. |
| **Costo, listas de precio, márgenes objetivo, alzas (PriceAudit)** | **pricing-service** | Ya modela costo, listas y el flujo de aprobación de alzas. | Compras **lee** costo; no re-implementa pricing ni el flujo de alza. |
| **Stock, en tránsito, reservas físicas, movimientos, recepción física** | **inventory-service-v3** | Es dueño del stock físico. | Compras **lee** stock y **notifica** recepción; no toca posiciones. |
| **Venta por SKU/canal, series, margen realizado, oportunidades perdidas** | **analysis-service** (+ **oms-service** a nivel orden) | Analítica de venta ya es su dominio. | Compras **consume** velocidad/venta; no es sistema de venta. |
| **Identidad, sesión, rol (comprador/líder), permisos** | **id-service** | RBAC centralizado ya existe. | Compras **no** autentica; solo aplica el scope que id-service resuelve. |
| **Canales de venta / tiendas / bodegas (maestro)** | **comerce-service** | Ya es dueño de la configuración comercial. | Reconciliar las taxonomías de canal contra este maestro, no crear otro. |
| **Notificaciones / alertas (entrega)** | **notification-service** / **email-service** | Ya despachan. | Compras **emite** el evento; no entrega. |
| **Auditoría / bitácora** | **trace-service** | Ya almacena trazas de todos. | Compras **emite** la traza; no persiste su propia bitácora paralela. |
| **Emisión oficial de OC, GRN, factura, nota de crédito, maestro de costo/proveedor** | **SAP B1** (vía `sap-outbox-worker` y adapters) | Sistema de registro contable/oficial. | Compras origina/espeja; no reemplaza a SAP. |
| **Plan de retiro / flota / tarifas** | **tms-service** | Ya es transporte. | Compras/BFF **consulta**; no calcula rutas. |
| **Rendimiento de campañas (ROAS, CTR), ejecución** | **promotion-service** / **marketing-automation-service** / **analysis-service** | Ya es marketing. | Compras solo detecta la **oportunidad** (Planning); no ejecuta ni mide ads. |
| **Documentos (OC, factura, aduana, certificados)** | **document-generator-service** + object storage | Ya genera/gestiona documentos. | Compras **referencia** el documento; no es un DMS. |

**Regla de oro para compras:** *purchase-service es dueño de la **decisión de compra** y del **ciclo de
la OC**; lee todo lo demás (producto, costo, stock, venta, identidad) y espeja lo oficial (SAP).*

---

## 2. Responsabilidades del Purchase Service

`purchase-service` es un **monolito modular** (un bounded context "Compras" con módulos internos de
límites claros), no una constelación de microservicios. Esta elección respeta la restricción de dos
servicios y la meta de simplicidad; los módulos están diseñados para poder **extraerse** más adelante
si la escala lo exige (ver §9).

**Módulos internos:** Replenishment · Purchasing (Draft+PO) · Governance (rules+approvals) · Decisions
· Sourcing (RFQ) · Receiving · Claims · Supplier Relationship · Budget/OTB · Planning · Signals ·
Team/Performance.

### 2.1 Reglas de negocio (qué decide)
- **Reposición**: punto de reorden, cobertura en días (`stock / venta_diaria`), cantidad sugerida
  `= max(0, cobertura_objetivo · venta_diaria − stock − en_tránsito)`, prioridad
  (quiebre inminente > bajo stock > oportunidad). Respeta **MOQ, múltiplo/pack** del proveedor y
  excluye descontinuados.
- **Costeo de OC**: subtotal por línea, neto por proveedor, costeo *landed* **por unidad** (unificado;
  el total de orden se deriva — resuelve la duplicidad `importCost` vs `landedCost` del análisis).
- **Disparo de aprobación** (política parametrizable, no constantes): `neto_grupo ≥ monto_umbral`
  (default $10M) ⇒ `monto_alto`; cobertura resultante `> umbral_cobertura` (default 90 d) ⇒
  `cobertura_excesiva`; proveedor nuevo/sin acuerdo vigente ⇒ `proveedor_nuevo`; producto fuera de
  surtido ⇒ `fuera_surtido`.
- **OTB**: valida disponibilidad de presupuesto por scope (categoría/comprador/mes) antes de emitir.
- **Evaluación de proveedor, atribución de quiebres, perfil ABC/XYZ, forecast**: **contratos de
  cálculo a definir con negocio** (hoy simulados en front); el servicio fija el *shape* de salida, no
  asume la fórmula (ver `docs/backend-spec/10`, decisión #7).

### 2.2 Persistencia
- **Base propia**: SQL Server (esquema `purchase`), vía Prisma. **No comparte base** con otros servicios.
- Persiste **solo lo que posee**: recomendaciones y sus overrides, borradores, OC (registro de
  plataforma + referencia al `DocEntry` de SAP), aprobaciones, decisiones, RFQ, recepciones (registro
  y diferencias), reclamos, relación con proveedor (evaluación/términos/acuerdos/negociaciones),
  presupuesto/OTB, temporadas/forecast, señales, y datos de desempeño de equipo.
- **No persiste** copias de maestros externos: guarda **referencias** (`sku`, `supplierId`,
  `categoryId`, `channelId`) y, a lo sumo, **snapshots inmutables mínimos** dentro de documentos
  transaccionales (p. ej. costo y descripción **al momento de emitir la OC**, por trazabilidad legal),
  nunca como maestro consultable.

### 2.3 Estados (máquinas que posee)
- `PurchaseOrderStatus`: `draft → pending_approval → approved → sent → confirmed → (partially_received | received) → closed | cancelled | rejected`.
- `ApprovalState`: `pending → approved | rejected | observed(→ pending)`.
- `RecommendationStatus`: `pending → in_cart → ordered | ignored | snoozed`.
- `RfqStatus`: `draft → sent → (partially_)responded → awarded | cancelled | expired`.
- `ReceptionStatus`: `expected → in_transit → arrived → checking → completed | discrepancy | rejected`.
- `ClaimStatus`: `open → in_review → resolved | rejected` (+ `ClaimResolution`).
- `NegotiationStatus`, `SupplierStatus`, `SignalStatus`, `GoalStatus`, `CampaignOpportunityStatus`,
  `ImportStage` (torre de control) — todas dueñas del ciclo de vida procedente del front.

### 2.4 Eventos (emite; modelo conceptual en §8)
Todo cambio de estado relevante emite un evento de dominio **vía Outbox transaccional**. Ej.:
`purchase.recommendation.overridden`, `purchase.order.issued`, `purchase.approval.approved`,
`purchase.reception.completed`, `purchase.claim.resolved`, `purchase.otb.consumed`.

### 2.5 Validaciones
Proveedor activo; producto activo y en surtido; MOQ/múltiplo/pack; OTB disponible; unicidad de OC;
integridad referencial **real** (FK internas OC↔aprobación↔decisión, recepción→OC, reclamo→OC+recepción
— resuelve la decisión #1 de "string vs FK"); autorización server-side (comprador solo su cartera,
aprobar solo líder).

### 2.6 Auditoría
Toda escritura relevante **emite una traza a `trace-service`** (autor, acción, entidad, antes/después,
timestamp). La plataforma **no** mantiene una bitácora propia paralela (el `compras:trace` del front se
reemplaza por trace-service). El override de recomendación se persiste **auditable** (autor, motivo,
timestamp) para alimentar aprendizaje/atribución (resuelve decisión #5).

### 2.7 Integraciones (consume / espeja)
- **Lee** (HTTP síncrono, cacheable): catalog, pricing, inventory, analysis/oms, comerce (canales),
  id-service (scope), SAP BP (proveedor).
- **Reacciona** (Kafka): `inventory.stock.updated`/`availability.changed` (recomputar cobertura),
  `pricing.price.updated`/`price-audit.approved` (recostear), `sap PurchaseOrder.*` (estado de OC),
  `catalog.sku.updated` (invalidar surtido).
- **Espeja a SAP B1**: emisión de OC y recepción (GRN) — origina el documento y publica evento;
  concilia el estado que SAP devuelve por outbox.

### 2.8 Qué **NO** debe hacer `purchase-service` (fronteras explícitas)
- **No** es maestro de producto, costo, stock ni cliente — no duplica catalog/pricing/inventory/customer.
- **No** calcula el flujo de **alzas de precio** (es `PriceAudit` de pricing) — solo lo consulta.
- **No** mueve stock físico ni crea posiciones (es inventory) — solo **notifica** la recepción.
- **No** emite factura ni nota de crédito (es finance/SAP) — solo dispara el evento/solicitud.
- **No** autentica ni administra usuarios/roles (es id-service) — solo aplica el scope.
- **No** entrega notificaciones/correo (es notification/email) — solo emite el evento.
- **No** persiste su propia bitácora (es trace-service).
- **No** ejecuta ni mide campañas (es promotion/marketing/analysis) — solo detecta la **oportunidad**.
- **No** calcula rutas/flota (es tms-service).
- **No** orquesta N servicios para una vista: eso es del **BFF** (§3). El purchase-service expone
  **APIs de dominio** (una entidad, una responsabilidad), no respuestas compuestas de pantalla.
- **No** contiene lógica de presentación (formato de tabla, CSV, deep-links) — eso es del front/BFF.

---

## 3. Responsabilidades del Purchase BFF

`purchase-bff-service` existe para **evitar que el frontend orqueste N llamadas** y para **resolver en
servidor** el scoping por rol y los deep-links. Es una **capa de composición y adaptación a la vista**,
sin dueño de datos propio y **sin base de datos**.

### 3.1 Vistas que alimenta (composición ≥2 servicios)
Home/Mi Cartera, Mi Desempeño, Detalle de Producto (6 tabs), Detalle de Proveedor (7 tabs), Detalle de
Categoría (9 tabs), Plan de Retiro, Panel de Equipo (líder), Reportes (8), y toda tabla que hoy junta
mock+localStorage+hash-sim en cliente.

### 3.2 Endpoints que expone al frontend (compuestos, `[BFF]`)
`GET /bff/home` · `GET /bff/my-performance` · `GET /bff/products/:sku?tab=` ·
`GET /bff/suppliers/:id?tab=` · `GET /bff/categories/:id?tab=` · `GET /bff/pickup-plan` ·
`GET /bff/team/dashboard` · `GET /reports/:report?range=&format=`.
(Notación orientativa; el detalle está en `docs/backend-spec/04` y `07`.)

### 3.3 Servicios que consulta
purchase-service (dominio de compra), catalog, pricing, inventory, analysis/oms, supplier (vía
purchase-service), comerce (canales), tms (plan de retiro), notification (alertas), id-service (scope),
promotion/marketing (rendimiento de campaña, solo lectura de composición).

### 3.4 Respuestas que compone (ejemplos)
- **Home**: recomendaciones prioritarias (purchase) + alertas activas (notification) + aprobaciones
  pendientes del rol (purchase/governance) + señales sin atender (purchase) + OTB (purchase) + agenda.
- **ProductDetail**: master (catalog) + stock (inventory) + venta/margen (analysis) + waterfall de
  costo (pricing) + señales/actividad (purchase/trace).
- **SupplierDetail**: identidad (SAP BP vía purchase) + evaluación/términos/acuerdos (purchase) +
  órdenes/recepciones (purchase) + productos (catalog) + alertas (notification).

### 3.5 Llamadas que pueden ejecutarse en paralelo
Toda composición de **lecturas independientes** hace *fan-out* concurrente con **agregación** y
**degradación elegante** si un upstream falla (devolver la vista parcial marcando la sección caída).
Ej. Home: recomendaciones ∥ alertas ∥ aprobaciones ∥ señales ∥ OTB. ProductDetail: catalog ∥ inventory
∥ analysis ∥ pricing. Las lecturas **dependientes** (primero resolver `supplierId`, luego sus órdenes)
se encadenan; el resto en paralelo.

### 3.6 Qué puede cachearse (y por cuánto)
- **Maestros de baja volatilidad** (catálogo, categorías, canales, atributos): caché corta (minutos),
  con invalidación por evento (`catalog.*`, `commerce.*`).
- **Agregados de reportes/analítica** de venta histórica: caché por rango (TTL de minutos a horas).
- **Datos de referencia de proveedor** (identidad, condiciones): caché corta.

### 3.7 Qué **nunca** debe cachearse
- **Saldos operativos en tiempo de decisión**: stock disponible, `inTransit`, cobertura, OTB restante,
  costo vigente al costear una OC — deben leerse frescos (un dato viejo genera compras erróneas).
- **Estado de OC/aprobación/recepción/reclamo** y cualquier cosa que el usuario **acaba de escribir**
  (leer-tras-escritura consistente).
- **Scope/permisos** del usuario (siempre desde id-service).

### 3.8 Qué lógica **nunca** debe vivir en el BFF
- Reglas de negocio o cálculo de dominio (reorden, disparo de aprobación, costeo, OTB): son de
  purchase-service. El BFF **no decide**, **compone**.
- Persistencia de estado o "memoria" transaccional (el BFF es **sin estado**).
- CRUD directo de una entidad: los `POST/PATCH/DELETE` van **directo al servicio dueño**; el BFF
  compone **lecturas** y, a lo sumo, orquesta una escritura llamando al dominio (sin implementar la regla).
- Autorización de fondo (quién puede aprobar): el BFF **aplica** el scope, la **autoridad** es
  id-service + purchase-service.

---

## 4. Flujo completo de arquitectura (por pantalla)

Formato: **Frontend → Purchase BFF → Servicios → Respuesta → Persistencia/Evento**.

### 4.1 Inicio / Mi Cartera (`/`, `/mi-cartera`)
```
Frontend  GET /bff/home?buyer&scope
   ↓
Purchase BFF  resuelve scope con id-service; fan-out en paralelo:
   ├─ purchase-service   GET /recommendations (prioritarias, filtradas por cartera)
   ├─ purchase-service   GET /approvals?estado=pendiente (según rol)
   ├─ purchase-service   GET /budget/otb (restante del mes)
   ├─ purchase-service   GET /signals?estado=nuevo
   └─ notification-service GET alertas activas
   ↓
Respuesta  bandeja del día + agenda + KPIs (compuesto, con degradación por sección)
   ↓
Persistencia  ninguna (solo lectura). Sin caché de saldos (OTB/alertas frescos).
```

### 4.2 Reposición → Borrador → Aprobación → Emisión (vertical estrella) (`/comprar/*`)
```
Frontend  GET /recommendations?foco&cat&prov&estado  (directo o vía BFF)
   ↓
purchase-service  motor de reposición:
   lee  inventory (stock, inTransit, securityStock) ∥ analysis (venta diaria) ∥ pricing (costo) ∥ catalog (surtido/MOQ)
   calcula  cobertura, cantidad sugerida, prioridad
   ↓ Respuesta  lista de recomendaciones
Frontend  ajusta/ignora → PATCH /recommendations/:id     → Persistencia: override auditable + evento recommendation.overridden
Frontend  "agregar al borrador" → POST /purchase-drafts/current/lines → Persistencia: borrador
Frontend  emitir OC → POST /purchase-orders
   ↓
purchase-service  valida (proveedor/producto/MOQ/OTB) → aplica Governance:
   ¿dispara criterio? → crea Approval (pending), OC queda pending_approval  [evento approval.requested]
   ↓ (líder) PATCH /approvals/:id (approve) → OC approved  [evento approval.approved]
   emisión → espeja a SAP B1 (origina OC, ObjType 22) + evento purchase.order.issued
   ↓
Persistencia  OC + líneas + snapshot de costo; enlace FK OC↔Approval; Outbox → Kafka; traza a trace-service
   ↓
Consecuencias asíncronas  notification (avisa proveedor/aprobador) · finance/SAP (documento) · budget (OTB consumido)
```

### 4.3 Recepción → Diferencias → Reclamo (`/recepciones`, `/reclamos`)
```
Frontend  POST /receptions (contra OC)  ·  PATCH /receptions/:id (checking/diferencias/completar)
   ↓
purchase-service  registra recepción contra OC (FK real poNumber→OC); calcula recibido vs pedido y % cumplimiento
   ↓ al completar:  evento purchase.reception.completed
   ↓
inventory-service-v3  (reacciona por Kafka) actualiza stock físico / OrderReceiving
SAP B1  GRN contable (espejo)
   ↓ si hay diferencia → Frontend POST /claims → purchase-service (Claim, FK OC+recepción)
   ↓ al resolver con nota de crédito → evento → finance-service/SAP emite NC
   ↓
Persistencia  recepción + items + diferencias + reclamo; eventos + trazas. Actualiza estado de OC (partially_received/received/closed).
```

### 4.4 Detalle de Producto (SKU 360) (`/productos/:sku`)
```
Frontend  GET /bff/products/:sku?tab=
   ↓
Purchase BFF  fan-out en paralelo por tab:
   ├─ catalog-service    master, relacionados, surtido
   ├─ inventory-v3       stock, inTransit, cobertura (cruda) 
   ├─ analysis/oms       venta, margen por canal, señales
   ├─ pricing-service    waterfall de costo neto, condiciones
   └─ purchase-service   negociación/actividad/recomendación del SKU
   ↓
Respuesta  vista de 6 pestañas compuesta
   ↓
Persistencia  ninguna. Caché: master/relacionados (corta, invalidada por catalog.sku.updated); stock/costo NO cacheados.
```

### 4.5 Detalle de Proveedor (`/proveedores/:id`)
```
Frontend  GET /bff/suppliers/:id?tab=
   ↓
Purchase BFF
   ├─ purchase-service (adapter SAP BP)  identidad del proveedor (RUT, condiciones)
   ├─ purchase-service                    evaluación · términos · acuerdos · negociaciones · órdenes · recepciones
   ├─ catalog-service                     productos del proveedor
   └─ notification-service                alertas del proveedor
   ↓  BFF une por supplierId lo que hoy se filtra en cliente
Frontend  registrar ronda/términos/acuerdo → POST/PUT directo a purchase-service (no vía BFF)
   ↓
Persistencia  relación de compra en purchase-service; identidad permanece en SAP (no se duplica).
```

### 4.6 Plan de Retiro (`/comprar/plan-retiro`)
```
Frontend  GET /bff/pickup-plan?draft=current
   ↓
Purchase BFF  toma el borrador de OC (purchase-service) + capacidad/tarifas (tms-service) → arma el plan
   ↓ Respuesta  plan de retiro/flota (hoy estimador en front, ahora real)
   ↓ Persistencia  ninguna en BFF; si se confirma, la reserva de transporte la persiste tms-service.
```

### 4.7 Alzas de precio (`/alzas-precio`) — **no es de compras**
```
Frontend  GET /price-lists?estado  ·  POST /price-lists (cargar)  ·  PATCH /price-increases/:id (aprobar/rechazar)
   ↓ (directo o vía BFF)
pricing-service  PriceSheet + PriceChange + PriceAudit (aprobar/rechazar por umbral)
   ↓ evento pricing.price-audit.approved → purchase-service reacciona (recostea recomendaciones/OC en borrador)
   ↓ Persistencia  en pricing-service (no en compras).
```

---

## 5. Matriz de responsabilidades

`Persistencia`: dónde vive el dato dueño. `SoR` = System of Record.

| Funcionalidad (vista/acción) | Servicio responsable | Persistencia | Observaciones |
|---|---|---|---|
| Recomendaciones de reposición (listar/priorizar) | purchase-service | purchase (derivado + overrides) | Motor nuevo; lee inventory+analysis+pricing+catalog |
| Ajustar/ignorar/posponer recomendación | purchase-service | purchase | Override **auditable** (autor/motivo) |
| Borrador de OC (carrito) | purchase-service | purchase | Agrupa por proveedor; costeo landed unitario |
| Emitir OC | purchase-service → SAP B1 | purchase + **SAP (SoR)** | Espeja SAP; `sap-outbox-worker` bridgea estados |
| Cambiar estado de OC | purchase-service | purchase (↔ SAP) | Máquina completa (hoy front solo llega a `sent`) |
| Reglas de compra / matriz de aprobación | purchase-service (Governance) | purchase (config parametrizable) | Umbrales como configuración por scope, no constantes |
| Aprobar/rechazar/observar | purchase-service | purchase | **Solo líder**, server-side; FK a OC |
| Decisiones y su resultado (aprendizaje) | purchase-service | purchase | Resultado real leído de analysis/inventory a N días |
| RFQ / cotización / adjudicación | purchase-service (Sourcing) | purchase | Adjudicar genera OC |
| Recepción (registro/diferencias) | purchase-service | purchase | Efecto de stock → inventory; GRN → SAP |
| Reclamos a proveedor | purchase-service | purchase | Nota de crédito → finance/SAP |
| Maestro de proveedor (identidad) | **SAP B1 BusinessPartner** (adapter en purchase) | **SAP (SoR)** | Vacío del ecosistema resuelto vía SAP, sin servicio nuevo |
| Evaluación/términos/acuerdos/negociación | purchase-service (Supplier Rel.) | purchase | Data de compra, no maestro |
| Presupuesto / OTB | purchase-service (Budget) | purchase | Actuales leídos de finance/SAP |
| Temporadas / forecast / demanda por canal | purchase-service (Planning) | purchase | Demanda cruda leída de analysis |
| Señales de venta de terreno | purchase-service (Signals) | purchase | Entrega/hilo vía notification |
| Alertas comerciales (estado ack/resolve) | notification-service | notification | **Generadas** por reglas de purchase-service |
| Equipo/metas/ranking/gamificación | purchase-service (Team) | purchase | "buyer" es rol de id-service; desempeño es de compras |
| Producto/SKU/categoría/atributos/surtido | catalog-service-v1 | catalog | Compras **lee** |
| Costo/listas/márgenes objetivo/**alzas** | pricing-service | pricing | `PriceAudit` = flujo de alza |
| Stock/en tránsito/reserva/movimiento/recepción física | inventory-service-v3 | inventory | Compras **lee** y **notifica** recepción |
| Venta por canal/período/margen realizado/oport. perdidas | analysis-service (+oms) | analysis/oms | Compras **consume** velocidad/venta |
| Identidad/sesión/rol/permisos | id-service | id | Auth server-side; scope `mine/all` |
| Canales/tiendas/bodegas (maestro) | comerce-service | comerce | Reconciliar taxonomías de canal aquí |
| Notificaciones/correo (entrega) | notification/email | notification | Compras **emite** evento |
| Auditoría/bitácora | trace-service | trace | Compras **emite** traza |
| Plan de retiro/flota/tarifas | tms-service | tms | BFF compone |
| Rendimiento/ejecución de campañas | promotion/marketing/analysis | esos servicios | Compras detecta la **oportunidad** (Planning) |
| Documentos (OC/factura/aduana) | document-generator-service | DMS/storage | Compras **referencia** |
| Emisión oficial OC/GRN/factura/NC/costo/proveedor | SAP B1 | **SAP (SoR)** | Compras origina/espeja |
| Composición Home/ProductDetail/SupplierDetail/Reportes | purchase-bff-service | **ninguna** | Sin estado; solo compone |
| Fecha de servidor | (habilitador transversal) | — | Reemplaza `TODAY_ISO` del front |

---

## 6. Entidades del dominio Purchase

Entidades **de negocio** (no tablas). Para cada una: propósito · ciclo de vida · relación · propietario
del dato.

| Entidad | Propósito | Ciclo de vida | Relación | Propietario |
|---|---|---|---|---|
| **PurchaseRecommendation** | Sugerencia de compra por SKU (qué/cuánto/por qué) | pending → in_cart → ordered \| ignored \| snoozed | referencia SKU/proveedor; se convierte en línea de borrador | purchase-service (derivada; inputs de inventory/analysis/pricing) |
| **PurchaseOrderDraft** | Carrito de compra agrupado por proveedor | efímero-persistente: se edita hasta emitir | contiene DraftLines; origen de PurchaseOrder | purchase-service |
| **PurchaseOrder** | Orden de compra (registro de plataforma) | draft → pending_approval → approved → sent → confirmed → (partially_)received → closed \| cancelled \| rejected | 1..N POLines; ↔ Approval; ← RFQ; → Reception; espejo de SAP DocEntry | purchase-service + **SAP (SoR)** |
| **PurchaseOrderLine** | Línea de OC (SKU, cantidad, costo, landed) | vive con la OC | referencia SKU; recibida por ReceptionItem | purchase-service |
| **Approval** | Solicitud/decisión de aprobación de una OC | pending → approved \| rejected \| observed(→pending) | FK a PurchaseOrder; N criterios; → Decision | purchase-service |
| **ApprovalCriterion** | Motivo del disparo (monto_alto, cobertura_excesiva…) | inmutable dentro de la aprobación | pertenece a Approval | purchase-service |
| **Decision** | Registro de la decisión y su resultado (aprendizaje) | recorded → evaluated (a N días) | FK a Approval/OC; lee resultado de analysis | purchase-service |
| **Rfq** | Cotización a proveedores | draft → sent → (partially_)responded → awarded \| cancelled \| expired | N RfqResponses; adjudicación → PurchaseOrder | purchase-service |
| **RfqResponse** | Oferta de un proveedor a una RFQ | recibida/comparada | pertenece a Rfq; referencia proveedor | purchase-service |
| **Reception** | Recepción de mercadería contra una OC | expected → in_transit → arrived → checking → completed \| discrepancy \| rejected | FK a PurchaseOrder; N ReceptionItems; → Claim | purchase-service (stock → inventory; GRN → SAP) |
| **ReceptionItem** | Detalle recibido vs pedido por línea | vive con la recepción | referencia POLine | purchase-service |
| **SupplierClaim** | Reclamo por diferencia/calidad | open → in_review → resolved \| rejected (+ resolution) | FK a OC + Reception; NC → finance/SAP | purchase-service |
| **SupplierRelationship** | Vista de compra del proveedor (evaluación, cumplimiento, lead time) | active \| on_watch \| blocked | referencia SAP BP; agrega órdenes/recepciones | purchase-service |
| **SupplierTerms / SupplierAgreement** | Condiciones y acuerdos comerciales | vigente → vencido/renovado | pertenece al proveedor | purchase-service |
| **NegotiationRound** | Ronda de negociación registrada | open → in_progress → agreed \| stalled | pertenece al proveedor | purchase-service |
| **Budget / OtbBucket** | Presupuesto abierto para comprar por scope/mes | abierto → consumido/cerrado | referencia categoría/comprador; consumido por OC | purchase-service (actuals de finance/SAP) |
| **Season / ForecastAdjustment** | Plan de temporada y ajuste de demanda | planificada → activa → cerrada | referencia SKU/categoría/canal; alimenta recomendación | purchase-service (demanda de analysis) |
| **CampaignOpportunity** | Oportunidad de compra/comercial detectada | detected → planned → active → closed \| dismissed | referencia SKU/categoría; ejecución en marketing | purchase-service (Planning); ejecución/medición externa |
| **SalesSignal** | Señal de terreno que informa la compra | new → in_review → actioned \| dismissed | hilo de mensajes; entrega vía notification | purchase-service |
| **ImportOrder** | Torre de control de importación | po → production → shipping → customs → warehouse | referencia OC; docs en DMS | purchase-service (docs → document-generator) |
| **PurchaseRule / ApprovalMatrix** | Política de compra parametrizable | versionada/auditada | aplica a Governance | purchase-service |
| **Buyer / Goal / Reward / Score** | Desempeño y gamificación del equipo | on_track/at_risk/off_track/achieved; CRUD de premios | "buyer" ↔ id-service; métricas de eventos de compra | purchase-service (identidad en id-service) |
| **ProcurementAudit (traza)** | Rastro de acción de compra | append-only | referencia cualquier entidad | **trace-service** (purchase solo emite) |

**Datos NO propios que aparecen en la vista pero pertenecen a otros** (se referencian, no se modelan
como maestro): Product/Sku (catalog), Cost/PriceList (pricing), Stock/InTransit (inventory),
SalesVelocity/Margin (analysis), Channel (comerce), User/Role (id-service), SupplierIdentity (SAP BP).

---

## 7. Datos externos (qué se consulta y qué NUNCA se duplica)

| Fuente | Qué se consulta **siempre** desde ahí | Qué **NO** debe duplicarse en purchase | Cómo |
|---|---|---|---|
| **catalog-service-v1** | Product/Sku, categoría, marca, atributos, surtido, relacionados, MOQ/pack si vive en catálogo | El **maestro de producto** completo | HTTP (cacheable corto) + reacción a `catalog.sku.updated` |
| **pricing-service** | Costo vigente, listas de precio, markup/margen objetivo, waterfall, estado de **alza (PriceAudit)** | Costo maestro y el **flujo de alzas** | HTTP fresco al costear; reacción a `pricing.price.updated`/`price-audit.approved` |
| **inventory-service-v3** | Stock por bodega, `inTransit`, `securityStock`, reservas, recepción física | Stock físico y posiciones (**nunca** copiarlo como saldo consultable) | HTTP fresco en decisión; reacción a `inventory.stock.updated`/`availability.changed` |
| **Supplier = SAP B1 BusinessPartner** | Identidad del proveedor (RUT, nombre, condiciones de pago, price list) | Identidad/maestro de proveedor | Adapter (patrón `customer-service/sapB1`, con `CardType: cSupplier`) |
| **id-service** | Usuario, sesión, rol (comprador/líder), permisos, scope | Usuarios/roles/credenciales | API Gateway (headers + permisos); **nunca** cachear permisos |
| **notification-service / email** | (no se consulta; se **emite** evento) | Cola/entrega de notificaciones | Kafka/evento de dominio |
| **analysis-service (+ oms-service)** | Venta por SKU/canal/período, velocidad diaria, margen realizado, oportunidades perdidas, "meses sin compra" | Historia de venta / analítica | HTTP (agregados cacheables por rango) |
| **SAP B1** | OC oficial (DocEntry/estado), GRN, factura, NC, maestro de costo/proveedor | El **libro contable/oficial** | Origina/espeja + `sap-outbox-worker` (Kafka) |
| **comerce-service** | Canales de venta, tiendas, bodegas (maestro) | Maestro de canales | HTTP; **reconciliar** las 3 taxonomías de canal contra este maestro |
| **tms-service** | Capacidad, tarifas, rutas (plan de retiro) | Cálculo de transporte | HTTP vía BFF |
| **promotion / marketing / analysis** | Rendimiento de campaña (ROAS/CTR), ejecución | Métricas/ejecución de ads | HTTP vía BFF (solo lectura de composición) |
| **document-generator-service** | Documentos generados (OC/factura/aduana) | Los binarios/DMS | Referencia por id + storage |

**Principio anti-duplicación:** purchase-service guarda **referencias** (ids) y **snapshots inmutables
mínimos** dentro de documentos transaccionales por trazabilidad legal (p. ej. costo y descripción **al
momento de emitir la OC**), pero **jamás** un maestro consultable de producto, costo, stock, canal,
usuario o proveedor. La "verdad viva" siempre se lee de su dueño.

---

## 8. Eventos de negocio (modelo conceptual)

Solo el **modelo conceptual** (sin Kafka aún). Todos se emiten con **Outbox transaccional** e
idempotencia, y toda emisión relevante produce además una **traza** en trace-service. Nomenclatura
`purchase.<agregado>.<hecho>` para alinear con `pricing.*`, `inventory.*`, `catalog.*`, `oms.*`.

**Reposición y decisión**
- `purchase.recommendation.overridden` · `purchase.recommendation.ignored` · `purchase.recommendation.added_to_draft`
- `purchase.decision.recorded` · `purchase.decision.evaluated`

**Orden de compra**
- `purchase.order.drafted` · `purchase.order.submitted_for_approval` · `purchase.order.issued`
- `purchase.order.status_changed` · `purchase.order.sent_to_supplier` · `purchase.order.cancelled`

**Gobierno / aprobación**
- `purchase.approval.requested` · `purchase.approval.approved` · `purchase.approval.rejected` · `purchase.approval.observed`
- `purchase.rule.updated`

**Abastecimiento (RFQ)**
- `purchase.rfq.sent` · `purchase.rfq.response_received` · `purchase.rfq.awarded`

**Recepción y reclamo**
- `purchase.reception.arrived` · `purchase.reception.checked` · `purchase.reception.discrepancy_flagged` · `purchase.reception.completed`
- `purchase.claim.opened` · `purchase.claim.resolved`

**Proveedor**
- `purchase.supplier.negotiation_round_logged` · `purchase.supplier.terms_updated` · `purchase.supplier.agreement_signed`

**Presupuesto / planificación**
- `purchase.otb.consumed` · `purchase.otb.exceeded` · `purchase.forecast.adjusted` · `purchase.season.plan_updated`
- `purchase.opportunity.detected`

**Señales / equipo**
- `purchase.signal.reported` · `purchase.signal.status_changed`
- `purchase.reward.created|updated|deleted` · `purchase.goal.status_changed`

**Eventos que purchase-service CONSUME (reacciona)**
- `inventory.stock.updated` / `inventory.availability.changed` → recomputar cobertura/prioridad.
- `pricing.price.updated` / `pricing.price-audit.approved` → recostear borrador/recomendación.
- `catalog.sku.updated` → invalidar surtido/relacionados.
- `PurchaseOrder.*` (SAP vía `sap-outbox-worker`) → conciliar estado de OC.
- `oms.order.*` / venta → alimentar velocidad y resultado de decisión.

**Alertas comerciales** (quiebre, sobre-stock, margen bajo, desvío de campaña) se **derivan por reglas**
en purchase-service y se emiten como eventos que `notification-service` transforma en alertas; el
**estado** de la alerta (ack/resolve) lo posee notification.

---

## 9. Riesgos de arquitectura y mejoras

### 9.1 Duplicidad de responsabilidades (riesgo alto)
- **Costo/precio y "alzas"**: tentación de recalcular costo o modelar alzas en compras. **Mitigación**:
  pricing-service es dueño; compras solo consume `bestPrice` y reacciona a `price-audit.approved`.
- **Stock**: tentación de guardar saldos en compras para "ir más rápido". **Mitigación**: prohibido;
  leer fresco de inventory en el momento de decidir; cachear solo maestros, nunca saldos.
- **Proveedor**: riesgo de crear un mini-maestro de proveedor en compras. **Mitigación**: identidad en
  SAP BP; compras solo la **relación** de compra.

### 9.2 Servicios innecesarios (riesgo de sobre-fragmentación)
- El análisis original insinuaba 6-8 dominios "propios" (Marketing, Planning, Logistics, DMS, Team,
  Governance…). Convertirlos en microservicios **violaría** la restricción y añadiría 8 despliegues,
  8 bases y N contratos para un equipo/tráfico modesto. **Mitigación**: **monolito modular**
  purchase-service con módulos de límites claros; reutilizar tms/promotion/marketing/document-generator
  para lo que ya existe. Extraer un módulo a servicio propio **solo** cuando un driver real lo exija
  (escala independiente, equipo separado, cadencia de despliegue divergente).

### 9.3 Exceso de acoplamiento
- **purchase-service es un hub** que lee de 6+ servicios. Riesgo de acoplamiento síncrono y fallos en
  cascada. **Mitigación**: modelo híbrido (síncrono solo donde bloquea la decisión; Kafka para el
  resto), *timeouts*/*circuit breakers*, y **degradación elegante** en el BFF (vista parcial).
- **BFF como punto de composición**: si crece sin control se vuelve un "mini-monolito de pantallas".
  **Mitigación**: el BFF **no** tiene reglas ni estado; solo compone y adapta.

### 9.4 Violaciones de responsabilidad (a vigilar)
- Que el BFF "decida" (aplicar una regla de aprobación) en vez de delegar → prohibido (§3.8).
- Que compras emita factura/NC o mueva stock directamente → prohibido; solo evento (§2.8).
- Que la autorización quede en el cliente (como hoy) → mover **toda** al backend (id-service +
  purchase-service), UI solo por conveniencia (decisión #8).

### 9.5 Escalabilidad
- **Tablas grandes sin paginación** (hoy el front renderiza el set completo). **Mitigación**:
  filtro/orden/**paginación server-side** obligatoria en Reposición, Productos, Análisis, Ranking,
  Margen, Recepciones.
- **Fan-out del BFF**: N llamadas por vista. **Mitigación**: paralelizar lecturas independientes +
  caché de maestros + reactividad por evento para invalidar.
- **Motor de reposición** sobre catálogo completo: cómputo pesado. **Mitigación**: precálculo por
  eventos (`inventory.*`, venta) y materialización incremental, no cálculo on-request masivo.

### 9.6 Mantenibilidad
- **Umbrales hardcodeados** (10M, 90d, cobertura 45d, cumplimiento 70/85…). **Mitigación**: mover a
  **configuración por scope** (global/categoría/proveedor/comprador), editable y auditada (decisión #4).
- **Enlaces por string** (`APR-<n>-<i>`, `poNumber`). **Mitigación**: **FK reales** internas; los
  códigos legibles pasan a ser atributo de presentación (decisión #1) — resolver **temprano** (caro de
  retrofitear).
- **Tres taxonomías de canal** y **dos modelos de campaña / dos costeos landed**. **Mitigación**:
  catálogo único de canales contra comerce-service; una entidad de campaña con `type`; costeo landed
  **por unidad** derivando el total (decisiones #2 y #3).

### 9.7 Cuellos de botella
- **SAP B1** como SoR de OC: latencia y disponibilidad. **Mitigación**: emitir de forma **asíncrona**
  (originar en compras + Outbox → SAP), no bloquear la UI a la latencia de SAP; conciliar por evento
  (`sap-outbox-worker` ya existe para el retorno).
- **id-service** en cada request (permisos). **Mitigación**: validación en API Gateway + caché de
  token/permiso de vida corta (el propio id-service ya usa LRU).

### 9.8 Oportunidades de simplificación
- **Reusar `sap-outbox-worker`** y el patrón SAP de `customer-service`/`inventory-v3`/`finance` en vez
  de inventar integración SAP nueva.
- **Reusar Outbox+idempotencia** de pricing/dom como plantilla — no reimplementar mensajería.
- **Un solo servicio de compra** (modular) reduce contratos, despliegues y superficie de fallo frente a
  la fragmentación que sugería el análisis; el BFF absorbe la complejidad de pantalla.
- **La "inteligencia" simulada** (evaluación proveedor, atribución, forecast, ABC/XYZ) se define
  **contrato por contrato** con negocio; el shape ya está tipado en el front — no inventar la fórmula.

---

## 10. Propuesta final

### 10.1 Arquitectura recomendada (resumen)
- **Dos servicios nuevos**, tal como exige el enunciado:
  - **`purchase-service`** — monolito **modular** (NestJS hexagonal + Prisma + SQL Server + Kafka
    Outbox). Dueño de la **decisión de compra** y del **ciclo de la OC** y sus dominios acoplados
    (reposición, gobierno/aprobación, RFQ, recepción, reclamos, relación de proveedor, OTB, planning,
    señales, equipo). Lee todo maestro externo; espeja lo oficial a SAP; emite eventos y trazas.
  - **`purchase-bff-service`** — capa de **composición sin estado**. Compone vistas, resuelve scope y
    deep-links, paraleliza lecturas, cachea maestros (nunca saldos), degrada con elegancia. Sin reglas,
    sin base de datos.
- **Reutilización total** del resto: catalog, pricing, inventory-v3, analysis/oms, comerce, id-service,
  notification/email, trace, tms, promotion/marketing, document-generator, SAP B1 (+ `sap-outbox-worker`).
- **Proveedor**: SAP B1 BusinessPartner (`cSupplier`) como SoR; adapter en purchase-service. **Sin
  servicio nuevo.**
- **Sin microservicios nuevos** más allá de los dos pedidos.

### 10.2 Diagrama textual
```
                                   Frontend (React SPA — Compras)
                                              │  (una llamada por vista)
                                              ▼
                                   ┌───────────────────────────┐
                                   │     purchase-bff-service   │   composición · scope · deep-links
                                   │   (sin estado, sin BD)     │   fan-out paralelo · caché maestros
                                   └───────────────────────────┘
              ┌───────────────┬───────────────┼───────────────┬───────────────┐
              ▼               ▼                ▼               ▼               ▼
      ┌──────────────┐  (lecturas de maestros y analítica, en paralelo)   ┌──────────────┐
      │  purchase-   │  catalog · pricing · inventory-v3 · analysis/oms · │  notification│
      │  service     │  comerce · id-service · tms · promotion/marketing  │  · trace     │
      │ (modular)    │◄──────────────── HTTP síncrono (leer) ─────────────►│  (emite evt) │
      │              │                                                     └──────────────┘
      │ Replenishment│           ▲                     ▲
      │ Purchasing   │           │ Kafka (reaccionar)  │ Kafka (emitir dominio + Outbox)
      │ Governance   │   inventory.stock.updated       purchase.order.issued
      │ Sourcing/RFQ │   pricing.price-audit.approved  purchase.approval.approved
      │ Receiving    │   catalog.sku.updated           purchase.reception.completed …
      │ Claims       │           │                     │
      │ Supplier Rel.│           ▼                     ▼
      │ Budget/OTB   │   ┌───────────────────────────────────────┐
      │ Planning     │   │        Bus de eventos (Kafka)         │
      │ Signals/Team │   └───────────────────────────────────────┘
      └──────┬───────┘                     │
             │ espeja / origina            │  sap-outbox-worker (PurchaseOrder.* SAP→Kafka)
             ▼                             ▼
      ┌──────────────┐            ┌───────────────────┐
      │  Persistencia│            │      SAP B1        │  SoR: OC oficial · GRN · factura · NC
      │  purchase DB │            │  (+ BusinessPartner│       · maestro costo/proveedor
      │  (SQL Server)│            │    = proveedor)    │
      └──────────────┘            └───────────────────┘

  Dueños externos de datos (nunca duplicados en compras):
   catalog=producto · pricing=costo/alzas · inventory=stock · analysis/oms=venta ·
   comerce=canal · id-service=identidad · SAP=oficial/proveedor · trace=auditoría ·
   notification=entrega · tms=transporte · marketing/promotion=campañas · document-generator=docs
```

### 10.3 Por qué esta es la mejor alternativa
1. **Respeta la restricción y el ecosistema.** Exactamente dos servicios nuevos; todo lo demás se
   reutiliza; el stack (NestJS+Prisma+MSSQL+Kafka Outbox), la auth (id-service/Gateway), la auditoría
   (trace) y el patrón SAP ya son los del monorepo. Baja fricción de adopción.
2. **Cero duplicación de responsabilidades.** Cada maestro (producto, costo, stock, venta, canal,
   identidad, proveedor) permanece con su dueño; compras solo posee lo que ningún otro servicio tiene:
   la **decisión de compra** y el **ciclo de la OC**. Esto es lo que el enunciado pide explícitamente.
3. **Simple y mantenible.** Un monolito modular evita 6-8 microservicios anémicos, con sus despliegues,
   bases y contratos, para un dominio que es **un solo bounded context** ("Compras"). El BFF absorbe la
   complejidad de pantalla sin contaminar el dominio.
4. **Escalable donde importa.** Paginación server-side, reactividad por evento para el motor de
   reposición, fan-out paralelo con degradación en el BFF, y emisión asíncrona a SAP evitan los
   cuellos de botella reales (SAP, tablas grandes, cómputo del motor).
5. **Evolucionable.** Los módulos tienen límites claros y comunicación por eventos; cuando un driver
   real aparezca (escala o equipo independiente), un módulo (p. ej. Planning o Team) puede extraerse a
   servicio propio **sin** rediseñar el dominio.
6. **Honesta con lo desconocido.** Las decisiones de negocio abiertas (FK vs string, taxonomías de
   canal, modelos de campaña, umbrales, fórmulas de "inteligencia") quedan marcadas y ubicadas en el
   tiempo (`docs/backend-spec/09` y `10`); nada se inventa en silencio.

### 10.4 Siguiente paso
Con esta arquitectura fijada, el paso siguiente es **diseñar los contratos de API y el modelo de
dominio** de `purchase-service` y `purchase-bff-service` — resolviendo primero las decisiones que
bloquean el modelo (FK reales, umbrales como configuración, autorización server-side, alcance SAP) por
el orden de `docs/backend-spec/09`.

> **Hecho:** los contratos de API están en [`../contratos-api/`](../contratos-api/README.md)
> (convenciones, inventario A–E, fichas, composición por vista, comandos, SAP, permisos,
> trazabilidad, revisión crítica y OpenAPI preliminar de ambos servicios).
</content>
</invoke>
