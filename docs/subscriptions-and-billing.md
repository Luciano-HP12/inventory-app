# Suscripciones y facturación SaaS

Este documento define las reglas funcionales aprobadas para planes, suscripciones y facturación de Inventory App como SaaS comercial multiempresa. El modelo conceptual y el modelo relacional contienen sus relaciones y atributos; aquí se describe el ciclo de negocio sin seleccionar todavía una pasarela ni inventar condiciones comerciales.

## Separación de dominios

Inventory App distingue dos dominios de pagos:

- **Ventas del negocio:** `Sale` representa una venta y `Payment` representa exclusivamente los pagos que el negocio registra por esa venta.
- **Facturación SaaS:** representa los cobros que Inventory App realiza al negocio por su suscripción.

El dominio de facturación SaaS no reutiliza `Payment` ni se mezcla con las ventas, reportes comerciales o medios de pago registrados por el negocio.

## Plan

`Plan` representa una oferta del SaaS. Tiene un código técnico estable, un nombre visible y un estado de actividad.

Un plan inactivo no se ofrece para nuevas suscripciones, pero continúa existiendo para preservar las suscripciones históricas que lo referencian.

La arquitectura permitirá que un plan determine capacidades como la cantidad de ubicaciones habilitadas. Esto no modifica el modelo operativo: `Business 1:N Location` está soportado desde la V1.

No están definidos todavía:

- precios ni monedas;
- periodicidad o duración contractual;
- cantidad de ubicaciones de un plan concreto;
- cantidad máxima de empleados;
- otros límites o capacidades comerciales.

## Subscription

`Subscription` representa un período del ciclo de suscripción de un `Business`. La suscripción pertenece al negocio, no directamente a un `User`.

Un negocio puede conservar múltiples suscripciones históricas, pero como máximo una puede estar abierta a la vez. Una suscripción abierta es un período que todavía no ha terminado y cuyo estado es `TRIALING` o `ACTIVE`.

Los estados aprobados para la V1 son:

- `TRIALING`: el negocio se encuentra dentro de su trial vigente.
- `ACTIVE`: el negocio tiene acceso comercial activo fuera del trial.
- `ENDED`: el período de suscripción terminó y no concede por sí mismo acceso comercial activo.

Las transiciones mínimas aprobadas son:

```text
TRIALING → ACTIVE
TRIALING → ENDED
ACTIVE   → ENDED
```

Una suscripción `ENDED` no se reabre. Una reactivación comercial posterior crea un nuevo período histórico `ACTIVE`.

## Trial

Cada negocio puede consumir un único trial histórico. El trial dura exactamente 30 × 24 horas desde su inicio y su instante final no se amplía por cambios de correo, usuario propietario o membresías.

`trialEndsAt` es la evidencia histórica de esa concesión. Se conserva al pasar la suscripción a `ACTIVE` o `ENDED`, no se reinicia por un cambio de plan y no puede modificarse o eliminarse mediante la operación normal. No se crea una entidad `TrialGrant` ni un indicador redundante `trialConsumed`.

Crear o utilizar una nueva dirección de correo no concede automáticamente otro trial. El derecho al trial se modela alrededor de `Business`, no de `User`.

Cuando se alcanza el instante final del trial, el negocio deja de tener acceso por trial aunque un proceso programado todavía no haya materializado el cambio de estado a `ENDED`. La autorización comercial debe evaluar la vigencia temporal y no confiar únicamente en que un proceso diferido ya haya actualizado el registro.

El onboarding seguirá siendo sencillo. La V1 no aplicará por defecto bloqueos agresivos basados en nombre comercial, dirección IP, dispositivo u otros mecanismos similares. Cualquier control antifraude adicional requerirá una decisión posterior justificada.

## Cambios de plan e historial

Un cambio efectivo de plan preserva el historial:

1. termina el período abierto asociado al plan anterior;
2. crea un nuevo período de suscripción asociado al nuevo plan;
3. realiza ambos efectos de forma consistente en una misma operación transaccional.

No se modifica retroactivamente el plan de una suscripción histórica para representar un cambio posterior.

El modelo relacional refuerza bajo concurrencia tanto el trial único como la única suscripción abierta mediante índices únicos parciales. La duración exacta, la coherencia entre estado y fechas, y la inmutabilidad de la evidencia del trial se protegen además con restricciones y triggers PostgreSQL. Las transiciones comerciales continúan siendo responsabilidad del servicio.

## Facturación SaaS

La facturación de suscripciones utilizará posteriormente un proveedor o pasarela externa todavía no seleccionada.

Inventory App no almacenará directamente datos sensibles de tarjetas. El backend no confiará únicamente en información enviada por el frontend para activar una suscripción; la confirmación deberá proceder de un mecanismo confiable del proveedor elegido.

Todavía no se define qué evento concreto autoriza la transición a `ACTIVE`.

## Finalización y conservación de datos

El vencimiento del trial sin una suscripción activa o la finalización posterior de una suscripción afecta el derecho de uso, pero no provoca por sí mismo la eliminación inmediata de `Business`, productos, inventario, ventas ni otros datos.

Continúan pendientes:

- la política de acceso restringido después de `ENDED`;
- el período de conservación;
- las condiciones de exportación;
- la eventual eliminación de datos.

No debe inferirse acceso posterior, período de gracia ni otra política comercial hasta que sea aprobada.

## Decisiones pendientes

- Proveedor de facturación y contratos de integración.
- Evento confiable que permite activar una suscripción.
- Precios, monedas, periodicidad y duración contractual.
- Límites y capacidades concretas de cada plan.
- Política de acceso, conservación, exportación y eliminación después de `ENDED`.

Los detalles relacionales y los mecanismos físicos para proteger el historial, el único trial y la única suscripción abierta se documentan en `docs/relational-data-model.md`.
