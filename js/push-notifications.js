// ResIQ — Web Push subscription client
//
// Handles:
//   - Checking current permission / subscription state
//   - Asking the server for the VAPID public key
//   - Subscribing via the browser's PushManager
//   - Saving the subscription to Supabase via /api/send-push
//   - Unsubscribing cleanly
//
// Exposes:
//   - window.pushNotifications.isSupported()
//   - window.pushNotifications.getStatus()            → "unsupported" | "blocked" | "default" | "subscribed"
//   - window.pushNotifications.enable()                → request permission + subscribe
//   - window.pushNotifications.disable()               → unsubscribe
//   - window.pushNotifications.updateButtonUI(btn)     → reflect current state on a button element

(function () {
    const ENABLED_KEY = 'resiq_push_enabled';

    function isSupported() {
        return (
            'serviceWorker' in navigator &&
            'PushManager' in window &&
            'Notification' in window
        );
    }

    async function getRegistration() {
        if (!('serviceWorker' in navigator)) return null;
        return navigator.serviceWorker.getRegistration() || null;
    }

    async function getStatus() {
        if (!isSupported()) return 'unsupported';
        if (Notification.permission === 'denied') return 'blocked';
        const reg = await getRegistration();
        if (!reg) return 'default';
        const sub = await reg.pushManager.getSubscription();
        if (sub) return 'subscribed';
        return Notification.permission === 'granted' ? 'granted-not-subscribed' : 'default';
    }

    // Convert a base64-url VAPID key into a Uint8Array (required by pushManager)
    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(base64);
        const out = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
        return out;
    }

    async function getFirebaseIdToken() {
        const u = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
        if (!u) throw new Error('Not signed in');
        return u.getIdToken();
    }

    async function fetchVapidKey() {
        const resp = await fetch('/api/send-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'vapid-public-key' })
        });
        const data = await resp.json();
        if (!resp.ok || !data.publicKey) {
            throw new Error(data.error || 'Could not fetch VAPID key');
        }
        return data.publicKey;
    }

    async function enable() {
        if (!isSupported()) {
            throw new Error('Push notifications are not supported in this browser');
        }
        if (Notification.permission === 'denied') {
            throw new Error('Notifications are blocked. Enable them in your browser settings.');
        }

        // 1. Ask permission (no-op if already granted)
        const permission = Notification.permission === 'granted'
            ? 'granted'
            : await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error('Permission not granted');
        }

        // 2. Get SW registration + VAPID key
        const reg = await navigator.serviceWorker.ready;
        const publicKey = await fetchVapidKey();

        // 3. Subscribe (or reuse existing subscription)
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
            sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });
        }

        // 4. Send subscription to server
        const token = await getFirebaseIdToken();
        const resp = await fetch('/api/send-push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action: 'subscribe',
                subscription: sub.toJSON(),
                userAgent: navigator.userAgent
            })
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || `Server rejected subscription (${resp.status})`);
        }
        try { localStorage.setItem(ENABLED_KEY, '1'); } catch (_) {}
        return true;
    }

    async function disable() {
        const reg = await getRegistration();
        if (!reg) return true;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) {
            try { localStorage.removeItem(ENABLED_KEY); } catch (_) {}
            return true;
        }

        const endpoint = sub.endpoint;
        try { await sub.unsubscribe(); } catch (e) { console.warn('Local unsubscribe failed:', e); }

        try {
            const token = await getFirebaseIdToken();
            await fetch('/api/send-push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action: 'unsubscribe', endpoint })
            });
        } catch (e) {
            // Server may have already pruned it — ignore.
            console.warn('Server unsubscribe failed:', e?.message);
        }
        try { localStorage.removeItem(ENABLED_KEY); } catch (_) {}
        return true;
    }

    async function updateButtonUI(btn) {
        if (!btn) return;
        const status = await getStatus();
        const map = {
            unsupported:              { text: 'Notifications Unsupported', disabled: true, icon: 'bell-off' },
            blocked:                  { text: 'Notifications Blocked',     disabled: true, icon: 'bell-off' },
            default:                  { text: 'Enable Notifications',      disabled: false, icon: 'bell' },
            'granted-not-subscribed': { text: 'Enable Notifications',      disabled: false, icon: 'bell' },
            subscribed:               { text: 'Notifications On — Disable', disabled: false, icon: 'bell-ring' }
        };
        const cfg = map[status] || map.default;
        btn.disabled = !!cfg.disabled;
        btn.dataset.pushStatus = status;
        btn.innerHTML = `<i data-lucide="${cfg.icon}" style="width:14px;height:14px;"></i> ${cfg.text}`;
        if (window.lucide) window.lucide.createIcons();
    }

    window.pushNotifications = { isSupported, getStatus, enable, disable, updateButtonUI };
})();
