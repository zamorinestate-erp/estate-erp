// =============================================================================
// ZAMORIN CAFÉ ERP — CAMERA & GEOLOCATION SECURE PRESENCE UTILITIES
// =============================================================================

'use strict';

import jsQR from '../vendor/jsQR.js';

export function friendlyCameraError(err) {
  const name = err && err.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      code: 'CAMERA_PERMISSION_DENIED',
      message: 'Camera permission is required for Geo-Selfie Attendance.',
    };
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      code: 'CAMERA_NOT_FOUND',
      message: 'No camera was found on this device.',
    };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      code: 'CAMERA_IN_USE',
      message: 'The camera could not be started. It may be in use by another app.',
    };
  }
  return {
    code: 'CAMERA_ERROR',
    message: err?.message || 'Could not access the camera. Please try again.',
  };
}

export function friendlyGeoError(err) {
  if (!err) {
    return { code: 'LOCATION_ERROR', message: 'Unable to determine your current location. Please try again.' };
  }
  switch (err.code) {
    case 1: // PERMISSION_DENIED
      return {
        code: 'LOCATION_PERMISSION_DENIED',
        message: 'Location permission is required to record attendance.',
      };
    case 2: // POSITION_UNAVAILABLE
      return {
        code: 'LOCATION_UNAVAILABLE',
        message: 'Unable to determine your current location. Please try again.',
      };
    case 3: // TIMEOUT
      return {
        code: 'LOCATION_TIMEOUT',
        message: 'Getting your location took too long. Please try again.',
      };
    default:
      return {
        code: 'LOCATION_ERROR',
        message: err.message || 'Could not determine your current location.',
      };
  }
}

/**
 * Opens device camera stream into a <video> element.
 * @param {HTMLVideoElement} videoEl
 * @param {'user'|'environment'} facingMode - 'environment' for QR, 'user' for selfie
 * @returns {Promise<MediaStream>}
 */
export async function openCamera(videoEl, facingMode = 'user') {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw {
      code: 'CAMERA_UNSUPPORTED',
      message: 'This browser does not support live camera access.',
    };
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 720 },
        height: { ideal: 960 },
      },
      audio: false,
    });
  } catch (err) {
    throw friendlyCameraError(err);
  }

  if (videoEl) {
    videoEl.srcObject = stream;
    videoEl.setAttribute('playsinline', 'true');
    videoEl.muted = true;
    try {
      await videoEl.play();
    } catch (_) {}
  }

  return stream;
}

/**
 * Safely stops all tracks on a MediaStream.
 * @param {MediaStream} stream
 */
export function stopCamera(stream) {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => track.stop());
  } catch (_) {}
}

/**
 * Captures current frame from <video> as a JPEG Blob.
 * @param {HTMLVideoElement} videoEl
 * @param {Object} options
 * @returns {Promise<Blob>}
 */
export function captureFrameAsBlob(videoEl, { quality = 0.85, maxWidth = 960 } = {}) {
  return new Promise((resolve, reject) => {
    if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) {
      reject({ code: 'CAPTURE_FAILED', message: 'Video stream is not ready for capture.' });
      return;
    }

    const scale = Math.min(1, maxWidth / videoEl.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(videoEl.videoWidth * scale);
    canvas.height = Math.round(videoEl.videoHeight * scale);

    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject({ code: 'CAPTURE_FAILED', message: 'Could not capture the photo. Please try again.' });
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Scans video feed repeatedly using jsQR until a code is found or cancelled.
 * @param {HTMLVideoElement} videoEl
 * @param {Object} options
 * @returns {{ promise: Promise<string>, cancel: Function }}
 */
export function scanQrFromVideo(videoEl, { onTick, intervalMs = 200 } = {}) {
  const qrDecoder = jsQR || (typeof window !== 'undefined' ? window.jsQR : null);
  if (typeof qrDecoder !== 'function') {
    return {
      promise: Promise.reject({
        code: 'QR_LIB_MISSING',
        message: 'QR scanning library is unavailable.',
      }),
      cancel: () => {},
    };
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let cancelled = false;
  let timer = null;

  const promise = new Promise((resolve, reject) => {
    function tick() {
      if (cancelled) return;
      if (videoEl && videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        try {
          const result = qrDecoder(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (onTick) onTick(Boolean(result));
          if (result && result.data) {
            resolve(result.data);
            return;
          }
        } catch (_) {}
      }
      timer = setTimeout(tick, intervalMs);
    }
    tick();
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    },
  };
}

/**
 * Captures real browser GPS position with high accuracy.
 * @param {Object} options
 * @returns {Promise<{ latitude: number, longitude: number, accuracyMeters: number, capturedAt: string }>}
 */
export function getCurrentPosition({ timeoutMs = 15000, highAccuracy = true } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({
        code: 'GEO_UNSUPPORTED',
        message: 'This browser does not support geolocation access.',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
          capturedAt: new Date(pos.timestamp || Date.now()).toISOString(),
        });
      },
      (err) => reject(friendlyGeoError(err)),
      {
        enableHighAccuracy: highAccuracy,
        timeout: timeoutMs,
        maximumAge: 0,
      }
    );
  });
}
