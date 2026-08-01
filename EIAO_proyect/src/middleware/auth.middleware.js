// ============================================================
// auth.middleware.js — Verificación de tokens JWT.
//
// Este middleware protege las rutas privadas. Antes de que
// cualquier petición llegue al controlador, verifica que:
//   1. El header Authorization exista y tenga formato "Bearer <token>"
//   2. El token sea válido y no haya expirado
//   3. El usuario en el token siga activo y aprobado en la BD
//
// Si todo es válido, adjunta el usuario a req.user y deja pasar.
// Si algo falla, responde con 401 (no autenticado).
// ============================================================

const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Verifica el token JWT y carga el usuario desde la base de datos
const verifyToken = async (req, res, next) => {
  try {
    // Extraer el token del header "Authorization: Bearer <token>"
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Acceso denegado. Token no proporcionado.',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verificar la firma y expiración del token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Sesión expirada. Vuelve a iniciar sesión.',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Token inválido.',
      });
    }

    // Cargar el usuario desde la BD para tener datos actualizados
    // (si un admin desactiva una cuenta, el token antiguo no debe funcionar)
    const usuario = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        nombre: true,
        email: true,
        roles: true,
        activo: true,
        pendienteAprobacion: true,
      },
    });

    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado.',
      });
    }

    if (usuario.pendienteAprobacion) {
      return res.status(403).json({
        success: false,
        message: 'Tu cuenta está pendiente de aprobación por un administrador.',
      });
    }

    if (!usuario.activo) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta desactivada. Contacta al administrador.',
      });
    }

    // Adjuntar el usuario al request para que los controladores lo usen
    req.user = usuario;
    next();
  } catch (error) {
    console.error('Error en verifyToken:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al verificar el token.',
    });
  }
};

module.exports = { verifyToken };
