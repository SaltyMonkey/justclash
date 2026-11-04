"use strict";
"require view";
"require ui";
"require view.justclash.common as common";
"require view.justclash.api.mihomo as mihomoApi";
"require view.justclash.lib.rules as rulesModel";
"require uci";

const normalizeProviders = (response) => {
    const providers = response?.providers;
    if (!providers || typeof providers !== "object" || Array.isArray(providers))
        return [];

    return Object.entries(providers)
        .filter(([, provider]) => provider && typeof provider === "object" && !Array.isArray(provider))
        .map(([name, provider]) => ({ ...provider, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
};

const formatUpdatedAt = (value) => {
    if (!value || String(value).startsWith("0001-"))
        return "—";
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString() : "—";
};

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,

    load: async function () {
        let token = "";
        try {
            await uci.load(common.binName);
            token = uci.get(common.binName, "proxy", "api_password") || "";
            mihomoApi.setTls(uci.get(common.binName, "proxy", "api_tls") === "1");
        } catch (e) {
            ui.addNotification(_("Error"), E("p", _("Failed to load configuration") + ": " + (e.message || String(e))), "danger");
            return { token, providers: [], configLoadFailed: true, fetchFailed: true };
        }

        try {
            const providers = normalizeProviders(await mihomoApi.fetchRuleProviders(token));
            return { token, providers, fetchedAt: new Date(), configLoadFailed: false, fetchFailed: false };
        } catch (e) {
            ui.addNotification(_("Error"), E("p", _("Failed to load Mihomo rule providers") + ": " + (e.message || String(e))), "danger");
            return { token, providers: [], configLoadFailed: false, fetchFailed: true };
        }
    },

    render: function (result) {
        let busy = false;
        let rows = [];
        let updateButtons = [];
        const rowsContainer = E("div");
        const lastFetchLabel = E("span", { class: "jc-log-fetch-label" });
        const updateLastFetchTime = (date) => {
            lastFetchLabel.textContent = _("Last updated: ") + (date ? date.toLocaleString() : "—");
        };
        const applySearch = () => {
            const query = searchInput.value.toLowerCase().trim();
            for (const row of rows)
                row.element.style.display = rulesModel.matchesSearch(row.searchText, query) ? "" : "none";
        };
        const searchInput = E("input", {
            type: "text",
            class: "cbi-input-text jc-search-input",
            placeholder: _("Search rule providers by name, type, behavior or format..."),
            input: applySearch
        });
        const syncButtons = () => {
            const disabled = busy || result.configLoadFailed;
            refreshBtn.disabled = disabled;
            for (const button of updateButtons)
                button.disabled = disabled;
        };
        const showError = (message, error) => ui.addTimeLimitedNotification(
            _("Error"), E("p", message + ": " + (error.message || String(error))), common.notificationTimeout, "danger"
        );
        const fetchProviders = async () => {
            const providers = normalizeProviders(await mihomoApi.fetchRuleProviders(result.token));
            renderProviders(providers);
            updateLastFetchTime(new Date());
        };
        const runAction = async (providerName = null) => {
            if (busy || result.configLoadFailed)
                return;

            busy = true;
            syncButtons();
            try {
                if (providerName !== null)
                    await mihomoApi.updateRulesetProvider(providerName, result.token, 30000);

                // A successful PUT stays successful even if the following GET sulks.
                try {
                    await fetchProviders();
                } catch (e) {
                    showError(providerName === null
                        ? _("Failed to load Mihomo rule providers")
                        : _("Ruleset updated, but failed to refresh rule providers"), e);
                }
            } catch (e) {
                showError(_("Failed to update ruleset"), e);
            } finally {
                busy = false;
                syncButtons();
            }
        };
        const refreshBtn = E("button", {
            type: "button",
            class: "cbi-button cbi-button-action",
            click: () => runAction()
        }, _("Refresh"));

        const renderProviders = (providers) => {
            const fragment = document.createDocumentFragment();
            rows = [];
            updateButtons = [];
            for (const provider of providers) {
                const type = String(provider.vehicleType || provider.type || "");
                const behavior = String(provider.behavior || "");
                const format = String(provider.format || "");
                const updateBtn = E("button", {
                    type: "button",
                    class: "cbi-button cbi-button-action jc-provider-update-button",
                    click: () => runAction(provider.name)
                }, _("Update"));
                updateButtons.push(updateBtn);
                const ruleCount = Number.isInteger(provider.ruleCount) && provider.ruleCount >= 0 ? String(provider.ruleCount) : "—";
                const row = E("div", { class: "jc-grid-row jc-rule-provider-row" }, [
                    E("div", { class: "jc-grid-col jc-col-action", "data-label": _("Action") }, updateBtn),
                    E("div", { class: "jc-grid-col jc-provider-name", "data-label": _("Name") }, provider.name),
                    E("div", { class: "jc-grid-col", "data-label": _("Type") }, [
                        E("span", { class: "jc-badge-builtin" }, type || "—")
                    ]),
                    E("div", { class: "jc-grid-col", "data-label": _("Behavior") }, [
                        E("span", { class: "jc-badge-type " + rulesModel.getTypeClass(behavior) }, behavior || "—")
                    ]),
                    E("div", { class: "jc-grid-col", "data-label": _("Format") }, [
                        E("span", { class: "jc-badge-builtin" }, format || "—")
                    ]),
                    E("div", { class: "jc-grid-col", "data-label": _("Rules") }, ruleCount),
                    E("div", { class: "jc-grid-col jc-provider-date", "data-label": _("Updated at") }, formatUpdatedAt(provider.updatedAt))
                ]);
                rows.push({ element: row, searchText: [provider.name, type, behavior, format].join("\n").toLowerCase() });
                fragment.appendChild(row);
            }
            rowsContainer.replaceChildren(fragment);
            applySearch();
            syncButtons();
        };

        const grid = E("div", { class: "jc-grid-container" }, [
            E("div", { class: "jc-grid-header" }, [
                E("div", {}, _("Action")), E("div", {}, _("Name")), E("div", {}, _("Type")),
                E("div", {}, _("Behavior")), E("div", {}, _("Format")), E("div", {}, _("Rules")), E("div", {}, _("Updated at"))
            ]),
            rowsContainer
        ]);
        updateLastFetchTime(result.fetchFailed ? null : result.fetchedAt);
        renderProviders(result.providers);

        const style = E("style", {}, `
            .jc-rule-providers .jc-actions-wrap{padding:.7em .8em;border:1px solid var(--border-color-medium,#d9d9d9);border-radius:.375rem;background:var(--background-color-medium,#f6f6f6);margin-bottom:1rem;}
            .jc-rule-providers .jc-primary-actions{display:flex;flex-wrap:wrap;align-items:center;gap:.65em;margin:0;width:100%;}
            .jc-rule-providers .jc-search-input{width:100%;max-width:400px;min-width:0;}
            .jc-rule-providers .jc-log-fetch-label{color:var(--text-color-medium,#888);font-size:.9em;margin-left:.5rem;}
            .jc-rule-providers .jc-grid-container{display:flex;flex-direction:column;border:1px solid var(--border-color-medium,#d9d9d9);border-radius:.5rem;overflow:hidden;background:var(--background-color-low,#fff);margin-bottom:1rem;}
            .jc-rule-providers .jc-grid-header,.jc-rule-providers .jc-grid-row{display:grid;grid-template-columns:7rem minmax(0,1.5fr) 4.5rem 6.5rem 4.5rem 4rem 10rem;gap:.75rem;padding:.25rem .9375rem;align-items:center;}
            .jc-rule-providers .jc-grid-header{background:var(--background-color-medium,#f6f6f6);border-bottom:1px solid var(--border-color-medium,#d9d9d9);font-weight:bold;}
            .jc-rule-providers .jc-grid-header>div,.jc-rule-providers .jc-grid-col{min-width:0;overflow-wrap:anywhere;}
            .jc-rule-providers .jc-grid-row{padding:.1875rem .9375rem;min-height:1.6875rem;box-sizing:border-box;}
            .jc-rule-providers .jc-grid-row:nth-child(even){background:var(--background-color-medium,#fafafa);}
            .jc-rule-providers .jc-grid-row:hover{background:var(--background-color-high,rgba(0,0,0,.02));}
            .jc-rule-providers .jc-grid-col{display:flex;align-items:center;}
            .jc-rule-providers .jc-provider-name{font-family:ui-monospace,monospace;}
            .jc-rule-providers .jc-provider-date{font-size:.9em;}
            .jc-rule-providers .jc-col-action{justify-content:flex-start;}
            .jc-rule-providers button.cbi-button.jc-provider-update-button{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;font:inherit;font-size:.88em;font-weight:500;line-height:1.2;white-space:nowrap;margin:0;min-height:0;height:auto;padding:.18rem .5rem;box-sizing:border-box;}
            .jc-rule-providers .jc-badge-type,.jc-rule-providers .jc-badge-builtin{display:inline-block;padding:.15rem .45rem;border-radius:.25rem;font-size:.8em;line-height:1.2;box-sizing:border-box;max-width:100%;overflow-wrap:anywhere;}
            .jc-rule-providers .jc-badge-type{font-weight:bold;text-transform:uppercase;text-align:center;}
            .jc-rule-providers .jc-badge-type.domain{background:color-mix(in srgb,var(--primary-color-medium,#4f8cff) 10%,transparent);color:var(--primary-color-medium,#4f8cff);border:1px solid color-mix(in srgb,var(--primary-color-medium,#4f8cff) 20%,transparent);}
            .jc-rule-providers .jc-badge-type.ipcidr{background:color-mix(in srgb,var(--success-color-medium,#2f9e44) 10%,transparent);color:var(--success-color-medium,#2f9e44);border:1px solid color-mix(in srgb,var(--success-color-medium,#2f9e44) 20%,transparent);}
            .jc-rule-providers .jc-badge-type.classical{background:color-mix(in srgb,var(--warn-color-medium,#fd7e14) 10%,transparent);color:var(--warn-color-medium,#fd7e14);border:1px solid color-mix(in srgb,var(--warn-color-medium,#fd7e14) 20%,transparent);}
            .jc-rule-providers .jc-badge-builtin{background:var(--background-color-medium,#f6f6f6);color:var(--text-color-medium,#888);border:1px solid var(--border-color-medium,#d9d9d9);font-weight:500;}
            @media(max-width:60rem){
                .jc-rule-providers>.cbi-section-node{font-size:inherit;}
                .jc-rule-providers .jc-grid-container{font-size:1em;}
                .jc-rule-providers .jc-provider-date{font-size:1em;}
                .jc-rule-providers .jc-grid-header{display:none;}
                .jc-rule-providers .jc-grid-row{grid-template-columns:1fr;gap:.625rem;padding:1rem;border-bottom:1px solid var(--border-color-medium,#d9d9d9);}
                .jc-rule-providers .jc-grid-row:last-child{border-bottom:none;}
                .jc-rule-providers .jc-grid-col{flex-direction:column;align-items:flex-start;width:100%;}
                .jc-rule-providers .jc-grid-col::before{content:attr(data-label);font-size:.8em;font-weight:bold;color:var(--text-color-medium,#888);margin-bottom:.25rem;text-transform:uppercase;}
                .jc-rule-providers .jc-col-action{align-items:flex-end;margin-top:.3125rem;}
                .jc-rule-providers .jc-col-action::before{display:none;}
            }
        `);
        return E("div", { class: "cbi-section fade-in jc-rule-providers" }, [
            E("h3", { class: "cbi-section-title" }, _("Rule Providers")),
            E("div", { class: "cbi-section-descr" }, _("Rule providers loaded by Mihomo. Update individual rulesets and view their status.")),
            E("div", { class: "jc-actions-wrap" }, [
                E("div", { class: "cbi-section-actions jc-primary-actions" }, [searchInput, refreshBtn, lastFetchLabel])
            ]),
            E("div", { class: "cbi-section-node" }, grid),
            style
        ]);
    }
});
