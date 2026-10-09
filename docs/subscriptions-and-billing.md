# Suscripciones y facturación SaaS

Este documento define las reglas funcionales aprobadas para planes, suscripciones y facturación de Inventory App como SaaS comercial multiempresa. El modelo conceptual y el modelo relacional contienen sus relaciones y atributos; aquí se describe el ciclo de negocio sin seleccionar todavía una pasarela ni inventar condiciones comerciales.

## Separación de dominios

Inventory App distingue dos dominios de pagos:

- **Ventas del negocio:** `Sale` representa una venta y `Payment` representa exclusivamente los pagos que el negocio registra por esa venta.
- **Facturación SaaS:** representa los cobros que Inventory App realiza al negocio por su suscripción.

El dominio de facturación SaaS no reutiliza `Payment` ni se mezcla con las ventas, reportes comerciales o medios de pago registrados por el negocio.

Los cobros de Inventory App se representan conceptualmente mediante `SubscriptionPayment`, separados de los pagos que los negocios reciben de sus clientes.

## Plan

`Plan` representa una oferta del SaaS. Tiene un código técnico estable, un nombre visible y un estado de actividad. La V1 ofrece únicamente el plan `Esencial`, con precio anunciado de S/ 99.90 por cada período fijo de 30 × 24 horas, con IGV incluido cuando corresponda.

Un plan inactivo no se ofrece para nuevas suscripciones, pero continúa existiendo para preservar las suscripciones históricas que lo referencian.

Una futura representación de capacidades configurables podrá evaluarse cuando existan planes y límites comerciales concretos. `PlanFeature` no forma parte del modelo implementable de la V1. Seguridad, integridad, aislamiento multi-tenant y respaldos son garantías obligatorias para todos los planes y no se modelan como beneficios opcionales.

No están definidos todavía:

- límites de usuarios, ubicaciones u otros recursos del plan `Esencial`;
- cantidad máxima de empleados;
- otros límites o capacidades comerciales configurables.

## Subscription

`Subscription` representa un período del ciclo de suscripción de un `Business`. La suscripción pertenece al negocio, no directamente a un `User`.

Un negocio puede conservar múltiples suscripciones históricas, pero como máximo una puede permanecer abierta a la vez. Una suscripción abierta tiene `endedAt = null` y estado físico `TRIALING` o `ACTIVE`. Los permisos de los empleados no crean suscripciones independientes: la suscripción se evalúa para el `Business`.

Los estados físicos aprobados para la V1 son:

- `TRIALING`: la suscripción contiene la única concesión histórica de prueba del negocio.
- `ACTIVE`: existe una relación pagada abierta; este estado no garantiza por sí solo que la cobertura esté vigente en el instante consultado.
- `ENDED`: la suscripción fue cerrada y no concede por sí misma acceso comercial.

Las transiciones físicas mínimas aprobadas se mantienen:

```text
TRIALING → ACTIVE
TRIALING → ENDED
ACTIVE   → ENDED
```

`GRACE_PERIOD` y `SUSPENDED` son condiciones efectivas de acceso derivadas, no estados persistidos. La autorización las calcula a partir del estado físico, los límites temporales y el tiempo autoritativo. Ninguna transición ni vencimiento autoriza cobros automáticos sin consentimiento.

## Trial

Cada negocio puede consumir un único trial histórico. El trial dura exactamente 30 × 24 horas desde su inicio y su instante final no se amplía por cambios de correo, usuario propietario o membresías.

`trialEndsAt` es la evidencia histórica de esa concesión y debe conservarse aunque el negocio contrate posteriormente o pierda acceso. No se reinicia por un cambio de plan y no puede modificarse o eliminarse mediante la operación normal.

Crear o utilizar una nueva dirección de correo no concede automáticamente otro trial. El derecho al trial se modela alrededor de `Business`, no de `User`.

La prueba gratuita no genera un cobro automático ni dispone de período de gracia. Al alcanzar `trialEndsAt`, el acceso por trial termina inmediatamente aunque un proceso programado todavía no haya materializado el cambio físico a `ENDED`. Contratar `Esencial` requiere consentimiento del cliente y confirmación confiable del pago.

El onboarding seguirá siendo sencillo. La V1 no aplicará por defecto bloqueos agresivos basados en nombre comercial, dirección IP, dispositivo u otros mecanismos similares. Cualquier control antifraude adicional requerirá una decisión posterior justificada.

## Cobertura pagada, renovación, gracia y suspensión

Una suscripción pagada utiliza `currentPeriodEndsAt` como límite superior exclusivo de su cobertura vigente. Cada período pagado dura exactamente 30 × 24 horas; no utiliza meses calendario ni conserva un día de aniversario mensual.

La condición efectiva se evalúa con el tiempo autoritativo del backend:

- existe `PAID_ACCESS` mientras el instante actual sea anterior a `currentPeriodEndsAt`;
- existe `GRACE_PERIOD` desde `currentPeriodEndsAt`, inclusive, hasta `currentPeriodEndsAt + 72 horas`, de forma exclusiva;
- existe `SUSPENDED` al alcanzar ese último límite sin una renovación confirmada.

Durante `GRACE_PERIOD`, el negocio conserva su operación normal y recibe avisos de renovación. El cálculo no depende de que un proceso programado actualice una fila.

Las renovaciones amplían cobertura únicamente tras una confirmación confiable del pago:

- antes del vencimiento, el nuevo período comienza en el `currentPeriodEndsAt` vigente;
- durante la gracia, comienza en el `currentPeriodEndsAt` vencido, por lo que la gracia no añade cobertura gratuita;
- después de la suspensión, comienza en el instante de confirmación.

Cada renovación agrega exactamente 720 horas. Un pago pendiente, fallido o rechazado no amplía `currentPeriodEndsAt`. La confirmación del cobro, su período cubierto y la actualización de la cobertura deben conservar coherencia transaccional e idempotente.

Durante `SUSPENDED`, una membresía `OWNER ACTIVE` puede iniciar sesión, consultar productos, inventario y ventas en modo lectura, exportar datos de su propio negocio, consultar la suscripción, renovarla y cerrar sesión. No puede registrar ventas, anulaciones, devoluciones, reembolsos, movimientos o ajustes de inventario; tampoco modificar productos, variantes, ubicaciones, membresías ni otros datos comerciales o administrativos.

Una membresía `EMPLOYEE ACTIVE` solo puede autenticarse, ver el aviso de suspensión y cerrar sesión. No puede consultar ni exportar datos comerciales, renovar ni ejecutar operaciones del negocio.

La suspensión no elimina datos, historial ni membresías. Todas las consultas y exportaciones permitidas continúan sujetas al aislamiento del `Business` y a la autorización backend.

Una suscripción `ENDED` no se reabre; la reactivación después de un cierre definitivo continúa pendiente y, conforme al modelo vigente, requeriría una nueva suscripción. El historial de contrataciones, cobros y períodos cubiertos debe preservarse.

## Facturación SaaS

`SubscriptionPayment` representa un cobro confirmado del negocio por su suscripción a Inventory App. Una suscripción puede tener múltiples cobros históricos. Cada registro conserva el importe y las condiciones monetarias aplicadas, así como el intervalo de cobertura adquirido. Esta entidad no representa pagos de ventas ni reembolsos que el negocio realiza a sus propios clientes.

La facturación utilizará posteriormente un proveedor o pasarela externa todavía no seleccionada.

Inventory App no almacenará directamente datos sensibles de tarjetas. El backend no confiará únicamente en información enviada por el frontend para activar una suscripción; la confirmación deberá proceder de un mecanismo confiable del proveedor elegido.

Todavía no se define qué evento concreto y verificable confirma un cobro, una renovación o la transición a `ACTIVE`. Tampoco se definen estados ni persistencia para intentos pendientes, fallidos, rechazados o revertidos.

## Finalización y conservación de datos

La suspensión afecta el derecho a ejecutar operaciones comerciales, pero no provoca por sí misma la eliminación de `Business`, productos, inventario, ventas, membresías ni otros datos.

Continúan pendientes:

- el período de conservación;
- la eventual eliminación de datos.

La política de lectura y exportación durante la suspensión es la definida anteriormente. No debe inferirse una conservación indefinida ni una política de eliminación todavía no aprobada.

## Decisiones pendientes

- Proveedor de facturación y contratos de integración.
- Evento confiable que confirma un cobro o permite activar una suscripción.
- Modelo de intentos de cobro pendientes, fallidos, rechazados o revertidos.
- Tratamiento fiscal y snapshots definitivos de IGV.
- Política de cancelación voluntaria y momento en que una suscripción pasa a `ENDED`.
- Reactivación después de un cierre definitivo.
- Política de conservación de datos a largo plazo.
- Límites de usuarios y demás capacidades concretas de `Esencial`.
- Reglas de precios futuros y cambios de plan.
- Identidad, autorización y alcance de la administración interna de la plataforma.
- Atributos de integración externa de `SubscriptionPayment` una vez seleccionado el proveedor.

Los detalles relacionales se documentan en `docs/relational-data-model.md`. Estas reglas no autorizan a inventar estados de cobro, atributos fiscales ni mecanismos del proveedor todavía no aprobados.
