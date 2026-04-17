"use strict";
"require ui";
"require view";
"require fs";
"require uci";
"require view.justclash.helper_clipboard as clipboard";
"require view.justclash.helper_luci_session as luciSession";
"require view.justclash.helper_common as common";
"require view.justclash.helper_fs_api as fsApi";
"require view.justclash.helper_mihomo_api as mihomoApi";
"require rpc";

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

const buttonIcons = {
    start: [
        { tag: "path", attrs: { d: "M5.5 4.5 10.75 8 5.5 11.5Z", fill: "none" } }
    ],
    stop: [
        { tag: "rect", attrs: { x: "5", y: "5", width: "6", height: "6", rx: "1", fill: "none" } }
    ],
    restart: [
        { tag: "path", attrs: { d: "M12 5.25V3m0 0H9.75m2.25 0L9.9 5.1M12.2 7.3A4.5 4.5 0 1 1 8 3.5", fill: "none" } }
    ],
    enable: [
        { tag: "path", attrs: { d: "M8 2.75v4.1M5.15 4.15A4.75 4.75 0 1 0 10.85 4.15", fill: "none" } }
    ],
    disable: [
        { tag: "path", attrs: { d: "M8 2.75v4.1M5.15 4.15A4.75 4.75 0 1 0 10.85 4.15M4.5 11.5l7-7", fill: "none" } }
    ],
    diagnostic: [
        { tag: "circle", attrs: { cx: "7", cy: "7", r: "3.25", fill: "none" } },
        { tag: "path", attrs: { d: "M9.4 9.4 12 12", fill: "none" } }
    ],
    config: [
        { tag: "path", attrs: { d: "M5 2.75h4l2.25 2.25v8.25H5zM9 2.75V5h2.25M7.15 8.2 5.9 9.5l1.25 1.3M9.1 8.2l1.25 1.3-1.25 1.3", fill: "none" } }
    ],
    update: [
        { tag: "path", attrs: { d: "M8 4v5.5M5.75 7.75 8 10l2.25-2.25M4.5 12h7", fill: "none" } }
    ],
    reset: [
        { tag: "path", attrs: { d: "M5 5h6M6 5V4h4v1M6 7.25v3.25M8 7.25v3.25M10 7.25v3.25M5.5 5l.5 6h4l.5-6", fill: "none" } }
    ],
    serviceData: [
        { tag: "path", attrs: { d: "M11.5 6V4h-2M4.5 10v2h2M11.3 6A4 4 0 0 0 5 4.9M4.7 10A4 4 0 0 0 11 11.1", fill: "none" } }
    ]
};

const cardIcons = {
    service: [
        { tag: "rect", attrs: { x: "3", y: "3", width: "10", height: "3", rx: "1", fill: "none" } },
        { tag: "rect", attrs: { x: "3", y: "8", width: "10", height: "5", rx: "1", fill: "none" } },
        { tag: "path", attrs: { d: "M5 4.5h3M5 10.5h3M5 12h3", fill: "none" } }
    ],
    traffic: [
        { tag: "path", attrs: { d: "M5.25 11.5V4.75", fill: "none" } },
        { tag: "path", attrs: { d: "M3.75 6.25 5.25 4.75 6.75 6.25", fill: "none" } },
        { tag: "path", attrs: { d: "M10.75 4.5v6.75", fill: "none" } },
        { tag: "path", attrs: { d: "M9.25 9.75 10.75 11.25 12.25 9.75", fill: "none" } }
    ],
    trafficTotal: [
        { tag: "path", attrs: { d: "M4 11.5h8", fill: "none" } },
        { tag: "path", attrs: { d: "M5.25 11.5V8.75", fill: "none" } },
        { tag: "path", attrs: { d: "M8 11.5V6.75", fill: "none" } },
        { tag: "path", attrs: { d: "M10.75 11.5V4.75", fill: "none" } },
        { tag: "path", attrs: { d: "M4.75 4.5h6.5", fill: "none" } }
    ],
    platform: [
        { tag: "rect", attrs: { x: "3.5", y: "4", width: "9", height: "6.5", rx: "1", fill: "none" } },
        { tag: "path", attrs: { d: "M6.5 11v1.75M9.5 11v1.75M5 12.75h6", fill: "none" } },
        { tag: "path", attrs: { d: "M5.5 6.25h5M5.5 8.25h2.5", fill: "none" } }
    ],
    system: [
        { tag: "rect", attrs: { x: "4.25", y: "4.25", width: "7.5", height: "7.5", rx: "1", fill: "none" } },
        { tag: "path", attrs: { d: "M6.5 2.5v1.75M9.5 2.5v1.75M6.5 11.75v1.75M9.5 11.75v1.75M2.5 6.5h1.75M2.5 9.5h1.75M11.75 6.5h1.75M11.75 9.5h1.75M6.25 6.25h3.5v3.5h-3.5z", fill: "none" } }
    ],
    luci: [
        { tag: "rect", attrs: { x: "3.5", y: "4", width: "9", height: "8", rx: "1.2", fill: "none" } },
        { tag: "path", attrs: { d: "M6.5 4v8M6.5 6.5h6", fill: "none" } }
    ]
};

const createSvgElement = (tag, attrs) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs || {}).forEach((key) => el.setAttribute(key, attrs[key]));
    return el;
};

const createIcon = (iconSet, iconKey, spanClass, svgClass) => {
    const iconDef = iconSet[iconKey] || [];
    const shapes = Array.isArray(iconDef) ? iconDef : (iconDef.shapes || []);
    const span = E("span", { class: spanClass, "aria-hidden": "true" });
    const svg = createSvgElement("svg", {
        class: svgClass,
        viewBox: Array.isArray(iconDef) ? "0 0 16 16" : (iconDef.viewBox || "0 0 16 16"),
        focusable: "false"
    });

    shapes.forEach((shape) => {
        svg.appendChild(createSvgElement(shape.tag, shape.attrs));
    });

    span.appendChild(svg);
    return span;
};

const createButtonIcon = (iconKey) => createIcon(buttonIcons, iconKey, "jc-button-icon", "jc-button-icon-svg");
const createHeaderIcon = (iconKey) => createIcon(cardIcons, iconKey, "jc-card-icon", "jc-card-icon-svg");

const callSystemBoard = rpc.declare({
    object: "system",
    method: "board",
    params: [],
    expect: { "": {} }
});

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
            createButtonIcon(iconKey),
            E("span", { class: "jc-button-label" }, label)
        ])
    ]);

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const formatSpeed = (bytesPerSec) => formatBytes(bytesPerSec) + "/s";

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
    const headerChildren = [];

    if (iconKey)
        headerChildren.push(createHeaderIcon(iconKey));

    headerChildren.push(E("span", { class: "jc-card-label" }, title));

    return E("div", { class: "jc-card jc-summary-card" }, [
        E("div", { class: "jc-card-header" }, headerChildren),
        E("div", { class: "jc-summary-body" }, rows)
    ]);
};

const createStatusGrid = (results, dynamicElements) => E("div", { class: "jc-summary-grid" }, [
    createSummaryCard(_("Service"), [
        createSummaryRow(_("Running"), dynamicElements.serviceBadge),
        createSummaryRow(_("Start on boot"), dynamicElements.autoBadge)
    ], "service"),
    createSummaryCard(_("Platform"), [
        createSummaryRow(_("Router model"), results.infoDevice),
        createSummaryRow(_("OpenWrt version"), results.infoOpenWrt)
    ], "platform"),
    createSummaryCard(_("Packages"), [
        createSummaryRow(_("LuCI version"), common.justclashLuciVersion),
        createSummaryRow(_("Installed version"), dynamicElements.packageValue)
    ], "luci"),
    createSummaryCard(_("Traffic"), [
        createSummaryRow(_("Up"), dynamicElements.upValue),
        createSummaryRow(_("Down"), dynamicElements.downValue)
    ], "traffic"),
    createSummaryCard(_("Traffic total"), [
        createSummaryRow(_("Up total"), dynamicElements.upTotalValue),
        createSummaryRow(_("Down total"), dynamicElements.downTotalValue)
    ], "trafficTotal"),
    createSummaryCard(_("System"), [
        createSummaryRow(_("RAM"), dynamicElements.ramValue),
        createSummaryRow(_("Mihomo version"), dynamicElements.coreValue)
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
        const toggleIcon = dynamicElements.btnToggle.querySelector(".jc-button-icon");
        const text = dynamicElements.btnToggle.querySelector(".jc-button-label");

        if (toggleIcon)
            toggleIcon.replaceWith(createButtonIcon(isRunning ? "stop" : "start"));
        if (text)
            text.textContent = label;

        dynamicElements.btnToggle.className = `cbi-button ${isRunning ? buttons.NEGATIVE : buttons.POSITIVE}`;
        dynamicElements.btnToggle.title = label;
        dynamicElements.btnToggle.setAttribute("aria-label", label);
    }

    if (autostartChanged && dynamicElements.btnAutoToggle) {
        const label = isAutostarting ? _("Disable on boot") : _("Enable on boot");
        const autoIcon = dynamicElements.btnAutoToggle.querySelector(".jc-button-icon");
        const text = dynamicElements.btnAutoToggle.querySelector(".jc-button-label");
        if (autoIcon)
            autoIcon.replaceWith(createButtonIcon(isAutostarting ? "disable" : "enable"));
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
        if (!await luciSession.isSessionAlive()) {
            stopPolling();
            cleanupWs();
            return;
        }

        const [isRunning, isAutostarting] = await Promise.all([
            fsApi.isServiceRunning().catch(() => false),
            fsApi.isServiceAutoStartEnabled().catch(() => false)
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
                        ui.addTimeLimitedNotification(null, E("p", _("Data copied to clipboard")), common.notificationTimeout, "success");
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
            style: allowCopy ? "margin-left: 5px;" : "",
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
        const res = await fs.exec(command, args);
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
                style: "margin-left: 5px;",
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
        } catch (e) {}

        const boardPromise = callSystemBoard()
            .then(data => [data.model || _("Error"), data.release ? data.release.description : _("Error")])
            .catch(() => [_("Error"), _("Error")]);

        const packagePromise = fs.exec(common.binPath, ["_luci_call"])
            .then(data => cleanStdout(data).split(","))
            .catch(() => [_("Error"), _("Error")]);

        const mihomoVersionPromise = mihomoApi.fetchVersion(apiToken)
            .catch(() => null);

        const statusPromise = Promise.all([
            fsApi.isServiceRunning().catch(() => false),
            fsApi.isServiceAutoStartEnabled().catch(() => false)
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
            E("h3", { class: "cbi-section-title" }, _("Current status:")),
            statusGrid
        ]);

        const serviceActionSection = E("div", { class: "cbi-section fade-in" }, [
            E("h3", { class: "cbi-section-title" }, _("Service actions:")),
            serviceActionContainer
        ]);

        const maintenanceActionContainer = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions" }, [
                createActionButton(buttonsIDs.DIAGNOSTIC, buttons.NEUTRAL, _("Run diagnostics"), showExecModalHandler(_("Diagnostic report"), _("Diagnostic output may include sensitive configuration and connection details."), common.binPath, ["diag_report"]), "diagnostic"),
                createActionButton(buttonsIDs.UPDATE, buttons.NEUTRAL, _("Update core"), showExecModalHandler(_("Update Mihomo core"), false, common.binPath, ["core_update"], async () => {
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
                createActionButton(buttonsIDs.UPDATE_RULESETS, buttons.NEUTRAL, _("Update rulesets"), showUpdateRulesetsModalHandler(results.apiToken), "update"),
                createActionButton(buttonsIDs.SERVICE_DATA_UPDATE, buttons.NEUTRAL, _("Update service data"), showExecModalHandler(_("Update service data"), false, common.binPath, ["service_data_update"]), "serviceData")
            ])
        ]);

        const maintenanceActionSection = E("div", { class: "cbi-section fade-in" }, [
            E("h3", { class: "cbi-section-title" }, _("Maintenance")),
            maintenanceActionContainer
        ]);

        const configActionContainer = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions" }, [
                createActionButton(buttonsIDs.CONFIG_SHOW, buttons.NEUTRAL, _("Show Mihomo config"), showExecModalHandler(_("Mihomo config"), _("Do not share your Mihomo config with anyone."), common.binPath, ["diag_mihomo_config"]), "config"),
                createActionButton(buttonsIDs.CONFIG_SHOW_SECOND, buttons.NEUTRAL, _("Show service config"), showExecModalHandler(_("Service config"), _("Do not share your service config with anyone."), common.binPath, ["diag_service_config"]), "config"),
                createActionButton(buttonsIDs.CONFIG_RESET, buttons.NEGATIVE, _("Reset config"), showConfirmExecModalHandler(_("Reset configuration"), _("This will reset the JustClash configuration. Use with care."), common.binPath, ["config_reset"]), "reset")
            ])
        ]);

        const configActionSection = E("div", { class: "cbi-section fade-in" }, [
            E("h3", { class: "cbi-section-title" }, _("Configuration")),
            configActionContainer
        ]);

        const connectStatusSockets = async () => {
            if (document.hidden)
                return;

            cleanupWs();
            if (!await luciSession.isSessionAlive())
                return;

            wsCleanups.push(mihomoApi.createTrafficWebSocket({
                token: results.apiToken,
                containerCheck: () => document.body.contains(statusContainer),
                onMessage: (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        dynamicElements.upValue.textContent = formatSpeed(data.up);
                        dynamicElements.downValue.textContent = formatSpeed(data.down);
                        dynamicElements.upTotalValue.textContent = formatBytes(data.upTotal);
                        dynamicElements.downTotalValue.textContent = formatBytes(data.downTotal);
                    } catch (e) {}
                }
            }));

            wsCleanups.push(mihomoApi.createMemoryWebSocket({
                token: results.apiToken,
                containerCheck: () => document.body.contains(statusContainer),
                onMessage: (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        dynamicElements.ramValue.textContent = formatBytes(data.inuse);
                    } catch (e) {}
                }
            }));
        };

        const style = E("style", {}, `
            .jc-status-text { color:var(--text-color-high, inherit); font-weight:700; line-height:1.3; }
            .jc-status-text-active { color:var(--success-color-medium, #4caf50); }
            .jc-status-text-inactive { color:var(--error-color-medium, #f44336); }
            .jc-summary-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:15px; margin-bottom:20px; align-items:start; }
            .jc-card, .jc-summary-body, .jc-summary-row, .jc-primary-actions { display:flex; }
            .jc-card, .jc-summary-body, .jc-summary-row { flex-direction:column; }
            .jc-card { padding:0.75em; border:1px solid var(--border-color-medium, #bfbfbf); border-radius:4px; box-sizing:border-box; }
            .jc-card-header, .jc-status-text, .jc-summary-value, .jc-button-content, .jc-card-icon, .jc-button-icon { display:inline-flex; align-items:center; }
            .jc-card-header, .jc-actions-wrap { border:1px solid var(--border-color-medium, #d9d9d9); border-radius:6px; background:var(--background-color-medium, #f6f6f6); }
            .jc-card-header { align-self:flex-start; gap:0.45em; margin-bottom:0.7em; padding:0.2em 0.45em; font-size:0.96em; color:var(--text-color, inherit); opacity:0.88; }
            .jc-card-icon, .jc-button-icon { justify-content:center; width:1.75em; height:1.75em; }
            .jc-card-icon { flex:0 0 1.75em; }
            .jc-card-icon-svg, .jc-button-icon-svg { width:100%; height:100%; stroke:currentColor; stroke-width:1; stroke-linecap:round; stroke-linejoin:round; }
            .jc-summary-body { gap:0.45em; }
            .jc-summary-row { gap:0.18em; min-width:0; }
            .jc-summary-key { font-size:0.88em; color:var(--text-color, inherit); opacity:0.78; }
            .jc-summary-value { gap:0.45em; min-width:0; font-size:0.96em; font-weight:600; text-align:left; white-space:nowrap; }
            .cbi-section-actions + .cbi-section-actions { margin-top:8px; }
            .jc-actions-wrap { padding:0.7em 0.8em; }
            .jc-primary-actions { flex-wrap:wrap; gap:0.65em; margin:0; }
            .jc-primary-actions .cbi-button { margin:0 !important; }
            .jc-button-content { justify-content:center; gap:0.45em; vertical-align:middle; }
            .jc-button-icon { line-height:1; }
            .jc-modal-warning, .jc-modal-warning-text { color:var(--error-color-medium); }
            .jc-modal-warning-text, .jc-modal-actions { margin-top:1em; }
            .jc-modal-pre { max-height:460px; overflow:auto; }
            .jc-modal-actions { text-align:right; }
            [data-theme="dark"] .jc-card-header,
            [data-theme="dark"] .jc-actions-wrap { border-color:rgba(255,255,255,0.08); background:rgba(255,255,255,0.04); }
            @media (max-width:1000px) { .jc-summary-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
            @media (max-width:600px) { .jc-summary-grid { grid-template-columns:1fr; } }
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
