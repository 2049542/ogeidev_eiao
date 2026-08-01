// ============================================================
// centroayuda.routes.js — Módulo Centro de Ayuda.
//
// Maneja tickets de soporte interno:
//   - Problemas de contraseñas de sistemas internos
//   - Reportes de fallas de red o equipo básico
//
// Para SIASE, Nexus, Teams → redirige a centrodeayuda.uanl.mx
// ============================================================

const express = require('express');
const router = express.Router();
const centroayudaController = require('../controllers/centroayuda.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

router.use(verifyToken);

// Listar tickets de ayuda (Centro de Ayuda y Admin ven todos; demás solo los suyos)
router.get('/tickets', centroayudaController.listar);

// Crear ticket de ayuda (cualquier usuario)
router.post('/tickets', centroayudaController.crear);

// Resolver ticket (solo Centro de Ayuda, Tecnico y Admin)
router.patch(
  '/tickets/:id/status',
  requireRoles('Administrador', 'CentroDeAyuda', 'Tecnico'),
  centroayudaController.resolverTicket
);

module.exports = router;
