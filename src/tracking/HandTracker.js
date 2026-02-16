/**
 * HandTracker — MediaPipe Hands integration
 * Provides hand landmark data for interacting with stones
 */
export class HandTracker {
    constructor() {
        this.hands = null;
        this.camera = null;
        this.isActive = false;
        this.isLoading = false;
        this.onCursorUpdate = null; // callback: ({x, y, isPinching}) => void

        this.videoEl = document.getElementById('camera-feed');
        this.cameraContainer = document.getElementById('camera-container');
        this.toggleBtn = document.getElementById('hand-tracking-btn');

        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggle());
        }
    }

    /**
     * Toggle hand tracking on/off
     */
    async toggle() {
        if (this.isActive) {
            this.stop();
        } else {
            await this.start();
        }
    }

    /**
     * Start hand tracking
     */
    async start() {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            // Dynamically import MediaPipe
            const { Hands } = await import('@mediapipe/hands');
            const { Camera } = await import('@mediapipe/camera_utils');

            this.hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                },
            });

            this.hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.5,
            });

            this.hands.onResults((results) => this._onResults(results));

            // Start camera
            this.camera = new Camera(this.videoEl, {
                onFrame: async () => {
                    if (this.hands && this.isActive) {
                        await this.hands.send({ image: this.videoEl });
                    }
                },
                width: 320,
                height: 240,
            });

            await this.camera.start();

            this.isActive = true;
            this.isLoading = false;

            // Update UI
            if (this.toggleBtn) this.toggleBtn.classList.add('active');
            if (this.cameraContainer) this.cameraContainer.classList.remove('hidden');

        } catch (err) {
            console.error('Hand tracking failed to start:', err);
            this.isLoading = false;
        }
    }

    /**
     * Stop hand tracking
     */
    stop() {
        this.isActive = false;

        if (this.camera) {
            this.camera.stop();
            this.camera = null;
        }

        if (this.hands) {
            this.hands.close();
            this.hands = null;
        }

        // Update UI
        if (this.toggleBtn) this.toggleBtn.classList.remove('active');
        if (this.cameraContainer) this.cameraContainer.classList.add('hidden');

        // Clear cursor
        if (this.onCursorUpdate) {
            this.onCursorUpdate(null);
        }
    }

    /**
     * Process MediaPipe results
     * @param {Object} results
     */
    _onResults(results) {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            if (this.onCursorUpdate) {
                this.onCursorUpdate(null);
            }
            return;
        }

        const landmarks = results.multiHandLandmarks[0];

        // Index finger tip (landmark 8)
        const indexTip = landmarks[8];
        // Thumb tip (landmark 4)
        const thumbTip = landmarks[4];

        // Pinch detection: distance between thumb and index finger
        const dx = indexTip.x - thumbTip.x;
        const dy = indexTip.y - thumbTip.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const isPinching = distance < 0.06;

        // Use index finger as cursor position
        // Mirror X because camera is mirrored
        const cursor = {
            x: 1 - indexTip.x,
            y: indexTip.y,
            isPinching,
        };

        if (this.onCursorUpdate) {
            this.onCursorUpdate(cursor);
        }
    }

    /**
     * Destroy tracker
     */
    destroy() {
        this.stop();
    }
}
