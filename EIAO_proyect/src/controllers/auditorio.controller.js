// ============================================================
// auditorio.controller.js — Gestión de reservaciones del auditorio.
//
// Flujo de una reservación:
//   1. Usuario crea solicitud → status: PENDIENTE
//   2. Administrador la aprueba → status: APROBADA (aparece en calendario)
//      O la rechaza → status: RECHAZADA (con motivo)
//
// Visibilidad:
//   - Administrador / Auditorio → ven todas las reservaciones
//   - Todos los demás → solo ven las APROBADAS (para el calendario)
// ============================================================

const { PrismaClient } = require('@prisma/client');
const emailService = require('../services/email.service');

const prisma = new PrismaClient();

// GET /api/auditorio/reservaciones
const listar = async (req, res) => {
  try {
    const { roles } = req.user;

    // Administradores y el área de auditorio ven todas las solicitudes
    const esGestor = roles.includes('Administrador') || roles.includes('Auditorio');

    const where = esGestor ? {} : { status: 'APROBADA' };

    const reservaciones = await prisma.reservacion.findMany({
      where,
      include: {
        user: { select: { id: true, nombre: true, email: true } },
        aprobador: { select: { id: true, nombre: true } },
      },
      orderBy: { fecha: 'asc' },
    });

    return res.json({ success: true, data: reservaciones });
  } catch (error) {
    console.error('Error al listar reservaciones:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener reservaciones.' });
  }
};

// GET /api/auditorio/reservaciones/pendientes
// Lista solo las reservaciones en espera de aprobación (Admin/Auditorio).
const listarPendientes = async (req, res) => {
  try {
    const pendientes = await prisma.reservacion.findMany({
      where: { status: 'PENDIENTE' },
      include: {
        user: { select: { id: true, nombre: true, email: true } },
      },
      orderBy: { fecha: 'asc' },
    });

    return res.json({
      success: true,
      data: pendientes,
      message: `${pendientes.length} reservación(es) pendiente(s) de aprobación.`,
    });
  } catch (error) {
    console.error('Error al listar reservaciones pendientes:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener reservaciones pendientes.' });
  }
};

// POST /api/auditorio/reservaciones
// Crear solicitud de reservación — queda en PENDIENTE hasta aprobación.
// "equipo" puede llegar como arreglo (checkboxes múltiples) y se guarda
// serializado en JSON dentro del mismo campo String del modelo.
const crear = async (req, res) => {
  try {
    const { evento, fecha, horaInicio, horaFin, asistentes, equipo, notas } = req.body;

    if (!evento || !fecha || !horaInicio || !horaFin || !asistentes) {
      return res.status(400).json({
        success: false,
        message: 'Evento, fecha, hora de inicio, hora de fin y número de asistentes son obligatorios.',
      });
    }

    const equipoGuardar = Array.isArray(equipo) ? JSON.stringify(equipo) : (equipo || null);

    // Verificar que no haya conflicto de horario en la misma fecha (solo con aprobadas)
    const conflicto = await prisma.reservacion.findFirst({
      where: {
        fecha: new Date(fecha),
        status: 'APROBADA',
        OR: [
          // Nueva reservación empieza dentro de una existente
          { horaInicio: { lte: horaInicio }, horaFin: { gt: horaInicio } },
          // Nueva reservación termina dentro de una existente
          { horaInicio: { lt: horaFin }, horaFin: { gte: horaFin } },
          // Nueva reservación abarca completamente una existente
          { horaInicio: { gte: horaInicio }, horaFin: { lte: horaFin } },
        ],
      },
    });

    if (conflicto) {
      return res.status(409).json({
        success: false,
        message: `Conflicto de horario: ya existe una reservación aprobada el ${new Date(fecha).toLocaleDateString('es-MX')} de ${conflicto.horaInicio} a ${conflicto.horaFin}.`,
      });
    }

    const reservacion = await prisma.reservacion.create({
      data: {
        evento,
        fecha: new Date(fecha),
        horaInicio,
        horaFin,
        asistentes: parseInt(asistentes),
        equipo: equipoGuardar,
        notas: notas || null,
        userId: req.user.id,
      },
      include: {
        user: { select: { id: true, nombre: true, email: true } },
      },
    });

    console.log(`📅 Nueva solicitud de auditorio: "${evento}" por ${req.user.nombre}`);

    return res.status(201).json({
      success: true,
      message: 'Solicitud de reservación enviada. Espera la aprobación del administrador.',
      data: reservacion,
    });
  } catch (error) {
    console.error('Error al crear reservación:', error);
    return res.status(500).json({ success: false, message: 'Error al crear la reservación.' });
  }
};

// PATCH /api/auditorio/reservaciones/:id/aprobar
// Admin aprueba la reservación → aparece en el calendario + correo al solicitante.
const aprobar = async (req, res) => {
  try {
    const { id } = req.params;

    const reservacion = await prisma.reservacion.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!reservacion) {
      return res.status(404).json({ success: false, message: 'Reservación no encontrada.' });
    }

    if (reservacion.status !== 'PENDIENTE') {
      return res.status(400).json({
        success: false,
        message: `Esta reservación ya fue ${reservacion.status.toLowerCase()}.`,
      });
    }

    const actualizada = await prisma.reservacion.update({
      where: { id },
      data: {
        status: 'APROBADA',
        aprobadoPor: req.user.id,
      },
    });

    // Notificar al solicitante por correo
    try {
      await emailService.sendReservacionAprobada({
        nombre: reservacion.user.nombre,
        email: reservacion.user.email,
        evento: reservacion.evento,
        fecha: reservacion.fecha,
        horaInicio: reservacion.horaInicio,
        horaFin: reservacion.horaFin,
      });
    } catch (emailError) {
      console.error('⚠️ No se pudo enviar correo de aprobación:', emailError.message);
    }

    return res.json({
      success: true,
      message: `Reservación "${reservacion.evento}" aprobada. Se notificó al solicitante.`,
      data: actualizada,
    });
  } catch (error) {
    console.error('Error al aprobar reservación:', error);
    return res.status(500).json({ success: false, message: 'Error al aprobar la reservación.' });
  }
};

// PATCH /api/auditorio/reservaciones/:id/rechazar
// Admin rechaza la reservación con un motivo opcional.
const rechazar = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    const reservacion = await prisma.reservacion.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!reservacion) {
      return res.status(404).json({ success: false, message: 'Reservación no encontrada.' });
    }

    if (reservacion.status !== 'PENDIENTE') {
      return res.status(400).json({
        success: false,
        message: `Esta reservación ya fue ${reservacion.status.toLowerCase()}.`,
      });
    }

    const actualizada = await prisma.reservacion.update({
      where: { id },
      data: {
        status: 'RECHAZADA',
        aprobadoPor: req.user.id,
        motivoRechazo: motivo || null,
      },
    });

    // Notificar al solicitante por correo
    try {
      await emailService.sendReservacionRechazada({
        nombre: reservacion.user.nombre,
        email: reservacion.user.email,
        evento: reservacion.evento,
        fecha: reservacion.fecha,
        motivo,
      });
    } catch (emailError) {
      console.error('⚠️ No se pudo enviar correo de rechazo:', emailError.message);
    }

    return res.json({
      success: true,
      message: `Reservación "${reservacion.evento}" rechazada. Se notificó al solicitante.`,
      data: actualizada,
    });
  } catch (error) {
    console.error('Error al rechazar reservación:', error);
    return res.status(500).json({ success: false, message: 'Error al rechazar la reservación.' });
  }
};

module.exports = { listar, listarPendientes, crear, aprobar, rechazar };
