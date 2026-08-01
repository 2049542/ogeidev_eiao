// ============================================================
// mantenimiento.routes.js — Órdenes de trabajo correctivo.
//
// Cualquier usuario puede crear una orden correctiva.
// Solo Mantenimiento y Admin pueden actualizar el estado.
// El detalle incluye el historial completo de cambios.
// ============================================================

const express = require('express');
const router = express.Router();
const mantenimientoController = require('../controllers/mantenimiento.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

router.use(verifyToken);

// Listar órdenes de mantenimiento
router.get('/', mantenimientoController.listar);

// Crear nueva orden correctiva (cualquier usuario autenticado)
router.post('/', mantenimientoController.crear);

// Detalle con historial completo de cambios de estado
router.get('/:id', mantenimientoController.detalle);

// Actualizar estado (solo Mantenimiento, Tecnico y Admin)
router.patch(
  '/:id/status',
  requireRoles('Administrador', 'Mantenimiento', 'Tecnico'),
  mantenimientoController.actualizarStatus
);

module.exports = router;
