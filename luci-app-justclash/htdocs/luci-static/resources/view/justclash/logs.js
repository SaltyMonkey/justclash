"use strict";
"require view";
"require fs";
"require ui";
"require view.justclash.common as common";

const NO_DATA = _("No data");
const NO_LOGS = _("No logs");

const autosizeTextarea = (textarea) => {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + 20 + "px";
};

const copyToClipboard = (text) => {
    if (navigator.clipboard) {
        navigator.clipboard
            .writeText(text)
            .catch((e) => {
                ui.addNotification(_("Error"), E("p", `${e.message || e}`), "danger");
                console.error(e);
            });
    }
};

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,

    async updateLogs(logBox, btn, reverseCheckbox, rawLogs) {
        btn.disabled = true;
        try {
            const res = await fs.exec(common.binPath, ["systemlogs", common.logsCount]);
            rawLogs.value = res.stdout || NO_LOGS;
            if (rawLogs.value.endsWith("\n")) {
                rawLogs.value = rawLogs.value.slice(0, -1);
            }
            this.applyReverse(logBox, reverseCheckbox.checked, rawLogs.value);
            autosizeTextarea(logBox);
        } catch (e) {
            ui.addNotification(_("Error"), E("p", `${e.message || e}`), "danger");
        } finally {
            btn.disabled = false;
        }
    },
    applyReverse(logBox, isReversed, rawText) {
        if (isReversed) {
            const lines = rawText.split("\n").reverse().join("\n");
            logBox.value = lines;
        } else {
            logBox.value = rawText;
        }
    },
    render: function () {
        const logBox = E("textarea", {
            readonly: "readonly",
            class: "jc-logs",
            id: "logBox",
            wrap: "off",
        }, []);
        logBox.value = NO_DATA;
        autosizeTextarea(logBox);

        const rawLogs = { value: NO_DATA };

        const reverseCheckbox = E("input", {
            type: "checkbox",
            id: "reverseLogs",
            class: "jc-ml",
            change: () => this.applyReverse(logBox, reverseCheckbox.checked, rawLogs.value)
        });

        const refreshBtn = E("button", {
            class: "cbi-button cbi-button-action",
            click: () => this.updateLogs(logBox, refreshBtn, reverseCheckbox, rawLogs)
        }, [_("Update")]);

        const tailBtn = E("button", {
            class: "cbi-button cbi-button-neutral",
            click: () => {
                window.scrollTo({
                    top: document.documentElement.scrollHeight,
                    behavior: "smooth"
                });
            },
        }, [_("To bottom")]);

        const isSecure = window.isSecureContext;

        const copyBtn = E("button", {
            class: "cbi-button",
            disabled: !isSecure,
            title: !isSecure ? _("Can't copy") : "",
            click: () => {
                if (logBox.value === NO_DATA || logBox.value === NO_LOGS) return;
                copyToClipboard(logBox.value);
            },
        }, [_("Copy logs")]);

        const topBtn = E("button", {
            class: "cbi-button cbi-button-neutral",
            click: () => {
                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            },
        }, [_("To top")]);

        // reverseCheckbox is now declared above
        const reverseLabel = E("label", { for: "reverseLogs", class: "cbi-checkbox-label" }, [_("Reversed Logs")]);

        const settingsBar = E("div", { class: "cbi-page-actions jc-actions" }, [
            reverseLabel,
            reverseCheckbox,
        ]);

        const buttonBar = E("div", { class: "cbi-page-actions jc-actions" }, [
            refreshBtn,
            tailBtn,
            copyBtn
        ]);

        const buttonBottomBar = E("div", { class: "cbi-page-actions jc-actions" }, [
            topBtn
        ]);

        requestAnimationFrame(() => {
            this.updateLogs(logBox, refreshBtn, reverseCheckbox, rawLogs);
        });

        const style = E("style", {}, `
            .jc-ml {
                margin-left: 0.5em !important;
            }
            .jc-logs {
                width: 100%;
                font-family: monospace;
                font-size: 12px;
                white-space: pre;
                overflow-x: auto;
                overflow-y: hidden;
                resize: none;
                min-height: 2em;
                margin-bottom: 10px !important;
            }
            .jc-actions {
                display: flex;
                flex-flow: row;
                flex-wrap: wrap;
                row-gap: 1em;
                text-align: left !important;
                border-top: 0px !important;
            }
            .cbi-page-actions {
                margin-bottom: 10px !important;
                padding: 10px 10px 10px 10px !important;
            }
            .cbi-button { margin-right: 0.5em; }
        `);
        return E("div", { class: "cbi-section fade-in" }, [
            style,
            E("h3", { class: "cbi-section-title" }, _("Logs view")),
            buttonBar,
            settingsBar,
            logBox,
            buttonBottomBar
        ]);
    }
});
