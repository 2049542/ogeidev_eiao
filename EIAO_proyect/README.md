# EIAO Backend — Sistema de Gestión Interna

> Backend + frontend del sistema interno de la **Escuela Industrial Álvaro Obregón (EIAO)** de la **Universidad Autónoma de Nuevo León (UANL)**, Monterrey, N.L.
>
> Desarrollado por **Diego** como proyecto de **Servicio Social**.

---

> 🎓 **¿Vas a evaluar/correr el proyecto en local por primera vez?** Ve directo a [`SETUP_PARA_TUTOR.md`](./SETUP_PARA_TUTOR.md) — guía paso a paso con cada variable de entorno explicada y de dónde sacarla.

---

## Descripción

Este sistema centraliza la gestión interna de la EIAO en módulos especializados por área:

| Módulo | Descripción |
|---|---|
| **Autenticación** | Registro con correo institucional, aprobación por Admin, JWT |
| **Auditorio** | Reservaciones con flujo de aprobación |
| **Avisos / Becas** | Publicación de flyers e infografías con "me gusta" |
| **Seguridad / CCTV** | Solicitudes de grabación y reportes de incidentes |
| **Mantenimiento** | Órdenes correctivas con historial de seguimiento |
| **Inventario** | Registro detallado de equipo de cómputo |
| **Centro de Ayuda** | Tickets internos y redirección a soporte UANL central |
| **Tickets** | Sistema general de soporte técnico (CCTV, AV, etc.) |
| **Usuarios** | Gestión de cuentas y roles (solo Admin) |

---

## Stack tecnológico

- **Runtime:** Node.js >= 18 (Express 4)
- **ORM:** Prisma 5 + PostgreSQL (Supabase)
- **Auth:** JWT (access + refresh token) + bcrypt
- **Correos:** Resend
- **Imágenes:** Cloudinary v2
- **Seguridad:** Helmet, CORS, express-rate-limit
- **Frontend:** HTML/CSS/JS vanilla, sin build step ni framework — servido como estático desde el mismo proceso Express (`public/proyecto.html` + `public/ui.js`)

## Arquitectura

```
EIAO_proyect/
├── api/
│   └── index.js               # Punto de entrada serverless para Vercel (envuelve src/app.js)
├── src/
│   ├── app.js                 # Servidor Express principal
│   ├── routes/                # Definición de endpoints por módulo
│   ├── controllers/           # Lógica de negocio por módulo
│   ├── middleware/
│   │   ├── auth.middleware.js    # Verificación JWT
│   │   ├── roles.middleware.js   # Control de acceso por rol (RBAC)
│   │   └── upload.middleware.js  # Multer para subida de imágenes
│   └── services/
│       ├── email.service.js      # Envío de correos con Resend
│       └── cloudinary.service.js # Subida de imágenes a Cloudinary
├── prisma/
│   ├── schema.prisma           # Modelos de base de datos
│   └── seed.js                 # Datos iniciales de desarrollo
├── public/
│   ├── proyecto.html           # Frontend (SPA vanilla)
│   ├── ui.js                   # Lógica del frontend
│   └── logoEIAO.png
├── .env.example                 # Plantilla de variables de entorno
├── vercel.json                  # Config de deploy en Vercel
└── package.json
```

Localmente, `src/app.js` levanta un servidor Express normal con `app.listen()`. En Vercel, `api/index.js` importa ese mismo `app` (sin `.listen()`) y lo expone como función serverless — es el mismo código de aplicación en ambos casos.

---

## Correr en local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales reales (ver sección [Variables de Entorno](#variables-de-entorno)).

### 3. Configurar la base de datos

```bash
npm run db:push    # Aplica el schema de Prisma a Supabase
npm run db:seed     # Carga datos iniciales (cuenta maestra, usuarios de prueba, inventario)
```

### 4. Levantar el servidor

```bash
npm run dev          # Con hot-reload (nodemon)
# o
npm start            # Modo producción local
```

El servidor inicia en `http://localhost:3000`. Verifica que responde:

```bash
curl http://localhost:3000/api/health
```

Y abre `http://localhost:3000` en el navegador para ver el frontend.

---

## Variables de entorno

| Variable | Descripción | Dónde obtenerla |
|---|---|---|
| `DATABASE_URL` | Connection string de Supabase (pooler, puerto 6543) — usada en runtime por Prisma Client | Supabase > Settings > Database > Connection string > "Transaction" |
| `DIRECT_URL` | Connection string directa (puerto 5432) — usada solo para `db push`/migraciones | Supabase > Settings > Database > Connection string > "Direct" |
| `JWT_SECRET` | Clave secreta para firmar tokens de acceso | Generar con `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN` | Duración del access token (ej. `24h`) | — |
| `JWT_REFRESH_SECRET` | Clave para refresh tokens (cookie httpOnly) | Igual que `JWT_SECRET` pero con valor distinto |
| `JWT_REFRESH_EXPIRES_IN` | Duración del refresh token (ej. `7d`) | — |
| `FRONTEND_URL` | Origen(es) permitido(s) por CORS, separados por coma | Tu dominio de producción / `http://localhost:5500` en dev |
| `RESEND_API_KEY` | API Key de Resend para envío de correos | resend.com > API Keys |
| `EMAIL_FROM` | Dirección remitente verificada en Resend | Resend > Domains |
| `CLOUDINARY_CLOUD_NAME` | Nombre del cloud de Cloudinary | Cloudinary > Dashboard |
| `CLOUDINARY_API_KEY` | API Key de Cloudinary | Cloudinary > Dashboard |
| `CLOUDINARY_API_SECRET` | API Secret de Cloudinary | Cloudinary > Dashboard |
| `PORT` | Puerto del servidor en local (default: `3000`) | Solo aplica en local; Vercel no lo usa |
| `NODE_ENV` | `development` o `production` | — |

El servidor valida al arrancar que existan `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY` y las 3 variables de Cloudinary — si falta alguna, no levanta (ver `src/app.js`).

---

## Deploy en Vercel

El repo ya incluye un `vercel.json` configurado: expone `api/index.js` como función serverless para todas las rutas `/api/*` y sirve `public/` como estático (incluyendo el rewrite de `/` → `/proyecto.html`).

### Pasos

1. En el dashboard de Vercel, crea un nuevo proyecto e importa este repositorio.
2. **Root Directory**: selecciona la carpeta `EIAO_proyect` (no la raíz del repo).
3. **Framework Preset**: "Other" — no hay framework de frontend que detectar.
4. Agrega en **Settings > Environment Variables** todas las variables listadas arriba, tanto para *Production* como para *Preview*.
5. En `FRONTEND_URL`, usa el dominio final de Vercel (ej. `https://tu-proyecto.vercel.app`). El código también acepta automáticamente cualquier origen `*.vercel.app` como fallback (ver CORS abajo), así que los deploys de preview funcionan sin configuración extra.
6. Al hacer deploy, el script `postinstall` corre `prisma generate` automáticamente — no necesitas configurar un build command manual.
7. Si el schema de Prisma no está aún aplicado en la base de producción, corre `npm run db:push` apuntando a la `DATABASE_URL` de producción (Vercel no ejecuta esto automáticamente en cada deploy).
8. Verifica el deploy visitando `https://tu-proyecto.vercel.app/api/health` y la raíz `/` (debe cargar `proyecto.html`).

---

## Notas sobre CORS y `FRONTEND_URL`

La configuración de CORS vive en `src/app.js` y permite:

- Cualquier origen listado en `FRONTEND_URL` (separados por coma si son varios).
- `http://localhost:3000`, `http://localhost:5500` y `http://127.0.0.1:5500` para desarrollo local.
- Peticiones sin header `Origin` (curl, Postman) o con `Origin: null` (abrir el HTML directo con `file://`).
- Cualquier subdominio de `*.vercel.app` automáticamente, para que los deploy previews de Vercel funcionen sin tener que agregar cada URL a `FRONTEND_URL` manualmente.

Si agregas un dominio propio (no `*.vercel.app`), debes incluirlo explícitamente en `FRONTEND_URL`.

---

## Documentación de Endpoints

### AUTH

| Método | Ruta | Body | Roles | Descripción |
|---|---|---|---|---|
| POST | `/api/auth/register` | `{nombre, email, password}` | Público | Registrar cuenta (queda pendiente de aprobación) |
| POST | `/api/auth/login` | `{email, password}` | Público | Iniciar sesión → JWT |
| GET | `/api/auth/me` | — | Todos | Datos del usuario actual |
| POST | `/api/auth/logout` | — | Todos | Cerrar sesión |

### USUARIOS (solo Admin)

| Método | Ruta | Body | Descripción |
|---|---|---|---|
| GET | `/api/usuarios` | — | Listar usuarios. Query: `?pendiente=true`, `?rol=...` |
| PATCH | `/api/usuarios/:id/aprobar` | — | Aprobar cuenta + correo de bienvenida |
| PATCH | `/api/usuarios/:id/rol` | `{roles}` | Cambiar rol(es) del usuario |
| DELETE | `/api/usuarios/:id` | — | Desactivar cuenta (soft delete) |

### TICKETS

| Método | Ruta | Body | Descripción |
|---|---|---|---|
| GET | `/api/tickets` | — | Lista según rol (filtrado automático) |
| POST | `/api/tickets` | `{titulo, descripcion, area, tipo, prioridad?, slaHoras?}` | Crear ticket |
| GET | `/api/tickets/:id` | — | Detalle con comentarios |
| PATCH | `/api/tickets/:id/status` | `{status, seguimiento?}` | Cambiar estado |
| POST | `/api/tickets/:id/comentarios` | `{texto}` | Agregar comentario |

### AUDITORIO

| Método | Ruta | Body | Descripción |
|---|---|---|---|
| GET | `/api/auditorio/reservaciones` | — | Admin/Auditorio ven todas; demás solo aprobadas |
| POST | `/api/auditorio/reservaciones` | `{evento, fecha, horaInicio, horaFin, asistentes, equipo?, notas?}` | Crear solicitud (queda PENDIENTE) |
| PATCH | `/api/auditorio/reservaciones/:id/aprobar` | — | Aprobar → aparece en calendario + correo |
| PATCH | `/api/auditorio/reservaciones/:id/rechazar` | `{motivoRechazo?}` | Rechazar + correo con motivo |

### AVISOS / BECAS

| Método | Ruta | Body | Descripción |
|---|---|---|---|
| GET | `/api/becas` | — | Listar publicaciones |
| POST | `/api/becas` | `multipart/form-data: {titulo, descripcion, imagen}` | Publicar + subir imagen a Cloudinary + notificar |
| DELETE | `/api/becas/:id` | — | Eliminar de BD y Cloudinary |

### SEGURIDAD / CCTV

| Método | Ruta | Body | Descripción |
|---|---|---|---|
| POST | `/api/seguridad/grabaciones` | `{motivo, zona, fecha, horaInicio, horaFin, ...}` | Solicitar grabación + correo de confirmación |
| GET | `/api/seguridad/grabaciones` | — | Admin/Soporte ven todas; demás solo propias |
| PATCH | `/api/seguridad/grabaciones/:id/status` | `{status}` | Actualizar estado |
| POST | `/api/seguridad/incidentes` | `{tipo, fecha, hora, lugar, descripcion, anonimo?}` | Reportar incidente (puede ser anónimo) |
| GET | `/api/seguridad/incidentes` | — | Admin ve todos; demás solo propios |

### MANTENIMIENTO

| Método | Ruta | Body | Descripción |
|---|---|---|---|
| GET | `/api/mantenimiento` | — | Listar órdenes |
| POST | `/api/mantenimiento` | `{titulo, descripcion, ubicacion, prioridad?}` | Crear orden correctiva |
| GET | `/api/mantenimiento/:id` | — | Detalle + historial completo |
| PATCH | `/api/mantenimiento/:id/status` | `{status, comentario?, tecnicoId?}` | Actualizar estado + registra en historial |

### INVENTARIO

| Método | Ruta | Body | Descripción |
|---|---|---|---|
| GET | `/api/inventario` | — | Listar inventario |
| POST | `/api/inventario` | Campos del equipo (departamento, tipoEquipo, etc.) | Agregar equipo |
| PATCH | `/api/inventario/:id` | Campos a actualizar | Actualizar equipo |
| DELETE | `/api/inventario/:id` | — | Eliminar registro |

### CENTRO DE AYUDA

| Método | Ruta | Body | Descripción |
|---|---|---|---|
| GET | `/api/centroayuda/tickets` | — | Listar tickets de ayuda |
| POST | `/api/centroayuda/tickets` | `{titulo, descripcion, tipo}` | Crear ticket |
| PATCH | `/api/centroayuda/tickets/:id/status` | `{status, seguimiento?}` | Resolver ticket + notificación |

---

## Modelos de base de datos

| Modelo | Descripción |
|---|---|
| `User` | Usuarios del sistema con roles (array) y estado de aprobación |
| `Ticket` | Tickets de soporte técnico |
| `Comentario` | Historial de comentarios en tickets |
| `EncuestaSatisfaccion` | Encuesta post-resolución de ticket |
| `Reservacion` | Solicitudes de uso del auditorio |
| `BecaPublicacion` | Avisos/flyers, con "me gusta" |
| `AvisoLike` | Registro de "me gusta" por usuario |
| `SolicitudGrabacion` | Solicitudes de grabación CCTV |
| `ReporteIncidente` | Reportes de seguridad (pueden ser anónimos) |
| `Inventario` | Registro detallado de equipo de cómputo |
| `MantenimientoCorrectivo` | Órdenes de trabajo correctivo |
| `HistorialMantenimiento` | Log de cambios de estado en órdenes de mantenimiento |
| `SolucionRapida` | Base de conocimiento de autoservicio |

---

## Roles del sistema

Definidos en el enum `Rol` de `prisma/schema.prisma`: `Administrador`, `Avisos`, `SoporteTecnico`, `Auditorio`, `Mantenimiento`, `Tecnico`, `CentroDeAyuda`, `ServicioSocial`, `DocenteAdministrativo`. Un usuario puede tener más de un rol asignado.

---

## Scripts disponibles

```bash
npm run dev          # Servidor en desarrollo con hot-reload (nodemon)
npm start            # Servidor en modo producción (local)
npm run build         # prisma generate (se corre también automático en postinstall)
npm run db:push        # Aplicar el schema de Prisma a la base de datos (sin migraciones)
npm run db:seed         # Cargar datos iniciales (cuenta maestra, usuarios de prueba, inventario)
npm run db:studio        # Abrir Prisma Studio (GUI de la BD)
npm run db:reset          # Reset total de la BD + re-seed
```

---

## Formato de respuestas

Todas las rutas siguen el mismo formato JSON:

```json
{
  "success": true | false,
  "message": "Descripción del resultado",
  "data": { ... }
}
```

---

## Créditos

**Desarrollado por:** Diego ([OgeidDev](https://www.linkedin.com/in/diegocabreraaguilar))
**Institución:** Escuela Industrial Álvaro Obregón (EIAO) — UANL
**Contexto:** Proyecto de Servicio Social
**Ciudad:** Monterrey, Nuevo León, México

*Este sistema fue desarrollado con fines educativos y de servicio social para modernizar la gestión interna de la EIAO UANL.*
