# Inventory App

Inventory App es un proyecto de SaaS comercial multiempresa para gestionar catálogo, inventario y ventas de pequeños negocios desde una aplicación web responsive.

## Problema que busca resolver

Muchos negocios necesitan conocer qué productos y variantes tienen disponibles en cada ubicación, registrar ventas con trazabilidad y conservar un historial confiable de cambios de stock.

Inventory App plantea una solución centralizada que separa el catálogo general de sus variantes, controla existencias por ubicación y mantiene coherencia entre ventas, pagos y movimientos de inventario.

## Enfoque SaaS multiempresa

Cada `Business` representa un tenant operativo. Un usuario puede pertenecer a varios negocios mediante membresías con rol y estado propios.

La autorización se valida en el backend y todos los datos operativos deben permanecer aislados por negocio. Las suscripciones también pertenecen a `Business`, no directamente a los usuarios.

## Alcance diseñado para la V1

La documentación actual contempla:

- roles `OWNER` y `EMPLOYEE` con membresías activas o revocadas;
- múltiples negocios y múltiples ubicaciones por negocio;
- categorías, productos, variantes y atributos configurables;
- productos simples y productos con combinaciones de atributos;
- SKU y códigos de barras opcionales;
- proveedores como catálogo básico;
- inventario por variante y ubicación;
- saldos actuales e historial de movimientos;
- registro de ventas con uno o más pagos;
- anulaciones, devoluciones parciales o totales y reembolsos básicos;
- impresión de tickets, dashboard y reportes como parte del alcance funcional previsto;
- membresías por negocio y suscripción SaaS al plan inicial `Esencial`;
- prueba gratuita única de 30 × 24 horas, sin cobro automático ni período de gracia;
- períodos pagados de 30 × 24 horas, renovaciones consentidas y 72 horas de gracia exclusivamente después de su vencimiento;
- suspensión con acceso de lectura y exportación para `OWNER`, sin eliminación automática de datos;
- preparación arquitectónica para PWA, sin sincronización offline automática en V1.

El precio anunciado de `Esencial` es S/ 99.90 por cada período fijo de 30 × 24 horas, con IGV incluido cuando corresponda. No se utilizan meses calendario. Los estados físicos de suscripción continúan siendo `TRIALING`, `ACTIVE` y `ENDED`; la gracia y la suspensión se derivan en el backend según el tiempo real. La pasarela de pagos, los límites comerciales, el tratamiento fiscal definitivo y la política de conservación a largo plazo todavía no están definidos.

## Roadmap comercial

- **V1:** lanzamiento con un único plan `Esencial` y las capacidades funcionales documentadas para inventario y ventas.
- **Evaluación inicial:** observación del uso y feedback de clientes reales durante aproximadamente tres meses.
- **Versiones posteriores:** definición de planes superiores y capacidades configurables a partir de evidencia real, sin comprometer anticipadamente precios ni características.

La seguridad, integridad, aislamiento multiempresa y respaldos son requisitos comunes a todos los planes y no se degradan como características comerciales opcionales.

## Stack aprobado

- **Frontend:** React, TypeScript, Vite y Tailwind CSS.
- **Backend:** Node.js, TypeScript, Express y API REST.
- **Persistencia:** PostgreSQL y Prisma ORM.
- **Arquitectura:** monorepo, backend modular y base de datos compartida con aislamiento tenant-scoped.

## Estructura prevista

```text
inventory-app/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   └── shared/
└── docs/
```

- `apps/web`: aplicación frontend.
- `apps/api`: API y reglas de negocio.
- `packages/shared`: código compartido cuando exista una necesidad concreta.
- `docs`: decisiones funcionales, arquitectónicas y de datos.

Esta es la estructura aprobada para la implementación futura; todavía no se encuentra creada en el repositorio.

## Estado actual

El proyecto se encuentra en fase de diseño y consolidación documental.

Actualmente están documentados la arquitectura, los modelos conceptual y relacional, y las reglas principales de seguridad, suscripciones, roles, variantes, inventario y ventas. Todavía no existen una aplicación frontend funcional, una API operativa, un esquema Prisma, migraciones de base de datos ni un despliegue.

Por ese motivo, aún no hay instrucciones de instalación o ejecución de aplicaciones.

## Documentación

- [Arquitectura](docs/architecture.md)
- [Modelo conceptual](docs/conceptual-data-model.md)
- [Modelo relacional](docs/relational-data-model.md)
- [Seguridad](docs/security.md)
- [Requisitos no funcionales](docs/non-functional-requirements.md)
- [Roles y membresías](docs/roles.md)
- [Productos y variantes](docs/product-variants.md)
- [Reglas de inventario](docs/inventory-rules.md)
- [Suscripciones y facturación](docs/subscriptions-and-billing.md)

## Principios del proyecto

- seguridad y aislamiento multiempresa desde el diseño;
- integridad transaccional del inventario y las ventas;
- conservación de trazabilidad e historial;
- separación entre pagos comerciales y facturación SaaS;
- implementación incremental, mantenible y orientada al aprendizaje.
