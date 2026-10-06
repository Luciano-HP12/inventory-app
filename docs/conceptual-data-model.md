# Modelo conceptual de datos

Este documento define las principales entidades del sistema Inventory App y sus relaciones conceptuales antes de diseñar el modelo relacional.

## Entidades principales

- Business
- User
- BusinessMembership
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
