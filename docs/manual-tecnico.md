# Manual técnico — Backend NAS

Referencia para desarrolladores que mantienen la API del módulo de almacenamiento.

---

## 1. Requisitos y arranque

| Requisito | Versión |
|-----------|---------|
| Node.js | 20 LTS recomendado |
| SQL Server | Acceso a DB_NAS y BDJUNTOS |
| TypeScript | 5.x (build con `tsc`) |

```powershell
cd backend
npm install
npm run dev          # desarrollo (tsx watch)
npm run build        # compila a dist/
npm start            # producción
```

Variables obligatorias según modo: ver [manual-despliegue.md](./manual-despliegue.md) y `env.template`.

---

## 2. Estructura de paquetes

| Ruta | Responsabilidad |
|------|-----------------|
| `src/main.ts` | Bootstrap: dotenv, migraciones SQL, cron jobs, servidor |
| `src/infrastructure/http/express/app.ts` | Montaje de rutas y middleware global |
| `src/infrastructure/database/sqlserver/connection.ts` | Pools NAS y BDJUNTOS |
| `src/application/use-cases/` | Lógica de negocio por feature |
| `src/infrastructure/database/sqlserver/repositories/` | Acceso SQL |
| `scripts/database/` | Scripts SQL manuales / seeds |

---

## 3. API REST

Base: `{SERVER_URL}/api` (ej. `http://localhost:3000/api`).

### Auth — `/api/auth`

| Método | Ruta | Auth | Body / headers |
|--------|------|------|----------------|
| POST | `/login` | No | `{ documento, password }` |
| POST | `/refresh` | No | `{ refreshToken }` |
| POST | `/sync-external-user` | No | SSO: `{ dniEncrypted }` + header `X-NAS-SSO-Flag` |
| GET | `/my-permissions` | JWT | — |

**Login Intranet** (`LoginUseCase.executeIntranet`):

1. `IntranetAuthRepository.findByLogin(documento)` → `INTRANET.tbl_mst_usuarios`.
2. `fetchVClaveByLogin` → `VIATICO.tbl_mst_usuario` (Sicontigo).
3. `validateIntranetPassword` → cifrado/descifrado AES Sicontigo.
4. `listRolesNasActivos` → roles 1072–1080.
5. `NasUserShadowService.ensureLocalUser` → DB_NAS.
6. `syncIntranetUserCategories` → categorías del usuario.
7. Emisión JWT.

**SSO** (`SyncExternalUserUseCase.executeIntranetSso`):

1. `decryptNasSsoCoduser(dniEncrypted)` con `NAS_SSO_SECRET`.
2. Mismo flujo desde paso 4 (sin password).

### Archivos — `/api/files`

Operaciones principales (todas con JWT):

- `GET /` — listado con filtros (carpeta, categoría, visibilidad).
- `POST /upload` — subida simple o bulk (multer).
- `GET /:id/download` — descarga.
- `PATCH /:id` — renombrar, vigencia, mover.
- `DELETE /:id` — eliminación lógica/física según reglas.

Visibilidad en raíz: usuarios no admin ven archivos de su unidad si el propietario no es privado (`ListFilesUseCase`).

### Carpetas — `/api/folders`

- CRUD, compartir (`share`), política de subida por carpeta.

### Enlaces — `/api/links` y `/v/:token`

- Enlaces temporales sin JWT en `GET /v/:token` (ruta pública en `public.routes.ts`).

### Admin — `/api/admin`

Requiere rol admin NAS (COD 1072):

- Usuarios, roles, permisos, categorías, export auditoría.

---

## 4. Conexión SQL Server

### DB_NAS

```env
MSSQL_NAS_SERVER=...
MSSQL_NAS_DATABASE=DB_NAS
MSSQL_NAS_USER=...
MSSQL_NAS_PASSWORD=...
```

Funciones: `query()`, `getNasPool()`.

### BDJUNTOS

```env
MSSQL_USERDATABASE=BDJUNTOS
MSSQL_USER_SERVER=...    # opcional si mismo servidor que NAS
MSSQL_USER_USER=...
MSSQL_USER_PASSWORD=...
```

Funciones: `queryUserDb()`, `intranetTable()`, `viaticoTable()`.

### Consulta de credencial Intranet

```sql
SELECT TOP 1 vCodPersonal, vUsuario, vClave, vActivo, iReset
FROM BDJUNTOS.VIATICO.tbl_mst_usuario
WHERE (vCodPersonal = @dni OR vUsuario = @dni)
  AND vActivo = N'SI'
ORDER BY iIdCodClave DESC
```

---

## 5. Criptografía

### Sicontigo (login manual)

| Variable | Descripción |
|----------|-------------|
| `SICONTIGO_PASSWORD` | Password maestra PBKDF2 (**obligatoria**, sin default en código) |
| `SICONTIGO_SALT` | Salt UTF-8 (ej. `Ivan Medvedev`) |

Algoritmo: AES-256-CBC + PBKDF2 (1000 iter, SHA-1), texto UTF-16 LE.  
Archivos: `sicontigoCrypto.ts`, `intranetPassword.ts`.

### SSO ConectaJuntos

| Variable | Descripción |
|----------|-------------|
| `NAS_SSO_SECRET` | Secreto compartido con portal .NET |
| `NAS_SSO_FLAG` | Valor esperado en header `X-NAS-SSO-Flag` |

Algoritmo: AES-256-GCM, clave = SHA-256(secret), payload Base64 = IV(12) + TAG(16) + ciphertext.  
Archivo: `nasSsoCrypto.ts`.

---

## 6. Middleware

| Middleware | Archivo | Uso |
|------------|---------|-----|
| `authMiddleware` | `auth.middleware.ts` | JWT + revalidación Intranet |
| `requirePermiso` | `requirePermiso.middleware.ts` | Permisos por acción |
| `errorMiddleware` | `error.middleware.ts` | Respuestas de error uniformes |

Errores de dominio: `UnauthorizedError`, `ForbiddenError`, `NotFoundError` en `shared/errors/`.

---

## 7. Jobs en background

| Job | Función |
|-----|---------|
| Limpieza temp | Borra archivos en `TEMP_STORAGE_PATH` según TTL |
| Vigencia | Desactiva archivos vencidos |

Configurados en `src/infrastructure/jobs/` y arrancan desde `main.ts`.

---

## 8. Almacenamiento físico

```env
STORAGE_ROOT_PATH=W:\
USE_TEMP_STORAGE=false
MAX_FILE_SIZE_BYTES=1073741824
ALLOWED_MIME_TYPES=*
```

El backend espera el share NAS mapeado en la misma sesión de Windows que ejecuta Node (ver comentarios en `.env`).

---

## 9. Respuestas y errores

Formato típico:

```json
{ "success": true, "data": { ... } }
```

```json
{ "success": false, "error": "Mensaje legible" }
```

Códigos HTTP: 400 validación, 401 credenciales/token, 403 sin rol/permiso, 404 no encontrado, 500 interno.

---

## 10. Pruebas locales recomendadas

1. Backend con `MSSQL_USERDATABASE=BDJUNTOS` y `SICONTIGO_*` configurados.
2. Microservicio ConectaJuntos en `:3005` para SSO.
3. Frontend en `:5173` con proxy `/api` → `:3000`.
4. Usuario de prueba con rol NAS 1072–1080 en BDJUNTOS.

---

## 11. Referencias

- [arquitectura.md](./arquitectura.md) — diagramas y capas
- [manual-del-sistema.md](./manual-del-sistema.md) — reglas de negocio
- `../microservicio/docs/INTEGRACION-CONECTAJUNTOS-NET.md` — contrato .NET
