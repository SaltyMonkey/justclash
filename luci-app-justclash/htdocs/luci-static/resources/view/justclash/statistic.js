"use strict";
"require view";
"require ui";
"require view.justclash.common as common";
"require uci";

const NOTIFICATION_TIMEOUT = 3000;
const ROW_HIGHLIGHT_TIMEOUT = 2000;
const CONTROLLER_PORT = 9090;

let wsCleanups = [];
let noConnectionsMsg = null;
let clipboardTextarea = null;

const connectionsData = new Map();
const statsData = {
    traffic: { up: 0, down: 0, upTotal: 0, downTotal: 0 },
    memory: { inuse: 0 }
};

const statCardIcons = {
    upload: [
        { tag: "path", attrs: { d: "M8 12V4M5.75 6.25 8 4l2.25 2.25M4.5 12h7", fill: "none" } }
    ],
    download: [
        { tag: "path", attrs: { d: "M8 4v8M5.75 9.75 8 12l2.25-2.25M4.5 4h7", fill: "none" } }
    ],
    uploadTotal: [
        { tag: "path", attrs: { d: "M8 12V5.5M5.75 7.75 8 5.5l2.25 2.25M4.5 12h7M11.5 4.5h0", fill: "none" } }
    ],
    downloadTotal: [
        { tag: "path", attrs: { d: "M8 4v6.5M5.75 8.25 8 10.5l2.25-2.25M4.5 4h7M11.5 11.5h0", fill: "none" } }
    ],
    memory: [
        { tag: "rect", attrs: { x: "4.25", y: "4.25", width: "7.5", height: "7.5", rx: "1", fill: "none" } },
        { tag: "path", attrs: { d: "M6.5 2.5v1.75M9.5 2.5v1.75M6.5 11.75v1.75M9.5 11.75v1.75M2.5 6.5h1.75M2.5 9.5h1.75M11.75 6.5h1.75M11.75 9.5h1.75", fill: "none" } }
    ]
};

const createSvgElement = (tag, attrs) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs || {}).forEach((key) => el.setAttribute(key, attrs[key]));
    return el;
};

const createStatIcon = (iconKey) => {
    const span = E("span", { class: "jc-card-icon", "aria-hidden": "true" });
    const svg = createSvgElement("svg", {
        class: "jc-card-icon-svg",
        viewBox: "0 0 16 16",
        focusable: "false"
    });

    (statCardIcons[iconKey] || []).forEach((shape) => {
        svg.appendChild(createSvgElement(shape.tag, shape.attrs));
    });

    span.appendChild(svg);
    return span;
};

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const formatSpeed = (bytesPerSec) => formatBytes(bytesPerSec) + "/s";

const copyToClipboard = async (text) => {
    if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
    } else {
        const ta = clipboardTextarea || document.createElement("textarea");
        clipboardTextarea = ta;
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        if (!ta.parentNode)
            document.body.appendChild(ta);
        ta.focus();
        ta.select();
        if (!document.execCommand("copy"))
            throw new Error(_("Unable to copy to clipboard"));
    }
};

const formatConnection = (conn) => ({
    src: conn.metadata.sourceIP + ":" + conn.metadata.sourcePort,
    dest: conn.metadata.destinationIP
        ? conn.metadata.destinationIP + ":" + conn.metadata.destinationPort
        : (conn.metadata.remoteDestination || "")
});

const getWSURL = (path, token) => {
    const host = window.location.hostname;
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    return (token && token !== "")
        ? `${protocol}://${host}:${CONTROLLER_PORT}${path}?token=${token}`
        : `${protocol}://${host}:${CONTROLLER_PORT}${path}`;
};

const cleanup = () => {
    wsCleanups.forEach(fn => fn());
    wsCleanups = [];
    noConnectionsMsg = null;
    connectionsData.clear();
};

const showConnectionDetails = (connId) => {
    const conn = connectionsData.get(connId);
    if (!conn) return;
    const jsonString = JSON.stringify(conn, null, 2);

    ui.showModal(_("Connection details"), [
        E("div", { class: "json-viewer-container" }, [
            E("pre", { class: "jc-json-terminal" }, jsonString)
        ]),
        E("div", { class: "right", style: "margin-top: 10px;" }, [
            E("button", {
                class: "cbi-button cbi-button-action",
                click: async () => {
                    try {
                        await copyToClipboard(jsonString || "");
                        ui.addTimeLimitedNotification(null, E("p", _("Copied to clipboard")), NOTIFICATION_TIMEOUT, "success");
                        ui.hideModal();
                    } catch (e) {
                        ui.addTimeLimitedNotification(_("Error"), E("p", `${e.message || e}`), NOTIFICATION_TIMEOUT, "danger");
                        console.error("Failed to copy connection details to clipboard", e);
                    }
                }
            }, [_("Copy details")]),
            E("button", {
                class: "cbi-button cbi-button-neutral",
                style: "margin-left: 5px;",
                click: ui.hideModal
            }, [_("Close")])
        ])
    ]);
};

function createWebSocket({ path, token, onMessage, containerCheck }) {
    let ws = null;
    let reconnectTimer = null;

    function connect() {
        ws = new WebSocket(getWSURL(path, token));

        ws.onopen = () => console.log(`[WS ${path}] Connected`);
        ws.onmessage = onMessage;
        ws.onerror = (err) => console.warn(`[WS ${path}] Error:`, err);
        ws.onclose = () => {
            ws = null;
            reconnectTimer = setTimeout(() => {
                if (containerCheck()) connect();
            }, common.defaultTimeoutForWSReconnect);
        };
    }

    connect();

    return () => {
        if (ws) {
            ws.onclose = ws.onerror = ws.onmessage = null;
            ws.close();
        }
        if (reconnectTimer) clearTimeout(reconnectTimer);
    };
}

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,

    load: async function () {
        try {
            await uci.load("justclash");
            const token = uci.get("justclash", "proxy", "api_password") || "";
            return { token, configLoadFailed: false };
        } catch (e) {
            console.error("Failed to load justclash config", e);
            ui.addNotification(
                _("Error"),
                E("p", _("Failed to load rulesets") + ": " + (e.message || e)),
                "danger"
            );
            return { token: "", configLoadFailed: true };
        }
    },

    render: function (result) {
        cleanup();

        const container = E("div", { class: "cbi-section fade-in" });
        container.appendChild(E("h3", { class: "cbi-section-title" }, _("Statistics")));

        function makeCard(id, title, iconKey, initialText) {
            return E("div", { class: "jc-card" }, [
                E("div", { class: "jc-card-header" }, [
                    createStatIcon(iconKey),
                    E("span", { class: "jc-card-label" }, title)
                ]),
                E("div", { class: "jc-card-body jc-stat-card-body", id: id }, initialText || "-")
            ]);
        }

        const statsGrid = E("div", { class: "jc-cards-grid" }, [
            makeCard("traffic-up", _("Upload speed"), "upload", "0 B/s"),
            makeCard("traffic-down", _("Download speed"), "download", "0 B/s"),
            makeCard("traffic-up-total", _("Total Up"), "uploadTotal", "0 B"),
            makeCard("traffic-down-total", _("Total Down"), "downloadTotal", "0 B"),
            makeCard("memory-inuse", _("Ram usage"), "memory", "0 B")
        ]);

        container.appendChild(statsGrid);
        const trafficUpEl = statsGrid.querySelector("#traffic-up");
        const trafficDownEl = statsGrid.querySelector("#traffic-down");
        const trafficUpTotalEl = statsGrid.querySelector("#traffic-up-total");
        const trafficDownTotalEl = statsGrid.querySelector("#traffic-down-total");
        const memoryInuseEl = statsGrid.querySelector("#memory-inuse");

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

        function highlightNewRow(row) {
            row.classList.add("jc-new-row");
            setTimeout(() => row.classList.remove("jc-new-row"), ROW_HIGHLIGHT_TIMEOUT);
        }

        function createRow(conn) {
            const key = conn.id;
            const row = E("div", { class: "flex-row clickable", "data-key": key, click: () => showConnectionDetails(key) });
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
            let isNew = false;

            if (!row) {
                row = createRow(conn);
                table.appendChild(row);
                rowMap.set(key, row);
                isNew = true;
            }

            const connObj = formatConnection(conn);
            const hostStr = [conn.metadata.host, conn.metadata.sniffHost].filter(Boolean).join(", ");
            const chainsStr = conn.chains.join(", ");
            const ruleStr = conn.rule;
            const desktopConnStr = connObj.src + (connObj.dest ? " -> " + connObj.dest : "");

            const cells = row.childNodes;
            cells[0].textContent = conn.metadata.network ? conn.metadata.network.toUpperCase() : "";
            cells[1].textContent = desktopConnStr;
            cells[2].textContent = connObj.src;
            cells[3].textContent = connObj.dest;
            cells[4].textContent = hostStr;
            cells[5].textContent = chainsStr;
            cells[6].textContent = ruleStr;

            if (isNew) highlightNewRow(row);
        }

        if (!result.configLoadFailed) {
            wsCleanups.push(createWebSocket({
                path: "/connections",
                token: result.token,
                containerCheck: () => document.body.contains(table),
                onMessage: (event) => {
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

                        if (rowMap.size === 0 && !noConnectionsMsg) {
                            noConnectionsMsg = E("div", { class: "flex-row no-data" }, [E("div", {}, _("No active connections"))]);
                            table.appendChild(noConnectionsMsg);
                        } else if (noConnectionsMsg) {
                            noConnectionsMsg.parentNode?.removeChild(noConnectionsMsg);
                            noConnectionsMsg = null;
                        }
                    } catch (e) {
                        console.warn("WS parsing error:", e);
                    }
                }
            }));

            wsCleanups.push(createWebSocket({
                path: "/traffic",
                token: result.token,
                containerCheck: () => document.body.contains(container),
                onMessage: (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        statsData.traffic = data;
                        trafficUpEl.textContent = formatSpeed(data.up);
                        trafficDownEl.textContent = formatSpeed(data.down);
                        trafficUpTotalEl.textContent = formatBytes(data.upTotal);
                        trafficDownTotalEl.textContent = formatBytes(data.downTotal);
                    } catch (e) {}
                }
            }));

            wsCleanups.push(createWebSocket({
                path: "/memory",
                token: result.token,
                containerCheck: () => document.body.contains(container),
                onMessage: (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        statsData.memory = data;
                        memoryInuseEl.textContent = formatBytes(data.inuse);
                    } catch (e) {}
                }
            }));
        }

        const style = E("style", {}, `
            .jc-cards-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:10px; margin-bottom:14px; }
            .jc-card { display:flex; flex-direction:column; padding:0.75em; border:1px solid var(--border-color-medium, #bfbfbf); border-radius:4px; }
            .jc-card-header { display:flex; align-items:center; gap:0.5em; margin-bottom:0.6em; font-size:1em; color:var(--text-color, inherit); opacity:0.78; }
            .jc-card-icon { display:inline-flex; align-items:center; justify-content:center; width:1.75em; height:1.75em; flex:0 0 1.75em; }
            .jc-card-icon-svg { width:100%; height:100%; stroke:currentColor; stroke-width:1; stroke-linecap:round; stroke-linejoin:round; }
            .jc-card-body { font-size:1.05em; font-weight:600; word-break:break-word; }
            .jc-stat-card-body { color:var(--text-color); font-family:monospace; }
            .jc-table { display:flex; flex-direction:column; width:100%; font-family:monospace; font-size:11px; }
            .flex-header { border-bottom:1px solid #e0e0e0; font-weight:bold; background-color:var(--background-color-medium, #f0f0f0); padding:4px 0; display:flex; line-height:1.2; align-items:center; }
            .flex-row { display:flex; padding:3px 0; border-bottom:1px solid transparent; align-items:center; }
            .flex-row:nth-child(even) { background:var(--background-color-medium, #fafafa); }
            .flex-row.clickable:hover { background-color:rgba(180,180,180,0.2); cursor:pointer; }
            [data-theme="dark"] .flex-row.clickable:hover { background-color:rgba(100,100,100,0.2); }
            .c-proto { flex:0 0 60px; max-width:70px; }
            .c-conn { flex:2 1 200px; }
            .c-host { flex:2 1 150px; }
            .c-chains { flex:0 0 140px; }
            .c-rule { flex:0 0 110px; }
            .show-mobile { display:none; }
            .no-data { justify-content:center; padding:20px; font-style:italic; color:#888; }
            .jc-json-terminal { width:100%; font-family:'Menlo','Consolas','Monaco',monospace; font-size:12px; line-height:1.4; white-space:pre-wrap; word-break:break-all; overflow-y:auto; background-color:#1e1e1e; color:#d4d4d4; border:1px solid #3c3c3c; border-radius:6px; padding:10px; margin:0; max-height:500px; }
            .jc-new-row { animation:jcFadeHighlight 2s ease; background-color:rgba(0, 200, 0, 0.15) !important; }
            @keyframes jcFadeHighlight { 0% { background-color:rgba(0, 200, 0, 0.35); } 100% { background-color:transparent; } }
            @media (max-width:900px) {
                .jc-cards-grid { grid-template-columns:repeat(2,1fr); }
                .flex-header { display:none; }
                .flex-row { flex-direction:column; align-items:flex-start; border:1px solid #ccc; border-radius:4px; margin-bottom:10px; padding:8px; background:var(--background-color-medium, #fff); }
                .flex-row > div { display:flex; width:100%; max-width:none; flex:1 1 auto; white-space:normal; padding:2px 0; }
                .hide-mobile { display:none !important; }
                .show-mobile { display:flex !important; }
                .flex-row > div::before { content:attr(data-label) ": "; font-weight:bold; color:#555; min-width:110px; display:inline-block; flex-shrink:0; }
                .c-proto, .c-host, .c-chains, .c-rule { flex:auto; max-width:none; }
            }
            @media (max-width:600px) { .jc-cards-grid { grid-template-columns:1fr; } }
        `);

        container.appendChild(style);
        return container;
    },

    leave: function () {
        cleanup();
    }
});
