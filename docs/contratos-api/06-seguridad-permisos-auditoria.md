# 06 · Seguridad, permisos y auditoría

> Cumple los puntos 10 y 11. La autorización **no** es solo por rol: se compone de
> **permiso** (capacidad) × **alcance** (sobre qué datos). Verificado: id-service/gateway solo
> alcanzan `plataformaId` ⇒ el alcance fino es **autorización de dominio** en purchase-service.

## 1. Dimensiones de alcance

| Dimensión | Fuente | Aplicación |
|---|---|---|
| Empresa/plataforma | `plataformaId` del JWT (id-service) | Gateway + BFF: todo request queda confinado a la plataforma Compras |
| Sucursal / bodega | `comerce-service` locations | **Filtro de datos** (`warehouseId`), no permiso: v1 no restringe por sucursal (❓P12 si negocio lo pide) |
| Categoría (cartera) | `CategoryAssignment` (purchase) | **Escritura**: solo sobre categorías asignadas al `x-buyer-id`. **Lectura**: `scope=mine` filtra; `scope=all` permitido a todos (paridad con el front actual) |
| Proveedor | — | Sin restricción por proveedor en v1 |
| Comprador asignado | `x-buyer-id` (validado: el usuario solo puede actuar como su buyer; líder puede consultar otros) | Scoping de bandejas y desempeño |

## 2. Catálogo de permisos `purchase:*` y bundles por rol

| Permiso | Capacidad | comprador | líder |
|---|---|---|---|
| `purchase:recommendation:read` / `:write` | ver reposición / override-ignorar | ✅/✅ (cartera) | ✅/✅ |
| `purchase:proposal:read` / `:write` / `:submit` | ver / editar / enviar a revisión | ✅ (cartera en write) | ✅ |
| `purchase:proposal:approve` | aprobar·rechazar·pedir corrección | ❌ | ✅ |
| `purchase:order:read` / `:issue` / `:cancel` | ver / convertir / cancelar OC | ✅/✅/✅ (cartera) | ✅ |
| `purchase:order:sap-send` | (re)enviar a SAP | ✅ | ✅ |
| `purchase:reception:read` / `:write` | recepciones | ✅ | ✅ |
| `purchase:claim:read` / `:write` / `:resolve` | reclamos | ✅/✅/❌ | ✅ |
| `purchase:rfq:read` / `:write` / `:award` | cotizaciones | ✅ | ✅ |
| `purchase:negotiation:write` | rondas/términos/acuerdos | ✅ (sus proveedores) | ✅ |
| `purchase:alert:read` / `:ack` | alertas | ✅ | ✅ |
| `purchase:signal:read` / `:write` | señales | ✅ | ✅ |
| `purchase:budget:read` / `:admin` | ver OTB / editar buckets | ✅/❌ | ✅/✅ |
| `purchase:season:read` / `:write` | temporadas/forecast | ✅ | ✅ |
| `purchase:campaign:read` / `:write` | oportunidades/campañas | ✅ | ✅ |
| `purchase:decision:read` / `:write` | aprendizaje | ✅ | ✅ |
| `purchase:rule:read` / `:admin` | ver / administrar reglas y matriz | ✅/❌ | ✅/✅ |
| `purchase:assignment:read` / `:admin` | ver / reasignar cartera | ✅/❌ | ✅/✅ |
| `purchase:team:read` · `purchase:reward:admin` | vistas `/equipo/*` · premios | ❌ | ✅ |
| `purchase:cost:read` | **ver costos** (campos `cost*`, waterfall) | ✅ | ✅ |
| `purchase:margin:read` | **ver márgenes** | ✅ | ✅ |
| `purchase:export` | exportaciones CSV | ✅ | ✅ |

Notas de contrato:
- `cost:read`/`margin:read` son **permisos de campo**: sin ellos, el BFF **omite** esos campos del
  payload (no los manda en `null`, los excluye) — soporta perfiles futuros (p. ej. visualizador).
- Bundles ≠ roles rígidos: el bundle es el default de provisión en id-service; la enforcement es
  **siempre por permiso**, nunca `if (rol === 'lider')` en código.
- Comandos con doble llave: `approve/reject/request-changes` exigen permiso **y** approval `pending`
  **y** (❓P8) no-autoría.

## 3. Enforcement por capa

| Capa | Verifica |
|---|---|
| api-gateway | sesión válida (token en `TOKENS_ACTIVOS`), plataforma, RBAC (método+path) — requiere **registrar** los endpoints del BFF en id-service (tarea config) |
| purchase-bff | JWT → identidad; resolución de permisos id-service → traducción a `purchase:*`; **omisión de campos** por `cost/margin:read`; propagación de headers |
| purchase-service | `PermissionGuard` (`purchase:*`) + **alcance de cartera** (`CategoryAssignment`) + reglas de máquina de estados |
| servicios existentes | headers `x-service-*` (⚠️ catalog/comerce/oms/customer hoy **sin auth en código** — riesgo señalado R7: mitigación = red interna + gateway; corrección de fondo fuera del alcance de compras) |

## 4. Auditoría — qué registra cada comando

Formato de traza (a `trace-service`; contrato exacto de transporte ❓pdte-verif D7):
```json
{
  "service": "purchase-service",
  "action": "proposal.submitted",
  "entity": "PurchaseProposal",
  "entityId": "prop-2026-000123",
  "userId": "usr-0042",
  "buyerId": "catalina",
  "timestamp": "2026-07-17T12:04:00Z",
  "before": { "status": "draft", "version": 6 },
  "after":  { "status": "in_review", "version": 7 },
  "changedFields": ["status"],
  "reason": null,
  "source": "purchase-bff/web",
  "correlationId": "8c2f6e0a-…",
  "context": { "criteria": ["high_amount", "excessive_coverage"] }
}
```

| Comando(s) | before/after | `reason` | `context` extra |
|---|---|---|---|
| C1 crear / C12 duplicar | — / snapshot | — | origen (recomendación/RFQ/duplicado) |
| C2–C5 líneas | campos cambiados | — | recosteo aplicado |
| C7 submit | estados | — | **criterios evaluados** (aunque no disparen) |
| C8–C10 aprobar/rechazar/corregir | estados | C9/C10 obligatorio | criterios; aprobador |
| C11/C14b cancelar | estados | obligatorio | OTB reintegrado |
| C13 convert | estados | — | OC generadas, `integrationKey`s, snapshot de costeo |
| C14 send / worker SAP | `sapSync` | — | attempts, `docEntry/docNum`, error SAP saneado |
| C19 override/ignore | qty/status | **obligatorio** | delta vs sugerido (alimenta atribución) |
| C21 recepción | estados | — | pedido-vs-recibido por línea |
| C22 reclamo | estados | resolución | tipo de resolución, NC solicitada |
| C15/C15b/C18 relación/cartera | versión términos / asignación | — | vigencias |
| C17 alertas | estado | dismiss obligatorio | regla que originó la alerta |
| Reglas (`rules:admin`) | valores umbral | obligatorio | scope de la regla |

- `ip`/`device`: el gateway hoy **no** los propaga ⇒ no forman parte del contrato v1 (❓P9; si se
  añade, viajarían como `x-forwarded-for`/`x-device-type` ya definidos en headers del BFF).
- **Lecturas** no auditan, con dos excepciones: exportaciones (`purchase:export`) y lecturas de
  gobierno (`governance/audit`) — traza de acceso liviana.
- La bitácora que muestra `/gobierno` **lee** trace-service vía BFF; purchase no duplica almacenamiento.
</content>
