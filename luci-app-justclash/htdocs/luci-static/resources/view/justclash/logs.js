"use strict";
"require view";
"require fs";
"require ui";
"require view.justclash.common as common";

const NO_DATA = _("No data");
const NO_LOGS = _("No logs");

const copyToClipboard = (text) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
};

const renderLogLines = (container, rawText, isReversed) => {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (!rawText) {
        container.textContent = NO_DATA;
        return;
    }

    let lines = rawText.split("\n");
    if (isReversed) {
        lines = lines.reverse();
    }

    const fragment = document.createDocumentFragment();

    lines.forEach(line => {
        if (!line.trim()) return;

        let className = "log-line";
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes("error") || lowerLine.includes("level=error") || lowerLine.includes("daemon.err")) {
            className += " log-error";
        } else if (lowerLine.includes("warn") || lowerLine.includes("level=warn") || lowerLine.includes("warning") || lowerLine.includes("daemon.warn")) {
            className += " log-warn";
        } else if (lowerLine.includes("info") || lowerLine.includes("level=info")) {
            className += " log-info";
        } else if (lowerLine.includes("debug") || lowerLine.includes("level=debug")) {
            className += " log-debug";
        }

        const lineEl = E("div", { class: className }, line);
        fragment.appendChild(lineEl);
    });

    container.appendChild(fragment);
};

const updateLogs = async (logContainer, btn, reverseCheckbox, rawLogs) => {
    if (btn) btn.disabled = true;
    try {
        const res = await fs.exec(common.binPath, ["systemlogs", common.logsCount]);
        rawLogs.value = res.stdout || NO_LOGS;
        if (rawLogs.value.endsWith("\n")) {
            rawLogs.value = rawLogs.value.slice(0, -1);
        }
        renderLogLines(logContainer, rawLogs.value, reverseCheckbox.checked);
    } catch (e) {
        ui.addNotification(_("Error"), E("p", `${e.message || e}`), "danger");
    } finally {
        if (btn) btn.disabled = false;
    }
};

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,

    render: function () {
        const logContainer = E("div", {
            class: "jc-logs-terminal",
            id: "logContainer"
        }, [NO_DATA]);

        const rawLogs = { value: NO_DATA };

        const reverseCheckbox = E("input", {
            type: "checkbox",
            id: "reverseLogs",
            class: "jc-ml",
            checked: true,
            change: () => renderLogLines(logContainer, rawLogs.value, reverseCheckbox.checked)
        });

        const refreshBtn = E("button", {
            class: "cbi-button cbi-button-action",
            click: () => updateLogs(logContainer, refreshBtn, reverseCheckbox, rawLogs)
        }, [_("Update")]);

        const tailBtn = E("button", {
            class: "cbi-button cbi-button-neutral",
            click: () => {
                logContainer.scrollTop = logContainer.scrollHeight;
            },
        }, [_("To bottom")]);

        const copyBtn = E("button", {
            class: "cbi-button",
            click: () => {
                if (rawLogs.value === NO_DATA || rawLogs.value === NO_LOGS) return;
                copyToClipboard(rawLogs.value);
            },
        }, [_("Copy logs")]);

        const topBtn = E("button", {
            class: "cbi-button cbi-button-neutral",
            click: () => {
                logContainer.scrollTop = 0;
            },
        }, [_("To top")]);

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
            updateLogs(logContainer, refreshBtn, reverseCheckbox, rawLogs);
        });

        const style = E("style", {}, `
            .jc-ml { margin-left: 0.5em !important; }

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
                resize: vertical; /* Разрешить менять высоту */
            }

            .log-line {
                padding: 1px 0;
                border-bottom: 1px solid transparent;
            }
            .log-line:hover {
                background-color: #2a2d2e; /* Подсветка строки при наведении */
            }

            .log-error { color: #f48771; } /* Светло-красный */
            .log-warn  { color: #cca700; } /* Желтый */
            .log-info  { color: #75beff; } /* Голубой */
            .log-debug { color: #8b949e; } /* Серый */

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
            logContainer,
            buttonBottomBar
        ]);
    }
});
