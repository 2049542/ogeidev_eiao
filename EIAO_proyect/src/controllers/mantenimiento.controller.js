// ============================================================
// mantenimiento.controller.js — Órdenes de mantenimiento correctivo.
//
// Flujo de una orden:
//   1. Usuario crea la orden → PENDIENTE
//   2. Mantenimiento la toma → EN_PROGRESO (con técnico asignado)
//   3. Mantenimiento la cierra → COMPLETADO
//
// Cada cambio de estado queda registrado en HistorialMantenimiento
// para trazabilidad completa del trabajo realizado.
// ============================================================

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// GET /api/mantenimiento
const listar = async (req, res) => {
  try {
    const { roles, id: userId } = req.user;

    // Mantenimiento, Tecnico y Admin ven todas; los demás solo las que crearon
    const where =
      ['Administrador', 'Mantenimiento', 'Tecnico'].some((r) => roles.includes(r)) ? {} : { userId };

    const ordenes = await prisma.mantenimientoCorrectivo.findMany({
      where,
      include: {
        user: { select: { id: true, nombre: true, email: true } },
        tecnico: { select: { id: true, nombre: true } },
        _count: { select: { historial: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: ordenes });
  } catch (error) {
    console.error('Error al listar mantenimiento:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener órdenes.' });
  }
};

// POST /api/mantenimiento
// Cualquier usuario puede reportar un problema de mantenimiento.
const crear = async (req, res) => {
  try {
    const { titulo, descripcion, ubicacion, prioridad } = req.body;

    if (!titulo || !descripcion || !ubicacion) {
      return res.status(400).json({
        success: false,
        message: 'Título, descripción y ubicación son obligatorios.',
      });
    }

    const orden = await prisma.mantenimientoCorrectivo.create({
      data: {
        titulo,
        descripcion,
        ubicacion,
        prioridad: prioridad || 'MEDIA',
        userId: req.user.id,
      },
      include: {
        user: { select: { id: true, nombre: true } },
      },
    });

    // Crear la primera entrada del historial
    await prisma.historialMantenimiento.create({
      data: {
        mantenimientoId: orden.id,
        userId: req.user.id,
        statusAnterior: 'PENDIENTE',
        statusNuevo: 'PENDIENTE',
        comentario: 'Orden creada.',
      },
    });

    console.log(`🔧 Nueva orden de mantenimiento: "${titulo}" en ${ubicacion}`);

    return res.status(201).json({
      success: true,
      message: 'Orden de mantenimiento creada. El equipo de mantenimiento la revisará pronto.',
      data: orden,
    });
  } catch (error) {
    console.error('Error al crear orden de mantenimiento:', error);
    return res.status(500).json({ success: false, message: 'Error al crear la orden.' });
  }
};

// GET /api/mantenimiento/:id
// Detalle con el historial completo de cambios de estado.
const detalle = async (req, res) => {
  try {
    const { id } = req.params;
    const { roles, id: userId } = req.user;

    const orden = await prisma.mantenimientoCorrectivo.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, nombre: true, email: true } },
        tecnico: { select: { id: true, nombre: true, email: true } },
        historial: {
          include: {
            user: { select: { id: true, nombre: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!orden) {
      return res.status(404).json({ success: false, message: 'Orden no encontrada.' });
    }

    // Verificar acceso
    const puedeVer =
      roles.includes('Administrador') ||
      roles.includes('Mantenimiento') ||
      roles.includes('Tecnico') ||
      orden.userId === userId;

    if (!puedeVer) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver esta orden.',
      });
    }

    return res.json({ success: true, data: orden });
  } catch (error) {
    console.error('Error al obtener detalle de mantenimiento:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener la orden.' });
  }
};

// PATCH /api/mantenimiento/:id/status
// Actualiza el estado y registra el cambio en el historial.
// Body: { status: 'EN_PROGRESO', comentario: '...', tecnicoId: '...' }
const actualizarStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comentario, tecnicoId } = req.body;

    const statusValidos = ['PENDIENTE', 'EN_PROGRESO', 'COMPLETADO', 'CANCELADO'];
    if (!status || !statusValidos.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status inválido. Opciones: ${statusValidos.join(', ')}`,
      });
    }

    const orden = await prisma.mantenimientoCorrectivo.findUnique({ where: { id } });
    if (!orden) {
      return res.status(404).json({ success: false, message: 'Orden no encontrada.' });
    }

    const data = {
      status,
      tecnicoId: tecnicoId || orden.tecnicoId,
    };

    // Registrar fecha de resolución cuando se completa
    if (status === 'COMPLETADO' || status === 'CANCELADO') {
      data.resolvedAt = new Date();
    }

    // Actualizar la orden
    const actualizada = await prisma.mantenimientoCorrectivo.update({
      where: { id },
      data,
    });

    // Registrar el cambio en el historial para trazabilidad
    await prisma.historialMantenimiento.create({
      data: {
        mantenimientoId: id,
        userId: req.user.id,
        statusAnterior: orden.status,
        statusNuevo: status,
        comentario: comentario || null,
      },
    });

    return res.json({
      success: true,
      message: `Estado actualizado de ${orden.status} → ${status}.`,
      data: actualizada,
    });
  } catch (error) {
    console.error('Error al actualizar mantenimiento:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar la orden.' });
  }
};

module.exports = { listar, crear, detalle, actualizarStatus };
