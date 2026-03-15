// ResIQ — Client-side protection measures
// Lightweight deterrents for casual copying. Right-click and DevTools remain
// available so that users (and admins debugging issues) are not blocked.

(function () {
    'use strict';

    // ── 1. Disable text selection on sensitive UI areas ────────────
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

    // ── 2. Disable drag on images ─────────────────────────────────
    document.addEventListener('dragstart', function (e) {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
        }
    });
})();
