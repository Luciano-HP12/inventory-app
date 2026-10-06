# Instrucciones para Codex

## Contexto

Este repositorio contiene un SaaS comercial por suscripción
para la gestión de inventarios y ventas, multiplataforma y
multiempresa.

El proyecto se desarrolla de forma incremental,
priorizando seguridad, mantenibilidad y aprendizaje.

`Business` es el tenant operativo. El aislamiento entre
negocios, la integridad del inventario y la separación entre
pagos de ventas y facturación del SaaS deben preservarse en
todas las decisiones técnicas.

## Reglas de trabajo

1. Antes de implementar, analizar la estructura existente.

2. Respetar las decisiones documentadas en docs/.

3. No modificar archivos fuera del alcance solicitado.

4. No instalar dependencias sin justificar su necesidad.

5. No modificar el esquema de base de datos sin explicar
   las consecuencias.

6. No ejecutar comandos destructivos.

7. No realizar commits ni push automáticamente.

8. No exponer credenciales ni variables sensibles.

9. Priorizar código legible, modular y mantenible.

10. No implementar funcionalidades adicionales
    sin autorización.

## Aprendizaje

El desarrollador está aprendiendo ingeniería de software.

Por ello, después de cada implementación:

- Indicar los archivos creados o modificados.
- Explicar la responsabilidad de cada archivo.
- Explicar cómo se conectan los componentes.
- Indicar los comandos necesarios para ejecutar y probar.
- Especificar desde qué carpeta ejecutar cada comando.
- Informar los resultados de las pruebas realizadas.
- Explicar las decisiones técnicas relevantes.

## Calidad

- Aplicar separación de responsabilidades.
- Validar los datos en el backend.
- Mantener aislamiento entre negocios.
- Proteger la integridad del inventario.
- Evitar cambios innecesarios.
- Agregar pruebas cuando corresponda.

## Flujo de trabajo

1. Analizar.
2. Proponer.
3. Solicitar aprobación para cambios importantes.
4. Implementar.
5. Ejecutar pruebas.
6. Explicar resultados.
7. Esperar autorización para commit.
