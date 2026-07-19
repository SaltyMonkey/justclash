"use strict";
"require view";
"require ui";
"require view.justclash.helper_clipboard as clipboard";
"require view.justclash.helper_ubus as luciSession";
"require view.justclash.helper_common as common";
"require view.justclash.helper_mihomo_api as mihomoApi";
"require uci";

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
    button.textContent = isClosing ? "…" : "×";
};

const showCloseAllConnectionsModal = (onConfirm) => {
    ui.showModal(_("Close all connections"), [
        E("p", _("Close all active connections?")),
        E("div", { class: "jc-modal-actions" }, [
            E("button", {
                class: "cbi-button cbi-button-negative",
                click: () => {
                    ui.hideModal();
                    onConfirm();
                }
            }, [_("Close all")]),
            E("button", {
                class: "cbi-button cbi-button-neutral",
                click: ui.hideModal
            }, [_("Cancel")])
        ])
    ]);
};

const showConnectionDetails = (connId) => {
    const connData = connectionsData.get(connId);
    if (!connData) return;
    const jsonString = JSON.stringify(connData.raw, null, 2);

    const createModalCopyBtn = (isJson) => E("button", {
        class: "cbi-button cbi-button-action",
        style: isJson ? "margin-left: 0.3125rem;" : "",
        click: async () => {
            try {
                const content = isJson ? jsonString : common.formatConnectionSummary(connData.raw);
                await clipboard.copy(content || "");
                ui.hideModal();
            } catch (e) {
                ui.addTimeLimitedNotification(_("Error"), E("p", `${e.message || e}`), common.notificationTimeout, "danger");
                console.error("Failed to copy connection details to clipboard", e);
            }
        }
    }, [isJson ? _("Copy JSON") : _("Copy Summary")]);

    ui.showModal(_("Connection details"), [
        E("pre", { class: "jc-modal-pre" }, jsonString),
        E("div", { class: "jc-modal-actions" }, [
            createModalCopyBtn(false),
            createModalCopyBtn(true),
            E("button", {
                class: "cbi-button",
                style: "margin-left: 0.3125rem;",
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
            await uci.load(common.binName);
            const token = uci.get(common.binName, "proxy", "api_password") || "";
            mihomoApi.setTls(uci.get(common.binName, "proxy", "api_tls") === "1");
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
        container.appendChild(E("div", { class: "cbi-section-descr" }, _("Monitor and manage active network connections established through Mihomo.")));

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

        const intervalChoices = {};
        CONNECTIONS_INTERVAL_OPTIONS.forEach((interval) => {
            intervalChoices[String(interval)] = renderIntervalOptionLabel(interval);
        });

        const intervalDropdown = new ui.Dropdown(String(currentInterval), intervalChoices, {
            sort: false,
            optional: false
        });
        const intervalDropdownNode = intervalDropdown.render();
        intervalDropdownNode.id = "jcConnectionsInterval";
        intervalDropdownNode.classList.add("jc-interval-select");

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

        const createCopyBtn = (isJson) => E("button", {
            class: "cbi-button cbi-button-action",
            click: async () => {
                const conns = [];
                connectionsData.forEach((connData) => {
                    if (matchesFilters(connData)) {
                        conns.push(connData.raw);
                    }
                });
                if (!conns.length) {
                    ui.addTimeLimitedNotification(null, E("p", _("No active connections to copy")), common.notificationTimeout, "warning");
                    return;
                }
                try {
                    const content = isJson
                        ? JSON.stringify(conns, null, 2)
                        : conns.map(conn => common.formatConnectionSummary(conn)).join("\n\n" + "=".repeat(40) + "\n\n");
                    await clipboard.copy(content);
                } catch (e) {
                    ui.addTimeLimitedNotification(_("Error"), E("p", `${e.message || e}`), common.notificationTimeout, "danger");
                    console.error("Failed to copy connections to clipboard", e);
                }
            }
        }, [isJson ? _("Copy JSON") : _("Copy Text")]);

        const copyTextBtn = createCopyBtn(false);
        const copyJsonBtn = createCopyBtn(true);

        if (result.configLoadFailed) {
            intervalDropdownNode.setAttribute("disabled", "disabled");
            closeAllBtn.disabled = true;
            copyTextBtn.disabled = true;
            copyJsonBtn.disabled = true;
        }

        const actionBar = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions jc-connections-actions" }, [
                E("div", { class: "jc-left-group" }, [
                    E("div", { class: "jc-interval-control" }, [
                        E("label", { class: "cbi-checkbox-label", for: "jcConnectionsInterval" }, _("Interval:")),
                        intervalDropdownNode
                    ]),
                    copyTextBtn,
                    copyJsonBtn
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
                    class: "jc-connection-close",
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
                }, ["×"])
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

            if (!row) {
                row = createRow(conn);
                table.appendChild(row);
                rowMap.set(key, row);
            }

            const connObj = formatConnection(conn);
            const hostStr = [conn.metadata.host, conn.metadata.sniffHost].filter(Boolean).join(", ");
            const desktopConnStr = connObj.src + (connObj.dest ? " -> " + connObj.dest : "");

            const cells = row.childNodes;

            const protoSpan = E("span", {
                class: "jc-badge-proto " + String(conn.metadata.network || "").toLowerCase()
            }, (conn.metadata.network || "").toUpperCase());
            cells[0].replaceChildren(protoSpan);

            cells[1].textContent = desktopConnStr;
            cells[2].textContent = connObj.src;
            cells[3].textContent = connObj.dest;
            cells[4].textContent = hostStr;

            const chainNodes = [];
            (conn.chains || []).forEach((chainItem, index) => {
                if (index > 0) {
                    chainNodes.push(E("span", { class: "jc-chain-arrow" }, " → "));
                }
                const isLast = index === conn.chains.length - 1;
                chainNodes.push(E("span", {
                    class: isLast ? "jc-badge-builtin jc-badge-chain-last" : "jc-badge-builtin jc-badge-chain"
                }, chainItem));
            });
            cells[5].replaceChildren(...chainNodes);

            const ruleNodes = [];
            const ruleText = conn.rulePayload || conn.rule;
            if (ruleText) {
                ruleNodes.push(E("span", {
                    class: "jc-badge-rule"
                }, ruleText));
            }
            cells[6].replaceChildren(...ruleNodes);

            const actionButton = cells[7]?.querySelector("button");
            if (actionButton && !actionButton.disabled)
                setRowCloseButtonState(actionButton, false);
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
                const fragment = document.createDocumentFragment();

                for (const conn of conns) {
                    seenKeys.add(conn.id);

                    const key = conn.id;
                    connectionsData.set(key, {
                        raw: conn,
                        normalized: buildNormalizedConnection(conn)
                    });
                    let row = rowMap.get(key);
                    const isNew = !row;

                    if (isNew) {
                        row = createRow(conn);
                        rowMap.set(key, row);
                    }

                    const connObj = formatConnection(conn);
                    const hostStr = [conn.metadata.host, conn.metadata.sniffHost].filter(Boolean).join(", ");
                    const desktopConnStr = connObj.src + (connObj.dest ? " -> " + connObj.dest : "");

                    const cells = row.childNodes;

                    const protoSpan = E("span", {
                        class: "jc-badge-proto " + String(conn.metadata.network || "").toLowerCase()
                    }, (conn.metadata.network || "").toUpperCase());
                    cells[0].replaceChildren(protoSpan);

                    cells[1].textContent = desktopConnStr;
                    cells[2].textContent = connObj.src;
                    cells[3].textContent = connObj.dest;
                    cells[4].textContent = hostStr;

                    const chainNodes = [];
                    (conn.chains || []).forEach((chainItem, index) => {
                        if (index > 0) {
                            chainNodes.push(E("span", { class: "jc-chain-arrow" }, " → "));
                        }
                        const isLast = index === conn.chains.length - 1;
                        chainNodes.push(E("span", {
                            class: isLast ? "jc-badge-builtin jc-badge-chain-last" : "jc-badge-builtin jc-badge-chain"
                        }, chainItem));
                    });
                    cells[5].replaceChildren(...chainNodes);

                    const ruleNodes = [];
                    const ruleText = conn.rulePayload || conn.rule;
                    if (ruleText) {
                        ruleNodes.push(E("span", {
                            class: "jc-badge-rule"
                        }, ruleText));
                    }
                    cells[6].replaceChildren(...ruleNodes);

                    const actionButton = cells[7]?.querySelector("button");
                    if (actionButton && !actionButton.disabled)
                        setRowCloseButtonState(actionButton, false);

                    if (isNew)
                        fragment.appendChild(row);
                }

                for (const key of rowMap.keys()) {
                    if (!seenKeys.has(key)) {
                        const row = rowMap.get(key);
                        if (row.parentNode) row.parentNode.removeChild(row);
                        rowMap.delete(key);
                        connectionsData.delete(key);
                    }
                }

                if (fragment.childNodes.length)
                    table.appendChild(fragment);

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

        intervalDropdownNode.addEventListener("cbi-dropdown-change", () => {
            const nextInterval = Number(intervalDropdown.getValue());

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
            .jc-table{display:flex;flex-direction:column;width:100%;font-size:0.9em;border:1px solid var(--border-color-medium, #d9d9d9);border-radius:0.5rem;overflow:hidden;background-color:var(--background-color-low, #fff);margin-bottom:1rem;}
            [data-theme="dark"] .jc-table{background-color:rgba(0,0,0,.1);}
            .flex-header,.flex-row{display:grid;grid-template-columns:4rem minmax(0, 1.5fr) minmax(0, 1.5fr) minmax(0, 0.6fr) minmax(0, 0.6fr) 3rem;align-items:center;}
            .jc-connections-actions,.jc-connections-filters,.jc-interval-control,.c-action{display:flex;align-items:center;}
            .flex-header{border-bottom:1px solid var(--border-color-medium, #d9d9d9);font-weight:bold;background-color:var(--background-color-medium, #f6f6f6);padding:0.25rem 0.9375rem;}
            .flex-row{padding:0.1875rem 0.9375rem;border-bottom:1px solid transparent;transition:background-color .15s ease;}
            .flex-row:nth-child(odd){background:var(--background-color-medium, #fafafa);}
            .flex-row.clickable:hover{background-color:rgba(180,180,180,.2);cursor:pointer;}
            [data-theme="dark"] .flex-row.clickable:hover{background-color:rgba(100,100,100,.2);}
            .jc-actions-wrap{padding:.7em .8em;border:1px solid var(--border-color-medium, #d9d9d9);border-radius:0.375rem;background:var(--background-color-medium, #f6f6f6);margin-bottom:0.75rem;}
            .jc-primary-actions{display:flex;flex-wrap:wrap;gap:.65em;margin:0;}
            .jc-left-group{display:flex;gap:.65em;align-items:center;flex-wrap:wrap;}
            .jc-connections-actions{justify-content:space-between;}
            .jc-interval-control{gap:0.625rem;flex-wrap:wrap;}
            .jc-interval-select{width:auto;min-width:11.25rem;margin:0;}
            .jc-filter-input{flex:1 1 11.25rem;min-width:10rem;margin:0;}
            .flex-header > div, .flex-row > div { min-width: 0; word-break: break-all; }
            .c-action{justify-content:flex-end;}
            .c-action-cell{padding-right:0.25rem;}
            .jc-connection-close{appearance:none;background:none;border:1px solid var(--border-color-medium, #d9d9d9);border-radius:0.375rem;min-width:1.75rem;width:1.75rem;height:1.75rem;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:1.1em;font-weight:700;line-height:1;color:var(--error-color-medium, #f44336);cursor:pointer;transition:background-color .15s ease, border-color .15s ease;}
            .jc-connection-close:hover:not(:disabled){background-color:rgba(203,10,18,.1);border-color:var(--error-color-medium, #f44336);}
            .jc-connection-close:active:not(:disabled){background-color:rgba(203,10,18,.2);}
            .jc-connection-close:disabled{opacity:.4;cursor:default;}
            .show-mobile{display:none;}
            .jc-hidden-row{display:none !important;}
            .jc-modal-pre{max-height:28rem;overflow:auto;font-weight:normal;font-family:ui-monospace,monospace;}
            .jc-modal-actions{text-align:right;margin-top:0.625rem;}
            .jc-modal-actions .cbi-button+.cbi-button{margin-left:0.3125rem;}
            [data-theme="dark"] .jc-actions-wrap{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.04);}
            [data-theme="dark"] .jc-connection-close{border-color:rgba(255,255,255,.12);}
            .jc-badge-proto,.jc-badge-builtin,.jc-badge-rule{display:inline-block;padding:0.12rem 0.55rem;border-radius:9999px;font-size:0.8em;font-weight:bold;text-transform:uppercase;line-height:1.2;box-sizing:border-box;}
            .jc-badge-proto{min-width:2.6rem;text-align:center;background-color:var(--background-color-medium, #f6f6f6);color:var(--text-color-medium, #888);border:1px solid var(--border-color-medium, #d9d9d9);}
            .jc-badge-builtin{background-color:rgba(0,0,0,0.05);color:var(--text-color-medium, #888);border:1px solid transparent;font-weight:500;text-transform:none;}
            .jc-badge-chain-last{background-color:rgba(79,140,255,.12);color:var(--primary-color-medium, #4f8cff);border:1px solid rgba(79,140,255,.25);font-weight:600;}
            .jc-chain-arrow{color:var(--text-color-medium, #888);opacity:.6;margin:0 0.15rem;font-size:0.8em;}
            .jc-badge-rule{margin-right:0.375rem;background-color:rgba(253,126,20,.1);color:var(--warning-color-medium, #fd7e14);border:1px solid rgba(253,126,20,.2);min-width:5rem;text-align:center;text-transform:none;border-radius:0.25rem;}
            [data-theme="dark"] .jc-badge-builtin{background-color:rgba(255,255,255,.08);color:rgba(255,255,255,.85);border-color:transparent;}
            [data-theme="dark"] .jc-badge-builtin.jc-badge-chain-last{background-color:rgba(79,140,255,.2);color:#689fff;border-color:rgba(79,140,255,.35);}
            [data-theme="dark"] .jc-chain-arrow{color:rgba(255,255,255,.5);}
            @media (max-width:56rem){
                .jc-table{font-size:1em;}
                .flex-header{display:none;}
                .flex-row{display:flex;flex-direction:column;align-items:flex-start;padding:1rem;border-bottom:1px solid var(--border-color-medium, #d9d9d9);}
                .flex-row:last-child{border-bottom:none;}
                .flex-row>div{display:flex;flex-direction:column;align-items:flex-start;width:100%;max-width:none;white-space:normal;padding:0;margin-bottom:0.625rem;}
                .flex-row>div:last-child{margin-bottom:0;}
                .flex-row>div::before{content:attr(data-label);font-size:0.8em;font-weight:bold;color:var(--text-color-medium, #888);margin-bottom:0.25rem;text-transform:uppercase;display:inline-block;}
                .flex-row>.c-action{align-items:flex-end;margin-top:0.3125rem;margin-bottom:0;}
                .flex-row>.c-action::before{display:none;}
                .jc-connections-actions{justify-content:flex-start;}
                .jc-connections-filters{justify-content:stretch;}
                .hide-mobile{display:none !important;}
                .show-mobile{display:flex !important;}
                .c-proto,.c-host,.c-chains,.c-rule,.c-action{flex:auto;max-width:none;}
                .c-action-cell{padding-right:0;}
                .jc-connection-close{margin-top:0.25rem;}
                .jc-filter-input{min-width:100%;}
            }
        `);

        container.appendChild(style);
        return container;
    }
});
