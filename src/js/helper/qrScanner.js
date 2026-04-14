import { Html5Qrcode } from "html5-qrcode";

let html5QrCode = null;
let torchOn = false;
let torchSupported = false;
let cachedCameraSetup = null;

// Helper to determine if we have stale settings bug
function hasStaleSettingsBug() {
    const match = navigator.userAgent.match(/OS (\d+)_(\d+)/);
    if (!match) return false;
    const major = parseInt(match[1]);
    const minor = parseInt(match[2]);
    return (major === 17 && minor >= 2) || (major === 18 && minor <= 3);
}

// Function to cycle cameras and find the best one with torch capabilities
async function findBestCamera() {
    if (cachedCameraSetup) return cachedCameraSetup;

    try {
        // Request base permission first
        await navigator.mediaDevices.getUserMedia({ video: true }).then(s => s.getTracks().forEach(t => t.stop())).catch(() => {});
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        
        if (videoDevices.length === 0) return null;

        const testVideo = document.createElement('video');
        testVideo.muted = true;
        testVideo.playsInline = true;

        let bestCameraId = null;
        let hasTorch = false;
        let firstRearCameraId = null;

        for (const device of videoDevices) {
            const label = device.label.toLowerCase();
            const isBack = label.includes('back') || label.includes('environment') || label.includes('rear');
            
            if (isBack && !firstRearCameraId) firstRearCameraId = device.deviceId;

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { deviceId: { exact: device.deviceId } } 
                });
                const track = stream.getVideoTracks()[0];
                
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
                    if (label.includes('ultrawide') || label.includes('telephoto')) {
                        if (!bestCameraId) {
                            bestCameraId = device.deviceId;
                            hasTorch = true;
                        }
                    } else {
                        // Found a normal lens with torch capability
                        cachedCameraSetup = { deviceId: device.deviceId, hasTorch: true };
                        return cachedCameraSetup;
                    }
                }
            } catch (err) {
                console.warn("[Torch] Could not test camera:", device.label, err);
            }
        }
        
        if (bestCameraId) {
            cachedCameraSetup = { deviceId: bestCameraId, hasTorch: true };
            return cachedCameraSetup;
        }
        
        cachedCameraSetup = { deviceId: firstRearCameraId || videoDevices[0].deviceId, hasTorch: false };
        return cachedCameraSetup;
    } catch (err) {
        console.error("Error finding best camera:", err);
        return null; // fallback
    }
}

export async function startScanner(successCallback) {
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("qrcode_scanner");
    }
    
    if (html5QrCode.isScanning) {
        return;
    }
    
    const qrFlashBtn = document.getElementById('qr-flash-btn');
    if (qrFlashBtn) {
        qrFlashBtn.innerHTML = `<span class="material-symbols-outlined text-[20px] animate-spin">hourglass_empty</span> Finding camera...`;
        qrFlashBtn.disabled = true;
    }

    // Cycle through cameras per notes
    const bestCamera = await findBestCamera();
    let startConfig = { facingMode: "environment" };
    
    if (bestCamera && bestCamera.deviceId) {
        startConfig = bestCamera.deviceId;
    }
    
    torchSupported = bestCamera ? bestCamera.hasTorch : false;
    
    // As per point 4 in handlingdevices.md: swap flash button with text if unavailable
    if (qrFlashBtn) {
        if (!torchSupported) {
            qrFlashBtn.innerHTML = "Flash is unavailable";
            qrFlashBtn.style.background = "transparent";
            qrFlashBtn.style.border = "none";
            qrFlashBtn.style.color = "var(--color-on-surface-variant)";
            qrFlashBtn.style.cursor = "default";
            qrFlashBtn.style.fontSize = "12px";
            qrFlashBtn.style.padding = "8px";
            qrFlashBtn.disabled = true;
        } else {
            qrFlashBtn.style.background = 'color-mix(in srgb, var(--color-primary) 15%, transparent)';
            qrFlashBtn.style.border = '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)';
            qrFlashBtn.style.color = 'var(--color-primary)';
            qrFlashBtn.style.cursor = 'pointer';
            qrFlashBtn.style.fontSize = '14px';
            qrFlashBtn.style.padding = "14px";
            qrFlashBtn.disabled = false;
            qrFlashBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]" id="qr-flash-icon">flashlight_off</span> Toggle Flash`;
        }
    }
    
    const config = { 
        fps: 120, 
        qrbox: { width: 200, height: 200 }, // Slightly smaller than container for margin
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
        
        // Sync initial state and track events
        const videoElement = document.querySelector('#qrcode_scanner video');
        if (videoElement && videoElement.srcObject) {
            const track = videoElement.srcObject.getVideoTracks()[0];
            
            if (hasStaleSettingsBug()) {
                torchOn = false;
            } else {
                const settings = track.getSettings();
                torchOn = settings.torch ?? false;
            }
            
            // Sync UI if torch was already on
            if (torchOn && torchSupported && qrFlashBtn) {
                const icon = document.getElementById('qr-flash-icon');
                if (icon) icon.textContent = 'flashlight_on';
                qrFlashBtn.style.background = 'color-mix(in srgb, var(--color-primary) 30%, transparent)';
            }
            
            // Handle OS track mute interruptions
            track.addEventListener('mute', () => {
                torchOn = false;
                if (torchSupported && qrFlashBtn) {
                    const icon = document.getElementById('qr-flash-icon');
                    if (icon) icon.textContent = 'flashlight_off';
                    qrFlashBtn.style.background = 'color-mix(in srgb, var(--color-primary) 15%, transparent)';
                }
            });
        }

        // Clear any previous error messages if started successfully
        const errorMsg = document.getElementById('qr-error-msg');
        if (errorMsg) errorMsg.remove();
    } catch (err) {
        console.error("Failed to start QR scanner:", err);
        // Prompt user to switch to text input mode
        const scannerView = document.getElementById('qr-scanner-view');
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

export async function stopScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        try {
            // Apply torch: false before stopping, as best practice
            const videoElement = document.querySelector('#qrcode_scanner video');
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

    // Automatically reset torch UI when stopping scanner
    const qrFlashBtn = document.getElementById('qr-flash-btn');
    if (qrFlashBtn && torchSupported) {
        const qrFlashIcon = document.getElementById('qr-flash-icon');
        if (qrFlashIcon) qrFlashIcon.textContent = 'flashlight_off';
        qrFlashBtn.style.background = 'color-mix(in srgb, var(--color-primary) 15%, transparent)';
    }

    // Attempt to restore placeholder if it was cleared
    const scannerDiv = document.getElementById('qrcode_scanner');
    if (scannerDiv && !scannerDiv.innerHTML.includes('qr_code_scanner')) {
        scannerDiv.innerHTML = '<span class="material-symbols-outlined" style="font-size: 48px; color: var(--color-on-surface-variant); opacity: 0.4;">qr_code_scanner</span>';
    }
}

export async function toggleTorch(buttonElement, iconElement) {
    if (!html5QrCode || !html5QrCode.isScanning || !torchSupported) {
        console.warn("Scanner is not running or torch unsupported. Cannot toggle torch.");
        return;
    }

    const videoElement = document.querySelector('#qrcode_scanner video');
    if (!videoElement || !videoElement.srcObject) return;
    
    const track = videoElement.srcObject.getVideoTracks()[0];
    if (!track) return;

    const nextOn = !torchOn;

    try {
        await track.applyConstraints({ advanced: [{ torch: nextOn }] });
        
        // Update variables ONLY on success
        torchOn = nextOn;

        if (torchOn) {
            iconElement.textContent = 'flashlight_on';
            buttonElement.style.background = 'color-mix(in srgb, var(--color-primary) 30%, transparent)';
        } else {
            iconElement.textContent = 'flashlight_off';
            buttonElement.style.background = 'color-mix(in srgb, var(--color-primary) 15%, transparent)';
        }
        
        // Optional verification check for drifts
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

