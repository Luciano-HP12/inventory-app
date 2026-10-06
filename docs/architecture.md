# Arquitectura tecnológica

Este documento define las decisiones arquitectónicas aprobadas para la V1 de Inventory App, un SaaS comercial multiempresa por suscripción. Su propósito es orientar la implementación futura sin ampliar el alcance funcional del producto.

## Decisiones aprobadas para la V1

### Plataforma

Inventory App será una aplicación web responsive preparada como Progressive Web App (PWA).

La V1 requerirá conexión a Internet para todas las operaciones de escritura, de acuerdo con `docs/non-functional-requirements.md`. El modo offline con almacenamiento local y sincronización automática no forma parte de esta versión.

### Autenticación

La autenticación será gestionada mediante un proveedor especializado externo que todavía no ha sido seleccionado. El proveedor deberá verificar que el usuario controla su dirección de correo; una validación meramente sintáctica del correo no será suficiente.

Inventory App conservará la información de dominio necesaria para relacionar al usuario autenticado con sus membresías, pero no implementará por cuenta propia el mecanismo de autenticación administrado por el proveedor.

### Tecnologías

- Frontend: React, TypeScript, Vite y Tailwind CSS.
- Backend: Node.js, TypeScript y Express.
- API: REST.
- Base de datos: PostgreSQL.
- ORM: Prisma.
- Identificadores principales: UUID.
- Valores monetarios: tipos decimales; no se utilizarán tipos `float` para representar dinero.

### Organización del repositorio

El proyecto utilizará un monorepo sencillo con una separación explícita entre las aplicaciones y el código compartido.

Estructura propuesta:

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

- `apps/web/` contendrá la aplicación frontend.
- `apps/api/` contendrá la API y la lógica del backend.
- `packages/shared/` podrá contener elementos compartidos entre aplicaciones cuando corresponda.
- `docs/` contendrá la documentación del proyecto.

Esta estructura es una referencia para la implementación posterior; este documento no crea todavía esas aplicaciones ni paquetes.

### Organización del backend

El backend se organizará de forma modular por dominio. Cuando corresponda, una solicitud seguirá el flujo:

```text
Route → Middleware → Controller → Service → Prisma
```

Las responsabilidades serán:

- **Route:** declarar el endpoint y conectar los componentes necesarios.
- **Middleware:** ejecutar validaciones o controles transversales antes del controlador, incluida la autenticación y autorización cuando corresponda.
- **Controller:** recibir la solicitud HTTP, delegar la operación y construir la respuesta HTTP.
- **Service:** aplicar las reglas de negocio y coordinar las operaciones del dominio.
- **Prisma:** acceder de forma persistente a PostgreSQL.

No todas las operaciones necesitan obligatoriamente cada capa; el flujo se aplicará cuando corresponda sin perder la separación de responsabilidades.

### Organización del frontend

El frontend se organizará por funcionalidades o *features*. Cada funcionalidad agrupará los elementos relacionados con su responsabilidad dentro de la interfaz, evitando una organización global basada únicamente en el tipo técnico de archivo.

### Multi-tenancy y aislamiento entre negocios

La aplicación utilizará una base de datos y un esquema compartidos. `Business` será el tenant del sistema.

La autorización y el aislamiento entre negocios deberán validarse siempre en el backend. El backend no confiará únicamente en un `businessId` enviado por el cliente para determinar a qué información puede acceder un usuario o qué operaciones puede realizar.

La relación entre usuarios y negocios se representará mediante:

```text
User → BusinessMembership → Business
```

Un usuario podrá pertenecer a varios negocios. El rol del usuario dentro de un negocio pertenecerá a la membresía correspondiente, no directamente al usuario.

Los roles iniciales serán:

- `OWNER`
- `EMPLOYEE`

La V1 no incluirá permisos adicionales configurables ni un sistema RBAC configurable.

### Suscripciones y planes

La suscripción del SaaS estará asociada a `Business`, no directamente a `User`. El dominio contemplará conceptualmente `Plan` y `Subscription`.

El trial inicial durará 30 días y `TRIALING` será un estado o concepto confirmado del ciclo de suscripción. Los demás estados y transiciones se definirán cuando se diseñe el dominio de billing y se evalúe el proveedor correspondiente.

Una nueva dirección de correo no otorgará conceptualmente un nuevo trial de forma automática. El ciclo de trial y suscripción se gestionará alrededor del negocio y deberá conservarse la información necesaria para administrarlo correctamente.

Los planes podrán definir capacidades o límites, incluida la cantidad de ubicaciones habilitadas. Todavía no se han definido precios, cantidad máxima de empleados, cantidad de ubicaciones del plan básico ni otros límites comerciales.

Las decisiones del dominio se detallan en `docs/subscriptions-and-billing.md`.

### Ubicaciones

Cada negocio tendrá al menos una `Location` predeterminada.

La arquitectura y el modelo soportarán la relación `Business 1:N Location` desde la V1. La cantidad de ubicaciones que un negocio pueda utilizar podrá depender posteriormente de su `Plan`; este control comercial no cambia la capacidad del modelo para representar múltiples ubicaciones.

Inicialmente, una ubicación podrá representar:

- `STORE`: tienda.
- `WAREHOUSE`: almacén.

Las ventas estarán asociadas a una ubicación.

### Inventario

`ProductVariant` continuará siendo la unidad inventariable. Sin embargo, el stock no pertenecerá directamente a `Product` ni se almacenará directamente en `ProductVariant`.

`InventoryBalance` representará el saldo actual para una combinación de variante y ubicación:

```text
ProductVariant + Location → InventoryBalance
```

Deberá existir unicidad conceptual entre `locationId` y `productVariantId`, de modo que haya un único saldo actual para cada combinación de ubicación y variante.

`InventoryMovement` proporcionará la trazabilidad de los cambios de stock. El inventario seguirá una estrategia de:

```text
Saldo materializado + libro de movimientos
```

El saldo materializado permitirá consultar las existencias actuales mediante `InventoryBalance`, mientras que el libro de movimientos conservará el historial mediante `InventoryMovement`.

Los cambios de inventario que formen parte de operaciones críticas deberán mantener consistencia transaccional. Esto incluye mantener coherentes el saldo actual y los movimientos generados por una misma operación.

### Facturación del SaaS

Los pagos que un negocio registra por sus ventas pertenecen al dominio de ventas y se representan mediante `Payment`. La facturación y los pagos que el negocio realiza a Inventory App por su suscripción constituyen un dominio independiente y no reutilizarán `Payment`.

La facturación del SaaS utilizará posteriormente un proveedor o pasarela externa todavía no seleccionada. Inventory App no almacenará directamente datos sensibles de tarjetas.

El backend no confiará únicamente en datos enviados por el frontend para confirmar el estado de un pago de suscripción. La confirmación deberá basarse en mecanismos confiables ofrecidos por el proveedor de pagos.

### Ciclo de vida de los datos

El vencimiento del trial o de una suscripción afectará el derecho de uso según la política de suscripción, pero no eliminará inmediatamente `Business`, productos, inventario, ventas ni otros datos del negocio.

La política definitiva de acceso restringido, conservación, exportación y eventual eliminación continúa pendiente y no se define en esta etapa.

### Requisitos transversales

La seguridad, el aislamiento multi-tenant, la integridad del inventario, la auditoría y la mantenibilidad son requisitos del producto desde el diseño. Los principios de seguridad se detallan en `docs/security.md`.

## Posibilidades de evolución futura

La V1 contempla conceptualmente planes, suscripciones y el trial. La arquitectura deberá permitir una evolución posterior hacia:

- transferencias entre ubicaciones;
- planes superiores concretos que habiliten el uso de más ubicaciones u otras capacidades, junto con límites y configuraciones comerciales todavía no definidos, sin alterar el aislamiento del tenant;
- permisos más granulares o un modelo de permisos/RBAC configurable, si existe una necesidad real;
- capacidades offline, incluido almacenamiento local y sincronización.

Estas extensiones concretas no forman parte de la implementación de la V1 y no deben interpretarse como requisitos actuales. Esta condición no excluye de la V1 los conceptos de `Plan`, `Subscription`, trial de 30 días y estado `TRIALING` definidos en este documento.
