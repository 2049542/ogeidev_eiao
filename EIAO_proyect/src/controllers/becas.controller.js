// ============================================================
// becas.controller.js — Publicaciones de becas y financiamiento.
//
// Cuando se publica una beca:
//   1. Multer captura la imagen en memoria (req.file.buffer)
//   2. cloudinary.service la sube al CDN y devuelve la URL pública
//   3. Se guarda la publicación en la BD con la URL y el public_id
//   4. email.service envía correo masivo a todos los docentes registrados
// ============================================================

const { PrismaClient } = require('@prisma/client');
const cloudinaryService = require('../services/cloudinary.service');
const emailService = require('../services/email.service');

const prisma = new PrismaClient();

// Etiquetas de área disponibles para clasificar cada aviso
const ETIQUETAS_AREA = ['Auditorio', 'Difusión e Imagen', 'Soporte Técnico', 'Becas', 'Nexus', 'Centro de Ayuda', 'Seguridad'];

// GET /api/becas
// Lista todas las publicaciones de becas, más recientes primero, con el
// conteo de likes y si el usuario actual ya dio like.
const listar = async (req, res) => {
  try {
    const publicaciones = await prisma.becaPublicacion.findMany({
      include: {
        user: { select: { id: true, nombre: true } },
        _count: { select: { likes: true } },
        likes: { where: { userId: req.user.id }, select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = publicaciones.map((p) => ({
      ...p,
      likesCount: p._count.likes,
      likedByMe: p.likes.length > 0,
      likes: undefined,
      _count: undefined,
    }));

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error al listar becas:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener publicaciones.' });
  }
};

// POST /api/becas/:id/like
// Togglea el like del usuario actual sobre un aviso: si ya existe lo quita, si no lo crea.
const toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const aviso = await prisma.becaPublicacion.findUnique({ where: { id } });
    if (!aviso) {
      return res.status(404).json({ success: false, message: 'Publicación no encontrada.' });
    }

    const existente = await prisma.avisoLike.findUnique({
      where: { avisoId_userId: { avisoId: id, userId } },
    });

    let liked;
    if (existente) {
      await prisma.avisoLike.delete({ where: { id: existente.id } });
      liked = false;
    } else {
      await prisma.avisoLike.create({ data: { avisoId: id, userId } });
      liked = true;
    }

    const likesCount = await prisma.avisoLike.count({ where: { avisoId: id } });

    return res.json({
      success: true,
      message: liked ? 'Te gusta esta publicación.' : 'Ya no te gusta esta publicación.',
      data: { liked, likesCount },
    });
  } catch (error) {
    console.error('Error al togglear like:', error);
    return res.status(500).json({ success: false, message: 'Error al procesar el like.' });
  }
};

// POST /api/becas
// Publicar nueva beca con imagen. Require multipart/form-data con campo "imagen".
const publicar = async (req, res) => {
  try {
    const { titulo, descripcion, etiquetaArea } = req.body;

    if (!titulo || !descripcion) {
      return res.status(400).json({
        success: false,
        message: 'Título y descripción son obligatorios.',
      });
    }

    if (etiquetaArea && !ETIQUETAS_AREA.includes(etiquetaArea)) {
      return res.status(400).json({
        success: false,
        message: `Etiqueta de área inválida. Opciones: ${ETIQUETAS_AREA.join(', ')}`,
      });
    }

    // Verificar que se subió un archivo (manejarUpload ya validó tipo y tamaño)
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere una imagen (flyer o infografía).',
      });
    }

    // Subir imagen a Cloudinary desde el buffer en memoria
    console.log(`☁️  Subiendo imagen a Cloudinary: ${req.file.originalname}`);
    const resultadoCloud = await cloudinaryService.uploadImagen(req.file.buffer, 'eiao/becas');

    // Guardar la publicación en la base de datos
    const publicacion = await prisma.becaPublicacion.create({
      data: {
        titulo,
        descripcion,
        imageUrl: resultadoCloud.secure_url,        // URL pública con HTTPS
        publicCloudinaryId: resultadoCloud.public_id, // Para poder eliminarla después
        etiquetaArea: etiquetaArea || 'Becas',
        userId: req.user.id,
      },
      include: {
        user: { select: { id: true, nombre: true } },
      },
    });

    // Obtener todos los correos de docentes activos y aprobados
    const docentes = await prisma.user.findMany({
      where: {
        activo: true,
        pendienteAprobacion: false,
      },
      select: { email: true },
    });

    const correos = docentes.map((d) => d.email);

    // Enviar notificación masiva por correo
    let notificadoAt = null;
    if (correos.length > 0) {
      try {
        await emailService.sendBecaNotificacion({
          destinatarios: correos,
          titulo,
          descripcion,
          imageUrl: resultadoCloud.secure_url,
        });
        notificadoAt = new Date();

        // Registrar cuándo se envió la notificación
        await prisma.becaPublicacion.update({
          where: { id: publicacion.id },
          data: { notificadoAt },
        });

        console.log(`📧 Notificación de beca enviada a ${correos.length} docente(s).`);
      } catch (emailError) {
        console.error('⚠️ No se pudo enviar notificación de beca:', emailError.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: `Beca publicada. ${correos.length > 0 ? `Se notificó a ${correos.length} docente(s).` : 'Sin usuarios para notificar.'}`,
      data: { ...publicacion, notificadoAt },
    });
  } catch (error) {
    console.error('Error al publicar beca:', error);
    return res.status(500).json({ success: false, message: 'Error al publicar la beca.' });
  }
};

// PATCH /api/becas/:id
// Actualiza una publicación existente. Si se envía una nueva imagen,
// sube la nueva a Cloudinary y elimina la anterior.
const actualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descripcion, etiquetaArea } = req.body;

    const publicacion = await prisma.becaPublicacion.findUnique({ where: { id } });
    if (!publicacion) {
      return res.status(404).json({ success: false, message: 'Publicación no encontrada.' });
    }

    if (etiquetaArea && !ETIQUETAS_AREA.includes(etiquetaArea)) {
      return res.status(400).json({
        success: false,
        message: `Etiqueta de área inválida. Opciones: ${ETIQUETAS_AREA.join(', ')}`,
      });
    }

    const data = {};
    if (titulo !== undefined && titulo !== '') data.titulo = titulo;
    if (descripcion !== undefined && descripcion !== '') data.descripcion = descripcion;
    if (etiquetaArea !== undefined && etiquetaArea !== '') data.etiquetaArea = etiquetaArea;

    // Si se subió una imagen nueva, reemplazar en Cloudinary
    if (req.file) {
      console.log(`☁️  Reemplazando imagen en Cloudinary: ${req.file.originalname}`);
      const resultadoCloud = await cloudinaryService.uploadImagen(req.file.buffer, 'eiao/becas');
      data.imageUrl = resultadoCloud.secure_url;
      data.publicCloudinaryId = resultadoCloud.public_id;

      try {
        await cloudinaryService.deleteImagen(publicacion.publicCloudinaryId);
        console.log(`🗑️  Imagen anterior eliminada de Cloudinary: ${publicacion.publicCloudinaryId}`);
      } catch (cloudError) {
        console.error('⚠️ No se pudo eliminar la imagen anterior de Cloudinary:', cloudError.message);
      }
    }

    const actualizada = await prisma.becaPublicacion.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, nombre: true } },
      },
    });

    return res.json({
      success: true,
      message: 'Publicación actualizada correctamente.',
      data: actualizada,
    });
  } catch (error) {
    console.error('Error al actualizar beca:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar la publicación.' });
  }
};

// DELETE /api/becas/:id
// Elimina la publicación de la BD Y la imagen de Cloudinary.
const eliminar = async (req, res) => {
  try {
    const { id } = req.params;

    const publicacion = await prisma.becaPublicacion.findUnique({ where: { id } });
    if (!publicacion) {
      return res.status(404).json({ success: false, message: 'Publicación no encontrada.' });
    }

    // Eliminar imagen de Cloudinary primero
    try {
      await cloudinaryService.deleteImagen(publicacion.publicCloudinaryId);
      console.log(`🗑️  Imagen eliminada de Cloudinary: ${publicacion.publicCloudinaryId}`);
    } catch (cloudError) {
      console.error('⚠️ No se pudo eliminar imagen de Cloudinary:', cloudError.message);
      // Continuamos aunque falle Cloudinary para no dejar datos huérfanos en la BD
    }

    // Eliminar de la base de datos
    await prisma.becaPublicacion.delete({ where: { id } });

    return res.json({
      success: true,
      message: 'Publicación eliminada correctamente.',
    });
  } catch (error) {
    console.error('Error al eliminar beca:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar la publicación.' });
  }
};

module.exports = { listar, publicar, actualizar, eliminar, toggleLike };
