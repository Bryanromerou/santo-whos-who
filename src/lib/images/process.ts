import sharp, { type Metadata } from "sharp";
import { AppError } from "@/lib/errors";

export type DetectedFormat = "jpeg" | "png" | "webp";

/** Identifies JPG/PNG/WebP from the file's magic bytes (ignores name and browser MIME type). */
export function detectImageFormat(buf: Uint8Array): DetectedFormat | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return "png";
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50 // WEBP
  ) return "webp";
  return null;
}

export type ProcessedPortrait = {
  master: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
  sourceFormat: DetectedFormat;
};

const MASTER_MAX = 2400; // ≈ 8 in at 300 dpi — crisp in print
const THUMB_MAX = 480;
const MAX_INPUT_PIXELS = 60_000_000;

/**
 * Validates and re-encodes an uploaded image. The output is always a fresh
 * JPEG (EXIF/GPS metadata removed, orientation applied, transparency flattened
 * onto white) plus a thumbnail.
 */
export async function processPortrait(input: Buffer, maxBytes: number): Promise<ProcessedPortrait> {
  if (input.length === 0) throw new AppError("emptyFile");
  if (input.length > maxBytes) {
    throw new AppError("imageTooLarge", { status: 413, values: { mb: Math.round(maxBytes / 1024 / 1024) } });
  }
  const format = detectImageFormat(input);
  if (!format) throw new AppError("unsupportedFormat", { status: 415 });

  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new AppError("unreadableImage", { status: 422 });
  }
  if (meta.format !== format) {
    throw new AppError("contentMismatch", { status: 415 });
  }
  if (!meta.width || !meta.height) throw new AppError("invalidDimensions", { status: 422 });
  if ((meta.pages ?? 1) > 1) throw new AppError("animatedNotSupported", { status: 415 });

  const base = () =>
    sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate() // apply EXIF orientation before metadata is dropped
      .flatten({ background: "#ffffff" });

  try {
    const master = await base()
      .resize({ width: MASTER_MAX, height: MASTER_MAX, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: "4:4:4" })
      .toBuffer({ resolveWithObject: true });
    const thumb = await base()
      .resize({ width: THUMB_MAX, height: THUMB_MAX, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return {
      master: master.data,
      thumb,
      width: master.info.width,
      height: master.info.height,
      sourceFormat: format,
    };
  } catch {
    throw new AppError("processingFailed", { status: 422 });
  }
}
