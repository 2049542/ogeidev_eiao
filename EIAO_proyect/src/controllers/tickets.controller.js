// ============================================================
// tickets.controller.js — Gestión del sistema de tickets.
//
// Los tickets son el mecanismo principal de seguimiento de
// solicitudes internas (soporte técnico, CCTV, AV, etc.).
//
// Lógica de visibilidad por rol:
//   - Administrador → ve todos los tickets
//   - SoporteTecnico → ve tickets de área 'SoporteTecnico'
//   - CentroDeAyuda → ve tickets de área 'CentroDeAyuda'
//   - Resto de roles → solo ve sus propios tickets
// ============================================================

const { PrismaClient } = require('@prisma/client');
const emailService = require('../services/email.service');
const cloudinaryService = require('../services/cloudinary.service');

const prisma = new PrismaClient();

// GET /api/tickets
// Lista tickets según el rol del usuario autenticado.
const listar = async (req, res) => {
  try {
    const { roles, id: userId } = req.user;
    let where = {};

    // Áreas propias de cada rol (Tecnico comparte el área "Mantenimiento")
    const areasDelUsuario = [...new Set(
      ['SoporteTecnico', 'CentroDeAyuda', 'Auditorio', 'Mantenimiento', 'Tecnico']
        .filter((r) => roles.includes(r))
        .map((r) => (r === 'Tecnico' ? 'Mantenimiento' : r))
    )];

    if (roles.includes('Administrador')) {
      // Admin ve todo, sin filtros
      where = {};
    } else if (areasDelUsuario.length > 0) {
      // Cada rol de área ve los tickets de todas sus áreas combinadas
      where = { area: { in: areasDelUsuario } };
    } else {
      // Cualquier otro rol solo ve sus propios tickets
      where = { userId };
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        user: { select: { id: true, nombre: true, email: true } },
        asignado: { select: { id: true, nombre: true } },
        _count: { select: { comentarios: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: tickets });
  } catch (error) {
    console.error('Error al listar tickets:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener tickets.' });
  }
};

// POST /api/tickets
// Crear un nuevo ticket de soporte. Acepta opcionalmente una imagen adjunta
// (campo "imagen" en multipart/form-data) que se sube a Cloudinary.
const crear = async (req, res) => {
  try {
    const { titulo, descripcion, area, tipo, prioridad, slaHoras } = req.body;

    if (!titulo || !descripcion || !area || !tipo) {
      return res.status(400).json({
        success: false,
        message: 'Título, descripción, área y tipo son obligatorios.',
      });
    }

    let imagenUrl = null;
    if (req.file) {
      const resultadoCloud = await cloudinaryService.uploadImagen(req.file.buffer, 'eiao/tickets');
      imagenUrl = resultadoCloud.secure_url;
    }

    const ticket = await prisma.ticket.create({
      data: {
        titulo,
        descripcion,
        area,
        tipo,
        prioridad: prioridad || 'MEDIA',
        slaHoras: slaHoras ? parseInt(slaHoras) : null,
        imagenUrl,
        userId: req.user.id,
      },
      include: {
        user: { select: { id: true, nombre: true, email: true } },
      },
    });

    console.log(`🎫 Nuevo ticket creado: ${ticket.titulo} (${ticket.area})`);

    return res.status(201).json({
      success: true,
      message: 'Ticket creado exitosamente.',
      data: ticket,
    });
  } catch (error) {
    console.error('Error al crear ticket:', error);
    return res.status(500).json({ success: false, message: 'Error al crear el ticket.' });
  }
};

// GET /api/tickets/:id
// Detalle de un ticket con todos sus comentarios.
const detalle = async (req, res) => {
  try {
    const { id } = req.params;
    const { roles, id: userId } = req.user;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, nombre: true, email: true } },
        asignado: { select: { id: true, nombre: true, email: true } },
        atendidoPor: { select: { id: true, nombre: true, roles: true } },
        comentarios: {
          include: {
            user: { select: { id: true, nombre: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket no encontrado.' });
    }

    // Verificar acceso: solo el dueño, admin o el rol del área del ticket puede ver el detalle
    const esAdmin = roles.includes('Administrador');
    const esStaffDelArea =
      roles.includes(ticket.area) || (roles.includes('Tecnico') && ticket.area === 'Mantenimiento');
    const esDueno = ticket.userId === userId;

    if (!esAdmin && !esStaffDelArea && !esDueno) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver este ticket.',
      });
    }

    return res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('Error al obtener detalle de ticket:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener el ticket.' });
  }
};

// PATCH /api/tickets/:id/status
// Cambiar el estado de un ticket. Flujo: Pendiente → Atendido → EnProceso → Resuelto/Cancelado.
// Body: { status: 'Resuelto', seguimiento: '...', resolucionMensaje: '...' }
// Al pasar a "Resuelto" acepta opcionalmente una imagen de evidencia (campo "imagen").
const cambiarStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, seguimiento, resolucionMensaje } = req.body;
    const { roles, id: userId } = req.user;

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

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket no encontrado.' });
    }

    // Solo admin, staff del área (incluye Tecnico para Mantenimiento) o el dueño puede cambiar el status
    const puedeCambiar =
      roles.includes('Administrador') ||
      roles.includes(ticket.area) ||
      (roles.includes('Tecnico') && ticket.area === 'Mantenimiento') ||
      ticket.userId === userId;

    if (!puedeCambiar) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para modificar este ticket.',
      });
    }

    const data = {
      status,
      seguimiento: seguimiento || ticket.seguimiento,
    };

    // Al marcar "Atendido" se registra quién y cuándo lo atendió
    if (status === 'Atendido') {
      data.atendidoPorId = userId;
      data.atendidoAt = new Date();
    }

    // Al resolver se guarda la respuesta de cumplimiento (mensaje + evidencia opcional)
    if (status === 'Resuelto') {
      data.resolvedAt = new Date();
      data.resolucionAt = new Date();
      data.resolucionMensaje = resolucionMensaje || null;
      if (req.file) {
        const resultadoCloud = await cloudinaryService.uploadImagen(req.file.buffer, 'eiao/resoluciones');
        data.resolucionImagenUrl = resultadoCloud.secure_url;
      }
    }

    if (status === 'Cancelado') {
      data.resolvedAt = new Date();
    }

    const actualizado = await prisma.ticket.update({ where: { id }, data });

    // Notificar al dueño del ticket cuando sea resuelto
    if (status === 'Resuelto' && ticket.userId !== userId) {
      try {
        await emailService.sendTicketResuelto({
          nombre: ticket.user.nombre,
          email: ticket.user.email,
          titulo: ticket.titulo,
          area: ticket.area,
        });
      } catch (emailError) {
        console.error('⚠️ No se pudo enviar notificación de ticket resuelto:', emailError.message);
      }
    }

    // Enviar encuesta de satisfacción al dueño del ticket
    if (status === 'Resuelto') {
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
      message: `Estado del ticket actualizado a ${status}.`,
      data: actualizado,
    });
  } catch (error) {
    console.error('Error al cambiar status del ticket:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar el ticket.' });
  }
};

// POST /api/tickets/:id/comentarios
// Agregar un comentario al historial del ticket. Acepta opcionalmente una
// imagen adjunta (campo "imagen" en multipart/form-data) subida a Cloudinary.
const agregarComentario = async (req, res) => {
  try {
    const { id } = req.params;
    const { texto } = req.body;

    if ((!texto || texto.trim() === '') && !req.file) {
      return res.status(400).json({
        success: false,
        message: 'El comentario debe tener texto o una imagen adjunta.',
      });
    }

    // Verificar que el ticket existe
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket no encontrado.' });
    }

    let imagenUrl = null;
    if (req.file) {
      const resultadoCloud = await cloudinaryService.uploadImagen(req.file.buffer, 'eiao/comentarios');
      imagenUrl = resultadoCloud.secure_url;
    }

    const comentario = await prisma.comentario.create({
      data: {
        texto: (texto || '').trim(),
        imagenUrl,
        ticketId: id,
        userId: req.user.id,
      },
      include: {
        user: { select: { id: true, nombre: true } },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Comentario agregado.',
      data: comentario,
    });
  } catch (error) {
    console.error('Error al agregar comentario:', error);
    return res.status(500).json({ success: false, message: 'Error al agregar el comentario.' });
  }
};

// POST /api/tickets/:id/encuesta
// Solo el dueño del ticket puede responder, y solo si el ticket está Resuelto.
const enviarEncuesta = async (req, res) => {
  try {
    const { id } = req.params;
    const { calificacion, comentario } = req.body;
    const { id: userId } = req.user;

    const nota = parseInt(calificacion);
    if (!nota || nota < 1 || nota > 5) {
      return res.status(400).json({
        success: false,
        message: 'La calificación debe ser un número entre 1 y 5.',
      });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket no encontrado.' });
    }

    if (ticket.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo el usuario que creó el ticket puede responder la encuesta.',
      });
    }

    if (ticket.status !== 'Resuelto') {
      return res.status(400).json({
        success: false,
        message: 'Solo se puede evaluar un ticket que ya fue resuelto.',
      });
    }

    const existente = await prisma.encuestaSatisfaccion.findUnique({ where: { ticketId: id } });
    if (existente) {
      return res.status(409).json({
        success: false,
        message: 'Este ticket ya tiene una encuesta respondida.',
      });
    }

    const encuesta = await prisma.encuestaSatisfaccion.create({
      data: {
        ticketId: id,
        calificacion: nota,
        comentario: comentario || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: '¡Gracias por tu retroalimentación!',
      data: encuesta,
    });
  } catch (error) {
    console.error('Error al enviar encuesta:', error);
    return res.status(500).json({ success: false, message: 'Error al enviar la encuesta.' });
  }
};

// GET /api/tickets/:id/encuesta
// Devuelve la encuesta del ticket si ya fue respondida (data: null si no).
const verEncuesta = async (req, res) => {
  try {
    const { id } = req.params;
    const encuesta = await prisma.encuestaSatisfaccion.findUnique({ where: { ticketId: id } });
    return res.json({ success: true, data: encuesta });
  } catch (error) {
    console.error('Error al obtener encuesta:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener la encuesta.' });
  }
};

module.exports = { listar, crear, detalle, cambiarStatus, agregarComentario, enviarEncuesta, verEncuesta };
