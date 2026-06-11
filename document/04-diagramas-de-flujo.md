# 04 — Diagramas de flujo

## 1. Autenticación (login)

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend
    participant A as POST /api/auth/login
    participant DB as DB_NAS

    U->>F: Email + contraseña
    F->>A: JSON credentials
    A->>DB: SELECT NASTM_USUARIOS por DI_CORREO
    alt Usuario no existe o inactivo
        A-->>F: 401 Credenciales inválidas
    else Password OK
        A->>DB: UPDATE FE_ULTIMO_LOGIN
        A-->>F: JWT + refreshToken + user
        F->>F: localStorage token/user
        F-->>U: Redirect Dashboard /
    end
```

---

## 2. Subida de archivo (upload + promoción temporal)

```mermaid
flowchart TD
    A[Usuario selecciona archivo] --> B[POST /api/files multipart]
    B --> C{¿Autenticado JWT?}
    C -->|No| X[401]
    C -->|Sí| D{¿Cuota y tamaño OK?}
    D -->|No| Y[400/413]
    D -->|Sí| E[Guardar en backend/temp/]
    E --> F[INSERT NASTM_ARCHIVOS IN_EN_TEMPORAL=1]
    F --> G[Respuesta 201 al frontend]
    G --> H[Job cron cada minuto]
    H --> I{¿> 1 min en temporal?}
    I -->|Sí| J[Leer temp → escribir storage/AÑO/MES/DÍA]
    J --> K[DELETE temp + UPDATE IN_EN_TEMPORAL=0]
    I -->|No| H
```

---

## 3. Descarga autenticada

```mermaid
sequenceDiagram
    participant F as Frontend
    participant API as GET /api/files/:id/download
    participant DB as DB_NAS
    participant T as temp/
    participant S as storage/

    F->>API: Bearer JWT
    API->>DB: find archivo + permisos carpeta/categoría
    alt Sin permiso
        API-->>F: 403
    else IN_EN_TEMPORAL=1
        API->>T: leer binario
    else
        API->>S: leer DE_RUTA_FISICA + NO_ARCHIVO_FISICO
    end
    API->>DB: UPDATE FE_ULTIMA_DESCARGA
    API-->>F: Stream archivo
```

---

## 4. Enlace público / temporal

```mermaid
flowchart TD
    U[Usuario crea enlace] --> L[POST /api/links]
    L --> DB[(NASTM_ENLACES token)]
    DB --> URL[URL /v/:token]
    URL --> P[GET /v/:token sin auth]
    P --> V{¿Enlace vigente?}
    V -->|Expirado / revocado / max visitas| E[410 Gone]
    V -->|OK| R[Incrementar visitas]
    R --> F[Servir archivo inline o attachment]
    F --> B[Navegador: preview imagen/PDF/video o descarga]
```

**Frontend:** ruta React `/v/:token` consume el mismo endpoint y renderiza preview según MIME.

---

## 5. Compartir carpeta por categoría

```mermaid
flowchart LR
    A[Usuario A sube carpeta] --> B{¿Misma categoría que B?}
    B -->|Sí| C[B ve carpeta en listado]
    B -->|No| D[B no ve contenido]
    E[Usuario privado IN_ES_PRIVADO=1] --> F[Solo enlaces públicos]
```

**Compartir explícito:** `ShareFolderUseCase` → `NASTD_CARPETAS_COMPARTIDAS` con permiso READ/WRITE/ADMIN.

---

## 6. Administración de usuarios y roles

```mermaid
flowchart TD
    AD[Admin /admin] --> JWT{¿Rol ADMIN?}
    JWT -->|No| DEN[Redirect /]
    JWT -->|Sí| M[Panel Admin]
    M --> U[CRUD usuarios]
    M --> R[CRUD roles y permisos]
    M --> C[Asignar categorías]
    U --> DB[(NASTM_USUARIOS + NASTD_USUARIO_CATEGORIAS)]
    R --> DB2[(NASTM_ROLES + NASTD_ROLES_PERMISOS)]
```

---

## 7. Limpieza y mantenimiento automático

```mermaid
flowchart TD
    CRON[node-cron * * * * *] --> Q[SELECT archivos IN_EN_TEMPORAL=1]
    Q --> LOOP[Por cada archivo]
    LOOP --> T{¿createdAt + 1min?}
    T -->|Sí| MOVE[Mover a storage permanente]
    T -->|No| SKIP[Esperar siguiente ciclo]
    MOVE --> UPD[Actualizar BD]
```

Variable relacionada: `TEMP_FILE_TTL_MINUTES` (default 1).

---

## 8. Flujo de despliegue por ambiente

```mermaid
flowchart LR
    DEV[Commit en desarrollo] --> MR1[Merge request]
    MR1 --> QA[Deploy calidad]
    QA --> UAT[Pruebas UAT]
    UAT --> PROD[Merge produccion]
    PROD --> GO[Go-live + smoke test /health]
```

---

## 9. Integración ConectaJuntos (visión)

```mermaid
flowchart TB
    CJ[App ConectaJuntos] -.->|Futuro SSO/API| NAS[Backend NAS]
    NAS --> DBNAS[(DB_NAS)]
    NAS -.->|Lectura identidad| BDJ[(BDJUNTOS)]
```

Estado actual: credenciales NAS en `NASTM_USUARIOS`; conexión BDJUNTOS preparada en `.env` para evolución a SSO unificado.
