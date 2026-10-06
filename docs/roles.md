# Roles del sistema

Inventory App contará inicialmente con dos roles: Dueño (`OWNER`) y Empleado (`EMPLOYEE`).

El rol pertenecerá a `BusinessMembership`, la membresía que relaciona un usuario con un negocio. Por ello, un mismo usuario podrá pertenecer a varios negocios y tener un rol diferente en cada uno.

## Dueño (`OWNER`)

El dueño tendrá acceso administrativo al negocio y podrá:

- Gestionar empleados.
- Gestionar productos y variantes.
- Gestionar categorías.
- Gestionar proveedores.
- Consultar costos y precios.
- Registrar entradas de inventario.
- Realizar ajustes de stock.
- Registrar ventas.
- Anular ventas.
- Consultar movimientos de inventario.
- Consultar reportes.
- Visualizar información general del negocio.

## Empleado (`EMPLOYEE`)

El empleado estará orientado principalmente a las operaciones diarias y podrá:

- Iniciar y cerrar sesión.
- Consultar productos.
- Consultar stock disponible.
- Buscar productos mediante código de barras.
- Registrar ventas.
- Seleccionar métodos de pago.
- Generar e imprimir tickets.
- Consultar la información permitida para su rol.

## Control de acceso

Los permisos deberán ser validados por el backend y no depender únicamente de la interfaz de usuario.

La V1 no incluirá permisos adicionales configurables ni un sistema RBAC configurable. Los permisos más granulares o un modelo RBAC podrán evaluarse como una evolución futura si existe una necesidad real, pero no constituyen un requisito actual.
