// ResIQ Money — Currency helpers that avoid float drift.
//
// Historically reservation amounts in this codebase have been stored as
// JavaScript floats (parseFloat). That accumulates rounding errors after
// many operations (e.g. ₹99.99 + ₹0.01 tax becoming 100.00999999).
//
// Going forward, *new* code should:
//   1. Parse user input via `parseRupeesToPaise()` — returns an integer
//      number of paise.
//   2. Do math in paise (always integers).
//   3. Convert back at display time via `paiseToDisplay()`.
//
// Legacy float-based fields stay where they are until the data layer
// migrates. The helpers below also accept raw rupee numbers so callers
// can adopt them incrementally.

(function (root) {
    // Parse a user-entered rupee value ("1,250.50", "1250", "₹1,250.5") into
    // an integer count of paise. Returns 0 on invalid input.
    function parseRupeesToPaise(input) {
        if (input == null || input === '') return 0;
        if (typeof input === 'number') {
            if (!isFinite(input)) return 0;
            return Math.round(input * 100);
        }
        const cleaned = String(input).replace(/[^\d.-]/g, '');
        if (!cleaned || cleaned === '-' || cleaned === '.') return 0;
        const n = Number(cleaned);
        if (!isFinite(n)) return 0;
        return Math.round(n * 100);
    }

    // Convert paise back to a rupee number (may have decimals).
    function paiseToRupees(paise) {
        const n = Number(paise) || 0;
        return n / 100;
    }

    // Indian-format display string, e.g. 12500050 -> "₹1,25,000.50".
    // Drops trailing ".00" so whole rupees render cleanly.
    function paiseToDisplay(paise, opts = {}) {
        const showSymbol = opts.symbol !== false;
        const rupees = paiseToRupees(paise);
        const isWhole = Math.round(rupees) === rupees;
        const formatted = rupees.toLocaleString('en-IN', {
            minimumFractionDigits: isWhole ? 0 : 2,
            maximumFractionDigits: 2
        });
        return showSymbol ? '₹' + formatted : formatted;
    }

    // Short Indian format: ₹12.5L, ₹1.05Cr, ₹45K. Useful for dashboards.
    function paiseToShortDisplay(paise) {
        const rupees = paiseToRupees(paise);
        if (rupees >= 10000000) return '₹' + (rupees / 10000000).toFixed(2) + 'Cr';
        if (rupees >= 100000) return '₹' + (rupees / 100000).toFixed(1) + 'L';
        if (rupees >= 1000) return '₹' + (rupees / 1000).toFixed(1) + 'K';
        return '₹' + Math.round(rupees);
    }

    // Bridge for legacy callers that already have a rupee float in hand:
    // round it through paise to drop drift before display.
    function formatRupeesSafe(rupees, opts = {}) {
        return paiseToDisplay(parseRupeesToPaise(rupees), opts);
    }

    // Sum a list of mixed-format amounts (paise ints OR rupee floats with a
    // `_unit` hint). Returns paise.
    function sumPaise(amounts) {
        let total = 0;
        for (const a of amounts) {
            if (a == null) continue;
            total += parseRupeesToPaise(a);
        }
        return total;
    }

    const Money = {
        parseRupeesToPaise,
        paiseToRupees,
        paiseToDisplay,
        paiseToShortDisplay,
        formatRupeesSafe,
        sumPaise
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Money;
    } else {
        root.Money = Money;
    }
})(typeof window !== 'undefined' ? window : globalThis);
