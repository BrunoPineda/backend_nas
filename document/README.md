# Documentación técnica — Sistema de Almacenamiento NAS

Documentación del backend y del ecosistema **PJ_Almacenamiento** (Programa Juntos), lista para entregables contractuales, revisiones técnicas y onboarding del equipo.

---

## Índice

| # | Documento | Contenido |
|---|-----------|-----------|
| 01 | [01-descripcion-del-sistema.md](./01-descripcion-del-sistema.md) | Qué es el sistema, objetivos, usuarios y alcance |
| 02 | [02-composicion-y-arquitectura.md](./02-composicion-y-arquitectura.md) | Web + backend + SQL Server + integraciones (con diagramas) |
| 03 | [03-modelo-de-datos.md](./03-modelo-de-datos.md) | Tablas principales, relaciones y diagrama ER |
| 04 | [04-diagramas-de-flujo.md](./04-diagramas-de-flujo.md) | Flujos: login, subida, enlaces públicos, administración |
| 05 | [05-prototipos-de-sistema.md](./05-prototipos-de-sistema.md) | Wireframes ASCII y mapa de pantallas |
| 06 | [06-especificaciones-tecnicas.md](./06-especificaciones-tecnicas.md) | Stack, permisos, API, infraestructura y pruebas |
| 07 | [07-mejoras-implementadas.md](./07-mejoras-implementadas.md) | Mejoras recientes listas para informe de avance |

**Scripts SQL de referencia:** `../scripts/` (`database.sql`, `database-clean.sql`, `VERIFICAR_ROLES_PERMISOS.sql`).

---

## Cómo usar esta documentación en el contrato

### Producto 1 — Desarrollo e instalación base

Entregar como paquete de **diseño y construcción inicial**:

1. **01-descripcion-del-sistema.md** — Contexto, objetivos y alcance funcional acordado.
2. **02-composicion-y-arquitectura.md** — Diagrama de componentes y capas del backend.
3. **05-prototipos-de-sistema.md** — Pantallas acordadas (wireframes ASCII).
4. **06-especificaciones-tecnicas.md** — Stack, variables de entorno y endpoints base.

> Evidencia sugerida: capturas del login, dashboard y subida de archivos en ambiente **desarrollo**.

### Producto 2 — Calidad, integración y validación

Entregar como paquete de **pruebas e integración**:

1. **03-modelo-de-datos.md** — Esquema `DB_NAS` y relaciones validadas.
2. **04-diagramas-de-flujo.md** — Flujos críticos (auth, upload, enlaces, permisos).
3. **06-especificaciones-tecnicas.md** — Sección *Criterios de prueba* y matriz de permisos.
4. **07-mejoras-implementadas.md** — Ajustes incorporados tras revisión de calidad.

> Evidencia sugerida: acta de pruebas en ambiente **calidad**, ejecución de scripts en `../scripts/` y checklist de roles/permisos.

### Producto 3 — Producción y operación

Entregar como paquete de **puesta en marcha y operación**:

1. **02-composicion-y-arquitectura.md** — Topología de producción (servidor, BD, almacenamiento).
2. **06-especificaciones-tecnicas.md** — Infraestructura, seguridad, respaldos y monitoreo.
3. **07-mejoras-implementadas.md** — Mejoras finales antes del go-live.
4. **04-diagramas-de-flujo.md** — Flujos operativos (limpieza temporal, enlaces expirados).

> Evidencia sugerida: despliegue en rama **produccion**, health check `/health` y manual de operación resumido.

---

## Ramas Git recomendadas

| Rama | Uso |
|------|-----|
| `desarrollo` | Integración continua del equipo |
| `calidad` | Validación UAT / QA |
| `produccion` | Versión estable desplegada |
| `master` | Línea principal de referencia |

---

## Mantenimiento del paquete documental

- Actualizar **07-mejoras-implementadas.md** en cada hito o sprint.
- Si cambia el modelo, sincronizar **03-modelo-de-datos.md** y los scripts en `../scripts/`.
- Si se agregan endpoints, actualizar **06-especificaciones-tecnicas.md**.
