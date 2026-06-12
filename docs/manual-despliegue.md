# Manual de despliegue — Backend NAS

Guía para instalar y poner en marcha el backend en entornos de **desarrollo**, **calidad** y **producción**.

---

## 1. Requisitos previos

| Componente | Versión recomendada |
|------------|---------------------|
| Node.js | 20 LTS o superior |
| npm | 10+ |
| SQL Server | 2019+ (acceso a DB_NAS y BDJUNTOS) |
| Sistema operativo | Windows Server (NAS mapeado) o Linux con montaje SMB |
| Red | Conectividad a servidores SQL y share NAS |

Opcional para desarrollo local:

- Simulador ConectaJuntos (`microservicio_conectajuntos`, puerto 3005)
- Frontend Vite (`PJ_Almacenamiento/frontend`, puerto 5173)

---

## 2. Estructura del proyecto

```
PJ_Almacenamiento/backend/
├── src/                    Código fuente TypeScript
├── dist/                   Salida de `npm run build` (generada)
├── scripts/database/       Migraciones y seeds SQL
├── docs/                   Documentación
├── env.template            Plantilla de variables de entorno
├── package.json
└── .env                    Configuración local (no commitear secretos)
```

---

## 3. Instalación

```bash
cd PJ_Almacenamiento/backend
npm ci          # o npm install
cp env.template .env   # Linux/macOS; en Windows copiar manualmente
```

Editar `.env` con valores del entorno (ver sección 4).

### Desarrollo

```bash
npm run dev
```

### Producción

```bash
npm run build
npm start
```

El puerto se toma de `SERVER_URL` (ej. `http://localhost:3000` → puerto **3000**).

---

## 4. Variables de entorno

### 4.1 Servidor

```env
SERVER_URL=http://localhost:3000
NODE_ENV=production
CORS_ORIGIN=https://nas.juntos.gob.pe,http://localhost:5173
```

- `CORS_ORIGIN`: una URL o varias separadas por coma.
- URLs `trycloudflare.com`, `ngrok.io` se permiten automáticamente en desarrollo.

### 4.2 SQL Server — DB_NAS (lectura/escritura)

```env
MSSQL_NAS_SERVER=192.168.x.x
MSSQL_NAS_PORT=1433
MSSQL_NAS_DATABASE=DB_NAS
MSSQL_NAS_USER=usuario_app
MSSQL_NAS_PASSWORD=********
MSSQL_NAS_ENCRYPT=true
MSSQL_NAS_TRUST_SERVER_CERTIFICATE=true
```

**Permisos mínimos del usuario:** `SELECT`, `INSERT`, `UPDATE`, `DELETE` sobre tablas `NAST*`.  
Idealmente también `ALTER` en despliegue inicial (migraciones automáticas al arrancar).

### 4.3 SQL Server — BDJUNTOS (solo lectura)

```env
MSSQL_USER_SERVER=192.168.x.x
MSSQL_USERDATABASE=BDJUNTOS
MSSQL_USER_USER=usuario_readonly
MSSQL_USER_PASSWORD=********
MSSQL_USER_ENCRYPT=true
MSSQL_USER_TRUST_SERVER_CERTIFICATE=true
```

El backend activa modo Intranet cuando `MSSQL_USERDATABASE` está definido.  
El usuario SQL debe tener **solo lectura** sobre tablas de usuarios y roles Intranet.

### 4.4 JWT (obligatorio cambiar en producción)

```env
JWT_SECRET=<cadena_larga_aleatoria>
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=<otra_cadena_larga_aleatoria>
JWT_REFRESH_EXPIRES_IN=7d
```

Generar secretos con, por ejemplo:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4.5 Almacenamiento

**Desarrollo local:**

```env
STORAGE_ROOT_PATH=../storage
USE_TEMP_STORAGE=true
TEMP_STORAGE_PATH=./temp
TEMP_FILE_TTL_MINUTES=60
```

**Producción con NAS Windows:**

1. Mapear unidad **antes** de iniciar el servicio Node (misma sesión o servicio de Windows):

```cmd
net use W: \\nas-04.juntos.gob.pe\Media\NAS /user:CUENTA_SERVICIO "CLAVE" /persistent:yes
```

2. Configurar `.env`:

```env
STORAGE_ROOT_PATH="W:\\"
USE_TEMP_STORAGE=false
TEMP_STORAGE_PATH=./temp
```

> No terminar `STORAGE_ROOT_PATH` en `\` suelto dentro de comillas mal cerradas; preferir `"W:\\"`.

### 4.6 Límites y cifrado

```env
MAX_FILE_SIZE_BYTES=1073741824
MAX_BULK_UPLOAD_FILES=10
ALLOWED_MIME_TYPES=*
FILE_ENCRYPTION_SALT=<salt_unico_por_entorno>
```

---

## 5. Base de datos — orden de scripts

Ejecutar en **DB_NAS** en el servidor `MSSQL_NAS_*`:

| Orden | Script | Descripción |
|-------|--------|-------------|
| 1 | `scripts/database/2.database-clean-sqlserver.sql` | Esquema base completo (instalación nueva) |
| 2 | `scripts/database/3.alter-usuario-in-es-privado.sql` | … |
| 3 | `scripts/database/4.alter-usuario-extendido.sql` | Campos extendidos usuario |
| 4 | `scripts/database/5.alter-politica-subida-carpetas.sql` | Políticas de subida |
| 5 | `scripts/database/6.alter-admin-view-file-audit.sql` | Auditoría admin |
| 6 | `scripts/database/7.alter-archivo-rutas-espejo.sql` | Rutas espejo |
| 7 | `scripts/database/8.alter-archivo-vigencia.sql` | Vigencia de archivos |
| 8 | `scripts/database/9.alter-categoria-es-vigente.sql` | Categorías vigentes |
| 9 | `scripts/database/10.alter-rol-intranet-id.sql` | COD Intranet en roles |
| 10 | `scripts/database/12.alter-roles-categorias.sql` | Matriz roles × categorías |
| 11 | `scripts/database/13.seed-nastm-roles-intranet-cod.sql` | Seed roles 1072–1080 |
| 12 | `scripts/database/14.fix-rol-nombre-intranet.sql` | Corrección nombres (si aplica) |

Para **calidad**, alternativa monolítica:  
`scripts/database/calidad/DB_NAS_COMPLETO_CALIDAD.sql`

> En instalaciones ya existentes, ejecutar solo los scripts que falten (número mayor al último aplicado).

**BDJUNTOS:** no ejecutar scripts de escritura desde este módulo. Solo conceder lectura al usuario `MSSQL_USER_*`.

---

## 6. Despliegue del frontend

El backend no sirve el SPA en producción por defecto. Desplegar frontend por separado:

```bash
cd PJ_Almacenamiento/frontend
npm ci
npm run build
```

Servir `dist/` con IIS, nginx o CDN. Configurar proxy `/api` hacia el backend.

Variable en frontend:

```env
VITE_API_URL=https://api-nas.ejemplo.gob.pe
```

En desarrollo, Vite proxy apunta a `http://localhost:3000`.

---

## 7. Verificación post-despliegue

### 7.1 Health check

```bash
curl http://localhost:3000/health
```

Respuesta esperada:

```json
{ "status": "ok", "timestamp": "..." }
```

### 7.2 Auth

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"documento\":\"DNI\",\"password\":\"***\"}"
```

### 7.3 Logs de arranque

Confirmar en consola:

- `[DB] Columna ... lista`
- `[NAS] Carpetas de categorías OK en "..."`
- `Servidor corriendo en ...`

### 7.4 SQL

Ejecutar `VERIFICAR_ROLES_PERMISOS.sql` (raíz del monorepo) si existen dudas sobre roles/permisos.

---

## 8. Despliegue como servicio Windows

1. Compilar: `npm run build`
2. Instalar **NSSM** o usar **Task Scheduler** / **pm2-windows-service**
3. Comando: `node dist/main.js`
4. Directorio de trabajo: `PJ_Almacenamiento/backend`
5. Variables de entorno: cargar desde `.env` o definir en el servicio
6. Asegurar mapeo de unidad NAS **antes** del start del servicio (script de inicio)

Ejemplo script `start-nas-backend.cmd`:

```cmd
net use W: \\servidor\share\NAS /user:CUENTA "CLAVE" /persistent:yes
cd /d D:\apps\PJ_Almacenamiento\backend
node dist\main.js
```

---

## 9. Despliegue con PM2 (Linux / Windows)

```bash
npm run build
pm2 start dist/main.js --name nas-backend --cwd /ruta/backend
pm2 save
```

Montar NAS con `cifs` en `/mnt/nas` y `STORAGE_ROOT_PATH=/mnt/nas`.

---

## 10. Seguridad en producción

- [ ] Cambiar `JWT_SECRET` y `JWT_REFRESH_SECRET`
- [ ] Cambiar `FILE_ENCRYPTION_SALT`
- [ ] Usuario SQL NAS con permisos mínimos (no `sa`)
- [ ] Usuario BDJUNTOS solo lectura
- [ ] HTTPS en reverse proxy (IIS/nginx)
- [ ] Restringir `CORS_ORIGIN` a dominios reales
- [ ] No commitear `.env` al repositorio
- [ ] Firewall: solo puertos necesarios hacia SQL y NAS

---

## 11. Rollback

1. Detener servicio Node
2. Restaurar backup de DB_NAS previo al cambio
3. Desplegar binario/commit anterior (`git checkout <tag>`)
4. `npm ci && npm run build && npm start`
5. Verificar `/health` y login de prueba

---

## 12. Contacto y soporte

Documentación relacionada:

- [manual-del-sistema.md](./manual-del-sistema.md) — comportamiento funcional
- [versionamiento.md](./versionamiento.md) — releases y migraciones
