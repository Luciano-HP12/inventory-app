# Modelo conceptual de datos

Este documento presenta las entidades principales de Inventory App, sus relaciones y las reglas de dominio que deben preservar. Mantiene una vista conceptual: los atributos, tipos, claves, constraints y mecanismos concretos de PostgreSQL y Prisma se documentan en `docs/relational-data-model.md`.

## Entidades vigentes

### Identidad, negocios y suscripciones

- `User`
- `Business`
- `BusinessMembership`
- `Plan`
- `Subscription`
- `SubscriptionPayment`
- `Location`

### Catálogo

- `Category`
- `Product`
- `ProductVariant`
- `Attribute`
- `AttributeValue`
- `ProductVariantAttributeValue`
- `UnitOfMeasure`
- `Supplier`

### Inventario

- `InventoryBalance`
- `InventoryMovement`

### Ventas y reversión de operaciones

- `Sale`
- `SaleItem`
- `Payment`
- `SaleCancellation`
- `SaleReturn`
- `SaleReturnItem`
- `Refund`

### Trazabilidad general

- `AuditLog`
- `IdempotencyRecord`

## Tenant, usuarios y membresías

`Business` es el tenant operativo. Toda entidad y operación perteneciente a un negocio debe quedar aislada de los demás negocios. La autorización se valida en el backend a partir de una membresía activa y del contexto confiable del tenant; conocer o enviar un identificador de negocio no concede acceso por sí solo.

La relación entre usuarios y negocios se representa mediante:

```text
User 1:N BusinessMembership N:1 Business
```

Por tanto, `User` y `Business` mantienen conceptualmente una relación N:M resuelta por `BusinessMembership`.

Cada membresía:

- pertenece exactamente a un usuario y a un negocio;
- contiene el rol `OWNER` o `EMPLOYEE` que el usuario desempeña en ese negocio;
- tiene estado `ACTIVE` o `REVOKED`;
- solo concede acceso cuando está `ACTIVE`;
- se conserva cuando es revocada para no perder las referencias históricas de las operaciones realizadas.

Cada negocio debe conservar al menos una membresía `ACTIVE` con rol `OWNER`.

La autenticación de `User` será administrada por un proveedor externo todavía no seleccionado. Inventory App mantiene un usuario local y su vínculo estable con la identidad externa, pero no almacena contraseñas. El proveedor debe confirmar que el usuario controla su correo electrónico; el correo local no sustituye esa verificación ni constituye la identidad estable del usuario.

## Planes, suscripciones y trial

`Plan` representa una oferta del SaaS. Puede ser referenciado por múltiples suscripciones y permanece separado de los pagos de ventas del negocio. La V1 ofrece únicamente `Esencial`, con precio anunciado de S/ 99.90 por un período fijo de 30 × 24 horas, con IGV incluido cuando corresponda.

Las relaciones conceptuales son:

```text
Business 1:N Subscription N:1 Plan
Subscription 1:N SubscriptionPayment
```

Un negocio conserva el historial de suscripciones, con estas reglas:

- puede tener como máximo una suscripción abierta a la vez;
- puede consumir un único trial histórico;
- el trial dura exactamente 30 × 24 horas, no produce cobro automático y no tiene período de gracia;
- una nueva dirección de correo no concede otro trial;
- la contratación o renovación exige consentimiento del cliente;
- los estados físicos son `TRIALING`, `ACTIVE` y `ENDED`;
- `ACTIVE` representa una relación pagada abierta y no basta por sí solo para demostrar acceso operativo vigente;
- `TRIAL_ACCESS`, `PAID_ACCESS`, `GRACE_PERIOD` y `SUSPENDED` son condiciones efectivas derivadas del estado físico, los límites temporales y el tiempo autoritativo;
- la gracia solo sigue al vencimiento de cobertura pagada, dura exactamente 3 × 24 horas y no modifica el trial;
- una renovación conserva el historial comercial, los cobros y los períodos cubiertos.

La cobertura pagada utiliza `currentPeriodEndsAt` como límite superior exclusivo. Cada contratación o renovación confirmada agrega un período fijo de 720 horas conforme a las reglas de renovación aprobadas. El backend deriva el acceso en cada operación protegida, sin depender de procesos programados para materializar vencimientos.

Durante la gracia el negocio continúa operando y recibe avisos. Tras 72 horas sin renovación confirmada, una membresía `OWNER ACTIVE` conserva lectura y exportación de los datos de su negocio y acceso a la renovación, pero no puede efectuar modificaciones operativas o administrativas. Una membresía `EMPLOYEE ACTIVE` solo puede autenticarse, ver el aviso y cerrar sesión. La suspensión no elimina datos, historial ni membresías.

`SubscriptionPayment` registra cobros confirmados del negocio a Inventory App, los períodos de cobertura adquiridos y snapshots de las condiciones monetarias aplicadas. Se mantiene separado de `Payment`, que representa exclusivamente cobros de ventas realizados por el negocio. Los intentos pendientes, fallidos, rechazados o revertidos no amplían cobertura y su modelo permanece pendiente.

Las capacidades configurables de planes futuros no se modelan mediante `PlanFeature` en la V1. Los límites concretos de usuarios y demás recursos de `Esencial` siguen pendientes. Seguridad, integridad, aislamiento multi-tenant y respaldos son garantías comunes, no funcionalidades opcionales de un plan.

### Administración de plataforma

La administración de Inventory App es un ámbito independiente del tenant. Los roles `OWNER` y `EMPLOYEE` solo expresan permisos dentro de un `Business` y nunca conceden administración de la plataforma, planes globales, pagos SaaS ni otros negocios.

No se incorpora todavía una entidad ni un rol definitivo de administrador de plataforma. Su identidad, autorización, auditoría y operaciones permitidas deberán diseñarse separadamente antes de implementarse.

## Ubicaciones y catálogo

Un `Business` puede tener múltiples `Location` y debe conservar al menos una ubicación predeterminada. Cada ubicación representa inicialmente una tienda o un almacén y puede retirarse del uso operativo sin perder su historial.

Las relaciones principales del catálogo son:

```text
Business 1:N Category
Business 1:N Product
Business 1:N Supplier
Category 1:N Product, con categoría opcional para Product
Product 1:N ProductVariant, con al menos una variante
Product 1:N Attribute
Attribute 1:N AttributeValue
ProductVariant N:M AttributeValue mediante ProductVariantAttributeValue
UnitOfMeasure 1:N ProductVariant
```

Una categoría puede contener múltiples productos y un producto tiene cero o una categoría en la V1. Eliminar una categoría no elimina sus productos; estos quedan sin categoría.

`Product` representa el concepto general del artículo. `ProductVariant` representa la unidad concreta que se vende y sobre la que se controla el inventario. `UnitOfMeasure` es un catálogo global y controlado, con identidad propia y código estable; cada variante utiliza una unidad mediante su referencia obligatoria y define la granularidad mínima admitida mediante `quantityStep`. Productos, variantes y proveedores pueden retirarse del uso operativo sin eliminar las referencias históricas.

### Atributos y combinaciones de variantes

Los atributos configurables pertenecen a un producto específico, no forman un catálogo global del negocio. Ejemplos como Color o Talla son datos, no columnas fijas del modelo.

`ProductVariantAttributeValue` relaciona una variante con los valores que caracterizan su combinación. Deben preservarse las siguientes reglas:

- los valores seleccionados pertenecen a atributos del mismo producto que la variante;
- una variante selecciona como máximo un valor de cada atributo;
- cuando un producto define atributos, cada variante selecciona exactamente un valor de cada atributo, por lo que la combinación es completa;
- dos variantes del mismo producto no pueden representar la misma combinación completa;
- los valores pueden reutilizarse entre distintas variantes del mismo producto;
- un producto simple no define atributos y se representa mediante una única variante sin valores asociados;
- las combinaciones utilizadas históricamente no se reescriben de una forma que cambie el significado de ventas o movimientos anteriores.

La variante, sus asociaciones y la representación canónica utilizada para reforzar la unicidad se crean como una sola operación. Esa representación no sustituye las reglas de pertenencia, selección exacta y completitud.

Antes de que las variantes afectadas tengan historial comercial o de inventario, los atributos pueden reconfigurarse mediante una operación controlada que mantenga completas y únicas todas las combinaciones. Después de existir historial se bloquean los cambios estructurales del conjunto de atributos y de sus asociaciones. Una combinación comercial diferente se representa con una variante nueva y la desactivación de la anterior; no se reinterpreta una variante histórica cambiando sus valores.

Los mecanismos físicos para garantizar completitud, unicidad, sincronización y detección de historial pertenecen al modelo relacional.

### Unidades y granularidad

Cada variante utiliza una única unidad base para inventario, ventas, anulaciones y devoluciones. Las cantidades se representan de forma decimal exacta y deben respetar `quantityStep`.

- Antes del primer movimiento de inventario o venta, la unidad puede configurarse de forma controlada.
- Después del primer movimiento o venta, la unidad base de la variante no puede cambiar.
- `quantityStep` solo puede modificarse cuando todos los saldos y cantidades históricas relevantes continúan siendo compatibles con la nueva granularidad.
- Los cambios permitidos deben comprobarse transaccionalmente y no pueden reinterpretar cantidades históricas.
- La V1 no contempla conversiones, equivalencias ni unidades secundarias.

## Inventario

`ProductVariant` es la unidad inventariable, pero no contiene un saldo único. El stock actual siempre corresponde a una variante en una ubicación determinada.

```text
ProductVariant N:M Location mediante InventoryBalance
ProductVariant 1:N InventoryMovement N:1 Location
```

`InventoryBalance` representa el saldo materializado actual de una combinación `ProductVariant + Location`. Para cada combinación existe conceptualmente cero o un saldo; no es obligatorio crear anticipadamente todas las combinaciones posibles.

`InventoryMovement` representa el libro histórico de cambios de existencias de una variante en una ubicación. Todo cambio de stock debe:

- generar un movimiento;
- conservar el saldo anterior y posterior;
- mantener la cantidad y la ubicación afectadas;
- identificar a la membresía responsable en las operaciones humanas;
- impedir que el saldo resultante sea negativo.

Cuando existe un origen comercial, el movimiento queda relacionado conceptualmente con exactamente una operación originadora: el `SaleItem` vendido, la `SaleCancellation` o el `SaleReturnItem` que restituye stock. En una anulación, identificar además el `SaleItem` original es una correlación de detalle y no un segundo origen comercial. Los ajustes manuales y el stock inicial son operaciones no comerciales trazables. El origen, la variante, la ubicación, la cantidad y el efecto deben ser coherentes y pertenecer al mismo negocio.

No existe una entrada genérica sin contexto: el stock inicial se distingue expresamente de los orígenes comerciales, y ajustes y stock inicial conservan un motivo. Una devolución no apta para volver al stock se registra comercialmente, pero no produce un movimiento de entrada.

El saldo y el movimiento que representa su cambio deben mantenerse coherentes dentro de la misma operación transaccional. Los movimientos históricos no se eliminan ni se modifican libremente; las correcciones se realizan mediante movimientos compensatorios.

`InventoryMovement` es el ledger de existencias. `AuditLog` tiene una responsabilidad diferente: documentar acciones relevantes del sistema.

## Ventas, pagos y conservación histórica

Una venta pertenece a una ubicación y es realizada bajo una membresía del mismo negocio.

```text
Location 1:N Sale
BusinessMembership 1:N Sale
Sale 1:N SaleItem, con al menos un detalle
SaleItem N:1 ProductVariant
Sale 1:N Payment, con al menos un pago
```

Cada `SaleItem` conserva la cantidad, el precio de lista histórico, el descuento aplicado, el precio unitario final y el subtotal. Estos valores no se reconstruyen utilizando el precio actual de la variante.

La suma de los pagos debe cubrir exactamente el total de la venta. El modelo permite múltiples pagos por venta, pero no contempla ventas a crédito ni pagos parciales en la V1.

`Payment` representa exclusivamente pagos que el negocio registra por sus ventas. Los cobros que Inventory App realiza por la suscripción SaaS pertenecen a `SubscriptionPayment` y no reutilizan esta entidad.

Registrar una venta debe conservar atómicamente la venta, sus detalles, sus pagos, los movimientos de salida y los nuevos saldos de inventario. Una reducción nunca puede producir stock negativo.

La venta, sus detalles, pagos y movimientos originales se conservan como registros históricos. Una anulación, devolución o reembolso no los elimina ni los sobrescribe.

## Anulaciones, devoluciones y reembolsos

Las relaciones conceptuales son:

```text
Sale 1:0..1 SaleCancellation
Sale 1:0..N SaleReturn
SaleReturn 1:N SaleReturnItem, con al menos un detalle
SaleItem 1:0..N SaleReturnItem
Sale 1:0..N Refund
SaleReturn 1:0..N Refund
SaleCancellation 1:N Refund cuando existe una anulación
```

### Anulación

`SaleCancellation` representa la reversión completa de una venta. Una venta puede tener como máximo una anulación y solo puede anularse si no tiene devoluciones ni reembolsos anteriores.

La anulación debe compensar íntegramente los efectos todavía vigentes de la venta:

- restituye las cantidades al inventario vendible mediante nuevos movimientos de entrada;
- genera un movimiento de restitución por cada `SaleItem` afectado, incluso cuando varias líneas correspondan a la misma variante;
- mantiene cada movimiento trazable tanto a la anulación como al detalle original de la venta;
- conserva los movimientos de salida originales;
- registra uno o más reembolsos que cubren el importe completo;
- ejecuta todos sus efectos como una única operación transaccional.

Si la mercancía no vuelve completamente o alguna unidad no es apta para venta, corresponde una devolución, no una anulación.

### Devolución

`SaleReturn` representa una devolución parcial o total posterior. Una venta puede tener múltiples devoluciones y cada una contiene uno o más `SaleReturnItem` que referencian los detalles originales.

Las cantidades devueltas acumuladas de un `SaleItem` nunca pueden superar la cantidad vendida. Cada detalle de devolución distingue si la mercancía vuelve al inventario vendible:

- si vuelve al stock vendible, se genera un nuevo movimiento de entrada y se actualiza el saldo;
- si no es apta para venta, la devolución se conserva comercialmente pero no incrementa el saldo disponible.

Una devolución puede existir sin reembolso inmediato y recibir uno posteriormente. Una venta anulada no puede recibir devoluciones.

### Reembolso

`Refund` registra dinero efectivamente devuelto sin modificar ni eliminar los pagos originales. Puede estar asociado a una devolución, a una anulación o ser un reembolso independiente relacionado directamente con la venta.

Los reembolsos acumulados no pueden superar el importe reembolsable de la venta. Cuando un reembolso corresponde a una devolución, también queda limitado por el valor histórico de las cantidades devueltas.

Las anulaciones, devoluciones y reembolsos son operaciones sensibles reservadas al rol `OWNER` en la V1. Deben respetar el tenant, controlar la concurrencia y evitar duplicados por reintentos.

Los detalles transaccionales, restricciones físicas y limitaciones explícitas de estas operaciones se mantienen en `docs/relational-data-model.md`.

## Trazabilidad y entidades de soporte

`Supplier` pertenece a un negocio y representa su catálogo básico de proveedores. El modelo conceptual todavía no incorpora compras, órdenes de compra, recepciones, cuentas por pagar ni relaciones entre proveedores y productos.

`AuditLog` conserva trazabilidad general de acciones relevantes dentro de un negocio. Puede identificar a la membresía humana responsable cuando exista y se mantiene separado de `InventoryMovement`:

```text
Business 1:N Supplier
Business 1:N AuditLog
BusinessMembership 1:0..N AuditLog como actor humano opcional
```

- `InventoryMovement` explica cómo cambió una existencia;
- `AuditLog` registra una acción relevante del sistema.

Los registros históricos de auditoría no se editan ni eliminan mediante la operación normal de la aplicación.

`IdempotencyRecord` pertenece a un negocio y registra la identidad técnica de una solicitud crítica para que sus reintentos no dupliquen ventas, anulaciones, devoluciones, reembolsos ni operaciones de inventario. No sustituye la autenticación, autorización ni las invariantes del dominio, que deben reevaluarse en cada intento.

## Ventas registradas posteriormente

Las ventas realizadas durante una interrupción de conectividad pueden registrarse cuando se recupere la conexión. Se diferencia entre el momento efectivo de la venta y el momento en que Inventory App la registró.

Estas operaciones siguen siendo ventas normales y deben actualizar de forma coherente ventas, pagos, movimientos, saldos y reportes. No se sustituyen por ajustes manuales de inventario.

## Conservación y aislamiento

Todas las relaciones pertenecientes a un negocio deben conducir al mismo `Business`; no se admiten categorías, productos, variantes, ubicaciones, membresías, movimientos, ventas o reversiones cruzadas entre tenants.

No se adopta eliminación en cascada de registros históricos ni un mecanismo universal de borrado lógico. Los estados de actividad y revocación se utilizan donde han sido aprobados para retirar entidades del uso operativo sin perder trazabilidad.

## Decisiones pendientes

Permanecen sin definición funcional completa:

- proveedor externo de autenticación y reglas futuras para vincular más de una identidad a un usuario;
- sincronización de datos de perfil del proveedor de autenticación;
- proveedor de facturación SaaS y evento confiable que confirma un cobro, renovación o activación;
- modelo de intentos de cobro pendientes, fallidos, rechazados o revertidos;
- tratamiento fiscal y snapshots definitivos de IGV;
- política de cancelación voluntaria, cierre como `ENDED` y reactivación después de un cierre definitivo;
- límites de usuarios y demás capacidades concretas de `Esencial`;
- política de conservación y eventual eliminación de datos a largo plazo;
- reglas de precios futuros y cambios de plan;
- atributos de integración externa de `SubscriptionPayment` cuando se seleccione el proveedor;
- modelo de identidad, autorización y auditoría para la administración de plataforma;
- catálogo inicial de unidades y valores predeterminados de granularidad;
- canonicalización exacta de atributos y valores cuando se apruebe una regla de equivalencia; las reglas de categoría, SKU y código de barras ya están definidas en el modelo relacional;
- comportamiento operativo detallado de productos, variantes, ubicaciones y proveedores inactivos;
- flujos de invitación y reactivación de membresías;
- catálogo de motivos de inventario y representación futura de operaciones automáticas;
- transferencias entre ubicaciones;
- catálogo definitivo de acciones y política de retención de auditoría;
- proveedores y abastecimiento más allá del catálogo básico de `Supplier`.

Los mecanismos físicos de índices, constraints, claves foráneas tenant-scoped, concurrencia, idempotencia y representación PostgreSQL/Prisma se resuelven en el diseño relacional y no alteran estas relaciones conceptuales. La canonicalización exacta del hash idempotente sigue pendiente de implementación.
