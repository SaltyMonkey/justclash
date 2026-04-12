"use strict";
"require view";
"require ui";
"require uci";
"require view.justclash.helper_clipboard as clipboard";
"require view.justclash.helper_luci_session as luciSession";
"require view.justclash.helper_common as common";
"require view.justclash.helper_mihomo_api as mihomoApi";

const NO_LOGS = _("No log entries");
const MAX_LOG_ENTRIES = parseInt(common.logsCount, 10);
const LOG_BADGE_TYPES = new Set(common.defaultLoggingLevels.filter((level) => level !== "silent"));
const LOG_LEVEL_OPTIONS = common.defaultLoggingLevels.slice(0, -1);
const DEFAULT_LOG_LEVEL = "warning";

let wsCleanup = null;
let logEntries = [];
let visibilityChangeHandler = null;
let beforeUnloadHandler = null;

const normalizeLogMessage = (rawMessage) => {
    const message = typeof rawMessage === "string" ? rawMessage.trim() : "";

    if (!message)
        return null;

    try {
        const parsed = JSON.parse(message);

        if (parsed && typeof parsed === "object" && parsed.payload !== undefined && parsed.payload !== null) {
            const text = typeof parsed.payload === "string"
                ? parsed.payload.trim()
                : JSON.stringify(parsed.payload);

            if (!text)
                return null;

            return {
                text,
                type: normalizeLogType(parsed.type),
                raw: message
            };
        }
    } catch (e) {}

    return {
        text: message,
        type: "",
        raw: message
    };
};

const normalizeLogType = (value) => {
    const type = typeof value === "string" ? value.trim().toLowerCase() : "";

    if (!type)
        return "";

    if (type === "warn")
        return "warning";

    return LOG_BADGE_TYPES.has(type) ? type : "";
};

const appendLogEntry = (container, entry) => {
    if (container.childNodes.length === 1 && container.firstChild?.nodeType === Node.TEXT_NODE)
        container.replaceChildren();

    const type = entry?.type || "";
    const lineClass = `log-line${type ? ` log-line-${type}` : ""}`;
    const children = [];

    if (type)
        children.push(E("span", { class: `log-type-badge log-type-badge-${type}` }, type.toUpperCase()));

    children.push(E("span", { class: "log-message" }, entry?.text || ""));

    container.appendChild(E("div", { class: lineClass }, children));

    while (container.childNodes.length > MAX_LOG_ENTRIES)
        container.removeChild(container.firstChild);
};

const resetLogEntries = (container) => {
    logEntries = [];
    container.replaceChildren(document.createTextNode(NO_LOGS));
};

const cleanup = () => {
    if (visibilityChangeHandler) {
        document.removeEventListener("visibilitychange", visibilityChangeHandler);
        visibilityChangeHandler = null;
    }
    if (beforeUnloadHandler) {
        window.removeEventListener("beforeunload", beforeUnloadHandler);
        beforeUnloadHandler = null;
    }
    if (wsCleanup) {
        wsCleanup();
        wsCleanup = null;
    }
};

const connectLogsStream = async (container, token, level, resetState = true) => {
    if (wsCleanup) {
        wsCleanup();
        wsCleanup = null;
    }

    if (resetState)
        resetLogEntries(container);

    if (document.hidden)
        return;

    if (!await luciSession.isSessionAlive())
        return;

    wsCleanup = mihomoApi.createLogsWebSocket({
        token,
        level,
        containerCheck: () => document.body.contains(container),
        onMessage: (event) => {
            const entry = normalizeLogMessage(event.data);

            if (!entry)
                return;

            logEntries.push(entry.raw || entry.text);
            if (logEntries.length > MAX_LOG_ENTRIES)
                logEntries.shift();

            appendLogEntry(container, entry);
        }
    });
};

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,

    async load() {
        let apiToken = "";
        let logLevel = DEFAULT_LOG_LEVEL;

        try {
            await uci.load(common.binName);
            apiToken = uci.get(common.binName, "proxy", "api_password") || "";
            logLevel = uci.get(common.binName, "proxy", "log_level") || DEFAULT_LOG_LEVEL;
        } catch (e) {}

        if (!LOG_LEVEL_OPTIONS.includes(logLevel))
            logLevel = DEFAULT_LOG_LEVEL;

        return { apiToken, logLevel };
    },

    render(results) {
        const logContainer = E("div", { class: "jc-logs-terminal", id: "realtimeLogContainer" }, [NO_LOGS]);
        const levelSelect = E("select", {
            class: "cbi-input-select jc-level-select",
            change: () => {
                if (!document.hidden)
                    connectLogsStream(logContainer, results.apiToken, levelSelect.value);
                else
                    resetLogEntries(logContainer);
            }
        }, LOG_LEVEL_OPTIONS.map((level) => E("option", { value: level }, level)));

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
        levelSelect.value = results.logLevel || DEFAULT_LOG_LEVEL;

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

        requestAnimationFrame(() => {
            if (!document.hidden)
                connectLogsStream(logContainer, results.apiToken, levelSelect.value);
        });

        if (visibilityChangeHandler) {
            document.removeEventListener("visibilitychange", visibilityChangeHandler);
        }

        visibilityChangeHandler = () => {
            console.debug(`[realtime_logs] visibilitychange: ${document.hidden ? "hidden" : "visible"}`);
            if (document.hidden) {
                if (wsCleanup) {
                    wsCleanup();
                    wsCleanup = null;
                }
            } else {
                connectLogsStream(logContainer, results.apiToken, levelSelect.value, false);
            }
        };

        document.addEventListener("visibilitychange", visibilityChangeHandler);

        if (beforeUnloadHandler)
            window.removeEventListener("beforeunload", beforeUnloadHandler);

        beforeUnloadHandler = () => {
            console.debug("[realtime_logs] beforeunload: cleanup");
            cleanup();
        };

        window.addEventListener("beforeunload", beforeUnloadHandler);

        const style = E("style", {}, `
            .jc-ml{margin-left:.5em !important;}
            .jc-level-control,.jc-primary-actions{align-items:center;}
            .jc-level-control{display:inline-flex;gap:.75em;flex-wrap:nowrap;}
            .jc-level-label{margin:0;white-space:nowrap;}
            .jc-level-select{width:auto !important;min-width:220px;margin:0 !important;flex:0 0 auto;}
            .jc-logs-terminal{width:100%;font-family:'Menlo', 'Consolas', 'Monaco', monospace;font-size:12px;line-height:1.4;white-space:pre-wrap;word-break:break-all;overflow-y:auto;overflow-x:hidden;background-color:#1e1e1e;color:#d4d4d4;border:1px solid #3c3c3c;border-radius:6px;padding:10px;margin-bottom:10px !important;height:500px;resize:vertical;}
            .log-line{padding:1px 0;border-bottom:1px solid transparent;}
            .log-line:hover{background-color:#2a2d2e;}
            .log-type-badge{display:inline-flex;align-items:center;justify-content:center;min-width:5.8em;margin-right:.6em;padding:.1em .55em;border:1px solid transparent;border-radius:999px;font-size:.82em;font-weight:700;line-height:1.25;vertical-align:middle;}
            .log-type-badge-error{color:#ff7b72;border-color:rgba(255,123,114,.35);background:rgba(255,123,114,.12);}
            .log-type-badge-warning{color:#f2cc60;border-color:rgba(242,204,96,.35);background:rgba(242,204,96,.12);}
            .log-type-badge-info{color:#7ee787;border-color:rgba(126,231,135,.35);background:rgba(126,231,135,.12);}
            .log-type-badge-debug{color:#79c0ff;border-color:rgba(121,192,255,.35);background:rgba(121,192,255,.12);}
            .log-line-error .log-message{color:#ffb4ab;}
            .log-line-warning .log-message{color:#f6d98b;}
            .log-line-info .log-message{color:#9dd9a6;}
            .log-line-debug .log-message{color:#9ecbff;}
            .cbi-section-actions + .cbi-section-actions{margin-top:8px;}
            .jc-actions-wrap{padding:.7em .8em;margin-bottom:10px;border:1px solid var(--border-color-medium, #d9d9d9);border-radius:6px;background:var(--background-color-medium, #f6f6f6);}
            .jc-primary-actions{display:flex;flex-wrap:wrap;gap:.65em;margin:0;}
            .jc-primary-actions .cbi-button{margin:0 !important;}
            .jc-settings-actions{justify-content:flex-start;}
            [data-theme="dark"] .jc-actions-wrap{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.04);}
        `);

        return E("div", { class: "cbi-section fade-in" }, [
            style,
            E("h3", { class: "cbi-section-title" }, _("Realtime logs")),
            buttonBar,
            settingsBar,
            logContainer,
            buttonBottomBar
        ]);
    }
});
