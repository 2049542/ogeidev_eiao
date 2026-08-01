# EIAO Backend — Sistema de Gestión Interna

> Backend REST API para el sistema interno de la **Escuela Industrial Álvaro Obregón (EIAO)** de la **Universidad Autónoma de Nuevo León (UANL)**, Monterrey, N.L.
>
> Desarrollado por **Diego** como proyecto de **Servicio Social**.

---

## Descripción

Este sistema centraliza la gestión interna de la EIAO en módulos especializados por área:

| Módulo | Descripción |
|---|---|
| **Autenticación** | Registro con @uanl.edu.mx, aprobación por Admin, JWT |
| **Auditorio** | Reservaciones con flujo de aprobación |
| **Becas** | Publicación de flyers con notificación masiva por correo |
| **Seguridad / CCTV** | Solicitudes de grabación y reportes de incidentes |
| **Mantenimiento** | Órdenes correctivas con historial de seguimiento |
| **Inventario** | Catálogo de equipos y materiales |
| **Centro de Ayuda** | Tickets internos y redirección a soporte UANL central |
| **Tickets** | Sistema general de soporte técnico (CCTV, AV, etc.) |
| **Usuarios** | Gestión de cuentas y roles (solo Admin) |

---

## Arquitectura

```
eiao-backend/
├── src/
│   ├── app.js                    # Servidor Express principal
│   ├── routes/                   # Definición de endpoints por módulo
│   ├── controllers/              # Lógica de negocio por módulo
│   ├── middleware/
│   │   ├── auth.middleware.js    # Verificación JWT
│   │   ├── roles.middleware.js   # Control de acceso por rol (RBAC)
│   │   └── upload.middleware.js  # Multer para subida de imágenes
│   └── services/
│       ├── email.service.js      # Envío de correos con Resend
│       └── cloudinary.service.js # Subida de imágenes a Cloudinary
├── prisma/
│   ├── schema.prisma             # Modelos de base de datos
│   └── seed.js                   # Datos iniciales para desarrollo
├── .env.example                  # Plantilla de variables de entorno
└── package.json
```

**Stack tecnológico:**
- **Runtime:** Node.js 24
- **Framework:** Express.js 4
- **ORM:** Prisma 5 + PostgreSQL (Supabase)
- **Auth:** JWT + bcrypt
- **Correos:** Resend
- **Imágenes:** Cloudinary v2
- **Seguridad:** Helmet, CORS, express-rate-limit

---

## Requisitos Previos

- Node.js >= 18.0.0 (recomendado: 24 LTS)
- npm >= 9
- Cuenta en [Supabase](https://supabase.com) (PostgreSQL gratuito)
- Cuenta en [Resend](https://resend.com) (correos transaccionales)
- Cuenta en [Cloudinary](https://cloudinary.com) (imágenes)

---

## Instalación

### 1. Clonar e instalar dependencias

```bash
cd eiao-backend
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales reales (ver sección [Variables de Entorno](#variables-de-entorno)).

### 3. Configurar la base de datos

```bash
# Generar el cliente Prisma
npm run db:generate

# Crear las tablas en Supabase
npm run db:push

# Cargar datos iniciales (admins, usuarios de prueba, etc.)
npm run db:seed
```

### 4. Correr en desarrollo

```bash
npm run dev
```

El servidor inicia en `http://localhost:3000`

Verifica que funciona:
```bash
curl http://localhost:3000/api/health
```

---

## Variables de Entorno

| Variable | Descripción | Dónde obtenerla |
|---|---|---|
| `PORT` | Puerto del servidor (default: 3000) | — |
| `NODE_ENV` | `development` o `production` | — |
| `DATABASE_URL` | Connection string de PostgreSQL | Supabase > Settings > Database > URI |
| `JWT_SECRET` | Clave secreta para firmar tokens de acceso | Generar con `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN` | Duración del token (default: `24h`) | — |
| `JWT_REFRESH_SECRET` | Clave para refresh tokens | Igual que JWT_SECRET pero diferente valor |
| `JWT_REFRESH_EXPIRES_IN` | Duración refresh token (default: `7d`) | — |
| `FRONTEND_URL` | URL del frontend para CORS | Tu dominio o `http://localhost:5500` en dev |
| `RESEND_API_KEY` | API Key de Resend | resend.com > API Keys |
| `EMAIL_FROM` | Dirección remitente verificada | Resend > Domains |
| `CLOUDINARY_CLOUD_NAME` | Nombre de tu cloud | Cloudinary > Dashboard |
| `CLOUDINARY_API_KEY` | API Key de Cloudinary | Cloudinary > Dashboard |
| `CLOUDINARY_API_SECRET` | API Secret de Cloudinary | Cloudinary > Dashboard |

---

## Deploy en Render + Supabase

### Base de datos (Supabase)

1. Crea proyecto en [supabase.com](https://supabase.com)
2. Ve a **Settings > Database > Connection string > URI**
3. Copia la URL (formato: `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`)
4. Úsala como `DATABASE_URL` en Render

### Servidor (Render)

1. Conecta tu repositorio de GitHub a [render.com](https://render.com)
2. Crea un **Web Service** con:
   - **Build Command:** `npm install && npm run db:generate && npm run db:push`
   - **Start Command:** `npm start`
   - **Environment:** `Node`
3. Agrega todas las variables de entorno del `.env.example`
4. Cambia `NODE_ENV=production` y `FRONTEND_URL=https://tudominio.com`
5. Deploy 🚀

---

## Documentación de Endpoints

### AUTH

| Método | Ruta | Body | Roles | Descripción |
|---|---|---|---|---|
| POST | `/api/auth/register` | `{nombre, email, password}` | Público | Registrar cuenta (queda pendiente) |
| POST | `/api/auth/login` | `{email, password}` | Público | Iniciar sesión → JWT |
| GET | `/api/auth/me` | — | Todos | Datos del usuario actual |
| POST | `/api/auth/logout` | — | Todos | Cerrar sesión |

**Respuesta de login:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "usuario": { "id": "...", "nombre": "...", "email": "...", "rol": "USUARIO" }
  }
}
```

### USUARIOS (solo Admin)

| Método | Ruta | Body | Descripción |
|---|---|---|---|
| GET | `/api/usuarios` | — | Listar todos los usuarios. Query: `?pendiente=true`, `?rol=BECAS` |
| PATCH | `/api/usuarios/:id/aprobar` | — | Aprobar cuenta + correo de bienvenida |
| PATCH | `/api/usuarios/:id/rol` | `{rol}` | Cambiar rol del usuario |
| DELETE | `/api/usuarios/:id` | — | Desactivar cuenta (soft delete) |
| POST | `/api/usuarios/invitar` | `{email}` | Enviar invitación por correo |

### TICKETS

| Método | Ruta | Body | Roles | Descripción |
|---|---|---|---|---|
| GET | `/api/tickets` | — | Todos | Lista según rol (filtrado automático) |
| POST | `/api/tickets` | `{titulo, descripcion, area, tipo, prioridad?, slaHoras?}` | Todos | Crear ticket |
| GET | `/api/tickets/:id` | — | Todos | Detalle con comentarios |
| PATCH | `/api/tickets/:id/status` | `{status, seguimiento?}` | Admin, Soporte, dueño | Cambiar estado |
| POST | `/api/tickets/:id/comentarios` | `{texto}` | Todos | Agregar comentario |

**Status válidos:** `ABIERTO`, `EN_PROGRESO`, `PENDIENTE`, `RESUELTO`, `CERRADO`

### AUDITORIO

| Método | Ruta | Body | Roles | Descripción |
|---|---|---|---|---|
| GET | `/api/auditorio/reservaciones` | — | Todos | Admin/Auditorio: todas. Demás: solo aprobadas |
| POST | `/api/auditorio/reservaciones` | `{evento, fecha, horaInicio, horaFin, asistentes, equipo?, notas?}` | Todos | Crear solicitud (queda PENDIENTE) |
| PATCH | `/api/auditorio/reservaciones/:id/aprobar` | — | Admin | Aprobar → aparece en calendario + correo |
| PATCH | `/api/auditorio/reservaciones/:id/rechazar` | `{motivo?}` | Admin | Rechazar + correo con motivo |

### BECAS

| Método | Ruta | Body | Roles | Descripción |
|---|---|---|---|---|
| GET | `/api/becas` | — | Todos | Listar publicaciones |
| POST | `/api/becas` | `multipart/form-data: {titulo, descripcion, imagen}` | Admin, Becas | Publicar + subir imagen + notificar docentes |
| DELETE | `/api/becas/:id` | — | Admin, Becas | Eliminar de BD y Cloudinary |

**Nota:** El endpoint POST debe enviarse como `multipart/form-data` con el archivo en el campo `imagen`.

### SEGURIDAD / CCTV

| Método | Ruta | Body | Roles | Descripción |
|---|---|---|---|---|
| POST | `/api/seguridad/grabaciones` | `{motivo, zona, fecha, horaInicio, horaFin, descripcion?, personas?, urgencia?}` | Todos | Solicitar grabación + correo de confirmación |
| GET | `/api/seguridad/grabaciones` | — | Todos | Admin/Soporte: todas. Demás: propias |
| PATCH | `/api/seguridad/grabaciones/:id/status` | `{status}` | Admin, Soporte | Actualizar estado |
| POST | `/api/seguridad/incidentes` | `{tipo, fecha, hora, lugar, descripcion, contacto?, anonimo?}` | Todos | Reportar incidente (puede ser anónimo) |
| GET | `/api/seguridad/incidentes` | — | Todos | Admin: todos. Demás: propios |

### MANTENIMIENTO

| Método | Ruta | Body | Roles | Descripción |
|---|---|---|---|---|
| GET | `/api/mantenimiento` | — | Todos | Listar órdenes |
| POST | `/api/mantenimiento` | `{titulo, descripcion, ubicacion, prioridad?}` | Todos | Crear orden correctiva |
| GET | `/api/mantenimiento/:id` | — | Todos | Detalle + historial completo |
| PATCH | `/api/mantenimiento/:id/status` | `{status, comentario?, tecnicoId?}` | Admin, Mantenimiento | Actualizar estado + registra en historial |

**Status válidos:** `PENDIENTE`, `EN_PROGRESO`, `COMPLETADO`, `CANCELADO`

### INVENTARIO

| Método | Ruta | Body | Roles | Descripción |
|---|---|---|---|---|
| GET | `/api/inventario` | — | Todos | Listar inventario. Query: `?categoria=ELECTRONICO` |
| POST | `/api/inventario` | `{nombre, categoria, cantidad?, cantidadTotal?, descripcion?, ubicacion?}` | Admin, Mantenimiento | Agregar ítem |
| PATCH | `/api/inventario/:id` | Campos a actualizar | Admin, Mantenimiento | Actualizar ítem |
| DELETE | `/api/inventario/:id` | — | Admin | Eliminar ítem |

### CENTRO DE AYUDA

| Método | Ruta | Body | Roles | Descripción |
|---|---|---|---|---|
| GET | `/api/centroayuda/tickets` | — | Todos | Listar tickets de ayuda |
| POST | `/api/centroayuda/tickets` | `{titulo, descripcion, tipo}` | Todos | Crear ticket. Si tipo es SIASE/NEXUS/TEAMS redirige a UANL central |
| PATCH | `/api/centroayuda/tickets/:id/status` | `{status, seguimiento?}` | Admin, Centro de Ayuda | Resolver ticket + notificación correo |

**Tipos internos:** `CONTRASENA_INTERNA`, `RED`, `EQUIPO_PLANTEL`, `OTRO`  
**Tipos externos (→ centrodeayuda.uanl.mx):** `SIASE`, `NEXUS`, `TEAMS`, `CORREO_UANL`

---

## Modelos de Base de Datos

| Modelo | Descripción |
|---|---|
| `User` | Usuarios del sistema con rol y estado de aprobación |
| `Ticket` | Tickets de soporte técnico y centro de ayuda |
| `Comentario` | Historial de comentarios en tickets |
| `Reservacion` | Solicitudes de uso del auditorio |
| `BecaPublicacion` | Flyers e infografías de becas |
| `SolicitudGrabacion` | Solicitudes de grabación CCTV |
| `ReporteIncidente` | Reportes de seguridad (pueden ser anónimos) |
| `Inventario` | Catálogo de equipos y materiales |
| `MantenimientoCorrectivo` | Órdenes de trabajo correctivo |
| `HistorialMantenimiento` | Log de cambios de estado en órdenes |

---

## Roles y Permisos

| Rol | Módulos accesibles |
|---|---|
| `ADMINISTRADOR` | **Todo**. Aprueba cuentas, reservaciones y tiene acceso total |
| `BECAS` | Publicar y eliminar becas + ver becas |
| `SOPORTE_TECNICO` | Tickets de soporte técnico, solicitudes CCTV |
| `AUDITORIO` | Ver todas las reservaciones del auditorio |
| `MANTENIMIENTO` | Órdenes de mantenimiento + inventario (editar) |
| `CENTRO_AYUDA` | Tickets de Centro de Ayuda |
| `PRESTADOR_SERVICIO_SOCIAL` | Solo módulo de Auditorio (crear y ver aprobadas) |
| `USUARIO` (Maestro) | Becas, Centro de Ayuda, Seguridad/CCTV, Auditorio, Inventario (lectura), Mantenimiento correctivo |

---

## Scripts Disponibles

```bash
npm run dev          # Servidor en desarrollo con hot-reload (nodemon)
npm start            # Servidor en producción
npm run db:generate  # Regenerar el cliente Prisma
npm run db:push      # Aplicar cambios del schema a la BD (sin migraciones)
npm run db:migrate   # Crear migración y aplicarla (para producción)
npm run db:studio    # Abrir Prisma Studio (GUI de la BD)
npm run db:seed      # Cargar datos iniciales de desarrollo
```

---

## Formato de Respuestas

Todas las respuestas siguen el mismo formato JSON:

```json
{
  "success": true | false,
  "message": "Descripción del resultado",
  "data": { ... }
}
```

En caso de error:
```json
{
  "success": false,
  "message": "Descripción del error"
}
```

---

## Créditos

**Desarrollado por:** Diego  
**Institución:** Escuela Industrial Álvaro Obregón (EIAO) — UANL  
**Contexto:** Proyecto de Servicio Social  
**Ciudad:** Monterrey, Nuevo León, México  
**Año:** 2024

---

*Este sistema fue desarrollado con fines educativos y de servicio social para modernizar la gestión interna de la EIAO UANL.*
