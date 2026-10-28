import { describe, it, expect, vi } from 'vitest';
import { makeDecodeHandler, classifyCameraError, cameraErrorMessage, CameraError, startScanner } from './scanner';

describe('makeDecodeHandler', () => {
  it('ignores non-ISBN barcodes and fires once for the first ISBN', () => {
    const on = vi.fn();
    const h = makeDecodeHandler(on);
    expect(h('036000291452')).toBe(false); // UPC-A grocery code
    expect(h('51299')).toBe(false); // price add-on
    expect(on).not.toHaveBeenCalled();
    expect(h('9780441172719')).toBe(true);
    expect(h('9780547928227')).toBe(false);
    expect(on).toHaveBeenCalledTimes(1);
    expect(on).toHaveBeenCalledWith('9780441172719');
  });
});

describe('camera errors', () => {
  it('classifies common getUserMedia failures', () => {
    expect(classifyCameraError({ name: 'NotAllowedError', message: 'Permission denied' }).code).toBe('denied');
    expect(classifyCameraError('Error getting userMedia, error = NotAllowedError: x').code).toBe('denied');
    expect(classifyCameraError({ name: 'NotFoundError' }).code).toBe('nocamera');
    expect(classifyCameraError({ name: 'NotReadableError' }).code).toBe('busy');
    expect(classifyCameraError(new CameraError('insecure')).code).toBe('insecure');
    expect(classifyCameraError(42).code).toBe('unknown');
  });

  it('always yields a friendly message', () => {
    for (const e of [null, undefined, 'x', { name: 'NotAllowedError' }, new CameraError('insecure')]) {
      expect(cameraErrorMessage(e)).toMatch(/type the book in/);
    }
  });

  it('startScanner rejects (not throws synchronously) when the camera API is missing', async () => {
    // jsdom has no navigator.mediaDevices
    await expect(startScanner(document.createElement('div'), () => {})).rejects.toBeInstanceOf(CameraError);
  });
});
