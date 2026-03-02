/**
 * Supabase Proxy Client
 *
 * Drop-in replacement for @supabase/supabase-js that routes all
 * database and storage calls through /api/db-proxy and /api/storage-proxy
 * on the same Vercel domain, avoiding ISP blocking of supabase.co.
 *
 * Usage:
 *   const supabase = createSupabaseProxy();
 *   // Then use exactly like the real Supabase client:
 *   const { data, error } = await supabase.from('table').select('*').eq('col', val);
 */

function createSupabaseProxy(baseUrl) {
    const DB_PROXY = (baseUrl || '') + '/api/db-proxy';
    const STORAGE_PROXY = (baseUrl || '') + '/api/storage-proxy';

    async function executeQuery(descriptor) {
        const res = await fetch(DB_PROXY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(descriptor)
        });
        return res.json();
    }

    // ── Query Builder (mirrors Supabase's chainable API) ──────────

    class QueryBuilder {
        constructor(table) {
            this._table = table;
            this._operation = null;
            this._select = '*';
            this._data = null;
            this._filters = [];
            this._order = [];
            this._single = false;
            this._maybeSingle = false;
            this._limit = null;
            this._count = null;
            this._returning = false;
        }

        select(columns, options) {
            if (this._operation) {
                // Called after insert/update/upsert/delete — means "return the data"
                this._returning = true;
            } else {
                this._operation = 'select';
            }
            this._select = columns || '*';
            if (options && options.count) this._count = options.count;
            return this;
        }

        insert(data) {
            this._operation = 'insert';
            this._data = data;
            return this;
        }

        update(data) {
            this._operation = 'update';
            this._data = data;
            return this;
        }

        delete() {
            this._operation = 'delete';
            return this;
        }

        upsert(data, options) {
            this._operation = 'upsert';
            this._data = data;
            return this;
        }

        // ── Filters ──────────────────────────────────────────────

        eq(column, value)      { this._filters.push({ method: 'eq',  args: [column, value] }); return this; }
        neq(column, value)     { this._filters.push({ method: 'neq', args: [column, value] }); return this; }
        gt(column, value)      { this._filters.push({ method: 'gt',  args: [column, value] }); return this; }
        gte(column, value)     { this._filters.push({ method: 'gte', args: [column, value] }); return this; }
        lt(column, value)      { this._filters.push({ method: 'lt',  args: [column, value] }); return this; }
        lte(column, value)     { this._filters.push({ method: 'lte', args: [column, value] }); return this; }
        like(column, pattern)  { this._filters.push({ method: 'like',  args: [column, pattern] }); return this; }
        ilike(column, pattern) { this._filters.push({ method: 'ilike', args: [column, pattern] }); return this; }
        is(column, value)      { this._filters.push({ method: 'is',  args: [column, value] }); return this; }
        in(column, values)     { this._filters.push({ method: 'in',  args: [column, values] }); return this; }
        or(conditions)         { this._filters.push({ method: 'or',  args: [conditions] }); return this; }
        not(column, op, value) { this._filters.push({ method: 'not', args: [column, op, value] }); return this; }
        contains(column, value){ this._filters.push({ method: 'contains', args: [column, value] }); return this; }

        // ── Modifiers ────────────────────────────────────────────

        order(column, options) {
            this._order.push({ column, options });
            return this;
        }

        limit(count) {
            this._limit = count;
            return this;
        }

        single() {
            this._single = true;
            return this;
        }

        maybeSingle() {
            this._maybeSingle = true;
            return this;
        }

        // ── Thenable (makes the builder awaitable) ───────────────

        then(resolve, reject) {
            const descriptor = {
                table: this._table,
                operation: this._operation,
                select: this._select,
                data: this._data,
                filters: this._filters,
                order: this._order,
                single: this._single,
                maybeSingle: this._maybeSingle,
                limit: this._limit,
                count: this._count,
                returning: this._returning
            };
            return executeQuery(descriptor).then(resolve, reject);
        }
    }

    // ── Storage Proxy ─────────────────────────────────────────────

    class StorageBucket {
        constructor(bucket) {
            this._bucket = bucket;
        }

        async upload(path, file, options) {
            // Convert File/Blob to base64
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const res = await fetch(STORAGE_PROXY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'upload',
                    bucket: this._bucket,
                    path,
                    fileBase64: base64,
                    contentType: file.type || 'application/octet-stream',
                    upsert: (options && options.upsert) || false
                })
            });
            return res.json();
        }

        async createSignedUrl(path, expiresIn) {
            const res = await fetch(STORAGE_PROXY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'signed-url',
                    bucket: this._bucket,
                    path,
                    expiresIn: expiresIn || 3600
                })
            });
            return res.json();
        }
    }

    // ── Realtime Polling Fallback ─────────────────────────────────
    // Supabase Realtime (WebSocket) can't be proxied through serverless.
    // This provides a polling fallback for the guest portal's
    // document verification status subscription.

    class PollingChannel {
        constructor(name) {
            this._name = name;
            this._handlers = [];
            this._interval = null;
            this._lastData = null;
        }

        on(type, config, callback) {
            this._handlers.push({ type, config, callback });
            return this;
        }

        subscribe(statusCallback) {
            if (this._handlers.length === 0) {
                if (statusCallback) statusCallback('CHANNEL_ERROR');
                return this;
            }

            const handler = this._handlers[0];
            const table = handler.config.table;
            const filter = handler.config.filter;

            // Parse filter like "booking_id=eq.ABC123"
            let filterMethod = null, filterColumn = null, filterValue = null;
            if (filter) {
                const match = filter.match(/^(\w+)=eq\.(.+)$/);
                if (match) {
                    filterColumn = match[1];
                    filterMethod = 'eq';
                    filterValue = match[2];
                }
            }

            // Poll every 5 seconds
            const poll = async () => {
                try {
                    const descriptor = {
                        table,
                        operation: 'select',
                        select: '*',
                        filters: filterColumn ? [{ method: filterMethod, args: [filterColumn, filterValue] }] : [],
                        order: [],
                        single: false,
                        maybeSingle: false,
                        limit: null,
                        count: null,
                        returning: false
                    };
                    const { data } = await executeQuery(descriptor);

                    if (!data || !this._lastData) {
                        this._lastData = data;
                        return;
                    }

                    // Compare each row to detect changes
                    for (const row of data) {
                        const prev = this._lastData.find(r => r.id === row.id);
                        if (prev) {
                            const changed = JSON.stringify(prev) !== JSON.stringify(row);
                            if (changed && handler.config.event === 'UPDATE') {
                                handler.callback({
                                    eventType: 'UPDATE',
                                    new: row,
                                    old: prev
                                });
                            }
                        }
                    }
                    this._lastData = data;
                } catch (e) {
                    console.warn('[Proxy Realtime] Poll error:', e.message);
                }
            };

            // Initial fetch, then poll
            poll();
            this._interval = setInterval(poll, 5000);

            if (statusCallback) statusCallback('SUBSCRIBED');
            return this;
        }

        unsubscribe() {
            if (this._interval) {
                clearInterval(this._interval);
                this._interval = null;
            }
            return this;
        }
    }

    // ── Public API (matches Supabase client interface) ────────────

    return {
        from(table) {
            return new QueryBuilder(table);
        },

        storage: {
            from(bucket) {
                return new StorageBucket(bucket);
            }
        },

        channel(name) {
            return new PollingChannel(name);
        },

        removeChannel(channel) {
            if (channel && channel.unsubscribe) channel.unsubscribe();
        }
    };
}
