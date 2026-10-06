# Seguridad

Este documento reúne los principios de seguridad aprobados para Inventory App. Estos principios se aplican desde el diseño del producto y deberán concretarse durante la implementación sin seleccionar todavía proveedores ni mecanismos no aprobados.

## Autenticación gestionada

La autenticación será gestionada mediante un proveedor especializado externo todavía no seleccionado.

Los usuarios deberán utilizar cuentas con correo electrónico verificado. No bastará con validar el formato de la dirección: el proveedor de autenticación deberá confirmar que el usuario controla ese correo.

## Autorización y aislamiento multi-tenant

`Business` es el tenant operativo. La relación `User → BusinessMembership → Business` determinará a qué negocios pertenece un usuario y qué rol desempeña en cada uno.

La autorización y el aislamiento entre negocios deberán validarse en el backend. El sistema nunca confiará únicamente en un `businessId` enviado por el frontend para conceder acceso a datos u operaciones.

Las comprobaciones de acceso deberán respetar la membresía y el contexto del negocio en cada operación protegida.

## Integridad y auditoría

La integridad del inventario es un requisito de seguridad del producto. Las operaciones críticas deberán conservar la consistencia transaccional entre el saldo materializado y el libro de movimientos.

Las operaciones que requieran trazabilidad deberán poder generar registros de auditoría. El alcance detallado de los eventos auditados se definirá durante el diseño de cada dominio.

## Información sensible y pagos

Inventory App no almacenará directamente datos sensibles de tarjetas. La facturación SaaS será procesada posteriormente mediante un proveedor externo todavía no seleccionado.

El backend no confiará únicamente en información enviada por el frontend para confirmar pagos de suscripción. El estado deberá confirmarse mediante mecanismos confiables proporcionados por el proveedor de pagos.

Las credenciales, secretos y datos sensibles no deberán exponerse en el código, registros, documentación ni respuestas al cliente.

## Prevención gradual de abuso

El onboarding deberá priorizar una experiencia sencilla y evitar requisitos o verificaciones innecesariamente restrictivos.

Una nueva dirección de correo no otorgará automáticamente derecho a un nuevo trial. Aun así, la V1 no aplicará por defecto bloqueos agresivos basados en nombre comercial, dirección IP, dispositivo u otros mecanismos similares.

El nombre comercial de `Business` no será globalmente único y no se utilizará por sí solo para impedir duplicados.

El sistema conservará información que permita gestionar correctamente el ciclo de trial y suscripción. Los mecanismos antifraude adicionales se incorporarán únicamente cuando exista una necesidad justificada. No se ha decidido un mecanismo definitivo basado en identidad empresarial o fiscal, teléfono, dispositivo u otros controles.

## Mantenibilidad

La seguridad deberá implementarse mediante responsabilidades claras y controles reutilizables en el backend. Las decisiones deberán mantenerse documentadas y ser verificables, evitando reglas críticas dispersas únicamente en la interfaz de usuario.
