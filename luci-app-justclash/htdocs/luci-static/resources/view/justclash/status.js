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

const showExecModalHandler = (title, command, args) =>
    ui.createHandlerFn(this, async () => {
        ui.showModal(title, [E("p", _("Please wait..."))]);

        try {
            const res = await fs.exec(command, args);
            ui.showModal(title, [
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

const showDangerConfirm = (message, onYes) => {
    ui.showModal(_("ATTENTION!"), [
        E("div", {}, [
            E("strong", { style: "color:#a00" }, _("This action is irreversible!")),
            E("div", { style: "margin-top:1em" }, message)
        ]),
        E("div", { class: "right" }, [
            E("button", {
                class: "cbi-button cbi-button-remove",
                click: ui.hideModal
            }, [_("Cancel")]),
            E("button", {
                class: "cbi-button cbi-button-negative",
                style: "margin-left:1em",
                click: function () {
                    ui.hideModal();
                    onYes();
                }
            }, [_("Reset config")])
        ])
    ]);
};

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
                console.log(data);
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
            infoDevice, infoOpenWrt, infoPackage, infoCore,
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
            createActionButton(buttonsIDs.CONFIG_RESET, `${buttons.NEGATIVE} jc-margin-right`, _("Reset config"), () => showDangerConfirm(_("Reset configuration to default?"), showExecModalHandler(_("Reset config result"), common.binPath, ["config_reset"])))

        ]);

        const actionContainerSecondary = E("div", { class: "cbi-page-actions jc-actions" }, [
            createActionButton(buttonsIDs.ENABLE, buttons.POSITIVE, _("Enable autostart"), actionHandler("enable")),
            createActionButton(buttonsIDs.DISABLE, buttons.NEGATIVE, _("Disable autostart"), actionHandler("disable"))
        ]);

        const actionContainerThird = E("div", { class: "cbi-page-actions jc-actions" }, [
            createActionButton(buttonsIDs.DIAGNOSTIC, buttons.NEUTRAL, _("Diagnostic"), showExecModalHandler(_("Diagnostic"), common.binPath, ["diag_report"])),
            createActionButton(buttonsIDs.CONFIG_SHOW, buttons.NEUTRAL, _("Mihomo config"), showExecModalHandler(_("Mihomo configuration"), common.binPath, ["diag_mihomo_config"])),
            createActionButton(buttonsIDs.UPDATE, buttons.NEUTRAL, _("Update Mihomo"), showExecModalHandler(_("Update Mihomo"), common.binPath, ["core_update"])),
            createActionButton(buttonsIDs.SERVICE_DATA_UPDATE, buttons.NEUTRAL, _("Update service data"), showExecModalHandler(_("Update service data"), common.binPath, ["service_data_update"])),
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
