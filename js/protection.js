// ResIQ — Client-side protection measures
// Disables casual copying, right-click source inspection, and DevTools snooping.
// NOTE: This is a deterrent, not DRM. Determined attackers can bypass it.

(function () {
    'use strict';

    // ── 1. Disable right-click context menu on the app ─────────────
    document.addEventListener('contextmenu', function (e) {
        // Allow right-click on input/textarea for paste functionality
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
    });

    // ── 2. Block common keyboard shortcuts for view-source / copy ──
    document.addEventListener('keydown', function (e) {
        // Ctrl+U (view source)
        if (e.ctrlKey && e.key === 'u') { e.preventDefault(); return; }
        // Ctrl+S (save page)
        if (e.ctrlKey && e.key === 's') { e.preventDefault(); return; }
        // Ctrl+Shift+I (DevTools)
        if (e.ctrlKey && e.shiftKey && e.key === 'I') { e.preventDefault(); return; }
        // Ctrl+Shift+J (Console)
        if (e.ctrlKey && e.shiftKey && e.key === 'J') { e.preventDefault(); return; }
        // Ctrl+Shift+C (Inspect element)
        if (e.ctrlKey && e.shiftKey && e.key === 'C') { e.preventDefault(); return; }
        // F12 (DevTools)
        if (e.key === 'F12') { e.preventDefault(); return; }
    });

    // ── 3. Disable text selection on sensitive UI areas ────────────
    // Only blocks selection on navigation, sidebar, and header — not on
    // content areas, inputs, or tables (users still need to copy data).
    var style = document.createElement('style');
    style.textContent = [
        '.sidebar, .nav-link, .mobile-header, .bottom-tabs, .splash-screen {',
        '  -webkit-user-select: none;',
        '  -moz-user-select: none;',
        '  -ms-user-select: none;',
        '  user-select: none;',
        '}'
    ].join('\n');
    document.head.appendChild(style);

    // ── 4. DevTools open detection ────────────────────────────────
    // Uses the debugger-timing trick: when DevTools is open, a debugger
    // statement takes measurably longer to execute.
    var devtoolsWarned = false;

    function detectDevTools() {
        var threshold = 100;
        var start = performance.now();
        // The debugger statement pauses execution when DevTools is open
        // eslint-disable-next-line no-debugger
        debugger;
        var end = performance.now();
        if (end - start > threshold && !devtoolsWarned) {
            devtoolsWarned = true;
            document.body.innerHTML = '';
            document.body.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100vh;background:#0f172a;color:#e2e8f0;font-family:system-ui;';
            document.body.innerHTML = '<div style="text-align:center;"><h1 style="font-size:2rem;margin-bottom:1rem;">Access Restricted</h1><p style="color:#94a3b8;">Developer tools are not permitted on this application.</p><p style="color:#94a3b8;margin-top:0.5rem;">Please close DevTools and refresh the page.</p></div>';
        }
    }

    // Only run detection in production (not localhost)
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setInterval(detectDevTools, 3000);
    }

    // ── 5. Disable drag on images ─────────────────────────────────
    document.addEventListener('dragstart', function (e) {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
        }
    });
})();
