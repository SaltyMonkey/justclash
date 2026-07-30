"use strict";
"require view";
"require ui";
"require view.justclash.lib.clipboard as clipboard";
"require view.justclash.common as common";
"require view.justclash.api.mihomo as mihomoApi";
"require view.justclash.lib.connections as connectionsModel";
"require view.justclash.lib.socket as socketRuntime";
"require uci";

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
        let connectionsSocket = null;
        let noConnectionsMsg = null;
        let visibilityChangeHandler = null;
        let beforeUnloadHandler = null;

        const connectionsData = new Map();

        const cleanup = () => {
            connectionsSocket?.stop();
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

        const container = E("div", { class: "cbi-section fade-in" });
        container.appendChild(E("h3", { class: "cbi-section-title" }, _("Active Connections")));
        container.appendChild(E("div", { class: "cbi-section-descr" }, _("Monitor and manage active network connections established through Mihomo.")));

        let currentInterval = connectionsModel.DEFAULT_INTERVAL;
        const rowMap = new Map();
        const appliedFilters = {
            hostSniff: "",
            sourceEndpointIP: "",
            chains: "",
            rule: ""
        };

        const table = E("div", { class: "jc-table jc-compact-table" });

        const header = E("div", { class: "jc-flex-header" }, [
            E("div", { class: "jc-c-proto" }, _("Proto")),
            E("div", { class: "jc-c-conn" }, _("Connection")),
            E("div", { class: "jc-c-host" }, _("Host/Sniff")),
            E("div", { class: "jc-c-chains" }, _("Chains")),
            E("div", { class: "jc-c-rule" }, _("Rule")),
            E("div", { class: "jc-c-action" }, _("Action"))
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
        connectionsModel.INTERVAL_OPTIONS.forEach((interval) => {
            intervalChoices[String(interval)] = connectionsModel.formatIntervalLabel(interval);
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
                    if (connectionsModel.matchesFilters(connData.normalized, appliedFilters)) {
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
            const row = E("div", { class: "jc-flex-row jc-clickable", "data-key": key, click: () => showConnectionDetails(key) });
            row.appendChild(E("div", { class: "jc-c-proto", "data-label": _("Proto") }, ""));
            row.appendChild(E("div", { class: "jc-c-conn jc-hide-mobile", "data-label": _("Connection") }, ""));
            row.appendChild(E("div", { class: "jc-c-src jc-show-mobile", "data-label": _("Source") }, ""));
            row.appendChild(E("div", { class: "jc-c-dest jc-show-mobile", "data-label": _("Destination") }, ""));
            row.appendChild(E("div", { class: "jc-c-host", "data-label": _("Host/Sniff") }, ""));
            row.appendChild(E("div", { class: "jc-c-chains", "data-label": _("Chains") }, ""));
            row.appendChild(E("div", { class: "jc-c-rule", "data-label": _("Rule") }, ""));
            row.appendChild(E("div", { class: "jc-c-action jc-c-action-cell", "data-label": _("Action") }, [
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

        function updateRow(conn, appendTarget = table) {
            const key = conn.id;
            connectionsData.set(key, {
                raw: conn,
                normalized: connectionsModel.normalizeConnection(conn)
            });
            let row = rowMap.get(key);

            if (!row) {
                row = createRow(conn);
                appendTarget.appendChild(row);
                rowMap.set(key, row);
            }

            const metadata = conn.metadata || {};
            const connObj = connectionsModel.formatEndpoints(conn);
            const hostStr = [metadata.host, metadata.sniffHost].filter(Boolean).join(", ");
            const desktopConnStr = connObj.src + (connObj.dest ? " -> " + connObj.dest : "");

            const cells = row.childNodes;

            const protoSpan = E("span", {
                class: "jc-badge-proto " + String(metadata.network || "").toLowerCase()
            }, (metadata.network || "").toUpperCase());
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

        const updateEmptyState = () => {
            if (noConnectionsMsg) {
                noConnectionsMsg.parentNode?.removeChild(noConnectionsMsg);
                noConnectionsMsg = null;
            }
        };

        const applyFilters = () => {
            for (const [key, row] of rowMap.entries()) {
                const connData = connectionsData.get(key);
                row.classList.toggle("jc-hidden-row", !connectionsModel.matchesFilters(connData?.normalized, appliedFilters));
            }

            updateEmptyState();
        };

        const getDraftFilters = () => ({
            hostSniff: connectionsModel.normalizeFilterValue(hostSniffFilterInput.value),
            sourceEndpointIP: connectionsModel.normalizeFilterValue(sourceEndpointIpFilterInput.value),
            chains: connectionsModel.normalizeFilterValue(chainsFilterInput.value),
            rule: connectionsModel.normalizeFilterValue(ruleFilterInput.value)
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
                    if (!conn?.id)
                        continue;

                    seenKeys.add(conn.id);
                    updateRow(conn, fragment);
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

        connectionsSocket = socketRuntime.createConnector({
            isMounted: () => document.body.contains(table),
            onInactive: cleanup,
            open: ({ guard }) => mihomoApi.createConnectionsWebSocket({
                    token: result.token,
                    interval: currentInterval,
                    containerCheck: () => document.body.contains(table),
                    onMessage: guard(handleConnectionsMessage)
                })
        });

        const reconnectConnectionsSocket = () => connectionsSocket.connect();

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
            requestAnimationFrame(() => {
                if (!document.hidden)
                    reconnectConnectionsSocket();
            });

            if (visibilityChangeHandler) {
                document.removeEventListener("visibilitychange", visibilityChangeHandler);
            }

            visibilityChangeHandler = () => {
                console.debug(`[connections] visibilitychange: ${document.hidden ? "hidden" : "visible"}`);
                if (document.hidden)
                    connectionsSocket.stop();
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
        }

        const style = E("style", {}, `
            .jc-table{display:flex;flex-direction:column;width:100%;font-size:0.9em;border:1px solid var(--border-color-medium, #d9d9d9);border-radius:0.5rem;overflow:hidden;background-color:var(--background-color-low, #fff);margin-bottom:1rem;}
            :root[data-darkmode="true"] .jc-table{background-color:var(--background-color-low, rgba(0,0,0,.1));}
            .jc-flex-header,.jc-flex-row{display:grid;grid-template-columns:4rem minmax(0, 1.5fr) minmax(0, 1.5fr) minmax(0, 0.6fr) minmax(0, 0.6fr) 3rem;align-items:center;}
            .jc-connections-actions,.jc-connections-filters,.jc-interval-control,.jc-c-action{display:flex;align-items:center;}
            .jc-flex-header{border-bottom:1px solid var(--border-color-medium, #d9d9d9);font-weight:bold;background-color:var(--background-color-medium, #f6f6f6);padding:0.25rem 0.9375rem;}
            .jc-flex-row{padding:0.1875rem 0.9375rem;border-bottom:1px solid transparent;transition:background-color .15s ease;}
            .jc-flex-row:nth-child(odd){background:var(--background-color-medium, #fafafa);}
            .jc-flex-row.jc-clickable:hover{background-color:var(--background-color-high, rgba(180,180,180,.2));cursor:pointer;}
            :root[data-darkmode="true"] .jc-flex-row.jc-clickable:hover{background-color:var(--background-color-high, rgba(100,100,100,.2));}
            .jc-actions-wrap{padding:.7em .8em;border:1px solid var(--border-color-medium, #d9d9d9);border-radius:0.375rem;background:var(--background-color-medium, #f6f6f6);margin-bottom:0.75rem;}
            .jc-primary-actions{display:flex;flex-wrap:wrap;gap:.65em;margin:0;}
            .jc-left-group{display:flex;gap:.65em;align-items:center;flex-wrap:wrap;}
            .jc-connections-actions{justify-content:space-between;}
            .jc-interval-control{gap:0.625rem;flex-wrap:wrap;}
            .jc-interval-select{width:auto;min-width:11.25rem;margin:0;}
            .jc-filter-input{flex:1 1 11.25rem;min-width:10rem;margin:0;}
            .jc-flex-header > div, .jc-flex-row > div { min-width: 0; word-break: break-all; }
            .jc-c-action{justify-content:flex-end;}
            .jc-c-action-cell{padding-right:0.25rem;}
            .jc-connection-close{appearance:none;background:none;border:1px solid var(--border-color-medium, #d9d9d9);border-radius:0.375rem;min-width:1.75rem;width:1.75rem;height:1.75rem;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:1.1em;font-weight:700;line-height:1;color:var(--error-color-medium, #f44336);cursor:pointer;transition:background-color .15s ease, border-color .15s ease;}
            .jc-connection-close:hover:not(:disabled){background-color:color-mix(in srgb, var(--error-color-medium, #f44336) 10%, transparent);border-color:var(--error-color-medium, #f44336);}
            .jc-connection-close:active:not(:disabled){background-color:color-mix(in srgb, var(--error-color-medium, #f44336) 20%, transparent);}
            .jc-connection-close:disabled{opacity:.4;cursor:default;}
            .jc-show-mobile{display:none;}
            .jc-hidden-row{display:none !important;}
            .jc-modal-pre{max-height:28rem;overflow:auto;font-weight:normal;font-family:ui-monospace,monospace;}
            .jc-modal-actions{text-align:right;margin-top:0.625rem;}
            .jc-modal-actions .cbi-button+.cbi-button{margin-left:0.3125rem;}
            :root[data-darkmode="true"] .jc-actions-wrap{border-color:var(--border-color-medium, rgba(255,255,255,.08));background:var(--background-color-high, rgba(255,255,255,.04));}
            :root[data-darkmode="true"] .jc-connection-close{border-color:var(--border-color-medium, rgba(255,255,255,.12));}
            .jc-badge-proto,.jc-badge-builtin,.jc-badge-rule{display:inline-block;padding:0.12rem 0.55rem;border-radius:9999px;font-size:0.8em;font-weight:bold;text-transform:uppercase;line-height:1.2;box-sizing:border-box;}
            .jc-badge-proto{min-width:2.6rem;text-align:center;background-color:var(--background-color-medium, #f6f6f6);color:var(--text-color-medium, #888);border:1px solid var(--border-color-medium, #d9d9d9);}
            .jc-badge-builtin{background-color:var(--background-color-high, rgba(0,0,0,0.05));color:var(--text-color-medium, #888);border:1px solid transparent;font-weight:500;text-transform:none;}
            .jc-badge-chain-last{background-color:color-mix(in srgb, var(--primary-color-medium, #4f8cff) 12%, transparent);color:var(--primary-color-medium, #4f8cff);border:1px solid color-mix(in srgb, var(--primary-color-medium, #4f8cff) 25%, transparent);font-weight:600;}
            .jc-badge-chain{border-color:var(--border-color-medium, #d9d9d9);}
            .jc-chain-arrow{color:var(--text-color-medium, #888);opacity:.6;margin:0 0.15rem;font-size:0.8em;}
            .jc-badge-rule{margin-right:0.375rem;background-color:color-mix(in srgb, var(--warn-color-medium, #fd7e14) 10%, transparent);color:var(--warn-color-medium, #fd7e14);border:1px solid color-mix(in srgb, var(--warn-color-medium, #fd7e14) 20%, transparent);min-width:5rem;text-align:center;text-transform:none;border-radius:0.25rem;}
            :root[data-darkmode="true"] .jc-badge-builtin{background-color:rgba(255,255,255,.06);color:var(--text-color-high, rgba(255,255,255,.85));border-color:transparent;}
            :root[data-darkmode="true"] .jc-badge-builtin.jc-badge-chain{background-color:rgba(255,255,255,.08);border-color:rgba(255,255,255,.18);}
            :root[data-darkmode="true"] .jc-badge-builtin.jc-badge-chain-last{background-color:color-mix(in srgb, var(--primary-color-medium, #689fff) 20%, transparent);color:var(--primary-color-medium, #689fff);border-color:color-mix(in srgb, var(--primary-color-medium, #689fff) 35%, transparent);}
            :root[data-darkmode="true"] .jc-chain-arrow{color:rgba(255,255,255,.5);}
            @media (max-width:56rem){
                .jc-table{font-size:1em;}
                .jc-flex-header{display:none;}
                .jc-flex-row{display:flex;flex-direction:column;align-items:flex-start;padding:1rem;border-bottom:1px solid var(--border-color-medium, #d9d9d9);}
                .jc-flex-row:last-child{border-bottom:none;}
                .jc-flex-row>div{display:flex;flex-direction:column;align-items:flex-start;width:100%;max-width:none;white-space:normal;padding:0;margin-bottom:0.625rem;}
                .jc-flex-row>div:last-child{margin-bottom:0;}
                .jc-flex-row>div::before{content:attr(data-label);font-size:0.8em;font-weight:bold;color:var(--text-color-medium, #888);margin-bottom:0.25rem;text-transform:uppercase;display:inline-block;}
                .jc-flex-row>.jc-c-action{align-items:flex-end;margin-top:0.3125rem;margin-bottom:0;}
                .jc-flex-row>.jc-c-action::before{display:none;}
                .jc-connections-actions{justify-content:flex-start;}
                .jc-connections-filters{justify-content:stretch;}
                .jc-hide-mobile{display:none !important;}
                .jc-show-mobile{display:flex !important;}
                .jc-c-proto,.jc-c-host,.jc-c-chains,.jc-c-rule,.jc-c-action{flex:auto;max-width:none;}
                .jc-c-action-cell{padding-right:0;}
                .jc-connection-close{margin-top:0.25rem;}
                .jc-filter-input{min-width:100%;}
            }
        `);

        container.appendChild(style);
        return container;
    }
});
