// ============================================================
// roles.middleware.js — Control de acceso basado en roles (RBAC).
//
// Después de que auth.middleware verifica el token y carga al
// usuario, este middleware verifica que alguno de los roles del
// usuario (req.user.roles es un arreglo — un usuario puede tener
// más de un rol) esté entre los permitidos para ese endpoint.
//
// Uso en las rutas:
//   router.get('/', verifyToken, requireRoles('Administrador', 'Avisos'), controller)
// ============================================================

// Definición centralizada de todos los roles del sistema
// Importa esto en cualquier archivo que necesite referenciar roles
const ROLES = {
  ADMINISTRADOR: 'Administrador',
  AVISOS: 'Avisos',
  SOPORTE_TECNICO: 'SoporteTecnico',
  AUDITORIO: 'Auditorio',
  MANTENIMIENTO: 'Mantenimiento',
  TECNICO: 'Tecnico',
  CENTRO_AYUDA: 'CentroDeAyuda',
  SERVICIO_SOCIAL: 'ServicioSocial',
  DOCENTE_ADMINISTRATIVO: 'DocenteAdministrativo',
};

// requireRoles recibe una lista de roles permitidos y devuelve un middleware.
// Si el usuario tiene al menos uno de esos roles, pasa. Si no, responde 403.
const requireRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    // req.user fue adjuntado por el middleware verifyToken
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado.',
      });
    }

    const rolesUsuario = req.user.roles || [];
    const tienePermiso = rolesPermitidos.some((r) => rolesUsuario.includes(r));

    if (!tienePermiso) {
      return res.status(403).json({
        success: false,
        message: `Acceso denegado. Se requiere uno de los siguientes roles: ${rolesPermitidos.join(', ')}.`,
      });
    }

    next();
  };
};

// Shortcut: solo administradores
const soloAdmin = requireRoles(ROLES.ADMINISTRADOR);

// Shortcut: admin + el rol del área correspondiente
const adminOAvisos = requireRoles(ROLES.ADMINISTRADOR, ROLES.AVISOS);
const adminOAuditorio = requireRoles(ROLES.ADMINISTRADOR, ROLES.AUDITORIO);
const adminOSoporte = requireRoles(ROLES.ADMINISTRADOR, ROLES.SOPORTE_TECNICO);
const adminOMantenimiento = requireRoles(ROLES.ADMINISTRADOR, ROLES.MANTENIMIENTO, ROLES.TECNICO);
const adminOCentroAyuda = requireRoles(ROLES.ADMINISTRADOR, ROLES.CENTRO_AYUDA, ROLES.TECNICO);

module.exports = {
  ROLES,
  requireRoles,
  soloAdmin,
  adminOAvisos,
  adminOAuditorio,
  adminOSoporte,
  adminOMantenimiento,
  adminOCentroAyuda,
};
