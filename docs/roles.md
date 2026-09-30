# Roles del sistema

Inventory App contará inicialmente con dos roles principales: Dueño y Empleado.

## Dueño

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

## Empleado

El empleado estará orientado principalmente a las operaciones diarias y podrá:

- Iniciar y cerrar sesión.
- Consultar productos.
- Consultar stock disponible.
- Buscar productos mediante código de barras.
- Registrar ventas.
- Seleccionar métodos de pago.
- Generar e imprimir tickets.
- Consultar información permitida según sus permisos.

## Control de acceso

Los permisos deberán ser validados por el backend y no depender únicamente de la interfaz de usuario.

Los empleados podrán contar con permisos adicionales configurados por el dueño para determinadas operaciones.