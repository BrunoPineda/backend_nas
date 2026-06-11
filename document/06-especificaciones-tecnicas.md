# 06 — Especificaciones técnicas

## 1. Stack tecnológico

### Backend

| Componente | Tecnología | Versión ref. |
|------------|------------|--------------|
| Runtime | Node.js | 20+ |
| Lenguaje | TypeScript | 5.3 |
| HTTP | Express | 4.18 |
| BD | mssql (SQL Server) | 11.x |
| Auth | jsonwebtoken + bcrypt | — |
| Upload | multer | 1.4 |
| Imágenes | sharp | 0.33 |
| Jobs | node-cron | 3.0 |
| Logs | winston | 3.11 |

### Frontend

| Componente | Tecnología |
|------------|------------|
| UI | React 18 + TypeScript |
| Build | Vite 5 |
| CSS | Tailwind 3.4 |
| HTTP | Axios |
| Upload UI | react-dropzone |
| Notificaciones | react-hot-toast |

### Infraestructura

| Componente | Detalle |
|------------|---------|
| BD principal | SQL Server `DB_NAS` |
| BD identidad | SQL Server `BDJUNTOS` (lectura) |
| Archivos | Filesystem local / NAS mount |
| Repo Git | GitLab `conectajuntos/nasback` |

---

## 2. Variables de entorno (backend)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `SERVER_URL` | URL base del API | `http://localhost:3000` |
| `NODE_ENV` | Ambiente | `development` / `produccion` |
| `MSSQL_NAS_*` | Conexión DB_NAS | server, database, user, password |
| `MSSQL_USER_*` | Conexión BDJUNTOS | solo lectura |
| `JWT_SECRET` | Firma access token | *(secreto)* |
| `JWT_EXPIRES_IN` | TTL access | `1h` |
| `JWT_REFRESH_SECRET` | Firma refresh | *(secreto)* |
| `JWT_REFRESH_EXPIRES_IN` | TTL refresh | `7d` |
| `STORAGE_ROOT_PATH` | Ruta permanente | `../storage` |
| `TEMP_STORAGE_PATH` | Ruta temporal | `./temp` |
| `TEMP_FILE_TTL_MINUTES` | TTL staging | `1` |
| `MAX_FILE_SIZE_BYTES` | Tamaño máx. upload | `104857600` (100 MB) |
| `CORS_ORIGIN` | Orígenes permitidos | `http://localhost:5173` |
| `FILE_ENCRYPTION_SALT` | Salt nombres/opacos | *(secreto)* |

Plantilla: `env.template` en raíz del backend.

---

## 3. API REST — Endpoints

### Autenticación

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/login` | No | Login email/password |
| GET | `/api/auth/health` | No | Health del módulo auth |

### Archivos

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/files` | Subir (multipart `file`, optional `folderId`) |
| GET | `/api/files` | Listar (`?folderId=`) |
| GET | `/api/files/:id/download` | Descargar |
| PATCH | `/api/files/:id/rename` | Renombrar |
| PATCH | `/api/files/:id/move` | Mover de carpeta |
| DELETE | `/api/files/:id` | Baja lógica |

### Carpetas

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/folders` | Listar árbol |
| POST | `/api/folders` | Crear |
| POST | `/api/folders/:id/share` | Compartir con usuario |

### Enlaces

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/links` | Crear enlace |
| GET | `/api/links` | Listar del usuario |
| DELETE | `/api/links/:id` | Revocar |

### Público

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/v/:token` | Acceso archivo por token |
| GET | `/health` | `{ status: "ok" }` |

### Administración (`/api/admin/*`)

| Recurso | Operaciones |
|---------|-------------|
| `/users` | GET, POST, PUT/:id, DELETE/:id |
| `/roles` | GET, POST, PUT/:id/permissions |
| `/permissions` | GET |

**Formato respuesta estándar:**

```json
{
  "success": true,
  "data": { }
}
```

**Errores:**

```json
{
  "success": false,
  "error": "Mensaje descriptivo"
}
```

---

## 4. Autenticación y autorización

### JWT

- Header: `Authorization: Bearer <token>`
- Payload incluye: `userId`, `email`, `rol`
- Middleware: `authMiddleware` en rutas protegidas

### Matriz de permisos (resumen)

| Acción | USER | POWER | MOD | ADMIN |
|--------|:----:|:-----:|:---:|:-----:|
| Subir / descargar propios | ✓ | ✓ | ✓ | ✓ |
| Compartir carpeta | | ✓ | | ✓ |
| Moderar contenido | | | ✓ | ✓ |
| Gestionar usuarios | | | | ✓ |
| Gestionar roles | | | | ✓ |

Reglas adicionales en código: categorías compartidas, usuario privado, permisos de carpeta compartida (READ/WRITE/ADMIN).

---

## 5. Infraestructura por ambiente

| Ambiente | Rama Git | Backend | Frontend | BD |
|----------|----------|---------|----------|-----|
| Desarrollo | `desarrollo` | :3000 | :5173 | DB_NAS dev |
| Calidad | `calidad` | servidor QA | servidor QA | DB_NAS QA |
| Producción | `produccion` | servidor prod | servidor prod | DB_NAS prod |

### Comandos de despliegue

**Backend:**

```bash
cd backend
npm install
npm run build
npm start
# desarrollo: npm run dev
```

**Frontend:**

```bash
cd frontend
npm install
npm run build
# servir dist/ con nginx o IIS
```

---

## 6. Seguridad

| Control | Implementación |
|---------|----------------|
| Contraseñas | bcrypt |
| Transporte | HTTPS obligatorio en prod |
| CORS | Lista blanca + túneles dev |
| Headers | Helmet |
| Upload | Límite tamaño; validación MIME (configurable) |
| Enlaces | Token 64 chars; expiración y revocación |
| Secrets | `.env` fuera de Git (`.gitignore`) |

---

## 7. Respaldos y continuidad

| Elemento | Frecuencia sugerida | Método |
|----------|---------------------|--------|
| DB_NAS | Diario | Backup SQL Server |
| `storage/` | Diario incremental | Snapshot / robocopy |
| Config `.env` | Por cambio | Vault / gestor secretos |
| Logs aplicación | 30 días | Rotación winston / SO |

---

## 8. Criterios de prueba (UAT)

### Funcionales

- [ ] Login con usuario vigente → redirect dashboard.
- [ ] Login credenciales inválidas → mensaje error.
- [ ] Subir archivo &lt; límite → visible en listado.
- [ ] Subir archivo &gt; límite → error controlado.
- [ ] Tras 1 min, archivo accesible desde storage permanente.
- [ ] Crear carpeta y mover archivo entre carpetas.
- [ ] Crear enlace temporal → acceso `/v/:token` sin login.
- [ ] Enlace expirado → HTTP 410.
- [ ] Revocar enlace → acceso denegado.
- [ ] Usuario categoría A no ve archivos de categoría B (salvo compartido).
- [ ] Admin crea usuario y asigna rol/categorías.
- [ ] `/health` responde 200.

### No funcionales

- [ ] Tiempo respuesta listado &lt; 3 s con 500 archivos de prueba.
- [ ] Upload 50 MB completa sin timeout en red institucional.
- [ ] CORS bloquea origen no autorizado en producción.

### Scripts de verificación BD

```bash
# Ejecutar en SQL Server Management Studio
# ../scripts/VERIFICAR_ROLES_PERMISOS.sql
```

---

## 9. Monitoreo

| Check | Endpoint / acción |
|-------|-------------------|
| API viva | `GET /health` |
| Auth | `GET /api/auth/health` |
| Job temporal | Log `Archivo {id} movido a almacenamiento permanente` |
| Espacio disco | Alerta si `storage/` &gt; 80% capacidad |
| SQL Server | Monitor conexiones pool `mssql` |

---

## 10. Frontend — variables

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | URL base del backend |

Ejemplo: `VITE_API_URL=http://localhost:3000`
