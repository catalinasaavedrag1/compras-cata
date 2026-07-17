# 09 · Orden de implementación por flujos verticales end-to-end (requisito #12)

Criterio: cada fase entrega un **flujo vertical completo** (UI real → BFF → servicio → persistencia →
evento/bitácora), no una capa horizontal. Se prioriza el ciclo de compra —el corazón del producto—
y se dejan para el final los dominios 100% simulados. Cada fase asume resueltas las **decisiones
pendientes** que la bloquean (doc 10).

## Fase 0 — Cimientos (habilitadores transversales)
1. **Identity real**: login, sesión, rol (`comprador`/`lider`), comprador activo → reemplaza
   `auth/role/buyer`. Autorización server-side (mueve el gating de `/equipo/*` y aprobaciones al backend).
2. **Servicio de fecha/servidor** (elimina `TODAY_ISO`).
3. **Bitácora/auditoría** persistente (reemplaza `trace`) — la usarán todas las escrituras.
4. **Cablear las 3 páginas ya existentes** a backend real y **añadir escritura** al patrón de servicio
   (hoy solo lectura). Decidir FK vs string (doc 10 #1) antes de modelar.

## Fase 1 — Ciclo núcleo de compra (vertical estrella)
**Reposición → Borrador OC → Aprobación → Emisión → SAP.**
1. **Recomendaciones**: `GET/PATCH /recommendations` (override/ignore/snooze persistidos).
2. **Borrador OC**: `purchase-drafts/current` (líneas, agrupación por proveedor, costo).
3. **Gobierno de compra**: reglas + matriz de aprobación server-side; disparo de criterios
   (`monto_alto` 10M, `cobertura_excesiva` 90d) al emitir.
4. **Aprobaciones**: `GET/PATCH /approvals` con guard `lider`; enlace real OC↔aprobación (FK).
5. **Emisión de OC** → `POST /purchase-orders` + **integración SAP B1** (deja de ser fire-and-forget).
6. **BFF Home** para que MyPanel consuma este ciclo.
> Entregable: un comprador arma una OC, se aprueba y se emite a SAP, con bitácora. Es el MVP real.

## Fase 2 — Cierre del ciclo físico
**Recepción → Diferencias → Reclamos → Decisión/aprendizaje.**
1. **Recepciones**: `GET/POST/PATCH /receptions` contra OC (FK `poNumber`), actualiza Inventory,
   integra GRN de SAP. Completar la máquina de estados (hoy solo en semilla).
2. **Reclamos**: `GET/POST/PATCH /claims` enlazados a OC+recepción; nota de crédito → SAP.
3. **Decisiones**: `POST /decisions` cerrando el ciclo de aprendizaje (resultado vs proyección).
4. **Alertas** derivadas por reglas (quiebre/sobre-stock/margen) → Notification.

## Fase 3 — Abastecimiento e inputs de la decisión
**RFQ, Pricing, Inventory, Supplier como fuentes reales.**
1. **RFQ**: `GET/POST/PATCH /rfqs` → adjudicación genera OC.
2. **Pricing real**: costo maestro, listas, alzas (`price-lists`), waterfall de costo neto
   (reemplaza hash-sim de negociación).
3. **Inventory real**: integración WMS/ERP (stock/tránsito/rotación/capacidad) — alimenta Reposición.
4. **Supplier**: evaluación real, términos, acuerdos, negociaciones (reemplaza hash-sim + localStorage).
5. **Plan de retiro / Logistics**: `bff/pickup-plan` con capacidad/tarifas reales.

## Fase 4 — Catálogo y análisis
1. **Catalog** completo: roles, surtido, redundancia, NPI, `skuProfile` real.
2. **Sales real**: venta por canal/período, señales, margen por canal, `mesesSinCompra`,
   oportunidades perdidas — integra POS/e-commerce/marketplace.
3. **Reportes/BFF** de agregados; **Budget/OTB**.
4. **DMS** documentos + torre de control de importaciones (Logistics + aduana).

## Fase 5 — Planificación y comercial (los más simulados)
1. **Planning (Temporadas)**: temporadas, ventanas, ajuste de forecast, plan por escenario,
   demanda por canal (reemplaza `seasonPlan/tracking/channelDemand` hash-sim).
2. **Marketing/Campañas**: unificar `CampaignPlan`/`CreatedCampaign` (doc 10 #3), espacios
   publicitarios, banner, **integración con ad platforms** para rendimiento real (ROAS, CTR…).

## Fase 6 — Equipo, gamificación y gobierno avanzado
1. **Team/Performance**: compradores, carga, metas/OKR, reasignación.
2. **Gamification**: score, ligas, retos, premios, ranking, `buyerAttribution` real.
3. **Governance avanzado**: dashboards de auditoría sobre la bitácora ya poblada.

## Principios del orden
- **Reconciliar canales y campañas (doc 10 #2/#3) antes** de Fase 4-5.
- **Resolver FK (doc 10 #1) en Fase 0-1**: es transversal y caro de retrofitear.
- **Umbrales de política a configuración** al construir Governance (Fase 1), no antes.
- Cada fase deja un flujo demostrable de punta a punta; nada se libera como "capa" sin UI que lo use.
