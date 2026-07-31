# 🚀 Guía de Despliegue — Sistema Interno EIAO (Vercel + Render)

Esta guía detalla paso a paso el proceso de despliegue en producción del sistema interno de la **Escuela Industrial y Preparatoria Técnica Álvaro Obregón (EIAO) UANL**.

---

## 🏗️ Arquitectura de Producción

- **Frontend Estático**: Se despliega en **Vercel** (`proyecto.html`, `ui.js`, `logoEIAO.png`).
- **Backend Node.js/Express**: Se despliega en **Render** (servicio Web Service conectado a PostgreSQL en Supabase y Cloudinary).
- **Base de Datos**: PostgreSQL alojado en **Supabase**.

---

## FASE 1: Despliegue del Backend en Render

1. **Crear cuenta / Iniciar sesión en Render**
   - Accede a [https://render.com](https://render.com) e inicia sesión con GitHub o email.

2. **Crear un nuevo Web Service**
   - Haz clic en **New +** → **Web Service**.
   - Conecta el repositorio de Git que contiene la carpeta `EIAO_proyect`.
   - Si el repo tiene la carpeta en la raíz o subcarpeta, especifica:
     - **Root Directory**: `EIAO_proyect` (o `./` si es la raíz del repo).
     - **Environment**: `Node`
     - **Build Command**: `npm install && npx prisma generate`
     - **Start Command**: `node src/app.js`

3. **Configurar Variables de Entorno (Environment Variables) en Render**
   Copia los siguientes nombres y valores de tu archivo `.env` al panel de Render (**Environment Variables**):

   | Variable | Valor / Ejemplo |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` *(Render asigna `PORT` dinámicamente, tu código ya usa `process.env.PORT`)* |
   | `DATABASE_URL` | `postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true` |
   | `DIRECT_URL` | `postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres` |
   | `JWT_SECRET` | *(Clave secreta segura)* |
   | `JWT_EXPIRES_IN` | `24h` |
   | `JWT_REFRESH_SECRET` | *(Clave secreta de refresh)* |
   | `JWT_REFRESH_EXPIRES_IN` | `7d` |
   | `FRONTEND_URL` | `https://tu-proyecto.vercel.app` *(Tu URL de Vercel)* |
   | `RESEND_API_KEY` | `re_...` |
   | `EMAIL_FROM` | `EIAO Sistema <onboarding@resend.dev>` *(el código lee `EMAIL_FROM`, no `RESEND_FROM`)* |
   | `CLOUDINARY_CLOUD_NAME` | *(cópialo de tu `.env`)* |
   | `CLOUDINARY_API_KEY` | *(cópialo de tu `.env`)* |
   | `CLOUDINARY_API_SECRET` | *(cópialo de tu `.env`, nunca lo compartas públicamente)* |
   | `SUPABASE_URL` | *(opcional — el código actual no la usa, solo por si se agrega el cliente de Supabase a futuro)* |
   | `SUPABASE_KEY` | *(opcional — mismo caso que `SUPABASE_URL`)* |

4. **Desplegar y obtener la URL del Backend**
   - Haz clic en **Create Web Service**.
   - Una vez finalizado el build, Render generará una URL pública similar a:
     `https://eiao-backend.onrender.com`
   - Prueba la salud de la API abriendo en tu navegador:
     `https://eiao-backend.onrender.com/api/health`

---

## FASE 2: Despliegue del Frontend en Vercel

1. **Crear cuenta / Iniciar sesión en Vercel**
   - Accede a [https://vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub.

2. **Importar Proyecto**
   - Haz clic en **Add New...** → **Project**.
   - Selecciona el repositorio de GitHub.
   - En la configuración del proyecto:
     - **Framework Preset**: `Other`
     - **Root Directory**: `./` (raíz del proyecto)
   - El archivo `vercel.json` incluido en la raíz redirigirá automáticamente el tráfico de `/` a `/proyecto.html`.

3. **Haz clic en Deploy**
   - Vercel compilará y generará la URL pública del frontend, por ejemplo:
     `https://eiao-sistema.vercel.app`

---

## FASE 3: Enlazar Frontend y Backend (Paso Final)

1. **Actualizar `API_URL` en `proyecto.html`**
   Abre `proyecto.html` y actualiza la constante `API_URL` reemplazando la URL placeholder con tu URL real de Render:

   ```javascript
   const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
     ? 'http://localhost:3000/api'
     : 'https://eiao-backend.onrender.com/api'; // Reemplazar con la URL real de Render
   ```

2. **Actualizar `FRONTEND_URL` en Render**
   - Ve a Render → Tu servicio → **Environment**.
   - Actualiza `FRONTEND_URL` con la URL asignada por Vercel:
     `https://eiao-sistema.vercel.app`
   - Guarda los cambios (Render reiniciará automáticamente el backend con la nueva configuración de CORS).

3. **¡Listo!** El sistema está 100% operativo en producción.
