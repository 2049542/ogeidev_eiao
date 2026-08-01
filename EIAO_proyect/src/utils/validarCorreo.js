// ============================================================
// validarCorreo.js — Validación de correo institucional UANL.
//
// Todo correo usado en el sistema debe terminar en @uanl.edu.mx,
// salvo la cuenta maestra admin@eiao.mx (única excepción permitida).
// ============================================================

const REGEX_UANL = /^[a-zA-Z0-9._%+-]+@uanl\.edu\.mx$/i;
const CUENTA_MAESTRA = 'admin@eiao.mx';

// Devuelve true si el correo es institucional @uanl.edu.mx,
// o si es la cuenta maestra admin@eiao.mx.
function validarCorreoUANL(email) {
  if (!email) return false;
  const emailLimpio = email.toLowerCase().trim();
  if (emailLimpio === CUENTA_MAESTRA) return true;
  return REGEX_UANL.test(emailLimpio);
}

module.exports = { validarCorreoUANL, CUENTA_MAESTRA };
