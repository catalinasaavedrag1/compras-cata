# 11 · Validación vista-por-vista (auditoría del código real)

> Segunda pasada: cada página del frontend se leyó contra el código fuente para confirmar que la
> especificación no omitiera nada. Este documento registra **qué se verificó**, **qué se corrigió** en
> los docs 01–10 y **qué se agregó**. Todo lo marcado *(validado)* proviene de leer el componente real.

## Cobertura verificada
Se auditaron las ~45 páginas de `src/pages/` en 6 dominios (Compra core · Órdenes/físico ·
Catálogo/Proveedor · Análisis/Precios · Temporadas/Campañas/Señales · Equipo/Gobierno/Config), más los
contextos (`Auth/Role/Buyer/OcDraft/PurchaseFlow/Signals/Claims/Trace/Notification`). Todas las rutas de
`AppRoutes.tsx` quedaron mapeadas.

## A. Rutas que faltaban (agregadas al doc 01)
- **`/alertas` → AlertsPage** — bandeja de alertas (no estaba en la tabla maestra).
- **`/senales-ventas` → SalesSignalsPage** — bandeja de señales de terreno (no estaba).
- **`/mi-panel` → redirige a `/`** — ruta heredada.

## B. Máquinas de estado corregidas (valores reales, en doc 03)
La primera versión había **inferido** varios enums; los reales son:

| Entidad | Estado real (validado) |
|---|---|
| RecommendationStatus | `critical / buy_now / review / normal / overstock` (gestión = `rec-overrides`/`rec-ignored`) |
| ApprovalState | `pendiente / en_analisis / observada / aprobada / rechazada` |
| ApprovalCriterion generados | `monto_alto · cobertura_excesiva · desvio_sugerido · margen_bajo` (otros 3 solo se renderizan) |
| ReceptionStatus | `scheduled / in_transit / received / partial / with_issues / delayed` |
| ClaimStatus / Resolution / Type | `abierto…rechazado` / `pendiente…aceptado_sin_ajuste` / `faltante…documento` |
| RfqStatus | `borrador → enviada → respondida(_parcial) → en_negociacion → aprobada → convertida / rechazada / vencida` |
| SignalStatus | `new → in_review → sourcing → quoted → awaiting_customer → accepted → purchased → resolved / rejected` |
| AlertStatus (+16 AlertType) | `new / in_review / resolved / ignored` |
| CampaignOpportunityStatus | 8 clases de recomendación (no ciclo de vida); CreatedCampaignStatus `draft/scheduled/active` |
| SupplierStatus / NegotiationStatus | `active/review/delayed/blocked/inactive` / `propuesta/en_curso/acordado/rechazado` |
| GoalStatus | `done / on_track / risk` |
| ImportStage | `proforma → orden → produccion → embarque → transito → aduana → internacion → bodega` |
| NpiStage | `propuesta → aprobada → piloto → evaluacion → escalado / rechazada` |

Enums de dominio adicionales confirmados: `SupplierClass` (7), `NegotiationLever` (10),
`NegotiationBenefit` (5), `PurchaseClass` (5), `RedundancyAction`/`PriceTier`, `MarginChannelKey`,
`SignalChannel`, `DemandChannel`, `PromoChannelKey`, `CampaignChannel`/`PromoChannel`.

## C. Escrituras ocultas / secundarias que faltaban (en docs 03 y 05)
- **Crear OC** divide el borrador en **N OC (una por proveedor)** y crea a la vez `Approval` **y**
  `Decision` (`APR-<n>-<i>` ↔ `DEC-<n>-<i>`); aprobar/rechazar el `APR-` parcha su `DEC-`.
- **Recepción → Reclamo** (tipo/cantidad/valor inferidos por regex) y **Recepción → OC draft** ("reordenar").
- **Reclamo** (crear/cambiar estado) → escribe **bitácora** `compras:trace`.
- **RFQ convertir** → doble escritura (draft + estado `convertida`).
- **Señal**: modelo patch-overlay `{created[], patches{}, extraMessages{}, extraEvents{}}` + hilo de
  mensajes + timeline de eventos.
- **ProductDetail MoreActions / NewProducts "programar salida" / SettingsPage reglas** → solo bitácora o
  solo `useState` (no persisten). **WorkloadPage / ChannelMargin / PriceIncreases / SeasonPlanner** →
  toast-only.

## D. Datos fabricados / hash-simulados adicionales (amplía doc 02·D)
Más allá de los ya listados: `recommendationConfidence` (`90 − |trend|·0.4`), `forecast30`, GMROI estimado,
precios de proveedor alternativo (`costFactor ±4%`), *haircut* de 40% a OC atrasada, múltiplos de compra
sintéticos, fórmulas de salud de MyPanel, `metaVenta = ventas·1.18`, pesos de prioridad de la agenda,
`buyerAttribution.scoreAdjust` (regla de **equidad**), `campaignPerformance` (FNV-1a), `planSeason`
(hashString), **"+8,4% vs período anterior"** (literal hardcodeado), `mesesSinCompra` (hash), margen por
canal solo para **29 SKUs**, `inventoryKpis` pre-cocidos, `supplierEvaluation` (4/6 dims por hash).

## E. Contrato de deep-link: más estrecho de lo asumido (en doc 01)
Solo ~13 páginas sincronizan estado con la URL (`useUrlState`). El resto (Ventas, Reportes, Presupuesto,
Alzas, Campañas, Anticipación, Temporadas, Señales, Alertas, RFQ, Aprobaciones, CategoryDetail) usa
**estado local efímero**: se pierde al recargar y **no es enlazable**. En ProductDetail/SupplierDetail el
`?tab=` se lee **solo al montar**. → Si el negocio requiere compartir estas vistas con estado, es trabajo
nuevo (decisión #1 de deep-links).

## F. Inconsistencias de negocio detectadas (nuevas decisiones en doc 10)
- **#12 Fuente única de OC**: Reportes usa `mockPurchaseOrders`; OTB usa `compras:po-created`. Divergen.
- **#13 IDs generados en cliente** (colisionan): OC/RFQ/CLM/NEG/CAMP/factura/uid.
- **#14 Escrituras "fantasma"**: acciones que solo notifican o solo loguean sin mutar.
- **#15 Scoping inconsistente**: solo algunas vistas filtran por comprador/rol; el resto es global.
- **Actor de bitácora hardcodeado** "Catalina Saavedra" sin importar la persona → debe venir de sesión.
- **`/reglas` y `/gobierno` sin RoleGate**: cualquier rol autenticado entra (solo `/equipo/*` está gated).

## G. Patrones transversales confirmados
- **Sin paginación en ninguna tabla**: renderizan el set filtrado completo; cortes puntuales top-N
  (Análisis top-100, CategoryDetail "clave" top-12, NewProducts "salidas" top-20, rankings top-4/5).
  Refuerza el requisito de filtros/orden/paginación server-side (doc 04).
- **`TODAY_ISO` / `SEASON_PROGRESS=0.45` / `todayISO` hardcodeados** anclan todos los cálculos de fecha
  y progreso → el backend debe exponer fecha/estado reales.
- **Umbrales de negocio dispersos** (además de doc 02·F): `OVERSTOCK_COVERAGE_DAYS=120`, concentración de
  proveedor 30%, `noSales90 ≤ 6`, spread de margen ≥15pts, banda objetivo de cobertura 45–60d, descuento
  de liquidación 30%, `leadTime·1.5` (alta venta/bajo stock). Todos candidatos a configuración de servidor.

## Conclusión
La estructura de la especificación (docs 01–10) se mantiene válida. Esta pasada **no cambió el modelo de
servicios ni el orden de implementación**; corrigió enums inferidos, agregó 2 rutas y ~10 escrituras
ocultas, y elevó 4 inconsistencias de negocio a decisiones pendientes. El conjunto sigue siendo apto para
diseñar contratos de API y modelo de datos sin improvisaciones.
