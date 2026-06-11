# 05 — Prototipos de sistema

Wireframes en ASCII (sin capturas). Referencia visual para entregables de diseño funcional.

---

## 1. Mapa de pantallas

```
/login                    → Login (público)
/                         → Dashboard (privado)
/admin                    → Administración (privado, ADMIN)
/v/:token                 → Vista/descarga pública por enlace
```

---

## 2. Login (`/login`)

```
┌─────────────────────────────────────────────────────────────┐
│  [ fondo gradiente azul + partículas animadas ]             │
│                                                             │
│         ┌───────────────────────────────┐                   │
│         │      [ LOGO JUNTOS ]          │                   │
│         │                               │                   │
│         │     Iniciar Sesión            │                   │
│         │  Accede a tu almacenamiento   │                   │
│         │                               │                   │
│         │  Email    [________________]  │                   │
│         │  Clave    [________________]  │                   │
│         │                               │                   │
│         │  [    Iniciar Sesión      ]   │                   │
│         └───────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Dashboard (`/`)

```
┌─────────────────────────────────────────────────────────────┐
│ Buenos días, Juan Pérez                          [🔍] [⎋]  │
│ [ROL: USER]                                                 │
├─────────────────────────────────────────────────────────────┤
│ Almacenamiento: ████████░░  780 MB / 1 GB                   │
├──────────────┬──────────────────────────────────────────────┤
│ CARPETAS     │  📁 Documentos 2026                          │
│              │  📁 Evidencias                                 │
│  ▶ Raíz      │  ─────────────────────────────────────────   │
│    Documentos│  Nombre          Tamaño    Fecha    Acciones│
│    Evidencias│  informe.pdf     2.1 MB    11/06    ⋮       │
│              │  foto.jpg        890 KB    10/06    ⋮       │
│ [+ Carpeta]  │                                              │
│              │  [ Arrastrar archivos aquí — Dropzone ]      │
└──────────────┴──────────────────────────────────────────────┘

Menú acciones (⋮): Descargar | Renombrar | Mover | Crear enlace | Eliminar
```

---

## 4. Modal — Crear enlace

```
┌─────────────────────────────────────┐
│  Crear enlace para: informe.pdf     │
├─────────────────────────────────────┤
│  ○ Permanente                       │
│  ● Temporal                         │
│                                     │
│  Expira:  [ 2026-06-18 ]            │
│  Máx. visitas: [ 10 ]  (opcional)  │
│                                     │
│  [ Cancelar ]  [ Generar enlace ]   │
└─────────────────────────────────────┘

Resultado: https://nas.juntos.gob.pe/v/a1b2c3d4...
```

---

## 5. Vista pública enlace (`/v/:token`)

```
┌─────────────────────────────────────────────────────────────┐
│  informe.pdf                          [ Descargar ]         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              ┌─────────────────────────┐                    │
│              │   PREVIEW PDF / IMG     │                    │
│              │   (iframe / img / video)│                    │
│              └─────────────────────────┘                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Estados alternos:
  • Cargando… (spinner)
  • Error 410 — enlace expirado o revocado
  • Descarga automática (tipos no previewables)
```

---

## 6. Administración (`/admin`)

```
┌─────────────────────────────────────────────────────────────┐
│  Administración NAS                            [ Cerrar ⎋ ] │
├─────────────────────────────────────────────────────────────┤
│  [ Usuarios ]  [ Roles ]  [ Permisos ]                      │
├─────────────────────────────────────────────────────────────┤
│  USUARIOS                                                   │
│  ┌─────────┬──────────────────┬────────┬────────┐         │
│  │ Nombre  │ Email            │ Rol    │ Cat.   │         │
│  ├─────────┼──────────────────┼────────┼────────┤         │
│  │ Admin   │ admin@...        │ ADMIN  │ Todas  │ [Edit]  │
│  │ María   │ maria@...        │ USER   │ UOP-LIM│ [Edit]  │
│  └─────────┴──────────────────┴────────┴────────┘         │
│  [ + Nuevo usuario ]                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Matriz de permisos (Admin — Roles)

```
┌──────────────────────────────────────────────────────────────┐
│ Rol: [ POWER_USER ▼ ]                                        │
├──────────────────────────────────────────────────────────────┤
│ Permiso              │ USER │ PWR │ MOD │ ADM │ SYS        │
│ file.upload          │  ✓   │  ✓  │  ✓  │  ✓  │  ✓         │
│ folder.share         │      │  ✓  │     │  ✓  │  ✓         │
│ admin.manage_users   │      │     │     │  ✓  │  ✓         │
│ system.tasks         │      │     │     │     │  ✓         │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. Flujo de navegación (mapa)

```
                    ┌─────────┐
                    │ /login  │
                    └────┬────┘
                         │ OK
                         ▼
              ┌──────────────────┐
         ┌───►│   Dashboard /    │◄───┐
         │    └────────┬─────────┘    │
         │             │ admin        │
         │             ▼              │
         │    ┌──────────────────┐    │
         │    │    /admin        │────┘
         │    └──────────────────┘
         │
    enlace externo
         │
         ▼
    ┌─────────────┐
    │ /v/:token   │  (sin login)
    └─────────────┘
```

---

## 9. Responsive (mobile)

```
┌──────────────────┐
│ Buenos días      │
│ Juan      [⎋]    │
├──────────────────┤
│ ████░░ 78%       │
├──────────────────┤
│ 📁 Carpetas ▼    │
├──────────────────┤
│ 📄 informe.pdf   │
│ 📄 foto.jpg      │
├──────────────────┤
│ [ + Subir ]      │
└──────────────────┘
```

Sidebar de carpetas colapsable en viewport &lt; 640px.
