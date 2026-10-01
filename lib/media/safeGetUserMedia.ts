// lib/media/safeGetUserMedia.ts
// Permanent fix for getUserMedia Permission denied errors.
// Use this instead of navigator.mediaDevices.getUserMedia directly.

export interface MediaResult {
  stream: MediaStream | null;
  error:  string | null;
}

export async function safeGetUserMedia(
  constraints: MediaStreamConstraints
): Promise<MediaResult> {
  if (typeof window === "undefined") {
    return { stream: null, error: "Not in browser context." };
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      stream: null,
      error:
        "Media devices unavailable. This feature requires HTTPS or localhost. " +
        "If on localhost, check for mixed content (http resources on the page).",
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return { stream, error: null };
  } catch (err: unknown) {
    const e = err as DOMException;
    let message = "Media access failed.";

    switch (e.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        message =
          "Microphone access was blocked. " +
          "Click the lock icon in your browser address bar, " +
          "set Microphone to Allow, then refresh.";
        break;

      case "NotFoundError":
      case "DevicesNotFoundError":
        message = "No microphone detected. Connect a microphone and try again.";
        break;

      case "NotReadableError":
      case "TrackStartError":
        message =
          "Microphone is in use by another app. " +
          "Close other apps using the microphone and try again.";
        break;

      case "OverconstrainedError":
        // Retry with minimal constraints
        try {
          const fallback = await navigator.mediaDevices.getUserMedia({ audio: true });
          return { stream: fallback, error: null };
        } catch {
          message = "Could not access microphone with requested settings.";
        }
        break;

      case "SecurityError":
        message =
          "Media access blocked by security policy. " +
          "Ensure the page is served over HTTPS.";
        break;

      case "AbortError":
        message = "Microphone access was interrupted. Please try again.";
        break;

      default:
        message = `Media access failed: ${e.message ?? e.name ?? "Unknown error"}`;
    }

    console.error("[safeGetUserMedia]", e.name, e.message, constraints);
    return { stream: null, error: message };
  }
}

// Helper: enumerate available audio input devices
export async function getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "audioinput");
  } catch {
    return [];
  }
}

// Helper: check if microphone permission is already granted
export async function getMicPermissionState(): Promise<PermissionState | "unknown"> {
  try {
    const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return result.state;
  } catch {
    return "unknown";
  }
}