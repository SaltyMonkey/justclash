"use strict";
"require view";
"require ui";
"require view.justclash.common as common";
"require uci";

let activeWS = null;
let reconnectTimer = null;
let noConnectionsMsg = null;

const connectionsData = new Map();

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

const getWSURL = (token) => {
    const host = window.location.hostname;
    const port = 9090;
    return (token && token != "") ? `ws://${host}:${port}/connections?token=${token}` : `ws://${host}:${port}/connections`;
};

const cleanup = () => {
    if (activeWS) {
        activeWS.onclose = null;
        activeWS.onerror = null;
        activeWS.onmessage = null;
        activeWS.close();
        activeWS = null;
    }
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
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
        const table = E("div", { class: "flex-table compact-table" });

        const header = E("div", { class: "flex-header" }, [
            E("div", { class: "c-proto" }, _("Proto")),
            E("div", { class: "c-conn" }, _("Connection")),
            E("div", { class: "c-host" }, _("Host/Sniff")),
            E("div", { class: "c-chains" }, _("Chains")),
            E("div", { class: "c-rule" }, _("Rule"))
        ]);

        table.appendChild(header);
        container.appendChild(E("h3", { class: "cbi-section-title" }, _("Active Connections")));
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
            const desktopConnStr = connObj.src + (connObj.dest ? " → " + connObj.dest : "");

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
            const wsUrl = getWSURL(result.token);
            activeWS = new WebSocket(wsUrl);

            activeWS.onopen = () => {
                console.log("[WS] Connected");
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
                console.warn("[WS] Error:", err);
                ui.addNotification(
                    _("Connection error"),
                    E("p", _("Can't connect to proxy API")),
                    "error",
                    3000
                );
                console.error("Connection error", e);

            };

            activeWS.onclose = () => {
                console.warn("[WS] Closed. Retry in 10s...");
                activeWS = null;
                if (reconnectTimer) clearTimeout(reconnectTimer);

                reconnectTimer = setTimeout(() => {
                    if (document.body.contains(table)) {
                        startWebSocket();
                    }
                }, common.defaultTimeoutForWSReconnect);
            };
        }

        startWebSocket();

        const style = E("style", {}, `
            .flex-table {
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
                .flex-header { display: none; }
                .flex-row { flex-direction: column; align-items: flex-start; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 10px; padding: 8px; background: var(--background-color-medium, #fff); }
                .flex-row > div { display: flex; width: 100%; max-width: none; flex: 1 1 auto; white-space: normal; padding: 2px 0; }
                .hide-mobile { display: none !important; }
                .show-mobile { display: flex !important; }
                .flex-row > div::before { content: attr(data-label) ": "; font-weight: bold; color: #555; min-width: 110px; display: inline-block; flex-shrink: 0; }
                .c-proto, .c-host, .c-chains, .c-rule { flex: auto; max-width: none; }
            }
        `);

        container.appendChild(style);
        return container;
    },

    leave: function () {
        cleanup();
    }
});
