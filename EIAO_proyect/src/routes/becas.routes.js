// ============================================================
// becas.routes.js — Avisos Generales (antes "Becas") con imagen y etiqueta de área.
//
// Al publicar un aviso:
//   1. La imagen sube a Cloudinary
//   2. Se guarda la publicación en BD con su etiqueta de área
//   3. Se envía correo a todos los usuarios con @uanl.edu.mx
// ============================================================

const express = require('express');
const router = express.Router();
const becasController = require('../controllers/becas.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');
const { manejarUpload } = require('../middleware/upload.middleware');

router.use(verifyToken);

// Listar publicaciones (todos los roles pueden ver)
router.get('/', becasController.listar);

// Publicar nuevo aviso con imagen (solo Avisos y Administrador)
// manejarUpload intercepta el archivo del campo "imagen" antes del controlador
router.post(
  '/',
  requireRoles('Administrador', 'Avisos'),
  manejarUpload,
  becasController.publicar
);

// Editar publicación existente (solo Avisos y Administrador)
// La imagen es opcional: si no se envía, se conserva la actual.
router.patch(
  '/:id',
  requireRoles('Administrador', 'Avisos'),
  manejarUpload,
  becasController.actualizar
);

// Eliminar publicación (solo Avisos y Administrador)
router.delete(
  '/:id',
  requireRoles('Administrador', 'Avisos'),
  becasController.eliminar
);

// Togglear "me gusta" en un aviso (cualquier usuario autenticado)
router.post('/:id/like', becasController.toggleLike);

module.exports = router;
