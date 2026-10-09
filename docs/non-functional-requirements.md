# Requisitos no funcionales

Inventory App es un SaaS comercial multiempresa. La seguridad, el aislamiento tenant, la integridad de inventario y ventas, la mantenibilidad y la capacidad de evolucionar sin romper el historial son requisitos desde el diseño.

## Arquitectura y persistencia

La aplicación utiliza PostgreSQL como base de datos relacional y Prisma como ORM. La arquitectura debe mantener separadas las responsabilidades del frontend, backend, reglas de dominio y persistencia.

El backend debe organizar sus controles y operaciones de forma modular y reutilizable. Las reglas críticas no deben existir únicamente en la interfaz ni quedar duplicadas de manera inconsistente entre distintos flujos.

El diseño debe soportar múltiples negocios y múltiples ubicaciones por negocio sin sacrificar el aislamiento. No se definen todavía métricas de disponibilidad, latencia, capacidad, RPO, RTO ni una infraestructura concreta de despliegue.

## Seguridad y aislamiento multi-tenant

`Business` es el tenant operativo. Toda autorización y consulta de datos tenant-scoped debe validarse en el backend a partir de una identidad válida y una `BusinessMembership` `ACTIVE` con el rol apropiado.

Las consultas deben quedar acotadas al negocio autorizado y las relaciones no pueden conectar datos de negocios distintos. Las FKs compuestas tenant-scoped forman parte de la estrategia de defensa adicional cuando corresponda; su implementación exacta en PostgreSQL y Prisma permanece en el diseño físico.

La autenticación será gestionada mediante un proveedor externo todavía no seleccionado. Inventory App utiliza `issuer` y `externalSubject` como identidad externa estable; el correo opcional no se utiliza por sí solo para vincular cuentas.

Todos los datos de entrada que afecten el estado del sistema deben validarse en el backend.

## Precisión monetaria

Los valores monetarios utilizan representación decimal exacta:

- precios unitarios: `NUMERIC(19,4)`;
- importes finales, subtotales, totales, pagos y reembolsos: `NUMERIC(19,2)`.

Cada subtotal de venta se calcula a partir del precio unitario final y la cantidad y se redondea a dos decimales mediante `ROUND_HALF_UP`. `Sale.total` es la suma de los subtotales ya redondeados.

Los importes derivados de anulaciones, devoluciones y reembolsos deben aplicar la misma política y mantenerse coherentes con los valores históricos de la venta.

El backend debe utilizar aritmética decimal exacta en operaciones monetarias críticas. No se utilizarán `float` ni `number` de JavaScript para cálculos financieros.

## Cantidades

Las cantidades de catálogo, inventario, ventas y devoluciones utilizan `NUMERIC(20,6)`.

Las cantidades de ventas, devoluciones y movimientos deben ser positivas. Los saldos y el stock mínimo no pueden ser negativos. Cada variante referencia una unidad base global mediante `unitOfMeasureId` y define `quantityStep > 0`; toda cantidad debe ser un múltiplo exacto de esa granularidad. La V1 no realiza conversiones entre unidades.

## Fechas y horas

Los atributos temporales persistidos utilizan `TIMESTAMPTZ(3)`.

- UTC es la referencia interna para persistencia, comparación y reglas de dominio.
- `America/Lima` es la zona horaria de presentación de la V1.
- `createdAt` representa cuándo Inventory App registró el dato.
- `occurredAt` representa cuándo ocurrió efectivamente la operación.

La presentación en una zona horaria no debe cambiar el instante persistido. Los flujos que permiten registro posterior, como ventas realizadas durante una interrupción, deben conservar la diferencia entre ocurrencia y registro.

## Atomicidad e integridad transaccional

Las operaciones críticas deben ejecutarse de forma atómica.

En inventario, la actualización de `InventoryBalance` y la creación de `InventoryMovement` forman una misma transacción.

Registrar una venta debe conservar en una misma transacción:

- la venta y sus detalles;
- sus pagos completos;
- los movimientos de salida;
- las actualizaciones de saldo correspondientes.

Las anulaciones y devoluciones deben conservar atómicamente su operación comercial, los movimientos compensatorios, las actualizaciones de saldo y los reembolsos que formen parte de la misma operación.

Si falla cualquier validación o efecto requerido, no debe persistirse un estado parcial.

## Concurrencia

La implementación debe controlar operaciones concurrentes para impedir:

- que dos operaciones consuman las mismas existencias y produzcan stock negativo;
- ventas duplicadas;
- más de una anulación por venta;
- devoluciones acumuladas superiores a la cantidad vendida;
- reembolsos acumulados superiores al importe permitido;
- combinaciones incompatibles de anulación y devolución;
- pérdida del último `OWNER` activo por cambios concurrentes.

La V1 utiliza `READ COMMITTED` como nivel base. Según la invariante se combinan restricciones `UNIQUE`, actualizaciones condicionales atómicas, `SELECT FOR UPDATE`, locks sobre filas raíz, un orden determinista de adquisición y reintentos controlados ante conflictos o deadlocks. El mecanismo exacto debe definirse y probarse para cada operación.

## Idempotencia

Las ventas, anulaciones, devoluciones, reembolsos, ajustes y stock inicial deben ser idempotentes dentro del contexto del tenant.

Repetir una solicitud por doble interacción, reintento de red o *timeout* no debe crear una segunda operación ni duplicar detalles, pagos, movimientos, reembolsos o actualizaciones de saldo.

`IdempotencyRecord` conserva una clave por negocio y scope, un hash SHA-256 binario de exactamente 32 bytes y el resultado confirmado. No posee una columna de estado: toda fila persistida representa una operación completada. La operación y el registro se confirman en el mismo commit; la misma clave con distinto hash se rechaza y la identidad, membresía `ACTIVE` y permisos se reevalúan en cada reintento.

Si la operación ejecuta rollback, no queda operación comercial confirmada ni registro idempotente. Una reversión posterior conserva la operación original y su idempotencia, y se registra como una nueva operación. La respuesta JSON sanitizada es opcional y no supera 64 KiB medidos sobre su representación UTF-8 persistida. No existe expiración ni purga automática en V1.

Antes de cualquier efecto comercial, la transacción adquiere un advisory transaction lock por `businessId + scope + key` y vuelve a consultar la clave completa. El lock se libera automáticamente al terminar la transacción y no sustituye la restricción única. Su identificador debe derivarse de forma estable y reproducible; las colisiones solo pueden serializar solicitudes no relacionadas y nunca sustituyen la comparación de la clave completa. Un *timeout* posterior al commit permite recuperar el resultado con la misma clave. No se realizan llamadas externas irreversibles dentro de la transacción comercial.

La V1 persiste exclusivamente registros completados. Una evolución futura podrá incorporar procesamiento asíncrono, nuevos estados y mecanismos de recuperación mediante migraciones controladas que preserven el historial.

## Trazabilidad y conservación histórica

Todo cambio de existencias genera un movimiento. Los movimientos históricos no se eliminan ni se modifican libremente; las correcciones utilizan movimientos compensatorios.

Las ventas, detalles, pagos, anulaciones, devoluciones, reembolsos y suscripciones históricos se conservan. Una reversión no elimina ni sobrescribe los registros originales.

Las membresías revocadas y las entidades operativas desactivadas deben conservar las referencias históricas existentes. No se adopta eliminación en cascada de históricos ni un mecanismo universal de borrado lógico.

Las operaciones sensibles deben poder generar registros de auditoría. `AuditLog` no sustituye a `InventoryMovement` ni se utiliza como fuente del estado operativo.

`InventoryMovement` y `AuditLog` son append-only para el rol normal de aplicación. Se combinan privilegios mínimos, ausencia de `UPDATE`/`DELETE`/`TRUNCATE` ordinarios y triggers de rechazo. El rol de migración utiliza credenciales separadas y privilegios DDL controlados; no se promete protección frente a superusuarios o propietarios de la base.

## Protección y separación de pagos

Los pagos de ventas registrados por un negocio y la facturación de suscripciones de Inventory App son dominios separados.

La facturación SaaS utilizará un proveedor externo todavía no seleccionado. Inventory App no almacenará directamente datos sensibles de tarjetas y no considerará confirmado un pago o activada una suscripción basándose únicamente en información enviada por el frontend.

`SubscriptionPayment` conserva cobros SaaS confirmados, sus importes y períodos cubiertos; no reutiliza `Payment`. La confirmación confiable, la creación del registro y la ampliación de `currentPeriodEndsAt` deben ser atómicas e idempotentes. Los intentos pendientes, fallidos o rechazados no amplían cobertura.

## Onboarding, trial y ciclo de datos

El trial dura exactamente 30 × 24 horas, es único por negocio, no tiene gracia y no se renueva por utilizar otro correo. Su vencimiento debe evaluarse temporalmente aunque un proceso programado todavía no haya actualizado el estado de la suscripción.

Cada período pagado dura exactamente 30 × 24 horas. Su límite superior exclusivo es `currentPeriodEndsAt`; después existe una gracia exclusiva de suscripciones pagadas de exactamente 3 × 24 horas. El backend deriva el acceso vigente, la gracia o la suspensión usando tiempo autoritativo en cada operación protegida, sin depender de procesos programados.

La suspensión aplica la política diferenciada de `OWNER` y `EMPLOYEE`, pero no elimina datos, historial ni membresías. La política de conservación y eventual eliminación a largo plazo sigue pendiente.

La V1 no aplicará por defecto bloqueos agresivos basados en nombre comercial, dirección IP, dispositivo u otros mecanismos similares. El nombre comercial no se utilizará como identificador globalmente único.

## Conectividad y contingencia

La V1 requiere conexión a Internet para toda operación que modifique información.

Si un dispositivo pierde la conexión, otros dispositivos del negocio que mantengan acceso a Internet pueden continuar operando normalmente.

Ante una pérdida total de conectividad, el negocio puede utilizar temporalmente un registro manual. Cuando se restablezca la conexión, las ventas se registran posteriormente como ventas normales para actualizar ventas, pagos, movimientos, saldos y reportes.

Las ventas realizadas durante una interrupción no deben regularizarse únicamente mediante ajustes manuales de stock. Los ajustes se reservan para diferencias físicas reales, como pérdidas, productos dañados o errores de conteo.

El modo offline con almacenamiento local, sincronización automática y resolución de conflictos queda fuera del alcance de la V1.

## Mantenibilidad y evolución

El código y el modelo deben mantener responsabilidades claras, validaciones centralizadas y reglas de dominio verificables. Las decisiones deben permanecer documentadas y los cambios futuros deben preservar el aislamiento, la trazabilidad y la compatibilidad con el historial existente.

PostgreSQL 17 es el mínimo recomendado y PostgreSQL 18 la preferencia para instalaciones nuevas, sujeto al hosting. Se utilizará una versión estable y compatible de Prisma verificada antes de instalar. Las migraciones oficiales conservarán el SQL personalizado necesario para índices únicos parciales; `CHECK` aritméticos, de forma y longitud del hash; trial histórico; protección de `trialEndsAt`; triggers append-only; privilegios; y FKs compuestas no representables con seguridad por Prisma. `db push` no será el mecanismo de despliegue productivo.

Posibles evoluciones futuras ya identificadas, pero fuera del alcance actual, incluyen:

- modo offline y sincronización automática;
- consulta local de productos, precios y último stock conocido;
- gestión de conflictos de sincronización;
- fidelización de clientes;
- promociones y reglas comerciales avanzadas.

## Decisiones pendientes

- Mecanismo concreto de locking y orden de adquisición por operación dentro de la estrategia aprobada; para idempotencia queda pendiente la derivación exacta del identificador del advisory lock.
- Canonicalización exacta del hash idempotente.
- Catálogo inicial de unidades y valores predeterminados de `quantityStep`.
- Proveedor y evento confiable de confirmación de cobros SaaS; modelo de intentos pendientes, fallidos, rechazados o revertidos.
- Tratamiento fiscal y snapshots definitivos de IGV.
- Cancelación voluntaria, cierre como `ENDED`, reactivación posterior y conservación de datos a largo plazo.
- Administración interna de la plataforma, límites comerciales y reglas futuras de precios o cambios de plan.
- Métricas futuras de disponibilidad, rendimiento, capacidad, RPO y RTO.
- Infraestructura y estrategia de despliegue.

Estas decisiones pendientes no autorizan a asumir valores o garantías que todavía no han sido aprobados.
