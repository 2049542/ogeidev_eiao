// ============================================================
// inventario.routes.js — Registro único de inventario de equipo.
//
// Permisos:
//   - Lectura (GET): todos los roles autenticados
//   - Agregar / Importar masivo / Eliminar: solo Administrador
//   - Editar: Administrador y Mantenimiento
// ============================================================

const express = require('express');
const router = express.Router();
const inventarioController = require('../controllers/inventario.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireRoles, soloAdmin } = require('../middleware/roles.middleware');

router.use(verifyToken);

// Ver inventario completo (todos los roles pueden ver)
router.get('/', inventarioController.listar);

// Agregar equipo (solo Administrador)
router.post('/', soloAdmin, inventarioController.agregar);

// Importar equipos masivamente desde Excel/CSV (solo Administrador)
router.post('/bulk', soloAdmin, inventarioController.agregarMasivo);

// Actualizar datos de un equipo (Administrador, Mantenimiento y Tecnico)
router.patch(
  '/:id',
  requireRoles('Administrador', 'Mantenimiento', 'Tecnico'),
  inventarioController.actualizar
);

// Eliminar equipo del inventario (solo Administrador)
router.delete('/:id', soloAdmin, inventarioController.eliminar);

module.exports = router;
