"use strict";
"require view";
"require ui";
"require view.justclash.lib.clipboard as clipboard";
"require view.justclash.common as common";
"require view.justclash.lib.logs as logs";
"require view.justclash.api.ubus as ubusApi";

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,

    render: function () {
        const logContainer = E("div", { class: "jc-logs-terminal", id: "logContainer" }, [logs.emptyText]);
        let rawLogs = "";
        let logsUpdating = false;

        const renderLogs = (reversed) => {
            logs.renderEntries(logContainer, logs.parseSystemText(rawLogs), reversed);
        };

        const reverseCheckbox = E("input", {
            type: "checkbox",
            id: "reverseLogs",
            class: "jc-ml",
            checked: true,
            change: () => renderLogs(reverseCheckbox.checked)
        });

        const lastFetchLabel = E("span", { class: "jc-ml jc-log-fetch-label" }, [_("Last updated: ") + logs.emptyText]);

        const updateLogs = async () => {
            if (logsUpdating)
                return;

            logsUpdating = true;
            refreshBtn.disabled = true;

            try {
                const res = await ubusApi.getSystemLogs();
                rawLogs = (res.stdout || "").replace(/\r?\n$/, "");
                lastFetchLabel.textContent = _("Last updated: ") + new Date().toLocaleString();
                renderLogs(reverseCheckbox.checked);
            } catch (e) {
                ui.addTimeLimitedNotification(_("Error"), E("p", `${e.message || e}`), common.notificationTimeout, "danger");
                console.error("Error:", e);
            } finally {
                refreshBtn.disabled = false;
                logsUpdating = false;
            }
        };

        const refreshBtn = E("button", {
            class: "cbi-button cbi-button-positive",
            click: updateLogs
        }, [_("Refresh")]);

        const copyBtn = E("button", {
            class: "cbi-button cbi-button-action",
            click: async () => {
                if (!rawLogs)
                    return;

                try {
                    await clipboard.copy(rawLogs);
                } catch (e) {
                    ui.addTimeLimitedNotification(_("Error"), E("p", `${e.message || e}`), common.notificationTimeout, "danger");
                    console.error("Failed to copy logs to clipboard", e);
                }
            }
        }, [_("Copy log")]);

        const reverseLabel = E("label", { for: "reverseLogs", class: "cbi-checkbox-label" }, [_("Newest first")]);
        const settingsBar = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions jc-settings-actions" }, [
                reverseLabel,
                reverseCheckbox,
                lastFetchLabel
            ])
        ]);
        const buttonBar = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions" }, [
                refreshBtn,
                copyBtn
            ])
        ]);

        requestAnimationFrame(updateLogs);

        const style = E("style", {}, `
            .jc-ml{margin-left:.5em;}
            .jc-log-fetch-label,.jc-settings-actions .cbi-checkbox-label,.jc-primary-actions{align-items:center;}
            .jc-log-fetch-label{color:var(--text-color-medium, #888);font-size:.9em;}
            .jc-logs-terminal{width:100%;font-family:ui-monospace,monospace;line-height:1.4;white-space:pre-wrap;word-break:break-all;background-color:var(--background-color-low, #fff);border:1px solid var(--border-color-medium, #d9d9d9);border-radius:6px;margin-bottom:10px;padding:10px;}
            :root[data-darkmode="true"] .jc-logs-terminal{background-color:var(--background-color-low, rgba(0,0,0,.1));}
            .jc-log-line{padding:1px 0;border-bottom:1px solid transparent;}
            .jc-log-line:hover{background-color:var(--background-color-medium, rgba(0,0,0,.04));}
            :root[data-darkmode="true"] .jc-log-line:hover{background-color:var(--background-color-high, rgba(255,255,255,.04));}
            .jc-log-type-badge{display:inline-flex;align-items:center;justify-content:center;min-width:5.8em;margin-right:.6em;padding:2px 6px;border:1px solid transparent;border-radius:4px;font-size:0.8em;font-weight:bold;line-height:1.2;vertical-align:middle;box-sizing:border-box;}
            .jc-log-type-badge-error{color:var(--error-color-medium, #f44336);border-color:rgba(244,67,54,.2);background:rgba(244,67,54,.1);}
            .jc-log-type-badge-warning{color:var(--warn-color-medium, #fd7e14);border-color:rgba(253,126,20,.2);background:rgba(253,126,20,.1);}
            .jc-log-type-badge-info{color:var(--success-color-medium, #2f9e44);border-color:rgba(40,167,69,.2);background:rgba(40,167,69,.1);}
            .jc-log-type-badge-debug{color:var(--primary-color-medium, #4f8cff);border-color:rgba(16,96,255,.2);background:rgba(16,96,255,.1);}
            .jc-log-line-error .jc-log-message{color:var(--error-color-medium, #f44336);}
            .jc-log-line-warning .jc-log-message{color:var(--warn-color-medium, #fd7e14);}
            .jc-log-line-info .jc-log-message{color:var(--success-color-medium, #2f9e44);}
            .jc-log-line-debug .jc-log-message{color:var(--primary-color-medium, #4f8cff);}
            .cbi-section-actions + .cbi-section-actions{margin-top:8px;}
            .jc-actions-wrap{padding:.7em .8em;margin-bottom:10px;border:1px solid var(--border-color-medium, #d9d9d9);border-radius:6px;background:var(--background-color-medium, #f6f6f6);}
            .jc-primary-actions{display:flex;flex-wrap:wrap;gap:.65em;margin:0;}
            .jc-settings-actions .cbi-checkbox-label{margin:0;display:inline-flex;}
            :root[data-darkmode="true"] .jc-actions-wrap{border-color:var(--border-color-medium, rgba(255,255,255,.08));background:var(--background-color-high, rgba(255,255,255,.04));}
        `);

        return E("div", { class: "cbi-section fade-in" }, [
            style,
            E("h3", { class: "cbi-section-title" }, _("System logs")),
            E("div", { class: "cbi-section-descr" }, _("View system logs related to the JustClash service and its startup scripts.")),
            buttonBar,
            settingsBar,
            logContainer
        ]);
    }
});
