"use strict";
"require view";
"require ui";
"require view.justclash.common as common";
"require uci";

const isMobile = () => {
    return window.matchMedia("(max-width: 600px)").matches;
};

const formatConnection = (conn) => {
    return {
        src: conn.metadata.sourceIP + ":" + conn.metadata.sourcePort,
        dest: conn.metadata.destinationIP
            ? conn.metadata.destinationIP + ":" + conn.metadata.destinationPort
            : (conn.metadata.remoteDestination || "")
    };
};

const getWSURL = (token) => {
    const host = window.location.hostname;
    const port = 9090;
    return (token && token != "") ? `ws://${host}:${port}/connections?token=${token}` : `ws://${host}:${port}/connections`
};

return view.extend({
    ws: null,
    reconnectTimeout: null,
    noConnectionsMsg: null,
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,
    wsErrorNotification: null,
    load: async function()
    {
        await uci.load("justclash")
        let token = uci.get("justclash", "proxy", "api_password");
        token = token || "";
        return {
            token
        };
    },
    render: function (result) {
        const container = E("div", { class: "cbi-section fade-in" });
        const table = E("div", { class: "flex-table" });

        const header = E("div", { class: "flex-header" }, [
            E("div", {}, _("Proto")),
            E("div", {}, _("Connection")),
            E("div", {}, _("Host/Sniff")),
            E("div", {}, _("Chains")),
            E("div", {}, _("Rule"))
        ]);

        table.appendChild(header);
        container.appendChild(E("h3", { class: "cbi-section-title" }, _("Active Connections")));
        container.appendChild(table);

        const rowMap = new Map();

        function createRow(conn) {
            const key = conn.id;
            const connObj = formatConnection(conn);
            const hostStr = [conn.metadata.host, conn.metadata.sniffHost].filter(Boolean).join(", ");
            const chainsStr = conn.chains.join(", ");
            const ruleStr = conn.rule;

            const row = E("div", { class: "flex-row", "data-key": key });

            // Proto
            row.appendChild(E("div", { "data-label": _("Proto") }, conn.metadata.network));

            if (isMobile()) {
                // Source
                row.appendChild(E("div", { "data-label": _("Source") }, connObj.src));
                // Destination
                row.appendChild(E("div", { "data-label": _("Destination") }, connObj.dest));
                // Host/Sniff
                row.appendChild(E("div", { "data-label": _("Host/Sniff") }, hostStr));
                // Chains
                row.appendChild(E("div", { "data-label": _("Chains") }, chainsStr));
                // Rule
                row.appendChild(E("div", { "data-label": _("Rule") }, ruleStr));
            } else {
                // Desktop: Connection (source → dest)
                row.appendChild(E("div", { "data-label": _("Connection") }, connObj.src + (connObj.dest ? " → " + connObj.dest : "")));
                // Host/Sniff
                row.appendChild(E("div", { "data-label": _("Host/Sniff") }, hostStr));
                // Chains
                row.appendChild(E("div", { "data-label": _("Chains") }, chainsStr));
                // Rule
                row.appendChild(E("div", { "data-label": _("Rule") }, ruleStr));
            }
            return row;
        }

        function updateRow(conn) {
            const key = conn.id;
            let row = rowMap.get(key);

            const expectedCells = isMobile() ? 6 : 5;

            if (row) {
                if (row.childNodes.length !== expectedCells) {
                    table.removeChild(row);
                    rowMap.delete(key);
                    row = null;
                }
            }

            if (!row) {
                row = createRow(conn);
                table.appendChild(row);
                rowMap.set(key, row);
            } else {
                const connObj = formatConnection(conn);
                const hostStr = [conn.metadata.host, conn.metadata.sniffHost].filter(Boolean).join(", ");
                const chainsStr = conn.chains.join(", ");
                const ruleStr = conn.rule;

                const values = isMobile()
                    ? [
                        conn.metadata.network,
                        connObj.src,
                        connObj.dest,
                        hostStr,
                        chainsStr,
                        ruleStr
                    ]
                    : [
                        conn.metadata.network,
                        connObj.src + (connObj.dest ? " → " + connObj.dest : ""),
                        hostStr,
                        chainsStr,
                        ruleStr
                    ];
                const cells = row.childNodes;
                for (let i = 0; i < values.length; i++) {
                    if (cells[i] && cells[i].textContent !== values[i]) {
                        cells[i].textContent = values[i];
                    }
                }
            }
        }

        const connectWS = () => {
            const wsUrl = getWSURL(result.token);
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log("[WS] Connected");
            };
            if (this.wsErrorNotification) {
                ui.removeNotification(this.wsErrorNotification);
                this.wsErrorNotification = null;
            }
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    const conns = Array.isArray(data.connections) ? data.connections : [];
                    const seenKeys = new Set();

                    for (const conn of conns) {
                        const key = conn.id;
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
                if (!this.wsErrorNotification) {
                    this.wsErrorNotification = ui.addNotification(
                        _("Connection error"),
                        E("p", _("Can't connect to proxy API")),
                        "error"
                    );
                }
            };

            this.ws.onclose = () => {
                console.warn("[WS] Disconnected. Reconnecting in 10 seconds...");
                if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = setTimeout(() => {
                    connectWS();
                }, common.defaultTimeoutForWSReconnect);
            };
        };

        connectWS();

        const style = E("style", {}, `
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
            .flex-header > div:nth-child(2),
            .flex-row > div:nth-child(2) { /* Connections */
                flex: 0 0 300px;
                max-width: 300px;
            }
            .flex-header > div:nth-child(4),
            .flex-row > div:nth-child(4) { /* Chains */
                flex: 0 0 80px;
                max-width: 140px;
            }
            .flex-header > div:nth-child(5),
            .flex-row > div:nth-child(5) { /* Rule */
                flex: 0 0 65px;
                max-width: 110px;
            }
            .flex-row:last-child {
                border-bottom: none;
            }

            /* --- Mobile CSS --- */
            @media (max-width: 600px) {
                .flex-header { display: none; }
                .flex-row {
                    display: block;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    margin-bottom: 10px;
                    padding: 8px;
                    background: var(--background-color-medium, #f9f9f9);
                }
                .flex-row > div {
                    display: flex;
                    padding: 2px 0;
                    white-space: normal;
                    overflow: visible;
                    text-overflow: initial;
                    min-width: 0;
                }
                .flex-row > div::before {
                    content: attr(data-label) ": ";
                    font-weight: bold;
                    color: #666;
                    min-width: 90px;
                    display: inline-block;
                }
            }
        `);

        container.appendChild(style);
        return container;
    },

    destroy: function () {
        if (this.wsErrorNotification) {
            ui.removeNotification(this.wsErrorNotification);
            this.wsErrorNotification = null;
        }
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