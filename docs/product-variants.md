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
- Stock actual.
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

El stock será administrado a nivel de variante y no directamente sobre el producto general.

Todo producto deberá tener al menos una variante, incluso cuando no necesite atributos adicionales.