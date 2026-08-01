// ============================================================
// seed.js — Datos iniciales para la base de datos EIAO.
//
// Ejecutar con: npm run db:seed
//
// Crea la cuenta maestra, usuarios de prueba (uno por rol) y
// carga el inventario inicial desde inventario_sala_computo_1.csv.
// Usa upsert para poder ejecutarse múltiples veces sin errores.
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

// Convierte el TIPO_EQUIPO del CSV ("CPU", "MONITOR") al valor esperado
// por el inventario ("CPU", "Monitor", ...).
function normalizarTipoEquipo(tipo) {
  const mapa = {
    CPU: 'CPU',
    MONITOR: 'Monitor',
    IMPRESORA: 'Impresora',
    LAPTOP: 'Laptop',
    PROYECTOR: 'Proyector',
    ESCANER: 'Escáner',
  };
  return mapa[(tipo || '').toUpperCase().trim()] || 'Otro';
}

// Lee y parsea inventario_sala_computo_1.csv (columnas:
// TIPO_EQUIPO,PATR_CI,MODELO,DESCRIPCION,SERIE,OBSERVACION) y lo
// convierte en filas listas para Inventario.createMany.
function cargarEquiposDesdeCSV() {
  const csvPath = path.join(__dirname, '../../inventario_sala_computo_1.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('⏩ No se encontró inventario_sala_computo_1.csv, se omite la carga de inventario.\n');
    return [];
  }

  const lineas = fs.readFileSync(csvPath, 'utf-8').split(/\r?\n/).filter((l) => l.trim() !== '');
  const [, ...filas] = lineas; // omitir encabezado

  return filas.map((linea) => {
    const [tipoEquipo, patrCi, modelo, descripcion, serie, observacion] = linea.split(',').map((v) => (v || '').trim());
    const esDanado = /dañado/i.test(observacion);
    return {
      departamento: 'Sala de Cómputo 1 (Dibujo Industrial)',
      ubicacion: 'Sala de Cómputo 1',
      tipoEquipo: normalizarTipoEquipo(tipoEquipo),
      noPatrimonio: patrCi || null,
      marca: descripcion || null,
      modelo: modelo || null,
      noSerie: serie || null,
      estado: esDanado ? 'Dañado' : 'Bueno',
      fechaRegistro: new Date('2025-08-01'),
      observaciones: observacion || null,
    };
  });
}

async function main() {
  console.log('\n🌱 Iniciando seed de la base de datos EIAO...\n');

  // ── CONTRASEÑAS ───────────────────────────────────────────────
  const passAdmin  = await bcrypt.hash('Admin.EIAO.2026', SALT_ROUNDS);
  const passTest   = await bcrypt.hash('Test.2026!', SALT_ROUNDS);

  // ── CUENTA MAESTRA ────────────────────────────────────────────
  // admin@eiao.mx — esta cuenta NO se puede eliminar ni desactivar.
  const admin = await prisma.user.upsert({
    where: { email: 'admin@eiao.mx' },
    update: {},
    create: {
      nombre:              'Admin EIAO',
      email:               'admin@eiao.mx',
      password:            passAdmin,
      roles:               ['Administrador'],
      activo:              true,
      pendienteAprobacion: false,
      esCuentaMaestra:     true,
    },
  });
  console.log(`✅ Cuenta maestra: ${admin.email}`);

  // ── USUARIOS DE PRUEBA ────────────────────────────────────────
  const soporte = await prisma.user.upsert({
    where: { email: 'soporte@uanl.edu.mx' },
    update: {},
    create: {
      nombre: 'Carlos Soporte', email: 'soporte@uanl.edu.mx',
      password: passTest, roles: ['SoporteTecnico'],
      activo: true, pendienteAprobacion: false,
    },
  });

  const auditorio = await prisma.user.upsert({
    where: { email: 'auditorio@uanl.edu.mx' },
    update: {},
    create: {
      nombre: 'María Auditorio', email: 'auditorio@uanl.edu.mx',
      password: passTest, roles: ['Auditorio'],
      activo: true, pendienteAprobacion: false,
    },
  });

  const mant = await prisma.user.upsert({
    where: { email: 'mant@uanl.edu.mx' },
    update: {},
    create: {
      nombre: 'Luis Mantenimiento', email: 'mant@uanl.edu.mx',
      password: passTest, roles: ['Mantenimiento'],
      activo: true, pendienteAprobacion: false,
    },
  });

  const avisos = await prisma.user.upsert({
    where: { email: 'avisos@uanl.edu.mx' },
    update: {},
    create: {
      nombre: 'Ana Avisos', email: 'avisos@uanl.edu.mx',
      password: passTest, roles: ['Avisos'],
      activo: true, pendienteAprobacion: false,
    },
  });

  const ayuda = await prisma.user.upsert({
    where: { email: 'ayuda@uanl.edu.mx' },
    update: {},
    create: {
      nombre: 'Diana Centro Ayuda', email: 'ayuda@uanl.edu.mx',
      password: passTest, roles: ['CentroDeAyuda'],
      activo: true, pendienteAprobacion: false,
    },
  });

  const tecnico = await prisma.user.upsert({
    where: { email: 'tecnico@uanl.edu.mx' },
    update: {},
    create: {
      nombre: 'Roberto Técnico', email: 'tecnico@uanl.edu.mx',
      password: passTest, roles: ['Tecnico'],
      activo: true, pendienteAprobacion: false,
    },
  });

  const servicioSocial = await prisma.user.upsert({
    where: { email: 'prestador@uanl.edu.mx' },
    update: {},
    create: {
      nombre: 'Diego Servicio Social', email: 'prestador@uanl.edu.mx',
      password: passTest, roles: ['ServicioSocial'],
      activo: true, pendienteAprobacion: false,
    },
  });

  const docente = await prisma.user.upsert({
    where: { email: 'maestro@uanl.edu.mx' },
    update: {},
    create: {
      nombre: 'Prof. Jorge Sánchez', email: 'maestro@uanl.edu.mx',
      password: passTest, roles: ['DocenteAdministrativo'],
      activo: true, pendienteAprobacion: false,
    },
  });

  // Usuario pendiente para probar flujo de aprobación
  await prisma.user.upsert({
    where: { email: 'pendiente@uanl.edu.mx' },
    update: {},
    create: {
      nombre: 'Usuario Pendiente', email: 'pendiente@uanl.edu.mx',
      password: passTest, roles: ['DocenteAdministrativo'],
      activo: false, pendienteAprobacion: true,
    },
  });

  console.log('✅ Usuarios de prueba creados (1 por cada rol)\n');

  // ── TICKETS ───────────────────────────────────────────────────
  const ticketsCt = await prisma.ticket.count();
  if (ticketsCt === 0) {
    await prisma.ticket.createMany({
      data: [
        {
          titulo: 'Cámara CCTV sector B sin señal',
          descripcion: 'La cámara en el pasillo del sector B no transmite imagen desde el lunes.',
          area: 'SoporteTecnico', tipo: 'CCTV',
          prioridad: 'ALTA', status: 'EnProceso',
          userId: docente.id, asignadoA: soporte.id, slaHoras: 24,
        },
        {
          titulo: 'Micrófono del auditorio con intermitencia',
          descripcion: 'El micrófono inalámbrico falla durante los eventos. Necesito usarlo el viernes.',
          area: 'SoporteTecnico', tipo: 'AV',
          prioridad: 'URGENTE', status: 'Pendiente',
          userId: docente.id, slaHoras: 8,
        },
        {
          titulo: 'No puedo iniciar sesión en SIGA',
          descripcion: 'Mi contraseña de SIGA no funciona desde ayer. Necesito acceso para captura.',
          area: 'CentroDeAyuda', tipo: 'CONTRASENA_INTERNA',
          prioridad: 'ALTA', status: 'Resuelto',
          seguimiento: 'Contraseña restablecida exitosamente.',
          userId: docente.id, asignadoA: ayuda.id, atendidoPorId: ayuda.id,
          atendidoAt: new Date(), resolucionAt: new Date(),
          resolucionMensaje: 'Contraseña restablecida y verificada con el usuario.',
          resolvedAt: new Date(),
        },
      ],
    });
    console.log('✅ 3 tickets de ejemplo creados\n');
  } else {
    console.log('⏩ Tickets ya existen, omitiendo\n');
  }

  // ── INVENTARIO (desde inventario_sala_computo_1.csv) ────────────
  const invCt = await prisma.inventario.count();
  if (invCt === 0) {
    const equipos = cargarEquiposDesdeCSV();
    if (equipos.length > 0) {
      const resultado = await prisma.inventario.createMany({ data: equipos });
      console.log(`✅ ${resultado.count} equipo(s) de inventario cargados desde CSV\n`);
    }
  } else {
    console.log('⏩ Inventario ya existe, omitiendo\n');
  }

  // ── RESERVACIONES ─────────────────────────────────────────────
  const reservCt = await prisma.reservacion.count();
  if (reservCt === 0) {
    const hoy = new Date();
    const en3dias = new Date(hoy.getTime() + 3 * 24 * 60 * 60 * 1000);
    const en7dias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000);

    await prisma.reservacion.createMany({
      data: [
        {
          evento: 'Conferencia: Innovación Tecnológica',
          fecha: en3dias, horaInicio: '10:00', horaFin: '13:00',
          asistentes: 120, equipo: JSON.stringify(['Proyector', 'Micrófono']),
          status: 'APROBADA', userId: docente.id, aprobadoPor: admin.id,
        },
        {
          evento: 'Clausura Semestral — Ingeniería Industrial',
          fecha: en7dias, horaInicio: '09:00', horaFin: '14:00',
          asistentes: 200, notas: 'Requiere sillas adicionales.',
          status: 'PENDIENTE', userId: docente.id,
        },
      ],
    });
    console.log('✅ 2 reservaciones creadas (1 aprobada, 1 pendiente)\n');
  } else {
    console.log('⏩ Reservaciones ya existen, omitiendo\n');
  }

  // ── SOLICITUD CCTV ────────────────────────────────────────────
  const grabCt = await prisma.solicitudGrabacion.count();
  if (grabCt === 0) {
    const hace2dias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await prisma.solicitudGrabacion.create({
      data: {
        motivo:      'Investigación — posible robo de equipo',
        zona:        'Cámara C7 — Pasillo Laboratorios',
        fecha:       hace2dias,
        horaInicio:  '14:00',
        horaFin:     '18:00',
        descripcion: 'Desapareció una laptop del laboratorio de cómputo.',
        personas:    'Desconocido. Sudadera gris, cabello corto.',
        urgencia:    'Urgente',
        status:      'EN_PROCESO',
        userId:      docente.id,
      },
    });
    console.log('✅ 1 solicitud de grabación CCTV creada\n');
  }

  // ── SOLUCIONES RÁPIDAS ────────────────────────────────────────
  const solCt = await prisma.solucionRapida.count();
  if (solCt === 0) {
    await prisma.solucionRapida.createMany({
      data: [
        {
          problema: 'El proyector no muestra imagen aunque está encendido',
          solucion: 'Verifica que el cable HDMI esté bien conectado en ambos extremos. Cambia la fuente de video del proyector con el control remoto (botón "Source"/"Input") hasta encontrar la entrada correcta. Si usas un adaptador USB-C o VGA, revisa que no esté flojo.',
          userId: tecnico.id,
        },
        {
          problema: 'La laptop no se conecta al WiFi institucional',
          solucion: 'Olvida la red WiFi en la configuración del equipo y vuelve a conectarte capturando usuario y contraseña institucional (@uanl.edu.mx). Si el problema persiste, reinicia el adaptador de red o el equipo. Verifica también que el modo avión esté apagado.',
          userId: tecnico.id,
        },
        {
          problema: 'La impresora no imprime o marca "sin conexión"',
          solucion: 'Revisa que la impresora esté encendida y con papel/tóner suficiente. En Windows, ve a Configuración > Impresoras y escáneres, quita la impresora y vuelve a agregarla. Si sigue sin conexión, reinicia el spooler de impresión o el equipo.',
          userId: mant.id,
        },
        {
          problema: 'El cable HDMI conecta pero no hay audio en la sala',
          solucion: 'El audio por HDMI depende de que la salida de sonido de Windows esté configurada al dispositivo correcto: clic derecho en el ícono de volumen > dispositivos de reproducción > selecciona el proyector/pantalla como predeterminado.',
          userId: tecnico.id,
        },
      ],
    });
    console.log('✅ 4 soluciones rápidas de ejemplo creadas\n');
  } else {
    console.log('⏩ Soluciones rápidas ya existen, omitiendo\n');
  }

  // ── RESUMEN ───────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════');
  console.log('🎉 Seed completado exitosamente\n');
  console.log('📋 CREDENCIALES:');
  console.log('─────────────────────────────────────────────────────');
  console.log('👑 admin@eiao.mx              → Admin.EIAO.2026   (Cuenta maestra)');
  console.log('─────────────────────────────────────────────────────');
  console.log('🖥️  soporte@uanl.edu.mx       → Test.2026!  (SoporteTecnico)');
  console.log('🎭 auditorio@uanl.edu.mx     → Test.2026!  (Auditorio)');
  console.log('🔧 mant@uanl.edu.mx          → Test.2026!  (Mantenimiento)');
  console.log('🛠️  tecnico@uanl.edu.mx       → Test.2026!  (Tecnico)');
  console.log('📢 avisos@uanl.edu.mx        → Test.2026!  (Avisos)');
  console.log('💬 ayuda@uanl.edu.mx         → Test.2026!  (CentroDeAyuda)');
  console.log('👤 prestador@uanl.edu.mx     → Test.2026!  (ServicioSocial)');
  console.log('👨‍🏫 maestro@uanl.edu.mx       → Test.2026!  (DocenteAdministrativo)');
  console.log('⏳ pendiente@uanl.edu.mx     → Test.2026!  (Pendiente aprobación)');
  console.log('═══════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
