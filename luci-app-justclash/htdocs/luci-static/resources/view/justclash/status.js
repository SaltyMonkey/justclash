"use strict";
"require ui";
"require view";
"require fs";
"require view.justclash.common as common";
"require rpc";

const POLL_TIMEOUT = 3000;
const FETCH_TIMEOUT = 2000;
const ACTION_DELAY_TIMEOUT = 5000;
const NOTIFICATION_TIMEOUT = 3000;

let pollInterval = null;
let pollingInProgress = false;
let actionInProgress = false;
let visibilityChangeHandler = null;
let clipboardTextarea = null;

const buttonsIDs = {
    START: "button-start",
    RESTART: "button-restart",
    ENABLE: "button-enable",
    DIAGNOSTIC: "button-diagnostic",
    CONFIG_SHOW: "button-config-show",
    CONFIG_SHOW_SECOND: "button-config-show-second",
    UPDATE: "button-core-update",
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
    autostart: [
        { tag: "path", attrs: { d: "M8 2.75v5", fill: "none" } },
        { tag: "path", attrs: { d: "M5.1 4.2A4.75 4.75 0 1 0 10.9 4.2", fill: "none" } }
    ],
    router: [
        { tag: "rect", attrs: { x: "3.5", y: "8", width: "9", height: "3.5", rx: "1.2", fill: "none" } },
        { tag: "path", attrs: { d: "M5.5 8V6.5M10.5 8V6.5", fill: "none" } },
        { tag: "circle", attrs: { cx: "6.2", cy: "9.75", r: "0.6", fill: "currentColor", stroke: "none" } },
        { tag: "circle", attrs: { cx: "9.8", cy: "9.75", r: "0.6", fill: "currentColor", stroke: "none" } }
    ],
    system: [
        { tag: "rect", attrs: { x: "4.25", y: "4.25", width: "7.5", height: "7.5", rx: "1", fill: "none" } },
        { tag: "path", attrs: { d: "M6.5 2.5v1.75M9.5 2.5v1.75M6.5 11.75v1.75M9.5 11.75v1.75M2.5 6.5h1.75M2.5 9.5h1.75M11.75 6.5h1.75M11.75 9.5h1.75M6.25 6.25h3.5v3.5h-3.5z", fill: "none" } }
    ],
    release: [
        { tag: "path", attrs: { d: "M8 3.5 11.5 5.5v5L8 12.5l-3.5-2v-5z", fill: "none" } },
        { tag: "path", attrs: { d: "M8 3.5v4M4.5 5.5 8 7.5l3.5-2M8 7.75v3.5M6.75 10 8 11.25 9.25 10", fill: "none" } }
    ],
    package: [
        { tag: "path", attrs: { d: "M8 3.5 11.5 5.5v5L8 12.5l-3.5-2v-5z", fill: "none" } },
        { tag: "path", attrs: { d: "M8 3.5v4M4.5 5.5 8 7.5l3.5-2", fill: "none" } }
    ],
    luci: [
        { tag: "rect", attrs: { x: "3.5", y: "4", width: "9", height: "8", rx: "1.2", fill: "none" } },
        { tag: "path", attrs: { d: "M6.5 4v8M6.5 6.5h6", fill: "none" } }
    ],
    core: [
        { tag: "rect", attrs: { x: "4.25", y: "4.25", width: "7.5", height: "7.5", rx: "1", fill: "none" } },
        { tag: "path", attrs: { d: "M6.5 2.5v1.75M9.5 2.5v1.75M6.5 11.75v1.75M9.5 11.75v1.75M2.5 6.5h1.75M2.5 9.5h1.75M11.75 6.5h1.75M11.75 9.5h1.75", fill: "none" } }
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

const fetchWithTimeout = (url, timeout = FETCH_TIMEOUT) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    return fetch(url, { signal: controller.signal })
        .finally(() => clearTimeout(timeoutId));
};

const cleanStdout = (val) =>
    val && val.stdout ? val.stdout.replace(/[\r\n]+/g, "").trim() : _("Error");

const asyncTimeout = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const boolToWordAutostart = (val) => val ? _("Enabled") : _("Disabled");
const boolToWordRunning = (val) => val ? _("Running") : _("Stopped");
const normalizeVersion = (val) => (val || "").toString().trim().replace(/^v/i, "");
const shouldShowUpdateRequired = (onlineVersion, installedVersion) => {
    const online = normalizeVersion(onlineVersion);
    const installed = normalizeVersion(installedVersion);

    if (!online || !installed)
        return false;

    if (["error", "timeout", "loading..."].includes(online.toLowerCase()) ||
        ["error", "timeout", "loading..."].includes(installed.toLowerCase()))
        return false;

    return online !== installed;
};

const isServiceAutoStartEnabled = async () => {
    const res = await fs.exec(common.initdPath, ["enabled"]);
    return res.code === 0;
};

const isServiceRunning = async () => {
    const res = await fs.exec(common.initdPath, ["running"]);
    return res.code === 0;
};

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

const createCard = (label, valueContent, extraContent, iconKey, extraMode) => {
    const headerChildren = [];

    if (iconKey)
        headerChildren.push(createHeaderIcon(iconKey));

    headerChildren.push(E("span", { class: "jc-card-label" }, label));

    return E("div", { class: "jc-card" }, [
        E("div", { class: "jc-card-header" }, headerChildren),
        extraMode === "side" ? E("div", { class: "jc-card-inline" }, [
            E("div", { class: "jc-card-body" }, valueContent),
            E("div", { class: "jc-card-inline-actions" }, extraContent)
        ]) : E("div", { class: "jc-card-body" }, [valueContent])
    ]);
};

const createUpdateBadge = () => E("span", {
    class: "jc-badge jc-badge-warning",
    style: "display:none;"
}, _("Update required"));

const createStatusGrid = (results, dynamicElements) => {
    return E("div", {}, [
        E("div", { class: "jc-grid-top" }, [
            createCard(_("Service"), dynamicElements.serviceBadge, [
                dynamicElements.btnToggle,
                dynamicElements.btnRestart
            ], "service", "side"),
            createCard(_("Start on boot"), dynamicElements.autoBadge, [
                dynamicElements.btnAutoToggle
            ], "autostart", "side"),
            createCard(_("Router model"), results.infoDevice, null, "router"),
            createCard(_("OpenWrt version"), results.infoOpenWrt, null, "system")
        ]),
        E("div", { class: "jc-grid-bottom" }, [
            createCard(_("Latest release"), results.infoOnlinePackage, null, "release"),
            createCard(_("Installed version"), results.infoPackage, dynamicElements.versionBadge, "package", "side"),
            createCard(_("LuCI version"), common.justclashLuciVersion, null, "luci"),
            createCard(_("Mihomo core"), results.infoCore, null, "core")
        ])
    ]);
};

const updateUI = (dynamicElements, isAutostarting, isRunning) => {
    if (dynamicElements.serviceBadge) {
        dynamicElements.serviceBadge.textContent = boolToWordRunning(isRunning);
        dynamicElements.serviceBadge.className = `jc-badge ${isRunning ? "jc-badge-active" : "jc-badge-inactive"}`;
    }

    if (dynamicElements.autoBadge) {
        dynamicElements.autoBadge.textContent = boolToWordAutostart(isAutostarting);
        dynamicElements.autoBadge.className = `jc-badge ${isAutostarting ? "jc-badge-active" : "jc-badge-inactive"}`;
    }

    if (dynamicElements.versionBadge && dynamicElements.packageValue) {
        dynamicElements.versionBadge.style.display =
            shouldShowUpdateRequired(dynamicElements.onlinePackageValue, dynamicElements.packageValue.textContent)
                ? "inline-flex"
                : "none";
    }

    if (dynamicElements.btnToggle) {
        const label = isRunning ? _("Stop") : _("Start");
        const icon = dynamicElements.btnToggle.querySelector(".jc-button-icon");
        const text = dynamicElements.btnToggle.querySelector(".jc-button-label");
        if (icon)
            icon.replaceWith(createButtonIcon(isRunning ? "stop" : "start"));
        if (text)
            text.textContent = label;
        dynamicElements.btnToggle.className = `cbi-button ${isRunning ? buttons.NEGATIVE : buttons.POSITIVE}`;
        dynamicElements.btnToggle.title = label;
        dynamicElements.btnToggle.setAttribute("aria-label", label);
    }

    if (dynamicElements.btnRestart)
        dynamicElements.btnRestart.style.display = isRunning ? "" : "none";

    if (dynamicElements.btnAutoToggle) {
        const label = isAutostarting ? _("Disable autostart") : _("Enable autostart");
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
};

const updateServiceStatus = async (dynamicElements) => {
    if (pollingInProgress) return;
    pollingInProgress = true;

    try {
        const [isRunning, isAutostarting] = await Promise.all([
            isServiceRunning().catch(() => false),
            isServiceAutoStartEnabled().catch(() => false)
        ]);
        requestAnimationFrame(() => updateUI(dynamicElements, isAutostarting, isRunning));
    } finally {
        pollingInProgress = false;
    }
};

const stopPolling = () => {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
};

const startPolling = (dynamicElements) => {
    stopPolling();
    pollInterval = setInterval(() => updateServiceStatus(dynamicElements), POLL_TIMEOUT);

    if (visibilityChangeHandler) {
        document.removeEventListener("visibilitychange", visibilityChangeHandler);
    }

    visibilityChangeHandler = () => {
        if (document.hidden) {
            stopPolling();
        } else {
            updateServiceStatus(dynamicElements);
            if (!pollInterval) {
                pollInterval = setInterval(() => updateServiceStatus(dynamicElements), POLL_TIMEOUT);
            }
        }
    };

    document.addEventListener("visibilitychange", visibilityChangeHandler);
};

const showExecModalHandler = (title, warning, command, args, afterExec) => async () => {
    const warn = warning ? [
        E("strong", { class: "jc-modal-warning" }, _("Dangerous action!")),
        E("div", { class: "jc-modal-warning-text" }, warning)
    ] : [];

    ui.showModal(title, [E("p", _("Please wait..."))]);

    try {
        const res = await fs.exec(command, args);
        if (afterExec)
            await afterExec(res);
        ui.showModal(title, [
            ...warn,
            E("pre", { class: "jc-modal-pre" }, res.stdout || _("No response")),
            E("div", { class: "jc-modal-actions" }, [
                E("button", {
                    class: `cbi-button ${buttons.ACTION}`,
                    click: async () => {
                        try {
                            await copyToClipboard(res.stdout || "");
                            ui.addTimeLimitedNotification(null, E("p", _("Data copied to clipboard")), NOTIFICATION_TIMEOUT, "success");
                            ui.hideModal();
                        } catch (e) {
                            ui.addTimeLimitedNotification(_("Error"), E("p", `${e.message || e}`), NOTIFICATION_TIMEOUT, "danger");
                            console.error("Failed to copy modal output to clipboard", e);
                        }
                    }
                }, [_("Copy to clipboard")]),
                E("button", {
                    class: "cbi-button",
                    style: "margin-left: 5px;",
                    click: () => ui.hideModal()
                }, [_("Dismiss")])
            ])
        ]);
    } catch (e) {
        ui.showModal(_("Error"), [
            E("div", { class: "alert-message error" }, e.message),
            E("div", { class: "jc-modal-actions" }, [
                E("button", { class: "cbi-button", click: () => ui.hideModal() }, [_("Dismiss")])
            ])
        ]);
    }
};

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

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,

    async load() {
        const boardPromise = callSystemBoard()
            .then(data => [data.model || _("Error"), data.release ? data.release.description : _("Error")])
            .catch(() => [_("Error"), _("Error")]);

        const packagePromise = fs.exec(common.binPath, ["_luci_call"])
            .then(data => cleanStdout(data).split(","))
            .catch(() => [_("Error"), _("Error")]);

        const onlinePromise = fetchWithTimeout(common.justclashOnlineVersionUrl)
            .then(res => res.ok ? res.json() : null)
            .then(data => data && data.tag_name ? data.tag_name.replace(/^v/, "") : _("Error"))
            .catch(e => e.name === "AbortError" ? _("Timeout") : _("Error"));

        const statusPromise = Promise.all([
            isServiceRunning().catch(() => false),
            isServiceAutoStartEnabled().catch(() => false)
        ]);

        const [
            [infoDevice, infoOpenWrt],
            [infoPackage, infoCore],
            infoOnlinePackage,
            [infoIsRunning, infoIsAutostarting]
        ] = await Promise.all([boardPromise, packagePromise, onlinePromise, statusPromise]);

        return { infoDevice, infoOpenWrt, infoOnlinePackage, infoPackage, infoCore, infoIsRunning, infoIsAutostarting };
    },

    async render(results) {
        stopPolling();

        const serviceBadge = E("span", { class: "jc-badge" }, _("Loading..."));
        const autoBadge = E("span", { class: "jc-badge" }, _("Loading..."));
        const versionBadge = createUpdateBadge();
        const packageValue = E("span", {}, results.infoPackage);
        const coreValue = E("span", {}, results.infoCore);
        let dynamicElements = {
            serviceBadge,
            autoBadge,
            versionBadge,
            packageValue,
            coreValue,
            onlinePackageValue: results.infoOnlinePackage
        };

        const actionHandler = (action, timeoutMs) => async () => {
            if (actionInProgress) return;
            actionInProgress = true;
            ui.showModal(_("Running command..."), [E("p", _("Please wait."))]);
            try {
                await fs.exec(common.initdPath, [action]);
                if (timeoutMs) await asyncTimeout(timeoutMs);
                await updateServiceStatus(dynamicElements);
            } catch (e) {
                ui.addTimeLimitedNotification(_("Error"), E("p", e.message), NOTIFICATION_TIMEOUT, "danger");
                console.error(e);
            } finally {
                ui.hideModal();
                actionInProgress = false;
            }
        };

        const toggleHandler = async () => {
            const running = await isServiceRunning().catch(() => false);
            return actionHandler(running ? "stop" : "start", running ? 0 : ACTION_DELAY_TIMEOUT)();
        };

        const autoToggleHandler = async () => {
            const enabled = await isServiceAutoStartEnabled().catch(() => false);
            return actionHandler(enabled ? "disable" : "enable")();
        };

        const btnToggle = createActionButton(buttonsIDs.START, buttons.POSITIVE, _("Start"), toggleHandler, "start");
        const btnRestart = createActionButton(buttonsIDs.RESTART, buttons.ACTION, _("Restart"), actionHandler("restart", ACTION_DELAY_TIMEOUT), "restart");
        const btnAutoToggle = createActionButton(buttonsIDs.ENABLE, buttons.POSITIVE, _("Enable autostart"), autoToggleHandler, "enable");
        dynamicElements = { serviceBadge, autoBadge, versionBadge, packageValue, coreValue, onlinePackageValue: results.infoOnlinePackage, btnToggle, btnRestart, btnAutoToggle };

        const statusGrid = createStatusGrid({
            ...results,
            infoPackage: packageValue,
            infoCore: coreValue
        }, dynamicElements);

        const statusContainer = E("div", { class: "cbi-section fade-in" }, [
            E("h3", { class: "cbi-section-title" }, _("Current status:")),
            statusGrid
        ]);

        const actionContainer = E("div", { class: "jc-actions" }, [
            createActionButton(buttonsIDs.DIAGNOSTIC, buttons.NEUTRAL, _("Run diagnostics"), showExecModalHandler(_("Diagnostic report"), _("Diagnostic output may include sensitive configuration and connection details."), common.binPath, ["diag_report"]), "diagnostic"),
            createActionButton(buttonsIDs.UPDATE, buttons.NEUTRAL, _("Update core"), showExecModalHandler(_("Update Mihomo core"), false, common.binPath, ["core_update"], async () => {
                const res = await fs.exec(common.binPath, ["_luci_call"]);
                const [infoPackage, infoCore] = cleanStdout(res).split(",");

                if (dynamicElements.packageValue)
                    dynamicElements.packageValue.textContent = infoPackage || _("Error");

                if (dynamicElements.coreValue)
                    dynamicElements.coreValue.textContent = infoCore || _("Error");
            }), "update"),
            createActionButton(buttonsIDs.SERVICE_DATA_UPDATE, buttons.NEUTRAL, _("Update service data"), showExecModalHandler(_("Update service data"), false, common.binPath, ["service_data_update"]), "serviceData")
        ]);

        const actionContainerSecondary = E("div", { class: "jc-actions" }, [
            createActionButton(buttonsIDs.CONFIG_SHOW, buttons.NEUTRAL, _("Show Mihomo config"), showExecModalHandler(_("Mihomo config"), _("Do not share your Mihomo config with anyone."), common.binPath, ["diag_mihomo_config"]), "config"),
            createActionButton(buttonsIDs.CONFIG_SHOW_SECOND, buttons.NEUTRAL, _("Show service config"), showExecModalHandler(_("Service config"), _("Do not share your service config with anyone."), common.binPath, ["diag_service_config"]), "config"),
            createActionButton(buttonsIDs.CONFIG_RESET, buttons.NEGATIVE, _("Reset config"), showConfirmExecModalHandler(_("Reset configuration"), _("This will reset the JustClash configuration. Use with care."), common.binPath, ["config_reset"]), "reset")
        ]);

        const style = E("style", {}, `
            .jc-badge { display:inline-flex; align-items:center; padding:0.25em 0.55em; min-height:2em; border:1px solid var(--border-color-medium, #bfbfbf); border-radius:4px; background:none; color:inherit; font-weight:600; box-sizing:border-box; }
            .jc-badge-active { color:var(--success-color-medium, #4caf50); border-color:currentColor; }
            .jc-badge-inactive { color:var(--error-color-medium, #f44336); border-color:currentColor; }
            .jc-badge-warning { color:var(--warning-color, #c47f00); border-color:currentColor; }
            .jc-grid-top, .jc-grid-bottom { display:grid; gap:15px; }
            .jc-grid-top { grid-template-columns:repeat(2, 1fr); margin-bottom:15px; }
            .jc-grid-bottom { grid-template-columns:repeat(4, 1fr); margin-bottom:20px; }
            .jc-card { display:flex; flex-direction:column; padding:0.75em; border:1px solid var(--border-color-medium, #bfbfbf); border-radius:4px; }
            .jc-card-header { display:flex; align-items:center; gap:0.5em; margin-bottom:0.6em; font-size:1em; color:var(--text-color, inherit); opacity:0.78; }
            .jc-card-icon { display:inline-flex; align-items:center; justify-content:center; width:1.75em; height:1.75em; flex:0 0 1.75em; }
            .jc-card-icon-svg, .jc-button-icon-svg { width:100%; height:100%; stroke:currentColor; stroke-width:1; stroke-linecap:round; stroke-linejoin:round; }
            .jc-card-body { font-size:1.05em; font-weight:600; word-break:break-word; }
            .jc-card-inline { display:flex; align-items:center; justify-content:space-between; gap:0.5em; }
            .jc-card-inline-actions { display:flex; align-items:center; gap:0.35em; flex-shrink:0; }
            .jc-card-inline-actions .cbi-button, .jc-actions .cbi-button { margin-right:0; }
            .jc-actions { display:flex; flex-wrap:wrap; gap:0.5em; border-top:0; text-align:left; }
            .jc-actions + .jc-actions { margin-top:8px; }
            .jc-button-content { display:inline-flex; align-items:center; justify-content:center; gap:0.45em; vertical-align:middle; }
            .jc-button-icon { display:inline-flex; align-items:center; justify-content:center; width:1.75em; height:1.75em; line-height:1; }
            .jc-modal-warning { color: var(--error-color-medium); }
            .jc-modal-warning-text { margin-top: 1em; color: var(--error-color-medium); }
            .jc-modal-pre { max-height: 460px; overflow: auto; }
            .jc-modal-actions { text-align: right; margin-top: 1em; }
            @media (max-width:1000px) { .jc-grid-bottom { grid-template-columns:repeat(2, 1fr); } }
            @media (max-width:600px) { .jc-grid-top, .jc-grid-bottom { grid-template-columns:1fr; } .jc-card-inline { align-items:flex-start; } .jc-card-inline-actions { margin-left:auto; } }
        `);

        startPolling(dynamicElements);

        requestAnimationFrame(() => {
            updateUI(dynamicElements, results.infoIsAutostarting, results.infoIsRunning);
        });

        return E("div", { class: "cbi-map" }, [
            style,
            E("div", { class: "cbi-section" }, [
                statusContainer,
                actionContainer,
                actionContainerSecondary
            ])
        ]);
    },

    leave() {
        stopPolling();
        if (visibilityChangeHandler) {
            document.removeEventListener("visibilitychange", visibilityChangeHandler);
            visibilityChangeHandler = null;
        }
    }
});
