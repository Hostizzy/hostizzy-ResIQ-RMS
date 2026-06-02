// ResIQ Settings Store — durable, per-owner key-value persistence.
//
// Previously every setting lived only in localStorage, so a cache clear
// or a new device wiped business name, currency, notification toggles,
// email signature, WhatsApp config, etc. This module mirrors those
// values to the `business_settings` Supabase table while keeping
// localStorage as the synchronous cache for instant page-load reads.
//
// API:
//   await SettingsStore.set(key, value)   // writes to LS immediately,
//                                         // server in background
//   await SettingsStore.get(key, fallback)// returns LS or server value
//   await SettingsStore.hydrate(keys?)    // pull server → LS at login
//
// Values are stored as JSON so booleans, numbers, and objects all work.

(function (root) {
    const NS = 'bs:'; // localStorage namespace prefix

    function _currentOwnerId() {
        try {
            const u = JSON.parse(localStorage.getItem('currentUser') || 'null');
            if (!u) return null;
            // Owners use their own id; team members inherit from owner_id.
            return u.userType === 'owner' ? u.id : (u.owner_id || null);
        } catch (_) {
            return null;
        }
    }

    function _lsKey(key) {
        return NS + key;
    }

    function _readLs(key) {
        const raw = localStorage.getItem(_lsKey(key));
        if (raw == null) {
            // Fall back to legacy (unprefixed) value for backward compat.
            const legacy = localStorage.getItem(key);
            return legacy == null ? null : legacy;
        }
        try { return JSON.parse(raw); } catch (_) { return raw; }
    }

    function _writeLs(key, value) {
        try {
            localStorage.setItem(_lsKey(key), JSON.stringify(value));
        } catch (e) {
            console.warn('[SettingsStore] LS write failed for', key, e);
        }
    }

    async function set(key, value) {
        return setMany({ [key]: value });
    }

    // Write multiple key/value pairs in one Supabase upsert. Saves N-1
    // network round-trips when a form persists a batch of related fields.
    async function setMany(entries) {
        const pairs = Object.entries(entries);
        if (pairs.length === 0) return entries;

        for (const [k, v] of pairs) _writeLs(k, v);

        const ownerId = _currentOwnerId();
        if (!ownerId || typeof supabase === 'undefined') return entries;

        const now = new Date().toISOString();
        const rows = pairs.map(([key, value]) => ({
            owner_id: ownerId, key, value, updated_at: now
        }));

        // Fire-and-forget — don't block the UI.
        supabase
            .from('business_settings')
            .upsert(rows, { onConflict: 'owner_id,key' })
            .then(({ error }) => {
                if (error) console.warn('[SettingsStore] upsert failed:', error.message);
            });

        return entries;
    }

    async function get(key, fallback = null) {
        const cached = _readLs(key);
        if (cached !== null) return cached;
        return fallback;
    }

    async function hydrate(keys = null) {
        const ownerId = _currentOwnerId();
        if (!ownerId || typeof supabase === 'undefined') return;

        try {
            let q = supabase.from('business_settings').select('key,value').eq('owner_id', ownerId);
            if (Array.isArray(keys) && keys.length > 0) q = q.in('key', keys);
            const { data, error } = await q;
            if (error) {
                console.warn('[SettingsStore] hydrate failed:', error.message);
                return;
            }
            for (const row of (data || [])) {
                _writeLs(row.key, row.value);
            }
        } catch (e) {
            console.warn('[SettingsStore] hydrate threw:', e.message);
        }
    }

    root.SettingsStore = { set, setMany, get, hydrate };
})(typeof window !== 'undefined' ? window : globalThis);
