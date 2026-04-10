"use strict";
"require view";
"require fs";
"require ui";
"require view.justclash.helper_clipboard as clipboard";
"require view.justclash.helper_common as common";

const NO_LOGS = _("No log entries");

let logsUpdating = false;
const LOG_LEVEL_RULES = [
    { suffix: " log-error", tokens: ["error", "level=error", "daemon.err", "user.err"] },
    { suffix: " log-warn", tokens: ["warn", "level=warn", "warning", "daemon.warn"] },
    { suffix: " log-info", tokens: ["info", "level=info"] },
    { suffix: " log-debug", tokens: ["debug", "level=debug"] }
];

const classifyLogLine = (lowerLine) => {
    const matchedRule = LOG_LEVEL_RULES.find(rule =>
        rule.tokens.some(token => lowerLine.includes(token))
    );

    return matchedRule ? `log-line${matchedRule.suffix}` : "log-line";
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
        const className = classifyLogLine(lowerLine);

        fragment.appendChild(E("div", { class: className }, line));
    });

    container.replaceChildren(fragment);
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

        const tailBtn = E("button", {
            class: "cbi-button cbi-button-neutral",
            click: () => { logContainer.scrollTop = logContainer.scrollHeight; }
        }, [_("Scroll to bottom")]);

        const copyBtn = E("button", {
            class: "cbi-button cbi-button-action",
            click: async () => {
                if (rawLogs === NO_LOGS) return;

                try {
                    await clipboard.copy(rawLogs);
                    ui.addTimeLimitedNotification(null, E("p", _("Data copied to clipboard")), common.notificationTimeout, "success");
                } catch (e) {
                    ui.addTimeLimitedNotification(_("Error"), E("p", `${e.message || e}`), common.notificationTimeout, "danger");
                    console.error("Failed to copy logs to clipboard", e);
                }
            }
        }, [_("Copy log")]);

        const topBtn = E("button", {
            class: "cbi-button cbi-button-neutral",
            click: () => { logContainer.scrollTop = 0; }
        }, [_("Scroll to top")]);

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
                tailBtn,
                copyBtn
            ])
        ]);
        const buttonBottomBar = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions" }, [topBtn])
        ]);

        requestAnimationFrame(() => updateLogs(logContainer, refreshBtn, reverseCheckbox, (value) => { rawLogs = value; }, lastFetchLabel));

        const style = E("style", {}, `
            .jc-ml { margin-left: 0.5em !important; }
            .jc-log-fetch-label { color: #999; font-size: 0.9em; display: flex; align-items: center; }

            .jc-logs-terminal {
                width: 100%;
                font-family: 'Menlo', 'Consolas', 'Monaco', monospace;
                font-size: 12px;
                line-height: 1.4;
                white-space: pre-wrap;
                word-break: break-all;
                overflow-y: auto;
                overflow-x: hidden;
                background-color: #1e1e1e;
                color: #d4d4d4;
                border: 1px solid #3c3c3c;
                border-radius: 6px;
                padding: 10px;
                margin-bottom: 10px !important;
                height: 500px;
                resize: vertical;
            }

            .log-line { padding: 1px 0; border-bottom: 1px solid transparent; }
            .log-line:hover { background-color: #2a2d2e; }
            .log-error { color: #f48771; }
            .log-warn  { color: #cca700; }
            .log-info  { color: #75beff; }
            .log-debug { color: #8b949e; }

            .cbi-section-actions + .cbi-section-actions { margin-top: 8px; }
            .jc-actions-wrap {
                padding: 0.7em 0.8em;
                margin-bottom: 10px;
                border: 1px solid var(--border-color-medium, #d9d9d9);
                border-radius: 6px;
                background: var(--background-color-medium, #f6f6f6);
            }
            .jc-primary-actions {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 0.65em;
                margin: 0;
            }
            .jc-primary-actions .cbi-button { margin: 0 !important; }
            .jc-settings-actions .cbi-checkbox-label {
                margin: 0;
                display: inline-flex;
                align-items: center;
            }
            [data-theme="dark"] .jc-actions-wrap {
                border-color: rgba(255,255,255,0.08);
                background: rgba(255,255,255,0.04);
            }
        `);

        return E("div", { class: "cbi-section fade-in" }, [
            style,
            E("h3", { class: "cbi-section-title" }, _("System logs")),
            buttonBar,
            settingsBar,
            logContainer,
            buttonBottomBar
        ]);
    }
});
