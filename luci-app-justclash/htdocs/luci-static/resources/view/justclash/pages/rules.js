"use strict";
"require view";
"require ui";
"require view.justclash.common as common";
"require view.justclash.api.mihomo as mihomoApi";
"require view.justclash.lib.rules as rulesModel";
"require uci";

const normalizeRules = (response) => Array.isArray(response?.rules) ? response.rules : [];

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
            return { token, rules: [], configLoadFailed: true, fetchFailed: true };
        }

        try {
            const rules = normalizeRules(await mihomoApi.fetchRules(token));
            return { token, rules, fetchedAt: new Date(), configLoadFailed: false, fetchFailed: false };
        } catch (e) {
            ui.addNotification(_("Error"), E("p", _("Failed to load Mihomo rules") + ": " + (e.message || String(e))), "danger");
            return { token, rules: [], configLoadFailed: false, fetchFailed: true };
        }
    },

    render: function (result) {
        let busy = false;
        let rows = [];
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
            placeholder: _("Search rules by type, payload or proxy..."),
            input: applySearch
        });
        const syncButtons = () => {
            const disabled = busy || result.configLoadFailed;
            refreshBtn.disabled = disabled;
            for (const row of rows)
                row.toggle.disabled = disabled;
        };
        const runAction = async (task) => {
            if (busy || result.configLoadFailed)
                return;

            busy = true;
            syncButtons();
            try {
                await task();
            } catch (e) {
                ui.addTimeLimitedNotification(_("Error"), E("p", e.message || String(e)), common.notificationTimeout, "danger");
            } finally {
                busy = false;
                syncButtons();
            }
        };
        const fetchRules = async () => {
            const rules = normalizeRules(await mihomoApi.fetchRules(result.token));
            renderRules(rules);
            updateLastFetchTime(new Date());
        };
        const refreshBtn = E("button", {
            type: "button",
            class: "cbi-button cbi-button-action",
            click: () => runAction(fetchRules)
        }, _("Refresh"));
        const actionWrap = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions" }, [searchInput, refreshBtn, lastFetchLabel])
        ]);

        const renderRules = (rules) => {
            const fragment = document.createDocumentFragment();
            rows = [];
            rules.forEach((rule, index) => {
                const checkbox = new ui.Checkbox(rule.disabled ? "0" : "1");
                const toggleNode = checkbox.render();
                const toggleInput = toggleNode.querySelector('input[type="checkbox"]');
                toggleInput.setAttribute("aria-label", _("Active"));
                toggleInput.addEventListener("change", () => {
                    if (busy || result.configLoadFailed) {
                        checkbox.setValue(rule.disabled ? "0" : "1");
                        return;
                    }
                    const isDisabled = !checkbox.isChecked();
                    return runAction(async () => {
                        try {
                            // Rule indices belong to this snapshot; refresh must wait its turn.
                            const payload = {};
                            payload[index] = isDisabled;
                            await mihomoApi.disableRule(payload, result.token);
                            rule.disabled = isDisabled;
                            row.classList.toggle("jc-disabled-rule", isDisabled);
                        } finally {
                            checkbox.setValue(rule.disabled ? "0" : "1");
                        }
                    });
                });
                const row = E("div", { class: "jc-grid-row jc-rule-row" + (rule.disabled ? " jc-disabled-rule" : "") }, [
                    E("div", { class: "jc-grid-col jc-col-action", "data-label": _("Active") }, toggleNode),
                    E("div", { class: "jc-grid-col jc-col-payload jc-payload-cell", "data-label": _("Payload") }, rule.payload || ""),
                    E("div", { class: "jc-grid-col jc-col-type", "data-label": _("Type") }, [
                        E("span", { class: "jc-badge-type " + rulesModel.getTypeClass(rule.type) }, (rule.type || "").toUpperCase())
                    ]),
                    E("div", { class: "jc-grid-col jc-col-proxy", "data-label": _("Proxy / Group") }, [
                        E("span", { class: "jc-badge-builtin" }, rule.proxy || "")
                    ])
                ]);
                rows.push({ element: row, toggle: toggleInput, searchText: rulesModel.createSearchText(rule) });
                fragment.appendChild(row);
            });
            rowsContainer.replaceChildren(fragment);
            applySearch();
            syncButtons();
        };

        const grid = E("div", { class: "jc-grid-container" }, [
            E("div", { class: "jc-grid-header" }, [
                E("div", { class: "jc-grid-col" }, _("Active")),
                E("div", { class: "jc-grid-col" }, _("Payload")),
                E("div", { class: "jc-grid-col" }, _("Type")),
                E("div", { class: "jc-grid-col" }, _("Proxy / Group"))
            ]),
            rowsContainer
        ]);
        updateLastFetchTime(result.fetchFailed ? null : result.fetchedAt);
        renderRules(result.rules);

        const style = E("style", {}, `
            .jc-actions-wrap{padding:.7em .8em;border:1px solid var(--border-color-medium, #d9d9d9);border-radius:0.375rem;background:var(--background-color-medium, #f6f6f6);margin-bottom:1rem;}
            .jc-primary-actions{display:flex;flex-wrap:wrap;align-items:center;gap:.65em;margin:0;width:100%;}
            .jc-search-input{width:100%;max-width:400px;}
            .jc-log-fetch-label{color:var(--text-color-medium, #888);font-size:.9em;margin-left:0.5rem;}
            :root[data-darkmode="true"] .jc-actions-wrap{border-color:var(--border-color-medium, rgba(255,255,255,.08));background:var(--background-color-high, rgba(255,255,255,.04));}
            .jc-grid-container{display:flex;flex-direction:column;border:1px solid var(--border-color-medium, #d9d9d9);border-radius:0.5rem;overflow:hidden;background-color:var(--background-color-low, #fff);margin-bottom:1rem;}
            :root[data-darkmode="true"] .jc-grid-container{background-color:var(--background-color-low, rgba(0,0,0,.1));}
            .jc-grid-header{display:grid;grid-template-columns:5rem minmax(0, 1fr) 7.5rem 10rem;gap:0.75rem;padding:0.25rem 0.9375rem;background-color:var(--background-color-medium, #f6f6f6);border-bottom:1px solid var(--border-color-medium, #d9d9d9);font-weight:bold;}
            .jc-grid-row{display:grid;grid-template-columns:5rem minmax(0, 1fr) 7.5rem 10rem;gap:0.75rem;padding:0.1875rem 0.9375rem;align-items:center;border-bottom:1px solid transparent;transition:background-color .15s ease,opacity .15s ease;min-height:1.6875rem;box-sizing:border-box;}
            .jc-grid-row:last-child{border-bottom:none;}
            .jc-grid-row:nth-child(odd){background:var(--background-color-medium, #fafafa);}
            .jc-grid-row:hover{background-color:var(--background-color-medium, rgba(0, 0, 0, 0.02));}
            :root[data-darkmode="true"] .jc-grid-row:hover{background-color:var(--background-color-high, rgba(255, 255, 255, 0.03));}
            .jc-grid-row.jc-disabled-rule{opacity:.55;background-color:var(--background-color-medium, rgba(0,0,0,.01));}
            :root[data-darkmode="true"] .jc-grid-row.jc-disabled-rule{background-color:var(--background-color-medium, rgba(0,0,0,.2));}
            .jc-grid-col{min-width:0;display:flex;align-items:center;}
            .jc-payload-cell{font-family:ui-monospace,monospace;word-break:break-all;}
            .jc-badge-type{display:inline-block;padding:0.15rem 0.45rem;border-radius:0.25rem;font-size:0.8em;font-weight:bold;text-transform:uppercase;line-height:1.2;min-width:4.7rem;text-align:center;box-sizing:border-box;}
            .jc-badge-type.domain{background-color:color-mix(in srgb, var(--primary-color-medium, #4f8cff) 10%, transparent);color:var(--primary-color-medium, #4f8cff);border:1px solid color-mix(in srgb, var(--primary-color-medium, #4f8cff) 20%, transparent);}
            .jc-badge-type.ipcidr{background-color:color-mix(in srgb, var(--success-color-medium, #2f9e44) 10%, transparent);color:var(--success-color-medium, #2f9e44);border:1px solid color-mix(in srgb, var(--success-color-medium, #2f9e44) 20%, transparent);}
            .jc-badge-type.classical{background-color:color-mix(in srgb, var(--warn-color-medium, #fd7e14) 10%, transparent);color:var(--warn-color-medium, #fd7e14);border:1px solid color-mix(in srgb, var(--warn-color-medium, #fd7e14) 20%, transparent);}
            .jc-badge-builtin{display:inline-block;padding:0.15rem 0.45rem;border-radius:0.25rem;font-size:0.8em;background-color:var(--background-color-medium, #f6f6f6);color:var(--text-color-medium, #888);border:1px solid var(--border-color-medium, #d9d9d9);font-weight:500;line-height:1.2;box-sizing:border-box;}
            @media (max-width:48rem){
                .jc-rules>.cbi-section-node{font-size:inherit;}
                .jc-rules .jc-grid-container{font-size:1em;}
                .jc-grid-header{display:none;}
                .jc-grid-row{grid-template-columns:1fr;gap:0.625rem;padding:1rem;border-bottom:1px solid var(--border-color-medium, #d9d9d9);}
                .jc-grid-row:last-child{border-bottom:none;}
                .jc-grid-col{display:flex;flex-direction:column;align-items:flex-start;width:100%;}
                .jc-grid-col::before{content:attr(data-label);font-size:0.8em;font-weight:bold;color:var(--text-color-medium, #888);margin-bottom:0.25rem;text-transform:uppercase;}
                .jc-grid-col.jc-col-action{align-items:flex-end;margin-top:0.3125rem;}
                .jc-grid-col.jc-col-action::before{display:none;}
            }
        `);

        const container = E("div", { class: "cbi-section fade-in jc-rules" }, [
            E("h3", { class: "cbi-section-title" }, _("Rules")),
            E("div", { class: "cbi-section-descr" }, _("Mihomo rules list and routing information. Rules can be temporarily disabled (resets on service restart).")),
            actionWrap,
            E("div", { class: "cbi-section-node" }, [
                grid
            ]),
            style
        ]);

        return container;
    }
});
