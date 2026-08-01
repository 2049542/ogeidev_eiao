// ============================================================
// tickets.routes.js — Rutas del módulo de tickets generales.
//
// La visibilidad de tickets depende del rol:
//   - Administrador: ve todos
//   - SoporteTecnico / CentroDeAyuda: ve los de su área
//   - Resto de roles: ve solo los que él creó
// ============================================================

const express = require('express');
const router = express.Router();
const ticketsController = require('../controllers/tickets.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { manejarUpload } = require('../middleware/upload.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Listar tickets (filtrado por rol en el controlador)
router.get('/', ticketsController.listar);

// Crear un nuevo ticket — manejarUpload permite adjuntar una imagen opcional
// (campo "imagen"); si la petición viene en JSON simple, se ignora sin error.
router.post('/', manejarUpload, ticketsController.crear);

// Ver detalle de un ticket específico con sus comentarios
router.get('/:id', ticketsController.detalle);

// Cambiar el estado de un ticket (Pendiente, Atendido, EnProceso, Resuelto, Cancelado).
// manejarUpload permite adjuntar imagen de evidencia al resolver.
router.patch('/:id/status', manejarUpload, ticketsController.cambiarStatus);

// Agregar un comentario a un ticket — manejarUpload permite adjuntar una imagen opcional
router.post('/:id/comentarios', manejarUpload, ticketsController.agregarComentario);

// Encuesta de satisfacción — solo el dueño del ticket, solo si ya está Resuelto
router.post('/:id/encuesta', ticketsController.enviarEncuesta);
router.get('/:id/encuesta', ticketsController.verEncuesta);

module.exports = router;
