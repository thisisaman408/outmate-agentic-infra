(function () {
    // Outmate.ai Visitor Tracking Pixel v2.3
    // Features: SPA route tracking, dwell time, scroll depth, click tracking,
    //           cookie fallback (Safari ITP), email auto-capture, bot filtering,
    //           browser fingerprinting, full consent/opt-out support.
    //           Consent: DoNotTrack, GPC, Cookiebot, OneTrust, TCF 2.0 (IAB)

    const scriptTag = document.currentScript;
    const PIXEL_KEY = scriptTag?.dataset?.pixelKey ?? scriptTag?.getAttribute('data-pixel-key');
    if (!PIXEL_KEY) {
        console.warn('Outmate Pixel: Missing data-pixel-key attribute.');
        return;
    }

    // ─── Consent & GDPR Gate ──────────────────────────────────────────────────
    // OPT_OUT_KEY is declared first so it is available inside _isConsentDenied().
    const OPT_OUT_KEY = 'outmate_optout';

    /**
     * Returns true when tracking is clearly denied by any synchronous signal.
     * Called at startup AND inside track() to catch consent revocation mid-session.
     */
    function _isConsentDenied() {
        // 1. Hard localStorage opt-out set by outmate.optOut()
        try { if (localStorage.getItem(OPT_OUT_KEY) === '1') return true; } catch (_) {}

        // 2. W3C Do Not Track browser signal
        if (navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes' ||
            window.doNotTrack === '1') return true;

        // 3. Global Privacy Control (GPC) — Chrome 94+, Firefox
        if (navigator.globalPrivacyControl === true) return true;

        // 4. Cookiebot CMP — check analytics / marketing consent categories
        try {
            const cb = window.Cookiebot;
            if (cb) {
                if (cb.declined) return true;
                // User has consented but declined analytics + marketing categories
                if (cb.consented && !cb.consent?.statistics && !cb.consent?.marketing) return true;
            }
        } catch (_) {}

        // 5. OneTrust — C0002 = Performance/Analytics must be in active groups
        try {
            if (typeof window.OnetrustActiveGroups === 'string') {
                const active = window.OnetrustActiveGroups.split(',');
                if (!active.includes('C0002')) return true;
            }
        } catch (_) {}

        return false;
    }

    // Hard-block: bail out immediately on any clear synchronous denial
    if (_isConsentDenied()) return;

    // ─── TCF 2.0 Async Consent ────────────────────────────────────────────────
    // When a CMP implementing IAB Transparency and Consent Framework v2.0 is
    // present, defer all tracking until Purpose 1 (storage) AND Purpose 7
    // (measurement/analytics) are consented.  Without TCF, default to granted.
    let _consentGranted = (typeof window.__tcfapi !== 'function');
    let _pendingInitialTrack = false;

    if (typeof window.__tcfapi === 'function') {
        window.__tcfapi('addEventListener', 2, function (tcData, success) {
            if (!success) {
                // CMP error — fail open so tracking is not permanently blocked
                _consentGranted = true;
                if (_pendingInitialTrack) { _pendingInitialTrack = false; _doInitialTrack(); }
                return;
            }
            const purposes = tcData.purpose?.consents;
            const hasConsent = !!(purposes?.[1] && purposes?.[7]);

            if (hasConsent && !_consentGranted) {
                _consentGranted = true;
                if (_pendingInitialTrack) { _pendingInitialTrack = false; _doInitialTrack(); }
            } else if (!hasConsent && tcData.eventStatus === 'useractioncomplete') {
                _consentGranted = false;
                // Remove the listener — user made an explicit choice
                try {
                    window.__tcfapi('removeEventListener', 2, function () {}, tcData.listenerId);
                } catch (_) {}
            }
        });
    }

    // Listen for Cookiebot banner decision
    window.addEventListener('CookiebotOnAccept', function () {
        if (!_isConsentDenied()) {
            _consentGranted = true;
            if (_pendingInitialTrack) { _pendingInitialTrack = false; _doInitialTrack(); }
        }
    });
    window.addEventListener('CookiebotOnDecline', function () { _consentGranted = false; });

    // Listen for OneTrust banner close (consent choice made)
    window.addEventListener('OptanonAlertBoxClosed', function () {
        if (!_isConsentDenied()) {
            _consentGranted = true;
            if (_pendingInitialTrack) { _pendingInitialTrack = false; _doInitialTrack(); }
        } else {
            _consentGranted = false;
        }
    });

    // ─── Configuration ────────────────────────────────────────────────────────
    let TRACK_URL = 'https://app.outmate.ai/api/v1/visitors/track';
    if (scriptTag?.src) {
        try {
            const u = new URL(scriptTag.src);
            TRACK_URL = `${u.protocol}//${u.host}/api/v1/visitors/track`;
        } catch (_) {}
    }

    const EMAIL_KEY = 'outmate_visitor_email';
    const VISITOR_ID_KEY = 'outmate_visitor_id';
    const SESSION_ID_KEY = 'outmate_session_id';
    const IDENTITY_KEY = 'outmate_identity_traits';
    const MIN_DWELL_MS = 500;

    // ─── Persistence: localStorage with cookie fallback (Safari ITP) ─────────
    function storageSet(key, value) {
        try { localStorage.setItem(key, value); } catch (_) {}
        try {
            const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toUTCString();
            document.cookie = `${key}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
        } catch (_) {}
    }

    function storageGet(key) {
        try { const v = localStorage.getItem(key); if (v) return v; } catch (_) {}
        try {
            const m = document.cookie.match(`(?:^|; )${key}=([^;]*)`);
            return m ? decodeURIComponent(m[1]) : null;
        } catch (_) {}
        return null;
    }

    function storageRemove(key) {
        try { localStorage.removeItem(key); } catch (_) {}
        try { document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`; } catch (_) {}
    }

    function getJson(key) {
        try {
            const raw = storageGet(key);
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    function setJson(key, value) {
        try { storageSet(key, JSON.stringify(value)); } catch (_) {}
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

    function getSessionId() {
        let id = null;
        try { id = sessionStorage.getItem(SESSION_ID_KEY); } catch (_) {}
        if (!id) {
            id = `s_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;
            try { sessionStorage.setItem(SESSION_ID_KEY, id); } catch (_) {}
        }
        return id;
    }

    // ─── Browser Fingerprinting ───────────────────────────────────────────────
    const cyrb53 = (str, seed = 0) => {
        let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
        for (let i = 0, ch; i < str.length; i++) {
            ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return 4294967296 * (2097151 & h2) + (h1 >>> 0);
    };

    function getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('Outmate fp', 2, 2);
            return canvas.toDataURL().slice(-50);
        } catch (_) { return null; }
    }

    function getWebGLFingerprint() {
        try {
            const gl = document.createElement('canvas').getContext('webgl');
            if (!gl) return null;
            const ext = gl.getExtension('WEBGL_debug_renderer_info');
            return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;
        } catch (_) { return null; }
    }

    let _fpHashCache = null;
    function getFingerprintHash() {
        if (_fpHashCache) return _fpHashCache;
        const signals = {
            canvas: getCanvasFingerprint(),
            webgl: getWebGLFingerprint(),
            dpr: globalThis.devicePixelRatio,
            screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            lang: navigator.language,
            ua: navigator.userAgent,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            plugins: navigator.plugins ? navigator.plugins.length : 0,
            hardwareConcurrency: navigator.hardwareConcurrency || 0,
            deviceMemory: navigator.deviceMemory || 0,
        };
        _fpHashCache = cyrb53(JSON.stringify(signals)).toString(16);
        return _fpHashCache;
    }

    // ─── Scroll Depth Tracking ────────────────────────────────────────────────
    let _maxScrollPct = 0;
    function updateScrollDepth() {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const docHeight = Math.max(
            document.body.scrollHeight, document.documentElement.scrollHeight,
            document.body.offsetHeight, document.documentElement.offsetHeight
        ) - window.innerHeight;
        if (docHeight > 0) {
            const pct = Math.round((scrollTop / docHeight) * 100);
            if (pct > _maxScrollPct) _maxScrollPct = Math.min(pct, 100);
        }
    }
    window.addEventListener('scroll', updateScrollDepth, { passive: true });

    // ─── CTA Click Tracking ───────────────────────────────────────────────────
    const CTA_PATTERNS = /pricing|demo|signup|sign.up|get.started|trial|contact|book|schedule|buy|upgrade|checkout/i;
    let _ctaClicks = 0;
    document.addEventListener('click', (e) => {
        const el = e.target?.closest?.('a, button, [role="button"]');
        if (!el) return;
        const text = (el.textContent || '').trim();
        const href = el.getAttribute('href') || '';
        if (CTA_PATTERNS.test(text) || CTA_PATTERNS.test(href)) _ctaClicks++;
        if (el.tagName === 'A' && href) {
            try {
                const target = new URL(href, globalThis.location.href);
                if (target.host && target.host !== globalThis.location.host) {
                    _outboundClicks++;
                    _lastOutboundDomain = target.host.replace(/^www\./, '');
                }
            } catch (_) {}
        }
    }, true);

    // ─── Page State ──────────────────────────────────────────────────────────
    let _lastTrackedUrl = null;
    let _pageEntryTime = Date.now();
    let _activeMs = 0;
    let _lastActivityAt = Date.now();
    let _outboundClicks = 0;
    let _lastOutboundDomain = null;

    function inferPageType(url) {
        try {
            const path = new URL(url, globalThis.location.origin).pathname.toLowerCase();
            if (/pricing|plans|quote|checkout/.test(path)) return 'pricing';
            if (/demo|book|schedule|contact-sales/.test(path)) return 'demo';
            if (/docs|api|developer|sdk|reference/.test(path)) return 'docs';
            if (/security|compliance|privacy|gdpr|soc2/.test(path)) return 'security';
            if (/integrations|integration|partners/.test(path)) return 'integrations';
            if (/blog|resources|webinar|case-studies|customers/.test(path)) return 'content';
            if (/careers|jobs|hiring/.test(path)) return 'careers';
            return 'general';
        } catch (_) {
            return 'general';
        }
    }

    function flushActivity(now) {
        const delta = Math.max(0, Math.min((now || Date.now()) - _lastActivityAt, 15000));
        _activeMs += delta;
        _lastActivityAt = now || Date.now();
    }

    function markActivity() {
        flushActivity(Date.now());
    }

    ['mousemove', 'scroll', 'keydown', 'click', 'touchstart'].forEach((evt) => {
        document.addEventListener(evt, markActivity, { passive: true, capture: true });
    });

    function getIdentityTraits() {
        const saved = getJson(IDENTITY_KEY) || {};
        if (saved.email && !storageGet(EMAIL_KEY)) storageSet(EMAIL_KEY, saved.email);
        return saved;
    }

    function mergeIdentityTraits(traits) {
        const current = getIdentityTraits();
        const next = Object.assign({}, current);
        Object.keys(traits || {}).forEach((key) => {
            const value = traits[key];
            if (value !== undefined && value !== null && String(value).trim() !== '') {
                next[key] = String(value).trim();
            }
        });
        if (next.email) storageSet(EMAIL_KEY, next.email);
        setJson(IDENTITY_KEY, next);
        return next;
    }

    function track(email, forcedUrl, action = 'pageview') {
        // Consent gate — re-checked on every call to catch mid-session revocation
        if (!_consentGranted || _isConsentDenied()) return;

        // Bot filter
        const isHuman = (
            typeof window !== 'undefined' &&
            navigator.webdriver !== true &&
            !window._phantom &&
            !window.callPhantom &&
            window.outerWidth > 0 &&
            window.outerHeight > 0
        );
        if (!isHuman) return;

        const url = forcedUrl ?? globalThis.location.href;
        if (!email && action === 'pageview' && url === _lastTrackedUrl) return;
        if (action === 'pageview') {
            _lastTrackedUrl = url;
            _maxScrollPct = 0;
            _ctaClicks = 0;
            _outboundClicks = 0;
            _lastOutboundDomain = null;
        }

        flushActivity(Date.now());
        const dwellMs = action === 'leave' ? (Date.now() - _pageEntryTime) : undefined;
        const identity = getIdentityTraits();

        // Page meta — richer than URL slug alone for persona classification
        const _pageTitle = (document.title || '').trim().slice(0, 120);
        const _h1El = document.querySelector('h1');
        const _pageH1 = _h1El ? (_h1El.textContent || '').trim().slice(0, 80) : '';
        const _conn = (navigator.connection || navigator.mozConnection || navigator.webkitConnection);

        const payload = JSON.stringify({
            action,
            url,
            referrer: document.referrer || '',
            pixel_key: PIXEL_KEY,
            email: email ?? storageGet(EMAIL_KEY) ?? identity.email,
            visitor_id: getVisitorId(),
            session_id: getSessionId(),
            fp: getFingerprintHash(),
            viewport_w: window.innerWidth,
            viewport_h: window.innerHeight,
            dwell_time: dwellMs,
            active_ms: _activeMs,
            scroll_depth: _maxScrollPct,
            cta_clicks: _ctaClicks,
            outbound_clicks: _outboundClicks,
            last_outbound_domain: _lastOutboundDomain || undefined,
            page_title: _pageTitle || undefined,
            page_h1: _pageH1 || undefined,
            connection_type: _conn ? (_conn.effectiveType || _conn.type || undefined) : undefined,
            page_type: inferPageType(url),
            identity_traits: identity,
        });

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
    function patchHistoryMethod(method) {
        const original = history[method];
        history[method] = function (...args) {
            const prevUrl = globalThis.location.href;
            const result = original.apply(this, args);
            const newUrl = globalThis.location.href;
            if (newUrl !== prevUrl) {
                const dwell = Date.now() - _pageEntryTime;
                if (dwell >= MIN_DWELL_MS) track(null, prevUrl, 'leave');
                _pageEntryTime = Date.now();
                setTimeout(() => track(null, newUrl, 'pageview'), 100);
            }
            return result;
        };
    }

    if (typeof history !== 'undefined') {
        patchHistoryMethod('pushState');
        patchHistoryMethod('replaceState');
        globalThis.addEventListener('popstate', () => {
            const dwell = Date.now() - _pageEntryTime;
            if (dwell >= MIN_DWELL_MS) track(null, _lastTrackedUrl || globalThis.location.href, 'leave');
            _pageEntryTime = Date.now();
            setTimeout(() => track(null, globalThis.location.href, 'pageview'), 100);
        });
        globalThis.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                const dwell = Date.now() - _pageEntryTime;
                if (dwell >= MIN_DWELL_MS) track(null, globalThis.location.href, 'leave');
            } else {
                _pageEntryTime = Date.now();
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
        for (const input of form.querySelectorAll('input[type="text"], input:not([type])')) {
            const v = input.value?.trim();
            if (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v;
        }
        return null;
    }

    function findFieldValue(form, selectors) {
        for (const selector of selectors) {
            const input = form.querySelector(selector);
            const val = input?.value?.trim();
            if (val) return val;
        }
        return null;
    }

    function extractIdentityFromForm(form) {
        const email = findEmailInForm(form);
        const fullName = findFieldValue(form, [
            'input[name*="full" i][name*="name" i]',
            'input[id*="full" i][id*="name" i]',
            'input[placeholder*="full name" i]',
        ]);
        const firstName = findFieldValue(form, [
            'input[name*="first" i][name*="name" i]',
            'input[id*="first" i][id*="name" i]',
            'input[placeholder*="first name" i]',
        ]);
        const lastName = findFieldValue(form, [
            'input[name*="last" i][name*="name" i]',
            'input[id*="last" i][id*="name" i]',
            'input[placeholder*="last name" i]',
        ]);
        const companyName = findFieldValue(form, [
            'input[name*="company" i]',
            'input[id*="company" i]',
            'input[placeholder*="company" i]',
        ]);
        const jobTitle = findFieldValue(form, [
            'input[name*="title" i]',
            'input[name*="role" i]',
            'input[id*="title" i]',
            'input[id*="role" i]',
            'input[placeholder*="title" i]',
            'input[placeholder*="role" i]',
        ]);
        const linkedinUrl = findFieldValue(form, [
            'input[name*="linkedin" i]',
            'input[id*="linkedin" i]',
            'input[placeholder*="linkedin" i]',
        ]);
        return {
            email: email || undefined,
            full_name: fullName || undefined,
            first_name: firstName || undefined,
            last_name: lastName || undefined,
            company_name: companyName || undefined,
            job_title: jobTitle || undefined,
            linkedin_url: linkedinUrl || undefined,
        };
    }

    function handleFormEmail(form) {
        const traits = extractIdentityFromForm(form);
        const merged = mergeIdentityTraits(traits);
        track(merged.email || null);
    }

    document.addEventListener('submit', (e) => {
        if (e.target?.tagName === 'FORM') handleFormEmail(e.target);
    }, true);

    document.addEventListener('click', (e) => {
        const btn = e.target?.closest?.('button[type="submit"], input[type="submit"]');
        const form = btn?.closest?.('form');
        if (form) handleFormEmail(form);
    }, true);

    // ─── Public API ───────────────────────────────────────────────────────────
    globalThis.outmate = {
        identify(email) {
            if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                mergeIdentityTraits({ email });
                track(email);
            }
        },
        identifyUser(traits) {
            if (traits && typeof traits === 'object') {
                const merged = mergeIdentityTraits(traits);
                track(merged.email || null);
            }
        },
        reset() {
            storageRemove(EMAIL_KEY);
            storageRemove(VISITOR_ID_KEY);
            storageRemove(IDENTITY_KEY);
            try { sessionStorage.removeItem(SESSION_ID_KEY); } catch (_) {}
            _lastTrackedUrl = null;
        },
        trackPage() {
            _lastTrackedUrl = null;
            track(null);
        },
        optOut() {
            storageSet(OPT_OUT_KEY, '1');
            storageRemove(EMAIL_KEY);
            storageRemove(VISITOR_ID_KEY);
            storageRemove(IDENTITY_KEY);
            _consentGranted = false;
        },
        optIn() {
            storageRemove(OPT_OUT_KEY);
            // Re-evaluate — only grant if no other framework is denying
            _consentGranted = !_isConsentDenied() && (typeof window.__tcfapi !== 'function');
        },
    };

    // ─── Initial page load ────────────────────────────────────────────────────
    function _doInitialTrack() {
        _pageEntryTime = Date.now();
        setTimeout(() => track(null), MIN_DWELL_MS);
    }

    function initialTrack() {
        if (!_consentGranted) {
            // CMP banner not yet dismissed — defer tracking until consent fires
            _pendingInitialTrack = true;
            return;
        }
        _doInitialTrack();
    }

    if (document.readyState === 'complete') {
        initialTrack();
    } else {
        globalThis.addEventListener('load', initialTrack);
    }
})();
