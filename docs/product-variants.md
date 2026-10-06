# Productos y variantes

Inventory App manejará el inventario a nivel de variantes para permitir su adaptación a diferentes tipos de negocios.

## Producto

Un producto representa el concepto general del artículo.

Ejemplo:

- Producto: Funda iPhone 16
- Categoría: Fundas
- Marca: Genérica

## Variante

Una variante representa una versión específica de un producto.

Ejemplo:

Producto: Funda iPhone 16

Variantes:

- Transparente
- Negra
- Azul

Cada variante podrá tener:

- SKU.
- Código de barras.
- Precio de compra.
- Precio de venta.
- Stock mínimo.
- Estado.

## Atributos

Las variantes podrán utilizar atributos configurables según el tipo de producto.

Ejemplos:

- Color.
- Talla.
- Modelo.

Esto permitirá utilizar el sistema en diferentes tipos de negocios sin limitarlo a una categoría específica.

## Control de inventario

`ProductVariant` será la unidad inventariable y el stock no pertenecerá directamente al producto general. Sin embargo, el saldo actual tampoco se almacenará directamente en `ProductVariant`.

El saldo actual se representará mediante `InventoryBalance` para cada combinación de `ProductVariant` y `Location`. Cada combinación de variante y ubicación tendrá conceptualmente un único saldo.

Todo producto deberá tener al menos una variante, incluso cuando no necesite atributos adicionales.
