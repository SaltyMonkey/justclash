"use strict";
"require baseclass";
"require ui";
"require view.justclash.lib.clipboard as clipboard";
"require view.justclash.api.ubus as ubusApi";
"require view.justclash.api.mihomo as mihomoApi";

const showError = (message) => {
    ui.showModal(_("Error"), [
        E("div", { class: "alert-message error" }, message),
        E("div", { class: "jc-modal-actions" }, [
            E("button", { class: "cbi-button", click: () => ui.hideModal() }, [_("Dismiss")])
        ])
    ]);
};

const showText = (notificationTimeout, title, warning, task, options = {}) => async () => {
    const warningNodes = warning ? [
        E("strong", { class: "jc-modal-warning" }, _("Dangerous action!")),
        E("div", { class: "jc-modal-warning-text" }, warning)
    ] : [];
    const loadingText = options.loadingText || _("Please wait...");
    const allowCopy = options.allowCopy !== false;

    ui.showModal(title, [E("p", loadingText)]);

    try {
        const output = await task();
        const actions = [];

        if (allowCopy) {
            actions.push(E("button", {
                class: "cbi-button cbi-button-action",
                click: async () => {
                    try {
                        await clipboard.copy(output || "");
                        ui.hideModal();
                    } catch (error) {
                        ui.addTimeLimitedNotification(_("Error"), E("p", `${error.message || error}`), notificationTimeout, "danger");
                        console.error("Failed to copy modal output to clipboard", error);
                    }
                }
            }, [_("Copy to clipboard")]));
        }

        actions.push(E("button", {
            class: "cbi-button",
            style: allowCopy ? "margin-left: 0.3125rem;" : "",
            click: () => ui.hideModal()
        }, [_("Dismiss")]));

        ui.showModal(title, [
            ...warningNodes,
            E("pre", { class: "jc-modal-pre" }, output || _("No response")),
            E("div", { class: "jc-modal-actions" }, actions)
        ]);
    } catch (error) {
        showError(error.message || String(error));
    }
};

const showRpc = (notificationTimeout, title, warning, task, afterRpc) =>
    showText(notificationTimeout, title, warning, async () => {
        const response = await task();
        if (afterRpc)
            await afterRpc(response);
        return response.stdout || _("No response");
    });

const showConfirmRpc = (notificationTimeout, title, warning, task, afterRpc) => async () => {
    ui.showModal(title, [
        E("strong", { class: "jc-modal-warning" }, _("Dangerous action!")),
        E("div", { class: "jc-modal-warning-text" }, warning),
        E("div", { class: "jc-modal-actions" }, [
            E("button", {
                class: "cbi-button cbi-button-negative",
                click: async () => {
                    ui.hideModal();
                    await showRpc(notificationTimeout, title, false, task, afterRpc)();
                }
            }, [_("Run")]),
            E("button", {
                class: "cbi-button",
                style: "margin-left: 0.3125rem;",
                click: () => ui.hideModal()
            }, [_("Cancel")])
        ])
    ]);
};

const showConfigRpc = (notificationTimeout, title, safeTask, unsafeTask) => async () => {
    const copy = async (output) => {
        try {
            await clipboard.copy(output || "");
            ui.hideModal();
        } catch (error) {
            ui.addTimeLimitedNotification(_("Error"), E("p", `${error.message || error}`), notificationTimeout, "danger");
            console.error("Failed to copy config output to clipboard", error);
        }
    };

    ui.showModal(title, [E("p", _("Please wait..."))]);

    try {
        const response = await safeTask();
        const safeOutput = response.stdout || "";

        ui.showModal(title, [
            E("pre", { class: "jc-modal-pre" }, safeOutput || _("No response")),
            E("div", { class: "jc-modal-actions" }, [
                E("button", {
                    class: "cbi-button cbi-button-action",
                    click: () => copy(safeOutput)
                }, [_("Copy JSON")]),
                E("button", {
                    class: "cbi-button cbi-button-negative",
                    style: "margin-left: 0.3125rem;",
                    click: async () => {
                        ui.showModal(title, [E("p", _("Please wait..."))]);
                        try {
                            const unsafeResponse = await unsafeTask();
                            await copy(unsafeResponse.stdout || "");
                        } catch (error) {
                            showError(error.message || String(error));
                        }
                    }
                }, [_("Copy JSON unsafe")]),
                E("button", {
                    class: "cbi-button",
                    style: "margin-left: 0.3125rem;",
                    click: () => ui.hideModal()
                }, [_("Dismiss")])
            ])
        ]);
    } catch (error) {
        showError(error.message || String(error));
    }
};

const normalizeRuleProviders = (payload) => {
    const providers = payload && typeof payload === "object" && payload.providers && typeof payload.providers === "object"
        ? payload.providers
        : payload;

    if (!providers || typeof providers !== "object")
        return [];

    return Object.keys(providers)
        .filter(name => name && typeof name === "string")
        .map(name => ({ name, data: providers[name] || {} }))
        .sort((a, b) => a.name.localeCompare(b.name));
};

const showUpdateRulesets = (notificationTimeout, token) =>
    showText(notificationTimeout, _("Update rulesets"), false, async () => {
        const payload = await mihomoApi.fetchRuleProviders(token);
        const rows = normalizeRuleProviders(payload).map((ruleset) => ({
            name: ruleset.name,
            status: _("Updated")
        }));
        let hasErrors = false;

        for (const entry of rows) {
            try {
                await mihomoApi.updateRulesetProvider(entry.name, token);
            } catch (error) {
                hasErrors = true;
                entry.status = `${_("Failed")}: ${error.message || _("Error")}`;
            }
        }

        const finalStatus = rows.length === 0
            ? _("No rulesets returned by API.")
            : (hasErrors ? _("Completed with errors") : _("Completed"));
        const listText = rows.length > 0
            ? rows.map(entry => `${entry.name}: ${entry.status}`).join("\n")
            : _("No rulesets returned by API.");

        return `${_("Received rulesets:")}\n${listText}\n\n${_("Status")}\n${finalStatus}`;
    }, {
        allowCopy: false,
        loadingText: _("Getting rulesets...")
    });

const create = ({ notificationTimeout = 3000 } = {}) => ({
    showRpc: (...args) => showRpc(notificationTimeout, ...args),
    showConfirmRpc: (...args) => showConfirmRpc(notificationTimeout, ...args),
    showConfigRpc: (...args) => showConfigRpc(notificationTimeout, ...args),
    showUpdateRulesets: (...args) => showUpdateRulesets(notificationTimeout, ...args)
});

return baseclass.extend({ create });
