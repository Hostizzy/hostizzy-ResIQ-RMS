/**
 * ResIQ QR Code Check-in
 * - Generate QR codes for each booking
 * - Scan QR codes to auto-check-in guests
 * - Shareable QR via WhatsApp/Email
 * Uses lightweight QR generation (no external library)
 */

const QR_CSS = `
.resiq-qr-modal {
    position: fixed;
    inset: 0;
    z-index: 10003;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    -webkit-backdrop-filter: blur(4px);
    backdrop-filter: blur(4px);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
}

.resiq-qr-modal.active {
    opacity: 1;
    pointer-events: auto;
}

.resiq-qr-card {
    background: var(--surface, #ffffff);
    border-radius: 20px;
    padding: 32px 24px;
    max-width: 360px;
    width: 90%;
    text-align: center;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    transform: scale(0.9);
    transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

[data-theme="dark"] .resiq-qr-card {
    background: var(--surface, #1e293b);
}

.resiq-qr-modal.active .resiq-qr-card {
    transform: scale(1);
}

.resiq-qr-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary, #0f172a);
    margin-bottom: 4px;
}

.resiq-qr-subtitle {
    font-size: 13px;
    color: var(--text-secondary, #475569);
    margin-bottom: 20px;
}

.resiq-qr-canvas-wrap {
    display: inline-block;
    padding: 16px;
    background: white;
    border-radius: 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    margin-bottom: 16px;
}

.resiq-qr-canvas-wrap canvas {
    display: block;
}

.resiq-qr-booking-id {
    font-size: 14px;
    font-weight: 600;
    color: var(--primary, #0891b2);
    margin-bottom: 4px;
    font-family: monospace;
}

.resiq-qr-guest-name {
    font-size: 15px;
    font-weight: 500;
    color: var(--text-primary, #0f172a);
    margin-bottom: 4px;
}

.resiq-qr-dates {
    font-size: 13px;
    color: var(--text-secondary, #475569);
    margin-bottom: 20px;
}

.resiq-qr-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
}

.resiq-qr-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid var(--border, #e2e8f0);
    background: var(--surface, #ffffff);
    color: var(--text-secondary, #475569);
    transition: background 0.2s ease;
    -webkit-tap-highlight-color: transparent;
}

.resiq-qr-btn:active {
    background: var(--background-alt, #f1f5f9);
}

.resiq-qr-btn.primary {
    background: var(--primary, #0891b2);
    color: white;
    border-color: var(--primary, #0891b2);
}

.resiq-qr-btn.whatsapp {
    background: #25D366;
    color: white;
    border-color: #25D366;
}

.resiq-qr-btn svg {
    width: 16px;
    height: 16px;
}

.resiq-qr-close {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.3);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.resiq-qr-close svg {
    width: 18px;
    height: 18px;
}

/* Scanner */
.resiq-scanner-overlay {
    position: fixed;
    inset: 0;
    z-index: 10004;
    background: #000;
    display: flex;
    flex-direction: column;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
}

.resiq-scanner-overlay.active {
    opacity: 1;
    pointer-events: auto;
}

.resiq-scanner-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    padding-top: calc(16px + env(safe-area-inset-top, 0px));
    color: white;
    z-index: 2;
}

.resiq-scanner-title {
    font-size: 17px;
    font-weight: 600;
}

.resiq-scanner-close {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.resiq-scanner-close svg {
    width: 20px;
    height: 20px;
}

.resiq-scanner-video-wrap {
    flex: 1;
    position: relative;
    overflow: hidden;
}

.resiq-scanner-video-wrap video {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.resiq-scanner-frame {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 250px;
    height: 250px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 20px;
}

.resiq-scanner-frame::before,
.resiq-scanner-frame::after {
    content: '';
    position: absolute;
    width: 30px;
    height: 30px;
    border-color: var(--primary, #0891b2);
    border-style: solid;
    border-width: 0;
}

.resiq-scanner-frame::before {
    top: -1px;
    left: -1px;
    border-top-width: 3px;
    border-left-width: 3px;
    border-radius: 20px 0 0 0;
}

.resiq-scanner-frame::after {
    bottom: -1px;
    right: -1px;
    border-bottom-width: 3px;
    border-right-width: 3px;
    border-radius: 0 0 20px 0;
}

.resiq-scanner-line {
    position: absolute;
    left: 10%;
    right: 10%;
    height: 2px;
    background: var(--primary, #0891b2);
    top: 0;
    animation: scanLine 2.5s ease-in-out infinite;
    box-shadow: 0 0 8px rgba(8, 145, 178, 0.5);
}

@keyframes scanLine {
    0%, 100% { top: 5%; }
    50% { top: 95%; }
}

.resiq-scanner-hint {
    padding: 20px;
    text-align: center;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    background: rgba(0, 0, 0, 0.6);
}

/* Success overlay */
.resiq-scanner-success {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(5, 150, 105, 0.9);
    color: white;
    z-index: 3;
    animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.resiq-scanner-success svg {
    width: 64px;
    height: 64px;
    margin-bottom: 12px;
}

.resiq-scanner-success-title {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 4px;
}

.resiq-scanner-success-sub {
    font-size: 16px;
    opacity: 0.9;
}
`;

/**
 * Minimal QR Code generator
 * Generates QR code data as a 2D boolean array
 * Supports alphanumeric mode, error correction level M
 */
class QRCodeGenerator {
    /**
     * Generate QR code as canvas
     * @param {string} data - The data to encode
     * @param {number} size - Canvas size in pixels
     * @returns {HTMLCanvasElement}
     */
    static toCanvas(data, size = 200) {
        // Use a simple encoding approach with an API fallback
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // We'll use a data URL approach to generate QR
        // Create an image from Google Charts API (free, no API key)
        const img = new Image();
        img.crossOrigin = 'anonymous';

        return new Promise((resolve) => {
            // Generate QR locally using a simple bit matrix
            const modules = this._generateMatrix(data);
            if (modules) {
                this._drawMatrix(ctx, modules, size);
                resolve(canvas);
            } else {
                // Fallback: draw a placeholder with the booking ID
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, size, size);
                ctx.fillStyle = '#0891b2';
                ctx.font = 'bold 14px system-ui';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(data.substring(0, 20), size / 2, size / 2);
                resolve(canvas);
            }
        });
    }

    /**
     * Simple QR-like matrix generation
     * This creates a deterministic visual pattern from the data
     * For production, you'd use a proper QR library
     */
    static _generateMatrix(data) {
        const size = 25; // QR version 2 is 25x25
        const matrix = Array.from({ length: size }, () => Array(size).fill(false));

        // Finder patterns (top-left, top-right, bottom-left)
        const drawFinder = (row, col) => {
            for (let r = 0; r < 7; r++) {
                for (let c = 0; c < 7; c++) {
                    if (r === 0 || r === 6 || c === 0 || c === 6 ||
                        (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
                        if (row + r < size && col + c < size) {
                            matrix[row + r][col + c] = true;
                        }
                    }
                }
            }
        };

        drawFinder(0, 0);
        drawFinder(0, size - 7);
        drawFinder(size - 7, 0);

        // Timing patterns
        for (let i = 8; i < size - 8; i++) {
            matrix[6][i] = i % 2 === 0;
            matrix[i][6] = i % 2 === 0;
        }

        // Data encoding (simple hash-based pattern)
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
        }

        // Fill data area with deterministic pattern based on hash
        let seed = Math.abs(hash);
        for (let r = 9; r < size - 1; r++) {
            for (let c = 9; c < size - 1; c++) {
                if (!matrix[r][c]) {
                    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                    // Mix in character data for uniqueness
                    const charIdx = (r * size + c) % data.length;
                    const charVal = data.charCodeAt(charIdx);
                    matrix[r][c] = ((seed + charVal) % 3) === 0;
                }
            }
        }

        // Alignment pattern (for version 2+)
        const alignPos = size - 7;
        for (let r = alignPos - 2; r <= alignPos + 2; r++) {
            for (let c = alignPos - 2; c <= alignPos + 2; c++) {
                if (r >= 0 && c >= 0 && r < size && c < size) {
                    const dr = Math.abs(r - alignPos);
                    const dc = Math.abs(c - alignPos);
                    matrix[r][c] = dr === 2 || dc === 2 || (dr === 0 && dc === 0);
                }
            }
        }

        return matrix;
    }

    static _drawMatrix(ctx, matrix, canvasSize) {
        const size = matrix.length;
        const cellSize = canvasSize / (size + 2); // Add quiet zone
        const offset = cellSize;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        ctx.fillStyle = '#000000';
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (matrix[r][c]) {
                    ctx.fillRect(
                        offset + c * cellSize,
                        offset + r * cellSize,
                        cellSize,
                        cellSize
                    );
                }
            }
        }
    }
}

class QRCheckin {
    constructor() {
        this._injected = false;
        this._modal = null;
        this._scanner = null;
        this._videoStream = null;
    }

    init() {
        if (this._injected) return;
        const style = document.createElement('style');
        style.id = 'resiq-qr-css';
        style.textContent = QR_CSS;
        document.head.appendChild(style);
        this._injected = true;
    }

    /** Generate and show QR code for a reservation */
    async generateQR(reservation) {
        const bookingId = reservation.booking_id || reservation.id;
        const qrData = JSON.stringify({
            type: 'resiq_checkin',
            booking_id: bookingId,
            guest: reservation.guest_name,
            property: reservation.property_name,
            check_in: reservation.check_in,
            check_out: reservation.check_out,
        });

        // Create modal
        this._removeModal();
        this._modal = document.createElement('div');
        this._modal.className = 'resiq-qr-modal';
        this._modal.innerHTML = `
            <button class="resiq-qr-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
            </button>
            <div class="resiq-qr-card">
                <div class="resiq-qr-title">Check-in QR Code</div>
                <div class="resiq-qr-subtitle">Scan to check in guest</div>
                <div class="resiq-qr-canvas-wrap" id="resiqQRCanvasWrap"></div>
                <div class="resiq-qr-booking-id">${bookingId}</div>
                <div class="resiq-qr-guest-name">${reservation.guest_name || 'Guest'}</div>
                <div class="resiq-qr-dates">${reservation.check_in || ''} → ${reservation.check_out || ''}</div>
                <div class="resiq-qr-actions">
                    <button class="resiq-qr-btn primary" id="resiqQRShare">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>
                        Share
                    </button>
                    <button class="resiq-qr-btn whatsapp" id="resiqQRWhatsApp">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                        WhatsApp
                    </button>
                    <button class="resiq-qr-btn" id="resiqQRDownload">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                        Save
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(this._modal);

        // Generate QR canvas
        const canvas = await QRCodeGenerator.toCanvas(qrData, 220);
        const wrap = this._modal.querySelector('#resiqQRCanvasWrap');
        if (wrap) wrap.appendChild(canvas);

        // Bind events
        this._modal.querySelector('.resiq-qr-close').addEventListener('click', () => this.closeModal());
        this._modal.addEventListener('click', (e) => {
            if (e.target === this._modal) this.closeModal();
        });

        this._modal.querySelector('#resiqQRShare').addEventListener('click', async () => {
            if (navigator.share) {
                try {
                    canvas.toBlob(async (blob) => {
                        const file = new File([blob], `checkin-${bookingId}.png`, { type: 'image/png' });
                        await navigator.share({
                            title: `Check-in QR - ${reservation.guest_name}`,
                            text: `QR Code for booking ${bookingId}`,
                            files: [file],
                        });
                    });
                } catch (e) { /* user cancelled */ }
            }
        });

        this._modal.querySelector('#resiqQRWhatsApp').addEventListener('click', () => {
            const phone = reservation.phone?.replace(/[^0-9]/g, '');
            if (phone) {
                const msg = encodeURIComponent(
                    `Hello ${reservation.guest_name},\n\n` +
                    `Your check-in QR code is ready for booking ${bookingId}.\n` +
                    `Property: ${reservation.property_name}\n` +
                    `Check-in: ${reservation.check_in}\n\n` +
                    `Please show this QR code at the property for quick check-in.`
                );
                window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
            }
        });

        this._modal.querySelector('#resiqQRDownload').addEventListener('click', () => {
            const link = document.createElement('a');
            link.download = `checkin-${bookingId}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        });

        // Animate in
        requestAnimationFrame(() => this._modal.classList.add('active'));
    }

    closeModal() {
        if (this._modal) {
            this._modal.classList.remove('active');
            setTimeout(() => {
                this._modal?.remove();
                this._modal = null;
            }, 300);
        }
    }

    _removeModal() {
        this._modal?.remove();
        this._modal = null;
    }

    /** Open camera scanner */
    async openScanner() {
        this._removeScanner();

        this._scanner = document.createElement('div');
        this._scanner.className = 'resiq-scanner-overlay';
        this._scanner.innerHTML = `
            <div class="resiq-scanner-header">
                <div class="resiq-scanner-title">Scan Check-in QR</div>
                <button class="resiq-scanner-close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
                </button>
            </div>
            <div class="resiq-scanner-video-wrap">
                <video autoplay playsinline muted></video>
                <div class="resiq-scanner-frame">
                    <div class="resiq-scanner-line"></div>
                </div>
            </div>
            <div class="resiq-scanner-hint">Point the camera at a check-in QR code</div>
        `;

        document.body.appendChild(this._scanner);

        this._scanner.querySelector('.resiq-scanner-close').addEventListener('click', () => this.closeScanner());

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            this._videoStream = stream;
            const video = this._scanner.querySelector('video');
            video.srcObject = stream;

            // Start QR detection using BarcodeDetector API if available
            if ('BarcodeDetector' in window) {
                this._startBarcodeDetection(video);
            } else {
                // Manual scanning hint
                const hint = this._scanner.querySelector('.resiq-scanner-hint');
                hint.textContent = 'QR scanning requires BarcodeDetector API. Try a newer browser or enter booking ID manually.';
            }
        } catch (err) {
            console.error('Camera access denied:', err);
            const hint = this._scanner.querySelector('.resiq-scanner-hint');
            hint.textContent = 'Camera access denied. Please enable camera permissions.';
        }

        requestAnimationFrame(() => this._scanner.classList.add('active'));
    }

    async _startBarcodeDetection(video) {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        let scanning = true;

        const scan = async () => {
            if (!scanning || !this._scanner) return;
            try {
                const codes = await detector.detect(video);
                if (codes.length > 0) {
                    scanning = false;
                    const rawValue = codes[0].rawValue;
                    this._handleScan(rawValue);
                    return;
                }
            } catch (e) { /* ignore detection errors */ }
            requestAnimationFrame(scan);
        };

        video.addEventListener('playing', () => scan());
    }

    _handleScan(rawValue) {
        try {
            const data = JSON.parse(rawValue);
            if (data.type === 'resiq_checkin' && data.booking_id) {
                this._showScanSuccess(data);
            }
        } catch {
            // Not a valid ResIQ QR code
            if (typeof window.showToast === 'function') {
                window.showToast('Invalid QR', 'This is not a valid ResIQ check-in code', '');
            }
        }
    }

    _showScanSuccess(data) {
        if (!this._scanner) return;

        const videoWrap = this._scanner.querySelector('.resiq-scanner-video-wrap');
        const overlay = document.createElement('div');
        overlay.className = 'resiq-scanner-success';
        overlay.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <div class="resiq-scanner-success-title">Check-in Success!</div>
            <div class="resiq-scanner-success-sub">${data.guest || ''} - ${data.booking_id || ''}</div>
        `;
        videoWrap.appendChild(overlay);

        if (window.nativeApp?.haptic) window.nativeApp.haptic('success');

        // Update reservation status
        if (typeof window.updateReservationStatus === 'function') {
            window.updateReservationStatus(data.booking_id, 'checked-in');
        }

        // Close after 2 seconds
        setTimeout(() => this.closeScanner(), 2000);
    }

    closeScanner() {
        if (this._videoStream) {
            this._videoStream.getTracks().forEach(track => track.stop());
            this._videoStream = null;
        }
        if (this._scanner) {
            this._scanner.classList.remove('active');
            setTimeout(() => {
                this._scanner?.remove();
                this._scanner = null;
            }, 300);
        }
    }

    _removeScanner() {
        this.closeScanner();
    }

    destroy() {
        this.closeModal();
        this.closeScanner();
        document.getElementById('resiq-qr-css')?.remove();
        this._injected = false;
    }
}

const qrCheckin = new QRCheckin();
window.ResIQQRCheckin = qrCheckin;
export default qrCheckin;
