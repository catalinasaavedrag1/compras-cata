# 08 · Clasificación de cada necesidad (requisito #11)

Cinco categorías: **YA EXISTE** (costura + colección cableada), **DEBE AMPLIARSE** (existe base
pero incompleta), **DEBE CREARSE** (no hay servicio/endpoint), **REQUIERE INTEGRACIÓN** (sistema
externo: SAP, POS, ads, WMS), **REQUIERE DEFINICIÓN FUNCIONAL** (regla de negocio no resuelta → doc 10).

## YA EXISTE (base utilizable hoy)
- Contrato REST genérico + `db.json` (`server/index.ts`) — patrón de colección.
- 13 colecciones sembradas con `id_field` (`server/seed.ts`).
- `apiClient` (get/getOne/create/patch/delete/health) + `useCollection` con fallback a mock.
- Cableado real de **products** y **suppliers** (2 páginas + análisis).
- Tipado de dominio completo (`purchasing.ts`+`team.ts`): ~35 entidades, ~50 enums de estado.

## DEBE AMPLIARSE (existe pero incompleto)
- **Cablear las páginas restantes** a `useCollection` (hoy solo 3 de ~40 lo usan).
- **Añadir escritura por servicio**: hoy `src/services/index.ts` son 8 servicios **solo de lectura**;
  faltan create/update/delete.
- **Colecciones sin escritura real**: recommendations, alerts, signals, campaign-opportunities,
  purchase-orders (solo un `apiCreate` fire-and-forget), decisions, approvals, receptions, rules.
- **Máquinas de estado**: hoy la UI solo alcanza estados iniciales (OC llega a `sent`; recepción
  entera solo en semilla). Ampliar transiciones + persistencia.
- **Governance**: reglas ya son colección; falta matriz de aprobación server-side y bitácora persistente
  (hoy `trace` en localStorage, cap 200).
- **Supplier**: falta términos/acuerdos/negociaciones (hoy localStorage por `{supplierId}`).

## DEBE CREARSE (servicio/endpoint inexistente)
- **Purchase Core** completo: borrador de OC (`purchase-drafts`), RFQ, reclamos, decisiones como
  endpoints; hoy todo localStorage/mock.
- **Marketing/Comercial**: planes de campaña, espacios publicitarios, banner, rendimiento.
- **Planning (Temporadas)**: temporadas, ventanas, ajuste de forecast, plan por escenario.
- **Logistics/TMS**: plan de retiro/flota, tarifas, capacidad; torre de control de importaciones.
- **DMS**: gestión documental.
- **Team/Gamification**: metas/OKR, score, ligas, retos, premios, ranking, carga.
- **Finance/OTB**: presupuesto abierto para comprar.
- **Servicio de fecha/servidor** (hoy `TODAY_ISO` hardcoded).
- **Endpoints de escritura para las ~30 claves `localStorage`** (mapa directo en doc 02/05).

## REQUIERE INTEGRACIÓN (sistema externo)
- **SAP B1**: emisión de OC oficial, recepción/GRN, facturas, notas de crédito, maestro costo/proveedor.
- **POS / e-commerce / marketplace (Mercado Libre)**: venta real por canal, señales, demanda.
- **WMS / ERP inventario**: stock por bodega, en tránsito, movimientos, capacidad.
- **Ad platforms**: Google Ads, Meta/TikTok, mailing, Web analytics → rendimiento de campañas.
- **Identity provider**: autenticación real + autorización (hoy auth falsa).
- **Aduana/forwarder**: estados de importación (torre de control).

## REQUIERE DEFINICIÓN FUNCIONAL (decisión de negocio — ver doc 10)
- **Enlaces por string vs FK** (OC↔aprobación/decisión, recepción→OC, reclamo→OC/recepción).
- **Tres taxonomías de canal** incompatibles a reconciliar.
- **Dos modelos de campaña** (`CampaignPlan` vs `CreatedCampaign`) y **dos costeos landed**.
- **Umbrales de política como configuración de servidor** (hoy constantes: coberturas, cumplimiento,
  monto de aprobación 10M, cobertura 90 días, margen bajo, metas por categoría).
- **Naturaleza del override de recomendación** (efímero vs auditable).
- **Modelo de resultado de decisión** (KPI real a N días).
- **Fuente real de toda la "inteligencia" hash-sim** (negociación, evaluación proveedor, atribución,
  temporada, `mesesSinCompra`) — hoy inventada en front, prohibido asumir la fórmula.

## Resumen cuantitativo
- ~13 colecciones **existen** como base; solo **2-3 cableadas**.
- ~30 claves `localStorage` = **escritura por crear**.
- ~8 dominios propios = **servicios por crear**.
- ~6 sistemas = **integración externa**.
- ~7 puntos = **definición funcional pendiente**.
