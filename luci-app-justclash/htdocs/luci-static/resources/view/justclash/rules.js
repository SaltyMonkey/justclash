"use strict";
"require view";
"require ui";
"require view.justclash.helper_common as common";
"require view.justclash.helper_mihomo_api as mihomoApi";
"require uci";

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,

    load: async function () {
        let token = "";
        let configLoadFailed = false;

        try {
            await uci.load(common.binName);
            token = uci.get(common.binName, "proxy", "api_password") || "";
            mihomoApi.setTls(uci.get(common.binName, "proxy", "api_tls") === "1");
        } catch (e) {
            configLoadFailed = true;
            console.error("Failed to load justclash config", e);
        }

        try {
            const rulesData = await mihomoApi.fetchRules(token);
            return {
                token,
                rules: rulesData?.rules || [],
                configLoadFailed,
                fetchFailed: false
            };
        } catch (e) {
            console.error("Failed to load Mihomo rules", e);
            ui.addNotification(
                _("Error"),
                E("p", _("Failed to load Mihomo rules") + ": " + (e.message || String(e))),
                "danger"
            );
            return {
                token,
                rules: [],
                configLoadFailed,
                fetchFailed: true,
                fetchError: e.message || String(e)
            };
        }
    },

    render: function (result) {


        const token = result.token;

        const getRuleTypeClass = (type) => {
            const t = String(type || "").toLowerCase();
            if (t.includes("domain") || t.includes("host") || t.includes("keyword") || t.includes("regex")) {
                return "domain";
            }
            if (t.includes("ip") || t.includes("cidr") || t.includes("geoip")) {
                return "ipcidr";
            }
            return "classical";
        };

        const searchInput = E("input", {
            type: "text",
            class: "cbi-input-text",
            placeholder: _("Search rules by type, payload or proxy..."),
            style: "width: 100%; max-width: 400px; margin: 0 !important;",
            disabled: result.fetchFailed,
            keyup: function (ev) {
                const query = ev.target.value.toLowerCase().trim();
                const rows = grid.querySelectorAll(".jc-rule-row");
                rows.forEach(row => {
                    if (row.classList.contains("jc-no-rules")) return;
                    const typeText = row.querySelector(".jc-col-type").textContent.toLowerCase();
                    const payloadText = row.querySelector(".jc-col-payload").textContent.toLowerCase();
                    const proxyText = row.querySelector(".jc-col-proxy").textContent.toLowerCase();

                    if (typeText.includes(query) || payloadText.includes(query) || proxyText.includes(query)) {
                        row.style.display = "";
                    } else {
                        row.style.display = "none";
                    }
                });
            }
        });

        const lastFetchLabel = E("span", { class: "jc-log-fetch-label" });
        const updateLastFetchTime = () => {
            const now = new Date();
            lastFetchLabel.textContent = _("Last updated: ") + now.toLocaleString();
        };

        const refreshBtn = E("button", {
            type: "button",
            class: "cbi-button cbi-button-action",
            click: async function () {
                refreshBtn.disabled = true;
                try {
                    const rulesData = await mihomoApi.fetchRules(token);
                    const rulesList = rulesData?.rules || [];
                    renderRulesList(rulesList);
                    searchInput.value = "";
                    updateLastFetchTime();
                } catch (e) {
                    ui.addTimeLimitedNotification(_("Error"), E("p", `${e.message || e}`), common.notificationTimeout, "danger");
                } finally {
                    refreshBtn.disabled = false;
                }
            }
        }, _("Refresh"));

        const actionWrap = E("div", { class: "jc-actions-wrap" }, [
            E("div", { class: "cbi-section-actions jc-primary-actions" }, [
                searchInput,
                refreshBtn,
                lastFetchLabel
            ])
        ]);

        updateLastFetchTime();

        const grid = E("div", { class: "jc-grid-container" }, [
            E("div", { class: "jc-grid-header" }, [
                E("div", { class: "jc-grid-col" }, _("Active")),
                E("div", { class: "jc-grid-col" }, _("Type")),
                E("div", { class: "jc-grid-col" }, _("Payload")),
                E("div", { class: "jc-grid-col" }, _("Proxy / Group"))
            ])
        ]);

        const renderRulesList = (rulesList) => {
            const rows = grid.querySelectorAll(".jc-rule-row");
            rows.forEach(row => row.remove());

            if (rulesList.length === 0) {
                return;
            }

            rulesList.forEach((rule, index) => {
                const row = E("div", {
                    class: "jc-grid-row jc-rule-row" + (rule.disabled ? " jc-disabled-rule" : "")
                });

                const typeCol = E("div", { class: "jc-grid-col jc-col-type", "data-label": _("Type") }, [
                    E("span", { class: "jc-badge-type " + getRuleTypeClass(rule.type) }, (rule.type || "").toUpperCase())
                ]);
                const payloadCol = E("div", { class: "jc-grid-col jc-col-payload jc-payload-cell", "data-label": _("Payload") }, rule.payload || "");
                const proxyCol = E("div", { class: "jc-grid-col jc-col-proxy", "data-label": _("Proxy / Group") }, [
                    E("span", { class: "jc-badge-builtin" }, rule.proxy || "")
                ]);

                const toggleInput = E("input", {
                    type: "checkbox",
                    checked: !rule.disabled,
                    change: async function (ev) {
                        const checked = ev.target.checked;
                        const isDisabled = !checked;
                        toggleInput.disabled = true;

                        try {
                            const payload = {};
                            payload[index] = isDisabled;
                            await mihomoApi.disableRule(payload, token);

                            if (isDisabled) {
                                row.classList.add("jc-disabled-rule");
                            } else {
                                row.classList.remove("jc-disabled-rule");
                            }
                        } catch (e) {
                            toggleInput.checked = !checked;
                            ui.addTimeLimitedNotification(_("Error"), E("p", `${e.message || e}`), common.notificationTimeout, "danger");
                        } finally {
                            toggleInput.disabled = false;
                        }
                    }
                });

                const actionCol = E("div", { class: "jc-grid-col jc-col-action", "data-label": _("Active") }, toggleInput);

                row.appendChild(actionCol);
                row.appendChild(typeCol);
                row.appendChild(payloadCol);
                row.appendChild(proxyCol);

                grid.appendChild(row);
            });
        };

        renderRulesList(result.rules);

        const style = E("style", {}, `
            .jc-actions-wrap{padding:.7em .8em;border:1px solid var(--border-color-medium, #d9d9d9);border-radius:0.375rem;background:var(--background-color-medium, #f6f6f6);margin-bottom:1rem;}
            .jc-primary-actions{display:flex;flex-wrap:wrap;align-items:center;gap:.65em;margin:0;width:100%;}
            .jc-primary-actions .cbi-button{margin:0 !important;}
            .jc-log-fetch-label{color:#999;font-size:.9em;margin-left:0.5rem;}
            [data-theme="dark"] .jc-actions-wrap{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.04);}
            .jc-grid-container{display:flex;flex-direction:column;border:1px solid var(--border-color-medium, #d9d9d9);border-radius:0.5rem;overflow:hidden;background-color:var(--background-color-low, #fff);margin-bottom:1rem;font-size:0.87em;}
            [data-theme="dark"] .jc-grid-container{background-color:rgba(0,0,0,.1);}
            .jc-grid-header{display:grid;grid-template-columns:5rem 7.5rem minmax(0, 1fr) 10rem;gap:0.75rem;padding:0.25rem 0.9375rem;background-color:var(--background-color-medium, #f6f6f6);border-bottom:1px solid var(--border-color-medium, #d9d9d9);font-weight:bold;color:var(--text-color-high, inherit);}
            .jc-grid-row{display:grid;grid-template-columns:5rem 7.5rem minmax(0, 1fr) 10rem;gap:0.75rem;padding:0.1875rem 0.9375rem;align-items:center;border-bottom:1px solid transparent;transition:background-color .15s ease,opacity .15s ease;color:var(--text-color, inherit);min-height:1.6875rem;box-sizing:border-box;}
            .jc-grid-row:last-child{border-bottom:none;}
            .jc-grid-row:nth-child(odd){background:var(--background-color-medium, #fafafa);}
            .jc-grid-row:hover{background-color:rgba(180,180,180,.2);}
            [data-theme="dark"] .jc-grid-row:hover{background-color:rgba(100,100,100,.2);}
            .jc-grid-row.jc-disabled-rule{opacity:.55;background-color:var(--background-color-medium, rgba(0,0,0,.01));}
            [data-theme="dark"] .jc-grid-row.jc-disabled-rule{background-color:rgba(0,0,0,.2);}
            .jc-grid-col{min-width:0;display:flex;align-items:center;}
            .jc-payload-cell{font-family:'Menlo','Consolas','Monaco',monospace;word-break:break-all;color:var(--text-color, inherit);opacity:.9;}
            .jc-badge-type{display:inline-block;padding:0.15rem 0.45rem;border-radius:0.25rem;font-size:0.8em;font-weight:bold;text-transform:uppercase;line-height:1.2;min-width:4.7rem;text-align:center;box-sizing:border-box;}
            .jc-badge-type.domain{background-color:rgba(16,96,255,.1);color:var(--primary-color-medium, #1060FF);border:1px solid rgba(16,96,255,.2);}
            .jc-badge-type.ipcidr{background-color:rgba(40,167,69,.1);color:var(--success-color-medium, #28a745);border:1px solid rgba(40,167,69,.2);}
            .jc-badge-type.classical{background-color:rgba(253,126,20,.1);color:#fd7e14;border:1px solid rgba(253,126,20,.2);}
            .jc-badge-builtin{display:inline-block;padding:0.15rem 0.45rem;border-radius:0.25rem;font-size:0.8em;background-color:var(--background-color-medium, #f6f6f6);color:var(--text-color-medium, #888);border:1px solid var(--border-color-medium, #d9d9d9);font-weight:500;line-height:1.2;box-sizing:border-box;}
            .jc-col-action input[type="checkbox"]{cursor:pointer;width:1rem;height:1rem;}
            @media (max-width:48rem){
                .jc-grid-header{display:none;}
                .jc-grid-container{font-size:1em;}
                .jc-grid-row{grid-template-columns:1fr;gap:0.3rem;padding:0.5rem 0.75rem;border-bottom:1px solid var(--border-color-medium, #d9d9d9);}
                .jc-grid-row:last-child{border-bottom:none;}
                .jc-grid-col{display:flex;flex-direction:column;align-items:flex-start;width:100%;}
                .jc-grid-col::before{content:attr(data-label);font-size:0.8em;font-weight:bold;color:var(--text-color-medium, #888);margin-bottom:0.1rem;text-transform:uppercase;}
                .jc-grid-col.jc-col-action{align-items:flex-end;margin-top:0.15rem;}
                .jc-grid-col.jc-col-action::before{display:none;}
            }
        `);

        const container = E("div", { class: "cbi-section fade-in" }, [
            style,
            E("h3", { class: "cbi-section-title" }, _("Rules")),
            E("div", { class: "cbi-section-descr" }, _("Mihomo rules list and routing information. Rules can be temporarily disabled (resets on service restart).")),
            actionWrap,
            E("div", { class: "cbi-section-node" }, [
                grid
            ])
        ]);

        return container;
    }
});
