// ============================================================
// inventario.controller.js — Registro único de inventario de
// equipo de cómputo (CPU, monitores, impresoras, laptops, etc.)
//
// Reemplaza el inventario simple de existencias por cantidad:
// ahora cada renglón es un equipo individual con patrimonio,
// serie, responsable y especificaciones técnicas.
//
// Permisos (ver inventario.routes.js):
//   - Ver:      cualquier rol autenticado
//   - Agregar/Eliminar: solo Administrador
//   - Editar:   Administrador y Mantenimiento
// ============================================================

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CAMPOS_EDITABLES = [
  'departamento', 'ubicacion', 'responsable', 'tipoEquipo', 'noPatrimonio',
  'marca', 'modelo', 'noSerie', 'procesador', 'ram', 'tipoRam',
  'almacenamiento', 'tipoAlmacenamiento', 'estado', 'observaciones',
];

// GET /api/inventario
// Lista todo el inventario (no eliminado). El filtrado por
// departamento/tipo/estado se hace en el frontend.
const listar = async (req, res) => {
  try {
    const items = await prisma.inventario.findMany({
      where: { deletedAt: null },
      orderBy: [{ departamento: 'asc' }, { tipoEquipo: 'asc' }],
    });

    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('Error al listar inventario:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener el inventario.' });
  }
};

// POST /api/inventario
// Agregar un nuevo equipo al inventario (solo Administrador).
const agregar = async (req, res) => {
  try {
    const { departamento, tipoEquipo } = req.body;

    if (!departamento || !tipoEquipo) {
      return res.status(400).json({
        success: false,
        message: 'Departamento/Área y tipo de equipo son obligatorios.',
      });
    }

    const data = { departamento, tipoEquipo };
    CAMPOS_EDITABLES.forEach((campo) => {
      if (req.body[campo] !== undefined && campo !== 'departamento' && campo !== 'tipoEquipo') {
        data[campo] = req.body[campo] || null;
      }
    });
    if (req.body.fechaRegistro) data.fechaRegistro = new Date(req.body.fechaRegistro);

    const item = await prisma.inventario.create({ data });

    console.log(`📦 Nuevo equipo en inventario: ${tipoEquipo} — ${departamento}`);

    return res.status(201).json({
      success: true,
      message: 'Equipo agregado al inventario.',
      data: item,
    });
  } catch (error) {
    console.error('Error al agregar al inventario:', error);
    return res.status(500).json({ success: false, message: 'Error al agregar el equipo.' });
  }
};

// POST /api/inventario/bulk
// Importación masiva desde Excel/CSV (solo Administrador).
// Body: { equipos: [ { departamento, tipoEquipo, ... }, ... ] }
const agregarMasivo = async (req, res) => {
  try {
    const { equipos } = req.body;

    if (!Array.isArray(equipos) || equipos.length === 0) {
      return res.status(400).json({ success: false, message: 'Se requiere un arreglo "equipos" con al menos un elemento.' });
    }

    const data = equipos
      .filter((e) => e && e.departamento && e.tipoEquipo)
      .map((e) => {
        const row = { departamento: e.departamento, tipoEquipo: e.tipoEquipo };
        CAMPOS_EDITABLES.forEach((campo) => {
          if (e[campo] !== undefined && campo !== 'departamento' && campo !== 'tipoEquipo') {
            row[campo] = e[campo] || null;
          }
        });
        if (e.fechaRegistro) row.fechaRegistro = new Date(e.fechaRegistro);
        return row;
      });

    if (data.length === 0) {
      return res.status(400).json({ success: false, message: 'Ningún equipo tiene departamento y tipo de equipo válidos.' });
    }

    const resultado = await prisma.inventario.createMany({ data });

    console.log(`📦 Importación masiva de inventario: ${resultado.count} equipo(s)`);

    return res.status(201).json({
      success: true,
      message: `${resultado.count} equipo(s) importado(s) al inventario.`,
      data: { count: resultado.count },
    });
  } catch (error) {
    console.error('Error en importación masiva de inventario:', error);
    return res.status(500).json({ success: false, message: 'Error al importar el inventario.' });
  }
};

// PATCH /api/inventario/:id
// Actualizar datos de un equipo (Administrador y Mantenimiento).
const actualizar = async (req, res) => {
  try {
    const { id } = req.params;

    const data = {};
    if (req.body.departamento !== undefined) data.departamento = req.body.departamento;
    if (req.body.tipoEquipo !== undefined) data.tipoEquipo = req.body.tipoEquipo;
    CAMPOS_EDITABLES.forEach((campo) => {
      if (req.body[campo] !== undefined && data[campo] === undefined) data[campo] = req.body[campo] || null;
    });
    if (req.body.fechaRegistro !== undefined) data.fechaRegistro = new Date(req.body.fechaRegistro);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se enviaron datos para actualizar.',
      });
    }

    const actualizado = await prisma.inventario.update({ where: { id }, data });

    return res.json({
      success: true,
      message: 'Equipo actualizado.',
      data: actualizado,
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Equipo no encontrado.' });
    }
    console.error('Error al actualizar inventario:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar el equipo.' });
  }
};

// DELETE /api/inventario/:id
// Elimina (soft-delete) un equipo del inventario (solo Administrador).
const eliminar = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.inventario.update({ where: { id }, data: { deletedAt: new Date() } });

    return res.json({
      success: true,
      message: 'Equipo eliminado del inventario.',
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Equipo no encontrado.' });
    }
    console.error('Error al eliminar inventario:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar el equipo.' });
  }
};

module.exports = { listar, agregar, agregarMasivo, actualizar, eliminar };
