# Reglas de inventario

Inventory App controlará las existencias a nivel de variante de producto y mantendrá un historial de todos los cambios realizados sobre el stock.

## Control de stock

El stock pertenecerá a cada variante y no directamente al producto general.

Ejemplo:

Producto: Funda iPhone 16

- Negra: 10 unidades
- Azul: 5 unidades
- Transparente: 8 unidades

El sistema no permitirá que una operación genere stock negativo.

## Movimientos de inventario

Todo cambio en las existencias deberá generar un movimiento de inventario.

Los movimientos iniciales serán:

- Entrada.
- Salida.
- Ajuste positivo.
- Ajuste negativo.

Cada movimiento deberá registrar como mínimo:

- Variante afectada.
- Tipo de movimiento.
- Cantidad.
- Fecha.
- Usuario responsable.
- Motivo u operación relacionada.

## Ajustes de stock

El stock no deberá modificarse directamente.

Cuando exista una diferencia entre el stock registrado y el conteo físico, deberá realizarse un ajuste indicando el motivo.

Ejemplo:

Stock registrado: 15  
Conteo físico: 12  
Ajuste: -3  
Motivo: productos dañados.

## Trazabilidad

Los movimientos históricos no deberán eliminarse ni modificarse libremente.

Si una operación necesita corregirse, deberá generarse un nuevo movimiento que permita conservar la trazabilidad del inventario.