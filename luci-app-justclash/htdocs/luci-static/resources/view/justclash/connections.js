"use strict";
"require view";
"require ui";
"require view.justclash.helper_clipboard as clipboard";
"require view.justclash.helper_luci_session as luciSession";
"require view.justclash.helper_common as common";
"require view.justclash.helper_mihomo_api as mihomoApi";
"require uci";

const ROW_HIGHLIGHT_TIMEOUT = 1000;
const DEFAULT_CONNECTIONS_INTERVAL = 1000;
const CONNECTIONS_INTERVAL_OPTIONS = [250, 500, 1000, 2000, 5000];

let wsCleanups = [];
let noConnectionsMsg = null;
let visibilityChangeHandler = null;
let beforeUnloadHandler = null;

const connectionsData = new Map();

const formatConnection = (conn) => ({
    src: conn.metadata.sourceIP + ":" + conn.metadata.sourcePort,
    dest: conn.metadata.destinationIP
        ? conn.metadata.destinationIP + ":" + conn.metadata.destinationPort
        : (conn.metadata.remoteDestination || "")
});

const cleanup = () => {
    wsCleanups.forEach(fn => fn());
    wsCleanups = [];
    if (visibilityChangeHandler) {
        document.removeEventListener("visibilitychange", visibilityChangeHandler);
        visibilityChangeHandler = null;
    }
    if (beforeUnloadHandler) {
        window.removeEventListener("beforeunload", beforeUnloadHandler);
        beforeUnloadHandler = null;
    }
    noConnectionsMsg = null;
    connectionsData.clear();
};

const normalizeFilterValue = (value) => String(value || "").trim().toLowerCase();
const buildNormalizedConnection = (conn) => {
    const metadata = conn?.metadata || {};
    const host = normalizeFilterValue(metadata.host);
    const sniffHost = normalizeFilterValue(metadata.sniffHost);
    const sourceIP = normalizeFilterValue(metadata.sourceIP);
    const endpointIP = normalizeFilterValue(metadata.destinationIP || metadata.remoteDestination);

    return {
        hostSniff: [host, sniffHost].filter(Boolean).join(" "),
        sourceEndpointIP: [sourceIP, endpointIP].filter(Boolean).join(" "),
        chains: normalizeFilterValue((conn?.chains || []).join(", ")),
        rule: normalizeFilterValue(conn?.rulePayload || conn?.rule)
    };
};

const renderIntervalOptionLabel = (interval) => interval >= 1000
    ? `${interval / 1000} s`
    : `${interval} ms`;
const setRowCloseButtonState = (button, isClosing) => {
    if (!button)
        return;

    button.disabled = isClosing;
    button.textContent = isClosing ? "..." : "X";
};

const showCloseAllConnectionsModal = (onConfirm) => {
    ui.showModal(_("Close all connections"), [
        E("p", _("Close all active connections?")),
        E("div", { class: "right", style: "margin-top: 10px;" }, [
            E("button", {
                class: "cbi-button cbi-button-negative",
                click: () => {
                    ui.hideModal();
                    onConfirm();
                }
            }, [_("Close all")]),
            E("button", {
                class: "cbi-button cbi-button-neutral",
                style: "margin-left: 5px;",
                click: ui.hideModal
            }, [_("Cancel")])
        ])
    ]);
};

const showConnectionDetails = (connId) => {
    const connData = connectionsData.get(connId);
    if (!connData) return;
    const jsonString = JSON.stringify(connData.raw, null, 2);

    ui.showModal(_("Connection details"), [
        E("div", { class: "json-viewer-container" }, [
            E("pre", { class: "jc-json-terminal" }, jsonString)
        ]),
        E("div", { class: "right", style: "margin-top: 10px;" }, [
            E("button", {
                class: "cbi-button cbi-button-action",
                click: async () => {
                    try {
                        await clipboard.copy(jsonString || "");
                        ui.addTimeLimitedNotification(null, E("p", _("Copied to clipboard")), common.notificationTimeout, "success");
                        ui.hideModal();
                    } catch (e) {
                        ui.addTimeLimitedNotification(_("Error"), E("p", `${e.message || e}`), common.notificationTimeout, "danger");
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
                E("p", _("Failed to load configuration") + ": " + (e.message || e)),
                "danger"
            );
            return { token: "", configLoadFailed: true };
        }
    },

    render: function (result) {
        cleanup();

        const container = E("div", { class: "cbi-section fade-in" });
        container.appendChild(E("h3", { class: "cbi-section-title" }, _("Active Connections")));

        let currentInterval = DEFAULT_CONNECTIONS_INTERVAL;
        let connectionsWsCleanup = null;
        const rowMap = new Map();
        const appliedFilters = {
            hostSniff: "",
            sourceEndpointIP: "",
            chains: "",
            rule: ""
        };

        const table = E("div", { class: "jc-table compact-table" });

        const header = E("div", { class: "flex-header" }, [
            E("div", { class: "c-proto" }, _("Proto")),
            E("div", { class: "c-conn" }, _("Connection")),
            E("div", { class: "c-host" }, _("Host/Sniff")),
            E("div", { class: "c-chains" }, _("Chains")),
            E("div", { class: "c-rule" }, _("Rule")),
            E("div", { class: "c-action" }, _("Action"))
        ]);

        const hostSniffFilterInput = E("input", {
            class: "cbi-input-text jc-filter-input",
            type: "text",
            placeholder: _("Host/Sniff")
        });
        const sourceEndpointIpFilterInput = E("input", {
            class: "cbi-input-text jc-filter-input",
            type: "text",
            placeholder: _("Source/Endpoint IP")
        });
        const chainsFilterInput = E("input", {
            class: "cbi-input-text jc-filter-input",
            type: "text",
            placeholder: _("Chains")
        });
        const ruleFilterInput = E("input", {
            class: "cbi-input-text jc-filter-input",
            type: "text",
            placeholder: _("Rule")
        });
        const filterActionBtn = E("button", {
            class: "cbi-button cbi-button-action",
            disabled: true
        }, _("Apply"));

        const intervalSelect = E("select", {
            class: "cbi-input-select jc-interval-select",
            id: "jcConnectionsInterval"
        }, CONNECTIONS_INTERVAL_OPTIONS.map((interval) =>
            E("option", {
                value: String(interval)
            }, renderIntervalOptionLabel(interval))
        ));
        intervalSelect.value = String(currentInterval);

        const closeAllBtn = E("button", {
            class: "cbi-button cbi-button-negative",
            click: () => showCloseAllConnectionsModal(async () => {
                closeAllBtn.disabled = true;

                try {
                    await mihomoApi.closeAllConnections(result.token);
                    ui.addTimeLimitedNotification(null, E("p", _("All active connections were closed")), common.notificationTimeout, "success");
                } catch (e) {
                    ui.addTimeLimitedNotification(_("Error"), E("p", `${e.message || e}`), common.notificationTimeout, "danger");
                    console.error("Failed to close all connections", e);
                } finally {
                    closeAllBtn.disabled = false;
                }
            })
        }, [_("Close all")]);

        if (result.configLoadFailed) {
            intervalSelect.disabled = true;
            closeAllBtn.disabled = true;
        }

        const actionBar = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions jc-connections-actions" }, [
                E("div", { class: "jc-interval-control" }, [
                    E("label", { class: "cbi-checkbox-label", for: "jcConnectionsInterval" }, _("Interval:")),
                    intervalSelect
                ]),
                closeAllBtn
            ])
        ]);

        const filterBar = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions jc-connections-filters" }, [
                sourceEndpointIpFilterInput,
                hostSniffFilterInput,
                chainsFilterInput,
                ruleFilterInput,
                filterActionBtn
            ])
        ]);

        container.appendChild(actionBar);
        container.appendChild(filterBar);
        table.appendChild(header);
        container.appendChild(table);

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
            row.appendChild(E("div", { class: "c-action c-action-cell", "data-label": _("Action") }, [
                E("button", {
                    class: "cbi-button cbi-button-neutral jc-connection-close",
                    title: _("Close connection"),
                    "aria-label": _("Close connection"),
                    click: async (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();

                        const btn = ev.currentTarget;
                        if (!btn || btn.disabled)
                            return;

                        setRowCloseButtonState(btn, true);

                        try {
                            await mihomoApi.closeConnection(key, result.token);
                            ui.addTimeLimitedNotification(null, E("p", _("Connection closed")), common.notificationTimeout, "success");
                        } catch (e) {
                            setRowCloseButtonState(btn, false);
                            ui.addTimeLimitedNotification(_("Error"), E("p", `${e.message || e}`), common.notificationTimeout, "danger");
                            console.error(`Failed to close connection ${key}`, e);
                        }
                    }
                }, ["X"])
            ]));
            return row;
        }

        function updateRow(conn) {
            const key = conn.id;
            connectionsData.set(key, {
                raw: conn,
                normalized: buildNormalizedConnection(conn)
            });
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
            const ruleStr = conn.rulePayload || conn.rule;
            const desktopConnStr = connObj.src + (connObj.dest ? " -> " + connObj.dest : "");

            const cells = row.childNodes;
            cells[0].textContent = conn.metadata.network ? conn.metadata.network.toUpperCase() : "";
            cells[1].textContent = desktopConnStr;
            cells[2].textContent = connObj.src;
            cells[3].textContent = connObj.dest;
            cells[4].textContent = hostStr;
            cells[5].textContent = chainsStr;
            cells[6].textContent = ruleStr;
            const actionButton = cells[7]?.querySelector("button");
            if (actionButton && !actionButton.disabled)
                setRowCloseButtonState(actionButton, false);

            if (isNew) highlightNewRow(row);
        }

        const matchesFilters = (connData) => {
            const normalized = connData?.normalized || {};

            if (appliedFilters.hostSniff && !normalized.hostSniff?.includes(appliedFilters.hostSniff))
                return false;
            if (appliedFilters.sourceEndpointIP && !normalized.sourceEndpointIP?.includes(appliedFilters.sourceEndpointIP))
                return false;
            if (appliedFilters.chains && !normalized.chains?.includes(appliedFilters.chains))
                return false;
            if (appliedFilters.rule && !normalized.rule?.includes(appliedFilters.rule))
                return false;

            return true;
        };

        const updateEmptyState = () => {
            if (noConnectionsMsg) {
                noConnectionsMsg.parentNode?.removeChild(noConnectionsMsg);
                noConnectionsMsg = null;
            }
        };

        const applyFilters = () => {
            for (const [key, row] of rowMap.entries()) {
                const connData = connectionsData.get(key);
                row.classList.toggle("jc-hidden-row", !matchesFilters(connData));
            }

            updateEmptyState();
        };

        const getDraftFilters = () => ({
            hostSniff: normalizeFilterValue(hostSniffFilterInput.value),
            sourceEndpointIP: normalizeFilterValue(sourceEndpointIpFilterInput.value),
            chains: normalizeFilterValue(chainsFilterInput.value),
            rule: normalizeFilterValue(ruleFilterInput.value)
        });

        const syncFilterButtons = () => {
            const draftFilters = getDraftFilters();
            const hasPendingChanges = Object.keys(appliedFilters).some((key) => draftFilters[key] !== appliedFilters[key]);
            const hasAppliedFilters = Object.values(appliedFilters).some(Boolean);

            filterActionBtn.disabled = !hasPendingChanges && !hasAppliedFilters;
            filterActionBtn.textContent = hasPendingChanges ? _("Apply") : _("Reset");
            filterActionBtn.className = `cbi-button ${hasPendingChanges ? "cbi-button-action" : "cbi-button-neutral"}`;
        };

        const applyDraftFilters = () => {
            const draftFilters = getDraftFilters();
            Object.assign(appliedFilters, draftFilters);
            applyFilters();
            syncFilterButtons();
        };

        const resetFilters = () => {
            hostSniffFilterInput.value = "";
            sourceEndpointIpFilterInput.value = "";
            chainsFilterInput.value = "";
            ruleFilterInput.value = "";
            Object.keys(appliedFilters).forEach((key) => {
                appliedFilters[key] = "";
            });
            applyFilters();
            syncFilterButtons();
        };

        const handleFilterAction = () => {
            const draftFilters = getDraftFilters();
            const hasPendingChanges = Object.keys(appliedFilters).some((key) => draftFilters[key] !== appliedFilters[key]);

            if (hasPendingChanges)
                applyDraftFilters();
            else
                resetFilters();
        };

        const handleConnectionsMessage = (event) => {
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

                applyFilters();
            } catch (e) {
                console.warn("WS parsing error:", e);
            }
        };

        const reconnectConnectionsSocket = async () => {
            if (connectionsWsCleanup)
                connectionsWsCleanup();

            if (document.hidden)
                return;

            if (!await luciSession.isSessionAlive())
                return;

            connectionsWsCleanup = mihomoApi.createConnectionsWebSocket({
                token: result.token,
                interval: currentInterval,
                containerCheck: () => document.body.contains(table),
                onMessage: handleConnectionsMessage
            });
        };

        const stopConnectionsSocket = () => {
            if (connectionsWsCleanup) {
                connectionsWsCleanup();
                connectionsWsCleanup = null;
            }
        };

        intervalSelect.addEventListener("change", () => {
            const nextInterval = Number(intervalSelect.value);

            if (!Number.isFinite(nextInterval) || nextInterval <= 0 || nextInterval === currentInterval)
                return;

            currentInterval = nextInterval;

            if (!result.configLoadFailed)
                reconnectConnectionsSocket();
        });

        [hostSniffFilterInput, sourceEndpointIpFilterInput, chainsFilterInput, ruleFilterInput].forEach((input) => {
            input.addEventListener("input", syncFilterButtons);
            input.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter" && !filterActionBtn.disabled)
                    handleFilterAction();
            });
        });
        filterActionBtn.addEventListener("click", handleFilterAction);
        syncFilterButtons();

        if (!result.configLoadFailed) {
            if (!document.hidden)
                reconnectConnectionsSocket();

            if (visibilityChangeHandler) {
                document.removeEventListener("visibilitychange", visibilityChangeHandler);
            }

            visibilityChangeHandler = () => {
                console.debug(`[connections] visibilitychange: ${document.hidden ? "hidden" : "visible"}`);
                if (document.hidden)
                    stopConnectionsSocket();
                else
                    reconnectConnectionsSocket();
            };

            document.addEventListener("visibilitychange", visibilityChangeHandler);

            if (beforeUnloadHandler)
                window.removeEventListener("beforeunload", beforeUnloadHandler);

            beforeUnloadHandler = () => {
                console.debug("[connections] beforeunload: cleanup");
                cleanup();
            };

            window.addEventListener("beforeunload", beforeUnloadHandler);
            wsCleanups.push(() => {
                stopConnectionsSocket();
            });
        }

        const style = E("style", {}, `
            .jc-table{display:flex;flex-direction:column;width:100%;font-family:monospace;font-size:11px;}
            .flex-header,.flex-row,.jc-connections-actions,.jc-connections-filters,.jc-interval-control,.c-action{display:flex;align-items:center;}
            .flex-header{border-bottom:1px solid #e0e0e0;font-weight:bold;background-color:var(--background-color-medium, #f0f0f0);padding:4px 0;line-height:1.2;}
            .flex-row{padding:3px 0;border-bottom:1px solid transparent;}
            .flex-row:nth-child(even){background:var(--background-color-medium, #fafafa);}
            .flex-row.clickable:hover{background-color:rgba(180,180,180,.2);cursor:pointer;}
            [data-theme="dark"] .flex-row.clickable:hover{background-color:rgba(100,100,100,.2);}
            .jc-actions-wrap{padding:.7em .8em;border:1px solid var(--border-color-medium, #d9d9d9);border-radius:6px;background:var(--background-color-medium, #f6f6f6);margin-bottom:12px;}
            .jc-primary-actions{display:flex;flex-wrap:wrap;gap:.65em;margin:0;}
            .jc-primary-actions .cbi-button{margin:0 !important;}
            .jc-connections-actions{justify-content:space-between;}
            .jc-interval-control{gap:10px;flex-wrap:wrap;}
            .jc-interval-select{width:auto;min-width:180px;margin:0;}
            .jc-filter-input{flex:1 1 180px;min-width:160px;margin:0;}
            .c-proto{flex:0 0 60px;max-width:70px;}
            .c-conn{flex:2 1 200px;}
            .c-host{flex:2 1 150px;}
            .c-chains{flex:0 0 140px;}
            .c-rule{flex:0 0 110px;}
            .c-action{flex:0 0 44px;justify-content:flex-end;}
            .c-action-cell{padding-right:4px;}
            .jc-connection-close{min-width:20px;width:20px;height:20px;padding:0;display:inline-flex;align-items:center;justify-content:center;font-weight:700;line-height:1;}
            .show-mobile{display:none;}
            .jc-hidden-row{display:none !important;}
            .no-data{justify-content:center;padding:20px;font-style:italic;color:#888;}
            .jc-json-terminal{width:100%;font-family:'Menlo','Consolas','Monaco',monospace;font-size:12px;line-height:1.4;white-space:pre-wrap;word-break:break-all;overflow-y:auto;background-color:#1e1e1e;color:#d4d4d4;border:1px solid #3c3c3c;border-radius:6px;padding:10px;margin:0;max-height:500px;}
            .jc-new-row{animation:jcFadeHighlight 2s ease;background-color:rgba(126, 231, 135, .12) !important;}
            @keyframes jcFadeHighlight{0%{background-color:rgba(126, 231, 135, .24);}100%{background-color:transparent;}}
            [data-theme="dark"] .jc-actions-wrap{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.04);}
            @media (max-width:900px){.flex-header{display:none;}.flex-row{flex-direction:column;align-items:flex-start;border:1px solid #ccc;border-radius:4px;margin-bottom:10px;padding:8px;background:var(--background-color-medium, #fff);}.flex-row > div{display:flex;width:100%;max-width:none;flex:1 1 auto;white-space:normal;padding:2px 0;}.jc-connections-actions{justify-content:flex-start;}.jc-connections-filters{justify-content:stretch;}.hide-mobile{display:none !important;}.show-mobile{display:flex !important;}.flex-row > div::before{content:attr(data-label) ": ";font-weight:bold;color:#555;min-width:110px;display:inline-block;flex-shrink:0;}.c-proto,.c-host,.c-chains,.c-rule,.c-action{flex:auto;max-width:none;}.c-action{justify-content:flex-start;}.c-action-cell{padding-right:0;}.jc-connection-close{margin-top:4px;}.jc-filter-input{min-width:100%;}}
        `);

        container.appendChild(style);
        return container;
    }
});
