# 04 · Comandos del dominio Purchase y control de concurrencia

> Cumple los puntos 6 y 7. Separación CQRS ligera: **consultas** = GET/`POST …/search` (sin efectos);
> **comandos** = todo lo de este documento (transición + evento + traza). Los comandos viven en
> `purchase-service`; el BFF los pasa 1:1 (traduce envoltorio, jamás la regla).

## 1. Defaults de todo comando

- **Permiso** según tabla (`06`) + **alcance de cartera** (la categoría de las líneas ∈ asignaciones
  del comprador; líder sin restricción de cartera).
- **Idempotencia**: `idempotency-key` obligatoria en comandos de creación/efecto externo (marcados 🔑).
- **Concurrencia**: `If-Match: "<version>"` obligatorio en comandos sobre entidad existente (marcados 🔒);
  respuesta incluye `version` nueva.
- **Respuesta**: entidad completa actualizada (read-your-writes) salvo indicación (202 async).
- **Evento**: vía Outbox transaccional. **Auditoría**: traza a trace-service (before/after).
- Violación de estado ⇒ `409 PURCHASE_PROPOSAL_INVALID_STATE` con `details:{current, allowed[]}`.

## 2. Máquina de estados de la propuesta

```
draft ──submit──▶ in_review ──approve──▶ approved ──convert──▶ converted
  ▲                   │                      │
  │                   ├─reject────────▶ rejected (terminal)
  └──request-changes──┘                      │
  (changes_requested → editable = draft*)    └─cancel──▶ cancelled (terminal)
draft ──cancel──▶ cancelled
```
\* `changes_requested` es un sub-estado visible de `draft` (conserva historial y nota del líder).
La OC (post-convert) sigue su propia máquina: `approved → sent → confirmed → (partially_received |
received) → closed | cancelled` — transiciones de recepción/conciliación, no de usuario directo
(salvo `send` y `cancel`).

## 3. Catálogo de comandos

| # | Comando | Endpoint (BFF = dominio) | 🔑 | 🔒 | Estado permitido | Transición | Validaciones clave | Permiso | Eventos |
|---|---|---|---|---|---|---|---|---|---|
| C1 | Crear propuesta | `POST /proposals` | 🔑 | — | — | → `draft` | líneas opcionales válidas; cartera | `proposal:write` | `proposal.created` |
| C2 | Editar propuesta (meta) | `PATCH /proposals/:id` | — | 🔒 | `draft` | = | título/nota | `proposal:write` | `proposal.updated` |
| C3 | Agregar línea | `POST /proposals/:id/lines` | 🔑 | 🔒 | `draft` | = | SKU activo y en surtido; proveedor activo; qty>0; múltiplo/pack; costo se resuelve al agregar (falta ⇒ `cost:null`+flag) | `proposal:write` | `proposal.line_added` |
| C4 | Actualizar cantidad/línea | `PATCH /proposals/:id/lines/:lineId` | — | 🔒 (versión de línea) | `draft` | = | qty>0; múltiplo; recostea | `proposal:write` | `proposal.line_updated` |
| C5 | Eliminar línea | `DELETE /proposals/:id/lines/:lineId` | — | 🔒 | `draft` | = | — | `proposal:write` | `proposal.line_removed` |
| C6 | Guardar borrador | — (no existe como comando) | | | | | **autosave**: C2–C5 persisten cada edición; no hay "save" separado | | |
| C7 | Enviar a revisión | `POST /proposals/:id/submit` | 🔑 | 🔒 | `draft` | → `in_review` (criterios) o → `approved` (sin criterios) | ≥1 línea · sin `COST_MISSING` · OTB (`budget/check`) · MOQ agregado por proveedor · proveedor activo | `proposal:submit` | `proposal.submitted` (+`approval.requested`) |
| C8 | Aprobar | `POST /approvals/:id/approve` | 🔑 | 🔒 | approval `pending` | → `approved` (propuesta → `approved`) | solo líder; no auto-aprobación (❓P8) | `proposal:approve` | `approval.approved` |
| C9 | Rechazar | `POST /approvals/:id/reject` | 🔑 | 🔒 | `pending` | → `rejected` (propuesta → `rejected`) | `reason` obligatorio | `proposal:approve` | `approval.rejected` |
| C10 | Solicitar corrección | `POST /approvals/:id/request-changes` | 🔑 | 🔒 | `pending` | → `observed`; propuesta → `changes_requested` (editable) | `reason` obligatorio | `proposal:approve` | `approval.observed` |
| C11 | Cancelar propuesta | `POST /proposals/:id/cancel` | 🔑 | 🔒 | `draft·in_review·approved` | → `cancelled` | `reason` obligatorio; si `in_review`, cierra approval | `proposal:write` | `proposal.cancelled` |
| C12 | Duplicar propuesta | `POST /proposals/:id/duplicate` | 🔑 | — | cualquiera | nueva en `draft` | re-resuelve costos frescos; marca origen | `proposal:write` | `proposal.created` |
| C13 | Convertir en OC | `POST /proposals/:id/convert` | 🔑 | 🔒 | `approved` | → `converted`; crea 1 OC/proveedor (`approved`, `sapSync=pending`) | **revalida** costo/OTB/proveedor; consume OTB; encola outbox SAP | `order:issue` | `order.issued`·`otb.consumed` |
| C14 | Enviar OC (SAP/proveedor) | `POST /purchase-orders/:id/send` | 🔑 | 🔒 | OC `approved` | → `sent` (encola si no lo estaba; notifica proveedor) | sapSync no `rejected` | `order:sap-send` | `order.sent_to_supplier` |
| C14b | Cancelar OC | `POST /purchase-orders/:id/cancel` | 🔑 | 🔒 | `approved·sent·confirmed` (sin recepciones) | → `cancelled` (+cancelación SAP, ver `05` §7) | `reason`; reintegra OTB | `order:cancel` | `order.cancelled` |
| C15 | Registrar negociación | `POST /suppliers/:id/negotiations` | 🔑 | — | — | ronda `open/in_progress/agreed/stalled` | proveedor existe (comerce) | `negotiation:write` | `supplier.negotiation_round_logged` |
| C15b | Actualizar condición comercial | `PUT /suppliers/:id/terms` | — | 🔒 | — | versión nueva de términos (histórico) | MOQ≥0, leadTime≥0, pago ∈ catálogo `payment-terms` (customer-service) | `negotiation:write` | `supplier.terms_updated` |
| C16 | Agregar comentario | `POST /proposals/:id/comments` (tb. señales/reclamos) | 🔑 | — | no terminal | append | texto ≤ 2000 | `proposal:write` | `comment.added` |
| C17 | Marcar alerta atendida | `POST /alerts/:id/acknowledge·resolve·dismiss` | — | — | `active(→ack)`, `ack(→resolved)` | transición idempotente (repetir = 200 sin cambio) | `dismiss` exige `reason` | `alert:ack` | `alert.acknowledged/…` |
| C18 | Asignar comprador (cartera) | `PUT /assignments/:categoryId` | — | 🔒 | — | reasigna buyer→categoría | solo líder; buyer existe | `assignment:admin` | `assignment.changed` |
| C19 | Override recomendación | `PATCH /replenishment/recommendations/:id` | — | 🔒 | `pending·snoozed` | qty override / `ignored` / `snoozed(until)` | `reason` obligatorio (auditable) | `recommendation:write` | `recommendation.overridden/ignored` |
| C20 | Adjudicar RFQ | `POST /rfqs/:id/award` | 🔑 | 🔒 | `responded` | → `awarded`; genera propuesta `approved`* | oferta ∈ RFQ (❓P10: ¿adjudicación salta aprobación?) | `rfq:award` | `rfq.awarded` |
| C21 | Registrar recepción | `POST /receptions` + `PATCH :id` | 🔑 | 🔒 | OC `sent+` | ver F8 | qty≥0 por línea; diferencias⇒`discrepancy` | `reception:write` | `reception.*` |
| C22 | Crear/resolver reclamo | `POST /claims` · `PATCH /claims/:id/resolve` | 🔑 | 🔒 | recepción `discrepancy·completed` | `open→in_review→resolved/rejected` | FK OC+recepción; resolución ∈ enum | `claim:write/resolve` | `claim.opened/resolved` |

**Precondición transversal**: toda entidad referenciada por **FK real** (propuesta↔aprobación,
OC↔propuesta, recepción→OC, reclamo→OC+recepción). Los códigos legibles (`OC-2026-0789`) son
presentación, nunca clave.

## 4. Ejemplo de ficha de comando completa (C4 — actualizar cantidad)

| Atributo | Valor |
|---|---|
| Precondición | propuesta `draft` (o `changes_requested`); línea existe; autor con cartera de la categoría |
| Estado permitido / transición | `draft` → `draft` (contenido cambia, estado no) |
| Validaciones | `qty > 0`; `qty % packMultiple == 0` (si definido) ⇒ si no `422 MOQ_NOT_MET` con sugerencia `details:{suggestedQty}`; recosteo con precio vigente |
| Permiso | `purchase:proposal:write` + cartera |
| Idempotencia | no requiere key (PATCH con If-Match es seguro de reintentar) |
| Concurrencia | `If-Match` con **versión de la línea**; conflicto ⇒ 409 con `currentVersion` y la línea actual para merge en UI |
| Versión esperada | request header; respuesta `data.version` (línea) y `data.proposalVersion` |
| Respuesta | línea actualizada + totales recalculados del grupo proveedor |
| Eventos | `purchase.proposal.line_updated { proposalId, lineId, before:{qty}, after:{qty} }` |
| Auditoría | traza `proposal.line_updated`, changedFields `[qty, subtotal]` |

## 5. Control de concurrencia — estrategia explícita (punto 7)

| Conflicto | Estrategia |
|---|---|
| Dos usuarios editan la misma propuesta | **Optimistic locking**: `version` por propuesta **y por línea**; `If-Match` obligatorio; `409 VERSION_CONFLICT` devuelve el estado actual para merge manual en UI. Sin locks pesimistas (edición colaborativa poco frecuente) |
| Cambia el stock durante una simulación | La simulación es *stateless* (no reserva ni bloquea). Patrón **revalidar-al-confirmar**: `submit`/`convert` re-verifican stock/costo/OTB frescos y fallan con 409/422 explicando el delta (`details:{field, simulated, current}`) |
| Cambia el costo | Ídem: recosteo automático en C3/C4; entre `submit` y `approve` el costo queda **congelado en snapshot** de la propuesta (lo que aprueba el líder es lo que se emite); si pricing publica cambio antes de `convert`, `convert` detecta desviación > tolerancia (regla `price_drift_pct`, default 0 — ❓P11) ⇒ 409 `APPROVAL_REQUIRED` (re-someter) |
| Cambia el proveedor (bloqueado a mitad de flujo) | `submit`/`convert` revalidan `SupplierRelationship.status`; bloqueado ⇒ `422 SUPPLIER_INACTIVE` |
| Se aprueba dos veces | Máquina (`pending` es el único estado aprobable) + `If-Match` + `idempotency-key` (replay devuelve el primer resultado, no re-ejecuta) |
| Se envía dos veces a SAP | Triple barrera: máquina (`sapSync=pending` único encolable) + `idempotency-key` del comando + **índice único `integrationKey`** (`po:<id>:opor`) en el outbox; y el worker, ante fallo ambiguo, **re-consulta SAP por `U_REF1` antes de re-postear** (patrón finance) |
| Se modifica una orden ya enviada | Prohibido por contrato: OC `sent+` es **inmutable** salvo `cancel` y conciliación de estado; cambios ⇒ nueva propuesta (o RFQ). `PATCH /purchase-orders/:id/status` solo `x-service-*` (conciliación) |

**Transacciones**: cada comando = 1 transacción local (entidad + outbox + idempotency record).
**Bloqueo funcional**: ninguno en v1 (no se "toma" la propuesta); si la colaboración simultánea creciera,
añadir *soft-lock* informativo (quién edita) sin bloquear escritura — decisión futura, no contrato v1.
</content>
