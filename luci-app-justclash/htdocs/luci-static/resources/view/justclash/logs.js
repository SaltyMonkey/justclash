"use strict";
"require view";
"require fs";
"require ui";
"require view.justclash.common as common";

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,

    render: function () {
        const logBox = E("textarea", {
            readonly: "readonly",
            class: "jc-logs",
            id: "logBox",
            rows: "200",
            wrap: "off",
        }, []);
        logBox.value = _("No data");

        const refreshBtn = E("button", {
            class: "cbi-button cbi-button-action",
            click: () => {
                refreshBtn.disabled = true;
                fs.exec(common.binPath, ["systemlogs", common.logsCount])
                    .then(res => {
                        logBox.value = res.stdout || _("No logs");
                    })
                    .catch(e => {
                        ui.addNotification(_("Error"), e.message, "danger");
                    })
                    .finally(() => {
                        refreshBtn.disabled = false;
                    });
            }
        }, [
            _("Update")
        ]);

        const tailBtn = E("button", {
            class: "cbi-button cbi-button-neutral jc-ml",
            click: () => {
                logBox.scrollTop = logBox.scrollHeight;
            },
        }, [
            _("To end")
        ]);

        const buttonBar = E("div", {
            style: "margin-bottom: 1em;"
        }, [
            refreshBtn,
            tailBtn,
            //copyBtn
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
                overflow: auto;"
            }
        `);
    },

});