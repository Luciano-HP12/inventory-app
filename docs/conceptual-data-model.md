# Modelo conceptual de datos

Este documento define las principales entidades del sistema Inventory App y sus relaciones conceptuales antes de diseñar el modelo relacional.

## Entidades principales

- Business
- User
- Permission
- Category
- Product
- ProductVariant
- Attribute
- AttributeValue
- Supplier
- InventoryMovement
- Sale
- SaleItem
- Payment
- AuditLog

## Relaciones principales

- Un negocio puede tener múltiples usuarios.
- Un usuario pertenece a un negocio.
- Un usuario puede disponer de permisos específicos.
- Un negocio puede registrar múltiples categorías, productos, proveedores y ventas.
- Una categoría puede contener múltiples productos.
- Un producto puede tener múltiples variantes.
- Una variante representa la unidad concreta sobre la que se controla el inventario.
- Una variante puede registrar múltiples movimientos de inventario.
- Una venta contiene uno o más detalles de venta.
- Cada detalle de venta referencia una variante.
- Una venta registra uno o más pagos para permitir una futura ampliación a pagos divididos.
- Las operaciones sensibles podrán generar registros de auditoría.

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

El stock será controlado a nivel de variante.

Todo cambio de existencias deberá generar un movimiento de inventario que permita conocer:

- Tipo de movimiento.
- Cantidad.
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

- Sistema de permisos.
- Atributos y variantes.
- Proveedores y abastecimiento.
- Entradas de mercadería.
- Auditoría.