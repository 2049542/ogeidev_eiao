// ============================================================
// email.service.js — Servicio centralizado de correo electrónico.
//
// Usa Resend (resend.com) para enviar correos transaccionales
// con plantillas HTML profesionales en español.
//
// Funciones disponibles:
//   - sendBienvenida: cuando admin aprueba una cuenta nueva
//   - sendBecaNotificacion: nueva beca publicada → todos los docentes
//   - sendGrabacionConfirmacion: confirma recepción de solicitud CCTV
//   - sendReservacionAprobada: auditorio aprobado
//   - sendReservacionRechazada: auditorio rechazado con motivo
//   - sendInvitacion: invitar a un nuevo usuario al sistema
//   - sendTicketResuelto: notificar que un ticket fue resuelto
// ============================================================

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'EIAO UANL <noreply@eiao.uanl.mx>';

// ── Estilos comunes para todas las plantillas ────────────────
const estilosBase = `
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
  .header { background: #7B1D1D; padding: 30px; text-align: center; }
  .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 1px; }
  .header p { color: #f5c0c0; margin: 5px 0 0; font-size: 13px; }
  .body { padding: 32px; color: #333333; }
  .body h2 { color: #7B1D1D; margin-top: 0; }
  .body p { line-height: 1.6; }
  .badge { display: inline-block; background: #f0e6e6; color: #7B1D1D; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
  .btn { display: inline-block; background: #7B1D1D; color: #ffffff !important; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0; }
  .divider { height: 1px; background: #eeeeee; margin: 24px 0; }
  .footer { background: #f9f9f9; padding: 20px; text-align: center; color: #999999; font-size: 12px; border-top: 1px solid #eeeeee; }
  .info-box { background: #fdf6f6; border-left: 4px solid #7B1D1D; padding: 16px; border-radius: 0 6px 6px 0; margin: 16px 0; }
  .info-row { display: flex; margin-bottom: 8px; }
  .info-label { font-weight: 600; min-width: 140px; color: #555555; }
`;

// ── Plantilla base HTML ───────────────────────────────────────
const plantillaHTML = (titulo, subtitulo, cuerpo) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
  <style>${estilosBase}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>EIAO — Escuela Industrial y Preparatoria Técnica Álvaro Obregón</h1>
      <p>Sistema de Gestión Interna | UANL</p>
    </div>
    <div class="body">
      <h2>${titulo}</h2>
      ${subtitulo ? `<p>${subtitulo}</p>` : ''}
      <div class="divider"></div>
      ${cuerpo}
    </div>
    <div class="footer">
      <p>Este correo fue generado automáticamente por el sistema EIAO.</p>
      <p>Si tienes dudas, contacta al administrador del sistema.</p>
      <p style="margin-top:8px; color: #7B1D1D; font-weight:600;">© 2024 EIAO — Universidad Autónoma de Nuevo León</p>
    </div>
  </div>
</body>
</html>
`;

// ── 1. Correo de bienvenida (cuando admin aprueba la cuenta) ──
const sendBienvenida = async ({ nombre, email, rol }) => {
  const cuerpo = `
    <p>Hola <strong>${nombre}</strong>,</p>
    <p>Tu cuenta en el sistema de gestión interna de la EIAO ha sido <strong>aprobada</strong> por un administrador.</p>
    <div class="info-box">
      <div><span class="info-label">Correo:</span> ${email}</div>
      <div style="margin-top:8px"><span class="info-label">Rol asignado:</span> <span class="badge">${rol}</span></div>
    </div>
    <p>Ya puedes iniciar sesión y acceder a los módulos correspondientes a tu área.</p>
    <p style="color:#888; font-size:13px;">Si tienes algún problema para iniciar sesión, contacta al área de soporte.</p>
  `;
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: '✅ Tu cuenta EIAO ha sido aprobada',
    html: plantillaHTML('Cuenta Aprobada', '¡Bienvenido al sistema de gestión interna!', cuerpo),
  });
};

// ── 1b. Solicitud de registro rechazada por un administrador ──
const sendRechazoSolicitud = async ({ nombre, email }) => {
  const cuerpo = `
    <p>Hola <strong>${nombre}</strong>,</p>
    <p>Tu solicitud de acceso al sistema de gestión interna de la EIAO fue <strong style="color:#c0392b;">rechazada</strong> por un administrador.</p>
    <p>Si consideras que esto es un error o necesitas más información, contacta directamente al administrador del sistema.</p>
  `;
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Tu solicitud de acceso EIAO fue rechazada',
    html: plantillaHTML('Solicitud Rechazada', 'Tu solicitud de acceso no fue aprobada', cuerpo),
  });
};

// ── 2. Notificación de nueva beca a todos los docentes ────────
const sendBecaNotificacion = async ({ destinatarios, titulo, descripcion, imageUrl }) => {
  const cuerpo = `
    <p>El área de <strong>Becas y Financiamiento</strong> ha publicado una nueva oportunidad:</p>
    <div class="info-box">
      <p style="font-size:18px; font-weight:700; color:#7B1D1D; margin:0 0 8px;">${titulo}</p>
      <p style="margin:0; color:#555;">${descripcion}</p>
    </div>
    ${imageUrl ? `<img src="${imageUrl}" alt="Flyer de beca" style="width:100%; max-width:560px; border-radius:6px; margin:16px 0;">` : ''}
    <p>Ingresa al sistema para más detalles.</p>
  `;
  // Resend soporta múltiples destinatarios en el campo "to"
  return resend.emails.send({
    from: FROM,
    to: destinatarios,
    subject: `📚 Nueva beca disponible: ${titulo}`,
    html: plantillaHTML('Nueva Publicación de Becas', 'Oportunidad de beca o financiamiento disponible', cuerpo),
  });
};

// ── 3. Confirmación de solicitud de grabación CCTV ────────────
const sendGrabacionConfirmacion = async ({ nombre, email, zona, fecha, horaInicio, horaFin }) => {
  const cuerpo = `
    <p>Hola <strong>${nombre}</strong>,</p>
    <p>Tu solicitud de grabación del sistema CCTV ha sido <strong>recibida correctamente</strong>.</p>
    <div class="info-box">
      <div><span class="info-label">Zona/Cámara:</span> ${zona}</div>
      <div style="margin-top:8px"><span class="info-label">Fecha:</span> ${fecha}</div>
      <div style="margin-top:8px"><span class="info-label">Horario:</span> ${horaInicio} – ${horaFin}</div>
    </div>
    <p>El equipo de <strong>Soporte Técnico</strong> revisará tu solicitud y te notificará cuando esté lista.</p>
    <p style="color:#888; font-size:13px;">Si es urgente, comunícate directamente con el área de seguridad.</p>
  `;
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: '📹 Solicitud de grabación CCTV recibida',
    html: plantillaHTML('Solicitud de Grabación Recibida', 'Tu solicitud está siendo procesada', cuerpo),
  });
};

// ── 4a. Reservación de auditorio aprobada ─────────────────────
const sendReservacionAprobada = async ({ nombre, email, evento, fecha, horaInicio, horaFin }) => {
  const cuerpo = `
    <p>Hola <strong>${nombre}</strong>,</p>
    <p>Tu reservación del auditorio ha sido <strong style="color:#2d8a4e;">aprobada</strong>. El evento ya aparece en el calendario.</p>
    <div class="info-box">
      <div><span class="info-label">Evento:</span> ${evento}</div>
      <div style="margin-top:8px"><span class="info-label">Fecha:</span> ${new Date(fecha).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      <div style="margin-top:8px"><span class="info-label">Horario:</span> ${horaInicio} – ${horaFin}</div>
    </div>
    <p>Recuerda llegar con tiempo para preparar el espacio. Si necesitas cancelar, hazlo con al menos 24 horas de anticipación.</p>
  `;
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: '✅ Reservación de Auditorio Aprobada',
    html: plantillaHTML('Reservación Aprobada', '¡Tu evento está confirmado en el auditorio!', cuerpo),
  });
};

// ── 4b. Reservación de auditorio rechazada ────────────────────
const sendReservacionRechazada = async ({ nombre, email, evento, fecha, motivo }) => {
  const cuerpo = `
    <p>Hola <strong>${nombre}</strong>,</p>
    <p>Tu reservación del auditorio ha sido <strong style="color:#c0392b;">rechazada</strong>.</p>
    <div class="info-box">
      <div><span class="info-label">Evento:</span> ${evento}</div>
      <div style="margin-top:8px"><span class="info-label">Fecha solicitada:</span> ${new Date(fecha).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      ${motivo ? `<div style="margin-top:8px"><span class="info-label">Motivo:</span> ${motivo}</div>` : ''}
    </div>
    <p>Puedes volver a solicitar una reservación con fecha y horario diferentes. Si tienes dudas, contacta al administrador.</p>
  `;
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: '❌ Reservación de Auditorio Rechazada',
    html: plantillaHTML('Reservación Rechazada', 'Tu solicitud de auditorio no fue aprobada', cuerpo),
  });
};

// ── 5. Invitación de nuevo usuario ────────────────────────────
const sendInvitacion = async ({ email, invitadoPor }) => {
  const cuerpo = `
    <p>Has sido invitado a unirte al sistema de gestión interna de la <strong>EIAO UANL</strong> por <strong>${invitadoPor}</strong>.</p>
    <p>Para completar tu registro, accede al sistema con tu correo institucional <strong>@uanl.edu.mx</strong>.</p>
    <div class="info-box">
      <p style="margin:0;"><strong>Correo invitado:</strong> ${email}</p>
    </div>
    <p>Una vez registrado, un administrador revisará y aprobará tu cuenta.</p>
    <p style="color:#888; font-size:13px;">Si no esperabas esta invitación, ignora este correo.</p>
  `;
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: '🏫 Invitación al Sistema EIAO UANL',
    html: plantillaHTML('Invitación al Sistema', 'Has sido invitado al sistema de gestión interna', cuerpo),
  });
};

// ── 6b. Restablecimiento de contraseña por el administrador ──
const sendResetPassword = async ({ nombre, email, passwordTemporal }) => {
  const cuerpo = `
    <p>Hola <strong>${nombre}</strong>,</p>
    <p>Un administrador restableció la contraseña de tu cuenta en el sistema EIAO.</p>
    <div class="info-box">
      <div><span class="info-label">Correo:</span> ${email}</div>
      <div style="margin-top:8px"><span class="info-label">Contraseña temporal:</span> <span class="badge">${passwordTemporal}</span></div>
    </div>
    <p>Por seguridad, te recomendamos <strong>cambiar esta contraseña</strong> en cuanto inicies sesión.</p>
    <p style="color:#888; font-size:13px;">Si no solicitaste este cambio, contacta de inmediato al administrador del sistema.</p>
  `;
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: '🔑 Tu contraseña EIAO fue restablecida',
    html: plantillaHTML('Contraseña Restablecida', 'Un administrador generó una nueva contraseña temporal para tu cuenta', cuerpo),
  });
};

// ── 6c. Encuesta de satisfacción al resolver un ticket ────────
const sendEncuestaSatisfaccion = async ({ nombre, email, titulo, link }) => {
  const cuerpo = `
    <p>Hola <strong>${nombre}</strong>,</p>
    <p>Tu ticket <strong>"${titulo}"</strong> fue marcado como <strong style="color:#2d8a4e;">resuelto</strong>.</p>
    <p>Nos ayudaría mucho conocer tu opinión sobre la atención recibida.</p>
    <a href="${link}" class="btn">Responder encuesta de satisfacción</a>
    <p style="color:#888; font-size:13px;">Solo toma unos segundos y nos ayuda a mejorar el servicio.</p>
  `;
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: '⭐ ¿Cómo fue la atención de tu ticket?',
    html: plantillaHTML('Encuesta de Satisfacción', 'Tu opinión nos ayuda a mejorar', cuerpo),
  });
};

// ── 6. Notificación de ticket resuelto ────────────────────────
const sendTicketResuelto = async ({ nombre, email, titulo, area }) => {
  const cuerpo = `
    <p>Hola <strong>${nombre}</strong>,</p>
    <p>Tu ticket de soporte ha sido <strong style="color:#2d8a4e;">resuelto</strong>.</p>
    <div class="info-box">
      <div><span class="info-label">Ticket:</span> ${titulo}</div>
      <div style="margin-top:8px"><span class="info-label">Área:</span> <span class="badge">${area}</span></div>
    </div>
    <p>Si el problema persiste o tienes dudas sobre la resolución, puedes crear un nuevo ticket.</p>
  `;
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: '✅ Tu ticket ha sido resuelto',
    html: plantillaHTML('Ticket Resuelto', 'Tu solicitud de soporte fue atendida', cuerpo),
  });
};

module.exports = {
  sendBienvenida,
  sendRechazoSolicitud,
  sendBecaNotificacion,
  sendGrabacionConfirmacion,
  sendReservacionAprobada,
  sendReservacionRechazada,
  sendInvitacion,
  sendTicketResuelto,
  sendResetPassword,
  sendEncuestaSatisfaccion,
};
