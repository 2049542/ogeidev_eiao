// ============================================================
// auth.routes.js — Rutas de autenticación del sistema.
//
// Endpoints públicos (no requieren token):
//   POST /api/auth/register — Registrar nueva cuenta
//   POST /api/auth/login    — Iniciar sesión
//
// Endpoints privados (requieren token JWT):
//   GET  /api/auth/me       — Ver datos del usuario actual
//   POST /api/auth/logout   — Cerrar sesión
// ============================================================

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Registro de nueva cuenta (pública)
router.post('/register', authController.register);

// Inicio de sesión (pública — el rate limit extra está en app.js)
router.post('/login', authController.login);

// Información del usuario autenticado (requiere token)
router.get('/me', verifyToken, authController.me);

// Cerrar sesión (requiere token — para invalidar cookie de refresh)
router.post('/logout', verifyToken, authController.logout);

module.exports = router;
