// ============================================================
// soluciones.controller.js — Base de conocimiento de autoservicio
// "Soluciones Rápidas": problemas técnicos recurrentes y su
// solución, sin categorías, de consulta libre para todo el personal.
// ============================================================

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// GET /api/soluciones
// Lista todas las soluciones (no eliminadas). Cualquier rol autenticado puede ver.
const listar = async (req, res) => {
  try {
    const soluciones = await prisma.solucionRapida.findMany({
      where: { deletedAt: null },
      include: { user: { select: { id: true, nombre: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: soluciones });
  } catch (error) {
    console.error('Error al listar soluciones rápidas:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener las soluciones.' });
  }
};

// POST /api/soluciones
// Crear una nueva solución (Administrador y Tecnico).
const crear = async (req, res) => {
  try {
    const { problema, solucion } = req.body;

    if (!problema || !solucion) {
      return res.status(400).json({
        success: false,
        message: 'El problema y la solución son obligatorios.',
      });
    }

    const nueva = await prisma.solucionRapida.create({
      data: { problema, solucion, userId: req.user.id },
      include: { user: { select: { id: true, nombre: true } } },
    });

    return res.status(201).json({
      success: true,
      message: 'Solución agregada a la base de conocimiento.',
      data: nueva,
    });
  } catch (error) {
    console.error('Error al crear solución rápida:', error);
    return res.status(500).json({ success: false, message: 'Error al crear la solución.' });
  }
};

// PATCH /api/soluciones/:id
// Editar una solución existente (Administrador, Tecnico, o el autor original).
const actualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const { problema, solucion } = req.body;

    const existente = await prisma.solucionRapida.findUnique({ where: { id } });
    if (!existente || existente.deletedAt) {
      return res.status(404).json({ success: false, message: 'Solución no encontrada.' });
    }

    const esAutor = existente.userId === req.user.id;
    const esStaff = (req.user.roles || []).some((r) => ['Administrador', 'Tecnico'].includes(r));
    if (!esAutor && !esStaff) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para editar esta solución.',
      });
    }

    const data = {};
    if (problema !== undefined && problema !== '') data.problema = problema;
    if (solucion !== undefined && solucion !== '') data.solucion = solucion;

    const actualizada = await prisma.solucionRapida.update({
      where: { id },
      data,
      include: { user: { select: { id: true, nombre: true } } },
    });

    return res.json({
      success: true,
      message: 'Solución actualizada.',
      data: actualizada,
    });
  } catch (error) {
    console.error('Error al actualizar solución rápida:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar la solución.' });
  }
};

// DELETE /api/soluciones/:id
// Soft delete (solo Administrador).
const eliminar = async (req, res) => {
  try {
    const { id } = req.params;

    const existente = await prisma.solucionRapida.findUnique({ where: { id } });
    if (!existente || existente.deletedAt) {
      return res.status(404).json({ success: false, message: 'Solución no encontrada.' });
    }

    await prisma.solucionRapida.update({ where: { id }, data: { deletedAt: new Date() } });

    return res.json({ success: true, message: 'Solución eliminada.' });
  } catch (error) {
    console.error('Error al eliminar solución rápida:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar la solución.' });
  }
};

module.exports = { listar, crear, actualizar, eliminar };
