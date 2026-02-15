"use strict";
"require ui";
"require view";
"require fs";
"require view.justclash.common as common";
"require rpc";

let pollInterval = null;
const POLL_TIMEOUT = 3000;

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

const fetchWithTimeout = (url, timeout = 3000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    return fetch(url, { signal: controller.signal })
        .finally(() => clearTimeout(timeoutId));
};

const cleanStdout = (val) =>
    val && val.stdout ? val.stdout.replace(/[\r\n]+/g, "").trim() : _("Error");

const asyncTimeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const boolToWordAutostart = (val) => (val ? _("Enabled") : _("Disabled"));

const boolToWordRunning = (val) => (val ? _("Running") : _("Stopped"));

const boolToStyle = (active) => {
    const color = "var(--on-primary-color, #fff)";
    const background = active
        ? "var(--success-color-medium, #4caf50)"
        : "var(--error-color-medium, #f44336)";
    return `color: ${color}; background-color: ${background}; padding: 3px 8px; border-radius: 4px; font-weight: bold;`;
};

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
            // Строка 1
            createCard("🚀", _("Service"), dynamicElements.serviceBadge),
            createCard("⚡", _("Autostart"), dynamicElements.autoBadge),
            // Строка 2
            createCard("💻", _("Device model"), results.infoDevice),
            createCard("✨", _("System version"), results.infoOpenWrt),
        ]),
        // Нижняя сетка (4 колонки)
        E("div", { class: "jc-grid-bottom" }, [
            createCard("🌐", _("Latest version"), results.infoOnlinePackage),
            createCard("📦", _("Service version"), results.infoPackage),
            createCard("🎨", _("LuCI version"), common.justclashLuciVersion),
            createCard("😸", _("Mihomo core"), results.infoCore),
        ])
    ]);
};

const updateUI = (dynamicElements, isAutostarting, isRunning) => {
    if (dynamicElements.serviceBadge) {
        dynamicElements.serviceBadge.textContent = boolToWordRunning(isRunning);
        dynamicElements.serviceBadge.setAttribute("style", boolToStyle(isRunning));
    }

    if (dynamicElements.autoBadge) {
        dynamicElements.autoBadge.textContent = boolToWordAutostart(isAutostarting);
        dynamicElements.autoBadge.setAttribute("style", boolToStyle(isAutostarting));
    }

    const btnStart = document.getElementById(buttonsIDs.START);
    const btnStop = document.getElementById(buttonsIDs.STOP);
    const btnEnable = document.getElementById(buttonsIDs.ENABLE);
    const btnDisable = document.getElementById(buttonsIDs.DISABLE);

    if (btnStart) btnStart.disabled = isRunning;
    if (btnStop) btnStop.disabled = !isRunning;
    if (btnEnable) btnEnable.disabled = isAutostarting;
    if (btnDisable) btnDisable.disabled = !isAutostarting;
};

const updateServiceStatus = async (dynamicElements) => {
    const [isRunning, isAutostarting] = await Promise.all([
        isServiceRunning().catch(() => false),
        isServiceAutoStartEnabled().catch(() => false)
    ]);

    requestAnimationFrame(() => {
        updateUI(dynamicElements, isAutostarting, isRunning);
    });
};

const stopPolling = () => {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
};

const startPolling = (dynamicElements) => {
    stopPolling();
    pollInterval = setInterval(() => {
        updateServiceStatus(dynamicElements);
    }, POLL_TIMEOUT);

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            stopPolling();
        } else {
            updateServiceStatus(dynamicElements);
            pollInterval = setInterval(() => {
                updateServiceStatus(dynamicElements);
            }, POLL_TIMEOUT);
        }
    }, { once: true });
};

const showExecModalHandler = (title, warning, command, args) =>
    async () => {
        ui.showModal(title, [E("p", _("Please wait..."))]);
        const warn = warning ? [E("strong", { style: "color:var(--error-color-medium)" }, _("Dangerous action!")), E("div", { style: "margin-top:1em;color:var(--error-color-medium)" }, warning)] : [];
        try {
            const res = await fs.exec(command, args);
            ui.showModal(title, [
                ...warn,
                E("pre", { style: "max-height: 460px; overflow:auto;" }, res.stdout || _("No output")),
                E("div", { style: "text-align: right; margin-top: 1em;" }, [
                    E("button", {
                        class: `cbi-button ${buttons.ACTION}`,
                        click: () => {
                            copyToClipboard(res.stdout);
                            ui.addNotification(null, E("p", _("Data copied to clipboard")), "success", 3000);
                            ui.hideModal();
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
                E("div", { style: "text-align: right; margin-top: 1em;" }, [
                    E("button", {
                        class: "cbi-button",
                        click: () => ui.hideModal()
                    }, [_("Dismiss")])
                ])
            ]);
        }
    };

const createActionButton = (action, cssClass, label, handler) =>
    E("button", {
        class: `cbi-button ${cssClass}`,
        id: `${action}`,
        click: handler,
    }, [label]);

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,

    async load() {
        const [infoDevice, infoOpenWrt] = await callSystemBoard()
            .catch(e => [_("Error"), _("Error")])
            .then(data => [data.model || _("Error"), data.release ? data.release.description : _("Error")]);

        const [infoPackage, infoCore] = await fs.exec(common.binPath, ["_luci_call"])
            .catch(() => [_("Error"), _("Error")])
            .then(data => (cleanStdout(data).split(",")));

        const infoOnlinePackage = await fetchWithTimeout(common.justclashOnlineVersionUrl, 5000)
            .then(res => res.ok ? res.json() : null)
            .then(data => data && data.tag_name ? data.tag_name.replace(/^v/, "") : _("Error"))
            .catch(e => {
                if (e.name === 'AbortError') return _("Timeout");
                return _("Error");
            });

        const [infoIsRunning, infoIsAutostarting] = await Promise.all([
            isServiceRunning().catch(() => false),
            isServiceAutoStartEnabled().catch(() => false)
        ]);

        return {
            infoDevice, infoOpenWrt, infoOnlinePackage, infoPackage, infoCore,
            infoIsRunning, infoIsAutostarting
        };
    },

    async render(results) {
        stopPolling();

        const serviceBadge = E("span", { class: "jc-badge" }, _("Loading..."));
        const autoBadge = E("span", { class: "jc-badge" }, _("Loading..."));

        const dynamicElements = { serviceBadge, autoBadge };

        const statusGrid = createStatusGrid(results, dynamicElements);
        const statusContainer = E("div", { class: "cbi-section fade-in" }, [
            E("h3", { class: "cbi-section-title" }, _("Service status:")),
            statusGrid
        ]);

        const actionHandler = (action, timeoutMs) =>
            async () => {
                ui.showModal(_("Executing command..."), [E("p", _("Please wait."))]);
                try {
                    await fs.exec(common.initdPath, [action]);
                    if (timeoutMs) await asyncTimeout(timeoutMs);
                    await updateServiceStatus(dynamicElements);
                } catch (e) {
                    ui.addNotification(_("Error"), E("p", e.message), "danger", 3000);
                    console.error("Error:", e);
                } finally {
                    ui.hideModal();
                }
            };

        const actionContainer = E("div", { class: "cbi-page-actions jc-actions" }, [
            createActionButton(buttonsIDs.START, buttons.POSITIVE, _("Start"), actionHandler("start", 5000)),
            createActionButton(buttonsIDs.RESTART, buttons.ACTION, _("Restart"), actionHandler("restart", 5000)),
            createActionButton(buttonsIDs.STOP, buttons.NEGATIVE, _("Stop"), actionHandler("stop")),
        ]);

        const actionContainerSecondary = E("div", { class: "cbi-page-actions jc-actions" }, [
            createActionButton(buttonsIDs.ENABLE, buttons.POSITIVE, _("Enable autostart"), actionHandler("enable")),
            createActionButton(buttonsIDs.DISABLE, buttons.NEGATIVE, _("Disable autostart"), actionHandler("disable"))
        ]);

        const actionContainerThird = E("div", { class: "cbi-page-actions jc-actions" }, [
            createActionButton(buttonsIDs.DIAGNOSTIC, buttons.NEUTRAL, _("Diagnostic"), showExecModalHandler(_("Diagnostic"), false, common.binPath, ["diag_report"])),
            createActionButton(buttonsIDs.UPDATE, buttons.NEUTRAL, _("Update Mihomo"), showExecModalHandler(_("Update Mihomo"), false, common.binPath, ["core_update"])),
            createActionButton(buttonsIDs.CONFIG_SHOW, buttons.NEUTRAL, _("Mihomo config"), showExecModalHandler(_("Mihomo configuration"), _("Do not show your mihomo config to anyone!"), common.binPath, ["diag_mihomo_config"])),
            createActionButton(buttonsIDs.CONFIG_SHOW_SECOND, buttons.NEUTRAL, _("Service config"), showExecModalHandler(_("Service configuration"), _("Do not show your service config to anyone!"), common.binPath, ["diag_service_config"])),
            createActionButton(buttonsIDs.SERVICE_DATA_UPDATE, buttons.NEUTRAL, _("Update service data"), showExecModalHandler(_("Update service data"), false, common.binPath, ["service_data_update"])),
        ]);

        // CSS
        const style = E("style", {}, `
            /* Top Grid: 2 колонки */
            .jc-grid-top {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
                margin-bottom: 15px;
            }

            /* Bottom Grid: 4 колонки */
            .jc-grid-bottom {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 15px;
                margin-bottom: 20px;
            }

            /* Card Style */
            .jc-card {
                border: 1px solid #1676bb;
                border-radius: 4px;
                padding: 10px;
                display: flex;
                flex-direction: column;
            }

            .jc-card-header {
                display: flex;
                align-items: center;
                margin-bottom: 8px;
                opacity: 0.8;
                font-size: 0.9em;
                text-transform: uppercase;
            }
            .jc-card-icon {
                font-size: 1.2em;
                margin-right: 8px;
            }
            .jc-card-body {
                font-size: 1.1em;
                font-weight: 600;
                word-break: break-all;
            }

            @media (max-width: 1000px) {
                /* На планшетах нижний ряд сворачивается в 2 строки по 2 */
                .jc-grid-bottom { grid-template-columns: repeat(2, 1fr); }
            }
            @media (max-width: 600px) {
                /* На мобильных всё в 1 колонку */
                .jc-grid-top, .jc-grid-bottom { grid-template-columns: 1fr; }
            }

            .cbi-page-actions {
                margin-bottom: 10px !important;
                padding: 10px 10px 10px 10px !important;
            }
            .cbi-button { margin-right: 0.5em; }
            .jc-actions {
                display: flex;
                flex-flow: row;
                flex-wrap: wrap;
                row-gap: 1em;
                text-align: left !important;
                border-top: 0px !important;
            }
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

    leave: function () {
        stopPolling();
    }
});
