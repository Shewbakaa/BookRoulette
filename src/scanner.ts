import { normalizeIsbn } from './isbn';

/** Error thrown/rejected by startScanner; `code` drives the friendly message. */
export class CameraError extends Error {
  constructor(public code: 'denied' | 'insecure' | 'nocamera' | 'busy' | 'unknown', message?: string) {
    super(message ?? code);
    this.name = 'CameraError';
  }
}

/** Maps anything thrown while starting the camera to a CameraError code. */
export function classifyCameraError(err: unknown): CameraError {
  if (err instanceof CameraError) return err;
  const name = (err as { name?: string } | null)?.name ?? '';
  const text = `${name} ${String((err as { message?: string } | null)?.message ?? err)}`.toLowerCase();
  if (/notallowed|permission|denied|security/.test(text)) return new CameraError('denied', text);
  if (/notfound|overconstrained|devicesnotfound|no camera|requested device not found/.test(text)) return new CameraError('nocamera', text);
  if (/notreadable|trackstart|could not start|in use/.test(text)) return new CameraError('busy', text);
  if (/secure|https|not supported|getusermedia|mediadevices/.test(text)) return new CameraError('insecure', text);
  return new CameraError('unknown', text);
}

/** Friendly, non-technical copy for each camera problem. */
export function cameraErrorMessage(err: unknown): string {
  switch (classifyCameraError(err).code) {
    case 'denied': return 'Camera access is off. You can allow it in Settings › Safari › Camera — or just type the book in.';
    case 'insecure': return 'The camera only works over a secure (https) connection. You can type the book in instead.';
    case 'nocamera': return 'No camera found on this device. You can type the book in instead.';
    case 'busy': return 'The camera is busy in another app. Close it and try again, or type the book in.';
    default: return 'Couldn’t start the camera. You can type the book in instead.';
  }
}

/**
 * Turns raw decodes into at most one ISBN callback. Non-ISBN codes (price add-ons, UPCs)
 * return false and are ignored, so scanning carries on.
 */
export function makeDecodeHandler(onIsbn: (isbn: string) => void): (text: string) => boolean {
  let done = false;
  return (text: string): boolean => {
    if (done) return false;
    const isbn = normalizeIsbn(text);
    if (!isbn) return false;
    done = true;
    onIsbn(isbn);
    return true;
  };
}

let seq = 0;

/**
 * Starts the back camera inside `el` and calls `onIsbn` once with a normalized ISBN-13.
 * The camera is released automatically after a valid ISBN; the returned stop fn is idempotent
 * and always releases it. Rejects with a CameraError when the camera can't be used.
 */
export async function startScanner(el: HTMLElement, onIsbn: (isbn: string) => void): Promise<() => Promise<void>> {
  if (typeof window !== 'undefined' && window.isSecureContext === false) throw new CameraError('insecure');
  if (!navigator.mediaDevices?.getUserMedia) throw new CameraError('insecure', 'mediaDevices unavailable');

  const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
  if (!el.id) el.id = `scan-${++seq}`;
  const qr = new Html5Qrcode(el.id, {
    verbose: false,
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
    ],
    useBarCodeDetectorIfSupported: false, // ZXing everywhere (no native BarcodeDetector).
  });

  let stopping: Promise<void> | null = null;
  const stop = (): Promise<void> => {
    if (stopping) return stopping;
    stopping = (async () => {
      try { if (qr.isScanning) await qr.stop(); } catch { /* already stopped */ }
      try { qr.clear(); } catch { /* ignore */ }
    })();
    return stopping;
  };

  const handle = makeDecodeHandler((isbn) => {
    void stop();
    onIsbn(isbn);
  });

  try {
    await qr.start(
      { facingMode: 'environment' },
      {
        fps: 12,
        // Wide, short box: barcodes are horizontal strips.
        qrbox: (w: number, h: number) => ({
          width: Math.max(50, Math.floor(w * 0.86)),
          height: Math.max(50, Math.floor(Math.min(h * 0.5, w * 0.45))),
        }),
      },
      (text) => { handle(text); },
      () => { /* per-frame "not found" noise */ },
    );
  } catch (err) {
    await stop();
    throw classifyCameraError(err);
  }
  return stop;
}
