# 🎓 Guía de Instalación — Para el Tutor / Evaluador

> Esta guía es específica para quien va a **revisar y correr el proyecto en local** (tutor de servicio social). Para documentación técnica completa (endpoints, arquitectura, deploy) ver [`README.md`](./README.md).

El proyecto **no incluye credenciales propias** — el `.env` con las claves reales de Diego nunca se subió a GitHub (está en `.gitignore`, ver sección de seguridad más abajo). Para correrlo necesitas crear tus propias cuentas gratuitas en Supabase, Cloudinary y Resend y generar tu propio `.env`. Toma unos 10-15 minutos la primera vez.

---

## 1. Qué clonar y de dónde

Repositorio: **https://github.com/2049542/ogeidev_eiao.git**

```bash
git clone https://github.com/2049542/ogeidev_eiao.git
cd ogeidev_eiao/EIAO_proyect
```

Todos los comandos de las siguientes secciones se corren **dentro de `EIAO_proyect/`**, que es donde vive el `package.json`. Todo lo que necesita el proyecto (backend, frontend, schema de Prisma y el CSV de inventario inicial) vive dentro de esta carpeta — no depende de nada fuera de ella.

---

## 2. Instalar dependencias

```bash
npm install
```

Esto corre automáticamente `prisma generate` (hook `postinstall`), así que no necesitas correrlo aparte. Verificado sin errores ni warnings críticos al momento de entregar el proyecto (solo 2 vulnerabilidades menores de dependencias transitivas de npm, informativas — no bloquean nada, corregibles con `npm audit fix` si se desea).

---

## 3. Crear tu propio `.env`

```bash
cp .env.example .env
```

Luego edita `.env` y rellena cada variable:

| Variable | Qué es | Dónde sacarla |
|---|---|---|
| `DATABASE_URL` | Connection string de Postgres (pooler, puerto 6543) que usa Prisma en runtime | Crea un proyecto gratis en [supabase.com](https://supabase.com) → **Settings → Database → Connection string → modo "Transaction"** |
| `DIRECT_URL` | Connection string directa (puerto 5432), solo para `db push` | Mismo lugar, pero modo **"Session"/directo** en vez de pooler |
| `JWT_SECRET` | Clave para firmar tokens de acceso | Genera una aleatoria: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN` | Duración del token de acceso | Usa `24h` (valor por defecto) |
| `JWT_REFRESH_SECRET` | Clave para el refresh token (cookie httpOnly) | Genera otra distinta con el mismo comando de arriba |
| `JWT_REFRESH_EXPIRES_IN` | Duración del refresh token | Usa `7d` (valor por defecto) |
| `PORT` | Puerto del servidor en local | Usa `3000` (valor por defecto) |
| `NODE_ENV` | Ambiente | Usa `development` |
| `FRONTEND_URL` | Origen permitido por CORS | En local, usa `http://localhost:3000` (el mismo backend sirve el frontend, ver sección 4) |
| `RESEND_API_KEY` | API key para envío de correos (aprobaciones, notificaciones) | Crea cuenta gratis en [resend.com](https://resend.com) → **API Keys** |
| `EMAIL_FROM` | Remitente de los correos | Usa `EIAO Sistema <onboarding@resend.dev>` — es el dominio de pruebas de Resend, no requiere verificación de dominio propio |
| `CLOUDINARY_CLOUD_NAME` | Nombre de tu cloud de Cloudinary | Crea cuenta gratis en [cloudinary.com](https://cloudinary.com) → **Dashboard** |
| `CLOUDINARY_API_KEY` | API key de Cloudinary | Mismo Dashboard |
| `CLOUDINARY_API_SECRET` | API secret de Cloudinary | Mismo Dashboard |

El servidor **valida al arrancar** que existan `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY` y las 3 de Cloudinary — si falta alguna, se detiene con un mensaje claro indicando cuál falta, en vez de fallar de forma confusa más adelante.

`SUPABASE_URL`/`SUPABASE_KEY` aparecen en `.env.example` pero **no las usa el código actual** (el proyecto habla con Postgres directo vía Prisma, no usa el cliente `@supabase/supabase-js`) — puedes dejarlas vacías o no ponerlas.

---

## 4. Levantar el servidor en local

```bash
npm run dev      # con hot-reload (nodemon) — recomendado para revisar
# o
npm start        # modo producción local, sin hot-reload
```

El servidor arranca en **`http://localhost:3000`**. El mismo proceso Express sirve tanto la API (`/api/...`) como el frontend estático (`proyecto.html`, `ui.js`) — no hace falta levantar nada aparte para el frontend.

Verifica que responde:

```bash
curl http://localhost:3000/api/health
```

Y abre `http://localhost:3000` en el navegador para ver el sistema completo.

---

## 5. Cargar datos de prueba (seed)

```bash
npm run db:push    # aplica el schema de Prisma a tu base de Supabase (crea las tablas)
npm run db:seed    # carga cuenta maestra, un usuario de prueba por rol, e inventario/tickets/reservaciones de ejemplo
```

`db:seed` usa `upsert`, así que se puede correr varias veces sin duplicar datos ni errores.

**Credenciales que crea el seed:** ver [`TEST_CREDENTIALS.csv`](./TEST_CREDENTIALS.csv) — incluye las 10 cuentas (admin + un usuario por rol + una cuenta pendiente de aprobación) con email, password, rol y descripción de qué puede hacer cada una. Ya no aparecen visibles en la pantalla de login (se quitaron de la UI por seguridad); este CSV es la referencia para pruebas locales.

Si quieres reiniciar todo desde cero: `npm run db:reset` (hace `db push --force-reset` + re-seed).

---

## 6. Notas sobre la base de datos

- **Motor:** PostgreSQL alojado en Supabase (plan gratuito es suficiente para evaluar el proyecto).
- **Prisma en modo "push", no "migrate":** el repo **no tiene carpeta `prisma/migrations/`** a propósito — el schema se aplica directo a la base con `prisma db push` en vez de un historial de migraciones versionadas. Es una decisión válida para un proyecto de este tamaño/etapa (servicio social, un solo entorno de base de datos), no un descuido. Si en el futuro el proyecto crece o pasa a tener varios entornos, sería el momento de migrar a `prisma migrate`.
- El schema (`prisma/schema.prisma`) fue validado con `npx prisma validate` antes de la entrega — sin errores.

---

## 7. Seguridad — qué verificar tú mismo si quieres confirmarlo

- El archivo `.env` real de Diego **nunca se subió a GitHub** — solo existe `.env.example` con valores de ejemplo (`git log --all --full-history -- .env` no devuelve nada).
- `.gitignore` excluye `.env`, `.env.local`, `.env.production`, `.env.*.local`.
- El código nunca tiene credenciales hardcodeadas — todas las claves se leen de `process.env.*`.

---

## 8. Resumen rápido

```bash
git clone https://github.com/2049542/ogeidev_eiao.git
cd ogeidev_eiao/EIAO_proyect
npm install
cp .env.example .env        # y rellenar con tus propias credenciales
npm run db:push
npm run db:seed
npm run dev
# abrir http://localhost:3000
```
