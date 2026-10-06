# Suscripciones y facturación SaaS

Este documento define las decisiones conceptuales aprobadas para los planes, las suscripciones y la facturación de Inventory App como SaaS comercial multiempresa. No diseña todavía tablas, contratos de integración ni detalles de un proveedor.

## Separación de dominios

Inventory App distingue dos dominios de pagos:

- **Ventas del negocio:** `Sale` representa una venta y `Payment` representa exclusivamente los pagos que el negocio registra por esa venta.
- **Facturación SaaS:** representa los cobros que Inventory App realiza al negocio por su suscripción.

El dominio de facturación SaaS no reutilizará `Payment` ni se mezclará con las ventas, reportes comerciales o medios de pago registrados por el negocio.

## Plan

`Plan` representa conceptualmente una oferta del SaaS y las capacidades o límites que puede habilitar para un negocio.

La arquitectura permitirá que un plan determine capacidades como la cantidad de ubicaciones habilitadas. Esto no modifica el modelo operativo: `Business 1:N Location` estará soportado desde la V1.

No están definidos todavía:

- los precios;
- la cantidad de ubicaciones del plan básico;
- la cantidad máxima de empleados;
- otros límites o capacidades comerciales.

## Subscription

`Subscription` representa conceptualmente el ciclo de suscripción de un `Business`. La suscripción pertenece al negocio y no directamente a un usuario.

`TRIALING` es un estado o concepto confirmado. Los demás estados y sus transiciones definitivas se decidirán al diseñar el dominio de billing y evaluar el proveedor externo.

## Trial

El trial inicial durará 30 días y se modelará alrededor del negocio. Crear o utilizar una nueva dirección de correo no dará automáticamente derecho a un nuevo trial.

El onboarding deberá seguir siendo sencillo. La V1 no aplicará por defecto bloqueos agresivos basados en nombre comercial, dirección IP, dispositivo u otros mecanismos similares.

El sistema conservará información suficiente para gestionar correctamente el ciclo de trial y suscripción. Una estrategia adicional de prevención de abuso solo se incorporará cuando exista una necesidad justificada; el mecanismo concreto de identidad empresarial, fiscal, teléfono, dispositivo u otros controles no ha sido decidido.

## Facturación SaaS

La facturación de suscripciones utilizará posteriormente un proveedor o pasarela externa todavía no seleccionada.

Inventory App no almacenará directamente datos sensibles de tarjetas. El backend no confiará únicamente en información enviada por el frontend para confirmar el estado de un pago de suscripción; utilizará mecanismos confiables proporcionados por el proveedor de pagos.

## Vencimiento y datos

El vencimiento del trial sin una suscripción activa, o la finalización posterior de una suscripción, afectará el derecho de uso conforme a la política de suscripción. No provocará por sí mismo la eliminación inmediata de `Business`, productos, inventario, ventas ni otros datos.

Continúan pendientes:

- la política de acceso restringido;
- el período de conservación;
- las condiciones de exportación;
- la eventual eliminación de datos.

## Decisiones comerciales pendientes

Además de las políticas anteriores, permanecen pendientes el precio definitivo, la duración contractual, los límites de cada plan y la selección del proveedor de facturación. No deben inferirse valores ni comportamientos hasta que sean aprobados.
