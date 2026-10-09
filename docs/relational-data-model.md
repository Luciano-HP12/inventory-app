# Modelo relacional de datos

Este documento consolida el diseño relacional aprobado de Inventory App en cinco bloques: identidad, negocios, suscripciones y ubicaciones; catálogo de productos; inventario; ventas; y auditoría y entidades de soporte. El documento conserva separadas las invariantes funcionales aprobadas de los mecanismos físicos que todavía deben concretarse en PostgreSQL y Prisma.

Las claves primarias principales utilizarán UUID. Los nombres de atributos son nombres lógicos del modelo. Los tipos PostgreSQL que se indican expresamente forman parte de las convenciones aprobadas; cuando una estrategia física se marque como pendiente o propuesta, no constituye todavía una columna, índice, constraint o implementación Prisma definitiva.

## Convenciones transversales aprobadas

### Precisión numérica y redondeo

- Los precios unitarios y otros valores monetarios por unidad utilizan `NUMERIC(19,4)`.
- Los importes finales, subtotales, totales, pagos y reembolsos utilizan `NUMERIC(19,2)`.
- Las cantidades de catálogo, inventario, ventas y devoluciones utilizan `NUMERIC(20,6)`.
- La aritmética monetaria del backend debe ser decimal exacta; no se utilizarán `float` ni `number` de JavaScript para cálculos monetarios críticos.
- Cada subtotal de venta se calcula a partir del precio unitario final y la cantidad, y se redondea a dos decimales mediante `ROUND_HALF_UP`.
- `Sale.total` es la suma de los subtotales ya redondeados de sus `SaleItem`.
- Los importes derivados para anulaciones, devoluciones y reembolsos deben aplicar la misma política de redondeo y conservar coherencia con los importes históricos de la venta.

### Fechas y horas

- Los atributos de fecha y hora persistidos utilizan `TIMESTAMPTZ(3)`.
- UTC es la referencia interna para persistencia, comparación y reglas de dominio.
- `America/Lima` es la zona horaria de presentación de la V1; la presentación no modifica el instante persistido.
- `createdAt` representa cuándo Inventory App registró el dato.
- `occurredAt` representa el momento efectivo de la operación cuando ambos conceptos deban distinguirse.

### Aislamiento multi-tenant

`Business` es el tenant operativo. Toda autorización se valida en el backend mediante una `BusinessMembership` activa del negocio correspondiente; un `businessId` enviado por el cliente no concede acceso por sí solo.

La estrategia relacional aprobada distingue:

- Entidades tenant-scoped con `businessId` directo: `BusinessMembership`, `Subscription`, `Location`, `Category`, `Product`, `ProductVariant`, `InventoryBalance`, `InventoryMovement`, `Sale`, `SaleItem`, `SaleCancellation`, `SaleReturn`, `Refund`, `Supplier`, `AuditLog` e `IdempotencyRecord`.
- Entidades cuyo tenant se deriva de una relación obligatoria: `Attribute` mediante `Product`; `AttributeValue` mediante `Attribute`; `ProductVariantAttributeValue` mediante la variante y el valor; `Payment` mediante `Sale`; y `SaleReturnItem` mediante `SaleReturn` y `SaleItem`.
- Entidades globales o no pertenecientes a un tenant: `User`, `Plan` y `UnitOfMeasure`. `Business` es la raíz del tenant.

Las relaciones entre entidades tenant-scoped deben impedir referencias cruzadas entre negocios. Las claves foráneas compuestas que incluyan `businessId` forman parte de la estrategia aprobada cuando la relación conecta dos entidades con tenant directo. Se conservan las PK UUID simples y se agregan claves candidatas compuestas únicamente cuando una FK tenant-scoped u otra invariante aprobada las necesita.

En entidades de tenant derivado, la cadena completa de relaciones debe conducir al mismo `Business`. Cuando una FK simple no pueda garantizarlo, la implementación deberá utilizar claves adicionales, constraints, transacciones u otra protección equivalente documentada en el diseño físico.

### Claves candidatas y FKs compuestas aprobadas

Las siguientes claves candidatas existen para ser destino de las FKs compuestas indicadas; no sustituyen la PK UUID simple. No se crearán índices equivalentes adicionales salvo que una necesidad de consulta o integridad lo justifique.

| Entidad destino | Clave candidata aprobada | Relaciones que la requieren |
| --- | --- | --- |
| `BusinessMembership` | `(businessId, id)` | Movimientos, ventas, anulaciones, devoluciones, reembolsos y auditorías realizados por una membresía del mismo negocio. |
| `Location` | `(businessId, id)` | Saldos, movimientos y ventas del mismo negocio. |
| `Category` | `(businessId, id)` | Categoría opcional de un producto del mismo negocio. |
| `Product` | `(businessId, id)` | Variantes del mismo negocio. |
| `ProductVariant` | `(businessId, id)` | Saldos, movimientos y detalles de venta del mismo negocio. |
| `ProductVariant` | `(productId, id)` | Asociación de valores que debe corresponder al mismo producto que la variante. |
| `ProductVariant` | `(productId, combinationKey)` | Unicidad de la combinación canónica dentro del producto. |
| `Attribute` | `(productId, id)` | Asociación de valores que debe corresponder a un atributo del mismo producto. |
| `AttributeValue` | `(attributeId, id)` | Asociación que debe utilizar un valor del atributo declarado. |
| `UnitOfMeasure` | `(code)` | Unicidad del código global estable; `ProductVariant` referencia la PK UUID. |
| `Sale` | `(businessId, id)` | Detalles, anulaciones, devoluciones y reembolsos de la misma venta y negocio. |
| `Sale` | `(businessId, id, locationId)` | Movimientos comerciales que deben coincidir con la ubicación de la venta. |
| `SaleItem` | `(saleId, id)` | Detalles de devolución pertenecientes a la misma venta. |
| `SaleItem` | `(businessId, saleId, id, productVariantId)` | Movimiento que debe coincidir con negocio, venta, detalle y variante. |
| `SaleReturn` | `(saleId, id)` | Detalles de devolución pertenecientes a la misma venta. |
| `SaleReturn` | `(businessId, saleId, id)` | Reembolso asociado a una devolución de la misma venta y negocio. |
| `SaleCancellation` | `(businessId, saleId, id)` | Reembolso asociado a una anulación de la misma venta y negocio. |
| `SaleReturnItem` | `(saleId, id, saleItemId)` | Movimiento de devolución vinculado al detalle original de la misma venta. |

Las FKs tenant-scoped y de coherencia derivada aprobadas son:

| Entidad origen | Columnas de origen | Entidad y columnas de destino |
| --- | --- | --- |
| `Product` | `(businessId, categoryId)` | `Category(businessId, id)` |
| `ProductVariant` | `(businessId, productId)` | `Product(businessId, id)` |
| `InventoryBalance` | `(businessId, productVariantId)` | `ProductVariant(businessId, id)` |
| `InventoryBalance` | `(businessId, locationId)` | `Location(businessId, id)` |
| `InventoryMovement` | `(businessId, productVariantId)` | `ProductVariant(businessId, id)` |
| `InventoryMovement` | `(businessId, locationId)` | `Location(businessId, id)` |
| `InventoryMovement` | `(businessId, performedByMembershipId)` | `BusinessMembership(businessId, id)` |
| `InventoryMovement` | `(businessId, sourceSaleId, locationId)` | `Sale(businessId, id, locationId)`, cuando existe origen comercial |
| `InventoryMovement` | `(businessId, sourceSaleId, saleItemId, productVariantId)` | `SaleItem(businessId, saleId, id, productVariantId)`, opcional según la forma |
| `InventoryMovement` | `(businessId, sourceSaleId, saleCancellationId)` | `SaleCancellation(businessId, saleId, id)`, opcional según la forma |
| `InventoryMovement` | `(businessId, sourceSaleId, originalSaleItemId, productVariantId)` | `SaleItem(businessId, saleId, id, productVariantId)`, opcional según la forma |
| `InventoryMovement` | `(sourceSaleId, saleReturnItemId, originalSaleItemId)` | `SaleReturnItem(saleId, id, saleItemId)`, opcional según la forma |
| `Sale` | `(businessId, locationId)` | `Location(businessId, id)` |
| `Sale` | `(businessId, performedByMembershipId)` | `BusinessMembership(businessId, id)` |
| `SaleItem` | `(businessId, saleId)` | `Sale(businessId, id)` |
| `SaleItem` | `(businessId, productVariantId)` | `ProductVariant(businessId, id)` |
| `SaleCancellation` | `(businessId, saleId)` | `Sale(businessId, id)` |
| `SaleCancellation` | `(businessId, performedByMembershipId)` | `BusinessMembership(businessId, id)` |
| `SaleReturn` | `(businessId, saleId)` | `Sale(businessId, id)` |
| `SaleReturn` | `(businessId, performedByMembershipId)` | `BusinessMembership(businessId, id)` |
| `Refund` | `(businessId, saleId)` | `Sale(businessId, id)` |
| `Refund` | `(businessId, saleId, saleReturnId)` | `SaleReturn(businessId, saleId, id)`, opcional |
| `Refund` | `(businessId, saleId, saleCancellationId)` | `SaleCancellation(businessId, saleId, id)`, opcional |
| `Refund` | `(businessId, performedByMembershipId)` | `BusinessMembership(businessId, id)` |
| `AuditLog` | `(businessId, performedByMembershipId)` | `BusinessMembership(businessId, id)`, opcional |
| `ProductVariantAttributeValue` | `(productId, productVariantId)` | `ProductVariant(productId, id)` |
| `ProductVariantAttributeValue` | `(productId, attributeId)` | `Attribute(productId, id)` |
| `ProductVariantAttributeValue` | `(attributeId, attributeValueId)` | `AttributeValue(attributeId, id)` |
| `SaleReturnItem` | `(saleId, saleReturnId)` | `SaleReturn(saleId, id)` |
| `SaleReturnItem` | `(saleId, saleItemId)` | `SaleItem(saleId, id)` |

Las FKs simples hacia `Business`, `User` y `Plan` se conservan donde corresponda. También se mantienen FKs simples en cadenas con un único origen inequívoco del tenant, como `Attribute → Product`, `AttributeValue → Attribute` y `Payment → Sale`.

Las FKs compuestas opcionales utilizan la semántica `MATCH SIMPLE` de PostgreSQL: si cualquiera de sus componentes es nulo, la FK no valida los componentes restantes. Por ello, las referencias opcionales de `InventoryMovement` y `Refund` deben complementarse con `CHECK` que exijan todos los componentes de la forma seleccionada y rechacen combinaciones parciales. Una FK nullable aislada no constituye una garantía suficiente.

### Acciones referenciales aprobadas

- La política general es `ON DELETE RESTRICT` y `ON UPDATE RESTRICT`.
- Los UUID, `businessId` y las pertenencias al tenant se tratan como inmutables.
- No se aplican cascadas destructivas sobre membresías, suscripciones, catálogo con historial, inventario, ventas, pagos, anulaciones, devoluciones, reembolsos o auditoría.
- Productos, variantes, ubicaciones y proveedores se retiran mediante sus indicadores o estados aprobados, no eliminando relaciones históricas.
- La eliminación de una categoría es la excepción funcional, pero no una excepción referencial: la FK compuesta `Product(businessId, categoryId) → Category(businessId, id)` utiliza `ON DELETE RESTRICT`. El servicio debe, dentro de una misma transacción, establecer únicamente `Product.categoryId = null` para los productos afectados y después eliminar la categoría. `Product.businessId` permanece inalterado. La transacción debe controlar asignaciones concurrentes a esa categoría.
- No se utilizará por ahora `ON DELETE SET NULL` selectivo mediante SQL personalizado.

| Grupo de relaciones | `ON DELETE` | `ON UPDATE` | Motivo |
| --- | --- | --- | --- |
| Entidades tenant-scoped → `Business` | `RESTRICT` | `RESTRICT` | El tenant y su pertenencia son inmutables; no se permite borrar transitivamente sus datos. |
| `BusinessMembership` → `User` | `RESTRICT` | `RESTRICT` | La membresía y sus operaciones históricas deben conservar al usuario referenciado. |
| `Subscription` → `Plan` | `RESTRICT` | `RESTRICT` | Un plan referenciado forma parte del historial comercial. |
| Catálogo y asociaciones de variantes | `RESTRICT` | `RESTRICT` | Productos, variantes, atributos, valores y combinaciones con historial no se destruyen en cascada. |
| Inventario → variante, ubicación y membresía | `RESTRICT` | `RESTRICT` | Saldos y ledger deben conservar referencias estables. |
| Ventas, pagos y reversiones | `RESTRICT` | `RESTRICT` | Los registros originales y compensatorios forman historial inmutable. |
| `AuditLog` → membresía | `RESTRICT` | `RESTRICT` | La revocación no elimina al actor histórico. |
| `Product` → `Category` | `RESTRICT` | `RESTRICT` | La desvinculación de `categoryId` se ejecuta explícitamente antes de borrar la categoría. |

### Alcance de constraints y transacciones

Las FKs compuestas garantizan pertenencia y coincidencia estructural; los `CHECK` garantizan condiciones que dependen exclusivamente de una fila. Las reglas que dependen de otras filas o de sumas acumuladas requieren validación dentro de transacciones con control de concurrencia y, si posteriormente se aprueba, refuerzo mediante triggers o constraints adicionales.

Permanecen como invariantes transaccionales, entre otras: conservar al menos un `OWNER` activo; mantener como máximo una suscripción abierta y un trial histórico bajo concurrencia; conservar al menos una variante por producto; completar y hacer únicas las combinaciones de variantes; exigir hijos mínimos en ventas, anulaciones y devoluciones; limitar cantidades devueltas e importes reembolsados acumulados; y evitar operaciones incompatibles concurrentes.

Prisma puede representar las PK simples, claves candidatas `@@unique` y FKs compuestas aprobadas. La representación de `CHECK`, índices únicos parciales y cualquier refuerzo multirow mediante SQL no se considera resuelta: deberá administrarse mediante migraciones revisadas y probarse frente a futuras migraciones Prisma. Las relaciones opcionales compuestas de `Refund` también deberán validarse con la versión concreta de Prisma antes de generar el esquema.

### Conservación histórica y ciclo de vida

- No se adopta un `soft delete` universal.
- No se utilizará eliminación en cascada para borrar registros históricos de inventario, ventas, pagos, anulaciones, devoluciones, reembolsos, suscripciones o auditoría.
- Productos, variantes, ubicaciones y proveedores se retiran del uso operativo mediante su estado o indicador de actividad, conservando las referencias históricas.
- Las membresías se revocan mediante el estado `REVOKED`; no se eliminan cuando son referenciadas por registros históricos.
- Una categoría puede eliminarse sin borrar sus productos: los productos relacionados conservan su historial y pasan a `categoryId = null`.
- Las acciones referenciales siguen la política aprobada anteriormente. Cualquier excepción futura requerirá una decisión explícita y no podrá destruir historial.

## User

### Propósito

Representar al usuario local de Inventory App y permitir su relación con negocios mediante membresías. La autenticación será responsabilidad de un proveedor externo todavía no seleccionado.

### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador interno propio de Inventory App. |
| `issuer` | Texto | Emisor confiable de la identidad externa. |
| `externalSubject` | Texto | Identificador estable del usuario dentro del emisor. |
| `email` | Texto nullable | Copia local opcional del correo informado por el proveedor; no es la identidad primaria ni la fuente de verificación. |
| `createdAt` | `TIMESTAMPTZ(3)` | Momento en que se creó el usuario local. |

`User` no tendrá `passwordHash`, porque Inventory App no gestionará directamente las credenciales de autenticación.

No se almacena `emailVerified` como fuente autoritativa local. El proveedor externo deberá verificar que el usuario controla su correo y el backend deberá confiar en información validada del proveedor, no en un indicador enviado por el cliente. `email` es una copia operativa nullable, puede cambiar y no identifica de forma estable al usuario.

### Clave primaria

- `id` (UUID).

### Claves foráneas

- Ninguna. La identidad externa se representa mediante `issuer` y `externalSubject`, no mediante una FK a una entidad administrada por Inventory App.

### Restricciones conceptuales

- Cada usuario local debe poder relacionarse de forma segura con una identidad del proveedor externo.
- La referencia externa no sustituye al UUID interno de Inventory App.
- La autenticación y la verificación del correo no se implementarán mediante credenciales o una fuente autoritativa propia en `User`.
- Debe existir unicidad para `(issuer, externalSubject)`.
- `email` no es único y no debe utilizarse para fusionar o vincular cuentas automáticamente.
- Los cambios de correo deben sincronizarse únicamente desde información confiable del proveedor y no crean otro `User`.

### Cardinalidades

- `User 1:N BusinessMembership`.
- Mediante `BusinessMembership`, `User N:M Business`.

### Decisiones pendientes

- Proveedor de autenticación.
- Convención canónica y validación concreta de `issuer` para el proveedor seleccionado.
- Flujo concreto de sincronización de `email` y otros datos de perfil que se aprueben posteriormente.
- Si en una evolución futura un `User` podrá vincular múltiples identidades externas y requerirá una entidad separada; la V1 mantiene una identidad externa por usuario.
- Tratamiento local de cambios, desvinculación o eliminación de una identidad externa.

## Business

### Propósito

Representar el tenant operativo. Los datos y operaciones de cada negocio deberán aislarse en el backend a partir de una membresía válida y del contexto del negocio.

### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador del negocio. |
| `name` | Texto | Nombre comercial del negocio. |

No se agregan en esta etapa RUC, teléfono, dirección ni otros datos empresariales no aprobados.

### Clave primaria

- `id` (UUID).

### Claves foráneas

- Ninguna en este primer bloque.

### Restricciones conceptuales

- `name` no es globalmente único y no debe utilizarse como identificador global ni como único mecanismo para detectar duplicados.
- El acceso a los datos del negocio debe validarse en el backend; un `businessId` recibido del cliente no concede acceso por sí solo.

### Cardinalidades

- `Business 1:N BusinessMembership`.
- `Business 1:N Location`.
- `Business 1:N Subscription` histórica, con como máximo una abierta y un solo trial histórico.

### Decisiones pendientes

- Reglas de normalización y validación de `name`.
- Otros datos empresariales, únicamente cuando sean aprobados.
- Reglas de creación, desactivación y ciclo de vida del negocio.

## BusinessMembership

### Propósito

Representar la pertenencia de un `User` a un `Business` y el rol que ese usuario desempeña dentro del negocio. Esta entidad es la base de la autorización multiempresa.

### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador de la membresía. |
| `userId` | UUID | Usuario al que pertenece la membresía. |
| `businessId` | UUID | Negocio al que pertenece la membresía. |
| `role` | Enum conceptual | Rol inicial: `OWNER` o `EMPLOYEE`. |
| `status` | Enum conceptual | Estado de la membresía: `ACTIVE` o `REVOKED`. |

### Clave primaria

- `id` (UUID).

### Claves foráneas

- `userId` → `User.id`.
- `businessId` → `Business.id`.

### Restricciones conceptuales

- Debe existir unicidad para la combinación `(userId, businessId)`: un usuario no puede tener dos membresías distintas en el mismo negocio.
- `role` solo contempla por ahora `OWNER` y `EMPLOYEE`.
- `status` solo contempla `ACTIVE` y `REVOKED`.
- El rol pertenece a la membresía, no directamente al usuario.
- Solo una membresía `ACTIVE` concede acceso al negocio; la autorización debe comprobar la membresía, su estado y el negocio en el backend.
- Cada negocio debe conservar al menos una membresía `ACTIVE` con rol `OWNER`.
- Una membresía revocada se conserva para no perder las referencias históricas de las operaciones que realizó.

### Cardinalidades

- Cada `BusinessMembership` pertenece exactamente a un `User` y a un `Business`.
- `User 1:N BusinessMembership`.
- `Business 1:N BusinessMembership`.
- En conjunto, resuelve la relación `User N:M Business`.

### Decisiones pendientes

- Reglas para invitaciones y reactivación de membresías revocadas.
- Estrategia transaccional y de concurrencia para impedir la revocación o degradación del último `OWNER` activo.

## Plan

### Propósito

Representar una oferta del SaaS y, conceptualmente, las capacidades o límites comerciales aplicables a una suscripción.

### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador del plan. |
| `code` | Texto | Identificador técnico estable del plan. |
| `name` | Texto | Nombre visible del plan. |
| `isActive` | Booleano | Indica si el plan puede utilizarse para nuevas suscripciones. |
| `createdAt` | `TIMESTAMPTZ(3)` | Momento en que se creó el plan. |

No se definen todavía precios, límites concretos, columnas de *entitlements* ni valores para capacidades comerciales.

### Clave primaria

- `id` (UUID).

### Claves foráneas

- Ninguna en esta entidad.

### Restricciones conceptuales

- `Plan` debe mantenerse separado de `Business` y de los pagos de ventas.
- La existencia conceptual de capacidades o límites no autoriza a inventar su estructura relacional en esta etapa.
- `code` es obligatorio, globalmente único y estable. No debe reutilizarse para representar otro plan.
- `name` puede cambiar y no actúa como identificador estable ni necesita ser único.
- `isActive = false` impide seleccionar el plan para nuevas suscripciones, pero no elimina ni invalida las suscripciones históricas que lo referencian.

### Cardinalidades

- `Plan 1:N Subscription` como relación conceptual: cada suscripción referencia un plan y un plan puede ser referenciado por múltiples suscripciones.

### Decisiones pendientes

- Precios, moneda, periodicidad y duración contractual.
- Límites de ubicaciones, empleados u otras capacidades.
- Representación futura de capacidades o *entitlements*.
- Reglas futuras de versionado cuando existan precios, límites o condiciones comerciales concretas.

## Subscription

### Propósito

Representar el ciclo de trial y suscripción SaaS de un `Business`. Pertenece al dominio de facturación de Inventory App y no al dominio de pagos de ventas.

### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador de la suscripción. |
| `businessId` | UUID | Negocio al que pertenece la suscripción. |
| `planId` | UUID | Plan asociado a la suscripción. |
| `status` | Enum conceptual | Estado de la suscripción: `TRIALING`, `ACTIVE` o `ENDED`. |
| `startedAt` | `TIMESTAMPTZ(3)` | Inicio efectivo del período representado. |
| `trialEndsAt` | `TIMESTAMPTZ(3)` nullable | Fin exacto del trial cuando este registro lo contiene. |
| `endedAt` | `TIMESTAMPTZ(3)` nullable | Fin efectivo del período; nulo mientras la suscripción está abierta. |
| `createdAt` | `TIMESTAMPTZ(3)` | Momento en que Inventory App registró la suscripción. |

El trial dura exactamente 30 × 24 horas desde `startedAt`. Su intervalo de vigencia es `[startedAt, trialEndsAt)`, con `trialEndsAt = startedAt + 30 × 24 horas`.

### Clave primaria

- `id` (UUID).

### Claves foráneas

- `businessId` → `Business.id`.
- `planId` → `Plan.id`.

### Restricciones conceptuales

- La suscripción pertenece al negocio, no directamente al usuario.
- Un negocio conserva un historial de suscripciones y puede tener múltiples registros a lo largo del tiempo; no se aplica `UNIQUE(businessId)` general.
- Un negocio puede tener como máximo una suscripción abierta. Una suscripción abierta es aquella con `endedAt = null` y estado `TRIALING` o `ACTIVE`.
- `TRIALING` requiere `trialEndsAt` y `endedAt = null`.
- `ACTIVE` requiere `endedAt = null`. `trialEndsAt` puede conservar valor cuando el mismo registro comenzó como trial.
- `ENDED` requiere `endedAt` y no concede por sí mismo acceso comercial activo.
- Las transiciones mínimas válidas son `TRIALING → ACTIVE`, `TRIALING → ENDED` y `ACTIVE → ENDED`.
- Una suscripción `ENDED` no se reabre. Una reactivación comercial posterior crea una nueva suscripción `ACTIVE`.
- Cada negocio puede consumir un solo trial histórico. `trialEndsAt` no se elimina al activar o terminar la suscripción que lo contuvo.
- El vencimiento temporal de `trialEndsAt` deja de conceder acceso aunque el proceso que materializa el cambio a `ENDED` todavía no se haya ejecutado.
- Una nueva dirección de correo no concede automáticamente un nuevo trial; el ciclo se gestiona alrededor del negocio.
- Los cobros de la suscripción no reutilizarán la entidad `Payment` del dominio de ventas.
- El vencimiento del trial o de la suscripción no elimina inmediatamente los datos del negocio.
- Un cambio efectivo de plan cierra la suscripción abierta y crea una nueva suscripción con el nuevo `planId` dentro de la misma transacción, preservando el historial.
- `startedAt <= endedAt` cuando `endedAt` tenga valor y `startedAt < trialEndsAt` cuando `trialEndsAt` tenga valor.

#### Protección física aprobada

- Un índice único parcial sobre `businessId` cuando `trialEndsAt IS NOT NULL` garantiza como máximo una concesión histórica de trial por negocio.
- Un índice único parcial sobre `businessId` cuando `endedAt IS NULL` garantiza como máximo una suscripción abierta por negocio.
- Un `CHECK` exige: `TRIALING` con `trialEndsAt` presente y `endedAt` nulo; `ACTIVE` con `endedAt` nulo; y `ENDED` con `endedAt` presente.
- Cuando existe, `trialEndsAt - startedAt` equivale exactamente a 2 592 000 segundos. Cuando existe, `endedAt >= startedAt`.
- No se incorpora `createdAt <= startedAt` como `CHECK` sin una decisión adicional.
- Un trigger PostgreSQL impide modificar o eliminar `trialEndsAt` una vez concedido y también impide eliminar la suscripción que conserva esa evidencia. Las transiciones legítimas conservan el valor.
- Las transiciones comerciales siguen validadas por el servicio. Los índices y restricciones constituyen defensa adicional frente a concurrencia.
- No se crea `TrialGrant` ni un indicador redundante `trialConsumed` en `Business`.

### Cardinalidades

- Cada `Subscription` pertenece a un `Business`.
- Cada `Subscription` referencia un `Plan`.
- `Plan 1:N Subscription`.
- `Business 1:N Subscription` histórica, con como máximo una suscripción abierta a la vez.

### Decisiones pendientes

- Detalle del flujo transaccional para cerrar una suscripción y abrir la siguiente dentro de la estrategia general de concurrencia aprobada.
- Evento confiable que autoriza la transición a `ACTIVE` cuando se diseñe el dominio de billing.
- Proveedor de facturación y referencias externas asociadas.
- Política de acceso restringido, conservación, exportación y eventual eliminación tras el vencimiento.

## Location

### Propósito

Representar una ubicación operativa o de inventario perteneciente a un `Business`. El modelo debe permitir múltiples ubicaciones por negocio desde la V1, independientemente de los límites comerciales que un plan pueda establecer posteriormente.

### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador de la ubicación. |
| `businessId` | UUID | Negocio propietario de la ubicación. |
| `name` | Texto | Nombre visible de la ubicación. |
| `type` | Enum conceptual | Tipo inicial: `STORE` o `WAREHOUSE`. |
| `isDefault` | Booleano conceptual | Indica si es la ubicación predeterminada del negocio. |
| `isActive` | Booleano conceptual | Indica si la ubicación está activa. |

`isDefault` e `isActive` son nombres lógicos para los conceptos aprobados; sus nombres físicos y reglas operativas finales podrán refinarse al implementar el esquema.

### Clave primaria

- `id` (UUID).

### Claves foráneas

- `businessId` → `Business.id`.

### Restricciones conceptuales

- Una ubicación pertenece a un solo negocio.
- Un negocio debe tener como máximo una ubicación marcada como predeterminada.
- La documentación conceptual también establece que cada negocio contará con al menos una ubicación predeterminada. La operación de creación y mantenimiento deberá preservar esta condición mediante una transacción y locking de una fila raíz estable.
- Un índice único parcial sobre `businessId` cuando `isDefault = true` garantiza como máximo una ubicación predeterminada por negocio. Este índice no garantiza que exista al menos una.
- Los valores iniciales de `type` son exclusivamente `STORE` y `WAREHOUSE`.

### Cardinalidades

- `Business 1:N Location`.
- Cada `Location` pertenece exactamente a un `Business`.

### Decisiones pendientes

- Detalle del flujo transaccional y orden de locking para crear, cambiar o desactivar la ubicación predeterminada sin dejar al negocio en un estado inválido.
- Semántica exacta de una ubicación inactiva y su interacción con la ubicación predeterminada.
- Reglas operativas concretas para retirar una ubicación mediante `isActive`; las referencias históricas quedan protegidas por `RESTRICT`.

## Bloque 2: catálogo de productos

Este bloque incorpora el catálogo de productos. Todas sus entidades deben respetar el aislamiento de `Business`: ninguna relación puede conectar categorías, productos, variantes, atributos o valores pertenecientes a negocios distintos.

### UnitOfMeasure

#### Propósito

Representar el catálogo global y controlado de unidades base admitidas por Inventory App. No pertenece a un `Business` y no implementa conversiones, equivalencias ni unidades secundarias en la V1.

#### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador global de la unidad, generado como UUID v4. |
| `code` | Texto | Código técnico estable de la unidad. |
| `name` | Texto | Nombre descriptivo de la unidad. |
| `isActive` | Booleano | Indica si puede seleccionarse para nuevas configuraciones. |
| `createdAt` | `TIMESTAMPTZ(3)` | Momento de creación del registro. |

#### Clave primaria

- `id` (UUID v4).

#### Claves foráneas

- Ninguna.

#### Restricciones conceptuales

- El catálogo es global y administrado por Inventory App; no es configurable libremente por cada negocio.
- `code` es obligatorio, único, estable y no se reutiliza para representar otra unidad.
- `code` utiliza ASCII en mayúsculas, sin espacios, y es inmutable.
- La V1 no realiza conversiones entre unidades.

#### Cardinalidades

- `UnitOfMeasure 1:N ProductVariant`.

#### Decisiones pendientes

- Catálogo inicial de unidades y nombres concretos.

### Category

#### Propósito

Organizar los productos de un `Business`. En la V1, asignar una categoría a un producto es opcional.

#### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador de la categoría. |
| `businessId` | UUID | Negocio propietario de la categoría. |
| `name` | Texto | Nombre visible de la categoría. |
| `normalizedName` | Texto | Representación normalizada utilizada para comparación y unicidad dentro del negocio. |

#### Clave primaria

- `id` (UUID).

#### Claves foráneas

- `businessId` → `Business.id`.

#### Restricciones conceptuales

- La categoría pertenece directamente a un solo `Business`.
- Dentro de un mismo negocio existe unicidad `UNIQUE(businessId, normalizedName)`.
- `normalizedName` se obtiene de forma determinista mediante comparación sin distinguir mayúsculas/minúsculas, trim externo, normalización Unicode NFC y tratamiento coherente de espacios. Los acentos y signos siguen siendo significativos.
- Esta equivalencia no constituye una restricción global entre negocios.

#### Cardinalidades

- `Business 1:N Category`.
- Una `Category` puede contener múltiples `Product`.
- Un `Product` puede tener cero o una `Category` en la V1.

#### Decisiones pendientes

- Especificación ejecutable exacta y pruebas compartidas de la canonicalización de `normalizedName`.
- Estrategia concreta de locking para coordinar asignaciones concurrentes con la transacción aprobada de desvinculación y eliminación.

### Product

#### Propósito

Representar el concepto general de un artículo del catálogo de un `Business`. Las existencias no pertenecen directamente a esta entidad.

#### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador del producto. |
| `businessId` | UUID | Negocio propietario del producto. |
| `categoryId` | UUID nullable | Categoría opcional del producto. |
| `name` | Texto | Nombre visible del producto. |
| `description` | Texto nullable | Descripción opcional del producto. |
| `brand` | Texto nullable | Marca opcional del producto. |
| `isActive` | Booleano | Indica si el producto está activo. |

#### Clave primaria

- `id` (UUID).

#### Claves foráneas

- `businessId` → `Business.id`.
- `(businessId, categoryId)` → `Category(businessId, id)`, opcional.

#### Restricciones conceptuales

- El producto pertenece directamente a un solo `Business`.
- No se establece unicidad para `Product.name`.
- Si `categoryId` tiene valor, la categoría debe pertenecer al mismo `Business` que el producto. Esta es una invariante de aislamiento multi-tenant y no debe confiarse únicamente a datos enviados por el cliente.
- Para eliminar una categoría, el servicio debe desvincular dentro de una transacción los productos afectados estableciendo solo `categoryId = null` y después eliminar la categoría. La FK permanece con `ON DELETE RESTRICT`; `businessId` nunca se modifica ni se establece en nulo.
- Todo producto debe tener al menos una `ProductVariant`.
- `isActive = false` retira el producto del uso operativo sin eliminar su historial ni sus variantes referenciadas.

#### Cardinalidades

- `Business 1:N Product`.
- `Category 1:N Product`, con participación opcional del lado de `Product`: cada producto tiene cero o una categoría.
- `Product 1:N ProductVariant`, con un mínimo de una variante por producto.
- `Product 1:N Attribute`.

#### Decisiones pendientes

- Estrategia concreta de locking para coordinar la desvinculación y eliminación de una categoría con asignaciones concurrentes.
- Flujo transaccional que garantice que un producto se cree y permanezca con al menos una variante.
- Reglas de presentación y operaciones permitidas sobre un producto inactivo.

### ProductVariant

#### Propósito

Representar una versión concreta de un `Product`. `ProductVariant` es la unidad inventariable, pero el stock actual no se almacena en esta entidad: cada saldo actual corresponde a la combinación de una `ProductVariant` y una `Location` y se representa mediante `InventoryBalance`.

Un producto simple se representa mediante un producto con una única variante que no necesita valores de atributos. No se agrega un campo `isSimple`.

#### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador de la variante. |
| `businessId` | UUID | Negocio propietario de la variante, consistente con el producto. |
| `productId` | UUID | Producto al que pertenece la variante. |
| `sku` | Texto nullable | SKU opcional de la variante. |
| `skuComparison` | Texto nullable | Valor persistido para la comparación tenant-scoped del SKU. |
| `barcode` | Texto nullable | Código de barras opcional de la variante. |
| `barcodeComparison` | Texto nullable | Valor persistido para la comparación tenant-scoped del código de barras. |
| `purchasePrice` | `NUMERIC(19,4)` | Precio o costo de compra. |
| `salePrice` | `NUMERIC(19,4)` | Precio de venta o precio de lista. |
| `minimumPrice` | `NUMERIC(19,4)` nullable | Precio mínimo permitido para una venta con rebaja. |
| `minimumStock` | `NUMERIC(20,6)` | Umbral operativo de stock mínimo; no representa existencias actuales. |
| `status` | Enum conceptual | Estado de la variante: `ACTIVE` o `INACTIVE`. |
| `combinationKey` | Texto canónico | Representación determinista de la combinación mediante identificadores estables de atributos y valores. |
| `unitOfMeasureId` | UUID | Unidad base de la variante, perteneciente al catálogo global controlado. |
| `quantityStep` | `NUMERIC(20,6)` | Incremento mínimo permitido para las cantidades de la variante. |

Los precios y las cantidades utilizan aritmética decimal exacta, nunca `float`.

#### Clave primaria

- `id` (UUID).

#### Claves foráneas

- `businessId` → `Business.id`.
- `(businessId, productId)` → `Product(businessId, id)`.
- `unitOfMeasureId` → `UnitOfMeasure.id`.

#### Restricciones conceptuales

- Cada variante pertenece exactamente a un `Product`.
- Todo producto debe conservar al menos una variante.
- El stock actual no es un atributo de `ProductVariant`.
- `minimumStock >= 0`.
- `quantityStep > 0`.
- `sku` y `barcode` son opcionales.
- Cuando exista un SKU, debe ser único dentro del `Business` propietario del producto, nunca globalmente.
- Cuando exista un código de barras, debe ser único dentro del `Business` propietario del producto, nunca globalmente.
- Un índice único parcial sobre `(businessId, skuComparison)` cuando `skuComparison IS NOT NULL` implementa la unicidad tenant-scoped del SKU. Los valores ausentes no entran en conflicto entre sí.
- Un índice único parcial sobre `(businessId, barcodeComparison)` cuando `barcodeComparison IS NOT NULL` implementa la unicidad tenant-scoped del código de barras. Los valores ausentes no entran en conflicto entre sí.
- `skuComparison` conserva el carácter sensible a mayúsculas/minúsculas del SKU, así como ceros iniciales y caracteres significativos; es nulo cuando `sku` está ausente y nunca se trata como número.
- `barcodeComparison` aplica una normalización conservadora que preserva ceros iniciales, caso y caracteres significativos; es nulo cuando `barcode` está ausente y nunca se trata como número.
- `status = INACTIVE` retira la variante del uso operativo sin eliminar ventas, movimientos, saldos ni otras referencias históricas.
- `businessId` debe coincidir con el negocio del producto y todas las relaciones deben impedir conexiones con otros negocios.
- Cuando el producto define atributos, cada variante debe seleccionar exactamente un valor de cada atributo del producto: la combinación debe ser completa y no puede incluir dos valores del mismo atributo.
- Dos variantes de un mismo producto no pueden representar la misma combinación completa de valores.
- Debe existir unicidad para `(productId, combinationKey)`.
- `combinationKey` se construye con los identificadores estables de atributos y valores en un orden determinista. Su formato concreto de serialización permanece pendiente.
- Una variante simple utiliza una representación canónica vacía y no tiene filas en `ProductVariantAttributeValue`.
- La variante, todas sus asociaciones y `combinationKey` deben crearse dentro de una misma transacción. La clave canónica refuerza la unicidad, pero no garantiza por sí sola la completitud ni su sincronización con las asociaciones.
- Todas las cantidades de inventario, venta, anulación y devolución de la variante utilizan la unidad identificada por `unitOfMeasureId` y deben ser múltiplos exactos de `quantityStep`, utilizando aritmética decimal exacta.
- Antes del primer movimiento de inventario o venta, la unidad puede configurarse mediante una operación controlada. Después del primer movimiento o venta, `unitOfMeasureId` no puede cambiar.
- `quantityStep` solo puede modificarse si todos los saldos y cantidades históricas relevantes siguen siendo múltiplos exactos del nuevo valor. La comprobación debe realizarse transaccionalmente y no puede reinterpretar cantidades históricas.
- Un producto simple no define atributos y se representa mediante una única variante sin asignaciones de valores; no requiere un campo `isSimple`.
- Una combinación utilizada por ventas, inventario u otro historial no debe reescribirse eliminando o sustituyendo sus asignaciones. Las correcciones futuras deben preservar el significado histórico, normalmente mediante una nueva variante y la desactivación de la anterior.

#### Cardinalidades

- Cada `ProductVariant` pertenece exactamente a un `Product`.
- `Product 1:N ProductVariant`, con un mínimo de una variante por producto.
- `ProductVariant N:M AttributeValue` mediante `ProductVariantAttributeValue`.

#### Decisiones pendientes

- Reglas de validación relativas entre `purchasePrice`, `salePrice` y `minimumPrice`.
- Operaciones permitidas sobre una variante inactiva y estrategia física para proteger su combinación histórica.
- Formato definitivo de serialización de `combinationKey` y mecanismo adicional, si se necesita, para impedir escrituras directas que la desincronicen de las asociaciones.
- Detección física exacta del primer historial de inventario o venta y estrategia de locking para modificar unidad o granularidad de forma segura.
- Valores predeterminados de `quantityStep` para las unidades que se aprueben.

### Attribute

#### Propósito

Definir una característica configurable de un `Product`, como Color o Talla. Esos ejemplos son datos configurables y no columnas del esquema.

#### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador del atributo. |
| `productId` | UUID | Producto propietario del atributo. |
| `name` | Texto | Nombre del atributo configurable. |

#### Clave primaria

- `id` (UUID).

#### Claves foráneas

- `productId` → `Product.id`.

#### Restricciones conceptuales

- El atributo pertenece directamente a un solo `Product`, no globalmente a `Business`.
- Su tenant se deriva del producto y todas sus relaciones deben mantenerse dentro de ese mismo negocio.
- No se establece todavía una restricción de unicidad para `name`.

#### Cardinalidades

- `Product 1:N Attribute`.
- `Attribute 1:N AttributeValue`.

#### Decisiones pendientes

- Normalización y posibles reglas de unicidad de `name` dentro de un producto.
- Estrategia física para impedir la eliminación o modificación incompatible de atributos utilizados por combinaciones históricas.

### AttributeValue

#### Propósito

Representar un valor disponible para un `Attribute`. Los valores pueden reutilizarse entre variantes del mismo producto mediante `ProductVariantAttributeValue`.

#### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador del valor de atributo. |
| `attributeId` | UUID | Atributo al que pertenece el valor. |
| `value` | Texto | Contenido visible del valor. |

#### Clave primaria

- `id` (UUID).

#### Claves foráneas

- `attributeId` → `Attribute.id`.

#### Restricciones conceptuales

- Cada valor pertenece exactamente a un `Attribute`.
- El producto y el tenant del valor se derivan de su atributo.
- No se establece todavía una restricción de unicidad para `value`.
- Un valor utilizado en una combinación histórica no puede eliminarse o modificarse de manera que cambie el significado de esa variante.

#### Cardinalidades

- `Attribute 1:N AttributeValue`.
- `AttributeValue N:M ProductVariant` mediante `ProductVariantAttributeValue`.

#### Decisiones pendientes

- Normalización y posibles reglas de unicidad de `value` dentro de un atributo.
- Estrategia física de conservación de valores utilizados históricamente.

### ProductVariantAttributeValue

#### Propósito

Representar los valores de atributos que caracterizan a una `ProductVariant`. Es la entidad asociativa entre `ProductVariant` y `AttributeValue`.

#### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `productVariantId` | UUID | Variante caracterizada. |
| `attributeValueId` | UUID | Valor asignado a la variante. |
| `productId` | UUID redundante | Producto común que permite demostrar la pertenencia de la variante y el atributo. |
| `attributeId` | UUID redundante | Atributo al que pertenece el valor y sobre el que se controla una única selección por variante. |

#### Clave primaria

- Clave primaria compuesta `(productVariantId, attributeId)`.

#### Claves foráneas

- `(productId, productVariantId)` → `ProductVariant(productId, id)`.
- `(productId, attributeId)` → `Attribute(productId, id)`.
- `(attributeId, attributeValueId)` → `AttributeValue(attributeId, id)`.

#### Restricciones conceptuales e invariantes de dominio

- Una variante puede tener múltiples valores correspondientes a atributos diferentes.
- Un `AttributeValue` puede utilizarse en múltiples variantes del mismo producto.
- Una variante de un producto con atributos debe tener exactamente un valor perteneciente a cada `Attribute` del producto y no puede tener más de uno por atributo.
- La PK `(productVariantId, attributeId)` impide que una variante seleccione dos valores del mismo atributo.
- El `AttributeValue` asignado debe pertenecer a un `Attribute` del mismo `Product` que la variante.
- Ninguna asignación puede cruzar el límite de `Business` derivado del producto.
- Dos variantes del mismo producto no pueden representar exactamente la misma combinación completa de valores.
- Un producto simple no tiene atributos y su única variante no tiene filas en esta entidad asociativa.
- Las filas que definen una combinación con uso histórico deben conservarse para no reinterpretar ventas o movimientos pasados.
- Antes de existir historial comercial o de inventario en las variantes afectadas, los atributos y asociaciones pueden reconfigurarse mediante una operación transaccional que preserve la completitud y unicidad de todas las combinaciones y no deje estados parciales persistidos.
- Cuando las variantes afectadas ya tienen historial comercial o de inventario, se bloquean los cambios estructurales del conjunto de atributos y sus asociaciones. Una combinación comercial diferente requiere crear una variante nueva y desactivar la anterior.
- Las invariantes que atraviesan `ProductVariant`, `AttributeValue`, `Attribute` y `Product` deberán validarse de forma confiable en el backend y, cuando sea viable, reforzarse en la base de datos.

#### Cardinalidades

- Cada `ProductVariantAttributeValue` pertenece exactamente a una `ProductVariant` y a un `AttributeValue`.
- `ProductVariant 1:N ProductVariantAttributeValue`.
- `AttributeValue 1:N ProductVariantAttributeValue`.
- En conjunto, resuelve `ProductVariant N:M AttributeValue`.

#### Decisiones pendientes

- Estrategia física para impedir combinaciones idénticas de valores entre variantes del mismo producto.
- Estrategia física para garantizar que la combinación sea completa y proteger modificaciones parciales o transaccionales.
- Detección exacta del historial que bloquea una reconfiguración y estrategia de locking frente a creación concurrente de variantes.
- Mecanismo físico adicional, si se aprueba, para verificar en PostgreSQL la sincronización entre asociaciones y `combinationKey`; la clave canónica no sustituye la validación de completitud y pertenencia.

## Bloque 3: inventario

Este bloque define el saldo materializado y el libro de movimientos. `ProductVariant` es la unidad inventariable, pero no posee un saldo único propio: el stock actual siempre corresponde a una combinación de `ProductVariant` y `Location`.

### InventoryBalance

#### Propósito

Representar el saldo materializado actual de una `ProductVariant` en una `Location`. Permite consultar existencias actuales sin reconstruirlas desde todo el historial de movimientos.

#### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador del saldo materializado. |
| `businessId` | UUID | Negocio propietario del saldo. |
| `productVariantId` | UUID | Variante cuyo saldo se representa. |
| `locationId` | UUID | Ubicación en la que se mantiene el saldo. |
| `quantity` | `NUMERIC(20,6)` | Existencias actuales de la variante en la ubicación. |

#### Clave primaria

- `id` (UUID).

#### Claves foráneas

- `businessId` → `Business.id`.
- `(businessId, productVariantId)` → `ProductVariant(businessId, id)`.
- `(businessId, locationId)` → `Location(businessId, id)`.

#### Restricciones conceptuales

- Debe existir unicidad para `(locationId, productVariantId)`: una combinación de ubicación y variante puede tener como máximo un saldo materializado actual.
- `quantity >= 0`.
- La `Location` y la `ProductVariant` deben pertenecer al mismo `Business`.
- No es obligatorio crear anticipadamente un saldo para cada combinación posible de variante y ubicación.
- El saldo no puede modificarse silenciosamente: todo cambio debe producir el `InventoryMovement` correspondiente dentro de la misma transacción.

#### Cardinalidades

- Cada `InventoryBalance` pertenece exactamente a una `ProductVariant` y a una `Location`.
- `ProductVariant 1:N InventoryBalance`.
- `Location 1:N InventoryBalance`.
- Para una combinación concreta de variante y ubicación existe cero o un `InventoryBalance`.

#### Decisiones pendientes

- Estrategia de creación inicial del saldo y semántica operativa de una combinación que todavía no tenga un registro.
- Reglas operativas para saldos relacionados con variantes o ubicaciones inactivas, que deben conservarse históricamente.

### InventoryMovement

#### Propósito

Representar el *ledger* o historial trazable de los cambios de inventario de una `ProductVariant` en una `Location`.

#### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador del movimiento. |
| `businessId` | UUID | Negocio propietario del movimiento. |
| `productVariantId` | UUID | Variante afectada. |
| `locationId` | UUID | Ubicación afectada. |
| `type` | Enum conceptual | Combina la dirección del cambio y la clase de operación. |
| `quantity` | `NUMERIC(20,6)` | Magnitud positiva del cambio. |
| `stockBefore` | `NUMERIC(20,6)` | Saldo de la combinación variante–ubicación antes del movimiento. |
| `stockAfter` | `NUMERIC(20,6)` | Saldo de la combinación variante–ubicación después del movimiento. |
| `performedByMembershipId` | UUID NOT NULL | Membresía activa y autorizada bajo la cual se originó el movimiento. |
| `occurredAt` | `TIMESTAMPTZ(3)` | Momento efectivo al que corresponde el movimiento. |
| `createdAt` | `TIMESTAMPTZ(3)` | Momento en que el movimiento fue registrado en Inventory App. |
| `reason` | Texto condicionado | Motivo del movimiento cuando corresponda. |
| `sourceSaleId` | UUID nullable | Venta de contexto de un origen comercial. |
| `saleItemId` | UUID nullable | Detalle de venta que origina un movimiento `OUT`, cuando corresponda. |
| `saleCancellationId` | UUID nullable | Anulación que origina un movimiento compensatorio `IN`, cuando corresponda. |
| `saleReturnItemId` | UUID nullable | Detalle de devolución con `restock = true` que origina un movimiento `IN`, cuando corresponda. |
| `originalSaleItemId` | UUID nullable | Detalle original compensado por una anulación o devolución; es una referencia complementaria, no un segundo origen. |
| `nonCommercialContext` | Enum nullable | Contexto no comercial; en V1 contempla `INITIAL_STOCK`. |

#### Clave primaria

- `id` (UUID).

#### Claves foráneas

- `businessId` → `Business.id`.
- `(businessId, productVariantId)` → `ProductVariant(businessId, id)`.
- `(businessId, locationId)` → `Location(businessId, id)`.
- `(businessId, performedByMembershipId)` → `BusinessMembership(businessId, id)`, con `ON DELETE RESTRICT` y `ON UPDATE RESTRICT`.

Todos los movimientos de la V1 proceden de operaciones humanas autenticadas. No se introducen actores automáticos. Las FKs compuestas de los orígenes comerciales son las aprobadas en la matriz transversal. Debido a `MATCH SIMPLE`, los `CHECK` de forma deben exigir simultáneamente todos los componentes correspondientes cuando se seleccione un origen.

#### Tipos y efecto sobre el saldo

Los tipos iniciales aprobados son:

| Tipo | Efecto |
| --- | --- |
| `IN` | Incrementa el saldo. |
| `OUT` | Reduce el saldo. |
| `ADJUSTMENT_IN` | Incrementa el saldo mediante un ajuste. |
| `ADJUSTMENT_OUT` | Reduce el saldo mediante un ajuste. |

`type` no es una dirección pura: diferencia entradas y salidas ordinarias de ajustes positivos y negativos. `quantity` representa siempre una magnitud positiva y debe cumplir `quantity > 0`. El signo no se almacena en `quantity`; el efecto de suma o resta lo determina `type`.

#### Restricciones conceptuales e invariantes de dominio

- `IN` y `ADJUSTMENT_IN` deben cumplir `stockAfter = stockBefore + quantity`.
- `OUT` y `ADJUSTMENT_OUT` deben cumplir `stockAfter = stockBefore - quantity`.
- `stockBefore >= 0` y `stockAfter >= 0`; ningún movimiento puede producir stock negativo.
- `stockBefore` debe coincidir con el saldo materializado de la combinación variante–ubicación inmediatamente antes de aplicar el movimiento.
- Para `ADJUSTMENT_IN`, `ADJUSTMENT_OUT` y `INITIAL_STOCK`, `reason` es obligatorio y no puede quedar vacío.
- No se define todavía un catálogo de motivos.
- Un movimiento puede tener como máximo un origen comercial entre `saleItemId`, `saleCancellationId` y `saleReturnItemId`. Esta exclusividad debe reforzarse mediante un `CHECK`.
- Una venta utiliza `type = OUT` y exige `sourceSaleId` y `saleItemId`, sin referencias de anulación, devolución ni contexto no comercial.
- Una anulación utiliza `type = IN` y exige `sourceSaleId`, `saleCancellationId` y `originalSaleItemId`. Produce un movimiento por cada `SaleItem` original sin agrupar líneas repetidas.
- Una devolución con `restock = true` utiliza `type = IN` y exige `sourceSaleId`, `saleReturnItemId` y `originalSaleItemId`. Con `restock = false` no existe movimiento.
- Un ajuste manual no tiene origen comercial y debe registrar `reason`.
- El stock inicial utiliza `type = IN`, `nonCommercialContext = INITIAL_STOCK`, no tiene origen comercial y registra `reason`.
- No se permite un `IN` genérico sin origen comercial o contexto no comercial válido.
- `originalSaleItemId` es una referencia complementaria; no participa en el límite de un único origen comercial.
- Los `CHECK` deben rechazar combinaciones parciales o incompatibles de tipo, origen, contexto y motivo.
- Existen índices únicos parciales sobre `saleItemId` y `saleReturnItemId` cuando no sean nulos, y sobre `(saleCancellationId, originalSaleItemId)` para impedir duplicar la restitución de una línea anulada.
- El servicio transaccional debe comprobar que variante, ubicación, cantidad y tipo sean coherentes con la operación de origen.
- `occurredAt` representa el momento efectivo del movimiento y `createdAt` el momento en que fue registrado en Inventory App.
- La `Location`, la `ProductVariant` y la `BusinessMembership` responsable deben corresponder al mismo `Business`.
- La membresía debe estar `ACTIVE` y autorizada al ejecutar la operación; una revocación posterior no altera el historial ni elimina la referencia.
- Los movimientos históricos no deben modificarse ni eliminarse libremente. Una corrección debe generar uno o más movimientos compensatorios.
- No se utiliza una referencia polimórfica genérica. Las referencias comerciales aprobadas son tipadas; compras, transferencias y otros orígenes futuros no se diseñan en este bloque.

#### Cardinalidades

- Cada `InventoryMovement` pertenece exactamente a una `ProductVariant` y a una `Location`.
- Cada `InventoryMovement` pertenece a una `BusinessMembership` responsable.
- `ProductVariant 1:N InventoryMovement`.
- `Location 1:N InventoryMovement`.
- `BusinessMembership 1:N InventoryMovement`.

#### Decisiones pendientes

- Representación futura de otros tipos de operación originadora, si posteriormente se aprueban.
- Si existirá una relación física directa con `InventoryBalance` o si la combinación de `productVariantId` y `locationId` será suficiente.
- Política administrativa futura de archivo y acceso al historial; los movimientos no se eliminan mediante operaciones ordinarias.

### Integridad y transacciones de inventario

- La creación de una variante debe persistir `ProductVariant`, todas sus asociaciones y `combinationKey` dentro de una misma transacción, validando una selección completa y única antes de confirmar.
- Una reconfiguración de atributos anterior al historial debe actualizar de forma atómica todas las combinaciones afectadas y coordinarse con la creación concurrente de variantes.
- Una modificación válida de `quantityStep` debe comprobar transaccionalmente todos los saldos y registros históricos relevantes y protegerse frente a operaciones concurrentes de inventario o venta.
- Todo cambio de existencias debe generar un `InventoryMovement`; no se permite sobrescribir silenciosamente `InventoryBalance`.
- La actualización de `InventoryBalance` y la creación de `InventoryMovement` deben ejecutarse dentro de la misma transacción. Si una parte falla, ninguna debe persistir.
- Antes de confirmar una reducción debe comprobarse que el nuevo saldo no sea negativo.
- La transacción debe preservar la coherencia entre el saldo previo, `quantity`, `type`, `stockAfter` y el nuevo valor de `InventoryBalance.quantity`.
- Las correcciones se realizan mediante movimientos compensatorios, conservando el historial.
- Se aplica la estrategia general V1 basada en `READ COMMITTED`; el mecanismo concreto de locking y su orden se define y prueba por caso de uso.
- Las ventas, anulaciones y devoluciones definidas en el Bloque 4 deben actualizar los saldos afectados y crear sus movimientos correspondientes atómicamente.

### Aislamiento multi-tenant del inventario

`Location`, `ProductVariant`, `InventoryBalance` e `InventoryMovement` poseen `businessId` directo. Para todo saldo o movimiento, esos valores y la ruta `ProductVariant → Product → Business` deben conducir al mismo `Business`.

`performedByMembershipId` identifica obligatoriamente una membresía del mismo negocio. La autorización valida en el backend que esté `ACTIVE` y posea el permiso necesario; un identificador recibido del cliente no concede acceso por sí solo. La revocación posterior conserva la referencia histórica.

Las FKs compuestas tenant-scoped y sus claves candidatas son las aprobadas en la matriz transversal. Su representación declarativa concreta en Prisma se verificará durante la implementación.

### Transferencias futuras

Las transferencias entre ubicaciones no forman parte de la funcionalidad V1. El modelo futuro deberá permitir correlacionar una salida en la ubicación de origen con una entrada en la ubicación de destino y ejecutar ambos movimientos y ambas actualizaciones de saldo atómicamente.

En esta etapa no se agregan `transferId`, `TRANSFER_IN`, `TRANSFER_OUT` ni una entidad `Transfer`. La representación física de esa correlación se decidirá cuando se diseñe el dominio de transferencias.

## Bloque 4: ventas

Este bloque representa ventas efectivas ya aceptadas por Inventory App, junto con las anulaciones completas, devoluciones y reembolsos básicos admitidos en la V1. Registrar exitosamente cualquiera de estas operaciones significa que todos sus efectos relacionados se persisten dentro de una única operación transaccional.

`SaleCancellation` y `SaleReturn` son operaciones de dominio distintas y permanecen separadas en la persistencia. Una anulación no se representa artificialmente como una devolución. La futura implementación del backend deberá reutilizar lógica interna común para validación, control de concurrencia, generación de movimientos, actualización de balances y creación o validación de reembolsos cuando corresponda.

### Sale

#### Propósito

Representar una venta efectiva realizada en una `Location` y bajo la responsabilidad de una `BusinessMembership`.

#### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador de la venta. |
| `businessId` | UUID | Negocio propietario de la venta. |
| `locationId` | UUID | Ubicación en la que se realizó la venta. |
| `performedByMembershipId` | UUID | Membresía bajo la cual se realizó la venta. |
| `occurredAt` | `TIMESTAMPTZ(3)` | Momento efectivo en que ocurrió la venta. |
| `createdAt` | `TIMESTAMPTZ(3)` | Momento en que la venta fue registrada en Inventory App. |
| `total` | `NUMERIC(19,2)` | Suma de los subtotales históricos ya redondeados de la venta. |

#### Clave primaria

- `id` (UUID).

#### Claves foráneas

- `businessId` → `Business.id`.
- `(businessId, locationId)` → `Location(businessId, id)`.
- `(businessId, performedByMembershipId)` → `BusinessMembership(businessId, id)`.

#### Restricciones conceptuales

- Una venta registrada representa una operación efectiva; no se agrega `Sale.status` en la V1.
- La situación posterior de una venta se deriva de sus anulaciones, devoluciones y reembolsos históricos asociados.
- Toda venta debe contener al menos un `SaleItem`.
- Toda venta debe registrar uno o más `Payment`.
- `Sale.total` debe ser igual a la suma de los `SaleItem.subtotal` calculados y redondeados individualmente mediante `ROUND_HALF_UP`.
- La suma de `Payment.amount` debe ser exactamente igual a `Sale.total` para una venta registrada exitosamente.
- `occurredAt` representa cuándo ocurrió efectivamente la venta y `createdAt` cuándo fue registrada en Inventory App.
- La `Location` y la `BusinessMembership` responsable deben pertenecer a `businessId`. La membresía debe estar `ACTIVE` al autorizar la venta, aunque pueda revocarse posteriormente sin perder el historial.
- La venta original, sus `SaleItem` y sus `Payment` nunca se eliminan ni se modifican para representar una anulación, devolución o reembolso.

#### Cardinalidades

- Cada `Sale` pertenece exactamente a una `Location`.
- Cada `Sale` pertenece exactamente a una `BusinessMembership` responsable.
- `Location 1:N Sale`.
- `BusinessMembership 1:N Sale`.
- `Sale 1:N SaleItem`, con un mínimo de un detalle.
- `Sale 1:N Payment`, con un mínimo de un pago.
- `Sale 1:0..1 SaleCancellation`.
- `Sale 1:0..N SaleReturn`.
- `Sale 1:0..N Refund`.

#### Correlación consolidada

Las referencias tipadas y FKs compuestas con los movimientos se definen en el Bloque 3. Permanecen las invariantes transaccionales descritas en este bloque.

### SaleItem

#### Propósito

Representar una línea de venta y conservar los datos históricos de cantidad y precio utilizados al efectuarla. Cada detalle referencia la `ProductVariant` vendida.

#### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador del detalle. |
| `businessId` | UUID | Negocio propietario del detalle. |
| `saleId` | UUID | Venta a la que pertenece el detalle. |
| `productVariantId` | UUID | Variante vendida. |
| `quantity` | `NUMERIC(20,6)` | Cantidad vendida. |
| `listUnitPrice` | `NUMERIC(19,4)` | Snapshot del `salePrice` utilizado al realizar la venta. |
| `discountAmount` | `NUMERIC(19,4)` | Descuento monetario aplicado por unidad. |
| `finalUnitPrice` | `NUMERIC(19,4)` | Precio unitario final después del descuento. |
| `subtotal` | `NUMERIC(19,2)` | Importe histórico del detalle después de redondear la línea. |

#### Clave primaria

- `id` (UUID).

#### Claves foráneas

- `businessId` → `Business.id`.
- `(businessId, saleId)` → `Sale(businessId, id)`.
- `(businessId, productVariantId)` → `ProductVariant(businessId, id)`.

#### Restricciones conceptuales

- Cada `SaleItem` pertenece exactamente a una `Sale` y referencia exactamente una `ProductVariant`.
- `quantity > 0`.
- `discountAmount >= 0` y representa el descuento monetario aplicado por unidad.
- `finalUnitPrice = listUnitPrice - discountAmount`.
- `subtotal = ROUND_HALF_UP(finalUnitPrice * quantity, 2)`.
- `listUnitPrice`, `discountAmount`, `finalUnitPrice` y `subtotal` son snapshots históricos; no deben reconstruirse posteriormente usando el precio actual de `ProductVariant`.
- Cuando `ProductVariant.minimumPrice` tenga valor, `finalUnitPrice` no puede quedar por debajo de ese mínimo.
- `minimumPrice = null` significa que no existe un precio mínimo adicional configurado para rebajas.
- La V1 no contempla excepciones para vender por debajo del precio mínimo configurado.
- La `ProductVariant` debe pertenecer al mismo `Business` que la `Location` de la venta.
- No se agregan snapshots de nombre, SKU, código de barras, descripción ni costo porque todavía no están aprobados.
- El detalle original no se elimina ni se modifica para representar cantidades anuladas o devueltas.

#### Cardinalidades

- Cada `SaleItem` pertenece exactamente a una `Sale`.
- Cada `SaleItem` referencia exactamente una `ProductVariant`.
- `Sale 1:N SaleItem`, con un mínimo de un detalle por venta.
- `ProductVariant 1:N SaleItem`.
- `SaleItem 1:0..N SaleReturnItem`.

#### Correlación consolidada

`InventoryMovement.saleItemId` y su FK compuesta identifican el detalle que origina el movimiento de salida.

### Payment

#### Propósito

Representar exclusivamente un pago que el negocio registra por una `Sale`. Esta entidad pertenece al dominio de ventas y no se reutiliza para la facturación o las suscripciones del SaaS.

#### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador del pago de venta. |
| `saleId` | UUID | Venta pagada. |
| `amount` | `NUMERIC(19,2)` | Importe del pago. |
| `method` | Enum conceptual | Método de pago registrado. |

Los métodos de pago iniciales de la V1 son `CASH`, `CARD`, `BANK_TRANSFER`, `DIGITAL_WALLET` y `OTHER`.

#### Clave primaria

- `id` (UUID).

#### Claves foráneas

- `saleId` → `Sale.id`.

#### Restricciones conceptuales

- Cada `Payment` pertenece exactamente a una `Sale`.
- `amount` utiliza una representación decimal exacta, nunca `float`, y debe cumplir `amount > 0`.
- Una venta debe registrar uno o más pagos.
- El modelo permite múltiples pagos para una venta, aunque la interfaz V1 puede utilizar inicialmente un único pago.
- La suma de los importes de los pagos debe ser exactamente igual a `Sale.total`.
- No se permiten ventas a crédito ni pagos parciales en la V1.
- `Payment` no se mezcla con el dominio de billing o suscripciones del SaaS.
- Un reembolso no modifica, reduce ni elimina los pagos originales.
- No se agregan estados de pago, moneda, referencias externas, caja ni sesiones de caja.

#### Cardinalidades

- Cada `Payment` pertenece exactamente a una `Sale`.
- `Sale 1:N Payment`, con un mínimo de un pago por venta.

#### Decisiones pendientes

- Reglas operativas de la interfaz para utilizar uno o varios pagos dentro de la cardinalidad aprobada.

### SaleCancellation

#### Propósito

Representar la anulación completa de una `Sale` como una operación histórica separada que compensa íntegramente sus efectos de inventario y dinero sin modificar los registros originales.

#### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador de la anulación. |
| `businessId` | UUID | Negocio propietario de la anulación. |
| `saleId` | UUID | Venta anulada. |
| `performedByMembershipId` | UUID | Membresía que realizó la anulación. |
| `occurredAt` | `TIMESTAMPTZ(3)` | Momento efectivo de la anulación. |
| `createdAt` | `TIMESTAMPTZ(3)` | Momento en que fue registrada en Inventory App. |
| `reason` | Texto | Motivo de la anulación. |

#### Clave primaria

- `id` (UUID).

#### Claves foráneas

- `businessId` → `Business.id`.
- `(businessId, saleId)` → `Sale(businessId, id)`.
- `(businessId, performedByMembershipId)` → `BusinessMembership(businessId, id)`.

#### Restricciones conceptuales e invariantes de dominio

- Cada `SaleCancellation` pertenece exactamente a una `Sale`.
- `saleId` debe ser único: una venta tiene como máximo una anulación.
- Una venta solo puede anularse si no tiene `SaleReturn` ni `Refund` anteriores.
- La anulación V1 es una reversión completa.
- Debe restituir todas las cantidades vendidas al inventario vendible de `Sale.locationId` mediante nuevos `InventoryMovement` de tipo `IN` y actualizar los `InventoryBalance` correspondientes.
- Nunca modifica ni elimina los movimientos `OUT` originales.
- Debe reembolsar el importe completo de la venta mediante uno o más `Refund` relacionados con la anulación y creados dentro de la misma operación.
- Después de la anulación no pueden registrarse nuevas devoluciones ni reembolsos independientes.
- Si la mercancía no vuelve completamente o alguna unidad no es apta para venta, debe utilizarse `SaleReturn` en lugar de `SaleCancellation`.
- La membresía responsable debe pertenecer al mismo `Business` que la venta.

#### Cardinalidades

- Cada `SaleCancellation` pertenece exactamente a una `Sale`.
- `Sale 1:0..1 SaleCancellation`.
- `SaleCancellation 1:N Refund`, con uno o más reembolsos que en conjunto cubren el importe total de la venta.

#### Decisiones pendientes

- Restricciones físicas que impidan anular una venta con devoluciones o reembolsos anteriores.

### SaleReturn

#### Propósito

Representar una operación posterior de devolución parcial o total sobre una venta, manteniéndola diferenciada de su anulación.

#### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador de la devolución. |
| `businessId` | UUID | Negocio propietario de la devolución. |
| `saleId` | UUID | Venta de origen. |
| `performedByMembershipId` | UUID | Membresía que registró la devolución. |
| `occurredAt` | `TIMESTAMPTZ(3)` | Momento efectivo de la devolución. |
| `createdAt` | `TIMESTAMPTZ(3)` | Momento en que fue registrada en Inventory App. |
| `reason` | Texto | Motivo de la devolución. |

#### Clave primaria

- `id` (UUID).

#### Claves foráneas

- `businessId` → `Business.id`.
- `(businessId, saleId)` → `Sale(businessId, id)`.
- `(businessId, performedByMembershipId)` → `BusinessMembership(businessId, id)`.

#### Restricciones conceptuales e invariantes de dominio

- Cada `SaleReturn` pertenece exactamente a una `Sale`.
- Cada devolución contiene uno o más `SaleReturnItem`.
- Una venta puede tener múltiples devoluciones.
- Una venta anulada no puede recibir devoluciones.
- La membresía responsable debe pertenecer al mismo `Business` que la venta.
- Una devolución puede existir sin un reembolso inmediato y recibir posteriormente uno o más `Refund` asociados.

#### Cardinalidades

- `Sale 1:0..N SaleReturn`.
- `SaleReturn 1:N SaleReturnItem`, con un mínimo de un detalle.
- `SaleReturn 1:0..N Refund`.

#### Decisiones pendientes

- Restricciones físicas para impedir devoluciones sobre una venta anulada.

### SaleReturnItem

#### Propósito

Representar la cantidad devuelta de un `SaleItem` y determinar si esa cantidad vuelve al inventario vendible.

#### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador del detalle de devolución. |
| `saleReturnId` | UUID | Devolución a la que pertenece. |
| `saleItemId` | UUID | Detalle original de la venta. |
| `saleId` | UUID redundante | Venta común que permite demostrar que la devolución y el detalle original pertenecen a la misma venta. |
| `quantity` | `NUMERIC(20,6)` | Cantidad devuelta. |
| `restock` | Booleano | Indica si la cantidad vuelve al inventario vendible. |

#### Clave primaria

- `id` (UUID).

#### Claves foráneas

- `(saleId, saleReturnId)` → `SaleReturn(saleId, id)`.
- `(saleId, saleItemId)` → `SaleItem(saleId, id)`.

#### Restricciones conceptuales e invariantes de dominio

- `quantity > 0`.
- El `SaleItem` debe pertenecer a la misma `Sale` que el `SaleReturn`.
- La suma de las cantidades devueltas de un `SaleItem` en todas sus devoluciones nunca puede superar `SaleItem.quantity`.
- Debe permitirse más de un `SaleReturnItem` para el mismo `SaleItem` cuando sea necesario separar cantidades con distinto tratamiento físico. No se aplica `UNIQUE(saleReturnId, saleItemId)`.
- Si `restock = true`, se crea un `InventoryMovement` de tipo `IN` y se incrementa el `InventoryBalance` correspondiente.
- Si `restock = false`, la devolución queda registrada, pero no se genera restitución al inventario vendible.
- Toda restitución de la V1 utiliza `Sale.locationId`; no se admiten devoluciones en otra ubicación.
- No se introducen ubicaciones de cuarentena ni estados avanzados de inventario.

#### Cardinalidades

- Cada `SaleReturnItem` pertenece exactamente a un `SaleReturn` y referencia exactamente un `SaleItem`.
- `SaleReturn 1:N SaleReturnItem`.
- `SaleItem 1:0..N SaleReturnItem`.

#### Decisiones pendientes

- Estrategia física y de concurrencia para garantizar el límite acumulado de cantidades devueltas.

### Refund

#### Propósito

Representar un reembolso monetario histórico ya realizado y registrado, sin modificar los `Payment` originales.

#### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador del reembolso. |
| `businessId` | UUID | Negocio propietario del reembolso. |
| `saleId` | UUID | Venta reembolsada. |
| `saleReturnId` | UUID nullable | Devolución asociada, cuando corresponda. |
| `saleCancellationId` | UUID nullable | Anulación asociada, cuando corresponda. |
| `performedByMembershipId` | UUID | Membresía que registró el reembolso. |
| `amount` | `NUMERIC(19,2)` | Importe efectivamente reembolsado. |
| `method` | Enum conceptual | Medio por el que se devolvió el dinero. |
| `occurredAt` | `TIMESTAMPTZ(3)` | Momento efectivo del reembolso. |
| `createdAt` | `TIMESTAMPTZ(3)` | Momento en que fue registrado en Inventory App. |
| `reason` | Texto | Motivo del reembolso. |

`method` utiliza los mismos valores conceptuales de `Payment`: `CASH`, `CARD`, `BANK_TRANSFER`, `DIGITAL_WALLET` y `OTHER`.

#### Clave primaria

- `id` (UUID).

#### Claves foráneas

- `businessId` → `Business.id`.
- `(businessId, saleId)` → `Sale(businessId, id)`.
- `(businessId, saleId, saleReturnId)` → `SaleReturn(businessId, saleId, id)`, opcional.
- `(businessId, saleId, saleCancellationId)` → `SaleCancellation(businessId, saleId, id)`, opcional.
- `(businessId, performedByMembershipId)` → `BusinessMembership(businessId, id)`.

#### Restricciones conceptuales e invariantes de dominio

- Cada `Refund` pertenece exactamente a una `Sale` y cumple `amount > 0`.
- La existencia de un `Refund` significa que el reembolso ya fue efectivamente realizado y registrado; no se introducen estados de reembolso.
- Un `CHECK` debe garantizar que como máximo uno entre `saleReturnId` y `saleCancellationId` tenga valor.
- `saleReturnId != null` representa un reembolso asociado a una devolución.
- `saleCancellationId != null` representa un reembolso asociado a una anulación.
- Ambos atributos nulos representan un reembolso independiente.
- Ambos atributos con valor constituyen un estado inválido.
- Cuando exista relación con `SaleReturn` o `SaleCancellation`, esa operación debe pertenecer a la misma `Sale` que el reembolso.
- Los `Payment` originales nunca se modifican, reducen ni eliminan debido a un reembolso.
- La V1 no rastrea obligatoriamente qué `Payment` original fue revertido.
- Una venta puede tener múltiples reembolsos.
- Los reembolsos acumulados de una venta no pueden superar `Sale.total`.
- Los reembolsos asociados a un `SaleReturn` no pueden superar el valor histórico reembolsable de sus cantidades devueltas, calculado por línea con `SaleItem.finalUnitPrice` y redondeado a dos decimales mediante `ROUND_HALF_UP`.
- Un reembolso independiente puede existir sin una devolución física.
- La membresía responsable debe pertenecer al mismo `Business` que la venta.

#### Cardinalidades

- `Sale 1:0..N Refund`.
- `SaleReturn 1:0..N Refund`.
- `SaleCancellation 1:N Refund` cuando la venta es anulada.
- `BusinessMembership 1:N Refund`.

#### Decisiones pendientes

- Estrategia física y de concurrencia para garantizar los límites monetarios acumulados.
- Representación concreta del `CHECK` de exclusividad en PostgreSQL y su administración mediante migraciones Prisma.

### Integración con inventario

- Una venta efectiva reduce el `InventoryBalance` de cada combinación formada por `Sale.locationId` y `SaleItem.productVariantId` y crea el `InventoryMovement` correspondiente con tipo `OUT`.
- Una anulación restituye todas las cantidades vendidas en `Sale.locationId` mediante un nuevo movimiento `IN` por cada `SaleItem` afectado. No se agrupan líneas que utilicen la misma variante.
- Cada movimiento de anulación es trazable tanto a `SaleCancellation` como al `SaleItem` original mediante `saleCancellationId`, `sourceSaleId` y `originalSaleItemId`. La referencia al detalle es complementaria y no constituye un segundo origen comercial.
- Una devolución solo crea movimientos `IN` para sus `SaleReturnItem` con `restock = true`.
- No se agrega `RETURN_IN`; se reutiliza el tipo `IN` ya aprobado.
- Los movimientos originales se conservan y nunca se modifican ni eliminan para representar una reversión.
- Los movimientos compensatorios usan la misma `performedByMembershipId` de la anulación o devolución que los origina.
- La actualización de `InventoryBalance` y la creación de cada movimiento compensatorio deben realizarse atómicamente.
- Ninguna operación puede producir stock negativo.

### Permisos de la V1

- `OWNER` puede registrar anulaciones, devoluciones y reembolsos.
- `EMPLOYEE` puede registrar ventas, pero no anulaciones, devoluciones ni reembolsos.
- La autorización debe validarse en el backend mediante una `BusinessMembership` `ACTIVE` del mismo negocio; no puede depender únicamente de la interfaz.

### Atomicidad de las operaciones de venta

- Registrar una venta debe persistir `Sale`, sus `SaleItem`, sus `Payment`, las reducciones de `InventoryBalance` y los movimientos `OUT` dentro de una única transacción.
- Una anulación debe crear `SaleCancellation`, un movimiento `IN` por cada `SaleItem`, las actualizaciones de balance y uno o más `Refund` por el importe completo dentro de una única transacción.
- Una devolución debe crear `SaleReturn`, sus `SaleReturnItem`, los movimientos y balances aplicables y los `Refund` que formen parte de esa operación dentro de una única transacción.
- Una devolución puede existir sin reembolso inmediato y recibirlo posteriormente.
- Un reembolso independiente puede existir sin devolución física.
- Si falla cualquier validación o efecto requerido, no debe persistirse parcialmente ninguna parte de la operación crítica.

### Concurrencia e idempotencia

La implementación deberá proteger la venta y los detalles afectados durante operaciones concurrentes, validar cantidades e importes acumulados dentro de la transacción e impedir combinaciones incompatibles de anulación y devolución.

También deberá impedir balances duplicados durante su creación concurrente, combinaciones duplicadas de variantes, reconfiguraciones de atributos concurrentes con la creación de variantes y cambios de granularidad concurrentes con operaciones que registren cantidades.

Las operaciones externas críticas utilizan `IdempotencyRecord` tenant-scoped. Repetir la misma solicitud por reintento, *timeout* o doble interacción no debe crear una segunda venta, anulación, devolución, actualización de balance, movimiento o reembolso. La canonicalización exacta del hash y la verificación del esquema Prisma permanecen como tareas de preparación de la implementación.

### Aislamiento multi-tenant de ventas

La venta, anulación, devolución, detalles, membresía responsable, ubicación, variantes, balances, movimientos, pagos y reembolsos relacionados deben pertenecer al mismo `Business`.

`Sale`, `SaleItem`, `SaleCancellation`, `SaleReturn` y `Refund` tienen `businessId` directo. `Payment` deriva el tenant de `Sale`. `SaleReturnItem` deriva el tenant mediante su `saleId` redundante y las FKs compuestas hacia `SaleReturn` y `SaleItem`, que obligan a que ambas rutas conduzcan a la misma venta. Las FKs compuestas de `Refund` obligan igualmente a que una devolución o anulación asociada pertenezca a su misma venta y negocio.

### Limitaciones explícitas de la V1

Quedan fuera de este diseño:

- reembolsos externos asíncronos con estados `pending` o `failed`;
- asignación de un `Refund` a un `Payment` concreto;
- devolución en una ubicación distinta de `Sale.locationId`;
- cuarentena, reparación o estados físicos avanzados de inventario;
- cambios de un producto por otro;
- anulación después de devoluciones o reembolsos previos;
- corrección o reversión de una devolución ya registrada;
- corrección o reversión de un reembolso erróneo;
- garantías;
- notas de crédito;
- facturación electrónica y SUNAT.

Este bloque tampoco agrega clientes, comprobantes, impuestos, IGV, crédito, cuentas por cobrar, cajas, sesiones de caja ni campos fiscales.

## Bloque 5: auditoría y entidades de soporte

Este bloque incorpora el catálogo básico de proveedores y la trazabilidad general de acciones relevantes. Tanto `Supplier` como `AuditLog` son entidades tenant-scoped y tienen un `businessId` directo aprobado, conforme a la clasificación transversal del documento.

### Supplier

#### Propósito

Representar un proveedor del catálogo básico de un `Business`. `Supplier` permanece dentro del alcance de la V1, pero este bloque no diseña compras ni abastecimiento.

#### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador del proveedor. |
| `businessId` | UUID | Negocio propietario del proveedor. |
| `name` | Texto | Nombre visible y obligatorio del proveedor. |
| `phone` | Texto nullable | Teléfono opcional del proveedor. |
| `email` | Texto nullable | Correo electrónico opcional del proveedor. |
| `isActive` | Booleano | Indica si el proveedor está disponible para el uso operativo. |

#### Clave primaria

- `id` (UUID).

#### Claves foráneas

- `businessId` → `Business.id`.

#### Restricciones conceptuales

- Cada `Supplier` pertenece exactamente a un `Business`.
- `name` es obligatorio.
- No se establece unicidad para `Supplier.name`.
- `isActive` permite retirar un proveedor del uso operativo sin requerir su eliminación.
- El acceso y las operaciones sobre proveedores deben respetar el contexto del negocio y validarse en el backend.

#### Cardinalidades

- `Business 1:N Supplier`.
- Cada `Supplier` pertenece exactamente a un `Business`.

#### Decisiones pendientes

- Reglas de validación y normalización de `name`, `phone` y `email`.
- Comportamiento operativo exacto de un proveedor inactivo.

No se agregan RUC u otros identificadores fiscales, dirección, notas, compras, órdenes de compra, recepciones, cuentas por pagar ni relaciones de `Supplier` con `Product`, `ProductVariant` o `InventoryMovement`.

### AuditLog

#### Propósito

Representar la trazabilidad general de acciones relevantes del sistema dentro de un `Business`. `AuditLog` no sustituye al libro de movimientos de inventario.

#### Atributos actualmente aprobados

| Atributo lógico | Tipo conceptual | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador del registro de auditoría. |
| `businessId` | UUID | Negocio al que pertenece el evento auditado. |
| `performedByMembershipId` | UUID nullable | Membresía humana responsable cuando exista. |
| `action` | `VARCHAR(64)` NOT NULL | Acción relevante realizada, validada contra el catálogo del servicio. |
| `entityType` | `VARCHAR(64)` NOT NULL | Tipo de recurso afectado, validado contra el catálogo del servicio. |
| `entityId` | UUID nullable | Identificador del recurso concreto cuando exista. |
| `createdAt` | `TIMESTAMPTZ(3)` | Momento en que Inventory App registró el evento. |

No se agrega `occurredAt` a `AuditLog` en la V1. Tampoco se agregan datos anteriores o posteriores, metadata JSON, dirección IP, *user-agent*, snapshots ni un motivo genérico.

#### Clave primaria

- `id` (UUID).

#### Claves foráneas

- `businessId` → `Business.id`.
- `(businessId, performedByMembershipId)` → `BusinessMembership(businessId, id)`, opcional.

`entityId` no implementa una FK polimórfica.

#### Restricciones conceptuales

- Cada `AuditLog` tenant-scoped pertenece directamente a un `Business`.
- Cuando `performedByMembershipId` tenga valor, la membresía debe pertenecer al mismo `Business` que el registro de auditoría.
- `performedByMembershipId = null` deja abierta la representación futura de acciones automáticas, sin diseñar todavía actores de sistema o integraciones.
- `action` y `entityType` son textos obligatorios de hasta 64 caracteres. Un `CHECK` rechaza cadenas vacías o compuestas únicamente por espacios.
- Los catálogos de `action` y `entityType` se validan en el servicio y pueden evolucionar sin modificar un enum PostgreSQL cerrado. No se define todavía un catálogo exhaustivo.
- `entityId` identifica el recurso concreto cuando exista y puede ser nulo.
- `createdAt` representa cuándo Inventory App registró el evento de auditoría.
- Los registros son históricos y *append-oriented*. No deben tratarse como datos ordinarios que puedan editarse o eliminarse mediante la funcionalidad normal de la aplicación.
- No se define todavía una política administrativa o legal definitiva de retención o purga.
- `AuditLog` no se utiliza como fuente de estado ni implementa *event sourcing*.

#### Cardinalidades

- `Business 1:N AuditLog`.
- Cada `AuditLog` pertenece exactamente a un `Business`.
- `BusinessMembership 1:N AuditLog` cuando existe un actor humano; cada registro tiene cero o una membresía responsable.

#### Alcance inicial de auditoría

Las siguientes categorías de operaciones sensibles deben considerarse auditables:

- cambios de roles o membresías;
- cambios de precios;
- ajustes manuales de inventario;
- anulaciones de ventas;
- devoluciones;
- reembolsos;
- cambios sensibles de configuración del negocio.

Esta lista define categorías iniciales, no un enum definitivo de `action`. Los eventos concretos y el momento exacto de generación se decidirán dentro de cada módulo.

#### Separación respecto a InventoryMovement

- `InventoryMovement` es el ledger de cambios físicos o lógicos de existencias y conserva cantidad, ubicación y saldos antes y después del cambio.
- `AuditLog` proporciona trazabilidad general sobre acciones relevantes del sistema.
- No todo `InventoryMovement` debe generar automáticamente un `AuditLog`.
- Una operación sensible, como un ajuste manual o una devolución, puede producir ambos registros cuando corresponda, pero cada uno conserva una responsabilidad diferente.

#### Decisiones pendientes

- Catálogo concreto y evolutivo de `action` y `entityType` validado por el servicio.
- Índices necesarios para consultas tenant-scoped, temporales y por recurso.
- Política administrativa o legal de retención y purga.
- Representación futura de acciones automáticas o integraciones.

## IdempotencyRecord

### Propósito y alcance

`IdempotencyRecord` es una entidad tenant-scoped que impide duplicar operaciones críticas ante reintentos, doble interacción o *timeout*. No sustituye la autorización ni las restricciones propias de cada operación.

| Atributo lógico | Tipo físico aprobado | Descripción |
| --- | --- | --- |
| `id` | UUID v4 | PK generada por PostgreSQL. |
| `businessId` | UUID | Tenant de la operación. |
| `scope` | Enum nativo | Clase de operación protegida. |
| `key` | Texto | Clave sensible a mayúsculas/minúsculas, máximo 128 caracteres. |
| `requestHash` | `BYTEA` | SHA-256 del contenido canónico relevante, de exactamente 32 bytes. |
| `hashVersion` | Entero positivo | Versión del algoritmo/canonicalización; inicialmente `1`. |
| `resultType` | Texto nullable | Tipo del recurso resultante cuando se conserva un puntero. |
| `resultId` | UUID nullable | Identificador del recurso resultante. |
| `responseStatus` | Entero NOT NULL | Estado necesario para reproducir la respuesta confirmada. |
| `responseBody` | JSONB nullable | Respuesta sanitizada, con máximo de 64 KiB medidos sobre la representación UTF-8 del JSON persistido. |
| `createdAt` | `TIMESTAMPTZ(3)` | Momento en que se creó el registro confirmado. |
| `completedAt` | `TIMESTAMPTZ(3)` NOT NULL | Momento en que se confirmó la operación. |

La PK es `id`; `businessId` referencia `Business.id`; y existe `UNIQUE(businessId, scope, key)`. No existe `expiresAt` ni purga automática en V1.

Los scopes aprobados son `SALE_CREATE`, `SALE_CANCEL`, `SALE_RETURN_CREATE`, `SALE_REFUND_CREATE`, `INVENTORY_ADJUST` e `INVENTORY_INITIALIZE`.

Reglas aprobadas:

- `requestHash` utiliza SHA-256 y cumple `octet_length(requestHash) = 32`; el nombre físico `request_hash` se utilizará al expresar la restricción PostgreSQL. `hashVersion` es positivo e inicialmente vale `1`.
- `IdempotencyRecord` no contiene `status`: toda fila persistida representa una operación confirmada. No existen estados físicos `PROCESSING` ni `COMPLETED` en V1.
- `completedAt` y `responseStatus` son obligatorios. Debe existir al menos `responseBody` o el par completo `resultType` + `resultId`.
- `resultType` y `resultId` están ambos presentes o ambos ausentes. Constituyen un puntero operativo y no una FK polimórfica.
- La operación de dominio y su registro idempotente completo se confirman en el mismo commit.
- La misma clave con contenido diferente se rechaza. Reintentos concurrentes no pueden crear una segunda operación.
- En cada reintento se validan nuevamente identidad, membresía `ACTIVE` y autorización.
- `responseBody` se valida en backend y se protege en SQL cuando sea viable para no superar 64 KiB de representación UTF-8. No se guardan errores de autenticación, autorización o validación previa como resultados comerciales confirmados, ni credenciales, tokens o información sensible innecesaria.
- No se eliminan registros idempotentes porque la operación comercial haya sido revertida: la anulación o devolución es otra operación histórica con su propio scope y clave.
- Si la operación falla y su transacción ejecuta rollback, no queda operación comercial confirmada ni `IdempotencyRecord`. Si una operación ya confirmada se anula o compensa posteriormente, se conservan tanto su historial como su registro idempotente; la operación compensatoria posee trazabilidad e idempotencia propias.

### Flujo transaccional y concurrencia

1. El servicio autentica y autoriza la solicitud.
2. Inicia una transacción PostgreSQL.
3. Antes de cualquier efecto comercial, adquiere un advisory transaction lock derivado de `businessId + scope + key`.
4. Consulta `IdempotencyRecord` utilizando la clave completa.
5. Si el registro existe, vuelve a verificar la autorización vigente, compara `requestHash` y devuelve el resultado autorizado o un conflicto.
6. Si no existe, ejecuta la operación comercial, construye el resultado, inserta el registro completo y confirma la transacción.

El advisory lock pertenece a la misma transacción y se libera automáticamente al terminarla. Su identificador se deriva de forma estable y reproducible; una colisión solo puede causar serialización adicional, nunca confundir registros, porque la consulta y la unicidad utilizan la clave completa. Cuando se implemente con Prisma se emplearán consultas parametrizadas y el mismo cliente transaccional. La derivación exacta del identificador queda pendiente para la implementación.

El advisory lock no sustituye `UNIQUE(businessId, scope, key)`, que permanece como árbitro final. Un *timeout* posterior al commit permite recuperar el resultado con la misma clave. No se realizan llamadas externas irreversibles dentro de la transacción comercial.

La V1 persiste exclusivamente registros completados. Una versión futura podrá incorporar procesamiento asíncrono, nuevos estados y mecanismos de recuperación mediante migraciones controladas que preserven los registros históricos; esas capacidades no se diseñan en esta etapa.

La canonicalización exacta de `requestHash` debe definirse antes de implementar los servicios.

## Convenciones físicas PostgreSQL y Prisma

- PostgreSQL 17 es el mínimo recomendado. PostgreSQL 18 es la preferencia para instalaciones nuevas, sujeto a compatibilidad y disponibilidad del hosting.
- Se utilizará una versión estable de Prisma compatible al comenzar la implementación; la versión exacta se verificará antes de instalar.
- Las PK principales se generan en PostgreSQL como UUID v4.
- Se conservan `TIMESTAMPTZ(3)`, `NUMERIC(20,6)`, `NUMERIC(19,4)` y `NUMERIC(19,2)` según las convenciones transversales.
- Los conjuntos pequeños y estables se representan mediante enums nativos.
- Las tablas y columnas físicas utilizan `snake_case`; los modelos Prisma, `PascalCase`; y sus campos, `camelCase`, utilizando `@map` y `@@map` cuando corresponda.
- Las migraciones oficiales incluyen SQL personalizado revisado para índices únicos parciales; `CHECK` aritméticos, de forma y de longitud del hash; restricciones e índices del trial histórico; protección de `trialEndsAt`; triggers append-only; privilegios PostgreSQL; y FKs compuestas que Prisma no pueda representar de forma segura.
- PostgreSQL es la fuente final de integridad referencial. Prisma representa las relaciones compatibles; las FKs compuestas opcionales y las relaciones múltiples se validarán con la versión concreta seleccionada. Si alguna no puede modelarse con seguridad, se conservará mediante migración SQL personalizada y las migraciones posteriores no podrán eliminarla inadvertidamente.
- `db push` no se utiliza como mecanismo de despliegue productivo.

## Privilegios y protección append-only

- El rol de aplicación tiene privilegios mínimos, no es propietario de las tablas y carece de privilegios ordinarios `UPDATE`, `DELETE` y `TRUNCATE` sobre `InventoryMovement` y `AuditLog`.
- Triggers `BEFORE UPDATE OR DELETE` rechazan cambios ordinarios sobre ambas tablas. El rol de aplicación tampoco puede deshabilitarlos.
- El rol de migración posee privilegios DDL controlados, credenciales separadas y se utiliza solo en procesos autorizados.
- Estas defensas protegen la operación normal, pero no prometen invulnerabilidad frente a un superusuario o propietario de la base.
- Las correcciones de inventario utilizan movimientos compensatorios. La política futura de retención administrativa de `AuditLog` permanece pendiente.

## Estrategia general de concurrencia V1

El nivel base será `READ COMMITTED`. Según la invariante se combinan restricciones `UNIQUE` como árbitro final, actualizaciones condicionales atómicas, `SELECT FOR UPDATE`, locks sobre filas raíz para reglas multirow, orden determinista de adquisición de locks y reintentos controlados ante deadlocks o conflictos.

Esta estrategia debe aplicarse, entre otros casos, a la protección del último `OWNER ACTIVE`, la ubicación predeterminada, el stock no negativo, los límites acumulados de devoluciones y reembolsos, el trial y la suscripción abierta, y la reconfiguración controlada de variantes. Los `CHECK` solo validan una fila y no sustituyen transacciones para sumas, existencia de hijos o invariantes multirow.

## Decisiones transversales pendientes

Antes de construir el esquema físico deberán revisarse conjuntamente:

- índices de consulta e índices únicos parciales que no hayan quedado definidos por las claves candidatas aprobadas;
- representación declarativa concreta de las FKs compuestas en Prisma y administración de los `CHECK` mediante migraciones;
- canonicalización exacta de hashes de idempotencia y contrato de respuesta reconstruible;
- detalles de locking y orden de adquisición para cada caso de uso dentro de la estrategia general aprobada;
- especificaciones ejecutables y pruebas compartidas de canonicalización;
- implementación física de invariantes que atraviesan múltiples filas o entidades;
- mecanismo físico adicional para comprobar completitud y sincronización de combinaciones frente a escrituras directas, sin tratar `combinationKey` como garantía suficiente;
- catálogo inicial de unidades y valores predeterminados de granularidad;

Estas decisiones pendientes no modifican las relaciones y reglas conceptuales ya aprobadas en los cinco bloques.

## Resumen de relaciones de los bloques 1, 2, 3, 4 y 5

```text
User 1 ─── N BusinessMembership N ─── 1 Business
                    │                  (al menos un OWNER ACTIVE)
                    │                      │
                    │                      ├── 1 ─── N Location
                    │                      │             └── 1 ─── N Sale
                    │                      ├── 1 ─── N Category
                    │                      ├── 1 ─── N Supplier
                    │                      ├── 1 ─── N AuditLog
                    │                      ├── 1 ─── N IdempotencyRecord
                    │                      ├── 1 ─── N Product
                    │                      │             │
                    │                      │             ├── 0..1 Category por Product
                    │                      │             ├── 1 ─── N ProductVariant
                    │                      │             │             │
                    │                      │             │             ├── N ─── M AttributeValue
                    │                      │             │             │          mediante ProductVariantAttributeValue
                    │                      │             │             ├── 1 ─── N InventoryBalance N ─── 1 Location
                    │                      │             │             ├── 1 ─── N InventoryMovement N ─── 1 Location
                    │                      │             │             └── 1 ─── N SaleItem
                    │                      │             │
                    │                      │             └── 1 ─── N Attribute 1 ─── N AttributeValue
                    │                      │
                    │                      └── 1 ─── N Subscription N ─── 1 Plan
                    │                              (máximo una abierta y un trial histórico)
                    │
                    ├── 1 ─── N InventoryMovement para operaciones humanas V1
                    ├── 1 ─── N Sale
                    ├── 1 ─── N SaleCancellation
                    ├── 1 ─── N SaleReturn
                    ├── 1 ─── N Refund
                    └── 1 ─── 0..N AuditLog como actor humano opcional

UnitOfMeasure 1 ─── N ProductVariant

Sale 1 ─── N SaleItem N ─── 1 ProductVariant
 │
 ├── 1 ─── N Payment
 ├── 1 ─── 0..1 SaleCancellation ─── 1 ─── N Refund
 ├── 1 ─── 0..N SaleReturn ─── 1 ─── N SaleReturnItem N ─── 1 SaleItem
 │                                  └── 1 ─── 0..N Refund
 └── 1 ─── 0..N Refund independientes o asociados
```

Las ventas, anulaciones, devoluciones y reembolsos se conservan como operaciones históricas. Toda restitución al inventario vendible genera un nuevo `InventoryMovement.IN` sobre la combinación de variante y `Sale.locationId`; nunca modifica los movimientos originales.

Con este Bloque 5 quedan cubiertas todas las entidades actualmente aprobadas del modelo conceptual, además de las entidades asociativas y de soporte incorporadas durante el refinamiento relacional. El documento todavía no diseña compras ni abastecimiento.
