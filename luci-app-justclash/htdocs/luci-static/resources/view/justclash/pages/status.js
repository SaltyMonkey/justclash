"use strict";
"require ui";
"require view";
"require uci";
"require view.justclash.api.ubus as ubusApi";
"require view.justclash.common as common";
"require view.justclash.api.mihomo as mihomoApi";
"require view.justclash.lib.status_actions as statusActions";
"require view.justclash.lib.status_runtime as statusRuntime";

const ACTION_DELAY_TIMEOUT = 5000;
const actions = statusActions.create({
    notificationTimeout: common.notificationTimeout
});

const buttonsIDs = {
    START: "button-start",
    RESTART: "button-restart",
    DIAGNOSTIC: "button-diagnostic",
    UPDATE: "button-core-update",
    UPDATE_RULESETS: "button-rulesets-update",
    SERVICE_DATA_UPDATE: "button-service-data",
    MIHOMO_CONFIG: "button-mihomo-config",
    SERVICE_CONFIG: "button-service-config"
};

const buttons = {
    POSITIVE: "cbi-button-positive",
    NEGATIVE: "cbi-button-negative",
    NEUTRAL: "cbi-button-neutral",
    ACTION: "cbi-button-action"
};

const asyncTimeout = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const boolToWordAutostart = (val) => val ? _("Enabled") : _("Disabled");
const boolToWordRunning = (val) => val ? _("Running") : _("Stopped");

const createActionButton = (action, cssClass, label, handler) =>
    E("button", {
        class: `cbi-button ${cssClass}`,
        id: action,
        click: handler,
        title: label,
        "aria-label": label
    }, [
        E("span", { class: "jc-button-content" }, [
            E("span", { class: "jc-button-label" }, label)
        ])
    ]);

const formatSpeed = (bytesPerSec) => common.formatBytes(bytesPerSec) + "/s";

const createSummaryRow = (label, valueNode, extraNode) => {
    const valueChildren = [valueNode];
    if (extraNode)
        valueChildren.push(extraNode);

    return E("div", { class: "jc-summary-row" }, [
        E("span", { class: "jc-summary-key" }, label),
        E("span", { class: "jc-summary-value" }, valueChildren)
    ]);
};

const createSummaryCard = (title, rows) => {
    return E("div", { class: "jc-card" }, [
        E("strong", { class: "jc-card-title" }, title),
        E("div", { class: "jc-summary-body" }, rows)
    ]);
};

const createInlineTrafficNode = (upNode, downNode) => E("span", { class: "jc-traffic-inline" }, [
    E("span", { class: "jc-traffic-item jc-traffic-up" }, [
        E("span", { class: "jc-traffic-arrow" }, "↑"),
        upNode
    ]),
    E("span", { class: "jc-traffic-sep" }, "/"),
    E("span", { class: "jc-traffic-item jc-traffic-down" }, [
        E("span", { class: "jc-traffic-arrow" }, "↓"),
        downNode
    ])
]);

const createStatusGrid = (results, dynamicElements) => E("div", { class: "jc-summary-grid" }, [
    createSummaryCard(_("Service"), [
        createSummaryRow(_("Running"), dynamicElements.serviceBadge),
        createSummaryRow(_("Start on boot"), dynamicElements.autoBadge),
        createSummaryRow(_("RAM"), dynamicElements.ramValue),
        createSummaryRow(_("Mihomo version"), dynamicElements.coreValue)
    ]),
    createSummaryCard(_("Kernel"), [
        createSummaryRow(_("Connections"), dynamicElements.connValue),
        createSummaryRow(_("Mode"), dynamicElements.modeValue),
        createSummaryRow(_("Speed"), createInlineTrafficNode(dynamicElements.upValue, dynamicElements.downValue)),
        createSummaryRow(_("Total"), createInlineTrafficNode(dynamicElements.upTotalValue, dynamicElements.downTotalValue))
    ]),
    createSummaryCard(_("System"), [
        createSummaryRow(_("Router model"), results.infoDevice),
        createSummaryRow(_("OpenWrt version"), results.infoOpenWrt),
        createSummaryRow(_("App LuCI version"), common.justclashLuciVersion),
        createSummaryRow(_("App version"), dynamicElements.packageValue)
    ])
]);

const updateStatusUI = (elements, isAutostarting, isRunning, currentMode) => {
    const runningChanged = elements.lastRunning !== isRunning;
    const autostartChanged = elements.lastAutostarting !== isAutostarting;

    elements.currentRunning = isRunning;
    elements.currentAutostarting = isAutostarting;

    if (runningChanged && elements.serviceBadge) {
        elements.serviceBadge.textContent = boolToWordRunning(isRunning);
        elements.serviceBadge.className = `jc-status-text ${isRunning ? "jc-status-text-active" : "jc-status-text-inactive"}`;
    }

    if (autostartChanged && elements.autoBadge) {
        elements.autoBadge.textContent = boolToWordAutostart(isAutostarting);
        elements.autoBadge.className = `jc-status-text ${isAutostarting ? "jc-status-text-active" : "jc-status-text-inactive"}`;
    }

    if (runningChanged && elements.btnToggle) {
        const label = isRunning ? _("Stop") : _("Start");
        const text = elements.btnToggle.querySelector(".jc-button-label");
        if (text) text.textContent = label;
        elements.btnToggle.className = `cbi-button ${isRunning ? buttons.NEGATIVE : buttons.POSITIVE}`;
        elements.btnToggle.title = label;
        elements.btnToggle.setAttribute("aria-label", label);
    }

    if (elements.modeValue) {
        elements.modeValue.textContent = isRunning && currentMode
            ? currentMode.charAt(0).toUpperCase() + currentMode.slice(1)
            : _("Unknown");
    }

    elements.lastRunning = isRunning;
    elements.lastAutostarting = isAutostarting;
};

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,

    async load() {
        let apiToken = "";

        try {
            await uci.load(common.binName);
            apiToken = uci.get(common.binName, "proxy", "api_password") || "";
            mihomoApi.setTls(uci.get(common.binName, "proxy", "api_tls") === "1");
        } catch { /* ignore */ }

        const boardPromise = ubusApi.getSystemBoard()
            .then(data => [
                data.model ? data.model.replace(/\s*\(.*\)\s*$/, "") : _("Error"),
                data.release && data.release.description ? data.release.description.replace(/ r\d+-[a-f0-9]+.*$/, "") : _("Error")
            ])
            .catch(() => [_("Error"), _("Error")]);

        const statusPromise = ubusApi.getStatus()
            .catch(() => ({
                package_version: _("Error"),
                core_version: _("Error"),
                running: false,
                enabled: false
            }));

        const mihomoVersionPromise = mihomoApi.fetchVersion(apiToken)
            .catch(() => null);

        const mihomoModePromise = mihomoApi.fetchConfigs(apiToken)
            .then(configs => configs.mode || "")
            .catch(() => "");

        const [
            [infoDevice, infoOpenWrt],
            serviceStatus,
            infoMihomoVersion,
            infoMode
        ] = await Promise.all([boardPromise, statusPromise, mihomoVersionPromise, mihomoModePromise]);

        return {
            infoDevice,
            infoOpenWrt,
            infoPackage: serviceStatus.package_version,
            infoCore: infoMihomoVersion || serviceStatus.core_version,
            infoIsRunning: !!serviceStatus.running,
            infoIsAutostarting: !!serviceStatus.enabled,
            infoMode,
            apiToken
        };
    },

    async render(results) {
        let actionInProgress = false;
        let visibilityChangeHandler = null;
        let beforeUnloadHandler = null;
        let poller = null;
        let sockets = null;

        const dynamicElements = {
            currentRunning: !!results.infoIsRunning,
            currentAutostarting: !!results.infoIsAutostarting,
            lastRunning: null,
            lastAutostarting: null
        };

        const cleanup = () => {
            poller?.stop();
            sockets?.stop();

            if (visibilityChangeHandler) {
                document.removeEventListener("visibilitychange", visibilityChangeHandler);
                visibilityChangeHandler = null;
            }
            if (beforeUnloadHandler) {
                window.removeEventListener("beforeunload", beforeUnloadHandler);
                beforeUnloadHandler = null;
            }
        };

        poller = statusRuntime.createPoller({
            token: results.apiToken,
            isMounted: () => document.body.contains(dynamicElements.serviceBadge),
            onUpdate: ({ isRunning, isAutostarting, currentMode }) => {
                updateStatusUI(dynamicElements, isAutostarting, isRunning, currentMode);
            },
            onInactive: cleanup
        });

        const serviceBadge = E("span", { class: "jc-status-text" }, _("Loading..."));
        const autoBadge = E("span", { class: "jc-status-text" }, _("Loading..."));
        const packageValue = E("span", {}, results.infoPackage);
        const coreValue = E("span", {}, results.infoCore);
        const upValue = E("span", {}, "0 B/s");
        const downValue = E("span", {}, "0 B/s");
        const upTotalValue = E("span", {}, "0 B");
        const downTotalValue = E("span", {}, "0 B");
        const ramValue = E("span", {}, "0 B");
        const connValue = E("span", {}, "0");
        const modeValue = E("span", {}, _("Unknown"));
        const actionHandler = (task, timeoutMs) => async () => {
            if (actionInProgress) return;
            actionInProgress = true;
            ui.showModal(_("Running command..."), [E("p", _("Please wait."))]);
            try {
                await task();
                if (timeoutMs) await asyncTimeout(timeoutMs);
                await poller.refresh();
            } catch (e) {
                ui.addTimeLimitedNotification(_("Error"), E("p", e.message), common.notificationTimeout, "danger");
                console.error(e);
            } finally {
                ui.hideModal();
                actionInProgress = false;
            }
        };

        const toggleHandler = async () => {
            const running = !!dynamicElements.currentRunning;
            const task = running ? () => ubusApi.stop() : () => ubusApi.start();
            return actionHandler(task, running ? 0 : ACTION_DELAY_TIMEOUT)();
        };

        const btnToggle = createActionButton(buttonsIDs.START, buttons.POSITIVE, _("Start"), toggleHandler);
        const btnRestart = createActionButton(buttonsIDs.RESTART, buttons.ACTION, _("Restart"), actionHandler(() => ubusApi.restart(), ACTION_DELAY_TIMEOUT));
        Object.assign(dynamicElements, {
            serviceBadge,
            autoBadge,
            packageValue,
            coreValue,
            upValue,
            downValue,
            upTotalValue,
            downTotalValue,
            ramValue,
            connValue,
            modeValue,
            btnToggle
        });

        const statusGrid = createStatusGrid(results, dynamicElements);
        const serviceActionContainer = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions" }, [
                btnToggle,
                btnRestart
            ])
        ]);

        const statusContainer = E("div", { class: "cbi-section fade-in" }, [
            E("h3", { class: "cbi-section-title" }, _("Current status")),
            E("div", { class: "cbi-section-descr" }, _("Overview of the running Mihomo service status, core version, and active traffic usage.")),
            statusGrid
        ]);

        sockets = statusRuntime.createSockets({
            token: results.apiToken,
            containerCheck: () => document.body.contains(statusContainer),
            onInactive: cleanup,
            onTraffic: (data) => {
                dynamicElements.upValue.textContent = formatSpeed(data.up);
                dynamicElements.downValue.textContent = formatSpeed(data.down);
                dynamicElements.upTotalValue.textContent = common.formatBytes(data.upTotal);
                dynamicElements.downTotalValue.textContent = common.formatBytes(data.downTotal);
            },
            onConnections: (data) => {
                dynamicElements.connValue.textContent = String(data.connections.length);
            },
            onMemory: (data) => {
                dynamicElements.ramValue.textContent = common.formatBytes(data.inuse);
            }
        });

        const serviceActionSection = E("div", { class: "cbi-section fade-in" }, [
            E("h3", { class: "cbi-section-title" }, _("Service actions")),
            E("div", { class: "cbi-section-descr" }, _("Control the Mihomo daemon. You can start, stop, or restart the service.")),
            serviceActionContainer
        ]);

        const maintenanceActionContainer = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions" }, [
                createActionButton(buttonsIDs.DIAGNOSTIC, buttons.POSITIVE, _("Run diagnostics"), actions.showRpc(_("Diagnostic report"), false, () => ubusApi.diagRedacted())),
                createActionButton(buttonsIDs.UPDATE, buttons.ACTION, _("Update core"), actions.showConfirmRpc(_("Update Mihomo core"), _("Updating the Mihomo core is not atomic yet. If the router has too little free space or the download fails mid-update, the current core may be removed before the new one is fully installed."), () => ubusApi.updateCore(), async () => {
                    const status = await ubusApi.getStatus();
                    const infoPackage = status.package_version;
                    let infoCore = status.core_version;

                    try {
                        infoCore = await mihomoApi.fetchVersion(results.apiToken);
                    } catch { /* ignore */ }

                    if (dynamicElements.packageValue)
                        dynamicElements.packageValue.textContent = infoPackage || _("Error");

                    if (dynamicElements.coreValue)
                        dynamicElements.coreValue.textContent = infoCore || _("Error");
                })),
                createActionButton(buttonsIDs.UPDATE_RULESETS, buttons.ACTION, _("Update active rulesets"), actions.showUpdateRulesets(results.apiToken)),
                createActionButton(buttonsIDs.SERVICE_DATA_UPDATE, buttons.ACTION, _("Update built-in data"), actions.showConfirmRpc(_("Update built-in data"), _("This action downloads and replaces built-in service data files. If the download fails or the remote source returns bad data, service behavior may change until the next successful update."), () => ubusApi.updateRulesets()))
            ])
        ]);

        const maintenanceActionSection = E("div", { class: "cbi-section fade-in" }, [
            E("h3", { class: "cbi-section-title" }, _("Maintenance")),
            E("div", { class: "cbi-section-descr" }, _("Perform diagnostic tests, update the core binary, and update downloaded rulesets or service data files.")),
            maintenanceActionContainer
        ]);

        const configActionContainer = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions" }, [
                createActionButton(buttonsIDs.MIHOMO_CONFIG, buttons.ACTION, _("Show Mihomo config"), actions.showConfigRpc(_("Mihomo config"), () => ubusApi.getMihomoConfig(), () => ubusApi.getMihomoConfigUnsafe())),
                createActionButton(buttonsIDs.SERVICE_CONFIG, buttons.ACTION, _("Show service config"), actions.showConfigRpc(_("Service config"), () => ubusApi.getServiceConfig(), () => ubusApi.getServiceConfigUnsafe()))
            ])
        ]);

        const configActionSection = E("div", { class: "cbi-section fade-in" }, [
            E("h3", { class: "cbi-section-title" }, _("Configuration")),
            E("div", { class: "cbi-section-descr" }, _("Inspect the generated Mihomo configuration or the JustClash service configuration.")),
            configActionContainer
        ]);


        const style = E("style", {}, `
            .jc-status-text { font-weight:700; }
            .jc-status-text-active { color:var(--success-color-high, #2f9e44); }
            .jc-status-text-inactive { color:var(--error-color-high, #f44336); }
            .jc-summary-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); grid-auto-rows:1fr; gap:0.75rem; margin-bottom:1rem; align-items:stretch; }
            .jc-card, .jc-summary-body, .jc-summary-row, .jc-primary-actions { display:flex; }
            .jc-card, .jc-summary-body { flex-direction:column; }
            .jc-summary-row { flex-direction:row; justify-content:space-between; align-items:center; padding-bottom: 0.3em; }
            .jc-summary-row:not(:last-child) { border-bottom: 1px solid var(--border-color-medium, rgba(0,0,0,0.08)); margin-bottom: 0.1em; }
            .jc-card { height:100%; padding:0.5em 0.6em; border:1px solid var(--border-color-medium, #d9d9d9); border-radius:0.375rem; background:var(--background-color-medium, #f6f6f6); box-sizing:border-box; min-width:0; }
            .jc-card-title { display:block; margin-bottom:0.5em; padding-bottom:0.25em; border-bottom:1px solid var(--border-color-medium, rgba(0,0,0,0.12)); font-size:1em; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; }
            .jc-status-text, .jc-summary-value, .jc-button-content { display:inline-flex; align-items:center; }
            .jc-summary-body { gap:0.25em; }
            .jc-summary-row { gap:0.18em; min-width:0; }
            .jc-summary-key { color:var(--text-color-medium, #888); }
            .jc-summary-value { gap:0.45em; min-width:0; min-height:1.5em; font-weight:600; text-align:left; white-space:nowrap; }
            .jc-traffic-inline { display:inline-flex; align-items:center; gap:0.4em; flex-wrap:wrap; }
            .jc-traffic-item { display:inline-flex; align-items:center; gap:0.2em; }
            .jc-traffic-arrow { font-weight:700; opacity:0.85; }
            .jc-traffic-up .jc-traffic-arrow { color:var(--error-color-medium, #f44336); }
            .jc-traffic-down .jc-traffic-arrow { color:var(--success-color-medium, #2f9e44); }
            .jc-traffic-sep { opacity:0.45; }
            .jc-actions-wrap { border:1px solid var(--border-color-medium, #d9d9d9); border-radius:0.375rem; background:var(--background-color-medium, #f6f6f6); padding:0.5em 0.6em; margin-bottom:1rem; }
            .jc-primary-actions { flex-wrap:wrap; gap:0.65em; margin:0; }
            .jc-actions-wrap .jc-primary-actions button.cbi-button, .jc-actions-wrap button.cbi-button {
                margin:0;
                height: 1.9375rem;
                padding-top: 0;
                padding-bottom: 0;
                display: inline-flex;
                align-items: center;
                box-sizing: border-box;
            }
            .jc-button-content { justify-content:center; gap:0.45em; vertical-align:middle; }
            .jc-modal-warning, .jc-modal-warning-text { color:var(--error-color-medium); }
            .jc-modal-warning-text, .jc-modal-actions { margin-top:1em; }
            .jc-modal-pre { max-height:28rem; overflow:auto; font-weight:normal; font-family:ui-monospace,monospace; }
            .jc-modal-actions { text-align:right; }
            :root[data-darkmode="true"] .jc-card,
            :root[data-darkmode="true"] .jc-actions-wrap { border-color:var(--border-color-medium, rgba(255,255,255,0.08)); background:var(--background-color-high, rgba(255,255,255,0.04)); }
            :root[data-darkmode="true"] .jc-card-title { border-color:var(--border-color-medium, rgba(255,255,255,0.08)); }
            @media (max-width:62.5rem) { .jc-summary-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
            @media (max-width:37.5rem) { .jc-summary-grid { grid-template-columns:1fr; grid-auto-rows:auto; } }
        `);

        poller.start();

        visibilityChangeHandler = () => {
            console.debug(`[status] visibilitychange: ${document.hidden ? "hidden" : "visible"}`);
            if (document.hidden) {
                poller.stop();
                sockets.stop();
            } else {
                sockets.connect();
                poller.refresh().then((shouldContinue) => {
                    if (shouldContinue)
                        poller.schedule();
                });
            }
        };

        document.addEventListener("visibilitychange", visibilityChangeHandler);

        beforeUnloadHandler = () => {
            console.debug("[status] beforeunload");
            cleanup();
        };

        window.addEventListener("beforeunload", beforeUnloadHandler);

        requestAnimationFrame(() => {
            updateStatusUI(dynamicElements, results.infoIsAutostarting, !!results.infoIsRunning, results.infoMode);
            sockets.connect();
        });

        return E("div", { class: "cbi-map" }, [
            style,
            E("div", { class: "cbi-section" }, [
                statusContainer,
                serviceActionSection,
                maintenanceActionSection,
                configActionSection
            ])
        ]);
    }
});
