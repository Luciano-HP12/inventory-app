# Arquitectura tecnológica

Este documento consolida las decisiones arquitectónicas aprobadas para la V1 de Inventory App. Su propósito es orientar la implementación futura sin duplicar los modelos de datos ni ampliar el alcance funcional.

## Principios

Inventory App será un SaaS comercial multiempresa. La arquitectura debe preservar desde el backend:

- aislamiento entre negocios;
- integridad del inventario y las ventas;
- trazabilidad y conservación histórica;
- separación entre pagos comerciales y facturación SaaS;
- mantenibilidad y evolución incremental.

`Business` es el tenant operativo. La seguridad y las reglas de dominio no pueden depender únicamente del frontend.

## Frontend

La aplicación web utilizará:

- React;
- TypeScript;
- Vite;
- Tailwind CSS.

La interfaz será responsive para su uso desde computadoras y dispositivos móviles. El frontend se organizará por funcionalidades o *features*, agrupando los componentes relacionados con cada dominio.

La aplicación estará preparada arquitectónicamente para funcionar como Progressive Web App (PWA). En la V1, toda operación de escritura requiere conexión a Internet; el almacenamiento local de operaciones, la sincronización offline automática y la resolución de conflictos no forman parte del alcance.

El frontend puede aplicar validaciones para mejorar la experiencia, pero no constituye la autoridad para permisos, tenant, dinero, inventario ni otras reglas críticas.

## Backend y API

El backend utilizará:

- Node.js;
- TypeScript;
- Express;
- API REST.

Se organizará modularmente por dominio. Cuando corresponda, una solicitud seguirá el flujo:

```text
Route → Middleware → Controller → Service → Prisma
```

Responsabilidades principales:

- **Route:** declara el endpoint y conecta los componentes necesarios.
- **Middleware:** aplica controles transversales, incluida autenticación, autorización y contexto del tenant.
- **Controller:** interpreta la solicitud HTTP, delega la operación y construye la respuesta.
- **Service:** aplica las reglas de negocio y coordina transacciones, concurrencia e idempotencia.
- **Prisma:** proporciona acceso persistente a PostgreSQL.

No todas las operaciones necesitan obligatoriamente una capa artificial para cada paso. La organización debe conservar responsabilidades claras sin introducir abstracciones vacías.

La validación de datos, autorización, aislamiento tenant y reglas de negocio se ejecutan en el backend. Los identificadores y valores enviados por el cliente no se consideran confiables hasta ser validados.

## Persistencia

La persistencia utilizará:

- PostgreSQL 17 como mínimo recomendado y PostgreSQL 18 como preferencia para instalaciones nuevas, sujeto al hosting;
- Prisma ORM;
- una base de datos y un esquema compartidos entre los negocios;
- UUID para los identificadores principales.

`Business` define el límite tenant dentro del esquema compartido. La estrategia de defensa combina:

- autenticación y autorización en el backend;
- consultas acotadas al negocio autorizado;
- validación de pertenencia en las reglas de dominio;
- claves foráneas compuestas tenant-scoped cuando corresponda.

Las FKs compuestas y sus claves candidatas aprobadas se documentan en el modelo relacional. En relaciones opcionales se complementan con `CHECK` de forma por la semántica `MATCH SIMPLE`. PostgreSQL es la fuente final de integridad referencial y Prisma representa las relaciones compatibles.

La compatibilidad de FKs compuestas opcionales y múltiples relaciones entre las mismas entidades se comprobará con la versión concreta de Prisma. Cuando Prisma no pueda representar una relación con seguridad, la FK se conservará mediante SQL personalizado dentro de la migración oficial y las migraciones posteriores deberán verificarse para que no la eliminen inadvertidamente.

Se utilizará una versión estable de Prisma compatible al comenzar la implementación y se verificará la versión exacta antes de instalar. Las tablas y columnas físicas utilizan `snake_case`; los modelos Prisma, `PascalCase`; y sus campos, `camelCase`, mediante `@map` y `@@map` cuando corresponda. `db push` no será el mecanismo de despliegue productivo.

El inventario de SQL complementario incluye índices únicos parciales; `CHECK` aritméticos, de forma y de longitud del hash idempotente; restricciones del trial histórico y protección de `trialEndsAt`; triggers append-only; privilegios PostgreSQL; y FKs compuestas que Prisma no represente correctamente. No se genera ese SQL en la fase documental.

No se permiten relaciones cruzadas entre negocios. Esto aplica al catálogo, ubicaciones, inventario, ventas, membresías, anulaciones, devoluciones, reembolsos y auditoría.

Los registros históricos no se eliminan mediante cascadas destructivas para representar correcciones o reversiones. Productos, variantes, ubicaciones y proveedores pueden retirarse del uso operativo sin borrar su historial; las membresías se revocan conservando sus referencias.

## Organización prevista del repositorio

El proyecto utilizará un monorepo sencillo:

```text
inventory-app/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   └── shared/
├── docs/
├── AGENTS.md
├── README.md
└── package.json
```

- `apps/web/` contendrá el frontend.
- `apps/api/` contendrá la API y la lógica del backend.
- `packages/shared/` contendrá elementos compartidos cuando exista una necesidad concreta.
- `docs/` conserva las decisiones del producto y la arquitectura.

Esta estructura está aprobada como organización prevista, pero su presencia en este documento no significa que las aplicaciones o paquetes ya estén implementados.

## Autenticación y autorización

La autenticación será administrada por un proveedor especializado externo todavía no seleccionado. Inventory App no almacenará contraseñas.

La identidad estable del usuario se relaciona mediante `issuer` y `externalSubject`. El correo es un dato opcional y no se utiliza por sí solo como identidad ni para vincular cuentas.

La pertenencia y autorización se representan mediante:

```text
User → BusinessMembership → Business
```

`BusinessMembership` contiene:

- rol `OWNER` o `EMPLOYEE`;
- estado `ACTIVE` o `REVOKED`.

Cada operación protegida debe validar en el backend la identidad, una membresía `ACTIVE`, el rol autorizado y el negocio correspondiente. Una membresía `REVOKED` pierde acceso aunque la sesión de autenticación continúe vigente.

Cada negocio debe conservar al menos un `OWNER ACTIVE`. La V1 no incluye permisos configurables ni un sistema RBAC adicional.

Los controles detallados se documentan en `security.md` y `roles.md`.

## Suscripciones y facturación SaaS

`Subscription` pertenece a `Business`, no a `User`. Un negocio conserva su historial de suscripciones, puede tener como máximo una abierta y puede consumir un único trial histórico.

Los estados aprobados son:

- `TRIALING`;
- `ACTIVE`;
- `ENDED`.

El trial dura exactamente 30 × 24 horas. Su vencimiento debe evaluarse temporalmente aunque un proceso programado todavía no haya materializado el cambio de estado.

El trial no tiene gracia ni genera cobros automáticos. `ACTIVE` representa una relación pagada abierta y utiliza `currentPeriodEndsAt` como límite superior exclusivo de la cobertura. Cada período pagado dura exactamente 30 × 24 horas.

`TRIAL_ACCESS`, `PAID_ACCESS`, `GRACE_PERIOD` y `SUSPENDED` son condiciones efectivas derivadas, no estados persistidos. La gracia solo sigue a cobertura pagada, dura exactamente 72 horas desde `currentPeriodEndsAt` y conserva la operación normal. Después, la política de suspensión aplica permisos diferenciados a `OWNER` y `EMPLOYEE`. El backend evalúa estas condiciones para cada operación protegida usando tiempo autoritativo; los jobs programados no determinan el acceso.

Las renovaciones requieren consentimiento y confirmación confiable. Antes del vencimiento o durante la gracia agregan 720 horas desde el límite de cobertura anterior; después de la suspensión agregan 720 horas desde la confirmación. Los cobros confirmados y los períodos cubiertos se conservan en `SubscriptionPayment`, separado de los pagos de ventas. La suspensión no elimina datos, historial ni membresías.

Los cambios de plan preservan el historial mediante períodos de suscripción distintos. Las reglas futuras de precios y cambios de plan permanecen pendientes.

`Payment` pertenece exclusivamente a las ventas registradas por el negocio. La facturación SaaS constituye un dominio independiente, utiliza `SubscriptionPayment` para cobros confirmados y no reutiliza esa entidad. El proveedor y el modelo de intentos no confirmados todavía no están seleccionados.

Las reglas completas se documentan en `subscriptions-and-billing.md`.

## Catálogo e inventario

`ProductVariant` es la unidad comercial e inventariable. Todo producto tiene al menos una variante; los productos simples utilizan una única variante sin atributos.

Cada variante referencia mediante UUID una unidad de un catálogo global controlado y define su granularidad decimal. La V1 no incorpora conversiones ni unidades secundarias.

Los atributos pertenecen a cada producto y sus variantes representan combinaciones completas y únicas. Los detalles funcionales se documentan en `product-variants.md`.

El stock actual corresponde siempre a una variante en una ubicación:

```text
ProductVariant + Location → InventoryBalance
```

`InventoryBalance` es el saldo materializado y `InventoryMovement` es el ledger histórico. Todo cambio de existencias genera un movimiento y ninguna operación puede producir stock negativo.

Las actualizaciones de saldo y sus movimientos deben ser atómicos. Los movimientos originales se conservan y las correcciones utilizan movimientos compensatorios. Las reglas completas se documentan en `inventory-rules.md`.

## Ventas y reversiones

Una venta contiene sus detalles y uno o más pagos completos. Registrar una venta debe persistir atómicamente:

- la venta y sus detalles;
- sus pagos;
- los movimientos de salida;
- las actualizaciones de inventario.

La V1 contempla:

- anulaciones completas;
- devoluciones parciales o totales;
- restitución diferenciada de mercancía vendible y no vendible;
- reembolsos básicos sin modificar los pagos originales.

Las ventas, anulaciones, devoluciones y reembolsos deben controlar concurrencia e idempotencia mediante registros tenant-scoped. Ajustes y stock inicial comparten esa protección. Los registros originales y movimientos históricos no se eliminan ni sobrescriben para representar una reversión.

Las relaciones y reglas detalladas se documentan en `conceptual-data-model.md` y `relational-data-model.md`.

## Convenciones transversales

### Dinero y cantidades

El dinero y las cantidades utilizan representaciones decimales exactas. No se utilizan `float` ni `number` de JavaScript para cálculos financieros críticos.

Las precisiones, escalas y política de redondeo aprobadas se documentan en `non-functional-requirements.md` y `relational-data-model.md`.

### Fechas y horas

- UTC es la referencia interna para persistencia y reglas temporales.
- `America/Lima` es la zona horaria de presentación de la V1.
- Se diferencia el momento efectivo de una operación del momento en que fue registrada.

### Operaciones críticas

Inventario, ventas, anulaciones, devoluciones y reembolsos requieren:

- transacciones atómicas;
- control de concurrencia;
- idempotencia tenant-scoped cuando corresponda;
- validación en backend;
- trazabilidad y conservación histórica.

La V1 utiliza `READ COMMITTED` como nivel base y combina restricciones únicas, actualizaciones condicionales atómicas, locks de filas, orden determinista y reintentos controlados. La persistencia de idempotencia ya forma parte del modelo relacional y conserva exclusivamente operaciones completadas, sin columna de estado.

El servicio serializa cada clave idempotente mediante un advisory transaction lock derivado de `businessId + scope + key`, adquirido antes de cualquier efecto comercial y mediante una consulta parametrizada en el mismo cliente transaccional de Prisma. Tras adquirirlo consulta siempre la clave completa; el lock no sustituye la restricción única. La derivación exacta del identificador y la canonicalización del hash permanecen pendientes para la preparación de la implementación.

La aplicación y las migraciones utilizan roles PostgreSQL separados. El rol de aplicación aplica mínimos privilegios y no es propietario de las tablas; el rol de migración conserva DDL controlado. `InventoryMovement` y `AuditLog` tienen protección append-only mediante privilegios y triggers para la operación ordinaria.

## Decisiones pendientes

- Proveedor de autenticación y detalles de integración.
- Proveedor de facturación SaaS, evento confiable de confirmación e integración externa.
- Modelo de intentos de cobro pendientes, fallidos, rechazados o revertidos.
- Tratamiento fiscal y snapshots definitivos de IGV.
- Límites y capacidades comerciales de los planes; `PlanFeature` queda fuera de la V1 implementable.
- Cancelación voluntaria, cierre como `ENDED`, reactivación posterior y conservación de datos a largo plazo.
- Administración interna de la plataforma y reglas futuras de precios o cambios de plan.
- Canonicalización exacta del hash idempotente, derivación del identificador del advisory lock y detalle de locking de los demás flujos.
- Catálogo inicial de unidades y valores predeterminados de granularidad.
- Métricas operativas e infraestructura de despliegue.

No deben inferirse mecanismos, garantías ni condiciones comerciales hasta que sean aprobados.

## Referencias

- [Modelo conceptual](conceptual-data-model.md)
- [Modelo relacional](relational-data-model.md)
- [Seguridad](security.md)
- [Requisitos no funcionales](non-functional-requirements.md)
- [Roles y membresías](roles.md)
- [Productos y variantes](product-variants.md)
- [Reglas de inventario](inventory-rules.md)
- [Suscripciones y facturación](subscriptions-and-billing.md)
