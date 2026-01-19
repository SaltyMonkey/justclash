"use strict";
"require ui";
"require view";
"require fs";
"require view.justclash.common as common";
"require rpc";

const callSystemBoard = rpc.declare({
    object: 'system',
    method: 'board',
    params: [],
    expect: { '': {} }
});

const fetchWithTimeout = (url, timeout = 3000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    return fetch(url, { signal: controller.signal })
        .finally(() => clearTimeout(timeoutId));
};

const cleanStdout = (val) =>
    val && val.stdout ? val.stdout.replace(/[\r\n]+/g, "").trim() : _("Error");

const asyncTimeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createTable = (results, dynamicStatusCells) => {
    return E("table", { class: "table cbi-rowstyle-1" }, [
        E("tr", { class: "tr cbi-rowstyle-1" }, [
            E("td", { class: "td left" }, "💻 " + _("Device model:")),
            E("td", { class: "td left" }, results.infoDevice),
        ]),
        E("tr", { class: "tr cbi-rowstyle-2" }, [
            E("td", { class: "td left" }, "✨ " + _("System version:")),
            E("td", { class: "td left" }, results.infoOpenWrt),
        ]),
        E("tr", { class: "tr cbi-rowstyle-1" }, [
            E("td", { class: "td left" }, "🌐 " + _("Latest service package version:")),
            E("td", { class: "td left" }, results.infoOnlinePackage),
        ]),
        E("tr", { class: "tr cbi-rowstyle-1" }, [
            E("td", { class: "td left" }, "📦 " + _("Service package version:")),
            E("td", { class: "td left" }, results.infoPackage),
        ]),
        E("tr", { class: "tr cbi-rowstyle-2" }, [
            E("td", { class: "td left" }, "📦 " + _("LuCI package version:")),
            E("td", { class: "td left" }, common.justclashLuciVersion),
        ]),
        E("tr", { class: "tr cbi-rowstyle-1" }, [
            E("td", { class: "td left" }, "😸 " + _("Mihomo core version:")),
            E("td", { class: "td left" }, results.infoCore),
        ]),
        E("tr", { class: "tr cbi-rowstyle-2" }, [
            E("td", { class: "td left" }, "🚀 " + _("Service is running:")),
            dynamicStatusCells.serviceStatus,
        ]),
        E("tr", { class: "tr cbi-rowstyle-1" }, [
            E("td", { class: "td left" }, "📃 " + _("Service's autostart:")),
            dynamicStatusCells.daemonStatus,
        ]),
    ]);
};

const showExecModalHandler = (title, warning, command, args) =>
    ui.createHandlerFn(this, async () => {
        ui.showModal(title, [E("p", _("Please wait..."))]);
        const warn = warning ? [E("strong", { style: "color:var(--error-color-medium)" }, _("Dangerous action!")), E("div", { style: "margin-top:1em;color:var(--error-color-medium)" }, warning)] : [];
        try {
            const res = await fs.exec(command, args);
            ui.showModal(title, [
                ...warn,
                E("pre", { style: "max-height: 460px; overflow:auto;" }, res.stdout || _("No output")),
                E("div", { style: "text-align: right; margin-top: 1em;" }, [
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
    });

const createActionButton = (action, cssClass, label, handler) =>
    E("button", {
        class: `cbi-button ${cssClass}`,
        id: `${action}`,
        click: handler,
    }, [label]);

const boolToWord = (val) => (val ? _("Yes") : _("No"));

const boolToStyle = (active) => {
    const color = "var(--on-primary-color)";
    const background = active
        ? "var(--success-color-medium)"
        : "var(--error-color-medium)";
    const padding = "3px";
    const borderRadius = "4px";

    return (
        `color: ${color}; ` +
        `background-color: ${background}; ` +
        `padding: ${padding}; ` +
        `border-radius: ${borderRadius};`
    );
};
const buttons = {
    POSITIVE: "cbi-button-positive",
    NEGATIVE: "cbi-button-negative",
    NEUTRAL: "cbi-button-neutral",
    ACTION: "cbi-button-action"
};

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

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,
    pollInterval: null,
    pollServiceStatusTimeout: 3000,

    async isServiceAutoStartEnabled() {
        const res = await fs.exec(common.initdPath, ["enabled"]);
        return res.code === 0;
    },
    async isServiceRunning() {
        const res = await fs.exec(common.initdPath, ["running"]);
        return res.code === 0;
    },
    async load() {
        const [
            infoDevice, infoOpenWrt
        ] = await callSystemBoard()
            .catch((e) => {
                ui.addNotification(_("Error"), E("p", `${e.message || e}`), "danger");
                return [_("Error"), _("Error")];
            })
            .then(data => {
                //console.log(data);
                return [data.model || _("Error"), data.release ? data.release.description : _("Error")];
            });

        const [
            infoPackage, infoCore
        ] = await fs.exec(common.binPath, ["_luci_call"])
            .catch((e) => {
                ui.addNotification(_("Error"), E("p", `${e.message || e}`), "danger");
                return [_("Error"), _("Error")];
            })
            .then(data => (cleanStdout(data).split(",")));

        const infoOnlinePackage = await fetchWithTimeout(common.justclashOnlineVersionUrl, 5000)
            .then(response => {
                if (!response.ok) {
                    console.error("Error fetching latest release:", response);
                    return _("Error");
                }
                return response.json();
            })
            .then(data => {
                if (data && data.tag_name) {
                    return data.tag_name.replace(/^v/, "");
                }
                else {
                    console.error("Error fetching latest release:", data);
                    return _("Error");
                }
            })
            .catch(e => {
                if (e.name === 'AbortError') {
                    console.error("Request timeout:", e);
                    return _("Timeout");
                }
                console.error("Error fetching latest release:", e);
                return _("Error");
            });

        const [
            infoIsRunning, infoIsAutostarting
        ] = await Promise.all([
            this.isServiceRunning().catch((e) => {
                ui.addNotification(_("Error"), E("p", `${e.message || e}`), "danger");
                return false;
            }),
            this.isServiceAutoStartEnabled().catch((e) => {
                ui.addNotification(_("Error"), E("p", `${e.message || e}`), "danger");
                return false;
            })
        ]);

        return {
            infoDevice, infoOpenWrt, infoOnlinePackage, infoPackage, infoCore,
            infoIsRunning, infoIsAutostarting
        };
    },
    async render(results) {
        const serviceStatus = E("td", { class: "td left", id: "is-running" }, [
            E("span", { style: boolToStyle(results.infoIsRunning) }, [
                boolToWord(results.infoIsRunning)
            ])
        ]);

        const daemonStatus = E("td", { class: "td left", id: "is-autostarting" }, [
            E("span", { style: boolToStyle(results.infoIsAutostarting) }, [
                boolToWord(results.infoIsAutostarting)
            ])
        ]);

        const dynamicStatusCells = { serviceStatus, daemonStatus };

        const statusContainer = E("div", { class: "cbi-section fade-in" }, [
            E("h3", { class: "cbi-section-title" }, _("Service status:")),
            createTable(results, dynamicStatusCells)
        ]);

        const actionHandler = (action, timeoutMs) =>
            ui.createHandlerFn(this, async function () {
                ui.showModal(_("Executing command..."), [E("p", _("Please wait."))]);
                try {
                    await fs.exec(common.initdPath, [action]);
                    if (timeoutMs) await asyncTimeout(timeoutMs);
                    await this.updateServiceStatus(dynamicStatusCells);
                } catch (e) {
                    ui.addNotification(_("Error"), E("p", `${e.message || e}`), "danger");
                } finally {
                    ui.hideModal();
                }
            });

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

        this.startPolling(dynamicStatusCells, results.infoIsRunning);

        const style = E("style", {}, `
            td {
                padding: 6px 6px 6px !important;
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
            .jc-margin-right {
                margin-left: auto;
            }
        `);

        requestAnimationFrame(() => {
            this.updateUI(dynamicStatusCells, results.infoIsAutostarting, results.infoIsRunning);
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
    updateUI(dynamicStatusCells, isAutostarting, isRunning) {
        const runningSpan = dynamicStatusCells.serviceStatus.querySelector("span");
        const autoSpan = dynamicStatusCells.daemonStatus.querySelector("span");

        if (runningSpan) {
            runningSpan.textContent = boolToWord(isRunning);
            runningSpan.style = boolToStyle(isRunning);
        }
        if (autoSpan) {
            autoSpan.textContent = boolToWord(isAutostarting);
            autoSpan.style = boolToStyle(isAutostarting);
        }

        const btnStart = document.getElementById(buttonsIDs.START);
        const btnStop = document.getElementById(buttonsIDs.STOP);
        const btnEnable = document.getElementById(buttonsIDs.ENABLE);
        const btnDisable = document.getElementById(buttonsIDs.DISABLE);
        if (btnStart) btnStart.disabled = isRunning;
        if (btnStop) btnStop.disabled = !isRunning;
        if (btnEnable) btnEnable.disabled = isAutostarting;
        if (btnDisable) btnDisable.disabled = !isAutostarting;
    },
    async updateServiceStatus(dynamicStatusCells) {
        const [isRunning, isAutostarting] = await Promise.all([
            this.isServiceRunning().catch((e) => {
                ui.addNotification(_("Error"), E("p", `${e.message || e}`), "danger");
                return false;
            }),
            this.isServiceAutoStartEnabled().catch((e) => {
                ui.addNotification(_("Error"), E("p", `${e.message || e}`), "danger");
                return false;
            })
        ]);
        requestAnimationFrame(() => {
            this.updateUI(dynamicStatusCells, isAutostarting, isRunning);
        });
    },
    startPolling(dynamicStatusCells) {
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.pollInterval = setInterval(() => {
            this.updateServiceStatus(dynamicStatusCells);
        }, this.pollServiceStatusTimeout);

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                clearInterval(this.pollInterval);
                this.pollInterval = null;
            } else {
                this.startPolling(dynamicStatusCells);
            }
        });
    },
    destroy() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
});
