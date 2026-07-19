"use strict";
"require view";
"require fs";
"require ui";
"require view.justclash.helper_clipboard as clipboard";
"require view.justclash.helper_common as common";

const NO_LOGS = _("No log entries");

let logsUpdating = false;
const LOG_LEVEL_RULES = [
    { type: "error", tokens: ["error", "level=error", "daemon.err", "user.err"] },
    { type: "warning", tokens: ["warn", "level=warn", "warning", "daemon.warn"] },
    { type: "info", tokens: ["info", "level=info"] },
    { type: "debug", tokens: ["debug", "level=debug"] }
];

const classifyLogLine = (lowerLine) => {
    const matchedRule = LOG_LEVEL_RULES.find(rule =>
        rule.tokens.some(token => lowerLine.includes(token))
    );

    return matchedRule ? matchedRule.type : "";
};

const renderLogLines = (container, rawText, isReversed) => {
    if (!rawText) {
        container.replaceChildren(document.createTextNode(NO_LOGS));
        return;
    }

    const lines = isReversed
        ? rawText.split("\n").filter(line => line.trim()).reverse()
        : rawText.split("\n").filter(line => line.trim());
    const fragment = document.createDocumentFragment();

    lines.forEach(line => {
        const lowerLine = line.toLowerCase();
        const type = classifyLogLine(lowerLine);
        const lineClass = `log-line${type ? ` log-line-${type}` : ""}`;
        const children = [];

        if (type)
            children.push(E("span", { class: `log-type-badge log-type-badge-${type}` }, type.toUpperCase()));

        children.push(E("span", { class: "log-message" }, line));

        fragment.appendChild(E("div", { class: lineClass }, children));
    });

    container.replaceChildren(fragment);
    container.scrollTop = isReversed ? 0 : container.scrollHeight;
};

const updateLogs = async (logContainer, btn, reverseCheckbox, setRawLogs, lastFetchLabel) => {
    if (logsUpdating) return;
    logsUpdating = true;

    if (btn)
        btn.disabled = true;

    try {
        const res = await fs.exec(common.binPath, ["systemlogs", common.logsCount]);
        let rawLogs = res.stdout || NO_LOGS;

        if (lastFetchLabel) {
            const now = new Date();
            lastFetchLabel.textContent = _("Last updated: ") + now.toLocaleString();
        }

        if (rawLogs.endsWith("\n"))
            rawLogs = rawLogs.slice(0, -1);

        setRawLogs(rawLogs);
        renderLogLines(logContainer, rawLogs, reverseCheckbox.checked);
    } catch (e) {
        ui.addTimeLimitedNotification(_("Error"), E("p", `${e.message || e}`), common.notificationTimeout, "danger");
        console.error("Error:", e);
    } finally {
        if (btn)
            btn.disabled = false;
        logsUpdating = false;
    }
};

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,

    render: function () {
        const logContainer = E("div", { class: "jc-logs-terminal", id: "logContainer" }, [NO_LOGS]);
        let rawLogs = NO_LOGS;

        const reverseCheckbox = E("input", {
            type: "checkbox",
            id: "reverseLogs",
            class: "jc-ml",
            checked: true,
            change: () => renderLogLines(logContainer, rawLogs, reverseCheckbox.checked)
        });

        const lastFetchLabel = E("span", { class: "jc-ml jc-log-fetch-label" }, [_("Last updated: ") + NO_LOGS]);

        const refreshBtn = E("button", {
            class: "cbi-button cbi-button-positive",
            click: () => updateLogs(logContainer, refreshBtn, reverseCheckbox, (value) => { rawLogs = value; }, lastFetchLabel)
        }, [_("Refresh")]);

        const copyBtn = E("button", {
            class: "cbi-button cbi-button-action",
            click: async () => {
                if (rawLogs === NO_LOGS) return;

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

        requestAnimationFrame(() => updateLogs(logContainer, refreshBtn, reverseCheckbox, (value) => { rawLogs = value; }, lastFetchLabel));

        const style = E("style", {}, `
            .jc-ml{margin-left:.5em;}
            .jc-log-fetch-label,.jc-settings-actions .cbi-checkbox-label,.jc-primary-actions{align-items:center;}
            .jc-log-fetch-label{color:var(--text-color-medium, #888);font-size:.9em;}
            .jc-logs-terminal{width:100%;max-height:65vh;overflow-y:auto;font-family:ui-monospace,monospace;line-height:1.4;white-space:pre-wrap;word-break:break-all;overflow-x:hidden;background-color:var(--background-color-low, #fff);border:1px solid var(--border-color-medium, #d9d9d9);border-radius:6px;margin-bottom:10px;padding:10px;}
            [data-theme="dark"] .jc-logs-terminal{background-color:rgba(0,0,0,.1);}
            .log-line{padding:1px 0;border-bottom:1px solid transparent;}
            .log-line:hover{background-color:var(--background-color-medium, rgba(0,0,0,.04));}
            [data-theme="dark"] .log-line:hover{background-color:rgba(255,255,255,.04);}
            .log-type-badge{display:inline-flex;align-items:center;justify-content:center;min-width:5.8em;margin-right:.6em;padding:2px 6px;border:1px solid transparent;border-radius:4px;font-size:0.8em;font-weight:bold;line-height:1.2;vertical-align:middle;box-sizing:border-box;}
            .log-type-badge-error{color:var(--error-color-medium, #f44336);border-color:rgba(244,67,54,.2);background:rgba(244,67,54,.1);}
            .log-type-badge-warning{color:var(--warning-color-medium, #fd7e14);border-color:rgba(253,126,20,.2);background:rgba(253,126,20,.1);}
            .log-type-badge-info{color:var(--success-color-medium, #2f9e44);border-color:rgba(40,167,69,.2);background:rgba(40,167,69,.1);}
            .log-type-badge-debug{color:var(--primary-color-medium, #4f8cff);border-color:rgba(16,96,255,.2);background:rgba(16,96,255,.1);}
            .log-line-error .log-message{color:var(--error-color-medium, #f44336);}
            .log-line-warning .log-message{color:var(--warning-color-medium, #fd7e14);}
            .log-line-info .log-message{color:var(--success-color-medium, #2f9e44);}
            .log-line-debug .log-message{color:var(--primary-color-medium, #4f8cff);}
            .cbi-section-actions + .cbi-section-actions{margin-top:8px;}
            .jc-actions-wrap{padding:.7em .8em;margin-bottom:10px;border:1px solid var(--border-color-medium, #d9d9d9);border-radius:6px;background:var(--background-color-medium, #f6f6f6);}
            .jc-primary-actions{display:flex;flex-wrap:wrap;gap:.65em;margin:0;}
            .jc-settings-actions .cbi-checkbox-label{margin:0;display:inline-flex;}
            [data-theme="dark"] .jc-actions-wrap{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.04);}
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
