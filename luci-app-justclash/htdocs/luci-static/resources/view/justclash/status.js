"use strict";
"require ui";
"require view";
"require fs";
"require view.justclash.common as common";

const cleanStdout = (val) =>
    val && val.stdout ? val.stdout.replace("\\n", "").trim() : _("Error");

const asyncTimeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createTable = (results, statusCells) => {
    const rows = [
        E("tr", { class: "tr cbi-rowstyle-1" }, [
            E("td", { class: "td left" }, "💻 " + _("Device model:")),
            E("td", { class: "td left" }, cleanStdout(results.infoDevice)),
        ]),
        E("tr", { class: "tr cbi-rowstyle-2" }, [
            E("td", { class: "td left" }, "✨ " + _("System version:")),
            E("td", { class: "td left" }, cleanStdout(results.infoOpenWrt)),
        ]),
        E("tr", { class: "tr cbi-rowstyle-1" }, [
            E("td", { class: "td left" }, "📦 " + _("Service package version:")),
            E("td", { class: "td left" }, cleanStdout(results.infoPackage)),
        ]),
        E("tr", { class: "tr cbi-rowstyle-2" }, [
            E("td", { class: "td left" }, "📦 " + _("LuCI package version:")),
            E("td", { class: "td left" }, common.justclashLuciVersion),
        ]),
        E("tr", { class: "tr cbi-rowstyle-1" }, [
            E("td", { class: "td left" }, "😸 " + _("Mihomo core version:")),
            E("td", { class: "td left" }, cleanStdout(results.infoCore)),
        ]),
        E("tr", { class: "tr cbi-rowstyle-2" }, [
            E("td", { class: "td left" }, "🚀 " + _("Service is running:")),
            statusCells.serviceStatus,
        ]),
        E("tr", { class: "tr cbi-rowstyle-1" }, [
            E("td", { class: "td left" }, "📃 " + _("Service's autostart:")),
            statusCells.daemonStatus,
        ]),
    ];
    return E("table", { class: "table cbi-rowstyle-1" }, rows);
};

const createActionButton = (action, cssClass, label, handler) =>
    E("button", {
        class: `cbi-button ${cssClass}`,
        id: `button${action}`,
        click: handler,
    }, [label]);

const boolToWord = (val) => (val ? _("Yes") : _("No"));

const boolToStyle = (active) =>
    `color: var(--on-primary-color); background-color: ${active ? "var(--success-color-medium)" : "var(--error-color-medium)"
    }; padding: 3px; border-radius: 4px;`;

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,
    pollInterval: null,
    pollServiceStatusTimeout: 5000,

    async isJustClashAutostartEnabled() {
        const res = await fs.exec(common.initdPath, ["enabled"]);
        return res.code === 0;
    },
    async isJustClashRunning() {
        const res = await fs.exec(common.initdPath, ["running"]);
        return res.code === 0;
    },

    async load() {
        const [
            infoDevice, infoOpenWrt, infoPackage, infoCore
        ] = await Promise.all([
            fs.exec(common.binPath, ["info_device"]).catch(() => _("Error")),
            fs.exec(common.binPath, ["info_openwrt"]).catch(() => _("Error")),
            fs.exec(common.binPath, ["info_package"]).catch(() => _("Error")),
            fs.exec(common.binPath, ["info_core"]).catch(() => _("Error"))
        ]);
        const [infoIsRunning, infoIsAutostarting] = await Promise.all([
            this.isJustClashRunning().catch(() => false),
            this.isJustClashAutostartEnabled().catch(() => false)
        ]);
        return {
            infoDevice, infoOpenWrt, infoPackage, infoCore,
            infoIsRunning, infoIsAutostarting
        };
    },

    async render(results) {
        const serviceStatus = E("td", {
            class: "td left",
            id: "isrunning"
        }, [
            E("span", {
                style: boolToStyle(results.infoIsRunning)
            }, boolToWord(results.infoIsRunning))
        ]);

        const daemonStatus = E("td", {
            class: "td left",
            id: "isautostarting"
        }, [
            E("span", {
                style: boolToStyle(results.infoIsAutostarting)
            }, boolToWord(results.infoIsAutostarting))
        ]);

        const statusCells = { serviceStatus, daemonStatus };

        const statusContainer = E("div", { class: "cbi-section fade-in" }, [
            E("h3", { class: "cbi-section-title" }, _("Service status:")),
            createTable(results, statusCells)
        ]);

        const actionHandler = (action, timeoutMs) =>
            ui.createHandlerFn(this, async function () {
                ui.showModal(_("Executing command..."), [E("p", _("Please wait."))]);
                try {
                    await fs.exec(common.initdPath, [action]);
                    if (timeoutMs) await asyncTimeout(timeoutMs);
                    await this.updateServiceStatus(statusCells);
                } catch (e) {
                    ui.addNotification(_("Error"), e.message, "danger");
                } finally {
                    ui.hideModal();
                }
            });

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

        const showExecModalHandler = (title, command, args) =>
            ui.createHandlerFn(this, async () => {
                const buttons = document.querySelectorAll(".cbi-button");
                buttons.forEach(btn => btn.disabled = true);
                ui.showModal(title, [E("p", _("Please wait..."))]);

                try {
                    const res = await fs.exec(command, args);
                    ui.showModal(title, [
                        E("pre", { style: "max-height: 460px; overflow:auto;" }, res.stdout || _("No output")),
                        E("div", { style: "text-align: right; margin-top: 1em;" }, [
                            E("button", {
                                class: "cbi-button",
                                click: () => ui.hideModal()
                            }, _("Dismiss"))
                        ])
                    ]);
                } catch (e) {
                    ui.showModal(_("Error"), [
                        E("div", { class: "alert-message error" }, e.message),
                        E("div", { style: "text-align: right; margin-top: 1em;" }, [
                            E("button", {
                                class: "cbi-button",
                                click: () => ui.hideModal()
                            }, _("Dismiss"))
                        ])
                    ]);
                } finally {
                    buttons.forEach(btn => btn.disabled = false);
                }
            });

        const actionContainer = E("div", { class: "cbi-page-actions jc-actions" }, [
            createActionButton("start", "cbi-button-positive", _("Start"), actionHandler("start", 5000)),
            createActionButton("restart", "cbi-button-action", _("Restart"), actionHandler("restart", 5000)),
            createActionButton("stop", "cbi-button-negative", _("Stop"), actionHandler("stop"))
        ]);
        const actionContainerSecondary = E("div", { class: "cbi-page-actions jc-actions" }, [
            createActionButton("enable", "cbi-button-positive", _("Enable autostart"), actionHandler("enable")),
            createActionButton("disable", "cbi-button-negative", _("Disable autostart"), actionHandler("disable"))
        ]);
        const actionContainerThird = E("div", { class: "cbi-page-actions jc-actions" }, [
            createActionButton("diagnostic", "cbi-button-neutral", _("Diagnostic"), showExecModalHandler(_("Diagnostic"), common.binPath, ["diag_report"])),
            createActionButton("core_update", "cbi-button-neutral", _("Update Mihomo"), showExecModalHandler(_("Update Mihomo"), common.binPath, ["core_update"])),
            createActionButton("rulesets_list_updates", "cbi-button-neutral", _("Update rules lists"), showExecModalHandler(_("Update RuleSets list"), common.binPath, ["rulesets_list_update"])),
            createActionButton("config_reset", "cbi-button-negative jc-margin-right", _("Reset config"), () => showDangerConfirm(_("Reset configuration to default?"), showExecModalHandler(_("Reset config result"), common.binPath, ["config_reset"])))
        ]);

        this.startPolling(statusCells);

        setTimeout(() => {
            this.updateServiceStatus(statusCells);
        }, 0);

        return E("div", { class: "cbi-map" }, [
            this.addCSS(),
            E("div", { class: "cbi-section" }, [
                statusContainer,
                actionContainer,
                actionContainerSecondary,
                actionContainerThird
            ])
        ]);
    },

    async updateServiceStatus(statusCells) {
        const [isRunning, isAutostarting] = await Promise.all([
            this.isJustClashRunning().catch(() => false),
            this.isJustClashAutostartEnabled().catch(() => false)
        ]);

        const runningSpan = statusCells.serviceStatus.querySelector("span");
        const autoSpan = statusCells.daemonStatus.querySelector("span");

        if (runningSpan) {
            runningSpan.textContent = boolToWord(isRunning);
            runningSpan.style = boolToStyle(isRunning);
        }
        if (autoSpan) {
            autoSpan.textContent = boolToWord(isAutostarting);
            autoSpan.style = boolToStyle(isAutostarting);
        }

        const btnStart = document.getElementById("buttonstart");
        const btnStop = document.getElementById("buttonstop");
        const btnEnable = document.getElementById("buttonenable");
        const btnDisable = document.getElementById("buttondisable");
        if (btnStart) btnStart.disabled = isRunning;
        if (btnStop) btnStop.disabled = !isRunning;
        if (btnEnable) btnEnable.disabled = isAutostarting;
        if (btnDisable) btnDisable.disabled = !isAutostarting;
    },

    startPolling(statusCells) {
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.pollInterval = setInterval(() => {
            this.updateServiceStatus(statusCells);
        }, this.pollServiceStatusTimeout);

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                clearInterval(this.pollInterval);
                this.pollInterval = null;
            } else {
                this.startPolling(statusCells);
            }
        });
    },

    addCSS() {
        return E("style", {}, `
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
    },
    destroy() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
});
