// ============================================================
// auth.controller.js — Lógica de autenticación.
//
// Maneja registro, login, perfil y logout.
// Validaciones:
//   - El correo debe ser @uanl.edu.mx
//   - La contraseña se hashea con bcrypt (12 rondas)
//   - El login devuelve un JWT (24h) + refresh token en cookie httpOnly (7d)
//   - Las cuentas nuevas quedan en pendienteAprobacion = true
// ============================================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { validarCorreoUANL } = require('../utils/validarCorreo');

const prisma = new PrismaClient();
const SALT_ROUNDS = 12; // Rondas de bcrypt — 12 es el estándar de seguridad actual

// Genera un JWT de acceso (corta duración)
const generarToken = (userId, roles) => {
  return jwt.sign({ userId, roles }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });
};

// Genera un refresh token (larga duración, va en cookie httpOnly)
const generarRefreshToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
};

// POST /api/auth/register
// Registra un nuevo usuario. La cuenta queda pendiente hasta aprobación del admin.
const register = async (req, res) => {
  try {
    const { nombre, email, password, area } = req.body;

    // Validar campos obligatorios
    if (!nombre || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nombre, email y contraseña son obligatorios.',
      });
    }

    // Validar que sea correo institucional UANL
    const emailLimpio = email.toLowerCase().trim();
    if (!validarCorreoUANL(emailLimpio)) {
      return res.status(400).json({
        success: false,
        message: 'El correo debe ser institucional (@uanl.edu.mx).',
      });
    }

    // Validar longitud mínima de contraseña
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 8 caracteres.',
      });
    }

    // Verificar que el correo no esté ya registrado
    const existente = await prisma.user.findUnique({ where: { email: emailLimpio } });
    if (existente) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una cuenta con ese correo electrónico.',
      });
    }

    // Hashear la contraseña con bcrypt antes de guardarla
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Crear el usuario — pendienteAprobacion = true por defecto
    const usuario = await prisma.user.create({
      data: {
        nombre: nombre.trim(),
        email: emailLimpio,
        password: passwordHash,
        areaSolicitada: area ? String(area).trim() : null,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        roles: true,
        pendienteAprobacion: true,
        areaSolicitada: true,
        createdAt: true,
      },
    });

    console.log(`✅ Nuevo registro: ${usuario.email} — pendiente de aprobación`);

    return res.status(201).json({
      success: true,
      message:
        'Cuenta creada exitosamente. Un administrador revisará y aprobará tu acceso pronto.',
      data: usuario,
    });
  } catch (error) {
    console.error('Error en register:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al crear la cuenta.',
    });
  }
};

// POST /api/auth/login
// Verifica credenciales y devuelve JWT + refresh token en cookie.
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Correo y contraseña son obligatorios.',
      });
    }

    const emailLimpio = email.toLowerCase().trim();

    // Buscar usuario (incluir password para comparar)
    const usuario = await prisma.user.findUnique({
      where: { email: emailLimpio },
    });

    // Mensaje genérico para no revelar si el correo existe o no (seguridad)
    const credencialesInvalidas = {
      success: false,
      message: 'Correo o contraseña incorrectos.',
    };

    if (!usuario) return res.status(401).json(credencialesInvalidas);

    // Comparar la contraseña ingresada con el hash almacenado
    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) return res.status(401).json(credencialesInvalidas);

    // Se revisa primero pendienteAprobacion: una cuenta nueva tiene activo=false
    // Y pendienteAprobacion=true, y el mensaje correcto para ese caso es "pendiente",
    // no "desactivada" (ese mensaje es solo para cuentas que un admin desactivó).
    if (usuario.pendienteAprobacion) {
      return res.status(403).json({
        success: false,
        message: 'Tu cuenta está pendiente de aprobación por un administrador.',
      });
    }

    if (!usuario.activo) {
      return res.status(401).json({
        success: false,
        message: 'Tu cuenta ha sido desactivada. Contacta al administrador.',
      });
    }

    // Generar tokens
    const token = generarToken(usuario.id, usuario.roles);
    const refreshToken = generarRefreshToken(usuario.id);

    // Guardar refresh token en cookie httpOnly (no accesible desde JS del navegador)
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días en milisegundos
    });

    console.log(`🔐 Login exitoso: ${usuario.email} (${usuario.roles.join(', ')})`);

    return res.json({
      success: true,
      message: 'Sesión iniciada correctamente.',
      data: {
        token,
        usuario: {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          roles: usuario.roles,
        },
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión.',
    });
  }
};

// GET /api/auth/me
// Devuelve los datos del usuario autenticado (sin la contraseña).
const me = async (req, res) => {
  try {
    const usuario = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        nombre: true,
        email: true,
        roles: true,
        activo: true,
        createdAt: true,
      },
    });

    return res.json({
      success: true,
      data: usuario,
    });
  } catch (error) {
    console.error('Error en me:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener perfil.' });
  }
};

// POST /api/auth/logout
// Limpia la cookie del refresh token del navegador.
const logout = (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  return res.json({
    success: true,
    message: 'Sesión cerrada correctamente.',
  });
};

module.exports = { register, login, me, logout };
