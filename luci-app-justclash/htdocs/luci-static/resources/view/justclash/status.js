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

function createActionButton(action, cssClass, label, handler, disabled = false) {
    return E("button", {
        class: `cbi-button ${cssClass}`,
        id: `button${action}`,
        click: handler,
        disabled
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
            infoDevice, infoOpenWrt, infoPackage, infoLuciPackage, infoCore,
            cronCore, cronCoreAutorestart
        ] = await Promise.all([
            fs.exec(common.binInfoPath, ["info_device"]).catch(() => _("No data")),
            fs.exec(common.binInfoPath, ["info_openwrt"]).catch(() => _("No data")),
            fs.exec(common.binInfoPath, ["info_package"]).catch(() => _("No data")),
            fs.exec(common.binInfoPath, ["info_luci"]).catch(() => _("No data")),
            fs.exec(common.binInfoPath, ["info_core"]).catch(() => _("No data")),
            fs.exec(common.binPath, ["core_update_cron_check"]).catch(() => _("No data")),
            fs.exec(common.binPath, ["core_autorestart_cron_check"]).catch(() => _("No data")),
        ]);
        const [infoIsRunning, infoIsAutostarting] = await Promise.all([
            this.isJustClashRunning().catch(() => false),
            this.isJustClashAutostartEnabled().catch(() => false)
        ]);
        return {
            infoDevice, infoOpenWrt, infoPackage, infoLuciPackage, infoCore,
            infoIsRunning, infoIsAutostarting, cronCore, cronCoreAutorestart
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

        const actionContainer = E("div", { class: "cbi-page-actions jc-actions" }, [
            createActionButton("start", "cbi-button-positive", _("Start"), actionHandler("start"), results.infoIsRunning),
            createActionButton("stop", "cbi-button-negative", _("Stop"), actionHandler("stop"), !results.infoIsRunning)
        ]);
        const actionContainerSecondary = E("div", { class: "cbi-page-actions jc-actions" }, [
            createActionButton("enable", "cbi-button-positive", _("Enable autostart"), actionHandler("enable"), results.infoIsAutostarting),
            createActionButton("disable", "cbi-button-negative", _("Disable autostart"), actionHandler("disable"), !results.infoIsAutostarting)
        ]);

        this.startPolling(statusCells);

        return E("div", { class: "cbi-map" }, [
            this.addCSS(),
            E("div", { class: "cbi-section" }, [
                statusContainer,
                actionContainer,
                actionContainerSecondary
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
                text-align: left !important;
                border-top: 0px !important;
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
