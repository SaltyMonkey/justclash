"use strict";
"require view";
"require ui";
"require uci";
"require view.justclash.helper_clipboard as clipboard";
"require view.justclash.helper_common as common";
"require view.justclash.helper_mihomo_api as mihomoApi";

const NO_LOGS = _("No log entries");
const MAX_LOG_ENTRIES = parseInt(common.logsCount, 10);

let wsCleanup = null;
let logEntries = [];

const normalizeLogMessage = (rawMessage) => {
    const message = typeof rawMessage === "string" ? rawMessage.trim() : "";

    if (!message)
        return "";

    try {
        const parsed = JSON.parse(message);

        if (parsed && typeof parsed === "object" && parsed.payload !== undefined && parsed.payload !== null) {
            return typeof parsed.payload === "string"
                ? parsed.payload.trim()
                : JSON.stringify(parsed.payload);
        }
    } catch (e) {}

    return message;
};

const appendLogEntry = (container, line) => {
    if (container.childNodes.length === 1 && container.firstChild?.nodeType === Node.TEXT_NODE)
        container.replaceChildren();

    container.appendChild(E("div", { class: "log-line" }, line));

    while (container.childNodes.length > MAX_LOG_ENTRIES)
        container.removeChild(container.firstChild);
};

const connectLogsStream = (container, token, level) => {
    if (wsCleanup) {
        wsCleanup();
        wsCleanup = null;
    }

    logEntries = [];
    container.replaceChildren(document.createTextNode(NO_LOGS));

    wsCleanup = mihomoApi.createLogsWebSocket({
        token,
        level,
        containerCheck: () => document.body.contains(container),
        onMessage: (event) => {
            const message = normalizeLogMessage(event.data);

            if (!message)
                return;

            logEntries.push(message);
            if (logEntries.length > MAX_LOG_ENTRIES)
                logEntries.shift();

            appendLogEntry(container, message);
        }
    });
};

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,

    async load() {
        let apiToken = "";

        try {
            await uci.load(common.binName);
            apiToken = uci.get(common.binName, "proxy", "api_password") || "";
        } catch (e) {}

        return { apiToken };
    },

    render(results) {
        const logContainer = E("div", { class: "jc-logs-terminal", id: "realtimeLogContainer" }, [NO_LOGS]);
        const levelSelect = E("select", {
            class: "cbi-input-select jc-level-select",
            change: () => connectLogsStream(logContainer, results.apiToken, levelSelect.value)
        }, common.defaultLoggingLevels
            .slice(0, -1)
            .map((level) => E("option", { value: level }, level)));

        const tailBtn = E("button", {
            class: "cbi-button cbi-button-neutral",
            click: () => { logContainer.scrollTop = logContainer.scrollHeight; }
        }, [_("Scroll to bottom")]);

        const copyBtn = E("button", {
            class: "cbi-button cbi-button-action",
            click: async () => {
                if (!logEntries.length) return;
                try {
                    await clipboard.copy(logEntries.join("\n"));
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

        const levelLabel = E("label", { class: "jc-level-label", for: "jcRealtimeLogLevel" }, [_("Level:")]);
        levelSelect.id = "jcRealtimeLogLevel";

        const levelControl = E("div", { class: "jc-level-control" }, [levelLabel, levelSelect]);
        const settingsBar = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions jc-settings-actions" }, [levelControl])
        ]);
        const buttonBar = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions" }, [
                tailBtn,
                copyBtn
            ])
        ]);
        const buttonBottomBar = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions" }, [topBtn])
        ]);

        requestAnimationFrame(() => connectLogsStream(logContainer, results.apiToken, levelSelect.value));

        const style = E("style", {}, `
            .jc-ml { margin-left: 0.5em !important; }
            .jc-level-control {
                display: inline-flex;
                align-items: center;
                gap: 0.75em;
                flex-wrap: nowrap;
            }
            .jc-level-label {
                margin: 0;
                white-space: nowrap;
            }
            .jc-level-select {
                width: auto !important;
                min-width: 220px;
                margin: 0 !important;
                flex: 0 0 auto;
            }

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
            .jc-settings-actions {
                justify-content: flex-start;
            }
            [data-theme="dark"] .jc-actions-wrap {
                border-color: rgba(255,255,255,0.08);
                background: rgba(255,255,255,0.04);
            }
        `);

        return E("div", { class: "cbi-section fade-in" }, [
            style,
            E("h3", { class: "cbi-section-title" }, _("Realtime logs")),
            buttonBar,
            settingsBar,
            logContainer,
            buttonBottomBar
        ]);
    },

    leave() {
        if (wsCleanup) {
            wsCleanup();
            wsCleanup = null;
        }
    }
});
