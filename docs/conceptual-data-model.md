# Modelo conceptual de datos

Este documento define las principales entidades del sistema Inventory App y sus relaciones conceptuales antes de diseñar el modelo relacional.

## Entidades principales

- Business
- User
- BusinessMembership
- Plan
- Subscription
- Location
- Category
- Product
- ProductVariant
- InventoryBalance
- Attribute
- AttributeValue
- Supplier
- InventoryMovement
- Sale
- SaleItem
- Payment
- AuditLog

## Relaciones principales

- La relación entre usuarios y negocios se representa mediante `User → BusinessMembership → Business`.
- Un usuario puede pertenecer a varios negocios mediante sus membresías.
- Un negocio puede tener múltiples usuarios mediante sus membresías.
- Cada membresía pertenece a un usuario y a un negocio, y contiene el rol `OWNER` o `EMPLOYEE` que el usuario desempeña en ese negocio.
- La autenticación del usuario será gestionada por un proveedor externo y requerirá correo electrónico verificado.
- El nombre comercial de un negocio no será globalmente único.
- La suscripción de un negocio estará asociada a un plan. La cardinalidad entre `Business` y `Subscription`, así como el historial de suscripciones, se decidirán durante el diseño relacional y del dominio de billing.
- `Plan` representará conceptualmente las capacidades o límites comerciales aplicables a una suscripción.
- `Subscription` representará conceptualmente el ciclo de trial y suscripción de un negocio.
- El trial inicial durará 30 días y `TRIALING` será un estado o concepto confirmado de `Subscription`.
- Un negocio puede registrar múltiples categorías, productos, proveedores y ventas.
- Un negocio tiene ubicaciones de inventario y contará con al menos una `Location` predeterminada.
- Una categoría puede contener múltiples productos.
- Un producto puede tener múltiples variantes.
- Una variante representa la unidad concreta sobre la que se controla el inventario.
- `InventoryBalance` representa el saldo actual de una variante en una ubicación.
- Cada combinación de `ProductVariant` y `Location` tiene conceptualmente un único `InventoryBalance`.
- Una variante puede registrar múltiples movimientos de inventario, asociados a la ubicación afectada.
- Una venta está asociada a una ubicación.
- Una venta contiene uno o más detalles de venta.
- Cada detalle de venta referencia una variante.
- Una venta registra uno o más `Payment` para permitir una futura ampliación a pagos divididos.
- `Payment` representa exclusivamente pagos que el negocio registra por sus ventas.
- La facturación y los pagos de la suscripción a Inventory App pertenecen a un dominio separado y no reutilizan `Payment`.
- Las operaciones que requieran trazabilidad deberán poder generar registros de auditoría.

## Suscripciones y trial

La suscripción pertenece a `Business`, no directamente a `User`. Una nueva dirección de correo no representa por sí sola el derecho automático a un nuevo trial; el ciclo se modelará alrededor del negocio.

El modelo deberá permitir que un plan establezca capacidades o límites, como la cantidad de ubicaciones habilitadas, sin fijar todavía valores definitivos. La relación `Business 1:N Location` estará soportada desde la V1 aunque el plan contratado pueda limitar cuántas ubicaciones utiliza un negocio.

Los demás estados y transiciones definitivos de `Subscription` quedan pendientes hasta diseñar el dominio de billing y evaluar el proveedor externo.

El fin del trial o de una suscripción no eliminará inmediatamente los datos del negocio. La política definitiva de acceso restringido, conservación, exportación y eventual eliminación permanece pendiente.

## Pagos de ventas y facturación SaaS

`Payment` forma parte del dominio de ventas. Los cobros de suscripción que Inventory App realiza al negocio pertenecen al dominio de facturación SaaS y deberán modelarse de manera independiente cuando ese dominio sea diseñado.

La facturación SaaS utilizará un proveedor externo todavía no seleccionado. El modelo propio no almacenará directamente datos sensibles de tarjetas y no considerará confirmado un pago basándose únicamente en información enviada por el frontend.

## Precios y descuentos

Cada variante podrá manejar conceptualmente:

- Costo de compra.
- Precio de lista.
- Precio mínimo opcional.

El precio de lista no se modificará cuando se otorgue una rebaja durante una venta.

El detalle de venta conservará:

- Precio de lista histórico.
- Descuento aplicado.
- Precio unitario final.
- Subtotal.

Esto permitirá conservar correctamente el historial incluso si posteriormente cambia el precio del producto.

## Inventario

El stock será controlado a nivel de variante y ubicación. `ProductVariant` seguirá siendo la unidad inventariable, pero el saldo actual no se almacenará directamente en ella.

`InventoryBalance` representará el saldo actual para cada combinación de `ProductVariant` y `Location`. `InventoryMovement` conservará la trazabilidad de los cambios de stock de la variante en la ubicación correspondiente.

Todo cambio de existencias deberá generar un movimiento de inventario que permita conocer:

- Tipo de movimiento.
- Cantidad.
- Ubicación afectada.
- Stock anterior.
- Stock posterior.
- Motivo.
- Usuario responsable.
- Fecha.

## Ventas registradas posteriormente

Las ventas realizadas durante una interrupción de conectividad podrán registrarse cuando se recupere la conexión.

Se diferenciará entre la fecha en que ocurrió la venta y la fecha en que fue registrada en el sistema.

Estas operaciones seguirán siendo ventas normales y deberán actualizar el inventario, movimientos, pagos y reportes correspondientes.

## Pendiente de refinamiento

Antes de construir el modelo relacional se profundizará en:

- Permisos más granulares, únicamente como posible evolución futura si existe una necesidad real.
- Atributos y variantes.
- Proveedores y abastecimiento.
- Entradas de mercadería.
- Auditoría.
- Estados y transiciones restantes de `Subscription`.
- Precios, límites y capacidades definitivas de los planes.
- Política de acceso restringido, conservación, exportación y eventual eliminación de datos.
