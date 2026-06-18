// shared/js/socket.js
(function() {
    let ws;
    function connectWS() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}`);
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "mlbb_live_data") {
                    // Dispatch custom event to the window so elements can listen for it
                    window.dispatchEvent(new CustomEvent('mlbb_live_data', { detail: data.payload }));
                }
            } catch (e) {
                console.error("WS Error:", e);
            }
        };

        ws.onopen = () => console.log("Connected to MLBB Data Stream");
        ws.onclose = () => {
            console.log("Disconnected, retrying in 3s...");
            setTimeout(connectWS, 3000);
        };
    }
    connectWS();

    // Utility function for font sizing
    window.adjustFontSize = function(el) {
        if (!el) return;
        if (!el.dataset.baseFontSize) el.dataset.baseFontSize = window.getComputedStyle(el).fontSize;
        let baseSize = parseFloat(el.dataset.baseFontSize);
        let currentSize = baseSize;
        el.style.fontSize = baseSize + 'px';
        while (el.scrollWidth > el.offsetWidth && currentSize > 6) {
            currentSize -= 0.5;
            el.style.fontSize = currentSize + 'px';
        }
    };
})();
