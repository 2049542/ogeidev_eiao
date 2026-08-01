// ============================================================
// app.js — Punto de entrada principal del servidor Express.
//
// Aquí se configura toda la aplicación:
//   1. Middleware de seguridad (helmet, cors, rate-limit)
//   2. Parseo de JSON
//   3. Montaje de todas las rutas de la API
//   4. Manejador de errores centralizado
//   5. Inicio del servidor en el puerto configurado
// ============================================================

require('dotenv').config();

// ── VALIDACIÓN DE VARIABLES DE ENTORNO ───────────────────────
// Si falta alguna variable crítica, el servidor no debe arrancar.
const VARS_REQUERIDAS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'RESEND_API_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];
const faltantes = VARS_REQUERIDAS.filter((v) => !process.env[v]);
if (faltantes.length > 0) {
  console.error('\n❌ Faltan variables de entorno obligatorias:');
  faltantes.forEach((v) => console.error(`   - ${v}`));
  console.error('\nCopia .env.example como .env y rellena cada valor.\n');
  process.exit(1);
}

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Importar todas las rutas
const authRoutes = require('./routes/auth.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const ticketsRoutes = require('./routes/tickets.routes');
const auditorioRoutes = require('./routes/auditorio.routes');
const becasRoutes = require('./routes/becas.routes');
const seguridadRoutes = require('./routes/seguridad.routes');
const mantenimientoRoutes = require('./routes/mantenimiento.routes');
const inventarioRoutes = require('./routes/inventario.routes');
const centroayudaRoutes = require('./routes/centroayuda.routes');
const solucionesRoutes = require('./routes/soluciones.routes');

const app = express();

// ── 1. SEGURIDAD CON HELMET ───────────────────────────────────
// Helmet agrega cabeceras HTTP de seguridad automáticamente
// (previene XSS, clickjacking, sniffing de contenido, etc.)
// contentSecurityPolicy se desactiva porque proyecto.html (servido como
// estático desde /public) depende de <script> y onclick="" inline; el CSP
// por default de Helmet los bloquearía y dejaría la interfaz sin funcionar.
app.use(helmet({ contentSecurityPolicy: false }));

// ── 2. CONFIGURACIÓN DE CORS ──────────────────────────────────
// Permite solicitudes desde el frontend en desarrollo (localhost/127.0.0.1),
// producción en Vercel (*.vercel.app), file:// (Origin "null"), y cualquier
// origen configurado en process.env.FRONTEND_URL (separados por coma).
const frontendEnv = process.env.FRONTEND_URL || '';
const frontendList = frontendEnv.split(',').map((u) => u.trim()).filter(Boolean);

const ORIGENES_PERMITIDOS = [
  ...frontendList,
  'http://localhost:3000',
  'http://localhost:5500',
  'http://localhost:64263',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:64263',
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Sin header Origin (curl, Postman) o file:// (Origin "null") → permitido
    if (!origin || origin === 'null' || ORIGENES_PERMITIDOS.includes(origin)) {
      return callback(null, true);
    }
    try {
      const hostname = new URL(origin).hostname;
      if (hostname.endsWith('.vercel.app')) {
        return callback(null, true);
      }
    } catch (_) {}
    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true, // Permite enviar cookies (refresh token)
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// ── 3. RATE LIMITING ─────────────────────────────────────────
// Limita el número de peticiones para prevenir abusos y ataques DDoS

// Límite general: 100 peticiones por 15 minutos por IP
const limiterGeneral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Límite estricto para login: 10 intentos por 15 minutos (previene fuerza bruta)
const limiterLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Demasiados intentos de inicio de sesión. Intenta en 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiterGeneral);
app.use('/api/auth/login', limiterLogin);

// ── 4. PARSEO DE CUERPO DE SOLICITUD ─────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ── 5. RUTA DE SALUD (Health Check) ──────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'EIAO Backend funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    variables: 'OK',
  });
});

// ── 6. MONTAJE DE RUTAS ───────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/auditorio', auditorioRoutes);
app.use('/api/becas', becasRoutes);
app.use('/api/seguridad', seguridadRoutes);
app.use('/api/mantenimiento', mantenimientoRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/centroayuda', centroayudaRoutes);
app.use('/api/soluciones', solucionesRoutes);

// ── 6.5. FRONTEND ESTÁTICO ────────────────────────────────────
// Sirve proyecto.html, ui.js y logoEIAO.png desde /public. Permite que
// Render (u otro host que solo levante este proceso Node) sirva también
// el frontend, sin depender de un hosting estático aparte.
app.get('/', (req, res) => res.redirect('/proyecto.html'));
app.use(express.static(path.join(__dirname, '../public')));

// ── 7. RUTA 404 (si no coincide ninguna ruta) ─────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
});

// ── 8. MANEJADOR GLOBAL DE ERRORES ───────────────────────────
// Captura cualquier error que no fue manejado en los controladores.
// Express reconoce un middleware de error por tener 4 parámetros.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err);

  // Errores de validación de Prisma (registro duplicado, etc.)
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'Ya existe un registro con ese valor único.',
    });
  }

  // Error genérico del servidor
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ── 9. INICIO DEL SERVIDOR ────────────────────────────────────
// Solo se levanta un servidor con app.listen() cuando el archivo se ejecuta
// directamente (node src/app.js / nodemon). En Vercel, api/index.js importa
// `app` y lo expone como función serverless sin necesidad de escuchar un puerto.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`\n🏫 EIAO Backend corriendo en http://localhost:${PORT}`);
    console.log(`📋 Ambiente: ${process.env.NODE_ENV}`);
    console.log(`🔗 Frontend permitido: ${process.env.FRONTEND_URL}`);
    console.log(`📅 Inicio: ${new Date().toLocaleString('es-MX')}\n`);
  });
}

module.exports = app;
