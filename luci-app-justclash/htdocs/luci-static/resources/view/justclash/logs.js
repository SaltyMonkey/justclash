"use strict";
"require view";
"require fs";
"require ui";
"require view.justclash.common as common";

const NO_DATA = _("No data");
const NO_LOGS = _("No logs");

let logsUpdating = false; // Защита от гонки

const LOG_LEVEL_RULES = [
    { suffix: " log-error", tokens: ["error", "level=error", "daemon.err"] },
    { suffix: " log-warn", tokens: ["warn", "level=warn", "warning", "daemon.warn"] },
    { suffix: " log-info", tokens: ["info", "level=info"] },
    { suffix: " log-debug", tokens: ["debug", "level=debug"] }
];

const classifyLogLine = (lowerLine) => {
    for (const rule of LOG_LEVEL_RULES) {
        for (const token of rule.tokens) {
            if (lowerLine.includes(token)) return `log-line${rule.suffix}`;
        }
    }

    return "log-line";
};

const copyToClipboard = async (text) => {
    if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
    } else {
        const ta = clipboardTextarea || document.createElement("textarea");
        clipboardTextarea = ta;
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        if (!ta.parentNode)
            document.body.appendChild(ta);
        ta.focus();
        ta.select();
        if (!document.execCommand("copy"))
            throw new Error(_("Unable to copy to clipboard"));
    }
};

const renderLogLines = (container, rawText, isReversed) => {
    if (!rawText) {
        container.replaceChildren(document.createTextNode(NO_DATA));
        return;
    }

    // Разделяем строки
    let lines = rawText.split("\n").filter(line => line.trim());
    if (isReversed) lines = lines.slice().reverse(); // Не мутируем исходный массив

    const fragment = document.createDocumentFragment();

    lines.forEach(line => {
        const lowerLine = line.toLowerCase();
        const className = classifyLogLine(lowerLine);

        fragment.appendChild(E("div", { class: className }, line));
    });

    container.replaceChildren(fragment);
};

const updateLogs = async (logContainer, btn, reverseCheckbox, rawLogs, lastFetchLabel) => {
    if (logsUpdating) return; // Предотвращаем overlapping polling
    logsUpdating = true;

    if (btn) btn.disabled = true;
    try {
        const res = await fs.exec(common.binPath, ["systemlogs", common.logsCount]);

        if (lastFetchLabel) {
            const now = new Date();
            lastFetchLabel.textContent = _("Last fetch: ") + now.toLocaleString();
        }

        rawLogs.value = res.stdout || NO_LOGS;
        if (rawLogs.value.endsWith("\n")) rawLogs.value = rawLogs.value.slice(0, -1);

        renderLogLines(logContainer, rawLogs.value, reverseCheckbox.checked);
    } catch (e) {
        ui.addNotification(_("Error"), E("p", `${e.message || e}`), "danger", 3000);
        console.error("Error:", e);
    } finally {
        if (btn) btn.disabled = false;
        logsUpdating = false;
    }
};

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,

    render: function () {
        const logContainer = E("div", { class: "jc-logs-terminal", id: "logContainer" }, [NO_DATA]);
        const rawLogs = { value: NO_DATA };

        const reverseCheckbox = E("input", {
            type: "checkbox",
            id: "reverseLogs",
            class: "jc-ml",
            checked: true,
            change: () => renderLogLines(logContainer, rawLogs.value, reverseCheckbox.checked)
        });

        const lastFetchLabel = E("span", { class: "jc-ml jc-log-fetch-label" }, [_("Last fetch: ") + NO_DATA]);

        const refreshBtn = E("button", {
            class: "cbi-button cbi-button-positive",
            click: () => updateLogs(logContainer, refreshBtn, reverseCheckbox, rawLogs, lastFetchLabel)
        }, [_("Update")]);

        const tailBtn = E("button", {
            class: "cbi-button cbi-button-neutral",
            click: () => { logContainer.scrollTop = logContainer.scrollHeight; },
        }, [_("To bottom")]);

        const copyBtn = E("button", {
            class: "cbi-button cbi-button-action",
            click: () => {
                if (rawLogs.value === NO_DATA || rawLogs.value === NO_LOGS) return;
                copyToClipboard(rawLogs.value || "");
                ui.addNotification(null, E("p", _("Data copied to clipboard")), "success", 3000);
            },
        }, [_("Copy logs")]);

        const topBtn = E("button", {
            class: "cbi-button cbi-button-neutral",
            click: () => { logContainer.scrollTop = 0; },
        }, [_("To top")]);

        const reverseLabel = E("label", { for: "reverseLogs", class: "cbi-checkbox-label" }, [_("Reversed Logs")]);

        const settingsBar = E("div", { class: "cbi-page-actions jc-actions" }, [reverseLabel, reverseCheckbox, lastFetchLabel]);
        const buttonBar = E("div", { class: "cbi-page-actions jc-actions" }, [refreshBtn, tailBtn, copyBtn]);
        const buttonBottomBar = E("div", { class: "cbi-page-actions jc-actions" }, [topBtn]);

        // Инициируем первичное обновление логов
        requestAnimationFrame(() => updateLogs(logContainer, refreshBtn, reverseCheckbox, rawLogs, lastFetchLabel));

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

            .jc-actions {
                display: flex;
                flex-flow: row;
                flex-wrap: wrap;
                row-gap: 1em;
                text-align: left !important;
                border-top: 0px !important;
            }
            .cbi-page-actions { margin-bottom: 10px !important; padding: 10px !important; }
            .cbi-button { margin-right: 0.5em; }
        `);

        return E("div", { class: "cbi-section fade-in" }, [
            style,
            E("h3", { class: "cbi-section-title" }, _("Logs view")),
            buttonBar,
            settingsBar,
            logContainer,
            buttonBottomBar
        ]);
    }
});
