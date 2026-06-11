# 01 — Descripción del sistema

## 1. Nombre y propósito

**Sistema de Almacenamiento NAS (Network Attached Storage)** — módulo del ecosistema **ConectaJuntos / Programa Juntos** para centralizar la subida, organización, descarga y compartición controlada de archivos institucionales.

Permite a usuarios autorizados:

- Gestionar carpetas y archivos personales o compartidos por categoría.
- Generar enlaces públicos o temporales con control de visitas y expiración.
- Administrar usuarios, roles, permisos y categorías desde un panel de administración.

---

## 2. Objetivos

| Objetivo | Descripción |
|----------|-------------|
| Centralización | Un único repositorio de archivos accesible vía web |
| Seguridad | Autenticación JWT, roles granulares y soft delete |
| Trazabilidad | Registro de metadatos en SQL Server (`DB_NAS`) |
| Compartición | Enlaces con token, carpetas compartidas y visibilidad por categoría |
| Escalabilidad | Almacenamiento en disco con estructura por fecha (`AÑO/MES/DÍA`) |
| Integración | Convivencia con **BDJUNTOS** (ConectaJuntos) para identidad institucional |

---

## 3. Usuarios del sistema

| Perfil | Descripción | Acceso principal |
|--------|-------------|------------------|
| **USER** | Usuario estándar | Dashboard: subir, listar, descargar, mover y enlazar sus archivos |
| **POWER_USER** | Usuario avanzado | Igual que USER + compartir carpetas |
| **MODERATOR** | Moderador | Revisión y acciones sobre contenido reportado |
| **ADMIN** | Administrador NAS | Panel `/admin`: usuarios, roles, permisos, categorías |
| **API_CLIENT** | Cliente de integración | Consumo programático de la API (futuro / integraciones) |
| **SYSTEM** | Procesos internos | Jobs automáticos (limpieza temporal, tareas batch) |

---

## 4. Alcance funcional

### Dentro del alcance

- Login con email y contraseña (usuarios en `NASTM_USUARIOS`).
- CRUD de archivos y carpetas con soft delete (`FE_BAJA`).
- Subida con etapa temporal (~1 min) y promoción automática a almacenamiento permanente.
- Enlaces permanentes o temporales (`NASTM_ENLACES`) con acceso público vía `/v/:token`.
- Gestión de roles, permisos y categorías de usuario.
- Visibilidad cruzada entre usuarios de la misma categoría (salvo usuarios privados).
- Panel de administración web (React).
- API REST JSON bajo prefijo `/api/*`.

### Fuera del alcance (versión actual)

- Aplicación móvil nativa (solo frontend web responsive).
- Sincronización offline de archivos.
- Antivirus en tiempo real sobre cada upload.
- Replicación multi-región del almacenamiento en disco.
- Firma digital de documentos.

---

## 5. Componentes del proyecto

```
PJ_Almacenamiento/
├── backend/          ← API Node.js (este repositorio nasback)
├── frontend/         ← SPA React + Vite
├── storage/          ← Archivos permanentes en disco
└── backend/scripts/  ← Scripts SQL de referencia
```

---

## 6. Beneficios para Juntos

- Reduce dependencia de servicios externos de almacenamiento para documentos operativos.
- Alinea permisos con la estructura organizacional (categorías / UOP).
- Facilita compartir evidencias, informes y adjuntos mediante enlaces controlados.
- Base extensible para integrar otros módulos de ConectaJuntos vía API.

---

## 7. Glosario

| Término | Significado |
|---------|-------------|
| NAS | Módulo de almacenamiento en red del proyecto |
| DB_NAS | Base SQL Server del módulo almacenamiento |
| BDJUNTOS | Base ConectaJuntos (identidad / intranet, lectura) |
| Soft delete | Baja lógica con `FE_BAJA`; el registro no se elimina físicamente |
| Enlace temporal | Token con fecha de expiración y/o límite de visitas |
| Categoría | Agrupación organizacional (UOP, área, etc.) que define visibilidad |
