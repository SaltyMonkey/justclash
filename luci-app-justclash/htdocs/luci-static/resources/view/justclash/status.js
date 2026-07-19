"use strict";
"require ui";
"require view";
"require fs";
"require uci";
"require view.justclash.helper_clipboard as clipboard";
"require view.justclash.helper_ubus as ubusApi";
"require view.justclash.helper_common as common";
"require view.justclash.helper_mihomo_api as mihomoApi";

const POLL_TIMEOUT = 3000;
const ACTION_DELAY_TIMEOUT = 5000;

let pollInterval = null;
let pollingInProgress = false;
let actionInProgress = false;
let visibilityChangeHandler = null;
let beforeUnloadHandler = null;
let wsCleanups = [];

const buttonsIDs = {
    START: "button-start",
    RESTART: "button-restart",
    ENABLE: "button-enable",
    DIAGNOSTIC: "button-diagnostic",
    CONFIG_SHOW: "button-config-show",
    CONFIG_SHOW_SECOND: "button-config-show-second",
    UPDATE: "button-core-update",
    UPDATE_RULESETS: "button-rulesets-update",
    CONFIG_RESET: "button-config-reset",
    SERVICE_DATA_UPDATE: "button-service-data"
};

const buttons = {
    POSITIVE: "cbi-button-positive",
    NEGATIVE: "cbi-button-negative",
    NEUTRAL: "cbi-button-neutral",
    ACTION: "cbi-button-action"
};

const cleanStdout = (val) =>
    val && val.stdout ? val.stdout.replace(/[\r\n]+/g, "").trim() : _("Error");

const asyncTimeout = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const boolToWordAutostart = (val) => val ? _("Enabled") : _("Disabled");
const boolToWordRunning = (val) => val ? _("Running") : _("Stopped");

const createActionButton = (action, cssClass, label, handler, iconKey) =>
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

const cleanupWs = () => {
    wsCleanups.forEach(fn => fn());
    wsCleanups = [];
};

const cleanup = () => {
    stopPolling();
    cleanupWs();
    if (visibilityChangeHandler) {
        document.removeEventListener("visibilitychange", visibilityChangeHandler);
        visibilityChangeHandler = null;
    }
    if (beforeUnloadHandler) {
        window.removeEventListener("beforeunload", beforeUnloadHandler);
        beforeUnloadHandler = null;
    }
};

const createSummaryRow = (label, valueNode, extraNode) => {
    const valueChildren = [valueNode];
    if (extraNode)
        valueChildren.push(extraNode);

    return E("div", { class: "jc-summary-row" }, [
        E("span", { class: "jc-summary-key" }, label),
        E("span", { class: "jc-summary-value" }, valueChildren)
    ]);
};

const createSummaryCard = (title, rows, iconKey) => {
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
    ], "service"),
    createSummaryCard(_("Traffic"), [
        createSummaryRow(_("Speed"), createInlineTrafficNode(dynamicElements.upValue, dynamicElements.downValue)),
        createSummaryRow(_("Total"), createInlineTrafficNode(dynamicElements.upTotalValue, dynamicElements.downTotalValue))
    ], "traffic"),
    createSummaryCard(_("System"), [
        createSummaryRow(_("Router model"), results.infoDevice),
        createSummaryRow(_("OpenWrt version"), results.infoOpenWrt),
        createSummaryRow(_("LuCI version"), common.justclashLuciVersion),
        createSummaryRow(_("Installed version"), dynamicElements.packageValue)
    ], "system")
]);

const updateUI = (dynamicElements, isAutostarting, isRunning) => {
    const runningChanged = dynamicElements.lastRunning !== isRunning;
    const autostartChanged = dynamicElements.lastAutostarting !== isAutostarting;

    dynamicElements.currentRunning = isRunning;
    dynamicElements.currentAutostarting = isAutostarting;

    if (runningChanged && dynamicElements.serviceBadge) {
        dynamicElements.serviceBadge.textContent = boolToWordRunning(isRunning);
        dynamicElements.serviceBadge.className = `jc-status-text ${isRunning ? "jc-status-text-active" : "jc-status-text-inactive"}`;
    }

    if (autostartChanged && dynamicElements.autoBadge) {
        dynamicElements.autoBadge.textContent = boolToWordAutostart(isAutostarting);
        dynamicElements.autoBadge.className = `jc-status-text ${isAutostarting ? "jc-status-text-active" : "jc-status-text-inactive"}`;
    }

    if (runningChanged && dynamicElements.btnToggle) {
        const label = isRunning ? _("Stop") : _("Start");
        const text = dynamicElements.btnToggle.querySelector(".jc-button-label");

        if (text)
            text.textContent = label;

        dynamicElements.btnToggle.className = `cbi-button ${isRunning ? buttons.NEGATIVE : buttons.POSITIVE}`;
        dynamicElements.btnToggle.title = label;
        dynamicElements.btnToggle.setAttribute("aria-label", label);
    }

    if (autostartChanged && dynamicElements.btnAutoToggle) {
        const label = isAutostarting ? _("Disable on boot") : _("Enable on boot");
        const text = dynamicElements.btnAutoToggle.querySelector(".jc-button-label");
        if (text)
            text.textContent = label;
        dynamicElements.btnAutoToggle.className = `cbi-button ${isAutostarting ? buttons.NEGATIVE : buttons.POSITIVE}`;
        dynamicElements.btnAutoToggle.title = label;
        dynamicElements.btnAutoToggle.setAttribute("aria-label", label);
    }

    dynamicElements.lastRunning = isRunning;
    dynamicElements.lastAutostarting = isAutostarting;
};

const updateServiceStatus = async (dynamicElements) => {
    if (pollingInProgress) return;
    pollingInProgress = true;

    try {
        if (!await ubusApi.isSessionAlive()) {
            stopPolling();
            cleanupWs();
            return;
        }

        const [isRunning, isAutostarting] = await Promise.all([
            ubusApi.isServiceRunning().catch(() => false),
            ubusApi.isServiceAutoStartEnabled().catch(() => false)
        ]);
        requestAnimationFrame(() => updateUI(dynamicElements, isAutostarting, isRunning));
    } finally {
        pollingInProgress = false;
    }
};

const stopPolling = () => {
    if (pollInterval) {
        clearTimeout(pollInterval);
        pollInterval = null;
    }
};

const scheduleNextPoll = (dynamicElements) => {
    if (pollInterval || document.hidden)
        return;

    pollInterval = setTimeout(async () => {
        pollInterval = null;
        await updateServiceStatus(dynamicElements);
        scheduleNextPoll(dynamicElements);
    }, POLL_TIMEOUT);
};

const startPolling = (dynamicElements) => {
    stopPolling();
    scheduleNextPoll(dynamicElements);
};

const showErrorModal = (message) => {
    ui.showModal(_("Error"), [
        E("div", { class: "alert-message error" }, message),
        E("div", { class: "jc-modal-actions" }, [
            E("button", { class: "cbi-button", click: () => ui.hideModal() }, [_("Dismiss")])
        ])
    ]);
};

const showTextModalHandler = (title, warning, task, options = {}) => async () => {
    const warn = warning ? [
        E("strong", { class: "jc-modal-warning" }, _("Dangerous action!")),
        E("div", { class: "jc-modal-warning-text" }, warning)
    ] : [];
    const loadingText = options.loadingText || _("Please wait...");
    const allowCopy = options.allowCopy !== false;

    ui.showModal(title, [E("p", loadingText)]);

    try {
        const output = await task();
        const actions = [];

        if (allowCopy) {
            actions.push(E("button", {
                class: `cbi-button ${buttons.ACTION}`,
                click: async () => {
                    try {
                        await clipboard.copy(output || "");
                        ui.hideModal();
                    } catch (e) {
                        ui.addTimeLimitedNotification(_("Error"), E("p", `${e.message || e}`), common.notificationTimeout, "danger");
                        console.error("Failed to copy modal output to clipboard", e);
                    }
                }
            }, [_("Copy to clipboard")]));
        }

        actions.push(E("button", {
            class: "cbi-button",
            style: allowCopy ? "margin-left: 0.3125rem;" : "",
            click: () => ui.hideModal()
        }, [_("Dismiss")]));

        ui.showModal(title, [
            ...warn,
            E("pre", { class: "jc-modal-pre" }, output || _("No response")),
            E("div", { class: "jc-modal-actions" }, actions)
        ]);
    } catch (e) {
        showErrorModal(e.message);
    }
};

const showExecModalHandler = (title, warning, command, args, afterExec) =>
    showTextModalHandler(title, warning, async () => {
        const res = await ubusApi.exec(command, args);
        if (afterExec)
            await afterExec(res);
        return res.stdout || _("No response");
    });

const showConfirmExecModalHandler = (title, warning, command, args, afterExec) => async () => {
    ui.showModal(title, [
        E("strong", { class: "jc-modal-warning" }, _("Dangerous action!")),
        E("div", { class: "jc-modal-warning-text" }, warning),
        E("div", { class: "jc-modal-actions" }, [
            E("button", {
                class: `cbi-button ${buttons.NEGATIVE}`,
                click: async () => {
                    ui.hideModal();
                    await showExecModalHandler(title, false, command, args, afterExec)();
                }
            }, [_("Run")]),
            E("button", {
                class: "cbi-button",
                style: "margin-left: 0.3125rem;",
                click: () => ui.hideModal()
            }, [_("Cancel")])
        ])
    ]);
};

const normalizeRuleProviders = (payload) => {
    const providers = payload && typeof payload === "object" && payload.providers && typeof payload.providers === "object"
        ? payload.providers
        : payload;

    if (!providers || typeof providers !== "object")
        return [];

    return Object.keys(providers)
        .filter((name) => name && typeof name === "string")
        .map((name) => ({ name, data: providers[name] || {} }))
        .sort((a, b) => a.name.localeCompare(b.name));
};

const showUpdateRulesetsModalHandler = (token) =>
    showTextModalHandler(_("Update rulesets"), false, async () => {
        const payload = await mihomoApi.fetchRuleProviders(token);
        const rulesets = normalizeRuleProviders(payload);
        const rows = rulesets.map((ruleset) => ({
            name: ruleset.name,
            status: _("Updated")
        }));
        let hasErrors = false;

        for (const entry of rows) {
            try {
                await mihomoApi.updateRulesetProvider(entry.name, token);
            } catch (e) {
                hasErrors = true;
                entry.status = `${_("Failed")}: ${e.message || _("Error")}`;
            }
        }

        const finalStatus = rows.length === 0
            ? _("No rulesets returned by API.")
            : (hasErrors ? _("Completed with errors") : _("Completed"));
        const listText = rows.length > 0
            ? rows.map((entry) => `${entry.name}: ${entry.status}`).join("\n")
            : _("No rulesets returned by API.");
        return `${_("Received rulesets:")}\n${listText}\n\n${_("Status")}\n${finalStatus}`;
    }, {
        allowCopy: false,
        loadingText: _("Getting rulesets...")
    });

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
        } catch (e) {}

        const boardPromise = ubusApi.getSystemBoard()
            .then(data => [
                data.model ? data.model.replace(/\s*\(.*\)\s*$/, "") : _("Error"),
                data.release && data.release.description ? data.release.description.replace(/ r\d+-[a-f0-9]+.*$/, "") : _("Error")
            ])
            .catch(() => [_("Error"), _("Error")]);

        const packagePromise = fs.exec(common.binPath, ["_luci_call"])
            .then(data => cleanStdout(data).split(","))
            .catch(() => [_("Error"), _("Error")]);

        const mihomoVersionPromise = mihomoApi.fetchVersion(apiToken)
            .catch(() => null);

        const statusPromise = Promise.all([
            ubusApi.isServiceRunning().catch(() => false),
            ubusApi.isServiceAutoStartEnabled().catch(() => false)
        ]);

        const [
            [infoDevice, infoOpenWrt],
            [infoPackage, fallbackCoreVersion],
            infoMihomoVersion,
            [infoIsRunning, infoIsAutostarting]
        ] = await Promise.all([boardPromise, packagePromise, mihomoVersionPromise, statusPromise]);

        return {
            infoDevice,
            infoOpenWrt,
            infoPackage,
            infoCore: infoMihomoVersion || fallbackCoreVersion,
            infoIsRunning,
            infoIsAutostarting,
            apiToken
        };
    },

    async render(results) {
        stopPolling();

        const serviceBadge = E("span", { class: "jc-status-text" }, _("Loading..."));
        const autoBadge = E("span", { class: "jc-status-text" }, _("Loading..."));
        const packageValue = E("span", {}, results.infoPackage);
        const coreValue = E("span", {}, results.infoCore);
        const upValue = E("span", {}, "0 B/s");
        const downValue = E("span", {}, "0 B/s");
        const upTotalValue = E("span", {}, "0 B");
        const downTotalValue = E("span", {}, "0 B");
        const ramValue = E("span", {}, "0 B");
        const actionHandler = (action, timeoutMs) => async () => {
            if (actionInProgress) return;
            actionInProgress = true;
            ui.showModal(_("Running command..."), [E("p", _("Please wait."))]);
            try {
                await fs.exec(common.initdPath, [action]);
                if (timeoutMs) await asyncTimeout(timeoutMs);
                await updateServiceStatus(dynamicElements);
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
            return actionHandler(running ? "stop" : "start", running ? 0 : ACTION_DELAY_TIMEOUT)();
        };

        const autoToggleHandler = async () => {
            const enabled = !!dynamicElements.currentAutostarting;
            return actionHandler(enabled ? "disable" : "enable")();
        };

        const btnToggle = createActionButton(buttonsIDs.START, buttons.POSITIVE, _("Start"), toggleHandler, "start");
        const btnRestart = createActionButton(buttonsIDs.RESTART, buttons.ACTION, _("Restart"), actionHandler("restart", ACTION_DELAY_TIMEOUT), "restart");
        const btnAutoToggle = createActionButton(buttonsIDs.ENABLE, buttons.POSITIVE, _("Enable on boot"), autoToggleHandler, "enable");
        const dynamicElements = {
            serviceBadge,
            autoBadge,
            packageValue,
            coreValue,
            upValue,
            downValue,
            upTotalValue,
            downTotalValue,
            ramValue,
            btnToggle,
            btnAutoToggle,
            currentRunning: !!results.infoIsRunning,
            currentAutostarting: !!results.infoIsAutostarting,
            lastRunning: null,
            lastAutostarting: null
        };

        const statusGrid = createStatusGrid(results, dynamicElements);
        const serviceActionContainer = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions" }, [
                btnToggle,
                btnRestart,
                btnAutoToggle
            ])
        ]);

        const statusContainer = E("div", { class: "cbi-section fade-in" }, [
            E("h3", { class: "cbi-section-title" }, _("Current status")),
            E("div", { class: "cbi-section-descr" }, _("Overview of the running Mihomo service status, core version, and active traffic usage.")),
            statusGrid
        ]);

        const serviceActionSection = E("div", { class: "cbi-section fade-in" }, [
            E("h3", { class: "cbi-section-title" }, _("Service actions")),
            E("div", { class: "cbi-section-descr" }, _("Control the Mihomo daemon. You can start, stop, or restart the service, and enable or disable it on boot.")),
            serviceActionContainer
        ]);

        const maintenanceActionContainer = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions" }, [
                createActionButton(buttonsIDs.DIAGNOSTIC, buttons.POSITIVE, _("Run diagnostics"), showExecModalHandler(_("Diagnostic report"), false, common.binPath, ["diag_report"]), "diagnostic"),
                createActionButton(buttonsIDs.UPDATE, buttons.ACTION, _("Update core"), showConfirmExecModalHandler(_("Update Mihomo core"), _("Updating the Mihomo core is not atomic yet. If the router has too little free space or the download fails mid-update, the current core may be removed before the new one is fully installed."), common.binPath, ["core_update"], async () => {
                    const res = await fs.exec(common.binPath, ["_luci_call"]);
                    const [infoPackage, fallbackCoreVersion] = cleanStdout(res).split(",");
                    let infoCore = fallbackCoreVersion;

                    try {
                        infoCore = await mihomoApi.fetchVersion(results.apiToken);
                    } catch (e) {}

                    if (dynamicElements.packageValue)
                        dynamicElements.packageValue.textContent = infoPackage || _("Error");

                    if (dynamicElements.coreValue)
                        dynamicElements.coreValue.textContent = infoCore || _("Error");
                }), "update"),
                createActionButton(buttonsIDs.UPDATE_RULESETS, buttons.ACTION, _("Update rulesets"), showUpdateRulesetsModalHandler(results.apiToken), "update"),
                createActionButton(buttonsIDs.SERVICE_DATA_UPDATE, buttons.ACTION, _("Update service data"), showConfirmExecModalHandler(_("Update service data"), _("This action downloads and replaces local service data files. If the download fails or the remote source returns bad data, service behavior may change until the next successful update."), common.binPath, ["service_data_update"]), "serviceData")
            ])
        ]);

        const maintenanceActionSection = E("div", { class: "cbi-section fade-in" }, [
            E("h3", { class: "cbi-section-title" }, _("Maintenance")),
            E("div", { class: "cbi-section-descr" }, _("Perform diagnostic tests, update the core binary, and update downloaded rulesets or service data files.")),
            maintenanceActionContainer
        ]);

        const configActionContainer = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions" }, [
                createActionButton(buttonsIDs.CONFIG_SHOW, buttons.POSITIVE, _("Show Mihomo config"), showExecModalHandler(_("Mihomo config"), false, common.binPath, ["diag_mihomo_config"]), "config"),
                createActionButton(buttonsIDs.CONFIG_SHOW_SECOND, buttons.POSITIVE, _("Show service config"), showExecModalHandler(_("Service config"), false, common.binPath, ["diag_service_config"]), "config"),
                createActionButton(buttonsIDs.CONFIG_RESET, buttons.NEGATIVE, _("Reset config"), showConfirmExecModalHandler(_("Reset configuration"), _("This will reset the JustClash configuration. Use with care."), common.binPath, ["diag_service_config_reset"]), "reset")
            ])
        ]);

        const configActionSection = E("div", { class: "cbi-section fade-in" }, [
            E("h3", { class: "cbi-section-title" }, _("Configuration")),
            E("div", { class: "cbi-section-descr" }, _("Inspect the generated Mihomo or JustClash settings, or reset the configuration back to default values.")),
            configActionContainer
        ]);

        const connectStatusSockets = async () => {
            if (document.hidden)
                return;

            cleanupWs();
            if (!await ubusApi.isSessionAlive())
                return;

            wsCleanups.push(mihomoApi.createTrafficWebSocket({
                token: results.apiToken,
                containerCheck: () => document.body.contains(statusContainer),
                onMessage: (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        dynamicElements.upValue.textContent = formatSpeed(data.up);
                        dynamicElements.downValue.textContent = formatSpeed(data.down);
                        dynamicElements.upTotalValue.textContent = common.formatBytes(data.upTotal);
                        dynamicElements.downTotalValue.textContent = common.formatBytes(data.downTotal);
                    } catch (e) {}
                }
            }));

            wsCleanups.push(mihomoApi.createMemoryWebSocket({
                token: results.apiToken,
                containerCheck: () => document.body.contains(statusContainer),
                onMessage: (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        dynamicElements.ramValue.textContent = common.formatBytes(data.inuse);
                    } catch (e) {}
                }
            }));
        };

        const style = E("style", {}, `
            .jc-status-text { font-weight:700; }
            .jc-status-text-active { color:var(--success-color-high, #2f9e44); }
            .jc-status-text-inactive { color:var(--error-color-high, #f44336); }
            .jc-summary-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); grid-auto-rows:1fr; gap:0.9375rem; margin-bottom:1.25rem; align-items:stretch; }
            .jc-card, .jc-summary-body, .jc-summary-row, .jc-primary-actions { display:flex; }
            .jc-card, .jc-summary-body, .jc-summary-row { flex-direction:column; }
            .jc-card { height:100%; padding:0.85em 1em; border:1px solid var(--border-color-medium, #d9d9d9); border-radius:0.375rem; background:var(--background-color-medium, #f6f6f6); box-sizing:border-box; min-width:0; }
            .jc-card-title { display:block; margin-bottom:0.7em; padding-bottom:0.35em; border-bottom:1px solid var(--border-color-medium, rgba(0,0,0,0.12)); font-size:0.88em; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; }
            .jc-status-text, .jc-summary-value, .jc-button-content { display:inline-flex; align-items:center; }
            .jc-summary-body { gap:0.45em; }
            .jc-summary-row { gap:0.18em; min-width:0; }
            .jc-summary-key { color:var(--text-color-medium, #888); }
            .jc-summary-value { gap:0.45em; min-width:0; min-height:1.5em; font-weight:600; text-align:left; white-space:nowrap; }
            .jc-traffic-inline { display:inline-flex; align-items:center; gap:0.4em; flex-wrap:wrap; }
            .jc-traffic-item { display:inline-flex; align-items:center; gap:0.2em; }
            .jc-traffic-arrow { font-weight:700; opacity:0.85; }
            .jc-traffic-up .jc-traffic-arrow { color:var(--error-color-medium, #f44336); }
            .jc-traffic-down .jc-traffic-arrow { color:var(--success-color-medium, #2f9e44); }
            .jc-traffic-sep { opacity:0.45; }
            .jc-actions-wrap { border:1px solid var(--border-color-medium, #d9d9d9); border-radius:0.375rem; background:var(--background-color-medium, #f6f6f6); padding:0.7em 0.8em; margin-bottom:1.25rem; }
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
            [data-theme="dark"] .jc-card,
            [data-theme="dark"] .jc-actions-wrap { border-color:rgba(255,255,255,0.08); background:rgba(255,255,255,0.04); }
            [data-theme="dark"] .jc-card-title { border-color:rgba(255,255,255,0.08); }
            @media (max-width:62.5rem) { .jc-summary-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
            @media (max-width:37.5rem) { .jc-summary-grid { grid-template-columns:1fr; grid-auto-rows:auto; } }
        `);

        startPolling(dynamicElements);
        connectStatusSockets();

        if (visibilityChangeHandler) {
            document.removeEventListener("visibilitychange", visibilityChangeHandler);
        }

        visibilityChangeHandler = () => {
            console.debug(`[status] visibilitychange: ${document.hidden ? "hidden" : "visible"}`);
            if (document.hidden) {
                stopPolling();
                cleanupWs();
            } else {
                connectStatusSockets();
                updateServiceStatus(dynamicElements).finally(() => scheduleNextPoll(dynamicElements));
            }
        };

        document.addEventListener("visibilitychange", visibilityChangeHandler);

        if (beforeUnloadHandler)
            window.removeEventListener("beforeunload", beforeUnloadHandler);

        beforeUnloadHandler = () => {
            console.debug("[status] beforeunload");
            cleanup();
        };

        window.addEventListener("beforeunload", beforeUnloadHandler);

        requestAnimationFrame(() => {
            updateUI(dynamicElements, results.infoIsAutostarting, results.infoIsRunning);
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