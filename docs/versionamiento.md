# Versionamiento — Backend NAS

Convenciones para versionar el código, publicar releases y aplicar cambios de base de datos de forma ordenada.

---

## 1. Esquema de versión

Se adopta **[Semantic Versioning 2.0.0](https://semver.org/lang/es/)** (`MAJOR.MINOR.PATCH`):

| Incremento | Cuándo |
|------------|--------|
| **MAJOR** | Cambios incompatibles en API, esquema SQL irreversible, migración de auth |
| **MINOR** | Funcionalidad nueva compatible hacia atrás (nuevo endpoint, rol, pantalla admin) |
| **PATCH** | Correcciones de bugs, ajustes de permisos, performance, documentación |

**Versión actual del paquete npm:** definida en `package.json`:

```json
"version": "1.0.0"
```

El frontend (`almacenamiento-frontend`) versiona de forma independiente en su propio `package.json`.

---

## 2. Fuentes de verdad

| Artefacto | Ubicación | Notas |
|-----------|-----------|-------|
| Versión backend | `backend/package.json` → `version` | Bump manual o con herramienta |
| Versión frontend | `frontend/package.json` → `version` | Puede diferir del backend |
| Historial Git | Rama principal / tags | Un tag por release estable |
| Esquema DB | `scripts/database/*.sql` | Numeración secuencial |
| Changelog | `docs/CHANGELOG.md` (recomendado) | Crear al publicar 1.1.0 |

---

## 3. Ramas Git (recomendado)

```
main          Producción estable, solo merges revisados
develop       Integración continua
feature/*     Nueva funcionalidad
fix/*         Corrección de bugs
release/x.y.z Preparación de release (bump version, changelog)
hotfix/x.y.z  Parche urgente sobre main
```

### Flujo de release

1. Congelar `develop` → crear `release/1.1.0`
2. Actualizar `package.json` → `"version": "1.1.0"`
3. Completar `CHANGELOG.md`
4. Merge a `main` + tag `v1.1.0`
5. Merge back a `develop`

```bash
git tag -a v1.1.0 -m "Release 1.1.0 — multi-rol BDJUNTOS, refresh token"
git push origin v1.1.0
```

---

## 4. Tags y nomenclatura

| Elemento | Formato | Ejemplo |
|----------|---------|---------|
| Tag Git | `vMAJOR.MINOR.PATCH` | `v1.0.0` |
| Script SQL | `NN.descripcion-corta.sql` | `13.seed-nastm-roles-intranet-cod.sql` |
| Migración runtime | `ensure*Column.ts` en `src/infrastructure/database/sqlserver/migrations/` | Idempotente al arrancar |

---

## 5. Versionado de base de datos

### 5.1 Scripts numerados

Carpeta: `backend/scripts/database/`

- Prefijo numérico indica **orden de aplicación**.
- Cada script debe ser **idempotente** cuando sea posible (`IF NOT EXISTS`, `MERGE`).
- No reutilizar números ya publicados en producción.
- El siguiente script nuevo debe usar el siguiente entero disponible (ej. `15.*.sql`).

### 5.2 Registro de migraciones aplicadas

Recomendación: tabla de control en DB_NAS (opcional, a implementar):

```sql
CREATE TABLE dbo.NASTM_DB_VERSION (
  NU_VERSION     INT NOT NULL PRIMARY KEY,
  DE_SCRIPT      NVARCHAR(200) NOT NULL,
  FE_APLICADO    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
```

Hasta que exista, llevar registro manual en hoja de despliegue o en `CHANGELOG.md`.

### 5.3 Migraciones automáticas al arrancar

El backend ejecuta helpers en `main.ts` que crean columnas faltantes.  
Estos cambios deben tener **script SQL equivalente** en `scripts/database/` para entornos donde el arranque automático no tenga permisos `ALTER`.

---

## 6. Compatibilidad API

### Política

- Rutas existentes no cambian método HTTP ni path sin bump **MAJOR**.
- Campos nuevos en JSON de respuesta son compatibles (clientes ignoran desconocidos).
- Campos nuevos obligatorios en request → preferir **MINOR** con default en backend.

### Deprecación

1. Marcar en documentación como `@deprecated`
2. Mantener al menos una versión **MINOR**
3. Eliminar en siguiente **MAJOR**

---

## 7. Changelog (formato recomendado)

Crear `docs/CHANGELOG.md` con [Keep a Changelog](https://keepachangelog.com/es/):

```markdown
# Changelog

## [1.1.0] - 2026-06-03
### Added
- Refresh token (`POST /api/auth/refresh`)
- Multi-rol BDJUNTOS con unión de categorías

### Changed
- SSO ConectaJuntos sin envío de contraseña

### Fixed
- Sesión expiraba sin renovación automática

## [1.0.0] - 2026-05-01
### Added
- Versión inicial producción
```

Categorías: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.

---

## 8. Matriz de compatibilidad (referencia)

| Backend | Frontend mínimo | Scripts SQL requeridos |
|---------|-----------------|------------------------|
| 1.0.x | 1.0.x | Hasta `13.seed-*` |
| 1.1.x | 1.0.x+ | Sin cambios de esquema obligatorios |

Actualizar esta tabla en cada release que rompa compatibilidad.

---

## 9. Entornos

| Entorno | Rama / tag | Base de datos |
|---------|------------|---------------|
| Desarrollo | `feature/*`, local | DB_NAS dev + BDJUNTOS lectura |
| Calidad | `develop` o `release/*` | `DB_NAS_COMPLETO_CALIDAD.sql` |
| Producción | `main` + tag `v*` | DB_NAS prod, BDJUNTOS readonly |

Nunca apuntar desarrollo contra producción sin autorización explícita.

---

## 10. Checklist antes de publicar versión

- [ ] `npm run type-check` sin errores críticos
- [ ] `npm run build` exitoso
- [ ] Scripts SQL nuevos documentados en [manual-despliegue.md](./manual-despliegue.md)
- [ ] `package.json` version bumped
- [ ] Entrada en CHANGELOG
- [ ] Tag Git creado
- [ ] Variables nuevas en `env.template`
- [ ] Prueba de login Intranet + refresh token
- [ ] Prueba multi-rol (2 unidades) si aplica

---

## 11. Historial de versiones documentadas

| Versión | Fecha | Hitos principales |
|---------|-------|-------------------|
| **1.0.0** | 2025–2026 | API archivos/carpetas, admin, Intranet BDJUNTOS, roles 1072–1080, matriz roles×categorías |
| **1.0.x** | 2026-06 | Refresh token, sync categorías BDJUNTOS, SSO sin password, optimización sesión |

> Próximo release sugerido: **1.1.0** al consolidar refresh token + multi-rol en producción.
