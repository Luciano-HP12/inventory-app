# Requisitos no funcionales

## Seguridad y aislamiento multi-tenant

La seguridad, el aislamiento multi-tenant, la integridad del inventario, la auditoría y la mantenibilidad son requisitos del producto desde el diseño.

`Business` es el tenant operativo. Toda autorización y acceso a datos de un negocio deberá validarse en el backend a partir de una membresía válida; nunca deberá confiarse únicamente en un `businessId` enviado por el cliente.

La autenticación será gestionada mediante un proveedor externo todavía no seleccionado. El usuario deberá demostrar que controla su dirección de correo mediante el mecanismo de verificación del proveedor.

Los cambios críticos de inventario deberán preservar la consistencia entre saldos y movimientos. Las operaciones que requieran trazabilidad deberán poder auditarse.

## Protección de información de pagos

La facturación del SaaS utilizará un proveedor externo todavía no seleccionado. Inventory App no almacenará directamente datos sensibles de tarjetas.

El backend no considerará confirmado un pago de suscripción basándose únicamente en información enviada por el frontend. La confirmación deberá proceder de mecanismos confiables del proveedor de pagos.

Los pagos de ventas registrados por un negocio y la facturación de suscripciones de Inventory App deberán mantenerse como dominios separados.

## Onboarding, trial y prevención de abuso

El onboarding priorizará una experiencia sencilla y evitará verificaciones innecesariamente restrictivas.

El trial inicial será de 30 días y se gestionará alrededor del negocio. Una nueva dirección de correo no implicará automáticamente el derecho a un nuevo trial.

La V1 no aplicará por defecto bloqueos agresivos basados en el nombre comercial, la dirección IP, el dispositivo u otros mecanismos similares. El sistema conservará la información necesaria para gestionar el ciclo de trial y suscripción; otros controles antifraude solo se incorporarán cuando exista una necesidad justificada.

El nombre comercial de un negocio no se utilizará como identificador globalmente único.

## Ciclo de vida de los datos

El vencimiento del trial o de una suscripción no eliminará inmediatamente los datos del negocio.

La política definitiva de acceso restringido, conservación, exportación y eventual eliminación después del vencimiento o cancelación sigue pendiente.

## Conectividad y contingencia

La V1 requerirá conexión a Internet para realizar operaciones que modifiquen información.

Si un dispositivo pierde la conexión, otros dispositivos del negocio que mantengan acceso a Internet podrán continuar operando normalmente.

Ante una pérdida total de conectividad, el negocio podrá utilizar temporalmente un registro manual de sus ventas. Una vez restablecida la conexión, estas ventas podrán registrarse posteriormente en el sistema para actualizar correctamente las ventas, pagos, movimientos de inventario y existencias.

Las ventas realizadas durante una interrupción de conectividad no deberán regularizarse únicamente mediante ajustes manuales de stock, ya que esto impediría conservar correctamente la información comercial y la trazabilidad de la operación.

Los ajustes manuales de inventario se reservarán para diferencias físicas reales, como pérdidas, productos dañados o errores de conteo.

El modo offline con almacenamiento local y sincronización automática queda fuera del alcance de la V1 y se considera una mejora futura.

## Mejoras futuras

- Modo offline con almacenamiento local.
- Sincronización automática al recuperar la conexión.
- Consulta local de productos, precios y último stock conocido.
- Gestión de conflictos de sincronización.
- Fidelización de clientes.
- Promociones y reglas comerciales avanzadas.
