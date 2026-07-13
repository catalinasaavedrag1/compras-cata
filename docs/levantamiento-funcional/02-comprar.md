# Módulo: Comprar

> Levantamiento funcional del workspace operacional de compra (**"Comprar"**) de la plataforma `compras-cata`.
> Documento construido **solo desde el frontend** (React + TypeScript, en español), con **datos mock** (sin backend real; existe un `apiClient` opcional detrás de `backendEnabled`, ver más abajo). Cuando algo no está definido por el código se marca como **Definición pendiente** o **Suposición**.

---

## Contexto general del módulo

El módulo "Comprar" es la cadena operativa completa que lleva una **necesidad de reposición** hasta la **recepción física** de la mercadería. Se apoya en varias piezas transversales que conviene entender antes de las pantallas:

- **Borrador de OC global (`OcDraftContext`)**: es un **carrito único** de líneas de compra que persiste en `localStorage` (`compras:oc-draft` y `compras:oc-draft-meta`). Casi todas las pantallas del módulo (Reposición, Temporada, Cotizaciones, Recepciones) "agregan" productos a este mismo borrador. La cabecera del borrador (bodega destino, condición de pago, fecha esperada, observaciones) también es global. El contador aparece en el Topbar y como badge en el botón "Nuevo borrador de OC".
  - `addItem` **no duplica**: si el SKU ya está, se ignora (por eso los botones muestran "En borrador"/"En OC"/"En borrador de OC").
  - Total de línea = `cantidad × costo × (1 − descuento%)` (`lineNet`). Subtotal = suma de `cantidad × costo`; Descuento = subtotal − total.
- **`PurchaseFlowContext`**: mantiene `approvals` (solicitudes de aprobación), `approvalState` (`pendiente`/`aprobada`/`rechazada`) y `decisions` (historial de decisiones). Se alimenta al crear OC con desvíos (`addApproval`, `addDecision`).
- **`RoleContext`**: dos roles, `"comprador"` y `"lider"`. El rol se cambia desde arriba a la derecha (fuera de estas pantallas) y habilita/inhabilita acciones (aprobar, alcance de equipo, visibilidad de OC/recepciones).
- **`BuyerContext`**: comprador activo (`buyer`) y lista de compradores (`buyers`).
- **Barra de proceso (`PurchaseProcessBar`)**: cinta superior con las etapas del ciclo, cada una con su contador, tono de color y enlace. Aparece con **6 etapas** en Reposición (Necesidad → Preparación → Borrador → Aprobación → Emitidas → Por recibir) y con **8 etapas** en Órdenes de compra (agrega **Retiro** entre Borrador y Aprobación, y **Órdenes** entre Aprobación y Emitidas).
- **Persistencia mock**: RFQs, órdenes creadas y cambios de estado se guardan en `localStorage`, no en servidor. `backendEnabled` (en `apiClient`) permite un POST opcional al crear OC (`apiCreate("purchase-orders", …)`), pero por defecto el flujo es 100% local/mock; los errores del POST se descartan silenciosamente (`.catch(() => {})`).
- **Fecha "hoy" de la demo**: `TODAY_ISO` (constante mock) — todos los cálculos de vencimiento y atraso se miden contra esa fecha simulada, no contra la fecha real del sistema.

---

# Pantalla 1 · Reposición / Decisiones de compra

## Nombre
Decisiones de compra / Reposición (`ReplenishmentPage`).

## Ruta(s)
- `/comprar/decisiones`
- `/comprar/reposicion`
- `/reposicion`

El **título cambia según la ruta**: si la URL contiene `/comprar/reposicion` el título es **"Reposición"**; en cualquier otro caso, **"Decisiones de compra"**. La descripción es fija: "Prioriza necesidades, revisa recomendaciones y construye tus próximas órdenes."

## Módulo
Comprar — primera etapa ("Necesidad: decidir qué comprar").

## Objetivo funcional
Priorizar las necesidades de reposición, revisar las recomendaciones de compra generadas por el sistema (con su razonamiento) y construir las próximas órdenes agregando SKUs al borrador de OC, todo controlando el presupuesto del mes.

## Tipo de usuario
Comprador (uso principal). El líder también puede acceder; no hay restricción de rol explícita en esta pantalla. **Suposición**: pensada para el comprador operativo.

## Descripción detallada
Pantalla central del comprador. Aplica sobre las recomendaciones base (`mockRecommendations`) los **overrides** guardados por el usuario (cantidad, monto, proveedor — `localStorage: compras:rec-overrides`) y oculta las sugerencias **ignoradas** (`compras:rec-ignored`). Muestra un bloque de presupuesto, una tarjeta de "prioridad destacada", segmentación por foco, tres modos de vista (producto / proveedor / categoría), filtros, acciones masivas, un drawer de decisión y un modal de ajuste.

## Información que muestra
- **Presupuesto del mes**: total sugerido (suma de `suggestedPurchaseAmount` de lo **visible**, no ignorado) vs `monthlyPurchaseBudget` (mock = **28.000.000**), % usado, disponible o exceso, barra de color y **necesidades críticas no cubiertas**. Tonos de la barra/badge: **verde** si ≤80%, **ámbar** si >80%, **rojo** si sobregira. Botón "Optimizar presupuesto".
- **Prioridad destacada** (`topDecision`): el primer crítico/comprar-ahora, o la primera visible si no hay urgentes. Muestra nombre, `risk` como subtítulo, 4 métricas (Stock, Cobertura, Venta 30d, Lead time), decisión sugerida (etiqueta + cantidad + capital) y **escenarios rápidos**: Conservador (0,7×), Sugerido (1×), Agresivo (1,3×) — cada chip abre el drawer con esa cantidad precargada.
- **"Continuar trabajo"**: tarjeta que aparece si el borrador tiene ≥1 SKU (muestra "Borrador OC · N SKU en preparación" + botón "Continuar borrador").
- **Resumen de la barra de foco**: "N decisiones · impacto total $X"; nota "Cantidad sugerida = lead time + cobertura objetivo"; "Sin alertas de margen bajo" (si `lowMarginCount === 0`); "Ajustar sobrestock libera $X" (si hay ahorro); desplegable **"Estados"** con la leyenda (`StateLegend`).
- **Tabla de recomendaciones** (o tarjetas agrupadas).

Por fila (columnas): **Producto** (nombre, SKU mono, marca, proveedor + "LT Nd", categoría); **Stock disp.** (disponible en rojo si ≤0 + comprometido); **Cobertura** (`CoverageCell`: días con barra sobre escala de 60d, rojo si ≤ lead / ámbar si ≤ 2×lead / verde si más; "sin venta" si venta30=0); **Venta** (30d / 90d + tendencia % con ↑/↓); **Cantidad sugerida** (u. + "para ~N días" y "múltiplo X" si >0, o costo c/u si =0); **Capital** (`suggestedPurchaseAmount`); **Prioridad** (`PriorityBadge` + etiqueta de decisión); **OC abierta** (badge "OC abierta" + cantidad y fecha, o "Sin OC"); **Acción** (Revisar + Agregar/En borrador).

## Secciones/bloques
1. `PageHeader` con acciones (Exportar, Ver borrador OC).
2. `PurchaseProcessBar` (6 etapas).
3. Bloque de presupuesto del mes.
4. Tarjeta "Prioridad destacada" (condicional a que exista `topDecision`).
5. Tarjeta "Continuar trabajo" (condicional a borrador > 0).
6. Barra de foco/segmentos + control de vista + botón "Revisar y preparar N urgentes" + nota/leyenda de estados.
7. `FilterBar` (búsqueda, selects, toggles).
8. Aviso de sugerencias ignoradas (condicional) con "Restaurar".
9. Barra de acciones masivas (sticky `top-[68px]`, condicional a selección).
10. Tabla de productos (`DataTable`) **o** tarjetas agrupadas por proveedor/categoría (`GroupedDecisionCards`).
11. Drawer de decisión (`RecommendationDecisionDrawer`).
12. Modal "Ajustar sugerencia".

## Filtros disponibles
- **Foco / segmentos (Tabs)**: Todos · Comprar ahora (critical/buy_now) · Revisar (review) · No comprar (overstock). Persistido en URL (`foco`), con contadores.
- **Búsqueda** por SKU o producto (URL `q`), placeholder "Buscar por SKU o producto".
- **Select Categoría** (URL `cat`).
- **Select Proveedor** (URL `prov`).
- **Select Estado**: Crítico / Comprar ahora / Revisar / Normal / Sobrestock (URL `estado`).
- **Select Prioridad**: Alta / Media / Baja (URL `prioridad`).
- **Toggles**: Con quiebre · Riesgo de quiebre · Sobrestock · Margen bajo · Alta rotación · Baja rotación (estado local, no en URL).
- **Modo de vista** (`SegmentedControl`): Producto / Proveedor / Categoría (estado local).
- Botón **"Limpiar filtros"** (resetea búsqueda, selects, toggles **y** foco a "all").

## Acciones del usuario
- **Exportar** el listado filtrado a CSV (`ExportButton`, filename `reposicion-sugerida`; columnas: SKU, Producto, Categoría, Marca, Proveedor, Stock disponible, Venta 30 días, Días inventario, Cantidad sugerida, Costo unitario, Compra sugerida $, Margen %, Prioridad, Estado, Motivo).
- **Ver borrador OC** → `/comprar/borradores`.
- **Optimizar presupuesto** → fija foco en "urgent" (no ejecuta optimización real).
- **Agregar N u. al borrador** desde tarjeta destacada, tabla o drawer.
- **Revisar** una recomendación → abre el drawer de decisión (clic en fila o botón "Revisar").
- **Revisar y preparar N urgentes** → foco urgente + vista por proveedor (`reviewUrgentBySupplier`).
- **Seleccionar filas** (checkbox) → habilita la barra de acciones masivas.
- **Acciones masivas**: "Revisar por proveedor" (foco urgent + vista proveedor) · "Crear borradores (N)" (N = nº de proveedores distintos; agrega los seleccionados con `suggestedQuantity > 0` y no presentes) · "Ignorar" · botón X "Limpiar selección".
- **Ajustar sugerencia** (modal): cambiar cantidad y proveedor → guarda override (recalcula `suggestedPurchaseAmount = editQty × unitCost`).
- **Ignorar / Postergar** una sugerencia (drawer o masivo); **Restaurar** todas las ignoradas.
- **Ver SKU 360** → `/productos/{sku}` (desde destacada como botón "ghost", y desde el drawer).
- En el drawer: **Postergar** (= ignorar), **Modificar cantidad** y **Comparar proveedores** (ambos abren el modal "Ajustar sugerencia"), **Ver OC relacionada** (solo si hay OC abierta) → `/comprar/seguimiento?oc={numero}`, simular cantidad y escenarios, y **Agregar N u. al borrador**.

## Botones y controles
Botones header: **Exportar**, **Ver borrador OC**. Bloque presupuesto: **Optimizar presupuesto** + badge de %. Destacada: **Agregar N u. al borrador** (primario, deshabilitado si ya en borrador o `suggestedQuantity ≤ 0`), **Revisar recomendación** (secundario), **Ver SKU 360** (ghost), chips de escenario. Barra de foco: Tabs, `SegmentedControl` (Producto/Proveedor/Categoría), **Revisar y preparar N urgentes**. `FilterBar` (input + selects + toggles + Limpiar). Barra masiva: Revisar por proveedor, Crear borradores (N), Ignorar, X. Tabla: checkboxes de selección, orden por columna, botones **Revisar** y **Agregar/En borrador** por fila. Tarjetas agrupadas: **Revisar grupo** y **Seleccionar SKU**. Modal: **Cancelar**, **Guardar cambios**, input numérico y select. Drawer: stepper −/+ (por múltiplo), tarjetas de escenario "Usar escenario/Seleccionado", `details` de sensibilidad, botones de footer.

## Tablas / tarjetas / formularios / componentes relevantes
- **`DataTable`** de recomendaciones: selección múltiple, ordenamiento (dir por defecto "desc"), fila con fondo rosa si `status === "critical"`, tarjeta móvil `RecommendationMobileCard`. Orden por defecto: urgencia de estado → prioridad → monto descendente.
- **`GroupedDecisionCards`**: tarjetas por proveedor o categoría, con conteos crítico/revisar/no-comprar, total, badge "OC abierta" si algún SKU del grupo tiene OC. Ordenadas por nº de críticos y luego total. Acciones "Revisar grupo" (abre drawer del primer ítem) y "Seleccionar SKU" (selecciona todo el grupo, fija el filtro correspondiente y vuelve a vista producto).
- **`RecommendationDecisionDrawer`** — título "Recomendación de abastecimiento", descripción `{sku} · {producto}`. Secciones (en orden):
  1. **Decisión sugerida**: etiqueta (`decisionTypeLabel`) + "N unidades", resumen del razonamiento, **chips de perfil SKU** (`SkuProfileChips`: clase **ABC** + "% venta", clase **XYZ** + su etiqueta, **velocidad de venta** —"Vende a diario" ≥60/30d, "Vende cada semana" ≥12, "Venta esporádica" >0, "Sin venta reciente"—, y **Margen %** con tono verde ≥30 / ámbar ≥20 / rojo). Dos cajas: "Venta perdida en riesgo" (extraída del texto `risk`) y "Confianza recomendación" (`max(62, round(90 − |tendencia|·0,4))`%).
  2. **Alertas (N)** — `buildBuyingAlerts`, con tono bad/warn/info (solo si hay alertas).
  3. **Situación**: 6 métricas — Stock (rojo si ≤0), Cobertura actual, Venta 30d, Forecast 30d, Lead time, En tránsito — + frase de cobertura (`coverageSentence`).
  4. **Abastecimiento en curso** (solo si hay OC abierta): número, cantidad, entrega esperada, badge "En curso"/"Atrasada"; si la OC está `delayed` avisa que "para cobertura se considera solo 40% de llegada" y muestra la cobertura total proyectada.
  5. **Cobertura después de comprar** (`CoverageTargetBar`): actual / objetivo **45-60 d** / simulada, con barra que marca la zona verde objetivo.
  6. **Simular cantidad**: leyenda "Múltiplo de compra: X u. · caja/pallet: Y u. (=múltiplo×2) · mínimo operacional Z u. (`minStock`)"; stepper −/+ por múltiplo, acotado entre 0 y `maxQty` (= máx(sugerido×2, maxStock−stock, 1)); métricas Cobertura total, Capital, Venta protegida, Margen esperado, **GMROI estimado** (`margen bruto × 12 / capital`), Presupuesto (% disp.).
  7. **Comparar escenarios**: Conservador (0,7×) / Recomendado / Agresivo (1,3×), redondeados a múltiplo; cada tarjeta muestra cobertura, capital, riesgo de quiebre, riesgo de sobrestock y GMROI, con botón "Usar escenario".
  8. **Por qué N u.** (`ReasoningSection`): factores "Cuánto necesitas tener" (+) vs "Con qué ya cuentas" (−) con total corriente, "= Comprar N u.", nota de promoción si aplica, y "Por qué no menos / no más".
  9. **Demanda**: 30d, Prom. 90d, Tendencia, Forecast.
  10. **Probar sensibilidad de demanda** (`details`): tarjetas −20% / 0% / +20% (cobertura, quiebre, sobrestock).
  11. **Comparar proveedores** (tabla): Proveedor · Costo · Lead time · Total · Cobertura (proveedor actual + hasta 2 alternativos de la misma categoría, con factores de costo 1,04× y 0,96×).
  12. Botón **Ver SKU 360**.
  - **Footer**: Postergar (ghost, ignora) · Modificar cantidad (secundario) · Ver OC relacionada (si hay OC) · Comparar proveedores (secundario) · Agregar N u. al borrador (primario, deshabilitado si ya en borrador o cantidad ≤ 0).
- **Modal "Ajustar sugerencia"**.

### Campos del formulario "Ajustar sugerencia" (modal)
- **Cantidad sugerida (unidades)** — `Input` numérico, `min=0`, requerido, valor inicial = `suggestedQuantity`.
- **Proveedor** — `Select` con todos los proveedores de `mockSuppliers`, valor inicial = `supplierName`.
- Panel de solo lectura: Costo unitario y Total compra (`editQty × unitCost`); debajo, el texto `reason`.

## Estados posibles
- **Con datos**: estado normal (siempre hay recomendaciones mock). **Existe**.
- **Sin resultados** (filtros): la `DataTable` mostraría su mensaje vacío; alcanzable filtrando. **Existe** (vía filtros).
- **Vacía global** (sin recomendaciones): no ocurre con datos mock. La tarjeta destacada y la barra de presupuesto degradan bien, pero no hay `EmptyState` dedicado. **No aplica por datos mock**.
- **Cargando**: no hay spinner ni skeleton; los datos son síncronos. **No aplica**.
- **Error**: no hay manejo de error (sin fetch real). **No aplica**.

## Navegación hacia otras pantallas
`/comprar/borradores`, `/comprar/cotizaciones`, `/comprar/aprobaciones`, `/comprar/seguimiento` (incl. `?oc=`), `/comprar/recepciones`, `/comprar/decisiones` (barra de proceso), `/productos/{sku}`.

## Flujo funcional completo
1. El comprador entra y ve el presupuesto, la prioridad destacada y la lista priorizada (orden por urgencia → prioridad → monto).
2. Filtra/segmenta (foco, categoría, proveedor, toggles) para acotar.
3. Revisa una recomendación en el drawer: simula cantidad, compara escenarios/proveedores, entiende el "por qué N u.".
4. Ajusta cantidad/proveedor si corresponde (override persistente) o ignora la sugerencia.
5. Agrega SKUs al **borrador de OC** (individual, desde destacada, o en masa por selección/grupo).
6. Continúa hacia Borradores OC para formalizar.

## Reglas de negocio inferibles
- **Cantidad sugerida** cubre lead time + cobertura objetivo (rango objetivo 45–60 días marcado en la barra).
- **Múltiplo de compra** escalonado (`purchaseMultiple`): `suggestedQuantity ≥ 120` y múltiplo de 24 → **24**; ≥100 → **20**; ≥40 → **10**; si no → **1**.
- **Etiqueta de decisión** (`decisionTypeLabel`): overstock → "No comprar"; review → "Revisar margen" (margen<25) o "Revisar cantidad"; sin stock (≤0) o crítico → "Comprar ahora"; cobertura ≤ 2× lead time → "Reponer"; si no → "Postergar".
- **Margen bajo** = margen < 25%.
- **Sobrestock/ahorro**: exceso = `(availableStock − maxStock) × unitCost`; su reducción "libera" capital.
- **Necesidades críticas no cubiertas** = `max(0, capital crítico − max(0, disponible))`.
- **OC abierta** (`openPoBySku`): se detecta si el SKU aparece en la primera OC en estado activo (draft, pending_approval, approved, sent, confirmed, partially_received, delayed). Si esa OC está `delayed`, en la simulación de cobertura solo se cuenta el **40%** de la cantidad en tránsito (`effectiveIncomingQty`).
- **Riesgo de quiebre** (drawer): "Alto" si cobertura proyectada ≤ lead time; "Medio" si ≤ 2× lead time; "Bajo" en otro caso. **Riesgo de sobrestock** (escenarios): "Medio" si cobertura > 60d o stock+qty+tránsito > maxStock.
- **Tendencia** (`salesTrendPct`) = `(venta30 − venta90/3) / (venta90/3)`.
- Solo se agregan SKUs con `suggestedQuantity > 0`; los ya presentes en el borrador no se re-agregan.

## Validaciones necesarias
- Cantidad no negativa (input `min=0`; el drawer usa `Math.max(0, …)` y cap en `maxQty`).
- No duplicar SKU en el borrador (garantizado por `OcDraftContext`).
- **Definición pendiente**: no hay validación de múltiplo/MOQ real al agregar desde la tabla (solo se sugiere en el drawer); no se bloquea agregar por sobre presupuesto (solo se advierte con color/exceso).

## Permisos/restricciones
Sin restricción de rol declarada. Overrides e ignorados son por navegador (localStorage), no por usuario/servidor.

## Dudas / definiciones pendientes
- El botón "Optimizar presupuesto" solo cambia el foco a urgentes; no ejecuta una optimización real. **Suposición**: placeholder.
- "Confianza recomendación" y GMROI son heurísticas de demo (fórmulas locales), no valores de negocio confirmados.
- El botón de footer "Postergar" ejecuta el mismo `onIgnore` que "Ignorar" (la sugerencia se oculta, no se "posterga" con fecha). **Definición pendiente**: ¿postergar debería ser temporal?
- No persiste el motivo del override más allá del texto `reason` original.

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
Selector de temporada (`mockSeasons`, inicial = primera) y de escenario (`conservador`/`probable`/`agresivo`, inicial = `probable`). Calcula un plan por escenario (`planSeason`) y un seguimiento (`trackSeason`) derivados del plan activo. Dos pestañas: **Planificación** y **Seguimiento** (esta última con contador de alertas). El plan es totalmente derivado/mock (no editable línea a línea salvo generar propuestas).

## Información que muestra
- **Encabezado de temporada** (común a ambas pestañas): Venta esperada (rango de fechas), Ventana de compra (rango), **Deadline OC** (resaltado en **rojo**), Lead time (N días), Presupuesto, Crecimiento esp. (+N%); chips de Categorías, Canales (nombre corto vía `CHANNEL_META`) y Bodegas.
- **Pestaña Planificación**:
  - Recomendación en lenguaje natural (`seasonHeadline`) dentro de un `HelpNote`.
  - **Nivel 1 · Resumen ejecutivo (KpiCards)**: Venta proyectada ("demanda × precio"), Compra propuesta ("+N u."), Margen esperado ("de la temporada"), Presupuesto usado (% + presupuesto compacto; tono `bad` si >100%). MiniStats: Inventario inicial, Inventario final proy., Riesgo de quiebre (tono `bad` si >15%), Nivel de servicio (`ok` si ≥95%, si no `warn`).
  - **Temporada anterior vs actual** (`CompareCell`): Compra, Venta, Margen (verde si ≥ anterior), Quiebres (verde si ≤ anterior), Sobrestock (verde si ≤ anterior) — con valor anterior tachado.
  - **Nivel 2 · Distribución de la demanda por origen**: barra segmentada (`OriginBar`) — Confirmada (verde), Histórica proyectada (azul), Probable ponderada (ámbar), Campañas (violeta), Stock estratégico (gris) — + lista "Demanda por canal y origen" con total.
  - **Nivel 3 · Escenarios de compra**: comparador de 3 tarjetas-selector (`ScenarioComparator`) con Compra, Venta pot., Margen, Quiebre, Sobrestock, Presupuesto (rojo si >100%); nota en "Agresivo".
  - **Nivel 4 · Detalle por producto** (tabla).
- **Pestaña Seguimiento** (`SeasonTrackingView`): avance % (barra), "Canal: plan vs real" (esperado/real + `VarianceBadge`), "Alertas de la temporada" (mensaje + acción), "Replanificar" (botones dinámicos `tracking.replanActions`, solo toast "simulada"), tabla de seguimiento por producto.
- **Drawer de detalle de producto** (`ProductDetail`): badges de confianza y riesgo + `confidenceReasons`; "Cómo se calcula la compra sugerida" (fórmula con total corriente y múltiplo); "Origen de la demanda"; "Evolución semanal" (`MonthlyBars` con semana de quiebre resaltada) + cobertura actual/post-compra/semanas cubiertas y aviso de quiebre; datos (Margen, Rotación, Lead time, Llegada estimada/ETA, Múltiplo compra, Pedido mínimo/MOQ, Venta perdida est., Costo unit.); tránsito + transferible.

## Secciones/bloques
PageHeader (selector temporada + "Generar propuestas OC") → Tabs (Planificación / Seguimiento con contador de alertas) → Encabezado de temporada (común) → contenido por pestaña (con `SectionTitle` numerados 1–4 en Planificación) → Drawer de detalle.

## Filtros disponibles
- **Selector de temporada** (`Select` con `aria-label="Temporada"`, no persiste en URL).
- **Selector de escenario** (tarjetas del comparador): conservador / probable / agresivo.
- **Pestañas**: Planificación / Seguimiento.
- No hay búsqueda ni filtros de tabla.

## Acciones del usuario
- Cambiar temporada y escenario.
- **Generar propuestas OC** (`addAllToDraft`): agrega al borrador de OC todos los productos con `suggested > 0` del escenario activo (toast con nº agregadas, monto `compraPropuesta` y cuántas ya estaban; enlace "Ir al borrador").
- Abrir el detalle de un producto (clic en fila) en el drawer.
- Cambiar de pestaña; en Seguimiento, ejecutar acciones de replanificación (solo muestran toast "…(simulada)").

## Botones y controles
`Select` de temporada; botón **"Generar propuestas OC"**; Tabs; tarjetas de escenario (botón-selector con badge "Activo"); filas de tabla clicables; botones de replanificación (secundarios, simulados). Sin inputs editables.

## Tablas / tarjetas / formularios / componentes relevantes
- **Tabla de productos (plan)**: Producto (nombre, SKU · categoría), Demanda (`needTotal`), Stock (`available`), Tránsito (`inTransit` o "—"), Compra sugerida (`suggested`), Cobertura post (`coverageAfterDays` d), Confianza (badge vía `CONFIDENCE_META`), Riesgo (badge vía `RISK_META`). Fila roja si `risk === "alto_quiebre"`. Empty: "No hay productos en las categorías de esta temporada."
- **Tabla de seguimiento**: Producto, Plan, Emitido, Recibido, Venta real, Stock (rojo si ≤0), Pronóstico act., Estado (Quiebre ~S# / Sobre máx. [violeta] / Atraso Nd / En línea). Fila roja si `stockoutWeek !== null`. Empty: "Sin productos en seguimiento."
- **`KpiCard` / `MiniStat` / `CompareCell` / `OriginBar` / `ScenarioComparator` / `ProductDetail` / `SeasonTrackingView` / `VarianceBadge`**.
- **No hay formularios de entrada** (solo selección); el detalle es de lectura.

### Campos de formulario
No aplica (no hay formularios editables; solo selectores). El plan no se edita línea a línea en esta pantalla.

## Estados posibles
- **Con datos**: normal (hay temporadas mock).
- **Sin resultados en tabla**: `emptyMessage` en plan ("No hay productos en las categorías de esta temporada") y en seguimiento ("Sin productos en seguimiento"). **Existe** el mensaje.
- **Seguimiento sin alertas**: "Sin desvíos relevantes: la temporada va en línea". **Existe**.
- **Vacía global / Cargando / Error**: no hay (datos síncronos mock). **No aplica**.

## Navegación hacia otras pantallas
`/comprar/borradores` (tras generar propuestas, vía toast "Ir al borrador"). No usa `PurchaseProcessBar`. El detalle de producto **no** enlaza a SKU 360 aquí (a diferencia de Reposición).

## Flujo funcional completo
1. Elegir temporada y revisar deadlines/ventana de compra.
2. Leer resumen ejecutivo y comparación con temporada anterior.
3. Entender el origen de la demanda (segura vs incierta).
4. Elegir escenario (conservador/probable/agresivo) según apetito de riesgo/presupuesto.
5. Revisar detalle por producto (fórmula y evolución semanal).
6. **Generar propuestas OC** → borrador.
7. Durante la temporada, usar la pestaña Seguimiento para ver desvíos y replanificar.

## Reglas de negocio inferibles
- Compra sugerida por producto = demanda de temporada − stock − tránsito − transferible (± ajustes), redondeada a múltiplo (`ProductDetail` muestra la fórmula con total corriente; nota de múltiplo si >1).
- Escenarios ajustan la agresividad de la demanda, impactando compra, cobertura y riesgos.
- Presupuesto usado > 100% en rojo; riesgo de quiebre > 15% en rojo; nivel de servicio ≥ 95% ok.
- Deadline de OC es un hito duro (resaltado en rojo). **Suposición**: no comprar antes del deadline arriesga la temporada.
- Varianza por canal (`VarianceBadge`): >+8% azul, <−8% ámbar, en rango verde.
- Estados de seguimiento por producto: Quiebre ~S{week} si `stockoutWeek`; Sobre máx. si `overMax`; Atraso Nd si `delayDays>0`; En línea en otro caso.

## Validaciones necesarias
No hay entradas que validar. **Definición pendiente**: al "Generar propuestas OC" no se controla presupuesto de temporada ni MOQ antes de agregar.

## Permisos/restricciones
Ninguna declarada por rol.

## Dudas / definiciones pendientes
- Las acciones de replanificación son **placeholders** (solo toast "…(simulada)").
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
Lista de RFQs combinando las creadas por el usuario (`localStorage: compras:rfq`, primero) con las semilla (`mockRfq`), aplicando overrides de estado (`localStorage: compras:rfq-status`). KPIs por estado, pestañas por estado, tabla y dos overlays: modal de creación y drawer de comparación.

## Información que muestra
- **KPIs**: **Por responder** (enviadas + parciales; clic → pestaña "respondidas"), **En negociación** (clic → "negociacion"), **Por vencer (≤ 7 días)** (no clicable), **Convertidas a OC** (clic → "aprobadas").
- **Tabla**: N° cotización (+ comprador); Fecha / Vencimiento (marca "vence {fecha} · en Nd" en ámbar si el estado está abierto y quedan 0–7 días); Productos (nº líneas); Proveedores (nº invitados + "N respondió"); Estado (badge con `RFQ_STATUS_LABELS`/`_TONE`); acción "Comparar" (si hay respuestas) o "Ver detalle".
- **Drawer de comparación**: estado + fecha de solicitud; proveedores invitados (badge verde si respondió, "· sin respuesta" si no); por cada línea una tabla comparativa; `EmptyState` "Aún sin respuestas" si no hay ofertas.

## Secciones/bloques
PageHeader ("Nueva cotización") → KPIs → Tabs por estado → Tabla → Modal de creación → Drawer de comparación.

## Filtros disponibles
- **Pestañas por estado** (con contadores): Todas · Borrador · Enviadas · Respondidas (respondida + respondida_parcial) · En negociación · Aprobadas (aprobada + convertida).
- KPIs "Por responder", "En negociación", "Convertidas" actúan como accesos rápidos a pestañas.
- No hay búsqueda de texto ni selects en la lista.

## Acciones del usuario
- **Nueva cotización** (modal).
- Abrir detalle/comparación (clic en fila o enlace "Comparar/Ver detalle").
- **Marcar en negociación** (desde estados respondida/respondida_parcial).
- **Aprobar** (si tiene respuestas y el estado no es aprobada/convertida).
- **Convertir a OC** (`convertToOc`): por cada línea toma la **oferta más barata disponible** (`pickBestForLine`), agrega al borrador con `cantidad = max(qtyRequested, minimoCompra del proveedor)` y `unitCost = costoUnitario`; marca la RFQ como "convertida" y muestra toast con enlace "Ver borrador OC".

## Botones y controles
Botón **"Nueva cotización"**; KPIs clicables; Tabs; enlaces "Comparar/Ver detalle"; en drawer: **Cerrar**, **Marcar en negociación**, **Aprobar**, **Convertir a OC**; en modal: **Cancelar**, **Crear cotización** (deshabilitado si no cumple `canSave`).

## Tablas / tarjetas / formularios / componentes relevantes
- `DataTable` de RFQs (con tarjeta móvil), empty "No hay cotizaciones en esta vista. Crea una nueva con el botón de arriba."
- `ComparisonDrawer` + `LineComparison`: por línea, cabecera con SKU/producto y "Solicitado: N u."; tabla con columnas **Proveedor** · **Costo** · **Plazo** · **Mínimo** · **Disp.** (check/close). Resalta "Mejor precio" (verde) y "Más rápido" (azul, distinto del más barato), muestra `observacion` por proveedor y una nota de trade-off ámbar si aplica; "Ningún proveedor cotizó esta línea" si vacía.
- `CreateRfqModal`.

### Campos del formulario "Nueva cotización (RFQ)"
- **Nombre / referencia (opcional)** — `Input` texto, placeholder "Ej. Reposición construcción julio". (Se captura pero **no** se guarda en el objeto RFQ creado — **Definición pendiente/observación**.)
- **Productos a cotizar** — buscador por SKU/nombre (`mockProducts`, muestra hasta 8; "Sin coincidencias." si vacío) con selección múltiple (checkbox) y chips de seleccionados con "Quitar". `qtyRequested` de cada línea = `max(reorderPoint, 1)`.
- **Proveedores a invitar** — chips seleccionables de `mockSuppliers` (múltiple, marca de check al activar).
- **Fecha de vencimiento** — `Input` type=date, valor por defecto **`2026-07-08`**.
- Se crea siempre en estado **borrador**; N° `COT-2026-####` / id `RFQ-2026-####` con secuencia `9 + nº de creadas`. Requiere ≥1 producto **y** ≥1 proveedor (`canSave`). Al guardar cambia a la pestaña "borrador".

## Estados posibles
- **Con datos**: normal.
- **Sin resultados** (pestaña sin RFQs): `emptyMessage` "No hay cotizaciones en esta vista. Crea una nueva…". **Existe**.
- **Drawer sin respuestas**: `EmptyState` "Aún sin respuestas". **Existe**.
- **Línea sin cotizar**: "Ningún proveedor cotizó esta línea". **Existe**.
- **Cargando / Error**: no hay. **No aplica** (mock).

## Navegación hacia otras pantallas
`/comprar/borradores` (tras convertir, vía toast). No hay barra de proceso en esta pantalla.

## Flujo funcional completo
Crear RFQ (borrador) → (mock: las semillas ya traen respuestas) → comparar ofertas por línea → marcar en negociación / aprobar → convertir a OC (líneas al borrador) → seguir en Borradores OC.

## Reglas de negocio inferibles
- **Convertible** solo si estado ∈ {respondida, respondida_parcial, en_negociacion, aprobada} (`APROBABLE`) y hay respuestas.
- **Aprobar** disponible salvo que ya esté aprobada/convertida y siempre que existan respuestas.
- **Marcar en negociación** solo desde respondida/respondida_parcial.
- **Por vencer** = estado abierto (enviada/parcial/respondida/negociación) y 0–7 días para el vencimiento (`daysUntil` contra `TODAY_ISO`).
- Al convertir, se elige la oferta **más barata disponible** por línea; la cantidad respeta el **mínimo de compra** del proveedor.
- Estados de una RFQ (`RfqStatus`): borrador, enviada, respondida_parcial, respondida, en_negociacion, aprobada, rechazada, vencida, convertida.

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
Órdenes de compra (`PurchaseOrdersPage` + `PurchaseOrdersSections` + `purchaseOrders/DraftLineContext`). Una misma pantalla sirve **tres+ vistas** según la ruta/pestaña.

## Ruta(s)
- `/comprar/borradores` (pestaña inicial "Borradores")
- `/comprar/ordenes` (pestaña "Todas")
- `/ordenes-compra` (título "Órdenes de compra"; soporta deep-link `?oc=OC-XXXX`)
- `/comprar/seguimiento` (pestaña "En curso")

El **título y la descripción cambian por ruta**: "Comprar · Borradores OC", "Comprar · Órdenes", "Comprar · Seguimiento" u "Órdenes de compra" (default).

## Módulo
Comprar — etapas "Borrador", "Órdenes/Emitidas" y "Seguimiento".

## Objetivo funcional
Construir la orden de compra desde el borrador global (por proveedor), revisar restricciones antes de formalizar, generar las OC, y luego consultar/gestionar las órdenes emitidas (estados, atrasos, entregas parciales, detalle, historial).

## Tipo de usuario
Comprador (ve **solo sus** OC: `buyerName === buyer`) y líder (ve las de **todo el equipo**). Al crear como líder, `buyerName` se fija a "Catalina Saavedra" (mock).

## Descripción detallada
Combina órdenes creadas por el usuario (`localStorage: compras:po-created`) con las semilla (`mockPurchaseOrders`, vía `useCollection`), aplicando overrides de estado (`localStorage: compras:po-status`) y un **estado derivado de aprobación** (`approvalDerivedStatus`): una OC `pending_approval` pasa a `approved` cuando todas sus solicitudes `APR-{numero}-*` están aprobadas. El **editor del borrador** es un `Drawer` que lee/escribe el `OcDraftContext`.

## Información que muestra
- **`PurchaseProcessBar`** de 8 etapas: Necesidad, Preparación, Borrador, **Retiro** (nº de camiones `pickupPlan.truckCount`), Aprobación (nº pendientes), **Órdenes** (total visible), Emitidas (OC en curso), Por recibir.
- **Aviso** de borrador recién creado (número(s), botón "Cerrar").
- **Tarjeta "Compra en curso"** (si borrador > 0): "Borrador · {proveedor principal}" (o "N proveedores"), N SKU · total · cobertura futura promedio; resumen inline del plan de retiro (`LogisticsInlineSummary`) con enlace "Ver plan de retiro →"; 4 métricas (Presupuesto disp. OTB → enlaza a `/presupuesto`, Cobertura futura, SKU críticos, Valor OC); **Observaciones antes de formalizar** (`DraftWarning`): OC abiertas solapadas, cantidades sobre recomendación, cobertura > 90 días, sobre OTB (con categorías si aplica); botón "Continuar trabajando".
- **KPIs**: Monto en curso (→ open), Atrasadas (→ delayed), Borradores (→ draft), Total OC (→ all). Todos clicables.
- **Tabla de OC**: N° OC (+ comprador); Proveedor (enlace a ficha `supplierPath`); Creación / Esperada; SKUs; Bodega destino; Monto total; Atraso (badge "N d" o "—"); Estado (`StatusBadge`); "Ver detalle". Fila roja si `status === "delayed"`.

## Secciones/bloques
PageHeader (+ `InfoHint` "Ciclo de una orden de compra") → `PurchaseProcessBar` → aviso creado → tarjeta compra en curso → KPIs → Tabs + `DateRangePicker` → Tabla → **Drawer editor de borrador** → **Modal de detalle de OC** (`OcDetailModal`).

## Filtros disponibles
- **Pestañas** (con contadores): Todas · Borradores (draft) · En curso (sent/confirmed/partially_received/with_difference) · Atrasadas (delayed) · Recibidas (received/closed).
- **KPIs** como accesos rápidos.
- **Rango de fechas** por fecha de creación (`DateRangePicker`, placeholder "Fecha de creación").
- **Deep-link** `?oc=` abre el detalle; al cerrar se limpia el parámetro.
- No hay búsqueda de texto en la lista.

## Acciones del usuario
- **Nuevo borrador de OC** → abre el Drawer editor (badge con el conteo del carrito).
- En el editor:
  - **Buscar y agregar** cualquier producto (`mockProducts`, ≥2 caracteres, hasta 8; deshabilitado si ya está). Cantidad por defecto: `suggestedQuantity` de la recomendación si >0, si no `max(1, minStock)`; costo = `p.cost`; descuento = `p.descuentoVigentePct`.
  - Editar la cabecera (bodega, condición de pago, fecha esperada, observaciones) — persistente en `OcDraftMeta`.
  - **Analizar línea** (`DraftLineContext`): pestañas Resumen/Inventario/Venta/Proveedor; "Ver SKU 360"; input "Cantidad OC".
  - Editar por línea: cantidad (`min=0`), costo unitario (`max(0, …)`), descuento % (acotado 0–100); botón eliminar línea.
  - Ver totales (Subtotal, Descuento si >0, Total) y aviso "Se generarán N órdenes (una por proveedor)" si hay >1 proveedor.
  - Ver **Plan de retiro en vivo** (`TruckOptimizer` + `LogisticsSummary` + `LogisticsAdvice`) si `truckCount > 0`, con enlace "Ver detalle por camión →" a `/comprar/plan-retiro`.
  - Agregar desde **"Sugerencias para agregar"** (recomendaciones con `suggestedQuantity>0` no incluidas; hasta 6).
  - **Crear borrador / Crear N OC**: genera una OC por proveedor (`createOrder`), muestra "Total".
- En la tabla/detalle: **Ver detalle** (modal), **Marcar como enviada** (si draft/approved/confirmed), **Ver aprobaciones** (si pending_approval).

## Botones y controles
"Nuevo borrador de OC" (con badge de conteo), KPIs, Tabs, `DateRangePicker`, Drawer editor (input de búsqueda, selects de cabecera, textarea de observaciones, inputs numéricos por línea, botón eliminar, "Analizar línea", "Cerrar"/"Crear"), Modal de detalle (Cerrar, Marcar como enviada, Ver aprobaciones).

## Tablas / tarjetas / formularios / componentes relevantes
- `DataTable` de OC (tarjeta móvil). Empty por pestaña: atrasadas ("No hay órdenes de compra atrasadas…"), borradores ("No tienes borradores. Crea uno desde las sugerencias de reposición."), genérico ("No hay órdenes de compra en esta vista.").
- **Drawer editor de borrador** (formulario principal). Empty "El borrador está vacío" con acción "Ir a reposición" (→ `/comprar/decisiones`).
- `DraftLineContext` (contexto por línea con pestañas):
  - **Resumen**: Stock, Cobertura actual, Cobertura futura (stock+cantidad), OC abiertas (unidades en OC activas del mismo SKU/proveedor).
  - **Inventario**: hasta 3 ubicaciones (`stockByLocation`) + aviso ámbar si hay OC abiertas del SKU.
  - **Venta**: Venta 30d, Venta 90d, Rotación, Variación OC (cantidad − sugerido).
  - **Proveedor**: cumplimiento y lead time del proveedor + `LandedCostBreakdown` (o resumen de costo/línea si no hay producto).
  - Pie: input "Cantidad OC" + "Después de comprar: N días".
- **`OcDetailModal`**: banner ámbar si `pending_approval`; campos Estado, Comprador, Creación, Fecha esperada, Confirmada proveedor (si existe), Monto total, N° de SKUs, Descuento (si existe), Pago (si existe); Comentarios; Documentos (si existen); **Productos** o **"Productos y diferencias de recepción"** (si alguna línea tiene `receivedQty`: Pedido/Recibido + "Faltan N"/"Completo"); **Factura asociada** (`buildOcAudit`: conciliada o "Dif. $X"); **Historial y auditoría** (timeline `changelog`). Footer: Cerrar; Ver aprobaciones (si pending_approval); Marcar como enviada (si draft/approved/confirmed).

### Campos del formulario (editor de borrador de OC)
Cabecera (`OcDraftMeta`, global y persistente):
- **Bodega destino** — `Select` (Centro de Distribución, Bodega Santiago, Bodega Norte, Bodega Sur, Tienda Central).
- **Condición de pago** — `Select` (Contado, 15/30/60/90 días fecha factura).
- **Fecha esperada** — `Input` type=date (si vacía, se calcula `TODAY_ISO + 7 días` al crear).
- **Observaciones** — `textarea` (placeholder "Notas para el proveedor o internas…").

Por línea:
- **Cantidad** — numérico, `min=0`.
- **Costo unit.** — numérico, `min=0` (se acota con `max(0, …)`).
- **Desc. %** — numérico, `min=0 max=100` (acotado 0–100), valor por defecto 0.

## Estados posibles
- **Con datos**: normal.
- **Borrador vacío** (editor): `EmptyState` "El borrador está vacío" con acción "Ir a reposición". **Existe**.
- **Sin resultados** (pestaña/tabla): `emptyMessage` específico por pestaña. **Existe**.
- **Detalle sin líneas**: "El detalle de líneas de esta orden no está disponible en la demo." **Existe** (por datos mock).
- **Cargando**: `useCollection` podría cargar de backend si estuviera habilitado; con mock es síncrono, sin spinner. **No aplica** (mock).
- **Error**: `apiCreate` descarta errores silenciosamente (`.catch(() => {})`); no hay UI de error. **No aplica** (mock).

## Navegación hacia otras pantallas
`/comprar/decisiones`, `/comprar/cotizaciones`, `/comprar/borradores`, `/comprar/plan-retiro`, `/comprar/aprobaciones`, `/comprar/ordenes`, `/comprar/seguimiento`, `/comprar/recepciones` (barra de proceso); `/presupuesto` (OTB); ficha de proveedor (`supplierPath`); `/productos/{sku}`.

## Flujo funcional completo
1. Con el carrito lleno (desde Reposición/Temporada/RFQ/Recepciones), abrir el editor.
2. Completar cabecera y ajustar líneas (cantidad/costo/descuento); analizar cada línea; revisar plan de retiro.
3. Revisar observaciones (solapes, sobre-recomendación, cobertura alta, OTB).
4. **Crear**: se agrupan las líneas por proveedor → **una OC por proveedor**. Por cada línea se registra una **decisión** (`addDecision`) y, si cumple algún criterio de desvío, una **solicitud de aprobación** (`addApproval`). La OC nace en `pending_approval` si tiene solicitudes, o `draft` si no. Toast con nº de borradores y "Ver aprobaciones" si hubo solicitudes.
5. Gestionar en las pestañas: marcar enviada, ver detalle/factura/historial, seguir atrasos y recepciones.

## Reglas de negocio inferibles
- **Una OC no mezcla proveedores**: el carrito se agrupa por `supplierName` → una orden por grupo. Numeración `OC-2026-####` = `143 + createdOrders.length + índice de grupo`.
- **Criterios de aprobación** al crear (`ApprovalCriterion`): `desvio_sugerido` (sugerido=0 **o** `|diff/sugerido| > 0,2` = 20%), `monto_alto` (línea `lineNet ≥ 5.000.000`), `cobertura_excesiva` (cobertura resultante > objetivo × **1,3**), `margen_bajo` (margen < `minMargin` de la regla). Cualquiera dispara solicitud.
- **Objetivo de inventario** (`objetivo`) desde `resolveRuleForProduct` (default **45** días); `minMargin` desde la regla (default 0).
- **Observaciones "sobre recomendación"**: cantidades que superan `suggestedQuantity × 1,2`. **Cobertura alta**: cobertura futura > **90** días. **Críticos**: `availableStock ≤ 0`.
- **Estado derivado**: OC `pending_approval` → `approved` cuando todas sus solicitudes ligadas quedan aprobadas.
- **Visibilidad por rol**: comprador ve solo `buyerName === buyer`; líder ve todas.
- Estados de OC (labels vía `StatusBadge`): Borrador, Por aprobar, Aprobada, Enviada, Confirmada, Parcial, Recibida, Con diferencia, Cerrada, Atrasada, Cancelada.
- **Marcar como enviada** permitido desde draft/approved/confirmed.
- Descuento efectivo de la OC (`effDisc`) = `round((bruto − neto)/bruto × 100)`.
- **Monto en curso** = suma de OC no `received`/`cancelled`.

## Validaciones necesarias
- No crear con carrito vacío (`count === 0` deshabilita el botón).
- Cantidad/costo ≥ 0; descuento 0–100 (acotado en inputs).
- **Definición pendiente**: no se **bloquea** crear una OC que supere el OTB o con líneas fuera de criterio — solo se advierte y se enruta a aprobaciones. No se valida MOQ ni múltiplo al crear.

## Permisos/restricciones
Filtro por comprador/rol. Aprobar/rechazar **no** ocurre aquí (solo se enruta a Aprobaciones). "Marcar como enviada" sin restricción de rol declarada.

## Dudas / definiciones pendientes
- ¿Debería el comprador poder "Marcar como enviada" una OC `pending_approval`? El código solo lo permite tras aprobación (draft/approved/confirmed). Consistente, pero conviene confirmar el flujo post-aprobación (¿aprobada→enviada manual?).
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
- **Comprador**: solicita/justifica y ve **solo sus** solicitudes (`buyerName === buyer`); **no** puede aprobar.
- **Líder**: ve las de todo el equipo y **aprueba/rechaza** (y puede revertir a pendiente).

## Descripción detallada
Lista de solicitudes (`PurchaseFlowContext.approvals`) con su estado (`approvalState`, default "pendiente"). Flujo de roles explícito: "el comprador solicita, el líder aprueba". Sin datos base propios: las solicitudes provienen de la creación de OC con desvíos (o de semillas del contexto).

## Información que muestra
- **KPIs**: Pendientes (tono warn si >0), Monto en aprobación (suma de pendientes), Aprobadas, Total solicitudes.
- **Filtros de estado** (chips): pendiente (default) / aprobada / rechazada / todas.
- **Tarjeta por solicitud**: producto (enlace a `/productos/{sku}`), badge de estado si resuelta (Aprobada verde / Rechazada rojo), fecha (dd/mm/aaaa) + comprador + proveedor (enlace `supplierPath`), monto; **criterios** (badges ámbar vía `CRITERION_LABEL`); Sugerido → Solicitado ("+N%" en violeta si aumenta, rojo si baja); Cobertura resultante (violeta si > objetivo × 1,3) vs objetivo; Margen (rojo si < mínimo) vs mínimo; Costo unitario; **Justificación del comprador**; acciones según rol/estado.

## Secciones/bloques
PageHeader (+ `InfoHint` "Cómo funcionan las aprobaciones") → KPIs → chips de estado → lista de tarjetas (o `EmptyState`).

## Filtros disponibles
- **Estado**: pendiente (default) / aprobada / rechazada / todas.
- Filtro implícito por **rol/comprador** (comprador ve solo las suyas).

## Acciones del usuario
- (Líder) **Aprobar** / **Rechazar** una solicitud pendiente; **Revertir a pendiente** una resuelta.
- (Comprador) Solo lectura; ve un aviso con candado ("La aprobación requiere rol Líder…"), con prefijo "Tú solicitaste esta compra." si es suya.
- Navegar a la ficha del producto o del proveedor.

## Botones y controles
Chips de filtro (pendiente/aprobada/rechazada/Todas); botones **Aprobar** (primario, ícono check) / **Rechazar** (secundario); enlace "Revertir a pendiente" (solo líder, en resueltas); aviso bloqueado (candado) para comprador.

## Tablas / tarjetas / formularios / componentes relevantes
Tarjetas (`Card`/`CardBody`) por solicitud; `KpiCard`; `EmptyState`; badges de criterio (`CRITERION_LABEL`). **No hay formulario** en esta pantalla (la justificación se captura al crear la OC; aquí llega como texto "Pendiente de justificar por el comprador" por defecto).

### Campos de formulario
No aplica (no hay entrada editable). La justificación se muestra pero no se edita aquí. **Definición pendiente**: dónde/cómo edita el comprador su justificación (hoy nace fija).

## Estados posibles
- **Con datos**: cuando existen solicitudes (creadas al generar OC con desvíos o desde semillas).
- **Sin solicitudes** (estado/filtro vacío): `EmptyState` "Sin solicitudes" / "No hay solicitudes en este estado." **Existe**.
- **Vacía real**: si nunca se generó un desvío y no hay semillas, la lista está vacía → mismo `EmptyState`. **Existe**.
- **Cargando / Error**: no hay (estado en memoria/localStorage). **No aplica**.

## Navegación hacia otras pantallas
`/productos/{sku}`, ficha de proveedor. Llega desde OC (aviso, botón "Ver aprobaciones") y desde la barra de proceso.

## Flujo funcional completo
1. Al crear una OC con líneas fuera de criterio se generan solicitudes (`APR-{numero}-{idx}`).
2. El comprador ve sus solicitudes pendientes (bloqueadas para aprobar).
3. El líder revisa criterios, desvío, cobertura, margen y justificación; **aprueba o rechaza** (toast success/warning).
4. Al aprobarse todas las solicitudes de una OC, esa OC pasa a "aprobada" (estado derivado en la pantalla de Órdenes).

## Reglas de negocio inferibles
- Solo el **líder** aprueba/rechaza/revierte (`canApprove = role === "lider"`).
- Criterios etiquetados: desvío vs sugerido, monto alto, cobertura excesiva, margen bajo (definidos al crear la OC).
- Desvío % = `round((solicitado − sugerido)/sugerido × 100)` (100% si sugerido=0); cobertura resultante > objetivo × 1,3 se resalta (violeta); margen < mínimo en rojo.
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
- Con borrador: `HelpNote` de ayuda (N SKU y total del borrador) + **`LogisticsPlanView`** (detalle por camión, capacidad, centros, fechas, costo y alternativas — componente de negocio).
- Sin borrador: `EmptyState` "No hay una compra en curso" (explicativo).

## Secciones/bloques
PageHeader (título "Comprar · Plan de retiro" + "Volver al borrador") → `HelpNote` → `LogisticsPlanView` **o** `EmptyState`.

## Filtros disponibles
Ninguno.

## Acciones del usuario
- **Volver al borrador** → `/comprar/borradores` (header).
- (Sin borrador) **Ir a borradores** → `/comprar/borradores`.
- Interacciones internas del `LogisticsPlanView` (optimización de camiones) — detalle en el componente de logística, no en esta página.

## Botones y controles
"Volver al borrador" (header, secundario, ícono camión); "Ir a borradores" (empty state). El resto son controles del componente logístico.

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
- **Comprador**: ve **solo sus** recepciones (`r.buyer === buyer`); aterriza en "Por llegar".
- **Líder**: visión global del equipo, puede cambiar el alcance (todo el equipo / mis recepciones / un comprador); aterriza en "No despachado".

## Descripción detallada
Lista de recepciones (`mockReceptions`) filtrada por alcance (rol/comprador), texto, proveedor y rango de fechas. Las KPIs actúan como **selector de vista** (tabs implícitos, URL `tab`). La vista "No despachado" es especial: agrupa **líneas faltantes** por proveedor (y, para el líder, por comprador responsable) con acción de reordenar. Las demás vistas muestran la tabla de recepciones.

## Información que muestra
- **KPIs/selector**: No despachado (nº de líneas SKU no enviadas), Por llegar (in_transit/scheduled), Atrasadas (delayed), Con problemas (with_issues/partial), Recibidas (solo status `received`).
- **Línea de contexto**: "Mostrando {vista} · N recepciones/SKUs sin despachar" + alcance (líder) + botón "Ver todas".
- **Vista "No despachado"**: `HelpNote` + bloque "Responsables de reordenar" (líder, `CollapsibleSection`, solo si hay >1 comprador; agrupado por comprador con "N por reordenar" y "Ver") + tarjetas por proveedor con rendimiento (`supplierFulfillment`: `ratingLabel`, Despacho `fillRate`%, A tiempo `compliance`%) y líneas faltantes (SKU, estado de línea, pedido/recibido, faltante, botón Reordenar/En OC).
- **Vista tabla**: Orden/Proveedor (+ comprador si alcance "todos", si no bodega), Esperada/Recibida, barra de **Recepción** (recibido/esperado + "N SKUs sin despachar" si llegó), Calidad (Conforme/Con observación), Estado (badge), "Ver detalle →".
- **Drawer de detalle** (`ReceptionDetail`): banner de **impacto** (SKUs bajo cobertura mínima, el más urgente con quiebre estimado); fechas Esperada/Recibida + Estado; **rendimiento del proveedor** (Despacho completo `fillRate`%, Entrega a tiempo `compliance`%, SKUs sin despachar hist. `undeliveredSkus`; aviso si no es verde); nota de calidad; detalle por producto (Pedido/Recibido/Faltan, incidencia, cobertura/riesgo, reordenar); footer "Reordenar todo lo no despachado".

## Secciones/bloques
PageHeader → (líder) `Select` de alcance ("Viendo") → `FilterBar` → KPIs (5) → línea de contexto → **vista "No despachado"** (`HelpNote` + responsables + por proveedor) **o** tabla (`HelpNote` + `DataTable`) → Drawer de detalle.

## Filtros disponibles
- **Alcance** (solo líder, URL `alcance`): "Todo el equipo" (todos) / "Mis recepciones ({buyer})" (mias) / "Comprador: {nombre}". El comprador queda fijo en "mias".
- **Vista** (KPIs, URL `tab`): undelivered / arriving / delayed / issues / received / all.
- **Búsqueda** por OC, proveedor o comprador (URL `q`, placeholder "Buscar OC, proveedor o comprador").
- **Select Proveedor** (URL `prov`).
- **Rango de fechas** esperada/recibida (URL `desde`/`hasta`; referencia = recibida si existe, si no la esperada).
- Botón "Ver todas" (línea de contexto) y "Limpiar" (`FilterBar`).

## Acciones del usuario
- Cambiar alcance/vista/filtros.
- Abrir detalle de una recepción (clic en fila).
- **Reordenar** un SKU faltante (`reorder`) → agrega al borrador de OC (cantidad = faltante; `unitCost` del producto mock, 0 si no existe). Si ya está en el borrador, avisa "ya está…". Toast con enlace "Ver borrador OC" → **`/comprar/seguimiento`**.
- **Reordenar todo lo no despachado** (footer del drawer, itera sobre las líneas faltantes).
- (Líder) Saltar al alcance de un comprador desde "Responsables" ("Ver").
- Navegar a ficha de proveedor/producto.

## Botones y controles
`Select` de alcance; `FilterBar` (búsqueda + select proveedor + rango de fechas + summary + Limpiar); KPIs clicables (con estado `active`); botón "Ver todas"; `CollapsibleSection` de responsables (defaultOpen); botones "Reordenar"/"En OC" (deshabilitado si ya está); Drawer con botón de reorden masivo.

## Tablas / tarjetas / formularios / componentes relevantes
`DataTable` de recepciones (tarjeta móvil; fila roja si delayed/with_issues/partial); tarjetas por proveedor (vista no despachado); `CollapsibleSection` de responsables; `ReceptionDetail` (drawer). **Sin formularios de entrada** (las cantidades a reordenar se derivan del faltante).

### Campos de formulario
No aplica. La única "entrada" es la acción Reordenar, que usa la cantidad faltante calculada (`expected − received`).

## Estados posibles
- **Con datos**: normal.
- **Sin SKUs no despachados** (vista undelivered): "Sin SKUs pendientes por despachar. 🎉". **Existe**.
- **Sin resultados** (tabla): `emptyMessage` "No hay recepciones en esta vista." **Existe**.
- **Detalle sin desglose por SKU**: "Esta recepción no tiene desglose por SKU." **Existe** (según datos mock).
- **Cargando / Error**: no hay. **No aplica** (mock).

## Navegación hacia otras pantallas
`/comprar/seguimiento` (tras reordenar, vía toast), ficha de proveedor (`supplierPath`), ficha de producto (`productPath`).

## Flujo funcional completo
1. Ver por llegar / atrasadas / con problemas.
2. Detectar SKUs **no despachados** (vista dedicada), agrupados por proveedor y responsable.
3. Reordenar lo faltante al borrador de OC (individual o masivo).
4. (Líder) Identificar proveedores incumplidores y encargados a los que asignar la reposición.
5. Cerrar el ciclo volviendo a Borradores/Seguimiento con las nuevas líneas.

## Reglas de negocio inferibles
- **Estado de línea** (`lineStatus`): recibido ≥ esperado → Completo (verde); recibido = 0 → No despachado (rojo); entre medio → Parcial (ámbar).
- **Faltante** = `expected − received`; solo se cuenta en recepciones ya llegadas (`ARRIVED` = received/partial/with_issues).
- **Impacto/riesgo de quiebre** (drawer): un SKU faltante está "en riesgo" si su cobertura actual ≤ `max(7, supplierLeadTimeDays)`.
- **Rendimiento del proveedor** (`supplierFulfillment`): fill rate, cumplimiento a tiempo (puede ser null), SKUs sin despachar históricos, nº de recepciones llegadas, rating con color; se advierte si el tono no es "verde".
- **Reordenar** usa el costo del producto mock y no duplica si el SKU ya está en el borrador.
- **Alcance por rol**: comprador restringido a sus recepciones; líder puede ver todo o por comprador. Aterrizaje distinto por rol (líder → "No despachado", comprador → "Por llegar").
- Estados de recepción (`RECEPTION_STATUS`): Programada (scheduled), En tránsito (in_transit), Recibida (received), Parcial (partial), Con problemas (with_issues), Atrasada (delayed).
- KPI "Recibidas" cuenta solo `received`; KPI "Con problemas" agrupa `with_issues` + `partial`.

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
- Recomendaciones de reposición priorizadas, con simulación de cantidad, escenarios, razonamiento "por qué N", alertas y control de presupuesto/OTB.
- Planificación de temporada por escenarios con seguimiento y alertas.
- RFQ: creación, comparación de ofertas por línea y conversión a OC (mejor precio disponible).
- Editor de OC (una por proveedor) con cabecera, edición por línea, contexto por línea (inventario/venta/proveedor/landed cost) y plan de retiro en vivo.
- Aprobaciones con flujo de roles (comprador solicita, líder aprueba) y trazabilidad de decisiones.
- Recepciones con foco en "no despachado", rendimiento de proveedor y reorden (individual/masivo).

## Funcionalidades secundarias
- Exportación CSV (Reposición), deep-links (`?oc=`, `?rid=`), overrides/ignorados persistentes, aviso de OC abiertas/solapes, sensibilidad de demanda, comparación de proveedores, historial/auditoría y factura asociada en el detalle de OC, plan de retiro como página independiente.

## Dependencias con otros módulos
- **Productos / SKU 360** (`/productos/{sku}`): fichas de producto y datos base (`mockProducts`).
- **Proveedores** (`supplierPath`, `mockSuppliers`, `supplierFulfillment`): comparación, lead time, cumplimiento, rendimiento.
- **Presupuesto / Open-to-Buy** (`/presupuesto`, `draftBudgetImpact`, `monthlyPurchaseBudget` = 28.000.000, `mockRules`): control de gasto por categoría.
- **Reglas de compra** (`mockRules`, `resolveRuleForProduct`, `purchaseRules`): objetivo de inventario (default 45 d), margen mínimo, criterios de aprobación.
- **Logística** (`LogisticsPlan`, `usePickupPlan`): plan de retiro y costo total de abastecimiento.
- **Contextos transversales**: `OcDraftContext` (carrito), `PurchaseFlowContext` (aprobaciones/decisiones), `RoleContext`, `BuyerContext`, `ToastContext`, `DataContext`/`apiClient` (backend opcional, `backendEnabled`).
- **Datos históricos/temporada**: `mockSeasons`, `seasonPlan`, `seasonTracking`, `mockRecommendations`, `mockRfq`, `mockPurchaseOrders`, `mockReceptions`, `mockApprovals`, `mockOcHistory`, `skuProfile` (ABC/XYZ).

> **Nota de datos mock**: no hay backend activo por defecto; toda la persistencia del usuario (borrador, RFQs creadas, OC creadas, overrides de estado, ignorados) vive en `localStorage`. Fechas y vencimientos se miden contra `TODAY_ISO` (fecha simulada de la demo, 2026). No existen estados de "cargando" ni "error" reales por ausencia de red.

---

## Verificación de cobertura

Contraste del documento con el código real (archivos leídos: `ReplenishmentPage.tsx` + `replenishment/{components,helpers,types}`, `SeasonPlannerPage.tsx` + `seasonPlanner/{components,constants}`, `RfqPage.tsx`, `PurchaseOrdersPage.tsx`, `PurchaseOrdersSections.tsx`, `purchaseOrders/DraftLineContext.tsx`, `ApprovalsPage.tsx`, `PlanRetiroPage.tsx`, `ReceptionsPage.tsx`, `receptions/{ReceptionDetail,helpers}`).

**Pantallas / sub-vistas**: 7 pantallas + las 3 vistas por ruta de Órdenes (Borradores/Órdenes/Seguimiento) + deep-links `?oc=` y `?rid=`. Cubiertas.

**Overlays**: modal "Ajustar sugerencia", `RecommendationDecisionDrawer`, drawer de detalle de temporada, `CreateRfqModal`, `ComparisonDrawer`, drawer editor de borrador, `OcDetailModal`, drawer `ReceptionDetail`. Cubiertos.

**Controles con etiqueta exacta**: botones de header, KPIs, tabs, chips, steppers, botones de footer de cada drawer/modal y acciones masivas — transcritos con su texto literal. Cubiertos.

**Campos de formulario**: Modal ajustar (Cantidad, Proveedor); RFQ (Nombre/referencia, Productos, Proveedores, Fecha de vencimiento con default `2026-07-08`); Editor OC cabecera (Bodega, Condición de pago, Fecha esperada, Observaciones) y por línea (Cantidad `min=0`, Costo unit. `min=0`, Desc. % `0–100`); Cantidad OC en `DraftLineContext`. Cubiertos con tipo/requerido/default/validación.

**Columnas de tabla y KPIs**: Reposición (9 columnas), Temporada plan (8) y seguimiento (8), RFQ (5 columnas + comparación de 5), OC (8 columnas + 4 KPIs), Recepciones (6 columnas + 5 KPIs). Cubiertos.

**Umbrales/constantes reales verificados**: presupuesto mensual 28.000.000; múltiplos de compra 24/20/10/1 (≥120&%24 / ≥100 / ≥40 / resto); margen bajo <25%; cobertura objetivo 45–60 d; ajuste 40% por OC atrasada; criterios de aprobación (desvío 20%, monto ≥5.000.000, cobertura >objetivo×1,3, margen<mínimo); objetivo inventario default 45 d; numeración OC base 143; secuencia RFQ `9 + creadas`; sobre-recomendación ×1,2; cobertura alta >90 d; riesgo quiebre temporada >15%; nivel servicio ≥95%; varianza canal ±8%; confianza `max(62, 90−|tend|·0,4)`; pack size = múltiplo×2; impacto recepción cover ≤ max(7, lead time). Cubiertos.

**Permisos por rol**: visibilidad de OC y recepciones (comprador = suyas / líder = equipo), aprobación solo líder, alcance de equipo solo líder, `buyerName` líder = "Catalina Saavedra". Cubiertos.

**Estados reales vs inexistentes por mock**: `EmptyState`/`emptyMessage` reales documentados por pantalla; ausencia de "cargando"/"error" marcada como "No aplica (mock)". Cubiertos.

**Definiciones pendientes destacadas**: "Optimizar presupuesto" placeholder; "Postergar" = ignorar; nombre de RFQ no persistido; sin acción "Enviar RFQ"; justificación de aprobación nace fija; replanificación de temporada simulada; reorden lleva a `/comprar/seguimiento`; no hay registro manual de recepción; no se bloquea crear OC sobre OTB/MOQ.

**Elementos sin cambios respecto de la versión previa (confirmados correctos)**: estructura de 7 pantallas, flujo del carrito global, contextos transversales, barra de proceso (6 vs 8 etapas). No se detectaron pantallas, modales ni rutas faltantes.
