import * as escapeQueue from '@/js/queue/escapeQueue.js';
import { startScanner, stopScanner } from '@/js/helper/qrScanner.js';
import { showToast } from '@/js/ui_ux/ui.js';

/**
 * Initializes the Escape Room Queue UI logic.
 * Handles screen transitions, scanning, joining, and status updates.
 */
export function initEscapeQueueUI() {
    const openQueueBtn = document.getElementById('open-queue-btn');
    const closeQueueBtn = document.getElementById('close-queue-btn');
    const queueModal = document.getElementById('queue-modal-wrapper');
    const queueBackdrop = document.getElementById('queue-modal-backdrop');
    const queueModalTitle = document.getElementById('queue-modal-title');
    const queueModalSubtitle = document.getElementById('queue-modal-subtitle');

    const qScreens = {
        instructions: document.getElementById('queue-screen-instructions'),
        scanner: document.getElementById('queue-screen-scanner'),
        join: document.getElementById('queue-screen-join'),
        wait: document.getElementById('queue-screen-wait'),
        notified: document.getElementById('queue-screen-notified'),
        expired: document.getElementById('queue-screen-expired')
    };

    function showQueueScreen(screenName) {
        Object.values(qScreens).forEach(s => {
            if (s) {
                s.classList.remove('active');
                s.style.display = 'none';
            }
        });
        const target = qScreens[screenName];
        if (target) {
            target.classList.add('active');
            target.style.display = 'flex';
            target.style.width = '100%';
        }
    }

    let qValidityInterval = null;

    function startValidityTimer(secsLeft) {
        if (qValidityInterval) clearInterval(qValidityInterval);
        const el = document.getElementById('queue-token-timer');
        let left = secsLeft;
        
        const tick = () => {
            if (left <= 0) {
                clearInterval(qValidityInterval);
                document.getElementById('queue-join-error').textContent = "Token expired. Please scan again.";
                el.textContent = "Token expired";
                document.getElementById('queue-submit-btn').disabled = true;
            } else {
                el.textContent = `Valid — join within ${left}s`;
                left--;
            }
        };
        tick();
        qValidityInterval = setInterval(tick, 1000);
    }

    function handleQueueQRScanned(decodedText) {
        const result = escapeQueue.handleScannedQR(decodedText);
        stopScanner('queue_qrcode_scanner');
        
        if (!result.valid) {
            document.getElementById('queue-scan-error').textContent = result.error;
            setTimeout(() => {
                document.getElementById('queue-scan-error').textContent = '';
                startScanner(handleQueueQRScanned, 'queue_qrcode_scanner');
            }, 3000);
            return;
        }

        queueModalTitle.textContent = "Join Queue";
        queueModalSubtitle.textContent = "Enter your details";
        document.getElementById('queue-submit-btn').disabled = false;
        document.getElementById('queue-name-input').value = '';
        document.getElementById('queue-join-error').textContent = '';
        startValidityTimer(result.secsLeft);
        showQueueScreen('join');
    }

    escapeQueue.setCallbacks({
        onWaiting: (pos, total) => {
            const session = escapeQueue.getSession();
            if (session) {
                document.getElementById('queue-wait-name').textContent = session.label;
            }
            document.getElementById('queue-wait-position').textContent = escapeQueue.ordinal(pos);
            document.getElementById('queue-wait-ahead').textContent = pos > 1 ? `${pos - 1} people ahead of you` : 'You are next! Please wait to be called.';
            showQueueScreen('wait');
        },
        onNotified: (notifiedAt) => {
            showQueueScreen('notified');
            escapeQueue.startCountdown(notifiedAt);
        },
        onExpired: () => {
            showQueueScreen('expired');
        },
        onRemoved: () => {
            showToast("You were removed from the queue.", 3000);
            showQueueScreen('instructions');
        },
        onTick: (m, s) => {
            document.getElementById('queue-countdown').textContent = `${m}:${s}`;
        }
    });

    // Page Load logic for ?t= token
    const params = new URLSearchParams(window.location.search);
    const token = params.get("t");
    if (token) {
        window.history.replaceState({}, "", window.location.pathname);
        const result = escapeQueue.handleURLToken(token);
        if (result.valid) {
            queueModal.style.display = 'block';
            if (window.hideFabButtons) window.hideFabButtons();
            
            queueModalTitle.textContent = "Join Queue";
            queueModalSubtitle.textContent = "Enter your details";
            document.getElementById('queue-submit-btn').disabled = false;
            document.getElementById('queue-name-input').value = '';
            document.getElementById('queue-join-error').textContent = '';
            startValidityTimer(result.secsLeft);
            showQueueScreen('join');
        } else {
            showToast(result.error, 4000);
        }
    }

    openQueueBtn.addEventListener('click', () => {
        queueModal.style.display = 'block';
        if (window.hideFabButtons) window.hideFabButtons();
        
        queueModalTitle.textContent = "Escape Room Queue";
        queueModalSubtitle.textContent = "Check status or join the line";
        
        const nextScreen = escapeQueue.init();
        if (nextScreen === "resume") {
            const session = escapeQueue.getSession();
            if (session) {
                escapeQueue.startPolling(session.id);
                showQueueScreen('wait'); 
            }
        } else {
            showQueueScreen('instructions');
        }
    });

    document.getElementById('queue-scan-btn').addEventListener('click', () => {
        queueModalTitle.textContent = "Scan QR";
        queueModalSubtitle.textContent = "Scan the booth QR code";
        document.getElementById('queue-scan-error').textContent = '';
        showQueueScreen('scanner');
        startScanner(handleQueueQRScanned, 'queue_qrcode_scanner');
    });

    document.getElementById('queue-back-to-instructions-btn').addEventListener('click', () => {
        queueModalTitle.textContent = "Escape Room Queue";
        queueModalSubtitle.textContent = "Check status or join the line";
        stopScanner('queue_qrcode_scanner');
        showQueueScreen('instructions');
    });

    document.getElementById('queue-submit-btn').addEventListener('click', async () => {
        const name = document.getElementById('queue-name-input').value.trim();
        if (!name) {
            document.getElementById('queue-join-error').textContent = "Please enter your name.";
            return;
        }
        const res = await escapeQueue.joinQueue(name);
        if (!res.success) {
            document.getElementById('queue-join-error').textContent = res.error;
            return;
        }
        if (qValidityInterval) clearInterval(qValidityInterval);
    });

    const closeHandler = () => {
        queueModal.style.removeProperty('display');
        if (window.showFabButtons) window.showFabButtons();
        stopScanner('queue_qrcode_scanner');
        escapeQueue.stopPolling();
        escapeQueue.stopCountdown();
    };
    closeQueueBtn.addEventListener('click', closeHandler);
    queueBackdrop.addEventListener('click', closeHandler);
}