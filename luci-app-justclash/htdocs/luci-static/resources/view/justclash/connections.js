"use strict";
"require view";
"require ui";

return view.extend({
    ws: null,
    reconnectTimeout: null,
    noConnectionsMsg: null,
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,

    getWSURL: function () {
        const host = window.location.hostname;
        const port = 9090;
        return `ws://${host}:${port}/connections`;
    },

    render: function () {
        const container = E("div", { class: "cbi-section" });
        const table = E("div", { class: "flex-table" });

        // Удалены заголовки Time, Upload, Download
        const header = E("div", { class: "flex-header" }, [
            E("div", {}, _("Proto")),
            E("div", {}, _("Connection")),
            E("div", {}, _("Host/Sniff")),
            E("div", {}, _("Chains")),
            E("div", {}, _("Rule"))
        ]);

        table.appendChild(header);
        container.appendChild(E("h2", {}, _("Active Connections")));
        container.appendChild(table);

        const rowMap = new Map();

        function getKey(conn) {
            return conn.id;
        }

        function formatConnection(conn) {
            const src = conn.metadata.sourceIP + ":" + conn.metadata.sourcePort;
            const dest = conn.metadata.destinationIP
                ? conn.metadata.destinationIP + ":" + conn.metadata.destinationPort
                : (conn.metadata.remoteDestination || "");
            return src + (dest ? " → " + dest : "");
        }

        function updateRow(conn) {
            const key = getKey(conn);
            let row = rowMap.get(key);

            const connStr = formatConnection(conn);
            const hostStr = [conn.metadata.host, conn.metadata.sniffHost].filter(Boolean).join(", ");
            const chainsStr = conn.chains.join(", ");
            const ruleStr = conn.rule;

            if (!row) {
                row = E("div", { class: "flex-row", "data-key": key }, [
                    E("div", {}, conn.metadata.network),
                    E("div", {}, connStr),
                    E("div", {}, hostStr),
                    E("div", {}, chainsStr),
                    E("div", {}, ruleStr)
                ]);
                table.appendChild(row);
                rowMap.set(key, row);
            } else {
                const cells = row.childNodes;
                const newValues = [
                    conn.metadata.network,
                    connStr,
                    hostStr,
                    chainsStr,
                    ruleStr
                ];
                for (let i = 0; i < newValues.length; i++) {
                    if (cells[i].textContent !== newValues[i]) {
                        cells[i].textContent = newValues[i];
                    }
                }
            }
        }

        const connectWS = () => {
            const wsUrl = this.getWSURL();
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log("[WS] Connected");
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    const conns = Array.isArray(data.connections) ? data.connections : [];
                    const seenKeys = new Set();

                    for (const conn of conns) {
                        const key = getKey(conn);
                        seenKeys.add(key);
                        updateRow(conn);
                    }

                    for (const key of rowMap.keys()) {
                        if (!seenKeys.has(key)) {
                            table.removeChild(rowMap.get(key));
                            rowMap.delete(key);
                        }
                    }

                    if (rowMap.size === 0) {
                        if (!this.noConnectionsMsg) {
                            this.noConnectionsMsg = E("div", { class: "flex-row" }, [
                                E("div", { style: "text-align: center; flex: 1;" }, _("No active connections"))
                            ]);
                            table.appendChild(this.noConnectionsMsg);
                        }
                        setTimeout(() => {
                            if (rowMap.size === 0 && table.contains(this.noConnectionsMsg)) {
                                table.removeChild(this.noConnectionsMsg);
                                this.noConnectionsMsg = null;
                            }
                        }, 2000);
                    } else if (this.noConnectionsMsg) {
                        table.removeChild(this.noConnectionsMsg);
                        this.noConnectionsMsg = null;
                    }
                } catch (e) {
                    console.warn("WS data parsing error:", e);
                    ui.addNotification(null, E("p", _("Unable to read the contents") + ": " + (e.message || e)), "error");
                }
            };

            this.ws.onerror = (err) => {
                console.warn("[WS] Error:", err);
                ui.addNotification(null, E("p", _("API connection error")), "error");
            };

            this.ws.onclose = () => {
                console.warn("[WS] Disconnected. Reconnecting in 5 seconds...");
                if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = setTimeout(() => {
                    connectWS();
                }, 5000);
            };
        };

        connectWS();
        container.appendChild(this.addCSS());
        return container;
    },
    addCSS: function () {
        return E("style", {}, `
        .flex-table {
            display: flex;
            flex-direction: column;
            width: 100%;
            font-family: monospace;
            font-size: 12px;
            overflow: hidden;
        }
        .flex-header {
            border-bottom: 1px solid #e0e0e0;
        }
        .flex-header, .flex-row {
            display: flex;
            padding: 3px 0;
            line-height: 1.1;
        }
        .flex-header {
            font-weight: bold;
        }
        .flex-header > div,
        .flex-row > div {
            flex: 1;
            padding: 0 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            min-width: 0;
        }
        .flex-row:nth-child(even) {
            background: var(--background-color-medium);
        }
        .flex-header > div:nth-child(1),
        .flex-row > div:nth-child(1) { /* Proto */
            flex: 0 0 60px;
            max-width: 70px;
        }
        .flex-header > div:nth-child(4),
        .flex-row > div:nth-child(4) { /* Chains */
            flex: 0 0 80px;
            max-width: 100px;
        }
        .flex-header > div:nth-child(5),
        .flex-row > div:nth-child(5) { /* Rule */
            flex: 0 0 80px;
            max-width: 120px;
        }
        .flex-row:last-child {
            border-bottom: none;
        }
    `);
    },
    destroy: function () {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        if (this.noConnectionsMsg && this.noConnectionsMsg.parentNode) {
            this.noConnectionsMsg.parentNode.removeChild(this.noConnectionsMsg);
            this.noConnectionsMsg = null;
        }
    }
});
