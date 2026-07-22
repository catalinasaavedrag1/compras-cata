# 00 · Decisiones de modelado (resueltas para diseñar; pendientes de ratificación de negocio)

> Antes de modelar se fijan las decisiones que condicionan el esquema. Cada una lleva la marca
> **[RATIFICAR]** cuando negocio debe confirmarla; el modelo está diseñado para que un cambio de
> decisión sea barato (se indica el costo del cambio en cada caso).

## D1 · Claves: FK reales + códigos legibles como atributo (cierra P1)

- **Id técnico**: string prefijado `"<tipo>-<ulid>"` (`prop-01J…`, `po-01J…`, `rec-01J…`) — legible en
  logs, ordenable por tiempo (ULID), sin autoincrement expuesto.
- **Toda relación es FK** al id técnico (`proposalId`, `approvalId`, `purchaseOrderId`,
  `receptionId`). Integridad referencial en BD.
- **Códigos humanos** (`OC-2026-0789`, `APR-…`) son **atributos de presentación** con índice único,
  generados por secuencia (`DocSequence`), jamás usados como clave de join.
- Costo de cambio: nulo — es la práctica del monorepo (pricing/inventory usan uuid + referenceId).

## D2 · Propuestas: N activas por comprador (cierra P2) **[RATIFICAR]**

- Se permiten **varias propuestas en `draft`** por comprador (casos reales: una por temporada + una
  ordinaria). Sin restricción única en BD.
- El concepto "borrador activo" del front (carrito global) se resuelve como **la propuesta `draft`
  más recientemente tocada** del comprador (`GET /proposals?status=draft&buyerId=…&sort=-updatedAt`),
  y `add-to-proposal` acepta `proposalId` opcional (default: esa).
- Costo de cambio a "solo 1 activa": índice único filtrado `(buyerId) WHERE status='draft'` — una
  migración pequeña, sin cambio de API.

## D3 · Identidad de proveedor: `supplierRef` (comerce) + `sapCardCode` (SAP) (cierra P3) **[RATIFICAR]**

- **Clave interna canónica**: `supplierRef` = `ReferenceId` de `comerce-service` (`SUP-023`) — es el
  maestro consultable del ecosistema y el id que ya usa el front.
- `SupplierRelationship` guarda el **cross-ref**: `supplierRef` (único) + `sapCardCode` (único,
  nullable) + `document` (RUT, para conciliar).
- **Regla dura**: emitir OC exige `sapCardCode` presente (`422 SUPPLIER_INACTIVE` con detalle
  `sap_cardcode_missing`); el alta/backfill del cross-ref es tarea operativa (V10/P4).
- Costo de cambio (canónica=CardCode): renombrar semántica de una columna; las FKs internas no cambian.

## D4 · OTB: actuals = OC convertidas, conciliación mensual vs SAP (cierra P16) **[RATIFICAR]**

- `OtbBucket` por **mes × categoría** (granularidad configurable por regla; default categoría).
- **Consumo** en `convert` (C13) por el monto **landed** de cada OC; **reintegro** en cancelación.
- `consumedClp` **no** es columna calculada a mano: se deriva de `OtbEntry` (append-only:
  `consume | release | reconcile`) — auditable y a prueba de carreras (suma transaccional).
- **Conciliación mensual** (batch) compara contra facturas de compra SAP y registra `reconcile`
  entries con la diferencia; no reescribe historia.
- Costo de cambio (actuals=facturado SAP): solo cambia el productor de entries; el esquema es el mismo.

## D5 · Convenciones transversales del esquema

| Convención | Regla |
|---|---|
| Esquema BD | SQL Server, schema **`purchase`** (base propia; jamás compartida) |
| Columnas comunes | `id`, `dateCreated`, `dateModified` (`@updatedAt`), `userCreated`, `userModified` — nombres idénticos a pricing/inventory-v3 |
| Concurrencia | `version INT NOT NULL DEFAULT 1` en toda raíz editable y en `ProposalLine`; se incrementa en cada UPDATE (transacción) |
| Estados | `VARCHAR` con CHECK/enum Prisma — valores del contrato (`04-comandos` §2), en inglés (`draft`, `in_review`…) |
| Dinero | `BIGINT` CLP enteros (`*Clp`); nada de float |
| Cantidades | `DECIMAL(18,3)` (unidades con fracción posible), `INT` donde es pieza |
| Fechas | `DATETIME2` UTC; fechas de negocio `DATE` |
| Snapshots | JSON (`NVARCHAR(max)`) **solo** dentro de documentos transaccionales, siempre con `asOf`; nunca consultables como maestro |
| Soft-delete | No. Los terminales (`cancelled`, `rejected`, `dismissed`) son estados; nada se borra salvo higiene programada (E14) |
| Multi-tenant | `platformId` no se persiste por fila: la plataforma Compras es una sola; si mañana hay multi-empresa ⇒ columna `companyId` (costo: aditivo) |

## D6 · Qué NO se modela en purchase (refuerzo anti-duplicación)

Sin tablas de: producto/SKU (catalog), costo/lista (pricing), stock (inventory), venta (analysis),
canal (comerce — solo tabla de **mapeo** `ChannelMap` P13), usuario/rol (id-service), bitácora
consultable (trace-service). Los campos `sku`, `categoryId`, `warehouseId`, `channelRef`, `userId`
son **referencias externas sin FK física** (validación en aplicación + eventos de invalidación E4).
</content>
