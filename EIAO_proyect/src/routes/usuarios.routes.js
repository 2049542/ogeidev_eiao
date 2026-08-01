// ============================================================
// usuarios.routes.js — Gestión de cuentas de usuario.
// Solo accesible por el rol Administrador.
// ============================================================

const express = require('express');
const router  = express.Router();
const usuariosController = require('../controllers/usuarios.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { soloAdmin }   = require('../middleware/roles.middleware');

// Todas las rutas aquí requieren token + rol Administrador
router.use(verifyToken, soloAdmin);

// Listar todos los usuarios (con paginación: ?page=1&limit=20)
router.get('/', usuariosController.listar);

// Listar cuentas pendientes de aprobación
router.get('/pendientes', usuariosController.listarPendientes);

// Aprobar una cuenta pendiente → activa y envía correo de bienvenida
router.patch('/:id/aprobar', usuariosController.aprobar);

// Rechazar una cuenta pendiente → no puede iniciar sesión, se notifica por correo
router.patch('/:id/rechazar', usuariosController.rechazar);

// Cambiar el conjunto de roles de un usuario (arreglo — puede tener varios)
router.patch('/:id/roles', usuariosController.cambiarRoles);

// Restablecer contraseña de cualquier cuenta — genera una temporal y la envía por correo
router.patch('/:id/resetear-password', usuariosController.resetearPassword);

// Desactivar una cuenta (soft — no borra el registro)
router.patch('/:id/desactivar', usuariosController.desactivar);

// Invitar a un nuevo usuario por correo
router.post('/invitar', usuariosController.invitar);

module.exports = router;
