"use strict";
"require ui";
"require view";
"require fs";

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
    pollServiceStatusTimeout: 10000,
    isJustClashAutostartEnabled: async function () {
        return fs.exec("/etc/init.d/justclash", ["enabled"]).then(function (res) {
            return res.code === 0;
        });
    },
    isJustClashRunning: async function () {
        return fs.exec("/etc/init.d/justclash", ["running"]).then(function (res) {
            return res.code === 0;
        });
    },
    boolToWord(boolValue) {
        return boolValue ? _("Yes") : _("No");
    },
    async load() {
        const [
            infoPackage,
            infoLuciPackage,
            infoCore,
            cronCore,
            cronCoreAutorestart
        ] = await Promise.all([
            fs.exec("/usr/bin/justclash", ["info_package"]).catch(() => _("No data")),
            fs.exec("/usr/bin/justclash", ["info_luci"]).catch(() => _("No data")),
            fs.exec("/usr/bin/justclash", ["info_core"]).catch(() => _("No data")),
            fs.exec("/usr/bin/justclash", ["core_update_cron_check"]).catch(() => _("No data")),
            fs.exec("/usr/bin/justclash", ["core_autorestart_cron_check"]).catch(() => _("No data")),
        ]);
        const [
            infoIsRunning,
            infoIsAutostarting
        ] = await Promise.all([
            this.isJustClashRunning().catch((e) => {console.log(e); return _("No data")}),
            this.isJustClashAutostartEnabled().catch((e) => { console.log(e); return _("No data")})
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
            E("div", { class: "cbi-section-title" }, _("Service status")),
            E("div", { class: "cbi-section-descr" }, _("basic actions and information about service state"))
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
                E("td", { class: "td left", id: "isrunning" }, this.boolToWord(results.infoIsRunning))
            ]),
            E("tr", { class: "tr cbi-rowstyle-1" }, [
                E("td", { class: "td left" }, _("Daemon is autobooting:")),
                E("td", { class: "td left", id: "isautostarting" }, this.boolToWord(results.infoIsAutostarting))
            ])
        ]);

        statusContainer.appendChild(tableContainer);

        const actionContainer = E("div", { class: "cbi-page-actions jc-actions" });

        const createButton = (action, cssClass, label) => {
            return E("button", {
                class: `cbi-button ${cssClass}`,
                id: `button${action}`,
                click: ui.createHandlerFn(this, () => {
                    const buttons = actionContainer.querySelectorAll("button");
                    buttons.forEach(btn => btn.disabled = true);

                    fs.exec("/etc/init.d/justclash", [action]).then(result => {
                        //ui.addNotification(null, E("p", _("Command successfully called") + ": %s ".format(result.stdout)));
                        this.updateServiceStatus();
                    }).catch(e => {
                        //ui.addNotification(null, E("p", _("Unable to read the contents") + ": %s ".format(e.message)));
                    }).finally(() => {
                        buttons.forEach(btn => btn.disabled = false);
                    });
                })
            }, [
                label
            ]);
        };

        actionContainer.appendChild(createButton("start", "cbi-button-neutral", _("Start")));
        actionContainer.appendChild(createButton("restart", "cbi-button-positive", _("Restart")));
        actionContainer.appendChild(createButton("stop", "cbi-button-negative", _("Stop")));

        this.startPolling();

        return E("div", { class: "cbi-map" }, [
            this.addCSS(),
            E("div", { class: "cbi-section" }, [
                statusContainer,
                actionContainer
            ])
        ]);
    },

    async updateServiceStatus() {
        const [infoIsRunning, infoIsAutostarting] = await Promise.all([
            this.isJustClashRunning().catch(() => _("No data")),
            this.isJustClashAutostartEnabled().catch(() => _("No data"))
        ]);

        this.startButtonId = document.getElementById("buttonstart");
        this.restartButtonId = document.getElementById("buttonrestart");
        this.stopButtonId = document.getElementById("buttonstop");
        this.serviceStatusId = document.getElementById("isrunning");
        this.daemonStatusId = document.getElementById("isautostarting");

        if (this.daemonStatusId) this.daemonStatusId.textContent = this.boolToWord(infoIsAutostarting);
        if (this.serviceStatusId) this.serviceStatusId.textContent = this.boolToWord(infoIsRunning);
        if (infoIsRunning && this.startButtonId) this.startButtonId.disabled = true;
        if (!infoIsRunning && this.stopButtonId) this.stopButtonId.disabled = true;

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