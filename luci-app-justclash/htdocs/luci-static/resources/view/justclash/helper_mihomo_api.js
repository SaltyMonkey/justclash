"use strict";
"require baseclass";
"require view.justclash.helper_common as common";

return baseclass.extend({
    port: 9090,
    fetchTimeout: 5000,

    // API paths
    paths: {
        version: "/version",
        configs: "/configs",
        logs: "/logs",
        traffic: "/traffic",
        memory: "/memory",
        proxies: "/proxies",
        proxy: (name) => `/proxies/${encodeURIComponent(name)}`,
        proxyDelay: (name) => `/proxies/${encodeURIComponent(name)}/delay`,
        proxyProviders: "/providers/proxies",
        connections: "/connections",
        connection: (id) => `/connections/${encodeURIComponent(id)}`,
        ruleProviders: "/providers/rules",
        rulesetProvider: (providerName) => `/providers/rules/${encodeURIComponent(providerName)}`
    },

    // URL builders
    buildUrl(path, protocol, searchParams = null) {
        const url = new URL(window.location.href);
        url.protocol = protocol;
        url.port = String(this.port);
        url.pathname = path;
        url.search = "";
        url.hash = "";

        if (searchParams) {
            Object.entries(searchParams).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "")
                    url.searchParams.set(key, value);
            });
        }

        return url.toString();
    },
    // TODO: HTTPS/WSS is not fully working yet. Mihomo TLS controller needs a
    // browser-trusted certificate and a compatible reachable endpoint/port.
    getHttpUrl(path, searchParams = null) {
        return this.buildUrl(path, location.protocol === "https:" ? "https:" : "http:", searchParams);
    },
    getWsUrl(path, token, searchParams = null) {
        const params = Object.assign({}, searchParams || {});

        // Browser WebSocket cannot set Authorization headers. Query token is the least bad direct option.
        if (token)
            params.token = token;

        return this.buildUrl(path, location.protocol === "https:" ? "wss:" : "ws:", params);
    },

    // Generic HTTP helpers
    async fetch(path, token, options = {}, timeout = this.fetchTimeout, searchParams = null) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        const headers = Object.assign({}, options.headers || {}, token ? { "Authorization": `Bearer ${token}` } : {});

        try {
            return await fetch(this.getHttpUrl(path, searchParams), {
                ...options,
                headers,
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeoutId);
        }
    },
    async fetchJson(path, token, timeout = this.fetchTimeout, searchParams = null) {
        const res = await this.fetch(path, token, {}, timeout, searchParams);
        if (!res.ok)
            throw new Error(`${res.status} ${res.statusText}`);
        return await res.json();
    },
    createWebSocket({ path, token, searchParams, onMessage, onOpen, onClose, containerCheck }) {
        let ws = null;
        let reconnectTimer = null;
        let disposed = false;

        const clearReconnectTimer = () => {
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
        };

        const scheduleReconnect = () => {
            clearReconnectTimer();

            if (disposed)
                return;

            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                if (!disposed && containerCheck())
                    connect();
            }, common.defaultTimeoutForWSReconnect);
        };

        const connect = () => {
            if (disposed || ws || !containerCheck())
                return;

            ws = new WebSocket(this.getWsUrl(path, token, searchParams));

            ws.onopen = () => {
                console.log(`[WS ${path}] Connected`);
                if (onOpen)
                    onOpen();
            };
            ws.onmessage = onMessage;
            ws.onerror = (err) => console.warn(`[WS ${path}] Error:`, err);
            ws.onclose = (event) => {
                const reason = event && event.reason ? `, reason: ${event.reason}` : "";
                const code = event && typeof event.code === "number" ? event.code : "unknown";
                console.log(`[WS ${path}] Disconnected (code: ${code}${reason})`);
                ws = null;
                if (onClose)
                    onClose();

                if (disposed) {
                    clearReconnectTimer();
                    return;
                }

                scheduleReconnect();
            };
        };
        connect();

        return () => {
            disposed = true;
            clearReconnectTimer();
            if (ws) {
                ws.onclose = ws.onerror = ws.onmessage = null;
                ws.close();
                ws = null;
            }
        };
    },

    // Mihomo API methods
    fetchRuleProviders(token, timeout = this.fetchTimeout) {
        return this.fetchJson(this.paths.ruleProviders, token, timeout);
    },
    fetchConfigs(token, timeout = this.fetchTimeout) {
        return this.fetchJson(this.paths.configs, token, timeout);
    },
    fetchProxies(token, timeout = this.fetchTimeout) {
        return this.fetchJson(this.paths.proxies, token, timeout);
    },
    fetchProxyProviders(token, timeout = this.fetchTimeout) {
        return this.fetchJson(this.paths.proxyProviders, token, timeout);
    },
    fetchProxyDelay(proxyName, token, timeout = this.fetchTimeout, searchParams = null) {
        return this.fetchJson(this.paths.proxyDelay(proxyName), token, timeout, searchParams);
    },
    async patchConfigs(payload, token, timeout = this.fetchTimeout) {
        const res = await this.fetch(this.paths.configs, token, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        }, timeout);

        if (!res.ok) {
            let detail = "";

            try {
                detail = (await res.text()).trim();
            } catch (e) {}

            throw new Error(detail ? `${res.status} ${res.statusText}: ${detail}` : `${res.status} ${res.statusText}`);
        }

        return res;
    },
    async updateProxySelection(groupName, proxyName, token, timeout = this.fetchTimeout) {
        const res = await this.fetch(this.paths.proxy(groupName), token, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name: proxyName })
        }, timeout);

        if (!res.ok) {
            let detail = "";

            try {
                detail = (await res.text()).trim();
            } catch (e) {}

            throw new Error(detail ? `${res.status} ${res.statusText}: ${detail}` : `${res.status} ${res.statusText}`);
        }

        return res;
    },
    async resetGroupSelection(groupName, token, timeout = this.fetchTimeout) {
        const res = await this.fetch(this.paths.proxy(groupName), token, { method: "DELETE" }, timeout);

        if (res.ok)
            return res;

        let detail = "";

        try {
            detail = (await res.text()).trim();
        } catch (e) {}

        throw new Error(detail ? `${res.status} ${res.statusText}: ${detail}` : `${res.status} ${res.statusText}`);
    },
    async updateRulesetProvider(providerName, token, timeout = this.fetchTimeout) {
        const res = await this.fetch(this.paths.rulesetProvider(providerName), token, { method: "PUT" }, timeout);

        if (!res.ok) {
            let detail = "";

            try {
                detail = (await res.text()).trim();
            } catch (e) {}

            throw new Error(detail ? `${res.status} ${res.statusText}: ${detail}` : `${res.status} ${res.statusText}`);
        }

        return res;
    },
    async fetchVersion(token, timeout = this.fetchTimeout) {
        const res = await this.fetch(this.paths.version, token, {}, timeout);
        if (!res.ok)
            throw new Error(`${res.status} ${res.statusText}`);

        const contentType = (res.headers.get("content-type") || "").toLowerCase();

        if (contentType.includes("application/json")) {
            const data = await res.json();

            if (typeof data === "string")
                return data.trim();
            if (typeof data?.version === "string")
                return data.version.trim();
            if (typeof data?.mihomo === "string")
                return data.mihomo.trim();

            return JSON.stringify(data);
        }

        return (await res.text()).trim();
    },
    async closeConnection(id, token, timeout = this.fetchTimeout) {
        const res = await this.fetch(this.paths.connection(id), token, { method: "DELETE" }, timeout);

        if (!res.ok)
            throw new Error(`${res.status} ${res.statusText}`);

        return res;
    },
    async closeAllConnections(token, timeout = this.fetchTimeout) {
        const res = await this.fetch(this.paths.connections, token, { method: "DELETE" }, timeout);

        if (!res.ok)
            throw new Error(`${res.status} ${res.statusText}`);

        return res;
    },
    createTrafficWebSocket({ token, onMessage, containerCheck }) {
        return this.createWebSocket({
            path: this.paths.traffic,
            token,
            onMessage,
            containerCheck
        });
    },
    createMemoryWebSocket({ token, onMessage, containerCheck }) {
        return this.createWebSocket({
            path: this.paths.memory,
            token,
            onMessage,
            containerCheck
        });
    },
    createConnectionsWebSocket({ token, interval, onMessage, containerCheck }) {
        return this.createWebSocket({
            path: this.paths.connections,
            token,
            searchParams: { interval },
            onMessage,
            containerCheck
        });
    },
    createLogsWebSocket({ token, level, onMessage, containerCheck }) {
        return this.createWebSocket({
            path: this.paths.logs,
            token,
            searchParams: { level },
            onMessage,
            containerCheck
        });
    }
});
