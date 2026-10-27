const MAX_DIMENSION = 2200;
const JPEG_QUALITY = 0.9;
const MAX_UPLOAD_BYTES = 5_242_880;
export async function loadImage(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("CANVAS");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function combinePages(pages: HTMLCanvasElement[]): Promise<Blob> {
  const width = Math.max(...pages.map((page) => page.width));
  const gap = 32;
  const heights = pages.map((page) => Math.round((page.height * width) / page.width));
  const sheet = document.createElement("canvas");
  sheet.width = width;
  sheet.height = heights.reduce((total, height) => total + height, 0) + gap * (pages.length - 1);
  const ctx = sheet.getContext("2d");
  if (!ctx) throw new Error("CANVAS");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  let offset = 0;
  for (const [index, page] of pages.entries()) {
    const height = heights[index] ?? 0;
    ctx.drawImage(page, 0, offset, width, height);
    offset += height + gap;
  }
  const blob = await new Promise<Blob | null>((resolve) =>
    sheet.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob || blob.size > MAX_UPLOAD_BYTES) throw new Error("SIZE");
  return blob;
}
