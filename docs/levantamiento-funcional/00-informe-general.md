# Informe general del sistema — Plataforma de Compras (compras-cata)

Síntesis del levantamiento funcional realizado **solo a partir del frontend**. Para el detalle pantalla por pantalla, ver los archivos de cada módulo enlazados en el [README](./README.md).

> **Naturaleza técnica observada.** Aplicación SPA React + TypeScript, en español. **No hay backend**: todos los datos provienen de archivos *mock* deterministas en memoria (`src/data/*`), con una fecha "hoy" fija (`TODAY_ISO = 2026-06-24`; la estacionalidad de proveedores usa además un "hoy" propio fijado en Junio 2026). La **única persistencia** es `localStorage` del navegador. Se detectaron ~23 claves `localStorage` en uso (sesión `compras:auth`, rol `compras:role`, alcance `compras:scope`, densidad, borrador de OC, y *overrides* locales: `po-created`, `po-status`, `rec-overrides`, `rec-ignored`, `alert-status`, `rfq`, `rfq-status`, `price-lists`, `campaign-plans`, `campaigns`, `rewards`, entre otras). La mayoría de las acciones "de escritura" (aprobar, enviar, reasignar, dar de baja, recepcionar) producen **toasts y navegación**, pero **no mutan los datos** de forma persistente. Esto se marca como tal a lo largo de la documentación.
>
> **Profundidad.** Cada documento de módulo incluye una sección final **"Verificación de cobertura"** con el contraste 1:1 contra el código (etiquetas exactas de controles, columnas, KPIs, umbrales/constantes reales) y los hallazgos/definiciones pendientes por pantalla.

---

## 1. Inventario completo de módulos

| # | Módulo | Objetivo | Rol | Documento |
|---|--------|----------|-----|-----------|
| 1 | **Inicio y Mi Cartera** | Portada operativa ("qué hacer hoy") y visión 360° de la cartera del comprador (categorías, marcas, proveedores, productos). | Comprador | [01](./01-inicio-y-mi-cartera.md) |
| 2 | **Comprar** | Workspace operacional de la compra: decidir, planificar, cotizar, armar OC, aprobar, seguir y recibir. | Comprador (+ Líder aprueba) | [02](./02-comprar.md) |
| 3 | **Inventario** | Salud del inventario: cobertura, sobrestock, stock muerto, quiebres, venta no capturada y documentos. | Comprador | [03](./03-inventario.md) |
| 4 | **Rentabilidad** | Margen, contribución, GMROI, ventas, margen por canal, estacionalidad, variaciones de costo y presupuesto. | Comprador | [04](./04-rentabilidad.md) |
| 5 | **Surtido** | Gestión de surtido/categoría, racionalización de duplicados, campañas y anticipación comercial. | Comprador | [05](./05-surtido.md) |
| 6 | **Proveedores** | Performance comercial, cumplimiento, negociación y ficha maestra del proveedor. | Comprador | [06](./06-proveedores.md) |
| 7 | **Mi plan** | Desempeño personal, alertas, señales de ventas, aprendizaje de compra y reportes. | Comprador | [07](./07-mi-plan.md) |
| 8 | **Equipo y Líder** | Visión de equipo: panel, alertas, compradores, competencia, metas y carga. | **Solo Líder** (`RoleGate`) | [08](./08-equipo-y-lider.md) |
| 9 | **Sistema, Acceso y Estructura** | Login, configuración/reglas y mecanismos transversales (navegación, roles, borrador OC, notificaciones, densidad, guardas). | Ambos | [09](./09-sistema-acceso-y-estructura.md) |

---

## 2. Inventario de pantallas y rutas

Páginas únicas y sus rutas (incluyendo **alias** que renderizan la misma pantalla y **redirecciones** heredadas de renombres). Total: **~40 rutas** que resuelven a **~33 pantallas** distintas.

| Pantalla | Ruta(s) principal(es) | Alias / redirecciones | Módulo |
|----------|----------------------|-----------------------|--------|
| Login | `/login` | — | 9 |
| Inicio | `/` | `/mi-panel` → `/` | 1 |
| Mi Cartera (resumen y sub-vistas) | `/mi-cartera`, `/mi-cartera/productos-clave`, `/mi-cartera/marcas`, `/mi-cartera/proveedores`, `/mi-cartera/oportunidades` | — | 1 |
| Categorías | `/categorias` | — | 1 |
| Detalle de categoría | `/categorias/:id` | — | 1 |
| Productos (SKUs) | `/productos` | — | 1 |
| Detalle de producto (SKU 360) | `/productos/:sku` | — | 1 |
| Decisiones / Reposición | `/comprar/decisiones`, `/reposicion` | `/comprar/reposicion` | 2 |
| Planificar temporada | `/comprar/temporada` | — | 2 |
| Cotizaciones (RFQ) | `/cotizaciones`, `/comprar/cotizaciones` | — | 2 |
| Órdenes de compra (Borradores / Órdenes / Seguimiento) | `/ordenes-compra`, `/comprar/borradores`, `/comprar/ordenes`, `/comprar/seguimiento` | — | 2 |
| Aprobaciones | `/aprobaciones`, `/comprar/aprobaciones` | — | 2 |
| Plan de retiro | `/comprar/plan-retiro` | — | 2 |
| Recepciones | `/recepciones`, `/comprar/recepciones` | — | 2 / 3 |
| Cobertura & sobrestock (Análisis de inventario) | `/inventario` | — | 3 |
| Venta no capturada | `/venta-no-capturada` | `/oportunidades-perdidas` → `/venta-no-capturada` | 3 |
| Documentos | `/documentos` | — | 3 |
| Ranking & liquidación (Análisis de compra) | `/analisis-compra` | — | 4 |
| Ventas | `/ventas` | — | 4 |
| Margen por canal | `/margen-canal` | — | 4 |
| Estacionalidad y canales | `/temporadas` | — | 4 |
| Variaciones de costo (Alzas de precio) | `/alzas-precio` | — | 4 |
| Presupuesto | `/presupuesto` | — | 4 |
| Gestión de surtido | `/surtido` | — | 5 |
| Duplicidad (Catálogo optimizado) | `/surtido-redundante` | `/catalogo-optimizado` → `/surtido-redundante` | 5 |
| Campañas | `/campanas` | — | 5 |
| Productos a potenciar (Anticipación) | `/anticipacion` | `/campanas-oportunidades` → `/anticipacion` | 5 |
| Performance de proveedores | `/proveedores` | — | 6 |
| Ficha de proveedor | `/proveedores/:id` | — | 6 |
| Mi desempeño / Metas | `/mi-desempeno` | — | 7 |
| Alertas | `/alertas` | — | 7 |
| Señales de ventas | `/senales-ventas` | — | 7 |
| Aprendizaje de compra | `/aprendizaje` | `/calidad-compra` → `/aprendizaje`; `/decisiones` → `/aprendizaje?tab=decisiones` | 7 |
| Resultados / Reportes | `/reportes` | — | 7 |
| Panel del equipo | `/equipo` | — | 8 *(Líder)* |
| Alertas del equipo | `/equipo/alertas` | — | 8 *(Líder)* |
| Compradores | `/equipo/compradores` | — | 8 *(Líder)* |
| Competencia / Ranking | `/equipo/ranking` | — | 8 *(Líder)* |
| Metas (OKRs) | `/equipo/metas` | — | 8 *(Líder)* |
| Carga & reasignación | `/equipo/carga` | — | 8 *(Líder)* |
| Configuración / Reglas | `/reglas` | — | 9 |
| *(fallback)* | `*` | → `/` | — |

---

## 3. Inventario de flujos funcionales identificados

1. **Acceso** → Login (mock, no valida credenciales reales) → guarda `RequireAuth` → portada Inicio.
2. **Ciclo de reposición (núcleo del producto):** Inicio/Decisiones detecta necesidad → drawer de recomendación explica el *porqué* y advierte alertas → "Agregar al borrador" → **Borrador OC** (carrito global por proveedor) → formalizar OC → **Aprobaciones** (si sale de criterio) → **Seguimiento** de OC emitidas → **Recepciones**.
3. **Cotización (RFQ):** crear cotización → comparar ofertas de proveedores → convertir la mejor en OC.
4. **Planificación por temporada:** diagnóstico de estacionalidad/canales (Rentabilidad) → Planificar temporada (demanda por origen, escenarios, compra sugerida) → borrador OC.
5. **Gestión de cartera:** Resumen de cartera → baja a Categorías → Categoría → Producto (SKU 360) → acción de compra.
6. **Gestión de surtido:** rol de categoría / surtido por tienda → detección de duplicidad → decisión de alta/baja/liquidación; campañas y anticipación comercial.
7. **Relación con proveedor:** Performance → Ficha (negociación, condiciones/acuerdos, temporada, catálogo, órdenes, recepciones, alertas).
8. **Rentabilidad y presupuesto:** ranking/liquidación, ventas, margen por canal, variaciones de costo (aprobación de nuevas listas), presupuesto por categoría (Open-to-Buy).
9. **Seguimiento personal:** metas/score → alertas → señales de ventas → aprendizaje (calidad de compra + historial de decisiones) → reportes.
10. **Gestión de equipo (Líder):** panel del equipo → alertas del equipo → compradores → competencia/ranking → metas → carga & reasignación.
11. **Ajustes transversales:** cambio de rol (Comprador/Líder), densidad de UI (Cómodo/Compacto), centro de notificaciones, reglas de compra.

---

## 4. Funcionalidades principales del producto

- **Recomendación de compra explicable:** cantidad sugerida descompuesta en factores (demanda en lead time + stock de seguridad + cobertura objetivo − disponible − en tránsito), con confianza, escenarios (conservador/recomendado/agresivo) y sensibilidad de demanda.
- **Alertas inteligentes de compra:** meses de inventario, OC abierta duplicada, proveedor con atrasos, capacidad de bodega.
- **Perfil de decisión del SKU:** clasificación ABC/XYZ, rotación, rentabilidad/margen, GMROI.
- **Borrador de OC global (carrito) por proveedor**, con restricciones (mínimos, presupuesto, landed cost) y flujo de aprobación por desvío.
- **Cotizaciones (RFQ)** y comparación de proveedores lado a lado.
- **Planificación por temporada** con demanda por canal/origen.
- **Plan de retiro / logística** (camiones, capacidad, centros, costo de flete).
- **Análisis de inventario, rentabilidad, ventas y margen por canal.**
- **Gestión de surtido y racionalización de catálogo.**
- **Ficha de proveedor** con negociación y acuerdos comerciales.
- **Presupuesto (Open-to-Buy) por categoría.**
- **Capa de gestión de equipo para el Líder** (score, ranking, metas, carga).
- **Ayuda contextual (ⓘ)** y navegación por módulos con sub-pestañas, responsive (bottom sheets en móvil).

---

## 5. Funcionalidades que parecen incompletas o pendientes

Detectadas en el frontend (cada módulo detalla su ubicación):

- **Persistencia real:** casi todas las acciones de escritura no persisten (solo toasts/navegación). Necesitan backend: crear/editar/enviar OC y RFQ, aprobar/rechazar, reasignar carga, dar de baja compradores, registrar recepciones, editar reglas de compra.
- **RFQ:** el nombre/referencia de la cotización no se persiste; no existe acción explícita de "Enviar RFQ" al proveedor; la conversión a OC es simulada.
- **Recepciones:** no hay registro manual de recepción (confirmar/observar cantidades) que persista.
- **Aprobaciones / Alzas de precio:** el flujo de aprobación es simulado y **no restringe por rol** en varias vistas (un comprador podría "aprobar"); la justificación del comprador nace con texto fijo.
- **Alertas:** no existe acción "Ignorar/Resolver" persistente pese a que el modelo de datos contempla esos estados.
- **Campañas:** conviven **dos modelos de campaña desconectados** (`CampaignPlan` en `/campanas` vs `CreatedCampaign` en `/anticipacion` y liquidación en `/surtido-redundante`) que no se sincronizan; el rendimiento de campaña es simulado.
- **Configuración/Reglas (`/reglas`):** los cambios no se guardan y la ruta **no tiene entrada en el menú**.
- **Navegación:** algún botón (p. ej. "Ver decisiones" en Inicio) navega a destino provisional (`/`).
- **Inconsistencias de datos/nomenclatura:** alguna fecha "hoy" hardcodeada (p. ej. `2026-06-26`) y nomenclatura OTIF/cumplimiento no uniforme entre vistas.
- **Estados de carga/error:** no existen (datos mock síncronos); habrá que diseñarlos al conectar backend (skeletons, errores, reintentos).
- **Paginación:** las tablas renderizan todo el conjunto; sin paginación/virtualización para volúmenes reales.

**Hallazgos puntuales detectados en la ampliación (a corregir/definir):**

- **Presupuesto:** conviven dos reglas de estado (`deriveStatus` OTB vs proyección); la tabla usa la de OTB y `recibido` se calcula pero no se muestra.
- **Campañas:** el plan reparte 4 canales pero el "rendimiento" atribuye a 6 (incluye Google Ads/Mailing) — modelos no alineados; faltan un tipo (`not_recommended`) y un canal (`b2b`) en los datos de oportunidades.
- **Ranking (Equipo):** la anonimización de compradores (`String.fromCharCode(65+i)` con índice global) "salta" la letra en la posición del propio comprador — posible confusión.
- **Reportes:** el CSV de "OC abiertas" exporta columnas (Comprador, Fecha creación) que no aparecen en la tabla en pantalla.
- **Alertas / Señales:** el estado "Ignorada" existe en el modelo/tab/select pero no hay acción de UI para asignarlo; el `InfoHint` explicativo se pierde en el modo embebido de Aprendizaje.
- **Cartera vs Detalle:** el rol "Margen" usa dos umbrales distintos (≥36% en cartera vs ≥34% en detalle de categoría) y el "costo sin actualizar" combina un umbral dinámico (−90d en Inicio) con uno fijo (`2026-04-01` en Productos).
- **Proveedores:** `fillRate` por defecto = 100% cuando no hay recepciones (puede sobrestimar cumplimiento); "hoy" estacional fijado en Junio 2026.
- **Fechas hardcodeadas** en varias vistas (p. ej. "↑ +3 vs mes anterior", `2026-06-26`) que deberán derivarse de datos reales.

---

## 6. Suposiciones realizadas durante el análisis *(marcadas como tales)*

> Todas son **suposiciones** derivadas de observar el frontend; deben confirmarse con negocio antes de construir backend.

- **[Suposición]** El sistema es de **uso interno** del área de compras de un retailer; no hay portal de proveedor ni de cliente.
- **[Suposición]** Existen **dos roles** (Comprador y Líder de compras); el Líder es superconjunto del Comprador. No se observan otros perfiles (finanzas, bodega, administrador) aunque el negocio probablemente los requiera.
- **[Suposición]** Las cifras "de compañía/categoría" (ventas, inventario valorizado agregados) provienen de sistemas superiores (ERP/BI), mientras que las listas de producto son la muestra de catálogo; el frontend mezcla ambas escalas intencionalmente para la demo.
- **[Suposición]** El "borrador de OC" es un carrito **por comprador**; no se observa colaboración multiusuario ni bloqueo concurrente.
- **[Suposición]** Los umbrales de negocio visibles (p. ej. margen bajo < 25%, cobertura objetivo 45–60 días, desvío que gatilla aprobación) son **parámetros configurables** por la organización, no constantes de producto.
- **[Suposición]** La autenticación real usará un proveedor de identidad corporativo; el login actual es un *placeholder*.
- **[Suposición]** "Aprendizaje de compra" (calidad + historial de decisiones) se alimenta de resultados posteriores a la compra (recepción, venta), que hoy son mock.

---

## 7. Preguntas funcionales para responder antes del backend

**Modelo de datos y maestros**
1. ¿Cuál es la fuente de verdad de productos, costos, precios y stock (ERP/WMS)? ¿Frecuencia de sincronización?
2. ¿Cómo se calculan oficialmente cobertura, stock de seguridad, punto de reorden, ABC/XYZ y GMROI? ¿El frontend debe calcularlos o consumirlos?
3. ¿Multi-bodega/multi-tienda: el stock y las capacidades son por ubicación? ¿Cómo se modela la capacidad de bodega real?

**Compra, OC y aprobación**
4. ¿Ciclo de vida oficial de una OC y sus transiciones válidas? ¿Quién puede emitir, aprobar, cancelar?
5. ¿Reglas de aprobación (montos, desvío de presupuesto, margen, proveedor bloqueado)? ¿Niveles de aprobación?
6. ¿La OC se envía al proveedor por el sistema (EDI/email) o es externa? ¿Confirmación del proveedor?
7. ¿Cómo se cierra el ciclo con la recepción (parcial, con diferencia) y la facturación?

**Cotizaciones y proveedores**
8. ¿Flujo real de RFQ: envío, recepción de ofertas, adjudicación, trazabilidad?
9. ¿Qué acuerdos comerciales/condiciones de pago se gestionan aquí vs en otro sistema?
10. ¿Definición oficial de cumplimiento/OTIF y lead time del proveedor?

**Presupuesto, precios y campañas**
11. ¿Cómo se define y controla el presupuesto (Open-to-Buy)? ¿Bloquea la compra o solo advierte?
12. ¿Flujo de nuevas listas de precio (alzas de costo): aprobación, vigencia, impacto en margen?
13. ¿Se unifican los dos modelos de campaña? ¿Origen del rendimiento de campaña (analítica/ads)?

**Roles, permisos y organización**
14. ¿Qué perfiles existen además de Comprador y Líder? ¿Matriz de permisos por acción?
15. ¿Asignación de cartera (categorías/proveedores) por comprador y reglas de reasignación?

**Alertas, señales y notificaciones**
16. ¿Origen de las señales de ventas (terreno/tiendas) y de las alertas? ¶¿Acciones y estados persistentes (resolver/ignorar)?
17. ¿Canales de notificación (in-app, email, push) y reglas de disparo?

**No funcionales**
18. Volúmenes reales (SKUs, OC/mes) → necesidad de paginación/virtualización y performance.
19. Estados de carga/error/vacío y comportamiento offline.
20. Auditoría y trazabilidad de decisiones de compra (quién, cuándo, por qué).

---

*Este informe es un levantamiento de solo-lectura basado en el frontend. No describe implementación de backend; las decisiones de arquitectura de datos y APIs quedan abiertas a las respuestas de la sección 7.*
