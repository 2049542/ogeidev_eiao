// ============================================================
// upload.middleware.js — Configuración de Multer para subida de archivos.
//
// Usa memoryStorage: el archivo queda en RAM (req.file.buffer) y
// se transmite directamente a Cloudinary sin tocar el disco.
// Acepta imágenes (JPEG, PNG, WebP) y PDFs, máximo 10 MB.
// ============================================================

const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const tiposPermitidos = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];

  if (tiposPermitidos.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error('Tipo de archivo no permitido. Solo se aceptan imágenes (JPEG, PNG, WebP) o PDF.'),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

const uploadImagen = upload.single('imagen');

const manejarUpload = (req, res, next) => {
  uploadImagen(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'El archivo es demasiado grande. Máximo 10 MB.',
        });
      }
      return res.status(400).json({
        success: false,
        message: `Error al subir archivo: ${err.message}`,
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    next();
  });
};

module.exports = { manejarUpload };
