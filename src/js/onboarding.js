import Alpine from 'alpinejs';
import swipeIcon from "@/misc/single-finger-click.svg";
import logoSVG from "@/assets/Logo.svg?raw";

window.Alpine = Alpine;

// Canonical Alpine v3 component registration
Alpine.data('onboarding', () => ({
    current: 0,
    total: 7,
    dragging: false,
    startX: 0,
    dragX: 0,
    pointerId: null,
    showHint: true,

    init() {
        // Load the image source dynamically through Vite ES module
        const hintImg = document.getElementById('swipe-hint-img');
        if (hintImg) hintImg.src = swipeIcon;

        const logoContainer = document.getElementById('logo-container');
        if (logoContainer) {
            logoContainer.innerHTML = logoSVG;
            const svg = logoContainer.querySelector('svg');
            if (svg) {
                // Remove hardcoded width/height and add viewBox so it scales
                svg.removeAttribute('width');
                svg.removeAttribute('height');
                svg.setAttribute('viewBox', '0 0 1389 600');
                svg.style.width = '100%';
                svg.style.height = 'auto';
            }
        }

        // Start background preloading of map assets
        this.preloadMapAssets();
    },

    preloadMapAssets() {
        const BASE = ASSETS_BASE_URL;
        const icons = [
            `${BASE}/icons/settings.svg`,
            `${BASE}/icons/directory_button.svg`
        ];
        const models = [
            `${BASE}/models/njc-l1-v2-31-3.glb`,
            `${BASE}/models/njc-b3-v2-31-3.glb`,
            `${BASE}/models/njc-b2-v2-31-3.glb`,
            `${BASE}/models/njc-b1-v2-31-3.glb`,
            `${BASE}/models/njc-l2-v2-31-3.glb`,
            `${BASE}/models/njc-l3-v2-31-3.glb`,
            `${BASE}/models/njc-l4-v2-31-3.glb`
        ];

        const fetchAsset = async (url) => {
            try {
                await fetch(url, { cache: 'force-cache' });
                console.log(`[Preloader] Cached: ${url}`);
                
                // Persist loaded status for the Map page
                const loaded = JSON.parse(localStorage.getItem('funtasia_preloaded_assets') || '[]');
                if (!loaded.includes(url)) {
                    loaded.push(url);
                    localStorage.setItem('funtasia_preloaded_assets', JSON.stringify(loaded));
                }
            } catch (e) {
                console.warn(`[Preloader] Failed to cache: ${url}`, e);
            }
        };

        // Run after an initial delay so the onboarding interaction sets up smoothly
        setTimeout(async () => {
            // Fetch icons concurrently
            await Promise.all(icons.map(url => fetchAsset(url)));

            // Fetch models sequentially in specified order
            for (const url of models) {
                await fetchAsset(url);
            }
        }, 1000);
    },

    isFinal() {
        return this.current === this.total - 1;
    },

    goTo(url) {
        window.location.href = url;
    },

    next() {
        if (this.current === 0) {
            this.showHint = false;
        }
        if (this.current < this.total - 1) this.current++;
    },

    prev() {
        if (this.current > 0) this.current--;
    },

    onTouchStart(e) {
        this.dragging = true;
        this.startX = e.touches[0].clientX;
        this.dragX = 0;
    },

    onTouchMove(e) {
        if (!this.dragging) return;
        const dx = e.touches[0].clientX - this.startX;
        if (this.current === 0) {
            // First card: no right swipe
            this.dragX = Math.min(dx, 0);
        } else if (this.isFinal()) {
            // Final card: no left swipe
            this.dragX = Math.max(dx, 0);
        } else {
            this.dragX = dx;
        }
    },

    onTouchEnd(e) {
        if (!this.dragging) return;
        this.dragging = false;
        const threshold = this.$refs.viewport.clientWidth * 0.20;
        if (this.dragX < -threshold) {
            this.next();
        } else if (this.dragX > threshold) {
            this.prev();
        }
        this.dragX = 0;
    },

    onMouseDown(e) {
        this.dragging = true;
        this.startX = e.clientX;
        this.dragX = 0;
        e.currentTarget.style.cursor = 'grabbing';
    },

    onMouseMove(e) {
        if (!this.dragging) return;
        const dx = e.clientX - this.startX;
        if (this.current === 0) {
            this.dragX = Math.min(dx, 0);
        } else if (this.isFinal()) {
            this.dragX = Math.max(dx, 0);
        } else {
            this.dragX = dx;
        }
    },

    onMouseUp(e) {
        if (!this.dragging) return;
        this.dragging = false;
        this.$refs.viewport.style.cursor = 'grab';
        const threshold = this.$refs.viewport.clientWidth * 0.20;
        if (this.dragX < -threshold) {
            this.next();
        } else if (this.dragX > threshold) {
            this.prev();
        }
        this.dragX = 0;
    }
}));

Alpine.start();
