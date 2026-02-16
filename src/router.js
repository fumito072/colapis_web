/**
 * Router — Lightweight hash-based SPA router
 * Extensible for adding new pages/worlds
 */
export class Router {
    constructor() {
        /** @type {Map<string, Function>} */
        this.routes = new Map();
        this.currentRoute = '';
        this.onRouteChange = null; // callback: (route, prevRoute) => void

        window.addEventListener('hashchange', () => this._handleRoute());
    }

    /**
     * Register a route
     * @param {string} path — e.g. '#/company'
     * @param {Function} handler — () => HTMLElement or string
     */
    add(path, handler) {
        this.routes.set(path, handler);
        return this;
    }

    /**
     * Navigate to a route
     * @param {string} path 
     */
    navigate(path) {
        window.location.hash = path;
    }

    /**
     * Go back to top
     */
    goHome() {
        window.location.hash = '#/';
    }

    /**
     * Initialize router (process current hash)
     */
    init() {
        this._handleRoute();
    }

    /**
     * Handle route change
     */
    _handleRoute() {
        const hash = window.location.hash || '#/';
        const prevRoute = this.currentRoute;
        this.currentRoute = hash;

        if (this.onRouteChange) {
            this.onRouteChange(hash, prevRoute);
        }
    }

    /**
     * Get current route handler
     * @returns {Function|null}
     */
    getHandler() {
        return this.routes.get(this.currentRoute) || null;
    }

    /**
     * Check if we're on the top page
     * @returns {boolean}
     */
    isTopPage() {
        return this.currentRoute === '#/' || this.currentRoute === '' || this.currentRoute === '#';
    }
}
