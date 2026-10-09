# Productos y variantes

Inventory App controla el catálogo y el inventario a nivel de variantes para adaptarse a diferentes tipos de negocios. Las entidades y restricciones relacionales se detallan en `docs/relational-data-model.md`; este documento conserva las reglas funcionales del dominio.

## Product

`Product` representa el concepto general del artículo.

Ejemplo:

- Producto: Funda iPhone 16.
- Categoría: Fundas.
- Marca: Genérica.

Todo producto debe tener al menos una `ProductVariant` durante todo su ciclo de vida.

## ProductVariant

`ProductVariant` representa una versión comercial concreta de un producto y es la unidad que se vende y sobre la que se controla el inventario.

Cada variante conserva sus propios conceptos de:

- SKU opcional;
- código de barras opcional;
- precio de compra;
- precio de venta;
- precio mínimo opcional;
- stock mínimo;
- unidad base y granularidad de cantidad;
- estado operativo.

El stock actual no se almacena directamente en la variante. Se representa por cada combinación de `ProductVariant` y `Location` mediante `InventoryBalance`.

Una variante puede desactivarse para impedir su uso operativo futuro. La desactivación no elimina ventas, movimientos, saldos ni otras referencias históricas.

## Productos simples

Un producto simple no necesita atributos. Se representa mediante una única variante sin valores de atributos asociados y no requiere un indicador `isSimple`.

## Atributos y valores

Los atributos configurables pertenecen a cada producto, no a un catálogo global del negocio.

Ejemplos de atributos:

- Color.
- Talla.
- Modelo.

Ejemplos como Color o Talla son datos configurables, no columnas fijas del esquema.

Cada valor pertenece a un atributo del mismo producto y puede reutilizarse entre varias variantes de ese producto.

## Combinaciones de variantes

Cuando un producto define atributos, cada variante debe representar una combinación completa:

- selecciona exactamente un valor por cada atributo definido para el producto;
- no puede seleccionar dos valores del mismo atributo;
- no puede utilizar valores pertenecientes a otro producto;
- dos variantes del mismo producto no pueden representar la misma combinación completa.

Ejemplo:

```text
Producto: Camiseta
Atributos: Color, Talla

Variante válida: Color = Azul, Talla = M
Variante incompleta: Color = Azul
Variante inválida: Color = Azul, Color = Rojo, Talla = M
```

La asociación entre variantes y valores se representa mediante `ProductVariantAttributeValue`, cuya identidad es la combinación `(productVariantId, attributeId)`. Esto permite una única selección por atributo.

Cada variante conserva además una `combinationKey` canónica construida con identificadores estables de atributos y valores en un orden determinista. Dos variantes del mismo producto no pueden compartirla. Las variantes simples utilizan una representación canónica vacía; el formato concreto de serialización todavía no está definido.

La variante, todas sus asociaciones y la clave canónica se crean dentro de una misma transacción. Antes de confirmar deben validarse exactamente un valor por atributo, la completitud y la unicidad. `combinationKey` protege la unicidad concurrente, pero no demuestra por sí sola que la selección sea completa ni que esté sincronizada con las asociaciones.

## Reconfiguración de atributos

Antes de que las variantes afectadas tengan historial comercial o de inventario, los atributos pueden reconfigurarse mediante una operación transaccional controlada. La operación debe conservar completas y únicas todas las combinaciones existentes y no puede dejar estados parciales persistidos.

Después de existir historial, se bloquean los cambios estructurales al conjunto de atributos y a las asociaciones de las variantes afectadas. No se reinterpreta una variante histórica cambiando sus valores. Para representar una combinación comercial diferente se crea una variante nueva y se desactiva la anterior.

La detección exacta del historial y la estrategia de locking frente a creación concurrente de variantes se definirán durante el diseño físico. La V1 no incorpora versionado completo de configuraciones de producto.

## Unidades de medida y granularidad

Inventory App utiliza un catálogo global y controlado `UnitOfMeasure`. Cada unidad posee una PK UUID v4, un `code` único, estable e inmutable, un nombre, estado de actividad y fecha de creación. Cada `ProductVariant` referencia su unidad base mediante `unitOfMeasureId` obligatorio y define `quantityStep` con precisión `NUMERIC(20,6)`.

El código de la unidad utiliza ASCII en mayúsculas y sin espacios. La variante referencia el UUID, no el código.

- `quantityStep` debe ser mayor que cero.
- Toda cantidad registrada para la variante debe ser un múltiplo exacto de `quantityStep`.
- Inventario, ventas, anulaciones y devoluciones utilizan la misma unidad base.
- Las validaciones utilizan aritmética decimal exacta.
- La V1 no implementa conversiones, equivalencias ni unidades secundarias.

Antes de existir movimientos de inventario o ventas, la unidad puede configurarse mediante una operación controlada. Después del primer movimiento o venta, la unidad base queda fija.

La granularidad solo puede cambiar si todos los saldos y cantidades históricas relevantes siguen siendo válidos con el nuevo `quantityStep`. Esta comprobación debe realizarse transaccionalmente, protegida frente a operaciones concurrentes, y nunca puede reinterpretar cantidades históricas.

## Conservación histórica

Una variante con ventas, movimientos u otras referencias históricas debe conservar su identidad comercial. Su combinación no se reescribe de forma que cambie el significado de operaciones anteriores.

Cuando sea necesario reemplazar una combinación utilizada históricamente, la estrategia funcional será conservar y desactivar la variante anterior y utilizar una variante nueva para las operaciones futuras.

Los atributos, valores y asociaciones utilizados por combinaciones históricas también deben conservarse de forma compatible con ese significado.

## Aislamiento entre negocios

Los productos, variantes, atributos y valores relacionados deben pertenecer al mismo `Business`. No se permiten combinaciones ni referencias cruzadas entre negocios.

La unicidad de SKU y código de barras, cuando tengan valor, se limita al negocio y no es global entre todos los tenants.

El SKU conserva su valor visible y utiliza una representación persistida de comparación sensible a mayúsculas/minúsculas. El código de barras utiliza una normalización conservadora. En ambos casos se preservan ceros iniciales y caracteres significativos, no se convierten a números y la representación de comparación es nula cuando el valor está ausente.

La base refuerza estas reglas mediante índices únicos parciales tenant-scoped sobre `(businessId, skuComparison)` y `(businessId, barcodeComparison)` cuando la respectiva representación no sea nula. Por ello, múltiples variantes pueden omitir SKU o código de barras sin entrar en conflicto. Estos índices se administran como SQL complementario de las migraciones oficiales.

Las reglas de canonicalización deben implementarse determinísticamente y contar con pruebas compartidas entre validación y persistencia.

## Decisiones pendientes

- Catálogo inicial de unidades y valores predeterminados de `quantityStep`.
- Canonicalización exacta de nombres de atributos y valores cuando se apruebe una regla de equivalencia.
- Operaciones exactas permitidas sobre productos o variantes inactivos.
- Formato concreto de serialización de `combinationKey`.
- Mecanismo físico adicional, si se necesita, para impedir escrituras directas que desincronicen `combinationKey` y las asociaciones.
- Detección exacta del historial que bloquea cambios estructurales o de unidad y estrategia definitiva de locking.

Las restricciones y claves relacionales se detallan en `docs/relational-data-model.md`.
