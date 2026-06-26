'use strict';

const multer            = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary        = require('../config/cloudinary');

// ─── Allowed MIME types ───────────────────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 10; // Max gallery images per upload

// ─── Create error helper ──────────────────────────────────────────────────────
const createError = (message) => {
  const err = new Error(message);
  err.statusCode = 422;
  return err;
};

// ─── File filter with magic byte validation ───────────────────────────────────
const fileFilter = (req, file, cb) => {
  // Check MIME type
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return cb(createError(`Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP, AVIF, GIF.`), false);
  }

  // Basic magic byte check (first bytes of the file)
  // This prevents files disguised with wrong extensions
  if (file.buffer && file.buffer.length > 4) {
    const header = file.buffer.toString('hex', 0, 4);
    
    const validHeaders = {
      'image/jpeg': ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2', 'ffd8ffe3', 'ffd8ffdb'],
      'image/png':  ['89504e47'],
      'image/webp': ['52494646'], // RIFF
      'image/gif':  ['47494638'],
    };

    const expectedHeaders = validHeaders[file.mimetype];
    if (expectedHeaders && !expectedHeaders.some(h => header.startsWith(h))) {
      return cb(createError(`File content does not match its declared type (${file.mimetype}).`), false);
    }
  }

  cb(null, true);
};

// ─── Cloudinary Storage ───────────────────────────────────────────────────────
const createStorage = (folder) => new CloudinaryStorage({
  cloudinary,
  params: {
    folder,
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'],
    transformation: [
      { quality: 'auto:good', fetch_format: 'auto' },
    ],
    resource_type: 'image',
    public_id: (req, file) => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      return `expo_${req.params.id || 'new'}_${timestamp}_${random}`;
    },
  },
});

// ─── Upload Middleware ────────────────────────────────────────────────────────
const uploadExpoBanner = multer({
  storage: createStorage('eventsphere/expos/banners'),
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Only 1 banner
  },
}).single('banner');

const uploadExpoGallery = multer({
  storage: createStorage('eventsphere/expos/gallery'),
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
}).array('gallery', MAX_FILES);

// ─── Error handling wrapper for multer ────────────────────────────────────────
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(422).json({
        success: false,
        message: `File is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(422).json({
        success: false,
        message: `Too many files. Maximum is ${MAX_FILES} files.`,
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(422).json({
        success: false,
        message: 'Unexpected file field. Please use the correct field name.',
      });
    }
    return res.status(422).json({
      success: false,
      message: err.message,
    });
  }
  
  if (err.statusCode === 422) {
    return res.status(422).json({
      success: false,
      message: err.message,
    });
  }
  
  next(err);
};

// ─── Delete image from Cloudinary ─────────────────────────────────────────────
const deleteCloudinaryImage = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err) {
    console.error('Cloudinary delete error:', err.message);
  }
};

// ─── Extract public_id from Cloudinary URL ────────────────────────────────────
const extractPublicId = (url) => {
  if (!url) return null;
  const matches = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.\w+$/);
  return matches ? matches[1] : null;
};

module.exports = {
  uploadExpoBanner,
  uploadExpoGallery,
  handleMulterError,
  deleteCloudinaryImage,
  extractPublicId,
};