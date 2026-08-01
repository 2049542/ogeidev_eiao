// ============================================================
// seguridad.routes.js — Módulo de Seguridad / CCTV.
//
// Permite solicitar grabaciones del sistema CCTV y reportar
// incidentes de seguridad (anónimos o con identificación).
// ============================================================

const express = require('express');
const router = express.Router();
const seguridadController = require('../controllers/seguridad.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

router.use(verifyToken);

// ── Grabaciones CCTV ──────────────────────────────────────────

// Solicitar grabación (cualquier usuario autenticado)
router.post('/grabaciones', seguridadController.crearSolicitudGrabacion);

// Listar solicitudes (admin y soporte ven todas; demás solo las propias)
router.get('/grabaciones', seguridadController.listarGrabaciones);

// Actualizar estado de solicitud (solo Admin y Soporte Técnico)
router.patch(
  '/grabaciones/:id/status',
  requireRoles('Administrador', 'SoporteTecnico'),
  seguridadController.actualizarStatusGrabacion
);

// ── Reportes de Incidente ─────────────────────────────────────

// Reportar incidente (puede ser anónimo)
router.post('/incidentes', seguridadController.crearIncidente);

// Listar incidentes (admin ve todos; demás solo los propios)
router.get('/incidentes', seguridadController.listarIncidentes);

module.exports = router;
