// ============================================================
// centroayuda.controller.js — Tickets del Centro de Ayuda.
//
// El Centro de Ayuda atiende:
//   - Problemas de contraseñas de sistemas internos (SIGA, correo UANL)
//   - Reportes de fallas de red/equipo básico en el plantel
//
// Para problemas con SIASE, Nexus, Teams o correos externos,
// se devuelve el enlace a centrodeayuda.uanl.mx (soporte UANL central).
//
// Internamente, los tickets de Centro de Ayuda son Tickets del modelo
// principal con area = 'CentroDeAyuda'.
// ============================================================

const { PrismaClient } = require('@prisma/client');
const emailService = require('../services/email.service');

const prisma = new PrismaClient();

// Tipos que el Centro de Ayuda de EIAO atiende directamente
const TIPOS_INTERNOS = ['CONTRASENA_INTERNA', 'RED', 'EQUIPO_PLANTEL', 'OTRO'];

// Tipos que deben redirigirse a centrodeayuda.uanl.mx
const TIPOS_EXTERNOS = ['SIASE', 'NEXUS', 'TEAMS', 'CORREO_UANL'];

// URL de soporte externo UANL
const URL_SOPORTE_UANL = 'https://centrodeayuda.uanl.mx';

// GET /api/centroayuda/tickets
const listar = async (req, res) => {
  try {
    const { roles, id: userId } = req.user;

    // Centro de Ayuda, Tecnico y Admin ven todos; los demás solo los suyos
    const where =
      ['Administrador', 'CentroDeAyuda', 'Tecnico'].some((r) => roles.includes(r))
        ? { area: 'CentroDeAyuda' }
        : { area: 'CentroDeAyuda', userId };

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        user: { select: { id: true, nombre: true, email: true } },
        asignado: { select: { id: true, nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: tickets });
  } catch (error) {
    console.error('Error al listar tickets de ayuda:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener tickets.' });
  }
};

// POST /api/centroayuda/tickets
// Crear ticket de ayuda. Si el tipo es externo (SIASE, Nexus, etc.),
// se informa al usuario que debe ir al soporte central de la UANL.
const crear = async (req, res) => {
  try {
    const { titulo, descripcion, tipo } = req.body;

    if (!titulo || !descripcion || !tipo) {
      return res.status(400).json({
        success: false,
        message: 'Título, descripción y tipo son obligatorios.',
      });
    }

    const tipoUpper = tipo.toUpperCase();

    // Verificar si el problema debe atenderse en soporte central UANL
    if (TIPOS_EXTERNOS.includes(tipoUpper)) {
      return res.status(200).json({
        success: true,
        redirigir: true,
        message: `Para problemas con ${tipo}, debes contactar al Centro de Ayuda central de la UANL.`,
        enlace: URL_SOPORTE_UANL,
        instrucciones: [
          `1. Visita ${URL_SOPORTE_UANL}`,
          '2. Inicia sesión con tu cuenta UANL',
          '3. Crea un ticket de soporte seleccionando el sistema afectado',
          '4. El equipo de soporte UANL te contactará por correo institucional',
        ],
      });
    }

    // Validar que sea un tipo que sí atendemos internamente
    if (!TIPOS_INTERNOS.includes(tipoUpper) && !tipoUpper) {
      return res.status(400).json({
        success: false,
        message: `Tipo no reconocido. Tipos internos: ${TIPOS_INTERNOS.join(', ')}. Para SIASE, Nexus, Teams visita ${URL_SOPORTE_UANL}`,
      });
    }

    const ticket = await prisma.ticket.create({
      data: {
        titulo,
        descripcion,
        area: 'CentroDeAyuda',
        tipo: tipoUpper,
        prioridad: 'MEDIA',
        userId: req.user.id,
      },
      include: {
        user: { select: { id: true, nombre: true, email: true } },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Ticket de ayuda creado. El Centro de Ayuda de la EIAO lo atenderá pronto.',
      data: ticket,
    });
  } catch (error) {
    console.error('Error al crear ticket de ayuda:', error);
    return res.status(500).json({ success: false, message: 'Error al crear el ticket.' });
  }
};

// PATCH /api/centroayuda/tickets/:id/status
// Resolver o actualizar estado del ticket de ayuda.
const resolverTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, seguimiento } = req.body;

    const statusValidos = ['Pendiente', 'Atendido', 'EnProceso', 'Resuelto', 'Cancelado'];
    if (!status || !statusValidos.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status inválido. Opciones: ${statusValidos.join(', ')}`,
      });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!ticket || ticket.area !== 'CentroDeAyuda') {
      return res.status(404).json({
        success: false,
        message: 'Ticket de ayuda no encontrado.',
      });
    }

    const data = {
      status,
      seguimiento: seguimiento || ticket.seguimiento,
    };

    if (status === 'Atendido') {
      data.atendidoPorId = req.user.id;
      data.atendidoAt = new Date();
    }

    if (status === 'Resuelto' || status === 'Cancelado') {
      data.resolvedAt = new Date();
    }

    const actualizado = await prisma.ticket.update({ where: { id }, data });

    // Notificar al usuario cuando su ticket es resuelto
    if (status === 'Resuelto') {
      try {
        await emailService.sendTicketResuelto({
          nombre: ticket.user.nombre,
          email: ticket.user.email,
          titulo: ticket.titulo,
          area: 'Centro de Ayuda EIAO',
        });
      } catch (emailError) {
        console.error('⚠️ No se pudo enviar notificación de ticket resuelto:', emailError.message);
      }

      try {
        const frontendBase = (process.env.FRONTEND_URL || '').split(',')[0].trim();
        const link = `${frontendBase}/proyecto.html?encuesta=${ticket.id}`;
        await emailService.sendEncuestaSatisfaccion({
          nombre: ticket.user.nombre,
          email: ticket.user.email,
          titulo: ticket.titulo,
          link,
        });
      } catch (emailError) {
        console.error('⚠️ No se pudo enviar la encuesta de satisfacción:', emailError.message);
      }
    }

    return res.json({
      success: true,
      message: `Ticket actualizado a ${status}.`,
      data: actualizado,
    });
  } catch (error) {
    console.error('Error al resolver ticket de ayuda:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar el ticket.' });
  }
};

module.exports = { listar, crear, resolverTicket };
