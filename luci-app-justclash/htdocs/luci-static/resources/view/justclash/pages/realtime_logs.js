"use strict";
"require view";
"require ui";
"require uci";
"require view.justclash.lib.clipboard as clipboard";
"require view.justclash.common as common";
"require view.justclash.lib.logs as logs";
"require view.justclash.api.mihomo as mihomoApi";
"require view.justclash.lib.socket as socketRuntime";

const MAX_LOG_ENTRIES = parseInt(common.realtimeLogsCount, 10);
const LOG_LEVEL_OPTIONS = common.defaultLoggingLevels.slice(0, -1);
const DEFAULT_LOG_LEVEL = "warning";

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
        } catch { /* ignore */ }

        if (!LOG_LEVEL_OPTIONS.some(item => item.value === logLevel))
            logLevel = DEFAULT_LOG_LEVEL;

        return { apiToken, logLevel };
    },

    render(results) {
        let stream = null;
        let requestedLevel = results.logLevel;
        const logEntries = [];
        let visibilityChangeHandler = null;
        let beforeUnloadHandler = null;
        let isReversed = false;

        const resetLogEntries = (container) => {
            logEntries.length = 0;
            logs.renderEntries(container, logEntries);
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
            stream?.stop();
        };

        const connectLogsStream = (level, resetState = true) => {
            requestedLevel = level;

            if (resetState)
                resetLogEntries(logContainer);

            return stream.connect();
        };

        const logContainer = E("div", { class: "jc-logs-terminal", id: "realtimeLogContainer" }, [logs.emptyText]);

        stream = socketRuntime.createConnector({
            isMounted: () => document.body.contains(logContainer),
            onInactive: cleanup,
            open: ({ guard }) => mihomoApi.createLogsWebSocket({
                token: results.apiToken,
                level: requestedLevel,
                containerCheck: () => document.body.contains(logContainer),
                onMessage: guard((event) => {
                    const entry = logs.normalizeRealtimeMessage(event.data);

                    if (!entry)
                        return;

                    logs.appendToBuffer(logEntries, entry, MAX_LOG_ENTRIES);
                    logs.appendEntry(logContainer, entry, isReversed, MAX_LOG_ENTRIES);
                })
            })
        });
        const levelChoices = {};
        LOG_LEVEL_OPTIONS.forEach((item) => {
            levelChoices[item.value] = item.text;
        });

        const levelDropdown = new ui.Dropdown(results.logLevel || DEFAULT_LOG_LEVEL, levelChoices, {
            sort: false,
            optional: false
        });
        const levelDropdownNode = levelDropdown.render();
        levelDropdownNode.id = "jcRealtimeLogLevel";
        levelDropdownNode.classList.add("jc-level-select");

        levelDropdownNode.addEventListener("cbi-dropdown-change", () => {
            const nextLevel = String(levelDropdown.getValue() || "");

            if (!nextLevel || nextLevel === requestedLevel)
                return;

            if (!document.hidden)
                connectLogsStream(nextLevel);
            else
                resetLogEntries(logContainer);
        });

        const createCopyBtn = (isJson) => E("button", {
            class: "cbi-button cbi-button-action",
            click: async () => {
                if (!logEntries.length) return;
                try {
                    const content = isJson
                        ? logs.formatJson(logEntries)
                        : logs.formatText(logEntries);
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
                logs.renderEntries(logContainer, logEntries, isReversed);
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
                connectLogsStream(levelDropdown.getValue());
        });

        visibilityChangeHandler = () => {
            console.debug(`[realtime_logs] visibilitychange: ${document.hidden ? "hidden" : "visible"}`);
            if (document.hidden) {
                stream.stop();
            } else {
                connectLogsStream(levelDropdown.getValue(), false);
            }
        };

        document.addEventListener("visibilitychange", visibilityChangeHandler);

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
            .jc-settings-actions{justify-content:flex-start;align-items:center;}
            .jc-settings-actions .cbi-checkbox-label{margin:0;display:inline-flex;align-items:center;}
            :root[data-darkmode="true"] .jc-actions-wrap{border-color:var(--border-color-medium, rgba(255,255,255,.08));background:var(--background-color-high, rgba(255,255,255,.04));}
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
