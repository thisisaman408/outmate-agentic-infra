(function () {
    // Visitor Tracking Pixel for Outmate.ai
    const PIXEL_KEY = document.currentScript.getAttribute('data-pixel-key');
    if (!PIXEL_KEY) {
        console.warn('Outmate Pixel: Missing data-pixel-key');
        return;
    }

    const TRACK_URL = 'http://127.0.0.1:8000/api/visitors/track'; // Update for production

    function track() {
        // Collect basic data
        const data = new FormData();
        data.append('url', window.location.href);
        data.append('referrer', document.referrer || '');

        // Use fetch with keepalive to ensure tracking completes on page unload if needed
        // but since we track on load, fetch is fine.
        console.log('Outmate Pixel: Tracking visit...', { url: window.location.href, key: PIXEL_KEY });
        fetch(TRACK_URL, {
            method: 'POST',
            body: data,
            headers: {
                'X-Pixel-Key': PIXEL_KEY
            },
            mode: 'cors',
            keepalive: true
        }).then(res => {
            console.log('Outmate Pixel: Track response status:', res.status);
            return res.json();
        }).then(resData => {
            console.log('Outmate Pixel: Track response data:', resData);
        }).catch(err => {
            console.error('Outmate Pixel Error:', err);
        });
    }

    // Debounce or delay tracking to avoid blocking main thread
    if (document.readyState === 'complete') {
        setTimeout(track, 1000);
    } else {
        window.addEventListener('load', () => setTimeout(track, 1000));
    }
})();
