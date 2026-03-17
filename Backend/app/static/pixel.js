(function () {
    // Outmate.ai Visitor Tracking Pixel v2.0
    // Features: SPA route tracking, dwell time, cookie fallback, email auto-capture
    const scriptTag = document.currentScript;
    const PIXEL_KEY = scriptTag?.dataset?.pixelKey ?? scriptTag?.getAttribute('data-pixel-key');
    if (!PIXEL_KEY) {
        console.warn('Outmate Pixel: Missing data-pixel-key attribute.');
        return;
    }

    // Auto-detect the tracking URL from the script's own src domain.
    // This allows the pixel to work on ANY customer site — it always posts
    // back to whatever domain served pixel.js (e.g. app.outmate.ai).
    let TRACK_URL = 'https://app.outmate.ai/api/v1/visitors/track';
    if (scriptTag?.src) {
        try {
            const u = new URL(scriptTag.src);
            TRACK_URL = `${u.protocol}//${u.host}/api/v1/visitors/track`;
        } catch (_) { /* fallback to default above */ }
    }

    const EMAIL_KEY = 'outmate_visitor_email';
    const VISITOR_ID_KEY = 'outmate_visitor_id';
    const MIN_DWELL_MS = 500; // Minimum ms on page before tracking (filters instant bounces)

    // ─── Persistence: localStorage with cookie fallback (Safari ITP) ─────────
    function storageSet(key, value) {
        try { localStorage.setItem(key, value); } catch (_) {}
        try {
            const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toUTCString();
            document.cookie = `${key}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
        } catch (_) {}
    }

    function storageGet(key) {
        try {
            const val = localStorage.getItem(key);
            if (val) return val;
        } catch (_) {}
        try {
            const match = document.cookie.match(`(?:^|; )${key}=([^;]*)`);
            return match ? decodeURIComponent(match[1]) : null;
        } catch (_) {}
        return null;
    }

    function storageRemove(key) {
        try { localStorage.removeItem(key); } catch (_) {}
        try { document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`; } catch (_) {}
    }

    // ─── Visitor ID ──────────────────────────────────────────────────────────
    function getVisitorId() {
        let id = storageGet(VISITOR_ID_KEY);
        if (!id) {
            id = `v_${Math.random().toString(36).substring(2, 14)}${Date.now().toString(36)}`;
            storageSet(VISITOR_ID_KEY, id);
        }
        return id;
    }

    // ─── Track ───────────────────────────────────────────────────────────────
    let _lastTrackedUrl = null;
    let _pageEntryTime = Date.now();

    function track(email, forcedUrl) {
        const url = forcedUrl ?? globalThis.location.href;

        // Avoid double-tracking the exact same URL in the same session (unless email)
        if (!email && url === _lastTrackedUrl) return;
        _lastTrackedUrl = url;

        const payload = JSON.stringify({
            url,
            referrer: document.referrer || '',
            pixel_key: PIXEL_KEY,
            email: email ?? storageGet(EMAIL_KEY),
            visitor_id: getVisitorId(),
        });

        // Prefer sendBeacon (reliable on page-unload), fallback to fetch
        let sent = false;
        if (typeof navigator.sendBeacon === 'function') {
            try {
                sent = navigator.sendBeacon(TRACK_URL, new Blob([payload], { type: 'application/json' }));
            } catch (_) {}
        }
        if (!sent) {
            fetch(TRACK_URL, {
                method: 'POST',
                body: payload,
                mode: 'cors',
                keepalive: true,
                headers: { 'Content-Type': 'application/json' },
            }).catch(() => {});
        }
    }

    // ─── SPA Route Change Tracking ───────────────────────────────────────────
    // Patches history.pushState / replaceState to detect client-side navigation
    function patchHistoryMethod(method) {
        const original = history[method];
        history[method] = function (...args) {
            const prevUrl = globalThis.location.href;
            const result = original.apply(this, args);
            const newUrl = globalThis.location.href;
            if (newUrl !== prevUrl) {
                const dwell = Date.now() - _pageEntryTime;
                _pageEntryTime = Date.now();
                if (dwell >= MIN_DWELL_MS) {
                    setTimeout(() => track(null, newUrl), 100);
                }
            }
            return result;
        };
    }

    if (typeof history !== 'undefined') {
        patchHistoryMethod('pushState');
        patchHistoryMethod('replaceState');
        globalThis.addEventListener('popstate', () => {
            const dwell = Date.now() - _pageEntryTime;
            _pageEntryTime = Date.now();
            if (dwell >= MIN_DWELL_MS) {
                setTimeout(() => track(null, globalThis.location.href), 100);
            }
        });
    }

    // ─── Email auto-capture from form submissions ─────────────────────────────
    function findEmailInForm(form) {
        const targeted = form.querySelectorAll(
            'input[type="email"], input[name*="email" i], input[id*="email" i], input[placeholder*="email" i]'
        );
        for (const input of targeted) {
            const val = input.value?.trim();
            if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return val;
        }
        // Fallback: scan all text inputs for email pattern
        for (const input of form.querySelectorAll('input[type="text"], input:not([type])')) {
            const v = input.value?.trim();
            if (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v;
        }
        return null;
    }

    function handleFormEmail(form) {
        const email = findEmailInForm(form);
        if (email) {
            storageSet(EMAIL_KEY, email);
            track(email);
        }
    }

    // Native form submit
    document.addEventListener('submit', (e) => {
        if (e.target?.tagName === 'FORM') handleFormEmail(e.target);
    }, true);

    // SPA-style button clicks (JS-driven form submission)
    document.addEventListener('click', (e) => {
        const btn = e.target?.closest?.('button[type="submit"], input[type="submit"]');
        const form = btn?.closest?.('form');
        if (form) handleFormEmail(form);
    }, true);

    // ─── Public API ───────────────────────────────────────────────────────────
    globalThis.outmate = {
        /**
         * Manually identify the current visitor by email.
         * Call this after your own login / signup events.
         * @param {string} email
         */
        identify(email) {
            if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                storageSet(EMAIL_KEY, email);
                track(email);
            }
        },
        /**
         * Clear tracking data (e.g. on logout).
         */
        reset() {
            storageRemove(EMAIL_KEY);
            storageRemove(VISITOR_ID_KEY);
            _lastTrackedUrl = null;
        },
        /**
         * Force-track the current page (useful for non-standard SPAs).
         */
        trackPage() {
            _lastTrackedUrl = null;
            track(null);
        },
    };

    // ─── Initial page load tracking ──────────────────────────────────────────
    function initialTrack() {
        _pageEntryTime = Date.now();
        setTimeout(() => track(null), MIN_DWELL_MS);
    }

    if (document.readyState === 'complete') {
        initialTrack();
    } else {
        globalThis.addEventListener('load', initialTrack);
    }
})();
