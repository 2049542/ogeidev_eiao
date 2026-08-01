// ============================================================
// usuarios.controller.js — Administración de cuentas de usuario.
//
// Solo los administradores pueden acceder a estos endpoints.
// Permite aprobar cuentas, cambiar roles, desactivar y enviar invitaciones.
// La cuenta maestra (esCuentaMaestra = true) nunca puede ser
// desactivada ni cambiada de rol.
// ============================================================

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const emailService = require('../services/email.service');
const { validarCorreoUANL } = require('../utils/validarCorreo');

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

// GET /api/usuarios
// Lista todos los usuarios con paginación opcional (?page=1&limit=20).
const listar = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const where = {};
    if (req.query.rol) where.roles = { has: req.query.rol };

    const [usuarios, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, nombre: true, email: true, roles: true,
          activo: true, pendienteAprobacion: true, esCuentaMaestra: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return res.json({
      success: true,
      data: usuarios,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error en listar usuarios:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener usuarios.' });
  }
};

// GET /api/usuarios/pendientes
// Lista solo las cuentas pendientes de aprobación.
const listarPendientes = async (req, res) => {
  try {
    const pendientes = await prisma.user.findMany({
      where: { pendienteAprobacion: true },
      select: {
        id: true, nombre: true, email: true, roles: true, areaSolicitada: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({
      success: true,
      data: pendientes,
      message: `${pendientes.length} cuenta(s) pendiente(s) de aprobación.`,
    });
  } catch (error) {
    console.error('Error en listar pendientes:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener pendientes.' });
  }
};

// PATCH /api/usuarios/:id/aprobar
// Aprueba una cuenta: activo = true, pendienteAprobacion = false.
const aprobar = async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await prisma.user.findUnique({ where: { id } });
    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    if (!usuario.pendienteAprobacion) {
      return res.status(400).json({
        success: false,
        message: 'Esta cuenta ya fue aprobada anteriormente.',
      });
    }

    const actualizado = await prisma.user.update({
      where: { id },
      data: { activo: true, pendienteAprobacion: false },
      select: { id: true, nombre: true, email: true, roles: true },
    });

    try {
      await emailService.sendBienvenida({
        nombre: actualizado.nombre,
        email:  actualizado.email,
        rol:    actualizado.roles.join(', '),
      });
      console.log(`📧 Correo de bienvenida enviado a: ${actualizado.email}`);
    } catch (emailError) {
      console.error('⚠️ No se pudo enviar correo de bienvenida:', emailError.message);
    }

    return res.json({
      success: true,
      message: `Cuenta de ${actualizado.nombre} aprobada. Se envió correo de bienvenida.`,
      data: actualizado,
    });
  } catch (error) {
    console.error('Error al aprobar usuario:', error);
    return res.status(500).json({ success: false, message: 'Error al aprobar la cuenta.' });
  }
};

// PATCH /api/usuarios/:id/rechazar
// Rechaza una cuenta pendiente: se marca como rechazada y no puede
// iniciar sesión. No se borra el registro para conservar el historial.
const rechazar = async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await prisma.user.findUnique({ where: { id } });
    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    if (!usuario.pendienteAprobacion) {
      return res.status(400).json({
        success: false,
        message: 'Esta cuenta ya fue procesada anteriormente (aprobada o rechazada).',
      });
    }

    const actualizado = await prisma.user.update({
      where: { id },
      data: { activo: false, pendienteAprobacion: false, rechazado: true },
      select: { id: true, nombre: true, email: true },
    });

    try {
      await emailService.sendRechazoSolicitud({ nombre: actualizado.nombre, email: actualizado.email });
      console.log(`📧 Correo de rechazo enviado a: ${actualizado.email}`);
    } catch (emailError) {
      console.error('⚠️ No se pudo enviar correo de rechazo:', emailError.message);
    }

    return res.json({
      success: true,
      message: `Solicitud de ${actualizado.nombre} rechazada.`,
      data: actualizado,
    });
  } catch (error) {
    console.error('Error al rechazar usuario:', error);
    return res.status(500).json({ success: false, message: 'Error al rechazar la cuenta.' });
  }
};

// Lista centralizada de roles válidos del sistema
const ROLES_VALIDOS = [
  'Administrador', 'Avisos', 'SoporteTecnico', 'Auditorio', 'Mantenimiento',
  'Tecnico', 'CentroDeAyuda', 'ServicioSocial', 'DocenteAdministrativo',
];

// PATCH /api/usuarios/:id/roles
// Reemplaza el conjunto de roles de un usuario (puede tener varios a la vez).
// No puede cambiar los roles de la cuenta maestra.
const cambiarRoles = async (req, res) => {
  try {
    const { id } = req.params;
    const { roles } = req.body;

    if (!Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debes enviar un arreglo "roles" con al menos un rol.',
      });
    }

    const rolesInvalidos = roles.filter((r) => !ROLES_VALIDOS.includes(r));
    if (rolesInvalidos.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Rol(es) inválido(s): ${rolesInvalidos.join(', ')}. Roles disponibles: ${ROLES_VALIDOS.join(', ')}`,
      });
    }

    const objetivo = await prisma.user.findUnique({ where: { id } });
    if (!objetivo) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    if (objetivo.esCuentaMaestra) {
      return res.status(403).json({
        success: false,
        message: 'No se pueden cambiar los roles de la cuenta maestra del sistema.',
      });
    }

    // No puedes quitarte a ti mismo el rol de Administrador
    if (id === req.user.id && !roles.includes('Administrador')) {
      return res.status(400).json({
        success: false,
        message: 'No puedes quitarte a ti mismo el rol de Administrador.',
      });
    }

    // Quitar duplicados
    const rolesUnicos = [...new Set(roles)];

    const actualizado = await prisma.user.update({
      where: { id },
      data: { roles: rolesUnicos },
      select: { id: true, nombre: true, email: true, roles: true },
    });

    return res.json({
      success: true,
      message: `Roles de ${actualizado.nombre} actualizados a: ${rolesUnicos.join(', ')}.`,
      data: actualizado,
    });
  } catch (error) {
    console.error('Error al cambiar roles:', error);
    return res.status(500).json({ success: false, message: 'Error al cambiar los roles.' });
  }
};

// PATCH /api/usuarios/:id/resetear-password
// Genera una contraseña temporal aleatoria, la hashea y la envía por correo.
// Nunca se devuelve la contraseña en la respuesta HTTP (solo se confirma el envío).
const resetearPassword = async (req, res) => {
  try {
    const { id } = req.params;

    const objetivo = await prisma.user.findUnique({ where: { id } });
    if (!objetivo) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    // Contraseña temporal alfanumérica de 10 caracteres
    const passwordTemporal = crypto
      .randomBytes(8)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 10);

    const passwordHash = await bcrypt.hash(passwordTemporal, SALT_ROUNDS);

    await prisma.user.update({
      where: { id },
      data: { password: passwordHash },
    });

    try {
      await emailService.sendResetPassword({
        nombre: objetivo.nombre,
        email: objetivo.email,
        passwordTemporal,
      });
    } catch (emailError) {
      console.error('⚠️ No se pudo enviar el correo de restablecimiento:', emailError.message);
      return res.status(502).json({
        success: false,
        message: 'La contraseña se restableció pero no se pudo enviar el correo de notificación.',
      });
    }

    return res.json({
      success: true,
      message: `Se restableció la contraseña de ${objetivo.nombre} y se envió por correo.`,
    });
  } catch (error) {
    console.error('Error al resetear contraseña:', error);
    return res.status(500).json({ success: false, message: 'Error al restablecer la contraseña.' });
  }
};

// PATCH /api/usuarios/:id/desactivar
// Desactiva una cuenta. No se puede desactivar la cuenta maestra.
const desactivar = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'No puedes desactivar tu propia cuenta.',
      });
    }

    const objetivo = await prisma.user.findUnique({ where: { id } });
    if (!objetivo) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    if (objetivo.esCuentaMaestra) {
      return res.status(403).json({
        success: false,
        message: 'La cuenta maestra del sistema no puede ser desactivada.',
      });
    }

    const actualizado = await prisma.user.update({
      where: { id },
      data: { activo: false },
      select: { id: true, nombre: true, email: true },
    });

    return res.json({
      success: true,
      message: `Cuenta de ${actualizado.nombre} desactivada.`,
      data: actualizado,
    });
  } catch (error) {
    console.error('Error al desactivar usuario:', error);
    return res.status(500).json({ success: false, message: 'Error al desactivar la cuenta.' });
  }
};

// POST /api/usuarios/invitar
// Envía un correo de invitación. Body: { email: 'x@uanl.edu.mx' }
const invitar = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'El correo es obligatorio.' });
    }

    const emailLimpio = email.toLowerCase().trim();
    if (!validarCorreoUANL(emailLimpio)) {
      return res.status(400).json({
        success: false,
        message: 'El correo debe ser institucional (@uanl.edu.mx).',
      });
    }

    await emailService.sendInvitacion({
      email:       emailLimpio,
      invitadoPor: req.user.nombre,
    });

    console.log(`📧 Invitación enviada a ${emailLimpio} por ${req.user.nombre}`);

    return res.json({
      success: true,
      message: `Invitación enviada a ${emailLimpio}.`,
    });
  } catch (error) {
    console.error('Error al enviar invitación:', error);
    return res.status(500).json({ success: false, message: 'Error al enviar la invitación.' });
  }
};

module.exports = { listar, listarPendientes, aprobar, rechazar, cambiarRoles, resetearPassword, desactivar, invitar };
