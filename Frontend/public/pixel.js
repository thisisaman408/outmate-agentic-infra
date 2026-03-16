(function () {
    // Visitor Tracking Pixel for Outmate.ai
    const scriptTag = document.currentScript;
    const PIXEL_KEY = scriptTag ? scriptTag.getAttribute('data-pixel-key') : null;
    if (!PIXEL_KEY) {
        console.warn('Outmate Pixel: Missing data-pixel-key');
        return;
    }

    // Auto-detect backend URL from the script's own src so the pixel works
    // in any environment without hardcoding a host.
    let TRACK_URL = 'http://127.0.0.1:8000/api/v1/visitors/track';
    if (scriptTag && scriptTag.src) {
        try {
            const u = new URL(scriptTag.src);
            TRACK_URL = u.protocol + '//' + u.host + '/api/v1/visitors/track';
        } catch (e) { /* fallback to default */ }
    }

    function track() {
        // Collect identity if previously set via outmate.identify()
        const savedEmail = localStorage.getItem('outmate_visitor_email');
        
        const payload = {
            url: window.location.href,
            referrer: document.referrer || '',
            pixel_key: PIXEL_KEY,
            email: savedEmail || null
        };

        console.log('Outmate Pixel: Tracking visit...', payload);

        // Standard fetch with JSON body. 
        // We use application/json specifically because it's the most robust format for modern APIs.
        fetch(TRACK_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            mode: 'cors',
            keepalive: true,
            headers: {
                'Content-Type': 'application/json'
            }
        }).then(res => {
            console.log('Outmate Pixel: Track response status:', res.status);
            return res.json();
        }).then(resData => {
            console.log('Outmate Pixel: Track response data:', resData);
        }).catch(err => {
            console.error('Outmate Pixel Error:', err);
        });
    }

    // Expose identify method to the global window object
    window.outmate = {
        identify: function(email) {
            if (email && /^\S+@\S+\.\S+$/.test(email)) {
                localStorage.setItem('outmate_visitor_email', email);
                console.log('Outmate Pixel: Identified as', email);
                // Trigger an immediate re-track with identity
                track();
            }
        },
        reset: function() {
            localStorage.removeItem('outmate_visitor_email');
            console.log('Outmate Pixel: Identity reset');
        }
    };

    // Debounce or delay tracking to avoid blocking main thread
    if (document.readyState === 'complete') {
        setTimeout(track, 1000);
    } else {
        window.addEventListener('load', () => setTimeout(track, 1000));
    }
})();
