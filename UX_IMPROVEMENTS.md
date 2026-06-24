# Mejoras de usabilidad (UX) — Plataforma de Compras

Documento que resume la mejora profunda de experiencia de uso y la nueva vista **Campañas y oportunidades**. El criterio guía: la plataforma debe **ayudar a decidir**, no solo mostrar datos. Cada pantalla responde *para qué sirve, qué mirar primero, qué significan los estados, qué acción tomar y qué pasa si no hago nada*.

---

## 1. Problemas de usabilidad detectados

- **Navegación plana:** 11 ítems sin agrupar; difícil ubicarse.
- **Dashboard tipo "resumen bonito":** mostraba KPIs pero no guiaba la acción ni priorizaba.
- **Estados sin explicación:** "crítico", "sobrestock" no decían qué hacer ni qué significan.
- **Recomendaciones incompletas:** se veía la cantidad sugerida pero no siempre el riesgo ni la acción concreta.
- **Detalle de producto sin conclusión:** mucha data, pero faltaba un "qué hacer" claro y arriba.
- **Alertas no accionables:** explicaban el problema pero no permitían resolverlo desde ahí.
- **Tablas como base de datos cruda:** sin orden por urgencia y sin ayuda para leerlas.
- **Estados vacíos pobres:** "Sin datos" sin explicar qué significa ni qué hacer.
- **Faltaba la mirada estratégica:** compras no podía anticipar campañas, liquidaciones ni crecimientos.

## 2. Cambios realizados

**Infraestructura UX reutilizable (nueva):**
- `HelpNote` — cajas de ayuda cortas (info / tip) con icono, en lenguaje de negocio.
- `Tooltip` — tooltips livianos sin dependencias.
- `StateLegend` — leyenda desplegable "¿Qué significa cada estado?".
- `PriorityGuide` — componente "Qué revisar primero" con conteo en vivo y orden por urgencia; marca en verde lo que está al día.
- `statusInfo.ts` — significado de cada estado y prioridad + orden de urgencia, fuente única de verdad.

**Por vista:**
- **Dashboard:** ahora es una *portada de decisiones*. Lidera con "Qué revisar primero" (dinámico), seguido de bloques accionables: Acciones urgentes, Riesgos de quiebre, Categorías que necesitan atención, Proveedores con problemas, Sobrestock relevante, OC a vigilar, y el nuevo bloque **Campañas y oportunidades**.
- **Reposición sugerida:** orden por urgencia por defecto (crítico → comprar ahora → revisar…), KPIs de los 5 estados (incluye margen bajo), `HelpNote` del cálculo, `StateLegend`, columna **Cobertura** en días con color, selección múltiple con acciones masivas y bloque de **presupuesto**.
- **Detalle de producto:** banner **"Decisión recomendada"** arriba, en una frase, con la acción a un clic (Comprar X a proveedor Y / No comprar por sobrestock / Asignar proveedor / Sin acción).
- **Alertas comerciales:** cada alerta trae **acción sugerida** ("Agregar a OC", "Revisar proveedor", "Ver producto", "Ver órdenes"), ayuda arriba y estado vacío útil.
- **Productos, Proveedores, Categorías, Inventario, Ventas, Órdenes:** `HelpNote` explicando qué mirar y qué significan los conceptos; estados vacíos con copy útil por contexto.

## 3. Navegación

Sidebar agrupado por flujo de trabajo, con subtítulos de sección y tooltips:
- **Inicio:** Dashboard
- **Gestión de compra:** Reposición sugerida · Campañas y oportunidades · Órdenes de compra · Proveedores
- **Catálogo:** Productos / SKUs · Categorías
- **Análisis:** Análisis de inventario · Análisis de ventas · Alertas comerciales
- **Configuración:** Reglas de compra

El mismo agrupamiento aplica en la navegación móvil.

## 4. Tablas

- Orden por columna (clic en encabezado, con indicador ▲▼) y **orden por urgencia por defecto**.
- Estados y prioridades como **badges** con color y significado consistente.
- Columnas secundarias se ocultan en pantallas chicas (`hideOnMobile`) para no saturar.
- Acciones claras al final de la fila ("Agregar a OC", "Ajustar", "Ignorar", "Ver producto").
- Filas críticas resaltadas; números en formato chileno (CLP, miles, %).
- Estados vacíos contextualizados por pestaña/filtro.

## 5. Recomendaciones

Cada recomendación comunica las 4 piezas: **qué** recomienda, **por qué** (motivo), **qué riesgo** hay y **qué acción** tomar. En el detalle, el banner "Decisión recomendada" lo resume en una frase con la acción a un clic. Las recomendaciones de campaña agregan canal, fecha del evento y brecha de stock.

## 6. Textos de ayuda

`HelpNote` corto en cada vista explicando conceptos en lenguaje de negocio (sobrestock, margen bajo, cumplimiento, lead time, cobertura). Sin saturar: una caja por pantalla, foco en "qué mirar primero" y "qué significa esto". `StateLegend` desplegable para los estados de reposición.

## 7. Cómo debe usar la plataforma un comprador

1. **Dashboard → "Qué revisar primero".** Atender de arriba hacia abajo; lo verde está al día.
2. **Reposición sugerida.** La tabla ya viene ordenada por urgencia: seleccionar los críticos y "Agregar a OC" (vigilar el presupuesto arriba).
3. **Campañas y oportunidades.** Antes de un evento: comprar lo que falte, liquidar lo que sobra, potenciar lo rentable y excluir lo riesgoso.
4. **Órdenes de compra.** Crear la OC desde el borrador y dar seguimiento (priorizar atrasadas).
5. **Alertas.** Resolver desde la acción sugerida de cada tarjeta.
6. **Detalle de producto** para entender un caso puntual: leer "Decisión recomendada" y actuar.

## 8. Mejoras futuras recomendadas

- Buscador global con resultados instantáneos (SKU/producto/proveedor) y salto directo.
- Filtros persistidos en la URL (volver atrás y compartir vistas).
- Exportar a Excel/PDF (Reposición, OC, Campañas, Liquidaciones).
- Simulador de reglas: ver el impacto en la compra sugerida al cambiar parámetros.
- Gráficos de tendencia reales cuando exista histórico por API.
- Multi-usuario con permisos por rol (comprador, jefe de categoría, gerencia).

---

# Vista nueva: Campañas y oportunidades

## Qué se agregó y para qué sirve
Una vista estratégica (`/campanas-oportunidades`, grupo *Gestión de compra*) para que el comprador **se anticipe** a campañas comerciales, liquidaciones, crecimientos de demanda y riesgos de quiebre, conectando compras con venta, marketing, eCommerce, marketplace y tienda física.

## Qué datos muestra
Cruza, por producto: tipo de oportunidad, canal, campaña y fecha, stock disponible, venta últimos 30 días, crecimiento vs período anterior, venta estimada de campaña, stock requerido, **brecha de stock**, compra sugerida, margen, estado, riesgo y acción recomendada.

- **KPIs:** productos en campaña, riesgo de quiebre, sugeridos para liquidar, crecimiento acelerado, venta estimada de campañas, compra sugerida para campañas, stock en riesgo y oportunidades de buen margen.
- **"Qué revisar primero"** con conteo en vivo.
- **Bloques especiales:** Campañas próximas, Riesgos de campaña, Crecimiento acelerado, Para liquidar y Oportunidades de alto margen.
- **Tabla accionable** ordenada por urgencia, con filtros (buscar, canal, tipo, estado, categoría, proveedor + chips de riesgo / crecimiento / liquidar / margen bajo).

## Qué decisiones ayuda a tomar
- Qué comprar **antes** de la campaña (y cuánto) para no perder venta.
- Qué productos **liquidar** por sobrestock o baja rotación.
- Qué productos están **creciendo** demasiado rápido y necesitan más stock.
- Qué productos **potenciar** (buen margen + stock) y por qué canal.
- Qué productos **no** conviene promocionar (sin stock, sin proveedor, margen bajo o proveedor atrasado).

## Estados de campaña
`Listo para campaña`, `Comprar antes de campaña`, `Riesgo de quiebre`, `Liquidar`, `Potenciar`, `Revisar margen`, `Revisar proveedor`, `No recomendado`.

## Canales
Web · Marketplace · Tienda física · Omnicanal · Venta empresa (B2B) · Redes sociales · Email marketing.

## Relación con compras, marketing, web, marketplace y tienda
La vista conecta visualmente con Reposición (Agregar a OC), Productos (Ver producto), Proveedores (Revisar proveedor) y Dashboard (bloque resumen). Las acciones "Potenciar en web/marketplace" y "Marcar para liquidación" representan el puente con marketing/eCommerce; "Venta empresa" con el canal B2B; "Tienda física" con la operación de salón.

## Endpoints futuros

```
GET   /purchasing/campaign-opportunities
GET   /purchasing/campaign-opportunities/:id
POST  /purchasing/campaign-opportunities/:id/add-to-purchase-order
PATCH /purchasing/campaign-opportunities/:id/status
GET   /purchasing/campaigns
GET   /purchasing/campaigns/:id/products
```

## Integraciones futuras
- **catalog-service:** producto, SKU, marca y categoría.
- **pricing-service:** precio, costo, margen.
- **inventory-service-v3:** stock disponible, comprometido y por tienda.
- **oms-service-v2:** venta histórica, demanda, venta perdida.
- **marketplace-service / integraciones marketplace:** performance por marketplace.
- **comerce-service:** canales, tiendas, plataformas y configuración comercial.
- **notification-service:** alertas por riesgo de quiebre antes de campaña.
- **trace-service:** trazabilidad de decisiones del comprador.
- **document-generator-service:** exportar campañas, liquidaciones u órdenes sugeridas.
