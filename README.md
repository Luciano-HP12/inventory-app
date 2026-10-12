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
- checkout manual para renovar mediante Yape, Plin o tarjetas, sin cobros recurrentes automáticos;
- conciliación de pagos y administración interna mediante componentes separados de la aplicación comercial;
- preparación arquitectónica para PWA, sin sincronización offline automática en V1.

El precio previsto de `Esencial` es S/ 99.90 por cada período fijo de 30 × 24 horas, con impuestos incluidos cuando corresponda. No se utilizan meses calendario. Los estados físicos de suscripción continúan siendo `TRIALING`, `ACTIVE` y `ENDED`; la gracia y la suspensión se derivan en el backend según el tiempo real. Culqi es únicamente la primera candidata para pruebas sandbox: la integración utilizará un adaptador independiente del proveedor. Los límites comerciales, el tratamiento fiscal definitivo y la política de conservación a largo plazo todavía no están definidos.

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
│   ├── admin/
│   ├── api/
│   └── worker/
├── packages/
│   └── shared/
└── docs/
```

- `apps/web`: aplicación frontend.
- `apps/admin`: aplicación interna de administración de plataforma, separada de los roles comerciales.
- `apps/api`: API y reglas de negocio.
- `apps/worker`: proceso independiente para conciliación y tareas automáticas, coordinado inicialmente mediante PostgreSQL.
- `packages/shared`: código compartido cuando exista una necesidad concreta.
- `docs`: decisiones funcionales, arquitectónicas y de datos.

La estructura base `apps/` y `packages/` ya está preparada. Las aplicaciones y paquetes todavía no se han generado.

## Estado actual

El proyecto ha iniciado la preparación técnica del monorepo después de consolidar su diseño documental.

Actualmente están documentados la arquitectura, los modelos conceptual y relacional, y las reglas principales de seguridad, suscripciones, roles, variantes, inventario, ventas, pagos SaaS y operación de plataforma. Existen aplicaciones base ejecutables para web, administración, API y worker, todavía sin lógica comercial. No existen un esquema Prisma, migraciones de base de datos, integración de pagos ni un despliegue.

## Desarrollo

El monorepo requiere Node.js 24 LTS (`>=24 <25`). Si utilizas `nvm`, desde la raíz del repositorio puedes seleccionar la versión declarada en `.nvmrc`:

```bash
nvm use
```

Instala las dependencias y ejecuta las verificaciones locales desde la raíz:

```bash
npm ci
npm run check
npm run build
```

`npm run check` ejecuta la comprobación de TypeScript, ESLint, Prettier y las pruebas disponibles.

GitHub Actions ejecuta automáticamente `npm ci`, `npm run check` y `npm run build` en cada `push` a `main` y en cada Pull Request dirigido a `main`. Este pipeline solo verifica calidad, pruebas y compilación; no despliega aplicaciones ni ejecuta migraciones.

### Variables de entorno

La API admite `NODE_ENV` con `development`, `test` o `production`, y `PORT` como puerto TCP entre 1 y 65535. `NODE_ENV` es obligatorio y `PORT` utiliza `3000` de forma predeterminada. El worker solo admite y requiere `NODE_ENV`.

Los ejemplos seguros se encuentran en `apps/api/.env.example` y `apps/worker/.env.example`. Para desarrollo, copia el ejemplo correspondiente como `.env` dentro del mismo workspace antes de iniciar el proceso. Los scripts Node cargan ese archivo cuando existe; los archivos `.env` reales están excluidos de Git.

Vite expone en el navegador cualquier variable personalizada cuyo nombre comience por `VITE_`. Por ello, esas variables son públicas y nunca deben contener contraseñas, tokens, claves ni otros secretos. Web y admin no utilizan todavía variables públicas personalizadas; cualquier variable futura deberá declararse por separado en el archivo `vite-env.d.ts` de la aplicación que la consuma.

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
