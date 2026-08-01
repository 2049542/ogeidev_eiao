// ============================================================
// seguridad.controller.js — Solicitudes CCTV e incidentes.
//
// Dos sub-módulos:
//   1. Grabaciones CCTV: solicitud → revisión por Soporte Técnico → entrega
//   2. Reportes de incidente: pueden ser anónimos (userId = null)
// ============================================================

const { PrismaClient } = require('@prisma/client');
const emailService = require('../services/email.service');

const prisma = new PrismaClient();

// ── GRABACIONES ───────────────────────────────────────────────

// POST /api/seguridad/grabaciones
const crearSolicitudGrabacion = async (req, res) => {
  try {
    const { motivo, zona, fecha, horaInicio, horaFin, descripcion, personas, urgencia } = req.body;

    if (!motivo || !zona || !fecha || !horaInicio || !horaFin) {
      return res.status(400).json({
        success: false,
        message: 'Motivo, zona, fecha, hora de inicio y hora de fin son obligatorios.',
      });
    }

    const solicitud = await prisma.solicitudGrabacion.create({
      data: {
        motivo,
        zona,
        fecha: new Date(fecha),
        horaInicio,
        horaFin,
        descripcion: descripcion || null,
        personas: personas || null,
        urgencia: urgencia || 'Normal',
        userId: req.user.id,
      },
      include: {
        user: { select: { id: true, nombre: true, email: true } },
      },
    });

    // Enviar confirmación por correo al solicitante
    try {
      await emailService.sendGrabacionConfirmacion({
        nombre: req.user.nombre,
        email: req.user.email,
        zona,
        fecha: new Date(fecha).toLocaleDateString('es-MX'),
        horaInicio,
        horaFin,
      });
    } catch (emailError) {
      console.error('⚠️ No se pudo enviar confirmación de grabación:', emailError.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Solicitud de grabación enviada. Recibirás confirmación por correo.',
      data: solicitud,
    });
  } catch (error) {
    console.error('Error al crear solicitud de grabación:', error);
    return res.status(500).json({ success: false, message: 'Error al enviar la solicitud.' });
  }
};

// GET /api/seguridad/grabaciones
const listarGrabaciones = async (req, res) => {
  try {
    const { roles, id: userId } = req.user;

    // Admin y Soporte ven todas; los demás solo las suyas
    const where =
      roles.includes('Administrador') || roles.includes('SoporteTecnico') ? {} : { userId };

    const grabaciones = await prisma.solicitudGrabacion.findMany({
      where,
      include: {
        user: { select: { id: true, nombre: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: grabaciones });
  } catch (error) {
    console.error('Error al listar grabaciones:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener solicitudes.' });
  }
};

// PATCH /api/seguridad/grabaciones/:id/status
// Actualiza el estado de la solicitud. Body: { status: 'EN_PROCESO', notas: '...' }
const actualizarStatusGrabacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const statusValidos = ['PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'RECHAZADA'];
    if (!status || !statusValidos.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status inválido. Opciones: ${statusValidos.join(', ')}`,
      });
    }

    const solicitud = await prisma.solicitudGrabacion.findUnique({ where: { id } });
    if (!solicitud) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
    }

    const actualizada = await prisma.solicitudGrabacion.update({
      where: { id },
      data: { status },
    });

    return res.json({
      success: true,
      message: `Estado actualizado a ${status}.`,
      data: actualizada,
    });
  } catch (error) {
    console.error('Error al actualizar grabación:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar la solicitud.' });
  }
};

// ── INCIDENTES ────────────────────────────────────────────────

// POST /api/seguridad/incidentes
// Reportar un incidente. Si anonimo = true, no se asocia el userId.
const crearIncidente = async (req, res) => {
  try {
    const { tipo, fecha, hora, lugar, descripcion, contacto, anonimo } = req.body;

    if (!tipo || !fecha || !hora || !lugar || !descripcion) {
      return res.status(400).json({
        success: false,
        message: 'Tipo, fecha, hora, lugar y descripción son obligatorios.',
      });
    }

    const esAnonimo = anonimo === true || anonimo === 'true';

    const incidente = await prisma.reporteIncidente.create({
      data: {
        tipo,
        fecha: new Date(fecha),
        hora,
        lugar,
        descripcion,
        contacto: contacto || null,
        anonimo: esAnonimo,
        // Si es anónimo, no guardamos quién lo reportó
        userId: esAnonimo ? null : req.user.id,
      },
    });

    return res.status(201).json({
      success: true,
      message: esAnonimo
        ? 'Incidente reportado de forma anónima.'
        : 'Incidente reportado correctamente.',
      data: incidente,
    });
  } catch (error) {
    console.error('Error al crear incidente:', error);
    return res.status(500).json({ success: false, message: 'Error al reportar el incidente.' });
  }
};

// GET /api/seguridad/incidentes
const listarIncidentes = async (req, res) => {
  try {
    const { roles, id: userId } = req.user;

    // Admin ve todos; los demás solo los suyos (los anónimos no aparecen para nadie más que admin)
    const where = roles.includes('Administrador') ? {} : { userId };

    const incidentes = await prisma.reporteIncidente.findMany({
      where,
      include: {
        user: { select: { id: true, nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: incidentes });
  } catch (error) {
    console.error('Error al listar incidentes:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener incidentes.' });
  }
};

module.exports = {
  crearSolicitudGrabacion,
  listarGrabaciones,
  actualizarStatusGrabacion,
  crearIncidente,
  listarIncidentes,
};
