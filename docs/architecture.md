# Arquitectura tecnológica

Este documento define las decisiones arquitectónicas aprobadas para la V1 de Inventory App. Su propósito es orientar la implementación futura sin ampliar el alcance funcional del producto.

Las decisiones indicadas como refinamientos reemplazan los puntos correspondientes de la documentación anterior. Los documentos originales se actualizarán posteriormente en una tarea separada para conservar la trazabilidad de los cambios.

## Decisiones aprobadas para la V1

### Plataforma

Inventory App será una aplicación web responsive preparada como Progressive Web App (PWA).

La V1 requerirá conexión a Internet para todas las operaciones de escritura, de acuerdo con `docs/non-functional-requirements.md`. El modo offline con almacenamiento local y sincronización automática no forma parte de esta versión.

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

#### Refinamiento de decisiones anteriores

Esta relación reemplaza la relación directa de un usuario con un único negocio descrita en `docs/conceptual-data-model.md`.

Los roles `OWNER` y `EMPLOYEE` se mantienen, pero los permisos adicionales configurables mencionados en `docs/roles.md` quedan fuera del alcance de la V1.

### Ubicaciones

Cada negocio tendrá al menos una `Location` predeterminada.

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

#### Refinamiento de decisiones anteriores

Esta decisión refina `docs/product-variants.md`: aunque `ProductVariant` continúa siendo la unidad sobre la que se controla el inventario, su stock actual deja de almacenarse directamente en la variante y pasa a representarse mediante `InventoryBalance` por ubicación.

También concreta las reglas de `docs/inventory-rules.md` al incorporar `Location`, el saldo materializado y la unicidad conceptual de cada saldo por variante y ubicación.

## Posibilidades de evolución futura

La arquitectura deberá permitir una evolución posterior hacia:

- múltiples sucursales;
- transferencias entre ubicaciones;
- permisos más granulares o un modelo de permisos/RBAC configurable, si existe una necesidad real;
- capacidades offline, incluido almacenamiento local y sincronización.

Estas posibilidades no forman parte de la implementación de la V1 y no deben interpretarse como requisitos actuales.

## Prevalencia de los refinamientos

Hasta que los documentos anteriores sean actualizados, las decisiones de este documento prevalecen exclusivamente en los siguientes puntos:

1. La relación multiempresa `User → BusinessMembership → Business` reemplaza la pertenencia directa de un usuario a un único negocio.
2. `InventoryBalance` por `ProductVariant + Location` reemplaza el almacenamiento de stock actual directamente en `ProductVariant`.
3. Los permisos adicionales configurables quedan fuera de la V1; únicamente se contemplan inicialmente los roles `OWNER` y `EMPLOYEE`.

El resto de la documentación existente conserva su alcance y vigencia.
