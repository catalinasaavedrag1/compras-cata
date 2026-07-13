# Módulo: Comprar

> Levantamiento funcional del workspace operacional de compra (**"Comprar"**) de la plataforma `compras-cata`.
> Documento construido **solo desde el frontend** (React + TypeScript, en español), con **datos mock** (sin backend real; existe un `apiClient` opcional detrás de `backendEnabled`, ver más abajo). Cuando algo no está definido por el código se marca como **Definición pendiente** o **Suposición**.

---

## Contexto general del módulo

El módulo "Comprar" es la cadena operativa completa que lleva una **necesidad de reposición** hasta la **recepción física** de la mercadería. Se apoya en varias piezas transversales que conviene entender antes de las pantallas:

- **Borrador de OC global (`OcDraftContext`)**: es un **carrito único** de líneas de compra que persiste en `localStorage` (`compras:oc-draft` y `compras:oc-draft-meta`). Casi todas las pantallas del módulo (Reposición, Temporada, Cotizaciones, Recepciones) "agregan" productos a este mismo borrador. La cabecera del borrador (bodega destino, condición de pago, fecha esperada, observaciones) también es global. El contador aparece en el Topbar.
  - `addItem` **no duplica**: si el SKU ya está, se ignora (por eso los botones muestran "En borrador"/"En OC").
  - Total de línea = `cantidad × costo × (1 − descuento%)` (`lineNet`).
- **`PurchaseFlowContext`**: mantiene `approvals` (solicitudes de aprobación), `approvalState` (pendiente/aprobada/rechazada) y `decisions` (historial). Se alimenta al crear OC con desvíos.
- **`RoleContext`**: dos roles, `"comprador"` y `"lider"`. El rol se cambia desde arriba a la derecha (fuera de estas pantallas).
- **`BuyerContext`**: comprador activo y lista de compradores.
- **Barra de proceso (`PurchaseProcessBar`)**: cinta superior con las etapas del ciclo (Necesidad → Preparación → Borrador → Retiro → Aprobación → Órdenes/Emitidas → Por recibir), cada una con su contador y enlace. Aparece en Reposición y en Órdenes de compra.
- **Persistencia mock**: RFQs, órdenes creadas y cambios de estado se guardan en `localStorage`, no en servidor. `backendEnabled` (en `apiClient`) permite un POST opcional al crear OC, pero por defecto el flujo es 100% local/mock.
- **Fecha "hoy" de la demo**: `TODAY_ISO` (constante mock) — todos los cálculos de vencimiento y atraso se miden contra esa fecha simulada, no contra la fecha real del sistema.

---

# Pantalla 1 · Reposición / Decisiones de compra

## Nombre
Decisiones de compra / Reposición (`ReplenishmentPage`).

## Ruta(s)
- `/comprar/decisiones`
- `/comprar/reposicion`
- `/reposicion`

El **título cambia según la ruta**: si la URL contiene `/comprar/reposicion` el título es **"Reposición"**; en cualquier otro caso, **"Decisiones de compra"**.

## Módulo
Comprar — primera etapa ("Necesidad: decidir qué comprar").

## Objetivo funcional
Priorizar las necesidades de reposición, revisar las recomendaciones de compra generadas por el sistema (con su razonamiento) y construir las próximas órdenes agregando SKUs al borrador de OC, todo controlando el presupuesto del mes.

## Tipo de usuario
Comprador (uso principal). El líder también puede acceder; no hay restricción de rol explícita en esta pantalla. **Suposición**: pensada para el comprador operativo.

## Descripción detallada
Pantalla central del comprador. Aplica sobre las recomendaciones base (`mockRecommendations`) los **overrides** guardados por el usuario (cantidad, monto, proveedor — `localStorage: compras:rec-overrides`) y oculta las sugerencias **ignoradas** (`compras:rec-ignored`). Muestra un bloque de presupuesto, una tarjeta de "prioridad destacada", segmentación por foco, tres modos de vista (producto / proveedor / categoría), filtros, acciones masivas y dos drawers/modales de detalle.

## Información que muestra
- **Presupuesto del mes**: total sugerido (suma de `suggestedPurchaseAmount` de lo visible) vs `monthlyPurchaseBudget` (mock = 28.000.000), % usado, disponible o exceso, barra de color (verde/ámbar/rojo según <80% / >80% / sobregiro) y **necesidades críticas no cubiertas**.
- **Prioridad destacada**: la recomendación más urgente (primer crítico/comprar-ahora, o la primera visible) con métricas (stock, cobertura, venta 30d, lead time), decisión sugerida y escenarios rápidos (Conservador 0,7× / Sugerido / Agresivo 1,3×).
- **"Continuar trabajo"**: tarjeta que aparece si el borrador tiene ≥1 SKU.
- **Resumen de la barra de foco**: nº de decisiones e impacto total; nota "Cantidad sugerida = lead time + cobertura objetivo"; alertas de margen y ahorro por sobrestock.
- **Tabla de recomendaciones** (o tarjetas agrupadas).

Por fila (columnas): Producto (nombre, SKU, marca, proveedor + lead time, categoría); Stock disponible + comprometido; Cobertura (días, con barra y color); Venta 30d/90d + tendencia %; Cantidad sugerida (+ cobertura resultante y múltiplo de compra); Capital; Prioridad + etiqueta de decisión; OC abierta (badge si existe OC activa para el SKU); Acción (Revisar / Agregar).

## Secciones/bloques
1. `PageHeader` con acciones (Exportar, Ver borrador OC).
2. `PurchaseProcessBar` (6 etapas).
3. Bloque de presupuesto del mes.
4. Tarjeta "Prioridad destacada" (condicional).
5. Tarjeta "Continuar trabajo" (condicional a borrador > 0).
6. Barra de foco/segmentos + control de vista + botón "Revisar y preparar N urgentes".
7. `FilterBar` (búsqueda, selects, toggles).
8. Aviso de sugerencias ignoradas (condicional).
9. Barra de acciones masivas (sticky, condicional a selección).
10. Tabla de productos **o** tarjetas agrupadas por proveedor/categoría.
11. Drawer de decisión (`RecommendationDecisionDrawer`).
12. Modal "Ajustar sugerencia".

## Filtros disponibles
- **Foco / segmentos (Tabs)**: Todos · Comprar ahora (crítico/buy_now) · Revisar · No comprar (sobrestock). Persistido en URL (`foco`).
- **Búsqueda** por SKU o producto (URL `q`).
- **Select Categoría** (URL `cat`).
- **Select Proveedor** (URL `prov`).
- **Select Estado**: Crítico / Comprar ahora / Revisar / Normal / Sobrestock (URL `estado`).
- **Select Prioridad**: Alta / Media / Baja (URL `prioridad`).
- **Toggles**: Con quiebre · Riesgo de quiebre · Sobrestock · Margen bajo · Alta rotación · Baja rotación (estado local, no en URL).
- **Modo de vista** (`SegmentedControl`): Producto / Proveedor / Categoría.
- Botón **"Limpiar filtros"** (resetea todo, incluido foco).

## Acciones del usuario
- **Exportar** el listado filtrado a CSV (`ExportButton`, columnas SKU, producto, categoría, marca, proveedor, stock, venta 30d, días inventario, cantidad sugerida, costo, compra sugerida, margen, prioridad, estado, motivo).
- **Ver borrador OC** → `/comprar/borradores`.
- **Optimizar presupuesto** → fija foco en "urgent".
- **Agregar N u. al borrador** desde tarjeta destacada, tabla o drawer.
- **Revisar** una recomendación → abre el drawer de decisión.
- **Revisar y preparar N urgentes** → foco urgente + vista por proveedor.
- **Seleccionar filas** (checkbox) → habilita acciones masivas.
- **Acciones masivas**: Revisar por proveedor · Crear borradores (agrega los seleccionados al borrador de OC, con conteo por proveedor) · Ignorar · Limpiar selección.
- **Ajustar sugerencia** (modal): cambiar cantidad y proveedor → guarda override.
- **Ignorar / Postergar** una sugerencia (drawer o masivo); **Restaurar** todas las ignoradas.
- **Ver SKU 360** → `/productos/{sku}`.
- En el drawer: **Modificar cantidad**, **Comparar proveedores** (ambos abren el modal de ajuste), **Ver OC relacionada** → `/comprar/seguimiento?oc={numero}`, y simular escenarios/sensibilidad.

## Botones y controles
Botones: Exportar, Ver borrador OC, Optimizar presupuesto, Agregar (primario), Revisar (secundario), Revisar y preparar urgentes, Seleccionar SKU/Revisar grupo (en tarjetas agrupadas), acciones masivas, Guardar/Cancelar (modal). Controles: Tabs de foco, SegmentedControl de vista, FilterBar (input + selects + toggles), checkboxes de tabla, escenarios (chips/tarjetas), stepper de cantidad (−/+ múltiplo), input numérico y select en modal.

## Tablas / tarjetas / formularios / componentes relevantes
- **`DataTable`** de recomendaciones (con selección, ordenamiento, tarjeta móvil `RecommendationMobileCard`).
- **`GroupedDecisionCards`**: tarjetas por proveedor o categoría, con conteos crítico/revisar/no-comprar y badge de OC abierta.
- **`RecommendationDecisionDrawer`**: drawer de decisión muy completo:
  - Decisión sugerida + resumen del razonamiento + chips de perfil SKU (ABC, XYZ, velocidad de venta, margen).
  - Alertas inteligentes (`buildBuyingAlerts`).
  - Situación (stock, cobertura actual, venta 30d, forecast 30d, lead time, en tránsito).
  - Bloque "Abastecimiento en curso" si hay OC abierta (con ajuste del 40% si está atrasada).
  - Barra de cobertura objetivo (zona verde 45–60 d).
  - **Simular cantidad**: stepper por múltiplo; métricas cobertura total, capital, venta protegida, margen esperado, GMROI estimado, uso de presupuesto.
  - **Comparar escenarios**: Conservador / Recomendado / Agresivo.
  - **Razonamiento "por qué N u."**: factores de necesidad vs lo que ya se tiene, promoción si aplica.
  - **Demanda** (30d, prom. 90d, tendencia, forecast).
  - **Sensibilidad de demanda** (−20/0/+20%).
  - **Comparar proveedores** (tabla: proveedor, costo, lead time, total, cobertura).
- **Modal "Ajustar sugerencia"**.

### Campos del formulario "Ajustar sugerencia" (modal)
- **Cantidad sugerida (unidades)** — input numérico (min 0).
- **Proveedor** — select con todos los proveedores mock.
- Muestra costo unitario y total recalculado; texto del motivo.

## Estados posibles
- **Con datos**: estado normal (siempre hay recomendaciones mock). **Existe**.
- **Sin resultados** (filtros): la `DataTable` mostraría su mensaje vacío; con datos mock es alcanzable filtrando. **Existe** (vía filtros).
- **Vacía global** (sin recomendaciones): no ocurre con datos mock. La tarjeta destacada y la barra de presupuesto son condicionales, así que degradan bien, pero no hay `EmptyState` dedicado. **No aplica por datos mock**.
- **Cargando**: no hay spinner ni skeleton; los datos son síncronos. **No aplica**.
- **Error**: no hay manejo de error (sin fetch real). **No aplica**.

## Navegación hacia otras pantallas
`/comprar/borradores`, `/comprar/cotizaciones`, `/comprar/aprobaciones`, `/comprar/seguimiento` (incl. `?oc=`), `/comprar/recepciones`, `/comprar/decisiones`, `/comprar/plan-retiro` (vía barra de proceso en otras pantallas), `/productos/{sku}`.

## Flujo funcional completo
1. El comprador entra y ve el presupuesto, la prioridad destacada y la lista priorizada (orden por urgencia de estado → prioridad → monto).
2. Filtra/segmenta (foco, categoría, proveedor, toggles) para acotar.
3. Revisa una recomendación en el drawer: simula cantidad, compara escenarios/proveedores, entiende el "por qué N u.".
4. Ajusta cantidad/proveedor si corresponde (override persistente) o ignora la sugerencia.
5. Agrega SKUs al **borrador de OC** (individual, desde destacada, o en masa por selección/grupo).
6. Continúa hacia Borradores OC para formalizar.

## Reglas de negocio inferibles
- **Cantidad sugerida** cubre lead time + cobertura objetivo (rango objetivo 45–60 días marcado en la barra).
- **Múltiplo de compra** escalonado: ≥120 y múltiplo de 24 → 24; ≥100 → 20; ≥40 → 10; si no → 1.
- **Etiqueta de decisión**: sobrestock→"No comprar"; review→"Revisar margen" (margen<25) o "Revisar cantidad"; sin stock o crítico→"Comprar ahora"; cobertura ≤ 2× lead time → "Reponer"; si no → "Postergar".
- **Margen bajo** = margen < 25%.
- **Sobrestock**: exceso = `(availableStock − maxStock) × unitCost`; su reducción "libera" capital.
- **Necesidades críticas no cubiertas** = capital crítico − presupuesto disponible.
- **OC abierta**: se detecta si el SKU aparece en alguna OC en estado activo (draft, pending_approval, approved, sent, confirmed, partially_received, delayed). Si la OC está atrasada, en la simulación de cobertura solo se cuenta el **40%** de la cantidad en tránsito.
- Solo se pueden agregar SKUs con `suggestedQuantity > 0`; los ya presentes en el borrador no se re-agregan.

## Validaciones necesarias
- Cantidad no negativa (input `min=0`; el drawer usa `Math.max(0, …)`).
- No duplicar SKU en el borrador (garantizado por `OcDraftContext`).
- **Definición pendiente**: no hay validación de múltiplo/MOQ real al agregar desde la tabla (solo se sugiere en el drawer); no se bloquea agregar por sobre presupuesto (solo se advierte).

## Permisos/restricciones
Sin restricción de rol declarada. Overrides e ignorados son por navegador (localStorage), no por usuario/servidor.

## Dudas / definiciones pendientes
- El botón "Optimizar presupuesto" solo cambia el foco a urgentes; no ejecuta una optimización real. **Suposición**: placeholder.
- "Confianza recomendación" y GMROI son heurísticas de demo (fórmulas locales), no valores de negocio confirmados.
- El campo "Nombre/referencia" no existe aquí (existe en RFQ); nada persiste el motivo del override más allá del texto original.

---

# Pantalla 2 · Planificador de temporada

## Nombre
Planificador de temporada (`SeasonPlannerPage`).

## Ruta(s)
- `/comprar/temporada`

## Módulo
Comprar — planificación previa (compra por temporada, no reposición diaria).

## Objetivo funcional
Planificar la compra de una temporada completa: qué demanda se espera, de qué canal/origen viene, qué está comprometido, qué riesgo hay de comprar de más o de menos, comparar escenarios y generar propuestas de OC al borrador; además hacer seguimiento durante la temporada.

## Tipo de usuario
Comprador y líder (planificación). Sin restricción de rol explícita.

## Descripción detallada
Selector de temporada (`mockSeasons`) y de escenario (conservador/probable/agresivo). Calcula un plan por escenario (`planSeason`) y un seguimiento (`trackSeason`). Dos pestañas: **Planificación** y **Seguimiento**. El plan es totalmente derivado/mock (no editable línea a línea salvo generar propuestas).

## Información que muestra
- **Encabezado de temporada**: venta esperada (rango), ventana de compra, deadline OC (resaltado), lead time, presupuesto, crecimiento esperado; chips de categorías, canales y bodegas.
- **Pestaña Planificación**:
  - Recomendación en lenguaje natural (`seasonHeadline`).
  - **Resumen ejecutivo (KPIs)**: venta proyectada, compra propuesta (+unidades), margen esperado, presupuesto usado (%). MiniStats: inventario inicial, inventario final proyectado, riesgo de quiebre, nivel de servicio.
  - **Temporada anterior vs actual**: compra, venta, margen, quiebres, sobrestock (con color según mejora/empeora).
  - **Distribución de la demanda por origen**: barra segmentada (Confirmada, Histórica proyectada, Probable ponderada, Campañas, Stock estratégico) + demanda por canal/origen.
  - **Escenarios de compra**: comparador de 3 tarjetas (compra, venta potencial, margen, quiebre, sobrestock, presupuesto).
  - **Detalle por producto** (tabla).
- **Pestaña Seguimiento**: avance %, canal plan vs real (con `VarianceBadge`), alertas de la temporada + acciones, botones de replanificación (simulados), tabla de seguimiento por producto (plan/emitido/recibido/venta real/stock/pronóstico/estado).
- **Drawer de detalle de producto**: fórmula explicable de la compra sugerida (sumas/restas con total corriente), origen de la demanda, evolución semanal (barras), datos de compra (margen, rotación, lead time, ETA, múltiplo, MOQ, venta perdida estimada, costo), tránsito/transferible.

## Secciones/bloques
PageHeader (selector temporada + "Generar propuestas OC") → Tabs (Planificación / Seguimiento con contador de alertas) → Encabezado de temporada (común) → contenido por pestaña → Drawer de detalle.

## Filtros disponibles
- **Selector de temporada** (`Select`, no persiste en URL).
- **Selector de escenario** (tarjetas del comparador): conservador / probable / agresivo.
- **Pestañas**: Planificación / Seguimiento.
- No hay búsqueda ni filtros de tabla.

## Acciones del usuario
- Cambiar temporada y escenario.
- **Generar propuestas OC**: agrega al borrador de OC todos los productos con `suggested > 0` del escenario activo (avisa cuántos y cuánto, y cuántos ya estaban).
- Abrir el detalle de un producto (fila) en el drawer.
- Cambiar de pestaña; en Seguimiento, ejecutar acciones de replanificación (solo muestran toast "simulada").

## Botones y controles
Select de temporada; botón "Generar propuestas OC"; Tabs; tarjetas de escenario (botón-selector); filas de tabla clicables; botones de replanificación (secundarios, simulados).

## Tablas / tarjetas / formularios / componentes relevantes
- **Tabla de productos (plan)**: Producto (nombre, SKU, categoría), Demanda, Stock, Tránsito, Compra sugerida, Cobertura post, Confianza (badge), Riesgo (badge). Fila roja si `alto_quiebre`.
- **Tabla de seguimiento**: Producto, Plan, Emitido, Recibido, Venta real, Stock, Pronóstico actual, Estado (Quiebre ~S# / Sobre máx. / Atraso Nd / En línea).
- **KpiCard / MiniStat / CompareCell / OriginBar / ScenarioComparator / ProductDetail / SeasonTrackingView**.
- **No hay formularios de entrada** (solo selección); el detalle es de lectura.

### Campos de formulario
No aplica (no hay formularios editables; solo selectores). El plan no se edita línea a línea en esta pantalla.

## Estados posibles
- **Con datos**: normal (hay temporadas mock).
- **Sin resultados en tabla**: la `DataTable` de plan tiene `emptyMessage` "No hay productos en las categorías de esta temporada"; la de seguimiento, "Sin productos en seguimiento". **Existe** el mensaje, alcanzable si una temporada no tuviera productos.
- **Seguimiento sin alertas**: mensaje "Sin desvíos relevantes: la temporada va en línea". **Existe**.
- **Vacía global / Cargando / Error**: no hay (datos síncronos mock). **No aplica**.

## Navegación hacia otras pantallas
`/comprar/borradores` (tras generar propuestas). No usa `PurchaseProcessBar` aquí. El detalle de producto **no** enlaza a SKU 360 en esta pantalla (a diferencia de Reposición).

## Flujo funcional completo
1. Elegir temporada y revisar deadlines/ventana de compra.
2. Leer resumen ejecutivo y comparación con temporada anterior.
3. Entender el origen de la demanda (seguro vs incierto).
4. Elegir escenario (conservador/probable/agresivo) según apetito de riesgo/presupuesto.
5. Revisar detalle por producto (fórmula y evolución semanal).
6. **Generar propuestas OC** → borrador.
7. Durante la temporada, usar la pestaña Seguimiento para ver desvíos y replanificar.

## Reglas de negocio inferibles
- Compra sugerida por producto = demanda de temporada − stock − tránsito − transferible (± ajustes), redondeada a múltiplo (`ProductDetail` muestra la fórmula).
- Escenarios ajustan agresividad de la demanda (conservador/probable/agresivo) impactando compra, cobertura y riesgos.
- Presupuesto usado > 100% se marca en rojo; riesgo de quiebre > 15% en rojo; nivel de servicio ≥ 95% ok.
- Deadline de OC es un hito duro (resaltado). **Suposición**: no comprar antes del deadline arriesga la temporada.
- Varianza por canal: >+8% azul, <−8% ámbar, en rango verde.

## Validaciones necesarias
No hay entradas que validar. **Definición pendiente**: al "Generar propuestas OC" no se controla presupuesto de temporada ni MOQ antes de agregar.

## Permisos/restricciones
Ninguna declarada por rol.

## Dudas / definiciones pendientes
- Las acciones de replanificación son **placeholders** (solo toast "simulada").
- No queda claro si "Seguimiento" debería estar disponible para temporadas futuras (usa datos mock igualmente).

---

# Pantalla 3 · Cotizaciones (RFQ)

## Nombre
Cotizaciones (`RfqPage`).

## Ruta(s)
- `/comprar/cotizaciones`
- `/cotizaciones`

## Módulo
Comprar — etapa "Preparación" (cotizar y negociar).

## Objetivo funcional
Solicitar cotizaciones (RFQ) a proveedores, comparar precio/plazo/mínimo lado a lado por línea, negociar/aprobar y convertir la mejor oferta en líneas del borrador de OC.

## Tipo de usuario
Comprador (crea RFQ; `comprador` de la RFQ = `buyer` activo). Sin restricción de rol dura.

## Descripción detallada
Lista de RFQs combinando las creadas por el usuario (`localStorage: compras:rfq`) con las semilla (`mockRfq`), aplicando overrides de estado (`compras:rfq-status`). KPIs por estado, pestañas por estado, tabla y dos overlays: modal de creación y drawer de comparación.

## Información que muestra
- **KPIs**: Por responder (enviadas + parciales), En negociación, Por vencer (≤7 días, entre estados abiertos), Convertidas a OC. Algunos KPIs son clicables y cambian la pestaña.
- **Tabla**: N° cotización + comprador; Fecha / Vencimiento (marca "vence en N días" si abierta y ≤7d); Productos (nº líneas); Proveedores (invitados + cuántos respondieron); Estado (badge); acción "Comparar"/"Ver detalle".
- **Drawer de comparación**: estado, proveedores invitados (con marca de sin respuesta), y por cada línea una tabla comparativa con "Mejor precio" y "Más rápido" resaltados y nota de trade-off; `EmptyState` si aún sin respuestas.

## Secciones/bloques
PageHeader ("Nueva cotización") → KPIs → Tabs por estado → Tabla → Modal de creación → Drawer de comparación.

## Filtros disponibles
- **Pestañas por estado**: Todas · Borrador · Enviadas · Respondidas (respondida + parcial) · En negociación · Aprobadas (aprobada + convertida). Con contadores.
- KPIs "Por responder", "En negociación", "Convertidas" actúan como accesos rápidos a pestañas.
- No hay búsqueda de texto ni selects en la lista.

## Acciones del usuario
- **Nueva cotización** (modal).
- Abrir detalle/comparación (fila o enlace).
- **Marcar en negociación** (desde estados respondida/parcial).
- **Aprobar** (si tiene respuestas y no está aprobada/convertida).
- **Convertir a OC**: agrega la **oferta más barata disponible** de cada línea al borrador (cantidad = máx entre solicitado y mínimo de compra), y marca la RFQ como "convertida".

## Botones y controles
Botón "Nueva cotización"; KPIs clicables; Tabs; enlaces "Comparar/Ver detalle"; en drawer: Cerrar, Marcar en negociación, Aprobar, Convertir a OC; en modal: Cancelar, Crear cotización.

## Tablas / tarjetas / formularios / componentes relevantes
- `DataTable` de RFQs (con tarjeta móvil).
- `ComparisonDrawer` + `LineComparison` (tabla por línea).
- `CreateRfqModal`.

### Campos del formulario "Nueva cotización (RFQ)"
- **Nombre / referencia (opcional)** — texto. (Nota: se captura pero **no** se guarda en el objeto RFQ creado — **Definición pendiente/observación**.)
- **Productos a cotizar** — buscador por SKU/nombre (`mockProducts`, muestra hasta 8) con selección múltiple (checkboxes) y chips de seleccionados. `qtyRequested` de cada línea = `max(reorderPoint, 1)`.
- **Proveedores a invitar** — chips seleccionables de `mockSuppliers` (múltiple).
- **Fecha de vencimiento** — date (default `2026-07-08`).
- Se crea siempre en estado **borrador**; N° generado `COT-2026-####` / id `RFQ-2026-####` (secuencia según nº de creadas). Requiere ≥1 producto y ≥1 proveedor (`canSave`).

## Estados posibles
- **Con datos**: normal.
- **Sin resultados** (pestaña sin RFQs): `emptyMessage` "No hay cotizaciones en esta vista. Crea una nueva…". **Existe**.
- **Drawer sin respuestas**: `EmptyState` "Aún sin respuestas". **Existe**.
- **Línea sin cotizar**: texto "Ningún proveedor cotizó esta línea". **Existe**.
- **Cargando / Error**: no hay. **No aplica** (mock).

## Navegación hacia otras pantallas
`/comprar/borradores` (tras convertir). No hay barra de proceso en esta pantalla.

## Flujo funcional completo
Crear RFQ (borrador) → (mock: llegan respuestas en las semillas) → comparar ofertas por línea → marcar en negociación / aprobar → convertir a OC (líneas al borrador) → seguir en Borradores OC.

## Reglas de negocio inferibles
- **Convertible** solo si estado ∈ {respondida, respondida_parcial, en_negociación, aprobada} y hay respuestas.
- **Aprobar** disponible salvo que ya esté aprobada/convertida y siempre que existan respuestas.
- **Por vencer** = estado abierto (enviada/parcial/respondida/negociación) y 0–7 días para el vencimiento.
- Al convertir, se elige la oferta **más barata disponible** por línea; la cantidad respeta el **mínimo de compra** del proveedor.
- Estados posibles de una RFQ: borrador, enviada, respuesta parcial, respondida, en negociación, aprobada, rechazada, vencida, convertida a OC.

## Validaciones necesarias
- Crear requiere ≥1 producto **y** ≥1 proveedor (botón deshabilitado si no).
- **Definición pendiente**: no valida que la fecha de vencimiento sea futura; el "Nombre/referencia" no se persiste; no hay envío real al proveedor (el paso "enviada" no tiene acción en UI, solo existe como estado en semillas).

## Permisos/restricciones
`comprador` de la RFQ se toma del `BuyerContext`. Sin restricción de rol para crear/convertir. **Suposición**: cualquier comprador gestiona las suyas; no hay filtro por comprador aquí (a diferencia de OC y Recepciones).

## Dudas / definiciones pendientes
- No existe una acción "Enviar cotización" (de borrador→enviada) en la UI; **Definición pendiente**.
- Las respuestas de proveedores son mock (no hay captura manual de ofertas).

---

# Pantalla 4 · Borradores OC / Órdenes / Seguimiento

## Nombre
Órdenes de compra (`PurchaseOrdersPage` + `PurchaseOrdersSections`). Una misma pantalla sirve **tres vistas** según la ruta/pestaña.

## Ruta(s)
- `/comprar/borradores` (pestaña inicial "Borradores")
- `/comprar/ordenes` (pestaña "Todas")
- `/ordenes-compra` (título "Órdenes de compra"; soporta deep-link `?oc=OC-XXXX`)
- `/comprar/seguimiento` (pestaña "En curso")

El **título y la descripción cambian por ruta**: "Comprar · Borradores OC", "Comprar · Órdenes", "Comprar · Seguimiento" u "Órdenes de compra".

## Módulo
Comprar — etapas "Borrador", "Órdenes/Emitidas" y "Seguimiento".

## Objetivo funcional
Construir la orden de compra desde el borrador global (por proveedor), revisar restricciones antes de formalizar, generar las OC, y luego consultar/gestionar las órdenes emitidas (estados, atrasos, entregas parciales, detalle, historial).

## Tipo de usuario
Comprador (ve **solo sus** OC) y líder (ve las de **todo el equipo**). Filtro por `buyerName` según rol.

## Descripción detallada
Combina órdenes creadas por el usuario (`localStorage: compras:po-created`) con las semilla (`mockPurchaseOrders`, vía `useCollection`), aplicando overrides de estado (`compras:po-status`) y un **estado derivado de aprobación** (una OC "por aprobar" pasa a "aprobada" cuando todas sus solicitudes `APR-{numero}-*` quedan aprobadas). El **editor del borrador** es un `Drawer` que lee el `OcDraftContext`.

## Información que muestra
- **`PurchaseProcessBar`** de 8 etapas (incluye Retiro y Órdenes).
- **Aviso** de borrador recién creado (número(s)).
- **Tarjeta "Compra en curso"** (si borrador > 0): proveedor principal (o "N proveedores"), nº SKU, total, cobertura futura promedio; resumen inline del plan de retiro; métricas (Presupuesto disp. OTB → enlaza a `/presupuesto`, cobertura futura, SKU críticos, valor OC); **Observaciones antes de formalizar** (OC abiertas solapadas, cantidades sobre recomendación, cobertura > 90 días, sobre OTB por categoría).
- **KPIs**: Monto en curso, Atrasadas, Borradores, Total OC (clicables → pestaña).
- **Tabla de OC**: N° OC + comprador; Proveedor (enlace a ficha); Creación/Esperada; SKUs; Bodega destino; Monto total; Atraso (badge días); Estado (`StatusBadge`); "Ver detalle". Fila roja si atrasada.

## Secciones/bloques
PageHeader (+ InfoHint "ciclo de una OC") → ProcessBar → aviso creado → tarjeta compra en curso → KPIs → Tabs + DateRangePicker → Tabla → **Drawer editor de borrador** → **Modal de detalle de OC** (`OcDetailModal`).

## Filtros disponibles
- **Pestañas**: Todas · Borradores · En curso (sent/confirmed/partially_received/with_difference) · Atrasadas · Recibidas (received/closed). Con contadores.
- **KPIs** como accesos rápidos.
- **Rango de fechas** por fecha de creación (`DateRangePicker`).
- **Deep-link** `?oc=` abre el detalle.
- No hay búsqueda de texto en la lista.

## Acciones del usuario
- **Nuevo borrador de OC** → abre el Drawer editor (badge con el conteo del carrito).
- En el editor:
  - **Buscar y agregar** cualquier producto (`mockProducts`, ≥2 caracteres, hasta 8).
  - Editar la cabecera (bodega, condición de pago, fecha esperada, observaciones).
  - **Analizar línea** (`DraftLineContext`): pestañas Resumen/Inventario/Venta/Proveedor con métricas y edición de cantidad; "Ver SKU 360".
  - Editar por línea: cantidad, costo unitario, descuento %; eliminar línea.
  - Ver totales (subtotal, descuento, total) y aviso de nº de OC a generar (una por proveedor).
  - Ver **Plan de retiro en vivo** (`TruckOptimizer`, resumen, consejo) y saltar a `/comprar/plan-retiro`.
  - Agregar desde **"Sugerencias para agregar"** (recomendaciones no incluidas).
  - **Crear borrador / Crear N OC**: genera una OC por proveedor.
- En la tabla/detalle: **Ver detalle** (modal), **Marcar como enviada** (si draft/approved/confirmed), **Ver aprobaciones** (si pending_approval).

## Botones y controles
"Nuevo borrador de OC" (con badge), KPIs, Tabs, DateRangePicker, Drawer editor (input de búsqueda, selects de cabecera, textarea, inputs numéricos por línea, botón eliminar, botones Cerrar/Crear), Modal de detalle (Cerrar, Marcar como enviada, Ver aprobaciones).

## Tablas / tarjetas / formularios / componentes relevantes
- `DataTable` de OC (tarjeta móvil).
- **Drawer editor de borrador** (formulario principal).
- `DraftLineContext` (contexto por línea, con `LandedCostBreakdown`).
- **`OcDetailModal`**: datos (estado, comprador, fechas, confirmada proveedor, monto, nº SKUs, descuento, pago), comentarios, documentos, líneas (con diferencias de recepción si aplica), **factura asociada** (conciliada / con diferencia) e **historial/auditoría** (`buildOcAudit`). Aviso ámbar si `pending_approval`.

### Campos del formulario (editor de borrador de OC)
Cabecera (`OcDraftMeta`, global y persistente):
- **Bodega destino** — select (Centro de Distribución, Bodega Santiago, Bodega Norte, Bodega Sur, Tienda Central).
- **Condición de pago** — select (Contado, 15/30/60/90 días fecha factura).
- **Fecha esperada** — date (si vacía, se calcula hoy + 7 días al crear).
- **Observaciones** — textarea (notas proveedor/internas).

Por línea:
- **Cantidad** — numérico (min 0).
- **Costo unit.** — numérico (min 0).
- **Desc. %** — numérico (0–100).

## Estados posibles
- **Con datos**: normal.
- **Borrador vacío** (en el editor): `EmptyState` "El borrador está vacío" con acción "Ir a reposición". **Existe**.
- **Sin resultados** (pestaña/tabla): `emptyMessage` específico por pestaña (atrasadas / borradores / genérico). **Existe**.
- **Detalle sin líneas**: texto "El detalle de líneas… no está disponible en la demo". **Existe** (por datos mock).
- **Cargando**: `useCollection` podría cargar de backend si estuviera habilitado; con mock es síncrono, sin spinner. **No aplica** (mock).
- **Error**: `apiCreate` captura y descarta errores silenciosamente (`.catch(() => {})`); no hay UI de error. **No aplica** (mock).

## Navegación hacia otras pantallas
`/comprar/decisiones`, `/comprar/cotizaciones`, `/comprar/borradores`, `/comprar/plan-retiro`, `/comprar/aprobaciones`, `/comprar/ordenes`, `/comprar/seguimiento`, `/comprar/recepciones` (barra de proceso); `/presupuesto` (OTB); ficha de proveedor (`supplierPath`); `/productos/{sku}`.

## Flujo funcional completo
1. Con el carrito lleno (desde Reposición/Temporada/RFQ/Recepciones), abrir el editor.
2. Completar cabecera y ajustar líneas (cantidad/costo/descuento); analizar cada línea; revisar plan de retiro.
3. Revisar observaciones (solapes, sobre-recomendación, cobertura alta, OTB).
4. **Crear**: se agrupan las líneas por proveedor → **una OC por proveedor**. Por cada línea se registra una **decisión** (`addDecision`) y, si se cumple algún criterio de desvío, una **solicitud de aprobación** (`addApproval`). La OC nace en `pending_approval` si tiene solicitudes, o `draft` si no.
5. Gestionar en las pestañas: marcar enviada, ver detalle/factura/historial, seguir atrasos y recepciones.

## Reglas de negocio inferibles
- **Una OC no mezcla proveedores**: el carrito se agrupa por `supplierName` y se genera una orden por grupo. Numeración `OC-2026-####` secuencial (base 143 + creadas + índice de grupo).
- **Criterios de aprobación** al crear (`ApprovalCriterion`): `desvio_sugerido` (sugerido=0 o |diff/sugerido|>20%), `monto_alto` (línea ≥ 5.000.000), `cobertura_excesiva` (cobertura resultante > objetivo × 1,3), `margen_bajo` (margen < mínimo de la regla). Cualquiera dispara solicitud de aprobación.
- **Objetivo de inventario** por producto viene de `resolveRuleForProduct` (default 45 días).
- **Estado derivado**: OC `pending_approval` → `approved` cuando todas sus solicitudes ligadas quedan aprobadas.
- **Visibilidad por rol**: comprador ve solo `buyerName === buyer`; líder ve todas. Al crear como líder, `buyerName` se fija a "Catalina Saavedra" (mock).
- Estados de OC (labels): Borrador, Por aprobar, Aprobada, Enviada, Confirmada, Parcial, Recibida, Con diferencia, Cerrada, Atrasada, Cancelada.
- **Marcar como enviada** permitido desde draft/approved/confirmed.
- Descuento efectivo de la OC = (bruto − neto)/bruto.

## Validaciones necesarias
- No crear con carrito vacío (`count === 0` deshabilita).
- Cantidad/costo ≥ 0; descuento 0–100 (acotado en inputs).
- **Definición pendiente**: no se **bloquea** crear una OC que supere el OTB o con líneas fuera de criterio — solo se advierte y se enruta a aprobaciones. No se valida MOQ ni múltiplo al crear.

## Permisos/restricciones
Filtro por comprador/rol (arriba). Aprobar/rechazar **no** ocurre aquí (solo se enruta a Aprobaciones). Marcar enviada sin restricción de rol declarada.

## Dudas / definiciones pendientes
- ¿Debería el comprador poder "Marcar como enviada" una OC `pending_approval`? El código solo lo permite tras aprobación (draft/approved/confirmed). Consistente, pero conviene confirmar el flujo exacto post-aprobación (¿aprobada→enviada manual?).
- `useCollection`/`apiCreate` implican un backend opcional no activo por defecto — confirmar si se usará.

---

# Pantalla 5 · Aprobaciones de compra

## Nombre
Aprobaciones de compra (`ApprovalsPage`).

## Ruta(s)
- `/comprar/aprobaciones`
- `/aprobaciones`

## Módulo
Comprar — etapa "Aprobación" (validar desvíos).

## Objetivo funcional
Revisar las compras que se salen de criterio (monto, cobertura, margen, proveedor o muy distintas al sugerido), con la justificación del comprador, y **aprobar o rechazar** dejando trazabilidad.

## Tipo de usuario
- **Comprador**: solicita/justifica y ve **solo sus** solicitudes; **no** puede aprobar.
- **Líder**: ve las de todo el equipo y **aprueba/rechaza** (y puede revertir a pendiente).

## Descripción detallada
Lista de solicitudes (`PurchaseFlowContext.approvals`) con su estado (`approvalState`). Flujo de roles explícito: "el comprador solicita, el líder aprueba". Sin datos base propios: las solicitudes provienen de la creación de OC con desvíos (o de semillas del contexto).

## Información que muestra
- **KPIs**: Pendientes, Monto en aprobación, Aprobadas, Total solicitudes.
- **Filtros de estado** (chips): pendiente / aprobada / rechazada / todas.
- **Tarjeta por solicitud**: producto (enlace a SKU), badge de estado si resuelta, fecha + comprador + proveedor (enlace), monto; **criterios** (badges); Sugerido→Solicitado (con % de desvío); Cobertura resultante vs objetivo; Margen vs mínimo; Costo unitario; **Justificación del comprador**; acciones según rol/estado.

## Secciones/bloques
PageHeader (+ InfoHint) → KPIs → filtros de estado → lista de tarjetas (o `EmptyState`).

## Filtros disponibles
- **Estado**: pendiente (default) / aprobada / rechazada / todas.
- Filtro implícito por **rol/comprador** (comprador ve solo las suyas).

## Acciones del usuario
- (Líder) **Aprobar** / **Rechazar** una solicitud pendiente; **Revertir a pendiente** una resuelta.
- (Comprador) Solo lectura; ve un aviso de que se requiere rol Líder.
- Navegar a la ficha del producto o del proveedor.

## Botones y controles
Chips de filtro; botones Aprobar (primario) / Rechazar (secundario); enlace "Revertir a pendiente"; aviso bloqueado (candado) para comprador.

## Tablas / tarjetas / formularios / componentes relevantes
Tarjetas (`Card`) por solicitud; `KpiCard`; `EmptyState`; badges de criterio (`CRITERION_LABEL`). **No hay formulario** en esta pantalla (la justificación se captura al crear la OC; aquí llega como texto "Pendiente de justificar por el comprador" por defecto).

### Campos de formulario
No aplica (no hay entrada editable). La justificación se muestra pero no se edita aquí. **Definición pendiente**: dónde/cómo edita el comprador su justificación (hoy nace fija).

## Estados posibles
- **Con datos**: cuando existen solicitudes (creadas al generar OC con desvíos o desde semillas).
- **Sin solicitudes** (estado/filtro vacío): `EmptyState` "Sin solicitudes". **Existe**.
- **Vacía real**: si nunca se generó un desvío y no hay semillas, la lista está vacía → mismo `EmptyState`. **Existe**.
- **Cargando / Error**: no hay (estado en memoria/localStorage). **No aplica**.

## Navegación hacia otras pantallas
`/productos/{sku}`, ficha de proveedor. Llega desde OC (aviso, botón "Ver aprobaciones") y desde la barra de proceso.

## Flujo funcional completo
1. Al crear una OC con líneas fuera de criterio se generan solicitudes (`APR-{numero}-{idx}`).
2. El comprador ve sus solicitudes pendientes (bloqueadas para aprobar).
3. El líder revisa criterios, desvío, cobertura, margen y justificación; **aprueba o rechaza**.
4. Al aprobarse todas las solicitudes de una OC, esa OC pasa a "aprobada" (estado derivado en la pantalla de Órdenes).

## Reglas de negocio inferibles
- Solo el **líder** aprueba/rechaza/revierte (`canApprove = role === "lider"`).
- Criterios etiquetados: desvío vs sugerido, monto alto, cobertura excesiva, margen bajo (definidos al crear la OC).
- Desvío % = (solicitado − sugerido)/sugerido; cobertura resultante > objetivo×1,3 se resalta (violeta); margen < mínimo en rojo.
- La aprobación es la **compuerta** entre OC "por aprobar" y su emisión.

## Validaciones necesarias
Ninguna entrada que validar. La restricción clave es el **rol** para poder decidir.

## Permisos/restricciones
Comprador: solo lectura de las suyas. Líder: gestión total del equipo. El cambio de rol (arriba a la derecha) habilita/inhabilita las acciones.

## Dudas / definiciones pendientes
- La justificación real del comprador no tiene punto de captura visible (nace "Pendiente de justificar…"). **Definición pendiente**.
- No hay comentario del líder al rechazar (solo cambia estado + toast).

---

# Pantalla 6 · Plan de retiro

## Nombre
Plan de retiro (`PlanRetiroPage`).

## Ruta(s)
- `/comprar/plan-retiro`

## Módulo
Comprar — etapa logística "Retiro" (planificar transporte), previa a emitir la OC.

## Objetivo funcional
Simular cómo se retirará físicamente la mercadería del **borrador de OC actual**: camiones necesarios, capacidad, centros, fechas, costo logístico y alternativas, para decidir por **costo total de abastecimiento** y no solo por precio de compra.

## Tipo de usuario
Comprador (arma el borrador). Sin restricción de rol.

## Descripción detallada
No es un módulo aparte: **lee el mismo borrador de OC** (`OcDraftContext`) y delega toda la vista a `LogisticsPlanView` con las líneas del carrito. Si el carrito está vacío, muestra un `EmptyState`.

## Información que muestra
- Con borrador: nota de ayuda (nº SKU y total del borrador) + **`LogisticsPlanView`** (detalle por camión, capacidad, centros, fechas, costo y alternativas — componente de negocio).
- Sin borrador: `EmptyState` explicativo.

## Secciones/bloques
PageHeader (+ "Volver al borrador") → `HelpNote` → `LogisticsPlanView` **o** `EmptyState`.

## Filtros disponibles
Ninguno.

## Acciones del usuario
- **Volver al borrador** → `/comprar/borradores`.
- (Sin borrador) **Ir a borradores**.
- Interacciones internas del `LogisticsPlanView` (optimización de camiones) — detalle en el componente de logística, no en esta página.

## Botones y controles
"Volver al borrador" (header); "Ir a borradores" (empty state). El resto son controles del componente logístico.

## Tablas / tarjetas / formularios / componentes relevantes
`LogisticsPlanView` (y su familia `usePickupPlan`, `TruckOptimizer`, `LogisticsSummary`, `LogisticsAdvice`, reutilizados también en el editor de OC). Sin formularios propios.

## Estados posibles
- **Con datos** (borrador > 0): muestra el plan.
- **Vacía** (borrador = 0): `EmptyState` "No hay una compra en curso". **Existe**.
- **Sin resultados / Cargando / Error**: no aplican (derivado del carrito, síncrono). **No aplica**.

## Navegación hacia otras pantallas
`/comprar/borradores`.

## Flujo funcional completo
Con un borrador armado, el comprador revisa el plan de transporte (camiones/costo) para decidir por costo total antes de formalizar la OC; vuelve al borrador para ajustar.

## Reglas de negocio inferibles
- El plan se recalcula en vivo con las líneas del borrador (mismo `usePickupPlan` del editor de OC).
- Enfatiza "costo total de abastecimiento" (compra + logística), relevante en materiales de construcción.
- El nº de camiones y alertas alimentan la etapa "Retiro" de la barra de proceso.

## Validaciones necesarias
Ninguna (no hay entradas en esta página).

## Permisos/restricciones
Ninguna declarada.

## Dudas / definiciones pendientes
- La lógica fina de capacidad/costo/fechas vive en `LogisticsPlanView` (fuera del alcance de estos archivos); confirmar reglas de optimización si se requiere detalle.

---

# Pantalla 7 · Recepciones

## Nombre
Recepciones (`ReceptionsPage` + `receptions/ReceptionDetail`).

## Ruta(s)
- `/comprar/recepciones`
- `/recepciones` (soporta deep-link `?rid=REC-XXX`)

## Módulo
Comprar — etapa final "Por recibir / Recepción".

## Objetivo funcional
Ver qué mercadería viene en camino, qué llegó, y sobre todo **qué SKUs el proveedor no despachó** para reordenarlos (que no queden como "ya comprados" y terminen en quiebre). Para el líder, además, quién es responsable de reordenar y qué proveedores no cumplen.

## Tipo de usuario
- **Comprador**: ve **solo sus** recepciones; aterriza en "Por llegar".
- **Líder**: visión global del equipo, puede cambiar el alcance (todo el equipo / un comprador); aterriza en "No despachado".

## Descripción detallada
Lista de recepciones (`mockReceptions`) filtrada por alcance (rol/comprador), texto, proveedor y rango de fechas. Las KPIs actúan como **selector de vista** (tabs implícitos). La vista "No despachado" es especial: agrupa **líneas faltantes** por proveedor (y, para el líder, por comprador responsable) con acción de reordenar. Las demás vistas muestran la tabla de recepciones.

## Información que muestra
- **KPIs/selector**: No despachado (SKUs no enviados), Por llegar (in_transit/scheduled), Atrasadas, Con problemas (with_issues/partial), Recibidas.
- **Línea de contexto**: qué vista y cuántos resultados; alcance (líder).
- **Vista "No despachado"**: bloque "Responsables de reordenar" (líder, agrupado por comprador) + tarjetas por proveedor con rendimiento (`supplierFulfillment`: fill rate, cumplimiento a tiempo, rating) y líneas faltantes (SKU, estado de línea, pedido/recibido, faltante, botón Reordenar).
- **Vista tabla**: Orden/Proveedor (+ comprador o bodega), Esperada/Recibida, barra de Recepción (recibido/esperado + SKUs sin despachar), Calidad (Conforme/Con observación), Estado (badge), "Ver detalle".
- **Drawer de detalle** (`ReceptionDetail`): impacto (SKUs bajo cobertura mínima), fechas/estado, rendimiento del proveedor, nota de calidad, detalle por producto (pedido/recibido/faltante, incidencia, cobertura, reordenar), y footer "Reordenar todo lo no despachado".

## Secciones/bloques
PageHeader → (líder) Select de alcance → `FilterBar` → KPIs → línea de contexto → **vista "No despachado"** (HelpNote + responsables + por proveedor) **o** tabla (HelpNote + `DataTable`) → Drawer de detalle.

## Filtros disponibles
- **Alcance** (solo líder): Todo el equipo / Mis recepciones / un comprador específico (URL `alcance`).
- **Vista** (KPIs): undelivered / arriving / delayed / issues / received / all (URL `tab`).
- **Búsqueda** por OC, proveedor o comprador (URL `q`).
- **Select Proveedor** (URL `prov`).
- **Rango de fechas** esperada/recibida (URL `desde`/`hasta`).
- Botón "Ver todas" y "Limpiar" filtros.

## Acciones del usuario
- Cambiar alcance/vista/filtros.
- Abrir detalle de una recepción (fila).
- **Reordenar** un SKU faltante → agrega al borrador de OC (cantidad = faltante; costo del producto mock). Aviso con enlace "Ver borrador OC" → `/comprar/seguimiento`.
- **Reordenar todo lo no despachado** (footer del drawer).
- (Líder) Saltar al alcance de un comprador desde "Responsables".
- Navegar a ficha de proveedor/producto.

## Botones y controles
Select de alcance; `FilterBar`; KPIs clicables; botón "Ver todas"; `CollapsibleSection` de responsables; botones "Reordenar"/"En OC"; Drawer con botón de reorden masivo.

## Tablas / tarjetas / formularios / componentes relevantes
`DataTable` de recepciones (tarjeta móvil); tarjetas por proveedor (vista no despachado); `CollapsibleSection` de responsables; `ReceptionDetail` (drawer). **Sin formularios de entrada** (las cantidades a reordenar se derivan del faltante).

### Campos de formulario
No aplica. La única "entrada" es la acción Reordenar, que usa la cantidad faltante calculada.

## Estados posibles
- **Con datos**: normal.
- **Sin SKUs no despachados** (vista undelivered): mensaje "Sin SKUs pendientes por despachar. 🎉". **Existe**.
- **Sin resultados** (tabla): `emptyMessage` "No hay recepciones en esta vista." **Existe**.
- **Detalle sin desglose por SKU**: texto "Esta recepción no tiene desglose por SKU." **Existe** (según datos mock).
- **Cargando / Error**: no hay. **No aplica** (mock).

## Navegación hacia otras pantallas
`/comprar/seguimiento` (tras reordenar), `/comprar/borradores` (implícito por el carrito), ficha de proveedor, ficha de producto.

## Flujo funcional completo
1. Ver por llegar / atrasadas / con problemas.
2. Detectar SKUs **no despachados** (vista dedicada), agrupados por proveedor y responsable.
3. Reordenar lo faltante al borrador de OC (individual o masivo).
4. (Líder) Identificar proveedores incumplidores y encargados a los que asignar la reposición.
5. Cerrar el ciclo volviendo a Borradores/Seguimiento con las nuevas líneas.

## Reglas de negocio inferibles
- **Estado de línea**: recibido ≥ esperado → Completo; recibido = 0 → No despachado; entre medio → Parcial.
- **Faltante** = esperado − recibido; solo cuenta en recepciones ya llegadas (received/partial/with_issues).
- **Impacto/riesgo de quiebre**: un SKU faltante está "en riesgo" si su cobertura actual ≤ max(7, lead time del proveedor).
- **Rendimiento del proveedor** (`supplierFulfillment`): fill rate, cumplimiento a tiempo, SKUs sin despachar históricos, rating con color; se advierte si no es "verde".
- **Reordenar** usa el costo del producto mock y no duplica si el SKU ya está en el borrador.
- **Alcance por rol**: comprador restringido a sus recepciones; líder puede ver todo o por comprador. Aterrizaje distinto por rol (líder → "No despachado", comprador → "Por llegar").
- Estados de recepción: Programada, En tránsito, Recibida, Parcial, Con problemas, Atrasada.
- Fecha de referencia para filtros = recibida si existe, si no la esperada.

## Validaciones necesarias
- No duplicar SKU en el borrador (garantizado).
- **Definición pendiente**: no hay confirmación explícita al reordenar (se agrega directo); no se valida contra OC abiertas del mismo SKU al reordenar.

## Permisos/restricciones
Alcance/visibilidad por rol y comprador (como en OC). No hay acción de "confirmar recepción" manual — las recepciones son mock (llegan con su estado). **Definición pendiente**: ¿el comprador registra recepciones o solo consulta?

## Dudas / definiciones pendientes
- El aviso de reorden lleva a `/comprar/seguimiento` (no a `/comprar/borradores`); confirmar si es intencional.
- No existe registro manual de recepción/calidad desde la UI (solo lectura + reordenar).

---

# RESUMEN DEL MÓDULO "Comprar"

## Objetivo
Cubrir el ciclo operativo completo de compra de un retailer de mejoramiento del hogar: desde **decidir qué reponer** (con presupuesto y razonamiento), **planificar temporadas**, **cotizar**, **construir y aprobar órdenes de compra**, **planificar el retiro logístico** y **controlar las recepciones**, cerrando el bucle cuando el proveedor no despacha (reorden).

## Pantallas
1. **Decisiones / Reposición** (`/comprar/decisiones`, `/comprar/reposicion`, `/reposicion`).
2. **Planificador de temporada** (`/comprar/temporada`).
3. **Cotizaciones / RFQ** (`/comprar/cotizaciones`, `/cotizaciones`).
4. **Borradores OC / Órdenes / Seguimiento** (`/comprar/borradores`, `/comprar/ordenes`, `/ordenes-compra`, `/comprar/seguimiento`) — misma página, distinta pestaña/título.
5. **Aprobaciones** (`/comprar/aprobaciones`, `/aprobaciones`).
6. **Plan de retiro** (`/comprar/plan-retiro`).
7. **Recepciones** (`/comprar/recepciones`, `/recepciones`).

## Flujo principal
**Necesidad → Preparación → Borrador → Retiro → Aprobación → Emisión → Recepción**, materializado en la `PurchaseProcessBar`:
Reposición/Temporada/RFQ **alimentan un borrador de OC global** (carrito `OcDraftContext`) → el editor de OC lo **agrupa por proveedor** y genera una OC por proveedor → las líneas fuera de criterio generan **solicitudes de aprobación** que el **líder** resuelve → la OC se emite y se sigue → las **recepciones** cierran el ciclo, y lo no despachado se **reordena** de vuelta al borrador.

## Funcionalidades principales
- Recomendaciones de reposición priorizadas, con simulación de cantidad, escenarios, razonamiento y control de presupuesto/OTB.
- Planificación de temporada por escenarios con seguimiento y alertas.
- RFQ: creación, comparación de ofertas por línea y conversión a OC (mejor precio).
- Editor de OC (una por proveedor) con cabecera, edición por línea, contexto por línea (inventario/venta/proveedor/landed cost) y plan de retiro en vivo.
- Aprobaciones con flujo de roles (comprador solicita, líder aprueba) y trazabilidad de decisiones.
- Recepciones con foco en "no despachado", rendimiento de proveedor y reorden (individual/masivo).

## Funcionalidades secundarias
- Exportación CSV (Reposición), deep-links (`?oc=`, `?rid=`), overrides/ignorados persistentes, aviso de OC abiertas/solapes, sensibilidad de demanda, comparación de proveedores, historial/auditoría y factura asociada en el detalle de OC, plan de retiro como página independiente.

## Dependencias con otros módulos
- **Productos / SKU 360** (`/productos/{sku}`): fichas de producto y datos base (`mockProducts`).
- **Proveedores** (`supplierPath`, `mockSuppliers`): comparación, lead time, cumplimiento, rendimiento.
- **Presupuesto / Open-to-Buy** (`/presupuesto`, `draftBudgetImpact`, `monthlyPurchaseBudget`, `mockRules`): control de gasto por categoría.
- **Reglas de compra** (`mockRules`, `resolveRuleForProduct`): objetivo de inventario, margen mínimo, criterios de aprobación.
- **Logística** (`LogisticsPlan`): plan de retiro y costo total de abastecimiento.
- **Contextos transversales**: `OcDraftContext` (carrito), `PurchaseFlowContext` (aprobaciones/decisiones), `RoleContext`, `BuyerContext`, `ToastContext`, `DataContext`/`apiClient` (backend opcional, `backendEnabled`).
- **Datos históricos/temporada**: `mockSeasons`, `seasonPlan`, `seasonTracking`, `mockRecommendations`, `mockRfq`, `mockPurchaseOrders`, `mockReceptions`, `mockApprovals`, `mockOcHistory`.

> **Nota de datos mock**: no hay backend activo por defecto; toda la persistencia del usuario (borrador, RFQs creadas, OC creadas, overrides de estado, ignorados) vive en `localStorage`. Fechas y vencimientos se miden contra `TODAY_ISO` (fecha simulada de la demo, 2026). No existen estados de "cargando" ni "error" reales por ausencia de red.
