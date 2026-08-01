// ============================================================
// soluciones.routes.js — Base de conocimiento "Soluciones Rápidas".
//
// Consulta libre para cualquier rol autenticado. Crear/editar es
// para Administrador y Tecnico (o el autor, para editar). Eliminar
// es solo Administrador.
// ============================================================

const express = require('express');
const router = express.Router();
const solucionesController = require('../controllers/soluciones.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireRoles, soloAdmin } = require('../middleware/roles.middleware');

router.use(verifyToken);

// Listar todas las soluciones (cualquier rol autenticado)
router.get('/', solucionesController.listar);

// Crear una nueva solución (Administrador y Tecnico)
router.post('/', requireRoles('Administrador', 'Tecnico'), solucionesController.crear);

// Editar una solución (Administrador, Tecnico, o el autor — validado en el controlador)
router.patch('/:id', solucionesController.actualizar);

// Eliminar (soft delete) una solución (solo Administrador)
router.delete('/:id', soloAdmin, solucionesController.eliminar);

module.exports = router;
