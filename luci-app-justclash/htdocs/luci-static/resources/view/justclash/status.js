"use strict";
"require ui";
"require view";
"require fs";
"require view.justclash.common as common";

const FIELDS = [
    { label: _("Device model:"), key: "infoDevice" },
    { label: _("System version:"), key: "infoOpenWrt" },
    { label: _("Service package version:"), key: "infoPackage" },
    { label: _("Luci package version:"), key: "infoLuciPackage" },
    { label: _("Mihomo core version:"), key: "infoCore" }
];

function cleanStdout(val) {
    return (val && val.stdout) ? val.stdout.replace("\\n", "").trim() : _("No data");
}

function createTable(results, statusCells) {
    const rows = FIELDS.map((f, i) =>
        E("tr", { class: `tr cbi-rowstyle-${i % 2 + 1}` }, [
            E("td", { class: "td left" }, f.label),
            E("td", { class: "td left" }, cleanStdout(results[f.key]))
        ])
    );
    rows.push(
        E("tr", { class: "tr cbi-rowstyle-2" }, [
            E("td", { class: "td left" }, _("Service is running:")),
            statusCells.serviceStatus
        ]),
        E("tr", { class: "tr cbi-rowstyle-1" }, [
            E("td", { class: "td left" }, _("Service's autostart:")),
            statusCells.daemonStatus
        ])
    );
    return E("table", { class: "table cbi-rowstyle-1" }, rows);
}

function createActionButton(action, cssClass, label, handler) {
    return E("button", {
        class: `cbi-button ${cssClass}`,
        id: `button${action}`,
        click: handler
    }, [label]);
}

function boolToWord(val) { return val ? _("Yes") : _("No"); }
function boolToColor(val) { return val ? "green" : "red"; }

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
            infoDevice, infoOpenWrt, infoPackage, infoLuciPackage, infoCore
        ] = await Promise.all([
            fs.exec(common.binInfoPath, ["info_device"]).catch(() => _("No data")),
            fs.exec(common.binInfoPath, ["info_openwrt"]).catch(() => _("No data")),
            fs.exec(common.binInfoPath, ["info_package"]).catch(() => _("No data")),
            fs.exec(common.binInfoPath, ["info_luci"]).catch(() => _("No data")),
            fs.exec(common.binInfoPath, ["info_core"]).catch(() => _("No data"))
        ]);
        const [infoIsRunning, infoIsAutostarting] = await Promise.all([
            this.isJustClashRunning().catch(() => false),
            this.isJustClashAutostartEnabled().catch(() => false)
        ]);
        return {
            infoDevice, infoOpenWrt, infoPackage, infoLuciPackage, infoCore,
            infoIsRunning, infoIsAutostarting
        };
    },

    async render(results) {
        const serviceStatus = E("td", {
            class: "td left", id: "isrunning",
            style: `color: ${boolToColor(results.infoIsRunning)}`
        }, boolToWord(results.infoIsRunning));
        const daemonStatus = E("td", {
            class: "td left", id: "isautostarting",
            style: `color: ${boolToColor(results.infoIsAutostarting)}`
        }, boolToWord(results.infoIsAutostarting));
        const statusCells = { serviceStatus, daemonStatus };

        const statusContainer = E("div", { class: "cbi-section fade-in" }, [
            E("h3", { class: "cbi-section-title" }, _("Service status:")),
            createTable(results, statusCells)
        ]);

        const actionHandler = (action) => ui.createHandlerFn(this, async function () {
            const buttons = document.querySelectorAll(".cbi-button");
            buttons.forEach(btn => btn.disabled = true);
            ui.showModal(_("Executing command..."), [E("p", _("Please wait."))]);
            try {
                await fs.exec(common.initdPath, [action]);
                await this.updateServiceStatus(statusCells);
            } catch (e) {
                ui.addNotification(_("Error"), e.message, "danger");
            } finally {
                ui.hideModal();
                buttons.forEach(btn => btn.disabled = false);
            }
        });
        function showDangerConfirm(message, onYes) {
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
        }
        const showExecModalHandler = (title, command, args) => ui.createHandlerFn(this, async function () {
            const buttons = document.querySelectorAll(".cbi-button");
            buttons.forEach(btn => btn.disabled = true);
            ui.showModal(title, [E("p", _("Please wait..."))]);

            try {
                const res = await fs.exec(command, args);
                ui.showModal(title, [
                    E("pre", { style: "max-height: 400px; overflow:auto;" }, res.stdout || _("No output")),
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
            createActionButton("start", "cbi-button-positive", _("Start"), actionHandler("start")),
            createActionButton("stop", "cbi-button-negative", _("Stop"), actionHandler("stop"))
        ]);
        const actionContainerSecondary = E("div", { class: "cbi-page-actions jc-actions" }, [
            createActionButton("enable", "cbi-button-positive", _("Enable autostart"), actionHandler("enable")),
            createActionButton("disable", "cbi-button-negative", _("Disable autostart"), actionHandler("disable"))
        ]);
        const actionContainerThird = E("div", { class: "cbi-page-actions jc-actions" }, [
            createActionButton("diagnostic", "cbi-button-apply", _("Diagnostic"), showExecModalHandler(_("Diagnostic"), common.binPath, ["diag_report"])),
            createActionButton("core_update", "cbi-button-apply", _("Update Mihomo"), showExecModalHandler(_("Update Mihomo"), common.binPath, ["core_update"])),
            createActionButton("rulesets_updates", "cbi-button-apply", _("Update rules lists"), showExecModalHandler(_("Update RuleSets"), common.binPath, ["rulesets_update"])),
            createActionButton("config_reset", "cbi-button-negative jc-margin-right", _("Reset config"), () => showDangerConfirm(_("Reset configuration to default?"), showExecModalHandler(_("Reset config result"), common.binPath, ["config_reset"])))

        ]);

        this.startPolling(statusCells);

        // Not sure why i can't set directly disable flag when creating button, let it be like dat
        // Set initial button states after rendering
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
        statusCells.serviceStatus.textContent = boolToWord(isRunning);
        statusCells.serviceStatus.style.color = boolToColor(isRunning);
        statusCells.daemonStatus.textContent = boolToWord(isAutostarting);
        statusCells.daemonStatus.style.color = boolToColor(isAutostarting);

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
