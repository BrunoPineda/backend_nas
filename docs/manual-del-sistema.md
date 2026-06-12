# Manual del sistema — Backend NAS

Sistema de almacenamiento de archivos institucional (**ConectaJuntos / NAS**).  
Stack: **Node.js + Express + TypeScript**, **SQL Server**, almacenamiento en disco/NAS.

---

## 1. Propósito

El backend expone una API REST para:

- Autenticación (Intranet / ConectaJuntos o usuarios locales)
- Gestión de archivos y carpetas por unidad organizacional
- Enlaces públicos temporales de descarga
- Administración de usuarios, roles, permisos y categorías
- Cuotas de almacenamiento y políticas de subida
- Auditoría y vigencia de archivos

El frontend (`PJ_Almacenamiento/frontend`) consume esta API bajo el prefijo `/api`.

---

## 2. Arquitectura de capas

```
src/
├── domain/           Entidades e interfaces de repositorio
├── application/      Casos de uso y servicios de negocio
├── infrastructure/   Express, SQL Server, almacenamiento, jobs, seguridad
└── shared/           Tipos, errores, constantes, utilidades
```

| Capa | Responsabilidad |
|------|-----------------|
| **Domain** | Reglas puras: `Usuario`, `Archivo`, `Rol`, contratos `I*Repository` |
| **Application** | Orquestación: login, subida, permisos, sync Intranet |
| **Infrastructure** | HTTP, consultas SQL, JWT, disco/NAS, cron jobs |
| **Shared** | `JwtPayload`, `nasRoles`, límites de almacenamiento |

---

## 3. Bases de datos (dos conexiones)

| Base | Servidor típico | Acceso desde NAS | Uso |
|------|-----------------|------------------|-----|
| **DB_NAS** | `MSSQL_NAS_*` | Lectura / escritura | Archivos, usuarios sombra, roles locales, categorías, cuotas |
| **BDJUNTOS** | `MSSQL_USER_*` | **Solo lectura** | Login Intranet, roles ConectaJuntos (COD 1072–1080) |

### Regla de oro

- **Quién puede entrar y qué roles NAS tiene** → se lee de **BDJUNTOS** en cada login y en cada petición autenticada.
- **Cuota, categorías asignadas, archivos** → se persisten en **DB_NAS**.
- El módulo **no modifica** tablas de BDJUNTOS.

### Perfil sombra

Al iniciar sesión por Intranet se crea o actualiza un registro en `NASTM_USUARIOS` (DB_NAS) vinculado al `codUsuario` / DNI de BDJUNTOS. Los archivos referencian ese UUID local.

---

## 4. Autenticación y sesión

### 4.1 Login manual (Intranet)

1. El usuario envía DNI + contraseña a `POST /api/auth/login`.
2. Se valida contra BDJUNTOS (`tbl_mst_usuarios` / esquema VIATICO).
3. Se verifica que tenga al menos un rol NAS activo (COD **1072–1080**).
4. Se asegura el perfil sombra en DB_NAS.
5. Se calculan categorías efectivas desde roles BDJUNTOS + matriz `NASTD_ROLES_CATEGORIAS`.
6. Se devuelve **JWT** + **refresh token**.

### 4.2 SSO ConectaJuntos (simulador / portal)

1. El frontend consulta el microservicio ConectaJuntos (`Obtener_DatosSesion`).
2. Con identidad activa, llama a `POST /api/auth/sync-external-user` **sin contraseña**.
3. Se crea/actualiza usuario local y se emiten tokens.

### 4.3 Renovación de sesión

- Access token: duración configurable (`JWT_EXPIRES_IN`, default `1h`).
- Refresh token: `JWT_REFRESH_EXPIRES_IN`, default `7d`.
- `POST /api/auth/refresh` renueva el access token sin pedir contraseña.
- El frontend reintenta peticiones fallidas por `401` usando el refresh token.

### 4.4 Middleware de autenticación

En cada request con JWT:

1. Verifica token.
2. Revalida usuario en BDJUNTOS (activo, roles NAS).
3. Recalcula permisos y categorías efectivas.
4. Sincroniza categorías al perfil NAS si cambiaron.
5. Adjunta `req.user` con `rol`, `permisos`, `categorias`.

---

## 5. Roles y permisos NAS

### Roles Intranet (ConectaJuntos)

COD **1072–1080** en `tbl_ctrl_usuarios_rol`:

| COD | Rol interno DB_NAS | Unidad |
|-----|-------------------|--------|
| 1072 | NAS_ADMIN | Admin (todas las categorías) |
| 1073 | NAS_UCI | UCI |
| 1074 | NAS_UAS | UAS |
| 1075 | NAS_UOP | UOP |
| 1076 | NAS_UTI | UTI |
| 1077 | NAS_UA | UA |
| 1078 | NAS_UI | UI |
| 1079 | NAS_UPPM | UPPM |
| 1080 | NAS_URH | URH |

### Multi-rol

| Situación | Comportamiento |
|-----------|----------------|
| Usuario con **UAS + UCI** | Ve y opera en **ambas** unidades (unión de categorías) |
| Usuario con **Admin NAS (1072)** o **SuperAdmin** | Ve **todo**; los demás roles no limitan |
| Cambio de rol en BDJUNTOS | Efecto en la **siguiente petición API** (no requiere re-login en backend) |

### Matriz roles × categorías

Tabla `NASTD_ROLES_CATEGORIAS` define qué categorías corresponde a cada rol NAS local.  
Script de referencia: `scripts/database/12.alter-roles-categorias.sql` y `13.seed-nastm-roles-intranet-cod.sql`.

### Permisos (`CO_PERMISO`)

Se resuelven desde `NASTD_ROLES_PERMISOS` según los roles efectivos del usuario.  
Endpoint: `GET /api/auth/my-permissions`.

---

## 6. API REST (resumen)

| Prefijo | Autenticación | Descripción |
|---------|---------------|-------------|
| `/health` | No | Estado del servicio |
| `/api/auth` | Parcial | Login, refresh, sync SSO, permisos propios |
| `/api/files` | Sí | Subida, listado, descarga, movimiento, vigencia |
| `/api/folders` | Sí | Árbol de carpetas, permisos de subida |
| `/api/links` | Sí | Enlaces públicos por token |
| `/api/admin` | Sí + permisos | Usuarios, roles, categorías, matriz, auditoría |
| `/v/:token` | No | Descarga pública por enlace |

Todas las rutas `/api/*` (excepto login/refresh/sync) requieren header:

```
Authorization: Bearer <access_token>
```

---

## 7. Almacenamiento de archivos

| Variable | Descripción |
|----------|-------------|
| `STORAGE_ROOT_PATH` | Raíz permanente (local o unidad NAS mapeada, ej. `W:\`) |
| `TEMP_STORAGE_PATH` | Staging temporal antes de mover al NAS |
| `USE_TEMP_STORAGE` | `true` = subida en dos fases; `false` = directo al root |
| `FILE_ENCRYPTION_SALT` | Salt para cifrado de rutas/contenido según implementación |

Al arrancar, el sistema intenta crear carpetas por categoría activa bajo el root configurado.

---

## 8. Jobs en segundo plano

| Job | Función |
|-----|---------|
| `CleanTemporaryFilesJob` | Elimina archivos temporales vencidos (`TEMP_FILE_TTL_MINUTES`) |
| `ExpireArchivoVigenciaJob` | Da de baja archivos cuya vigencia expiró |

---

## 9. Migraciones automáticas al inicio

En `main.ts` se ejecutan comprobaciones idempotentes (ALTER si falta columna):

- `DE_RUTAS_ESPEJO` en archivos
- Columnas de vigencia
- `ES_VIGENTE` en categorías
- `NU_ID_ROL_INTRANET` en roles

Si el usuario SQL no tiene permisos `ALTER`, el arranque falla con indicación del script manual en `scripts/database/`.

---

## 10. Estructura de tablas principales (DB_NAS)

| Tabla | Uso |
|-------|-----|
| `NASTM_USUARIOS` | Perfiles locales / sombra |
| `NASTD_USUARIO_CATEGORIAS` | Unidades asignadas al usuario |
| `NASTM_ROLES` / `NASTD_ROLES_PERMISOS` | Roles NAS y permisos |
| `NASTD_ROLES_CATEGORIAS` | Matriz rol ↔ categoría |
| `NASTM_CATEGORIAS` | Unidades organizacionales (UAS, UCI, …) |
| `NASTM_ARCHIVOS` / `NASTM_CARPETAS` | Metadatos de archivos y carpetas |
| `NASTM_ENLACES` | Tokens de enlace público |
| `NASTV_*` | Auditoría y eventos |

Esquema completo de referencia: `scripts/database/2.database-clean-sqlserver.sql` o `calidad/DB_NAS_COMPLETO_CALIDAD.sql`.

---

## 11. Variables de entorno clave

Ver detalle en [manual-despliegue.md](./manual-despliegue.md). Resumen:

- `MSSQL_NAS_*` — conexión DB_NAS
- `MSSQL_USER_*` / `MSSQL_USERDATABASE` — conexión BDJUNTOS
- `JWT_*` — tokens de sesión
- `STORAGE_*` — rutas de archivos
- `CORS_ORIGIN` — orígenes del frontend permitidos

Plantilla: `env.template` en la raíz del backend.

---

## 12. Comandos de desarrollo

```bash
npm install
npm run dev      # tsx watch — puerto según SERVER_URL (default 3000)
npm run build    # compila a dist/
npm start        # node dist/main.js
npm run type-check
```

---

## 13. Solución de problemas frecuentes

| Síntoma | Causa probable | Acción |
|---------|----------------|--------|
| «No tenés rol NAS asignado» | Sin rol 1072–1080 en BDJUNTOS | Asignar rol en ConectaJuntos |
| Sesión cae al login tras un rato | Token expirado sin refresh | Verificar `POST /api/auth/refresh` y tokens en localStorage |
| Error al subir archivos | NAS no mapeado o sin permisos | Verificar `STORAGE_ROOT_PATH` y acceso de la cuenta de servicio |
| Roles muestran código interno | Falta seed Intranet | Ejecutar script `13.seed-nastm-roles-intranet-cod.sql` |
| `ECONNREFUSED` en frontend | Backend detenido | Levantar `npm run dev` en backend |

---

## 14. Referencias en el repositorio

| Ruta | Contenido |
|------|-----------|
| `scripts/database/` | Scripts SQL ordenados por número |
| `env.template` | Variables de entorno documentadas |
| `src/shared/constants/nasRoles.ts` | COD Intranet 1072–1080 |
| `../frontend/` | Cliente React (Vite) |
