# Roles y membresías

Inventory App contará en la V1 únicamente con dos roles: Dueño (`OWNER`) y Empleado (`EMPLOYEE`). No se incorpora un sistema RBAC configurable ni permisos personalizados.

## BusinessMembership

El rol pertenece a `BusinessMembership`, la membresía que relaciona un `User` con un `Business`. Un usuario puede pertenecer a varios negocios y desempeñar un rol diferente en cada uno.

Cada membresía tiene uno de estos estados:

- `ACTIVE`: permite acceder al negocio conforme al rol.
- `REVOKED`: ya no permite acceder al negocio.

Una sesión autenticada identifica al usuario, pero no sustituye la autorización. Si su membresía fue revocada, el usuario pierde inmediatamente el acceso al negocio aunque conserve una sesión válida con el proveedor de autenticación.

La revocación no elimina la membresía ni las ventas, movimientos, anulaciones, devoluciones, reembolsos, auditorías u otras operaciones históricas realizadas bajo ella.

Cada negocio debe conservar al menos una membresía `ACTIVE` con rol `OWNER`. No puede revocarse ni degradarse al último propietario activo dejando al negocio sin administración.

## Dueño (`OWNER`)

El dueño tiene acceso administrativo al negocio y puede:

- gestionar empleados;
- gestionar productos y variantes;
- gestionar categorías;
- gestionar proveedores;
- consultar costos y precios;
- registrar entradas de inventario;
- realizar ajustes de stock;
- registrar ventas;
- anular ventas;
- registrar devoluciones;
- registrar reembolsos;
- consultar movimientos de inventario;
- consultar reportes;
- visualizar información general del negocio.

Las anulaciones, devoluciones y reembolsos son operaciones sensibles reservadas a `OWNER` en la V1.

## Empleado (`EMPLOYEE`)

El empleado está orientado principalmente a las operaciones diarias y puede:

- iniciar y cerrar sesión;
- consultar productos;
- consultar stock disponible;
- buscar productos mediante código de barras;
- registrar ventas;
- seleccionar métodos de pago;
- generar e imprimir tickets;
- consultar la información permitida para su rol.

En la V1, `EMPLOYEE` no puede anular ventas, registrar devoluciones ni registrar reembolsos.

## Control de acceso y aislamiento

Los permisos deben validarse en el backend para cada operación y no depender únicamente de la interfaz de usuario.

La autorización debe comprobar:

- la identidad autenticada;
- la existencia de la membresía correspondiente;
- que la membresía esté `ACTIVE`;
- el rol de esa membresía;
- que la operación y los datos pertenezcan al mismo `Business`.

Un `businessId` recibido del cliente no concede acceso por sí solo.

## Decisiones pendientes

- Flujo de invitación a un negocio.
- Flujo y condiciones de reactivación de una membresía `REVOKED`.
- Experiencia de usuario para cambios de rol y revocaciones.

No se define una matriz granular adicional. Cualquier evolución futura hacia más roles, permisos configurables o RBAC requerirá una decisión explícita.
