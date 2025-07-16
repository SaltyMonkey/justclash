"use strict";
"require view";
"require fs";
"require ui";
"require view.justclash.common as common";

const NO_DATA = _("No data");
const NO_LOGS = _("No logs");

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,

    async updateLogs(logBox, btn) {
        btn.disabled = true;
        try {
            const res = await fs.exec(common.binInfoPath, ["systemlogs", common.logsCount]);
            logBox.value = res.stdout || NO_LOGS;
        } catch (e) {
            ui.addNotification(_("Error"), e.message, "danger");
        } finally {
            btn.disabled = false;
        }
    },

    render: function () {
        const logBox = E("textarea", {
            readonly: "readonly",
            class: "jc-logs",
            id: "logBox",
            rows: "200",
            wrap: "off",
        }, []);
        logBox.value = NO_DATA;

        let refreshBtn;
        refreshBtn = E("button", {
            class: "cbi-button cbi-button-action",
            click: () => this.updateLogs(logBox, refreshBtn)
        }, [_("Update")]);

        const tailBtn = E("button", {
            class: "cbi-button cbi-button-neutral jc-ml",
            click: () => {
                logBox.scrollTop = logBox.scrollHeight;
            },
        }, [_("To end")]);

        const buttonBar = E("div", { style: "margin-bottom: 1em;" }, [
            refreshBtn,
            tailBtn,
            // copyBtn
        ]);

        return E("div", { class: "cbi-section fade-in" }, [
            this.addCSS(),
            E("h3", { class: "cbi-section-title" }, _("Logs view")),
            buttonBar,
            logBox
        ]);
    },

    addCSS() {
        return E("style", {}, `
            .jc-ml {
                margin-left: 0.5em !important;
            }
            .jc-logs {
                width: 100%;
                font-family: monospace;
                white-space: pre;
                overflow: auto;
            }
        `);
    },
});