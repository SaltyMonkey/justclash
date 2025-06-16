"use strict";
"require ui";
"require view";
"require fs";
"require view.justclash.common as common";

return view.extend({
    pollInterval: null,

    handleSave: null,
    handleSaveApply: null,
    handleReset: null,
    serviceStatusId: null,
    daemonStatusId: null,
    startButtonId: null,
    restartButtonId: null,
    stopButtonId: null,
    enableButtonId: null,
    disableButtonId: null,
    pollServiceStatusTimeout: 10000,
    isJustClashAutostartEnabled: async function () {
        return fs.exec(common.initdPath, ["enabled"]).then(function (res) {
            return res.code === 0;
        });
    },
    isJustClashRunning: async function () {
        return fs.exec(common.initdPath, ["running"]).then(function (res) {
            return res.code === 0;
        });
    },
    boolToWord(boolValue) {
        return boolValue ? _("Yes") : _("No");
    },
    boolToColor(boolValue) {
        return boolValue ? "green" : "red";
    },
    async load() {
        const [
            infoPackage,
            infoLuciPackage,
            infoCore,
            cronCore,
            cronCoreAutorestart
        ] = await Promise.all([
            fs.exec(common.binPath, ["info_package"]).catch(() => _("No data")),
            fs.exec(common.binPath, ["info_luci"]).catch(() => _("No data")),
            fs.exec(common.binPath, ["info_core"]).catch(() => _("No data")),
            fs.exec(common.binPath, ["core_update_cron_check"]).catch(() => _("No data")),
            fs.exec(common.binPath, ["core_autorestart_cron_check"]).catch(() => _("No data")),
        ]);
        const [
            infoIsRunning,
            infoIsAutostarting
        ] = await Promise.all([
            this.isJustClashRunning().catch((e) => { console.log(e); return _("No data"); }),
            this.isJustClashAutostartEnabled().catch((e) => { console.log(e); return _("No data"); })
        ]);
        return {
            infoPackage,
            infoLuciPackage,
            infoCore,
            infoIsRunning,
            infoIsAutostarting,
            cronCore,
            cronCoreAutorestart
        };
    },
    render(results) {
        console.warn(results);

        const statusContainer = E("div", { class: "cbi-section fade-in" }, [
                E("h3", { class: "cbi-section-title" }, _("Service status")),
        ]);

        const tableContainer = E("table", { class: "table cbi-rowstyle-1" }, [
            E("tr", { class: "tr" }, [
                E("td", { class: "td left" }, _("Daemon package version:")),
                E("td", { class: "td left" }, results.infoPackage.stdout.replace("\\n", "").trim())
            ]),
            E("tr", { class: "tr cbi-rowstyle-2" }, [
                E("td", { class: "td left" }, _("Luci package version:")),
                E("td", { class: "td left" }, results.infoLuciPackage.stdout.replace("\\n", "").trim())
            ]),
            E("tr", { class: "tr cbi-rowstyle-1" }, [
                E("td", { class: "td left" }, _("Mihomo core version:")),
                E("td", { class: "td left" }, results.infoCore.stdout.replace("\\n", "").trim())
            ]),
            E("tr", { class: "tr cbi-rowstyle-2" }, [
                E("td", { class: "td left" }, _("Daemon is running:")),
                E("td", { class: "td left", id: "isrunning", style: `color: ${this.boolToColor(results.infoIsRunning)}` }, this.boolToWord(results.infoIsRunning))
            ]),
            E("tr", { class: "tr cbi-rowstyle-1" }, [
                E("td", { class: "td left" }, _("Daemon's autoboot:")),
                E("td", { class: "td left", id: "isautostarting", style: `color: ${this.boolToColor(results.infoIsAutostarting)}` }, this.boolToWord(results.infoIsAutostarting))
            ])
        ]);

        statusContainer.appendChild(tableContainer);

        const actionContainer = E("div", { class: "cbi-page-actions jc-actions" });
        const actionContainerSecondary = E("div", { class: "cbi-page-actions jc-actions" });

        const createButton = (action, cssClass, label, isDisabled) => {
            return E("button", {
                class: `cbi-button ${cssClass}`,
                id: `button${action}`,
                disabled: isDisabled,
                click: ui.createHandlerFn(this, () => {
                    const buttons = actionContainer.querySelectorAll("button");
                    const buttonsSecondary = actionContainerSecondary.querySelectorAll("button");
                    buttons.forEach(btn => btn.disabled = true);
                    buttonsSecondary.forEach(btn => btn.disabled = true);
                    fs.exec(common.initdPath, [action]).then(result => {
                        ui.showModal(_("Executing command..."), [E("p", _("Please wait.")),]);
                        this.updateServiceStatus();
                    }).catch(e => {
                        ui.addNotification(_("Error"), e.message, "danger");
                    }).finally(() => {
                        ui.hideModal();
                        buttons.forEach(btn => btn.disabled = false);
                        buttonsSecondary.forEach(btn => btn.disabled = false);
                    });
                })
            }, [
                label
            ]);
        };

        actionContainer.appendChild(createButton("start", "cbi-button-positive", _("Start"), results.infoIsRunning));
        actionContainer.appendChild(createButton("restart", "cbi-button-action", _("Restart")));
        actionContainer.appendChild(createButton("stop", "cbi-button-negative", _("Stop"), !results.infoIsRunning));

        actionContainerSecondary.appendChild(createButton("enable", "cbi-button-positive", _("Enable autostart"), results.infoIsAutostarting));
        actionContainerSecondary.appendChild(createButton("disable", "cbi-button-negative", _("Disable autostart"), !results.infoIsAutostarting));

        this.startPolling();

        return E("div", { class: "cbi-map" }, [
            this.addCSS(),
            E("div", { class: "cbi-section" }, [
                statusContainer,
                actionContainer,
                actionContainerSecondary
            ])
        ]);
    },
    updateUI(isRunning, isAutostarting) {
        if (this.daemonStatusId) {
            this.daemonStatusId.textContent = this.boolToWord(isAutostarting);
            this.daemonStatusId.style.color = this.boolToColor(isAutostarting);
        }
        if (this.serviceStatusId) {
            this.serviceStatusId.textContent = this.boolToWord(isRunning);
            this.serviceStatusId.style.color = this.boolToColor(isRunning);

        }
    },
    updateButtons(isRunning, isAutostarting) {
        if (isRunning && this.startButtonId) this.startButtonId.disabled = true;
        if (!isRunning && this.stopButtonId) this.stopButtonId.disabled = true;

        if (isAutostarting && this.enableButtonId) this.enableButtonId.disabled = true;
        if (!isAutostarting && this.disableButtonId) this.disableButtonId.disabled = true;
    },
    async updateServiceStatus() {
        const [infoIsRunning, infoIsAutostarting] = await Promise.all([
            this.isJustClashRunning().catch(() => _("No data")),
            this.isJustClashAutostartEnabled().catch(() => _("No data"))
        ]);

        this.startButtonId = document.getElementById("buttonstart");
        this.restartButtonId = document.getElementById("buttonrestart");
        this.stopButtonId = document.getElementById("buttonstop");

        this.enableButtonId = document.getElementById("buttonenable");
        this.disableButtonId = document.getElementById("buttondisable");

        this.serviceStatusId = document.getElementById("isrunning");
        this.daemonStatusId = document.getElementById("isautostarting");

        this.updateUI(infoIsRunning, infoIsAutostarting);
        this.updateButtons(infoIsRunning, infoIsAutostarting);
    },

    startPolling() {
        if (this.pollInterval) clearInterval(this.pollInterval);

        this.pollInterval = setInterval(() => {
            this.updateServiceStatus();
        }, this.pollServiceStatusTimeout);

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                clearInterval(this.pollInterval);
                this.pollInterval = null;
            } else {
                this.startPolling();
            }
        });
    },

    addCSS() {
        return E("style", {}, `
            .cbi-button { margin-right: 0.5em; }
            .jc-actions {
            text-align: left !important;
            border-top: 0px !important; }
        `);
    },

    destroy() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
});