// ============================================================
// cloudinary.service.js — Servicio de almacenamiento de imágenes.
//
// Cloudinary es el CDN donde guardamos las imágenes de becas y flyers.
// Este servicio expone dos funciones:
//   - uploadImagen: recibe el buffer del archivo (de Multer) y lo sube
//   - deleteImagen: elimina una imagen usando su public_id de Cloudinary
//
// Usamos upload_stream porque Multer guarda los archivos en memoria
// (buffer), no en disco, lo que es más seguro en servidores cloud.
// ============================================================

const cloudinary = require('cloudinary').v2;

// Configurar Cloudinary con las credenciales del .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Sube una imagen desde un buffer (memoria RAM) a Cloudinary.
// Devuelve una Promesa con el resultado de Cloudinary (url, public_id, etc.)
const uploadImagen = (buffer, carpeta = 'eiao/becas') => {
  return new Promise((resolve, reject) => {
    // upload_stream recibe el buffer y lo transmite a Cloudinary
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: carpeta,
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good' }, // Compresión automática inteligente
          { fetch_format: 'auto' }, // Formato óptimo (WebP si el browser lo soporta)
        ],
      },
      (error, result) => {
        if (error) {
          console.error('Error al subir imagen a Cloudinary:', error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    // Enviar el buffer al stream de Cloudinary
    stream.end(buffer);
  });
};

// Elimina una imagen de Cloudinary usando su public_id.
// El public_id se guarda en la BD al momento de subir la imagen.
const deleteImagen = async (publicId) => {
  try {
    const resultado = await cloudinary.uploader.destroy(publicId);
    return resultado;
  } catch (error) {
    console.error('Error al eliminar imagen de Cloudinary:', error);
    throw error;
  }
};

module.exports = { uploadImagen, deleteImagen };
