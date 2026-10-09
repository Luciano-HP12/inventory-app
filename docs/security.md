# Seguridad

Este documento reúne los principios de seguridad aprobados para Inventory App. Se aplican desde el diseño y deberán concretarse durante la implementación sin seleccionar proveedores ni mecanismos no aprobados.

## Autenticación gestionada e identidad

La autenticación será administrada mediante un proveedor especializado externo todavía no seleccionado. Inventory App no almacenará contraseñas ni implementará por cuenta propia el mecanismo de autenticación del proveedor.

La identidad externa estable de un `User` se determina mediante la combinación de:

- `issuer`: emisor confiable de la identidad;
- `externalSubject`: identificador estable del usuario dentro de ese emisor.

El correo electrónico es un dato local opcional y mutable. No constituye la identidad estable, no debe ser globalmente único ni puede utilizarse por sí solo para fusionar o vincular cuentas.

Los usuarios deberán utilizar cuentas cuyo correo haya sido verificado por el proveedor. No basta con validar el formato de la dirección ni con confiar en un indicador enviado por el cliente. Inventory App no mantiene `emailVerified` como fuente autoritativa local.

El proveedor concreto, la recuperación de cuentas, la vinculación futura de múltiples identidades y mecanismos como MFA no están definidos en esta etapa.

## Autorización y membresías

La autenticación confirma quién es el usuario; la autorización determina qué puede hacer dentro de un negocio. Toda operación protegida debe validar en el backend:

1. la identidad autenticada;
2. la existencia de la `BusinessMembership` correspondiente;
3. que la membresía tenga estado `ACTIVE`;
4. que su rol autorice la operación;
5. que los datos y relaciones involucrados pertenezcan al mismo `Business`.

Una membresía `REVOKED` pierde acceso al negocio aunque la sesión con el proveedor de autenticación continúe vigente. La revocación no elimina la membresía ni las operaciones históricas realizadas bajo ella.

Los únicos roles de la V1 son `OWNER` y `EMPLOYEE`. Las anulaciones, devoluciones y reembolsos están reservados a `OWNER`; `EMPLOYEE` puede registrar ventas, pero no ejecutar esas operaciones sensibles.

Cada negocio debe conservar al menos una membresía `ACTIVE` con rol `OWNER`. Los cambios de rol y revocaciones deben impedir que una operación, incluso concurrente, deje al negocio sin propietario activo.

No se incorpora un sistema RBAC configurable ni permisos personalizados en la V1.

## Aislamiento multi-tenant

`Business` es el límite de aislamiento operativo. Un usuario puede pertenecer a varios negocios, pero cada solicitud protegida debe ejecutarse dentro de un contexto de negocio autorizado mediante una membresía activa.

El backend nunca confiará únicamente en un `businessId` o identificador de recurso enviado por el frontend. Las consultas de datos tenant-scoped deben quedar acotadas al negocio autorizado y no buscar primero un recurso globalmente para comprobar su pertenencia después de exponerlo.

Todas las relaciones deben impedir referencias cruzadas entre negocios. Esto incluye, entre otras, las relaciones entre:

- productos y categorías;
- variantes, atributos y valores;
- variantes, ubicaciones, balances y movimientos;
- ventas, detalles, variantes, pagos y membresías;
- anulaciones, devoluciones, reembolsos y sus ventas de origen;
- registros de auditoría y membresías responsables.

Las claves foráneas compuestas tenant-scoped que incluyen `businessId` forman parte de la estrategia aprobada como defensa adicional cuando las entidades poseen tenant directo. Sus claves candidatas y relaciones aprobadas se concentran en el modelo relacional. En relaciones compuestas opcionales, los `CHECK` de forma son obligatorios para evitar que la semántica `MATCH SIMPLE` deje combinaciones parciales sin validar.

Cuando una entidad deriva su tenant mediante otra relación, todas las rutas deben conducir al mismo `Business` y reforzarse con constraints, transacciones u otra protección equivalente cuando una FK simple no sea suficiente.

## Validación de entrada

Todos los datos que puedan modificar estado deben validarse en el backend. La validación del frontend puede mejorar la experiencia, pero no constituye un control de seguridad.

El backend debe validar, según la operación:

- tipos, presencia y rangos permitidos;
- cantidades e importes positivos o no negativos según corresponda;
- pertenencia al tenant;
- estado activo de membresías y entidades operativas;
- permisos del rol;
- invariantes de inventario, ventas, devoluciones y reembolsos.

Los identificadores y valores enviados por el cliente no se consideran confiables hasta ser validados dentro del contexto autorizado.

## Integridad, concurrencia e idempotencia

La integridad del inventario y de las ventas es un requisito de seguridad. Las operaciones críticas deben conservar la consistencia transaccional entre los registros comerciales, el saldo materializado y el libro de movimientos.

La concurrencia debe controlarse para impedir:

- stock negativo;
- más de una anulación de la misma venta;
- devoluciones acumuladas superiores a la cantidad vendida;
- reembolsos acumulados superiores al importe permitido;
- revocación o degradación concurrente del último `OWNER` activo.

Las ventas, anulaciones, devoluciones, reembolsos, ajustes y registro de stock inicial utilizan `IdempotencyRecord` tenant-scoped. Repetir la misma solicitud por doble interacción, reintento o *timeout* no debe crear una segunda operación ni duplicar sus pagos, movimientos o actualizaciones de stock.

La operación y su registro idempotente completo se confirman en el mismo commit. `IdempotencyRecord` no posee `status`: toda fila persistida representa una operación confirmada. La misma clave con distinto `requestHash` se rechaza y cada reintento vuelve a validar identidad, membresía `ACTIVE` y permisos actuales.

Si la operación falla y ejecuta rollback, no queda operación comercial confirmada ni registro idempotente. Una operación confirmada conserva su historial y registro idempotente aunque sea anulada o compensada posteriormente; la compensación es otra operación histórica con su propia idempotencia. No se almacenan errores previos de autenticación o autorización como resultados comerciales confirmados, ni credenciales, tokens o información sensible innecesaria.

El hash utiliza SHA-256 binario de 32 bytes con versión positiva. `responseBody` es JSON sanitizado y nullable, limitado a 64 KiB de representación UTF-8 persistida mediante validación backend y protección SQL cuando sea viable. La canonicalización exacta del hash continúa pendiente antes de implementar los servicios.

La concurrencia por clave se serializa dentro de la transacción mediante un advisory transaction lock derivado de `businessId + scope + key`, adquirido antes de cualquier efecto comercial. Después del lock siempre se consulta la clave completa y se compara el hash; el índice único permanece como defensa final. El lock se libera al finalizar la transacción y, al implementarlo con Prisma, se utilizarán consultas parametrizadas y el mismo cliente transaccional. No se realizan llamadas externas irreversibles dentro de la transacción comercial.

La V1 utiliza `READ COMMITTED` como nivel base y combina restricciones únicas, actualizaciones condicionales, locks de filas y reintentos controlados. El mecanismo concreto se selecciona por caso de uso según el diseño relacional.

## Trazabilidad y conservación histórica

Las operaciones sensibles deben conservar trazabilidad suficiente para identificar el negocio, la membresía responsable, la acción y el momento correspondiente.

Se consideran inicialmente auditables:

- cambios de roles o membresías;
- cambios de precios;
- ajustes manuales de inventario;
- anulaciones;
- devoluciones;
- reembolsos;
- cambios sensibles de configuración del negocio.

`InventoryMovement` conserva el historial de cambios de existencias. `AuditLog` registra acciones relevantes del sistema. Una operación puede generar ambos cuando corresponda, pero cada entidad mantiene una responsabilidad diferente.

`AuditLog.action` y `AuditLog.entityType` son textos obligatorios de hasta 64 caracteres, no enums PostgreSQL cerrados. El servicio valida sus catálogos y la base rechaza valores vacíos o formados solo por espacios.

Los movimientos, ventas, pagos, anulaciones, devoluciones, reembolsos, suscripciones y registros de auditoría históricos no deben eliminarse o sobrescribirse mediante la operación normal para ocultar o representar una corrección. Las correcciones de inventario utilizan movimientos compensatorios y las reversiones comerciales conservan los registros originales.

La conexión normal de la aplicación utiliza un rol PostgreSQL con privilegios mínimos que no es propietario de las tablas. No tiene privilegios ordinarios `UPDATE`, `DELETE` ni `TRUNCATE` sobre `InventoryMovement` y `AuditLog`, ni puede deshabilitar sus triggers de protección. Un rol de migración separado conserva privilegios DDL controlados y credenciales distintas. Estas medidas no prometen protección absoluta frente a superusuarios o propietarios de la base.

## Información sensible y pagos

`Payment` representa exclusivamente pagos de ventas registrados por el negocio. La facturación SaaS pertenece a un dominio independiente y no reutiliza esa entidad ni sus reportes comerciales.

Inventory App no almacenará directamente datos sensibles de tarjetas. La facturación SaaS será procesada posteriormente mediante un proveedor externo todavía no seleccionado.

El backend no confiará únicamente en información enviada por el frontend para confirmar pagos o activar una suscripción. La confirmación deberá proceder de mecanismos confiables del proveedor elegido.

Los cobros confirmados de suscripción se registran en `SubscriptionPayment`, separado de `Payment`. La confirmación del cobro, el período cubierto y la ampliación de `Subscription.currentPeriodEndsAt` deben ser transaccionales e idempotentes. Los intentos pendientes, fallidos o rechazados no conceden ni amplían acceso.

## Autorización comercial por suscripción

Los estados físicos de `Subscription` son `TRIALING`, `ACTIVE` y `ENDED`. El backend deriva `TRIAL_ACCESS`, `PAID_ACCESS`, `GRACE_PERIOD` o `SUSPENDED` usando el estado, los límites temporales y tiempo autoritativo para cada operación protegida; no confía en un job programado ni en un valor enviado por el cliente.

El trial termina exactamente en `trialEndsAt`, no tiene gracia y no genera cobros automáticos. La gracia dura exactamente 72 horas y solo se calcula después de `currentPeriodEndsAt` de una suscripción pagada. Al terminar sin renovación confirmada, se aplica la política de suspensión documentada en `roles.md`.

Durante la suspensión, las consultas y exportaciones permitidas a `OWNER` siguen acotadas al `Business` autorizado. La condición suspendida nunca concede acceso transversal ni sustituye las validaciones de identidad, membresía `ACTIVE` y rol. `EMPLOYEE` no accede a datos comerciales durante la suspensión.

La administración interna de la plataforma es un ámbito separado. Los roles `OWNER` y `EMPLOYEE` no otorgan administración global ni acceso implícito a otros negocios.

Las credenciales, secretos y datos sensibles no deben exponerse en código, registros, documentación, repositorios ni respuestas al cliente.

## Prevención gradual de abuso

El onboarding priorizará una experiencia sencilla y evitará verificaciones innecesariamente restrictivas.

El trial es único por `Business`. Una nueva dirección de correo no concede automáticamente otro trial. La V1 no aplicará por defecto bloqueos agresivos basados en nombre comercial, dirección IP, dispositivo u otros mecanismos similares.

El nombre comercial de `Business` no es globalmente único y no se utilizará por sí solo para impedir duplicados. Los controles antifraude adicionales se incorporarán únicamente cuando exista una necesidad justificada y una decisión explícita.

## Mantenibilidad de los controles

Los controles de autenticación, autorización, tenant, validación, transacciones e idempotencia deberán implementarse mediante responsabilidades claras y componentes reutilizables del backend. Las reglas críticas no deben quedar dispersas únicamente en controladores o en la interfaz de usuario.

## Decisiones pendientes

- Proveedor externo de autenticación y convención concreta de `issuer`.
- Sincronización de perfil y futura vinculación de múltiples identidades.
- Flujos de invitación, recuperación y reactivación que sean aprobados posteriormente.
- Verificación de la representación Prisma de FKs compuestas y de las migraciones SQL complementarias.
- Canonicalización del hash idempotente y detalle de locking por operación dentro de la estrategia aprobada.
- Catálogo definitivo y política de retención de auditoría.
- Proveedor de facturación SaaS y mecanismo confiable de confirmación.
- Modelo de intentos de cobro pendientes, fallidos, rechazados o revertidos e idempotencia de eventos del proveedor.
- Identidad, autorización, auditoría y alcance de la administración interna de la plataforma.

No se presuponen MFA, políticas de recuperación ni mecanismos antifraude adicionales mientras no sean aprobados.
