"use strict";
"require view";
"require ui";
"require uci";
"require view.justclash.helper_clipboard as clipboard";
"require view.justclash.helper_ubus as luciSession";
"require view.justclash.helper_common as common";
"require view.justclash.helper_mihomo_api as mihomoApi";

const NO_LOGS = _("No log entries");
const MAX_LOG_ENTRIES = parseInt(common.realtimeLogsCount, 10);
const LOG_BADGE_TYPES = new Set(common.defaultLoggingLevels.filter((level) => level !== "silent"));
const LOG_LEVEL_OPTIONS = common.defaultLoggingLevels.slice(0, -1);
const DEFAULT_LOG_LEVEL = "warning";

let wsCleanup = null;
let logEntries = [];
let visibilityChangeHandler = null;
let beforeUnloadHandler = null;
let isReversed = false;

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

    const newRow = E("div", { class: lineClass }, children);

    if (isReversed) {
        container.insertBefore(newRow, container.firstChild);
    } else {
        container.appendChild(newRow);
    }

    while (container.childNodes.length > MAX_LOG_ENTRIES) {
        if (isReversed) {
            container.removeChild(container.lastChild);
        } else {
            container.removeChild(container.firstChild);
        }
    }

    if (!isReversed) {
        const isScrolledToBottom = container.scrollHeight - container.clientHeight - container.scrollTop < 50;
        if (isScrolledToBottom) {
            container.scrollTop = container.scrollHeight;
        }
    }
};

const reRenderLogs = (container) => {
    container.replaceChildren();
    if (logEntries.length === 0) {
        container.appendChild(document.createTextNode(NO_LOGS));
        return;
    }

    const fragment = document.createDocumentFragment();
    const items = isReversed ? [...logEntries].reverse() : logEntries;

    items.forEach(entry => {
        const type = entry?.type || "";
        const lineClass = `log-line${type ? ` log-line-${type}` : ""}`;
        const children = [];

        if (type)
            children.push(E("span", { class: `log-type-badge log-type-badge-${type}` }, type.toUpperCase()));

        children.push(E("span", { class: "log-message" }, entry?.text || ""));

        fragment.appendChild(E("div", { class: lineClass }, children));
    });

    container.appendChild(fragment);
    container.scrollTop = isReversed ? 0 : container.scrollHeight;
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

            logEntries.push(entry);
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
            mihomoApi.setTls(uci.get(common.binName, "proxy", "api_tls") === "1");
        } catch (e) {}

        if (!LOG_LEVEL_OPTIONS.includes(logLevel))
            logLevel = DEFAULT_LOG_LEVEL;

        return { apiToken, logLevel };
    },

    render(results) {
        const logContainer = E("div", { class: "jc-logs-terminal", id: "realtimeLogContainer" }, [NO_LOGS]);
        const levelChoices = {};
        LOG_LEVEL_OPTIONS.forEach((level) => {
            levelChoices[level] = level;
        });

        const levelDropdown = new ui.Dropdown(results.logLevel || DEFAULT_LOG_LEVEL, levelChoices, {
            sort: false,
            optional: false
        });
        const levelDropdownNode = levelDropdown.render();
        levelDropdownNode.id = "jcRealtimeLogLevel";
        levelDropdownNode.classList.add("jc-level-select");

        levelDropdownNode.addEventListener("cbi-dropdown-change", () => {
            const nextLevel = levelDropdown.getValue();
            if (!document.hidden)
                connectLogsStream(logContainer, results.apiToken, nextLevel);
            else
                resetLogEntries(logContainer);
        });

        const createCopyBtn = (isJson) => E("button", {
            class: "cbi-button cbi-button-action",
            click: async () => {
                if (!logEntries.length) return;
                try {
                    const content = isJson
                        ? JSON.stringify(logEntries.map(entry => {
                            const val = entry.raw || entry.text;
                            try {
                                return JSON.parse(val);
                            } catch (e) {
                                return val;
                            }
                        }), null, 4)
                        : logEntries.map(entry => common.formatLogEntryText(entry.raw || entry.text)).join("\n");
                    await clipboard.copy(content);
                } catch (e) {
                    ui.addTimeLimitedNotification(_("Error"), E("p", `${e.message || e}`), common.notificationTimeout, "danger");
                    console.error("Failed to copy logs to clipboard", e);
                }
            }
        }, [isJson ? _("Copy JSON") : _("Copy Text")]);

        const copyTextBtnTop = createCopyBtn(false);
        const copyJsonBtnTop = createCopyBtn(true);



        const reverseCheckbox = E("input", {
            type: "checkbox",
            id: "reverseLogs",
            class: "jc-ml",
            checked: false,
            change: () => {
                isReversed = reverseCheckbox.checked;
                reRenderLogs(logContainer);
            }
        });
        isReversed = reverseCheckbox.checked;

        const reverseLabel = E("label", { for: "reverseLogs", class: "jc-ml cbi-checkbox-label" }, [_("Newest first")]);

        const levelLabel = E("label", { class: "jc-level-label", for: "jcRealtimeLogLevel" }, [_("Level:")]);
        const levelControl = E("div", { class: "jc-level-control" }, [levelLabel, levelDropdownNode]);
        const settingsBar = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions jc-settings-actions" }, [
                levelControl,
                reverseLabel,
                reverseCheckbox
            ])
        ]);
        const buttonBar = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions" }, [
                copyTextBtnTop,
                copyJsonBtnTop
            ])
        ]);

        requestAnimationFrame(() => {
            if (!document.hidden)
                connectLogsStream(logContainer, results.apiToken, levelDropdown.getValue());
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
                connectLogsStream(logContainer, results.apiToken, levelDropdown.getValue(), false);
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
            .jc-ml{margin-left:.5em;}
            .jc-level-control,.jc-primary-actions{align-items:center;}
            .jc-level-control{display:inline-flex;gap:.75em;flex-wrap:nowrap;}
            .jc-level-label{margin:0;white-space:nowrap;}
            .jc-level-select{width:auto;min-width:220px;margin:0;flex:0 0 auto;}
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
            .jc-settings-actions{justify-content:flex-start;align-items:center;}
            .jc-settings-actions .cbi-checkbox-label{margin:0;display:inline-flex;align-items:center;}
            [data-theme="dark"] .jc-actions-wrap{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.04);}
        `);

        return E("div", { class: "cbi-section fade-in" }, [
            style,
            E("h3", { class: "cbi-section-title" }, _("Realtime logs")),
            E("div", { class: "cbi-section-descr" }, _("View realtime traffic logs and debug information from the Mihomo core.")),
            buttonBar,
            settingsBar,
            logContainer
        ]);
    }
});
