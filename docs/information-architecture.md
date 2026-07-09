# Information Architecture

## Principio

Sidebar = modulos principales. Top navigation = vistas del modulo activo. Mobile = modulo actual + accesos prioritarios + menu completo.

## Modulos principales

- Inicio: prioridades y decisiones de hoy.
- Mi cartera: salud comercial, categorias, productos clave, marcas, proveedores y oportunidades.
- Comprar: workspace operacional completo desde necesidad hasta recepcion.
- Inventario: cobertura, sobrestock, venta no capturada y recepciones.
- Rentabilidad: ranking, ventas, margen, costos y presupuesto.
- Catalogo: duplicidad, productos, categorias y campanas.
- Proveedores: performance y detalle 360.
- Mi plan: objetivos, alertas, senales y resultados.

## Reglas de pantalla

- Una pregunta principal por vista.
- Maximo tres niveles visuales: principal, secundario, detalle.
- Las tablas muestran lo escaneable; el detalle vive en drawer o pagina 360.
- Los submodulos secundarios no deben aparecer como navegacion permanente.

## Flujo objetivo

Observar -> Entender -> Priorizar -> Decidir -> Ejecutar -> Revisar resultado.

## Journey de compra

Comprar se organiza como proceso, no como coleccion de herramientas:

1. Necesidad: detectar quiebres, aceleraciones, reposicion y excepciones.
2. Preparacion: revisar producto, proveedor, stock, margen, cotizar y negociar.
3. Borrador: construir la OC por proveedor, ajustar cantidades y revisar restricciones.
4. Aprobacion: validar desviaciones contra reglas, presupuesto, cobertura y margen.
5. Ordenes: revisar ordenes emitidas y estados.
6. Seguimiento: seguir OC enviadas, confirmadas o con entrega parcial.
7. Por recibir: recepciones, faltantes e incidencias.

Inventario, Rentabilidad, Catalogo y Proveedores se mantienen como espacios analiticos, pero Comprar debe traer su informacion resumida de forma contextual para evitar saltos de pantalla.

## Gestion de cartera

Mi cartera debe responder como administrar el negocio completo, no solo que comprar:

1. Resumen: resultado economico, salud, inventario y GMROI.
2. Categorias: salud por categoria y entrada al category workspace.
3. Productos clave: estrellas, tractores, margen, emergentes, deterioro, detenidos y riesgo.
4. Marcas: venta, crecimiento, margen, inventario y quiebres.
5. Proveedores: dependencia, alternativas y preparacion de negociacion.
6. Oportunidades: crecimiento con poca cobertura, buen margen con baja exposicion, alternativas de proveedor y brechas comerciales.

## Rutas de prototipo prioritarias

- `/` -> prioridad critica -> SKU 360 -> compra.
- `/comprar/decisiones` -> filtro criticos -> recommendation drawer -> simulador.
- `/comprar/borradores` -> compra en curso -> advertencias -> formalizar OC.
- `/comprar/borradores` -> analizar linea -> contexto inventario/venta/proveedor sin salir de la OC.
- `/inventario` -> sobrestock -> producto -> transferencia conceptual.
- `/analisis-compra` -> candidato a liquidar -> detalle.
- `/surtido-redundante` -> grupo redundante -> comparacion.
- `/proveedores` -> proveedor critico -> supplier detail.
