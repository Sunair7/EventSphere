import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Image, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

export default function ImageUpload({ 
  onUpload, 
  accept = 'image/*',
  maxSize = 10 * 1024 * 1024, // 10MB
  multiple = false,
  maxFiles = 10,
  className = ''
}) {
  const [dragActive, setDragActive] = useState(false);
  const [previews, setPreviews] = useState([]);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleFiles = (files) => {
    setError(null);
    
    if (!files?.length) return;

    const fileArray = Array.from(files);
    
    // Validate
    for (const file of fileArray) {
      if (!file.type.startsWith('image/')) {
        setError(`"${file.name}" is not an image file.`);
        return;
      }
      if (file.size > maxSize) {
        setError(`"${file.name}" exceeds ${(maxSize / 1024 / 1024).toFixed(0)}MB limit.`);
        return;
      }
    }

    if (multiple && fileArray.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed.`);
      return;
    }

    // Create previews
    const newPreviews = fileArray.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
    }));

    setPreviews(multiple ? [...previews, ...newPreviews] : newPreviews);
    onUpload?.(fileArray);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const removePreview = (id) => {
    setPreviews((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      // Revoke object URL for removed preview
      const removed = prev.find((p) => p.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return filtered;
    });
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8',
          'cursor-pointer transition-all duration-200',
          dragActive
            ? 'border-secondary bg-secondary/5 scale-[1.02]'
            : 'border-outline-variant hover:border-secondary/50 hover:bg-surface-container-low',
          error && 'border-error bg-error/5'
        )}
      >
        <motion.div
          animate={dragActive ? { scale: 1.1 } : { scale: 1 }}
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-full',
            error ? 'bg-error-container text-on-error-container' : 'bg-primary-container text-on-primary-container'
          )}
        >
          {error ? <AlertCircle size={22} /> : <Upload size={22} />}
        </motion.div>

        <div className="text-center">
          <p className="text-body-sm font-medium text-on-surface">
            {dragActive ? 'Drop files here' : 'Click or drag to upload'}
          </p>
          <p className="mt-1 font-mono text-label-sm text-on-surface-variant">
            {multiple ? `Up to ${maxFiles} images` : 'Single image'} · Max {(maxSize / 1024 / 1024).toFixed(0)}MB each
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Error */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-body-sm text-error"
        >
          {error}
        </motion.p>
      )}

      {/* Previews */}
      {previews.length > 0 && (
        <div className={cn(
          'grid gap-2',
          multiple ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5' : 'grid-cols-1'
        )}>
          {previews.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="relative group rounded-md overflow-hidden border border-outline-variant aspect-square"
            >
              <img
                src={item.preview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
              <button
                onClick={(e) => { e.stopPropagation(); removePreview(item.id); }}
                className="absolute top-1 right-1 p-1 rounded bg-error/80 text-white
                           opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}