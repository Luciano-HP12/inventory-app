# Reglas de inventario

Inventory App controla las existencias por `ProductVariant` y `Location`, y mantiene un historial de todos los cambios realizados sobre el stock.

## Saldo actual

`ProductVariant` es la unidad inventariable, pero no contiene un saldo único. `InventoryBalance` representa el saldo materializado actual de una variante en una ubicación determinada.

```text
ProductVariant + Location → InventoryBalance
```

Para cada combinación de variante y ubicación existe como máximo un saldo actual. No es obligatorio crear anticipadamente un balance para todas las combinaciones posibles.

Las cantidades de inventario utilizan una representación decimal exacta `NUMERIC(20,6)`, nunca `float`. Cada variante posee una unidad base y un `quantityStep`; toda cantidad registrada debe ser un múltiplo exacto de esa granularidad. Inventario, ventas, anulaciones y devoluciones utilizan la misma unidad base y la V1 no realiza conversiones.

El saldo debe cumplir siempre:

```text
quantity >= 0
```

Ninguna operación puede generar stock negativo.

## Historial de movimientos

`InventoryMovement` representa el ledger o historial de cambios de inventario. Todo cambio de existencias debe generar un movimiento; el balance no puede sobrescribirse silenciosamente.

Los tipos iniciales son:

- `IN`: entrada que incrementa el saldo.
- `OUT`: salida que reduce el saldo.
- `ADJUSTMENT_IN`: ajuste positivo.
- `ADJUSTMENT_OUT`: ajuste negativo.

Este enum combina dirección y clase de operación; no representa solamente una dirección. La cantidad de un movimiento es siempre una magnitud positiva. El tipo determina si incrementa o reduce el saldo.

Cada movimiento conserva como mínimo:

- variante afectada;
- ubicación afectada;
- tipo;
- cantidad;
- saldo anterior;
- saldo posterior;
- membresía responsable obligatoria;
- momento efectivo y momento de registro;
- motivo cuando corresponda.
- venta de contexto cuando existe origen comercial;
- detalle original compensado cuando corresponde;
- contexto no comercial cuando corresponda.

Cuando el movimiento tiene origen comercial, conserva una referencia tipada opcional:

- `saleItemId` para la salida de una venta;
- `saleCancellationId` para una entrada compensatoria por anulación;
- `saleReturnItemId` para una entrada por devolución con `restock = true`.

Un movimiento puede tener como máximo un origen comercial. Las FKs deben impedir referencias a operaciones de otro negocio y el servicio debe comprobar dentro de la transacción que variante, ubicación, cantidad y tipo coincidan con el origen.

En V1 todo movimiento procede de una operación humana autenticada. `performedByMembershipId` es obligatorio, referencia mediante FK tenant-scoped a una membresía del mismo negocio y utiliza `ON DELETE RESTRICT` y `ON UPDATE RESTRICT`. El servicio exige que la membresía esté `ACTIVE` y autorizada al ejecutar la operación; una revocación posterior conserva la referencia histórica.

Las referencias comerciales utilizan además `sourceSaleId`. En anulaciones y devoluciones, `originalSaleItemId` identifica la línea compensada y es una referencia complementaria, no un segundo origen. Las FKs compuestas opcionales se acompañan de validaciones de forma porque `MATCH SIMPLE` no valida una FK cuando alguno de sus componentes es nulo.

El saldo anterior, el tipo, la cantidad y el saldo posterior deben ser coherentes entre sí y con `InventoryBalance`.

## Atomicidad y concurrencia

La actualización de `InventoryBalance` y la creación de `InventoryMovement` forman una única operación transaccional. Si una parte falla, ninguna debe persistir.

Antes de confirmar una salida debe comprobarse dentro de la transacción que el saldo resultante no sea negativo. La V1 utiliza `READ COMMITTED` como nivel base y combina restricciones únicas, actualizaciones condicionales atómicas, `SELECT FOR UPDATE`, locks sobre filas raíz, orden determinista de locks y reintentos controlados. La selección concreta depende de la invariante; un `CHECK` aislado no sustituye la protección transaccional multirow.

Las ventas, anulaciones y devoluciones que afecten stock deben incluir sus movimientos y actualizaciones de balance dentro de la misma transacción que registra la operación comercial correspondiente.

La creación concurrente de balances no puede producir más de un `InventoryBalance` para la misma variante y ubicación. Las modificaciones de `quantityStep` deben coordinarse con cualquier operación concurrente que registre cantidades y solo pueden confirmarse si los saldos y el historial continúan siendo múltiplos válidos.

## Entradas, salidas y ajustes

Las entradas incrementan el balance y las salidas lo reducen. El stock inicial, cuando se registre, debe representarse mediante una operación `IN` no comercial trazable y no mediante una modificación silenciosa del saldo.

Los ajustes se reservan para diferencias físicas reales, como pérdidas, productos dañados o errores de conteo.

Ejemplo:

```text
Stock registrado: 15
Conteo físico: 12
Movimiento: ADJUSTMENT_OUT por 3
Motivo: productos dañados
```

Los ajustes positivos y negativos no tienen origen comercial y deben registrar un motivo no vacío. El stock inicial utiliza `IN`, el contexto `INITIAL_STOCK` y también exige un motivo no vacío. No se permite un `IN` genérico sin origen o contexto. Una venta registrada posteriormente después de una interrupción de conectividad sigue siendo una venta y no debe sustituirse por un ajuste manual.

## Ventas, anulaciones y devoluciones

- Una venta genera un movimiento `OUT` vinculado al `SaleItem` correspondiente y reduce su balance en la ubicación de la venta.
- Una anulación completa conserva los movimientos originales y genera un movimiento `IN` por cada `SaleItem` afectado en la ubicación de la venta. No se agrupan líneas aunque utilicen la misma variante.
- Cada movimiento de anulación conserva `sourceSaleId`, `saleCancellationId` y `originalSaleItemId`; se genera uno por cada `SaleItem` original y no se agrupan líneas repetidas.
- Una devolución con `restock = true` genera un movimiento `IN` vinculado al `SaleReturnItem` y aumenta el stock vendible en la ubicación de la venta.
- Una devolución con `restock = false` conserva la devolución comercial, pero no genera una entrada ni incrementa el stock vendible.

No se elimina ni modifica un movimiento `OUT` para representar una anulación o devolución.

## Correcciones y conservación histórica

Los movimientos históricos no se eliminan ni se modifican libremente. Si una operación necesita corregirse, se generan movimientos compensatorios que permitan conservar la trazabilidad.

El rol normal de aplicación no posee privilegios ordinarios para actualizar, eliminar o truncar movimientos, y un trigger rechaza cambios ordinarios. Estas defensas no prometen protección absoluta frente al propietario o un superusuario de PostgreSQL.

Desactivar un producto, una variante o una ubicación no modifica automáticamente `InventoryBalance` ni genera movimientos. Los saldos y movimientos relacionados se conservan históricamente; las operaciones permitidas sobre entidades inactivas se definirán por separado.

## Aislamiento multi-tenant

La variante, la ubicación, el balance, el movimiento y la membresía responsable deben pertenecer al mismo `Business`. La autorización y el aislamiento se validan en el backend; un identificador recibido del cliente no concede acceso por sí solo.

## Fuera del alcance de la V1

- Transferencias entre ubicaciones. Su diseño futuro deberá correlacionar la salida y la entrada y ejecutarlas atómicamente, pero no se incorporan tipos ni entidades de transferencia ahora.
- Sincronización offline automática, almacenamiento local de operaciones y resolución de conflictos.
- Conversiones entre unidades, equivalencias y unidades secundarias.

## Decisiones pendientes

- Elección concreta del mecanismo de locking y orden de adquisición para cada caso de uso.
- Creación inicial de balances inexistentes.
- Catálogo de motivos; ajustes y stock inicial ya exigen un motivo no vacío.
- Representación futura de otros tipos de operación originadora, únicamente si posteriormente se aprueban.
- Operaciones permitidas sobre variantes y ubicaciones inactivas.

Los atributos y mecanismos relacionales se documentan en `docs/relational-data-model.md`.
