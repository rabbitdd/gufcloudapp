type ThumbnailOptions = {
  maxEdge?: number;
  quality?: number;
};

async function readImage(file: File): Promise<HTMLImageElement> {
  const image = new Image();
  const objectUrl = URL.createObjectURL(file);

  return new Promise((resolve, reject) => {
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to read image."));
    };
    image.src = objectUrl;
  });
}

export async function createImageThumbnailFile(
  source: File,
  options: ThumbnailOptions = {}
) {
  const maxEdge = options.maxEdge ?? 320;
  const quality = options.quality ?? 0.82;

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const image = await readImage(source);
    const ratio = Math.min(1, maxEdge / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * ratio));
    const height = Math.max(1, Math.round(image.height * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }

    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality)
    );

    if (!blob) {
      return null;
    }

    const baseName = source.name.replace(/\.[^/.]+$/, "");
    return new File([blob], `${baseName}-thumb.webp`, { type: "image/webp" });
  } catch {
    return null;
  }
}
