"use strict";
"require view";
"require ui";
"require view.justclash.common as common";
"require uci";

let activeWS = null;
let trafficWS = null;
let memoryWS = null;
let reconnectTimer = null;
let reconnectTrafficTimer = null;
let reconnectMemoryTimer = null;
let noConnectionsMsg = null;

const connectionsData = new Map();
const statsData = {
    traffic: { up: 0, down: 0, upTotal: 0, downTotal: 0 },
    memory: { inuse: 0, oslimit: 0 }
};

const formatBytes = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const formatSpeed = (bytesPerSec) => {
    return formatBytes(bytesPerSec) + "/s";
};

const copyToClipboard = (text) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
};

const formatConnection = (conn) => {
    return {
        src: conn.metadata.sourceIP + ":" + conn.metadata.sourcePort,
        dest: conn.metadata.destinationIP
            ? conn.metadata.destinationIP + ":" + conn.metadata.destinationPort
            : (conn.metadata.remoteDestination || "")
    };
};

const getWSURL = (path, token) => {
    const host = window.location.hostname;
    const port = 9090;
    return (token && token != "") ? `ws://${host}:${port}${path}?token=${token}` : `ws://${host}:${port}${path}`;
};

const cleanup = () => {
    if (activeWS) {
        activeWS.onclose = null;
        activeWS.onerror = null;
        activeWS.onmessage = null;
        activeWS.close();
        activeWS = null;
    }
    if (trafficWS) {
        trafficWS.onclose = null;
        trafficWS.onerror = null;
        trafficWS.onmessage = null;
        trafficWS.close();
        trafficWS = null;
    }
    if (memoryWS) {
        memoryWS.onclose = null;
        memoryWS.onerror = null;
        memoryWS.onmessage = null;
        memoryWS.close();
        memoryWS = null;
    }
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (reconnectTrafficTimer) {
        clearTimeout(reconnectTrafficTimer);
        reconnectTrafficTimer = null;
    }
    if (reconnectMemoryTimer) {
        clearTimeout(reconnectMemoryTimer);
        reconnectMemoryTimer = null;
    }
    noConnectionsMsg = null;
    connectionsData.clear();
};

const showConnectionDetails = (connId) => {
    const conn = connectionsData.get(connId);
    if (!conn) return;

    const jsonString = JSON.stringify(conn, null, 2);

    ui.showModal(_("Connection Details"), [
        E("div", { class: "json-viewer-container" }, [
            E("pre", { class: "jc-json-terminal" }, jsonString)
        ]),
        E("div", { class: "right", style: "margin-top: 10px;" }, [
            E("button", {
                class: "cbi-button cbi-button-action",
                click: () => {
                    copyToClipboard(jsonString);
                    ui.addNotification(null, E("p", _("JSON copied to clipboard")), "success", 3000);
                    ui.hideModal();
                }
            }, [_("Copy JSON")]),
            E("button", {
                class: "cbi-button cbi-button-neutral",
                style: "margin-left: 5px;",
                click: ui.hideModal
            }, [_("Close")])
        ])
    ]);
};

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,

    load: async function () {
        await uci.load("justclash");
        let token = uci.get("justclash", "proxy", "api_password");
        token = token || "";
        return { token };
    },

    render: function (result) {
        cleanup();

        const container = E("div", { class: "cbi-section fade-in" });

        container.appendChild(E("h3", { class: "cbi-section-title" }, _("Statistic")));

        function makeCard(id, title, emoji, initialText) {
            return E('div', { class: 'jc-card' }, [
                E('div', { class: 'jc-card-header' }, [
                    E('span', { class: 'jc-card-icon' }, emoji),
                    E('span', {}, title)
                ]),
                E('div', { class: 'jc-card-body', id: id }, initialText || '-')
            ]);
        }

        const statsGrid = E('div', { class: 'jc-cards-grid' }, [
            makeCard('traffic-up',        _('Upload speed'),      '⬆️', '0 B/s'),
            makeCard('traffic-down',      _('Download speed'),    '⬇️', '0 B/s'),
            makeCard('traffic-up-total',  _('Total Up'),    '📤', '0 B'),
            makeCard('traffic-down-total',_('Total Down'),  '📥', '0 B'),
            makeCard('memory-inuse',      _('Ram usage'),      '📊', '0 B')
        ]);

        container.appendChild(statsGrid);

        const table = E("div", { class: "jc-table compact-table" });

        const header = E("div", { class: "flex-header" }, [
            E("div", { class: "c-proto" }, _("Proto")),
            E("div", { class: "c-conn" }, _("Connection")),
            E("div", { class: "c-host" }, _("Host/Sniff")),
            E("div", { class: "c-chains" }, _("Chains")),
            E("div", { class: "c-rule" }, _("Rule"))
        ]);

        table.appendChild(header);
        container.appendChild(E("h3", { class: "cbi-section-title", style: "margin-top: 20px;" }, _("Active Connections")));
        container.appendChild(table);

        const rowMap = new Map();

        function createRow(conn) {
            const key = conn.id;

            const row = E("div", {
                class: "flex-row clickable",
                "data-key": key,
                click: () => showConnectionDetails(key)
            });

            row.appendChild(E("div", { class: "c-proto", "data-label": _("Proto") }, ""));
            row.appendChild(E("div", { class: "c-conn hide-mobile", "data-label": _("Connection") }, ""));
            row.appendChild(E("div", { class: "c-src show-mobile", "data-label": _("Source") }, ""));
            row.appendChild(E("div", { class: "c-dest show-mobile", "data-label": _("Destination") }, ""));
            row.appendChild(E("div", { class: "c-host", "data-label": _("Host/Sniff") }, ""));
            row.appendChild(E("div", { class: "c-chains", "data-label": _("Chains") }, ""));
            row.appendChild(E("div", { class: "c-rule", "data-label": _("Rule") }, ""));

            return row;
        }

        function updateRow(conn) {
            const key = conn.id;
            connectionsData.set(key, conn);
            let row = rowMap.get(key);

            if (!row) {
                row = createRow(conn);
                table.appendChild(row);
                rowMap.set(key, row);
            }

            const connObj = formatConnection(conn);
            const hostStr = [conn.metadata.host, conn.metadata.sniffHost].filter(Boolean).join(", ");
            const chainsStr = conn.chains.join(", ");
            const ruleStr = conn.rule;
            const desktopConnStr = connObj.src + (connObj.dest ? " -> " + connObj.dest : "");

            const cells = row.childNodes;

            if (cells[0].textContent !== conn.metadata.network) cells[0].textContent = conn.metadata.network;
            if (cells[1].textContent !== desktopConnStr) cells[1].textContent = desktopConnStr;
            if (cells[2].textContent !== connObj.src) cells[2].textContent = connObj.src;
            if (cells[3].textContent !== connObj.dest) cells[3].textContent = connObj.dest;
            if (cells[4].textContent !== hostStr) cells[4].textContent = hostStr;
            if (cells[5].textContent !== chainsStr) cells[5].textContent = chainsStr;
            if (cells[6].textContent !== ruleStr) cells[6].textContent = ruleStr;
        }

        function startWebSocket() {
            const wsUrl = getWSURL("/connections", result.token);
            activeWS = new WebSocket(wsUrl);

            activeWS.onopen = () => {
                console.log("[WS Connections] Connected");
            };

            activeWS.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    const conns = Array.isArray(data.connections) ? data.connections : [];
                    const seenKeys = new Set();

                    for (const conn of conns) {
                        seenKeys.add(conn.id);
                        updateRow(conn);
                    }

                    for (const key of rowMap.keys()) {
                        if (!seenKeys.has(key)) {
                            const row = rowMap.get(key);
                            if (row.parentNode) row.parentNode.removeChild(row);
                            rowMap.delete(key);
                            connectionsData.delete(key);
                        }
                    }

                    if (rowMap.size === 0) {
                        if (!noConnectionsMsg) {
                            noConnectionsMsg = E("div", { class: "flex-row no-data" }, [
                                E("div", {}, _("No active connections"))
                            ]);
                            table.appendChild(noConnectionsMsg);
                        }
                    } else if (noConnectionsMsg) {
                        if (noConnectionsMsg.parentNode) {
                            noConnectionsMsg.parentNode.removeChild(noConnectionsMsg);
                        }
                        noConnectionsMsg = null;
                    }

                } catch (e) {
                    console.warn("WS parsing error:", e);
                }
            };

            activeWS.onerror = (err) => {
                console.warn("[WS Connections] Error:", err);
            };

            activeWS.onclose = () => {
                console.warn("[WS Connections] Closed. Retry in 10s...");
                activeWS = null;
                if (reconnectTimer) clearTimeout(reconnectTimer);

                reconnectTimer = setTimeout(() => {
                    if (document.body.contains(table)) {
                        startWebSocket();
                    }
                }, common.defaultTimeoutForWSReconnect);
            };
        }

        function startTrafficWS() {
            const wsUrl = getWSURL("/traffic", result.token);
            trafficWS = new WebSocket(wsUrl);

            trafficWS.onopen = () => {
                console.log("[WS Traffic] Connected");
            };

            trafficWS.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    statsData.traffic = data;

                    document.getElementById("traffic-up").textContent = formatSpeed(data.up);
                    document.getElementById("traffic-down").textContent = formatSpeed(data.down);
                    document.getElementById("traffic-up-total").textContent = formatBytes(data.upTotal);
                    document.getElementById("traffic-down-total").textContent = formatBytes(data.downTotal);
                } catch (e) {
                    console.warn("Traffic WS parsing error:", e);
                }
            };

            trafficWS.onerror = (err) => {
                console.warn("[WS Traffic] Error:", err);
            };

            trafficWS.onclose = () => {
                console.warn("[WS Traffic] Closed. Retry in 10s...");
                trafficWS = null;
                if (reconnectTrafficTimer) clearTimeout(reconnectTrafficTimer);

                reconnectTrafficTimer = setTimeout(() => {
                    if (document.body.contains(container)) {
                        startTrafficWS();
                    }
                }, common.defaultTimeoutForWSReconnect);
            };
        }

        function startMemoryWS() {
            const wsUrl = getWSURL("/memory", result.token);
            memoryWS = new WebSocket(wsUrl);

            memoryWS.onopen = () => {
                console.log("[WS Memory] Connected");
            };

            memoryWS.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    statsData.memory = data;

                    document.getElementById("memory-inuse").textContent = formatBytes(data.inuse);
                } catch (e) {
                    console.warn("Memory WS parsing error:", e);
                }
            };

            memoryWS.onerror = (err) => {
                console.warn("[WS Memory] Error:", err);
            };

            memoryWS.onclose = () => {
                console.warn("[WS Memory] Closed. Retry in 10s...");
                memoryWS = null;
                if (reconnectMemoryTimer) clearTimeout(reconnectMemoryTimer);

                reconnectMemoryTimer = setTimeout(() => {
                    if (document.body.contains(container)) {
                        startMemoryWS();
                    }
                }, common.defaultTimeoutForWSReconnect);
            };
        }

        startWebSocket();
        startTrafficWS();
        startMemoryWS();

        const style = E("style", {}, `
            .jc-cards-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 10px;
                margin-bottom: 14px;
            }

            /* Card Style */
            .jc-card {
                border: 1px solid var(--primary-color, #1676bb);
                border-radius: 4px;
                padding: 10px;
                display: flex;
                flex-direction: column;
                background: var(--background-color-high);
            }

            .jc-card-header {
                display: flex;
                align-items: center;
                margin-bottom: 8px;
                opacity: 0.8;
                font-size: 0.9em;
                text-transform: uppercase;
                color: var(--text-color);
            }

            .jc-card-icon {
                font-size: 1.2em;
                margin-right: 8px;
            }

            .jc-card-body {
                font-size: 1.1em;
                font-weight: 600;
                word-break: break-all;
                color: var(--text-color);
                font-family: monospace;
            }

            /* Connections Table */
            .jc-table {
                display: flex;
                flex-direction: column;
                width: 100%;
                font-family: monospace;
                font-size: 11px;
            }
            .flex-header {
                border-bottom: 1px solid #e0e0e0;
                font-weight: bold;
                background-color: var(--background-color-medium, #f0f0f0);
                padding: 4px 0;
            }
            .flex-header, .flex-row {
                display: flex;
                line-height: 1.2;
                align-items: center;
            }
            .flex-header > div, .flex-row > div {
                padding: 0 4px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .flex-row {
                padding: 3px 0;
                border-bottom: 1px solid transparent;
            }
            .flex-row:nth-child(even) {
                background: var(--background-color-medium, #fafafa);
            }

            .flex-row.clickable:hover {
                background-color: rgba(180, 180, 180, 0.2);
                cursor: pointer;
            }

            [data-theme="dark"] .flex-row.clickable:hover {
                background-color: rgba(100, 100, 100, 0.2);
            }

            .c-proto   { flex: 0 0 60px; max-width: 70px; }
            .c-conn    { flex: 2 1 200px; }
            .c-host    { flex: 2 1 150px; }
            .c-chains  { flex: 0 0 140px; }
            .c-rule    { flex: 0 0 110px; }

            .show-mobile { display: none; }
            .no-data { justify-content: center; padding: 20px; font-style: italic; color: #888; }

            /* JSON Terminal */
            .jc-json-terminal {
                width: 100%;
                font-family: 'Menlo', 'Consolas', 'Monaco', monospace;
                font-size: 12px;
                line-height: 1.4;
                white-space: pre-wrap;
                word-break: break-all;
                overflow-y: auto;
                background-color: #1e1e1e;
                color: #d4d4d4;
                border: 1px solid #3c3c3c;
                border-radius: 6px;
                padding: 10px;
                margin: 0;
                max-height: 500px;
            }

            @media (max-width: 900px) {
                .jc-cards-grid {
                    grid-template-columns: repeat(2, 1fr);
                }

                .flex-header { display: none; }
                .flex-row { flex-direction: column; align-items: flex-start; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 10px; padding: 8px; background: var(--background-color-medium, #fff); }
                .flex-row > div { display: flex; width: 100%; max-width: none; flex: 1 1 auto; white-space: normal; padding: 2px 0; }
                .hide-mobile { display: none !important; }
                .show-mobile { display: flex !important; }
                .flex-row > div::before { content: attr(data-label) ": "; font-weight: bold; color: #555; min-width: 110px; display: inline-block; flex-shrink: 0; }
                .c-proto, .c-host, .c-chains, .c-rule { flex: auto; max-width: none; }
            }

            @media (max-width: 600px) {
                .jc-cards-grid {
                    grid-template-columns: 1fr;
                }
            }
        `);

        container.appendChild(style);
        return container;
    },

    leave: function () {
        cleanup();
    }
});
