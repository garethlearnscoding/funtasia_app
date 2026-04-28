import { Html5Qrcode } from "html5-qrcode";

let html5QrCode = null;
let torchOn = false;
let torchSupported = false;
let cachedCameraSetup = null;

// ─────────────────────────────────────────────────────────────────────────────
// iOS helpers
// ─────────────────────────────────────────────────────────────────────────────

function hasStaleSettingsBug() {
    const match = navigator.userAgent.match(/OS (\d+)_(\d+)/);
    if (!match) return false;
    const major = parseInt(match[1]);
    const minor = parseInt(match[2]);
    return (major === 17 && minor >= 2) || (major === 18 && minor <= 3);
}

// Torch via web API only works on iOS 17.2+.
// On older iOS we skip the entire torch probe loop — it will always fail.
function iosSupportsTorch() {
    const match = navigator.userAgent.match(/OS (\d+)_(\d+)/);
    if (!match) return true; // Not iOS — torch check works normally on Android/desktop
    const major = parseInt(match[1]);
    const minor = parseInt(match[2]);
    return major > 17 || (major === 17 && minor >= 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera scoring
// Determines iteration order and hard-rejects selfie cameras before any
// stream is opened. Lower score = tried first.
//
// iOS labels:  "Back Camera", "Back Dual Camera", "Back Triple Camera"  → 0
//              "Back Ultra Wide Camera"                                  → 2
//              "Front Camera"                                            → 99 (rejected)
//
// Android:     "camera2 0, facing back"                                  → 0
//              "camera2 N, facing back" (N > 0)                          → 2
//              "camera2 N, facing front"                                  → 99 (rejected)
// ─────────────────────────────────────────────────────────────────────────────

function scoreCamera(label) {
    const l = (label || '').toLowerCase();

    // Hard-reject front/selfie cameras by label
    if (l.includes('front') || l.includes('facing front') || l.includes('user')) return 99;

    // iOS main rear cameras (torch-capable)
    if (l === 'back camera')                                  return 0;
    if (l.includes('back dual') || l.includes('back triple')) return 0;
    if (l.match(/camera2 0,\s*facing back/))                  return 0;

    // Generic rear
    if (l.includes('back') || l.includes('rear') || l.includes('environment')) return 1;
    if (l.includes('facing back'))                            return 1;

    // Secondary rear lenses — unlikely to have torch
    if (l.includes('ultra wide') || l.includes('ultrawide')) return 2;
    if (l.includes('telephoto'))                              return 2;
    if (l.match(/camera2 [^0],\s*facing back/))              return 2;

    return 3; // Unknown — try last
}

// ─────────────────────────────────────────────────────────────────────────────
// findBestCamera
//
// Changes from original (minimal, surgical):
//   + Cameras are scored and sorted before iteration — main lens tried first
//   + Front cameras (score 99) skipped before any stream is opened
//   + facingMode === 'user' hard-rejects a camera even if label was ambiguous
//   + Old iOS (<17.2) shortcut: returns first verified rear camera immediately
//     without any torch probing (torch will always fail on those versions)
//   + Fallback uses firstVerifiedRearId instead of videoDevices[0] which can
//     be the selfie camera on iPhones
//
// Everything else is identical to the original.
// ─────────────────────────────────────────────────────────────────────────────

async function findBestCamera() {
    if (cachedCameraSetup) return cachedCameraSetup;

    try {
        // Request base permission so labels are populated
        await navigator.mediaDevices.getUserMedia({ video: true })
            .then(s => s.getTracks().forEach(t => t.stop()))
            .catch(() => {});

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');

        if (videoDevices.length === 0) return null;

        // Score and sort — extract only deviceId + label as plain objects
        // (avoids MediaDeviceInfo spread which breaks on some browsers)
        const candidates = videoDevices
            .map(d => ({ deviceId: d.deviceId, label: d.label }))
            .filter(d => scoreCamera(d.label) < 99)
            .sort((a, b) => scoreCamera(a.label) - scoreCamera(b.label));

        console.log('[Camera] Candidates:', candidates.map(d => `"${d.label}"`));

        const testVideo = document.createElement('video');
        testVideo.muted = true;
        testVideo.playsInline = true;

        let bestCameraId = null;       // torch-capable secondary lens
        let firstVerifiedRearId = null; // first confirmed-rear camera (with or without torch)

        const oldIOS = !iosSupportsTorch();
        if (oldIOS) {
            console.log('[Camera] iOS < 17.2 — skipping torch probe, finding first rear camera only');
        }

        for (const device of candidates) {
            const label = device.label.toLowerCase();

            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: { exact: device.deviceId } }
                });
            } catch (err) {
                console.warn('[Camera] Could not open:', device.label, err.name);
                continue;
            }

            const track = stream.getVideoTracks()[0];

            // Hard-reject if facingMode confirms it's the selfie camera.
            // getSettings().facingMode is reliable on all platforms and iOS versions
            // (it is NOT affected by the stale-torch bug).
            const facingMode = track.getSettings().facingMode;
            if (facingMode === 'user') {
                console.log('[Camera] Skipping — facingMode user (selfie):', device.label);
                track.stop();
                continue;
            }

            // Confirmed rear (or unknown facing — treat as rear)
            if (!firstVerifiedRearId) firstVerifiedRearId = device.deviceId;

            // Old iOS shortcut: torch will never work, return first verified rear camera now
            if (oldIOS) {
                track.stop();
                console.log('[Camera] Old iOS: using first verified rear camera:', device.label);
                cachedCameraSetup = { deviceId: device.deviceId, hasTorch: false };
                return cachedCameraSetup;
            }

            // Torch detection — identical to original
            testVideo.srcObject = stream;
            await testVideo.play().catch(() => {});
            await new Promise(r => setTimeout(r, 400));

            const caps = track.getCapabilities?.() ?? {};
            let isTorchSupported = caps.torch === true;

            if (!isTorchSupported) {
                try {
                    await track.applyConstraints({ advanced: [{ torch: false }] });
                    isTorchSupported = true;
                } catch (e) {
                    isTorchSupported = false;
                }
            }

            track.stop();

            if (isTorchSupported) {
                if (label.includes('ultrawide') || label.includes('ultra wide') || label.includes('telephoto')) {
                    if (!bestCameraId) bestCameraId = device.deviceId;
                } else {
                    cachedCameraSetup = { deviceId: device.deviceId, hasTorch: true };
                    console.log('[Camera] Selected (main lens, torch):', device.label);
                    return cachedCameraSetup;
                }
            }
        }

        if (bestCameraId) {
            cachedCameraSetup = { deviceId: bestCameraId, hasTorch: true };
            console.log('[Camera] Selected (secondary lens, torch)');
            return cachedCameraSetup;
        }

        // No torch anywhere — use first verified rear camera.
        // If firstVerifiedRearId is null, startScanner falls back to facingMode.
        cachedCameraSetup = { deviceId: firstVerifiedRearId || null, hasTorch: false };
        console.log('[Camera] No torch. Fallback rear id:', firstVerifiedRearId || 'none');
        return cachedCameraSetup;

    } catch (err) {
        console.error('[Camera] findBestCamera() error:', err);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// startScanner — identical to original except:
//   + null-checks track before using it (prevents TypeError crash)
//   + facingMode fallback uses 'ideal' not 'exact' (avoids hard-fail on desktop)
// ─────────────────────────────────────────────────────────────────────────────

const torchOnColor = 'var(--color-ctp-mauve-700)'
const torchOffColor = 'var(--color-ctp-mauve-950)'

export async function startScanner(successCallback, elementId = "qrcode_scanner") {
    if (html5QrCode && html5QrCode.isScanning) {
        return;
    }

    // Re-initialize if the elementId changed or it doesn't exist
    if (html5QrCode) {
        try { html5QrCode.clear(); } catch(e) {}
    }
    html5QrCode = new Html5Qrcode(elementId);

    if (html5QrCode.isScanning) {
        return;
    }

    const qrFlashBtn = document.getElementById('qr-flash-btn');
    if (qrFlashBtn) {
        qrFlashBtn.innerHTML = `<span class="material-symbols-outlined text-[20px] animate-spin">hourglass_empty</span> Finding camera...`;
        qrFlashBtn.disabled = true;
    }

    const bestCamera = await findBestCamera();

    let startConfig;
    if (bestCamera && bestCamera.deviceId) {
        startConfig = { deviceId: { exact: bestCamera.deviceId } };
    } else {
        startConfig = { facingMode: { ideal: 'environment' } };
    }

    torchSupported = bestCamera ? bestCamera.hasTorch : false;

    if (qrFlashBtn) {
        if (!torchSupported) {
            qrFlashBtn.innerHTML = "Flash is unavailable";
            qrFlashBtn.style.background = "transparent";
            qrFlashBtn.style.border = "none";
            qrFlashBtn.style.cursor = "default";
            qrFlashBtn.style.fontSize = "12px";
            qrFlashBtn.style.padding = "8px";
            qrFlashBtn.disabled = true;
        } else {
            qrFlashBtn.disabled = false;
            qrFlashBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]" id="qr-flash-icon">flashlight_off</span> Toggle Flash`;
        }
    }

    const config = {
        fps: 120,
        qrbox: { width: 200, height: 200 },
        aspectRatio: 1.0
    };

    try {
        await html5QrCode.start(
            startConfig,
            config,
            (decodedText, decodedResult) => {
                successCallback(decodedText, decodedResult);
            }
        );

        // Sync initial torch state and attach track listeners — identical to original.
        // Added null-check on track to prevent TypeError if html5Qrcode's DOM
        // structure differs between versions.
        const videoElement = document.querySelector(`#${elementId} video`);
        if (videoElement && videoElement.srcObject) {
            const track = videoElement.srcObject.getVideoTracks()[0];

            if (track) {
                if (hasStaleSettingsBug()) {
                    torchOn = false;
                } else {
                    const settings = track.getSettings();
                    torchOn = settings.torch ?? false;
                }

                if (torchOn && torchSupported && qrFlashBtn) {
                    const icon = document.getElementById('qr-flash-icon');
                    if (icon) icon.textContent = 'flashlight_on';
                    qrFlashBtn.style.background = torchOnColor;
                }

                track.addEventListener('mute', () => {
                    torchOn = false;
                    if (torchSupported && qrFlashBtn) {
                        const icon = document.getElementById('qr-flash-icon');
                        if (icon) icon.textContent = 'flashlight_off';
                        qrFlashBtn.style.background = torchOffColor;
                    }
                });
            }
        }

        const errorMsg = document.getElementById('qr-error-msg');
        if (errorMsg) errorMsg.remove();

    } catch (err) {
        console.error("Failed to start QR scanner:", err);
        const scannerView = document.getElementById(elementId).parentNode;
        let errorMsg = document.getElementById('qr-error-msg');
        if (!errorMsg) {
            errorMsg = document.createElement('p');
            errorMsg.id = 'qr-error-msg';
            errorMsg.style.color = '#ff6b6b';
            errorMsg.style.fontSize = '12px';
            errorMsg.style.marginTop = '12px';
            errorMsg.style.textAlign = 'center';
            errorMsg.style.fontFamily = "'JetBrains Mono', monospace";
            if (qrFlashBtn && qrFlashBtn.parentNode) {
                qrFlashBtn.parentNode.insertBefore(errorMsg, qrFlashBtn.nextSibling);
            } else if (scannerView) {
                scannerView.appendChild(errorMsg);
            }
        }
        errorMsg.textContent = "Camera not discoverable. Please use text input mode.";
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// stopScanner — identical to original
// ─────────────────────────────────────────────────────────────────────────────

export async function stopScanner(elementId = "qrcode_scanner") {
    if (html5QrCode && html5QrCode.isScanning) {
        try {
            const videoElement = document.querySelector(`#${elementId} video`);
            if (videoElement && videoElement.srcObject) {
                const track = videoElement.srcObject.getVideoTracks()[0];
                if (track && torchSupported && torchOn) {
                    await track.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
                }
            }

            await html5QrCode.stop();
            html5QrCode.clear();
        } catch (err) {
            console.error("Failed to stop QR scanner:", err);
        }
    }

    torchOn = false;

    const qrFlashBtn = document.getElementById('qr-flash-btn');
    if (qrFlashBtn && torchSupported) {
        const qrFlashIcon = document.getElementById('qr-flash-icon');
        if (qrFlashIcon) qrFlashIcon.textContent = 'flashlight_off';
        qrFlashBtn.style.background = torchOffColor;
    }

    const scannerDiv = document.getElementById(elementId);
    if (scannerDiv && !scannerDiv.innerHTML.includes('qr_code_scanner')) {
        scannerDiv.innerHTML = '<span class="material-symbols-outlined" style="font-size: 48px; color: var(--color-ctp-subtext1); opacity: 0.4;">qr_code_scanner</span>';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// toggleTorch — identical to original
// ─────────────────────────────────────────────────────────────────────────────

export async function toggleTorch(buttonElement) {
    if (!html5QrCode || !html5QrCode.isScanning || !torchSupported) {
        console.warn("Scanner is not running or torch unsupported. Cannot toggle torch.");
        return;
    }

    const iconElement = document.getElementById('qr-flash-icon');
    const videoElement = document.querySelector('#qrcode_scanner video');
    if (!videoElement || !videoElement.srcObject) return;

    const track = videoElement.srcObject.getVideoTracks()[0];
    if (!track) return;

    const nextOn = !torchOn;

    try {
        await track.applyConstraints({ advanced: [{ torch: nextOn }] });

        torchOn = nextOn;

        if (torchOn) {
            iconElement.textContent = 'flashlight_on';
            buttonElement.style.background = torchOnColor;
        } else {
            iconElement.textContent = 'flashlight_off';
            buttonElement.style.background = torchOffColor;
        }

        if (!hasStaleSettingsBug()) {
            setTimeout(() => {
                const actual = track.getSettings().torch;
                if (actual !== undefined && actual !== torchOn) {
                    console.warn(`Torch state drifted from expectation.`);
                }
            }, 100);
        }

    } catch (err) {
        console.error("Failed to toggle torch:", err.name, err.message);
    }
}
