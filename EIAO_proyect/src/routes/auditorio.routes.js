// ============================================================
// auditorio.routes.js — Reservaciones del auditorio.
//
// Regla clave: las reservaciones NO aparecen en el calendario
// hasta que un Administrador las apruebe explícitamente.
// ============================================================

const express = require('express');
const router = express.Router();
const auditorioController = require('../controllers/auditorio.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireRoles, adminOAuditorio } = require('../middleware/roles.middleware');

router.use(verifyToken);

// Listar solo las pendientes de aprobación (solo Admin/Auditorio)
router.get('/reservaciones/pendientes', adminOAuditorio, auditorioController.listarPendientes);

// Listar reservaciones (admin/auditorio ven todas; maestros y SS solo las aprobadas)
router.get('/reservaciones', auditorioController.listar);

// Crear solicitud de reservación (cualquier usuario autenticado)
router.post('/reservaciones', auditorioController.crear);

// Aprobar una reservación (solo Admin)
router.patch(
  '/reservaciones/:id/aprobar',
  requireRoles('Administrador'),
  auditorioController.aprobar
);

// Rechazar una reservación (solo Admin)
router.patch(
  '/reservaciones/:id/rechazar',
  requireRoles('Administrador'),
  auditorioController.rechazar
);

module.exports = router;
