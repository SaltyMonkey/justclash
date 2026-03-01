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
    STOP: "button-stop",
    RESTART: "button-restart",
    ENABLE: "button-enable",
    DISABLE: "button-disable",
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

const callSystemBoard = rpc.declare({
    object: 'system',
    method: 'board',
    params: [],
    expect: { '': {} }
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

const isServiceAutoStartEnabled = async () => {
    const res = await fs.exec(common.initdPath, ["enabled"]);
    return res.code === 0;
};

const isServiceRunning = async () => {
    const res = await fs.exec(common.initdPath, ["running"]);
    return res.code === 0;
};

const createCard = (icon, label, valueContent) => {
    return E("div", { class: "jc-card" }, [
        E("div", { class: "jc-card-header" }, [
            E("span", { class: "jc-card-icon" }, icon),
            E("span", { class: "jc-card-label" }, label),
        ]),
        E("div", { class: "jc-card-body" }, valueContent)
    ]);
};

const createStatusGrid = (results, dynamicElements) => {
    return E("div", {}, [
        E("div", { class: "jc-grid-top" }, [
            createCard("🚀", _("Service"), dynamicElements.serviceBadge),
            createCard("⚡", _("Start on boot"), dynamicElements.autoBadge),
            createCard("💻", _("Router model"), results.infoDevice),
            createCard("✨", _("OpenWrt version"), results.infoOpenWrt),
        ]),
        E("div", { class: "jc-grid-bottom" }, [
            createCard("🌐", _("Latest release"), results.infoOnlinePackage),
            createCard("📦", _("Installed version"), results.infoPackage),
            createCard("🎨", _("LuCI version"), common.justclashLuciVersion),
            createCard("😸", _("Mihomo core"), results.infoCore),
        ])
    ]);
};

const updateUI = (dynamicElements, isAutostarting, isRunning) => {
    if (dynamicElements.serviceBadge) {
        dynamicElements.serviceBadge.textContent = boolToWordRunning(isRunning);
        dynamicElements.serviceBadge.className = `jc-badge ${isRunning ? 'jc-badge-active' : 'jc-badge-inactive'}`;
    }

    if (dynamicElements.autoBadge) {
        dynamicElements.autoBadge.textContent = boolToWordAutostart(isAutostarting);
        dynamicElements.autoBadge.className = `jc-badge ${isAutostarting ? 'jc-badge-active' : 'jc-badge-inactive'}`;
    }

    if (dynamicElements.btnStart) dynamicElements.btnStart.disabled = isRunning;
    if (dynamicElements.btnStop) dynamicElements.btnStop.disabled = !isRunning;
    if (dynamicElements.btnEnable) dynamicElements.btnEnable.disabled = isAutostarting;
    if (dynamicElements.btnDisable) dynamicElements.btnDisable.disabled = !isAutostarting;
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

const createActionButton = (action, cssClass, label, handler) =>
    E("button", { class: `cbi-button ${cssClass}`, id: `${action}`, click: handler }, [label]);

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
            .catch(e => e.name === 'AbortError' ? _("Timeout") : _("Error"));

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
        const packageValue = E("span", {}, results.infoPackage);
        const coreValue = E("span", {}, results.infoCore);
        let dynamicElements = { serviceBadge, autoBadge, packageValue, coreValue };

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

        const btnStart = createActionButton(buttonsIDs.START, buttons.POSITIVE, _("Start"), actionHandler("start", ACTION_DELAY_TIMEOUT));
        const btnRestart = createActionButton(buttonsIDs.RESTART, buttons.ACTION, _("Restart"), actionHandler("restart", ACTION_DELAY_TIMEOUT));
        const btnStop = createActionButton(buttonsIDs.STOP, buttons.NEGATIVE, _("Stop"), actionHandler("stop"));
        const btnEnable = createActionButton(buttonsIDs.ENABLE, buttons.POSITIVE, _("Enable autostart"), actionHandler("enable"));
        const btnDisable = createActionButton(buttonsIDs.DISABLE, buttons.NEGATIVE, _("Disable autostart"), actionHandler("disable"));
        dynamicElements = { serviceBadge, autoBadge, packageValue, coreValue, btnStart, btnStop, btnEnable, btnDisable };

        const statusGrid = createStatusGrid({
            ...results,
            infoPackage: packageValue,
            infoCore: coreValue
        }, dynamicElements);
        const statusContainer = E("div", { class: "cbi-section fade-in" }, [
            E("h3", { class: "cbi-section-title" }, _("Current status:")),
            statusGrid
        ]);

        const actionContainer = E("div", { class: "cbi-page-actions jc-actions" }, [
            btnStart,
            btnRestart,
            btnStop
        ]);

        const actionContainerSecondary = E("div", { class: "cbi-page-actions jc-actions" }, [
            btnEnable,
            btnDisable
        ]);

        const actionContainerThird = E("div", { class: "cbi-page-actions jc-actions" }, [
            createActionButton(buttonsIDs.DIAGNOSTIC, buttons.NEUTRAL, _("Run diagnostics"), showExecModalHandler(_("Diagnostic report"), false, common.binPath, ["diag_report"])),
            createActionButton(buttonsIDs.UPDATE, buttons.NEUTRAL, _("Update core"), showExecModalHandler(_("Update Mihomo core"), false, common.binPath, ["core_update"], async () => {
                const res = await fs.exec(common.binPath, ["_luci_call"]);
                const [infoPackage, infoCore] = cleanStdout(res).split(",");

                if (dynamicElements.packageValue)
                    dynamicElements.packageValue.textContent = infoPackage || _("Error");

                if (dynamicElements.coreValue)
                    dynamicElements.coreValue.textContent = infoCore || _("Error");
            })),
            createActionButton(buttonsIDs.CONFIG_SHOW, buttons.NEUTRAL, _("Show Mihomo config"), showExecModalHandler(_("Mihomo config"), _("Do not share your Mihomo config with anyone."), common.binPath, ["diag_mihomo_config"])),
            createActionButton(buttonsIDs.CONFIG_SHOW_SECOND, buttons.NEUTRAL, _("Show service config"), showExecModalHandler(_("Service config"), _("Do not share your service config with anyone."), common.binPath, ["diag_service_config"])),
            createActionButton(buttonsIDs.SERVICE_DATA_UPDATE, buttons.NEUTRAL, _("Refresh service data"), showExecModalHandler(_("Refresh service data"), false, common.binPath, ["service_data_update"]))
        ]);

        const style = E("style", {}, `
            .jc-badge { padding: 3px 8px; border-radius: 4px; font-weight: bold; color: var(--on-primary-color, #fff); }
            .jc-badge-active { background-color: var(--success-color-medium, #4caf50); }
            .jc-badge-inactive { background-color: var(--error-color-medium, #f44336); }
            .jc-grid-top { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 15px; }
            .jc-grid-bottom { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }
            .jc-card { border: 1px solid #1676bb; border-radius: 4px; padding: 10px; display: flex; flex-direction: column; }
            .jc-card-header { display: flex; align-items: center; margin-bottom: 8px; opacity: 0.8; font-size: 0.9em; text-transform: uppercase; }
            .jc-card-icon { font-size: 1.2em; margin-right: 8px; }
            .jc-card-body { font-size: 1.1em; font-weight: 600; word-break: break-all; }
            @media (max-width:1000px){.jc-grid-bottom{grid-template-columns:repeat(2,1fr);}}
            @media (max-width:600px){.jc-grid-top,.jc-grid-bottom{grid-template-columns:1fr;}}
            .cbi-page-actions{margin-bottom:10px !important;padding:10px !important;}
            .cbi-button{margin-right:0.5em;}
            .jc-actions{display:flex;flex-flow:row;flex-wrap:wrap;row-gap:1em;text-align:left !important;border-top:0px !important;}
            .jc-modal-warning{color:var(--error-color-medium);}
            .jc-modal-warning-text{margin-top:1em;color:var(--error-color-medium);}
            .jc-modal-pre{max-height:460px; overflow:auto;}
            .jc-modal-actions{text-align:right;margin-top:1em;}
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
                actionContainerSecondary,
                actionContainerThird
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
