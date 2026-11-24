import { createClient } from '@/lib/supabase/client';

/**
 * Compresses an image client-side:
 * - Max dimension: about 800px width/height (maintaining aspect ratio)
 * - Output format: image/webp
 * - Target size: under 150 KB
 */
export async function compressMenuImage(
  file: File
): Promise<{ blob: Blob; fileName: string; sizeKB: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = event => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context could not be created.'));
          return;
        }

        // Fill transparent background with white if needed, then draw
        ctx.drawImage(img, 0, 0, width, height);

        const quality = 0.85;

        function attemptBlob(q: number) {
          canvas.toBlob(
            blob => {
              if (!blob) {
                reject(new Error('Failed to generate image blob.'));
                return;
              }

              const sizeKB = Math.round(blob.size / 1024);

              // If larger than 150KB and quality can be reduced, retry with lower quality
              if (sizeKB > 150 && q > 0.45) {
                attemptBlob(q - 0.15);
              } else {
                const baseName = file.name
                  .replace(/\.[^/.]+$/, '')
                  .replace(/[^a-zA-Z0-9_-]/g, '_')
                  .slice(0, 30);
                const fileName = `${baseName}_${Date.now()}.webp`;
                resolve({ blob, fileName, sizeKB });
              }
            },
            'image/webp',
            q
          );
        }

        attemptBlob(quality);
      };

      img.onerror = err => reject(err);
    };

    reader.onerror = err => reject(err);
  });
}

/**
 * Compresses and uploads an image to Supabase Storage bucket 'menu-images'
 * Returns the public image URL.
 */
export async function uploadMenuImageToStorage(file: File): Promise<string> {
  const { blob, fileName } = await compressMenuImage(file);
  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from('menu-images')
    .upload(`items/${fileName}`, blob, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: true,
    });

  if (error) {
    throw new Error(`Storage upload error: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from('menu-images')
    .getPublicUrl(data.path);

  return publicUrlData.publicUrl;
}
