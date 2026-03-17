(function () {
    // Visitor Tracking Pixel for Outmate.ai
    var scriptTag = document.currentScript;
    var PIXEL_KEY = scriptTag ? scriptTag.getAttribute('data-pixel-key') : null;
    if (!PIXEL_KEY) {
        console.warn('Outmate Pixel: Missing data-pixel-key');
        return;
    }

    // Auto-detect backend URL from the script's own src
    var TRACK_URL = 'https://dev.outmate.ai/api/v1/visitors/track';
    if (scriptTag && scriptTag.src) {
        try {
            var u = new URL(scriptTag.src);
            TRACK_URL = u.protocol + '//' + u.host + '/api/v1/visitors/track';
        } catch (e) { /* fallback */ }
    }

    var EMAIL_KEY = 'outmate_visitor_email';
    var VISITOR_ID_KEY = 'outmate_visitor_id';

    // Generate or retrieve a persistent visitor ID (cookie-like tracking)
    function getVisitorId() {
        var id = localStorage.getItem(VISITOR_ID_KEY);
        if (!id) {
            id = 'v_' + Math.random().toString(36).substr(2, 12) + Date.now().toString(36);
            localStorage.setItem(VISITOR_ID_KEY, id);
        }
        return id;
    }

    function getSavedEmail() {
        return localStorage.getItem(EMAIL_KEY) || null;
    }

    function track(email) {
        var payload = {
            url: window.location.href,
            referrer: document.referrer || '',
            pixel_key: PIXEL_KEY,
            email: email || getSavedEmail() || null,
            visitor_id: getVisitorId()
        };

        fetch(TRACK_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            mode: 'cors',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' }
        }).catch(function () {});
    }

    // ─── Auto-capture emails from form submissions ───
    function findEmailInForm(form) {
        var inputs = form.querySelectorAll('input[type="email"], input[name*="email"], input[name*="Email"], input[id*="email"], input[id*="Email"], input[placeholder*="email" i]');
        for (var i = 0; i < inputs.length; i++) {
            var val = (inputs[i].value || '').trim();
            if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                return val;
            }
        }
        // Fallback: scan all text/email inputs for anything that looks like an email
        var allInputs = form.querySelectorAll('input[type="text"], input[type="email"], input:not([type])');
        for (var j = 0; j < allInputs.length; j++) {
            var v = (allInputs[j].value || '').trim();
            if (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
                return v;
            }
        }
        return null;
    }

    // Listen for all form submissions on the page
    document.addEventListener('submit', function (e) {
        var form = e.target;
        if (!form || form.tagName !== 'FORM') return;
        var email = findEmailInForm(form);
        if (email) {
            localStorage.setItem(EMAIL_KEY, email);
            // Re-track immediately with the captured email
            track(email);
        }
    }, true);

    // Also listen for common button clicks that submit forms via JS (SPA frameworks)
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('button[type="submit"], input[type="submit"]');
        if (!btn) return;
        var form = btn.closest('form');
        if (!form) return;
        var email = findEmailInForm(form);
        if (email) {
            localStorage.setItem(EMAIL_KEY, email);
            track(email);
        }
    }, true);

    // ─── Public API ───
    window.outmate = {
        identify: function (email) {
            if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                localStorage.setItem(EMAIL_KEY, email);
                track(email);
            }
        },
        reset: function () {
            localStorage.removeItem(EMAIL_KEY);
            localStorage.removeItem(VISITOR_ID_KEY);
        }
    };

    // Track on page load
    if (document.readyState === 'complete') {
        setTimeout(track, 800);
    } else {
        window.addEventListener('load', function () { setTimeout(track, 800); });
    }
})();
