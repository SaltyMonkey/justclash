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
    autosizeTextarea(textarea) {
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";
    },
    async updateLogs(logBox, btn, reverseCheckbox, rawLogs) {
        btn.disabled = true;
        try {
            const res = await fs.exec(common.binInfoPath, ["systemlogs", common.logsCount]);
            rawLogs.value = res.stdout || NO_LOGS;
            if (rawLogs.value.endsWith('\n')) {
                rawLogs.value = rawLogs.value.slice(0, -1);
            }
            this.applyReverse(logBox, reverseCheckbox.checked, rawLogs.value);
            this.autosizeTextarea(logBox);
        } catch (e) {
            ui.addNotification(_("Error"), e.message, "danger");
        } finally {
            btn.disabled = false;
        }
    },
    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard
                .writeText(text)
                .catch((ex) => {
                    console.error(ex);
                });
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
        this.autosizeTextarea(logBox);

        const rawLogs = { value: NO_DATA };

        const refreshBtn = E("button", {
            class: "cbi-button cbi-button-action",
            click: () => this.updateLogs(logBox, refreshBtn, reverseCheckbox, rawLogs)
        }, [_("Update")]);

        const tailBtn = E("button", {
            class: "cbi-button cbi-button-neutral jc-ml",
            click: () => {
                window.scrollTo({
                    top: document.documentElement.scrollHeight,
                    behavior: "smooth"
                });
            },
        }, [_("To bottom")]);

        const isSecure = window.isSecureContext;

        const copyBtn = E("button", {
            class: "cbi-button cbi-button-positive jc-ml",
            disabled: !isSecure,
            title: !isSecure ? _("Can't copy") : "",
            click: () => {
                if (logBox.value === NO_DATA || logBox.value === NO_LOGS) return;
                this.copyToClipboard(logBox.value);
            },
        }, [_("Copy logs")]);

        const topBtn = E("button", {
            class: "cbi-button cbi-button-neutral jc-ml jc-mb",
            click: () => {
                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            },
        }, [_("To top")]);

        const reverseCheckbox = E("input", {
            type: "checkbox",
            id: "reverseLogs",
            class: "jc-ml",
            change: () => this.applyReverse(logBox, reverseCheckbox.checked, rawLogs.value)
        });
        const reverseLabel = E("label", { for: "reverseLogs", class: "cbi-checkbox-label" }, [_("Reversed Logs")]);

        const settingsBar = E("div", { class: "jc-sb jc-mb" }, [
            reverseLabel,
            reverseCheckbox,
        ]);

        const buttonBar = E("div", { class: "jc-mb" }, [
            refreshBtn,
            tailBtn,
            copyBtn
        ]);

        const buttonBottomBar = E("div", { style: "margin-top: 1em;" }, [
            topBtn
        ]);

        return E("div", { class: "cbi-section fade-in" }, [
            this.addCSS(),
            E("h3", { class: "cbi-section-title" }, _("Logs view")),
            buttonBar,
            settingsBar,
            logBox,
            buttonBottomBar
        ]);
    },

    addCSS() {
        return E("style", {}, `
            .jc-ml {
                margin-left: 0.5em !important;
            }
            .jc-mb {
                margin-bottom: 1em !important;
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
            }
              .jc-sb {
                display: flex;
                align-items: center;
                justify-content: flex-start;
                gap: 0.5em;
            }
        `);
    },
});
