# 07 — Mejoras implementadas

Documento listo para pegar en informes de avance, actas de recepción o entregables de Producto 2/3.

---

## Resumen ejecutivo

El módulo **NAS (Almacenamiento)** evolucionó desde un prototipo con PostgreSQL hacia una solución integrada con **SQL Server (DB_NAS)**, arquitectura hexagonal, visibilidad por **categorías organizacionales** y panel de administración completo. Las mejoras siguientes están implementadas en el código actual del repositorio `nasback`.

---

## 1. Migración a SQL Server y modelo NAST*

| Mejora | Detalle |
|--------|---------|
| Motor de BD | SQL Server `DB_NAS` con tablas `NASTM_*` / `NASTD_*` |
| Convención institucional | Nomenclatura alineada a estándares Juntos (prefijos, fechas `FE_*`, códigos `CO_*`) |
| Scripts SQL | Carpeta `backend/scripts/` con esquema, limpieza y verificación de roles |
| Dual connection | Variables `MSSQL_NAS_*` y `MSSQL_USER_*` (BDJUNTOS lectura) |

**Beneficio:** alineación con infraestructura existente del Programa Juntos y base para SSO con ConectaJuntos.

---

## 2. Arquitectura hexagonal (Clean Architecture)

| Capa | Contenido |
|------|-----------|
| `domain` | Entidades y contratos de repositorio |
| `application` | Casos de uso desacoplados de Express/SQL |
| `infrastructure` | Adaptadores HTTP, SQL, disco, JWT |

**Beneficio:** mantenibilidad, pruebas unitarias futuras y sustitución de adaptadores sin tocar reglas de negocio.

---

## 3. Sistema de categorías y privacidad

| Funcionalidad | Descripción |
|---------------|-------------|
| `NASTM_CATEGORIAS` | Catálogo de áreas/UOP |
| `NASTD_USUARIO_CATEGORIAS` | Asignación usuario ↔ categoría |
| Visibilidad cruzada | Usuarios de la misma categoría ven carpetas/archivos del otro |
| `IN_ES_PRIVADO` | Usuario privado: solo enlaces públicos, sin visibilidad por categoría |
| Sync admin | Administrador recibe automáticamente todas las categorías |

**Beneficio:** control de acceso alineado a la estructura organizacional de Juntos.

---

## 4. Enlaces públicos con preview enriquecido

| Funcionalidad | Descripción |
|---------------|-------------|
| Tokens seguros | `CO_TOKEN` único en `NASTM_ENLACES` |
| Temporales | Expiración por fecha y/o máximo de visitas |
| Preview web | Imagen, video, PDF y audio inline en `/v/:token` |
| Revocación | Desactivar enlace desde panel de usuario |
| Content-Disposition | Inline vs attachment según tipo MIME |

**Beneficio:** compartir evidencias sin cuenta de usuario, con control de caducidad.

---

## 5. Almacenamiento temporal con promoción automática

| Funcionalidad | Descripción |
|---------------|-------------|
| Staging | Upload inicial en `backend/temp/` |
| Job cron | `CleanTemporaryFilesJob` cada minuto |
| Promoción | Mueve a `storage/AÑO/MES/DÍA/` y actualiza BD |
| Flag `IN_EN_TEMPORAL` | Trazabilidad del estado del archivo |

**Beneficio:** uploads rápidos al usuario y organización automática en disco permanente.

---

## 6. Panel de administración

| Módulo | Capacidades |
|--------|-------------|
| Usuarios | Alta, edición, baja lógica, cuotas, categorías |
| Roles | CRUD roles no sistema |
| Permisos | Matriz rol ↔ permiso |
| Categorías | Gestión y asignación masiva a admin |

Ruta frontend: `/admin` — API: `/api/admin/*`.

---

## 7. Seguridad y operación

| Mejora | Detalle |
|--------|---------|
| JWT + refresh | Sesiones con expiración configurable |
| bcrypt | Hash de contraseñas |
| Helmet + CORS | Endurecimiento HTTP |
| Soft delete | `FE_BAJA` en archivos/carpetas |
| Health checks | `/health`, `/api/auth/health` |
| Ramas Git | `desarrollo`, `calidad`, `produccion` |

---

## 8. Documentación y entregables

| Entregable | Ubicación |
|------------|-----------|
| Índice documental | `backend/document/README.md` |
| Descripción y alcance | `01-descripcion-del-sistema.md` |
| Arquitectura | `02-composicion-y-arquitectura.md` |
| Modelo de datos | `03-modelo-de-datos.md` |
| Flujos | `04-diagramas-de-flujo.md` |
| Wireframes | `05-prototipos-de-sistema.md` |
| Especificaciones | `06-especificaciones-tecnicas.md` |
| Scripts SQL | `backend/scripts/` |

---

## 9. Pendientes / roadmap (no bloqueantes)

| Ítem | Prioridad | Notas |
|------|-----------|-------|
| SSO unificado ConectaJuntos | Alta | Usar BDJUNTOS como fuente única de identidad |
| Auditoría completa | Media | Tabla de auditoría de acciones |
| Antivirus en upload | Media | Integración con motor institucional |
| API documentada OpenAPI | Media | Swagger / Redoc |
| Replicación storage | Baja | Según política de continuidad |

---

## 10. Texto sugerido para informe de avance

> Se completó la implementación del **Sistema de Almacenamiento NAS** para el Programa Juntos, incluyendo backend con arquitectura hexagonal sobre SQL Server (`DB_NAS`), frontend web React, gestión de usuarios/roles/categorías, enlaces públicos temporales con preview, y promoción automática de archivos desde almacenamiento temporal a permanente. Se entregó documentación técnica en `backend/document/` y scripts SQL en `backend/scripts/`, con ramas de despliegue `desarrollo`, `calidad` y `produccion`.

---

*Última actualización: junio 2026 — revisar al cerrar cada hito contractual.*
