"use strict";
"require view";
"require ui";
"require uci";
"require view.justclash.helper_common as common";
"require view.justclash.helper_mihomo_api as mihomoApi";

const GROUP_TYPES_WITH_RESET = new Set(["urltest", "fallback", "loadbalance", "load-balance"]);

const lower = (value) => String(value || "").toLowerCase();
const isAutoGroup = (type) => GROUP_TYPES_WITH_RESET.has(lower(type));

const unique = (arr) => {
    const seen = new Set();
    return (arr || []).filter((item) => {
        if (!item || seen.has(item))
            return false;
        seen.add(item);
        return true;
    });
};

const normalizeNodesState = (response) => {
    const proxies = response && typeof response.proxies === "object" ? response.proxies : {};
    const groups = [];

    for (const [name, item] of Object.entries(proxies)) {
        if (!item || !Array.isArray(item.all) || item.all.length === 0)
            continue;

        const options = unique(item.all);
        const current = item.now || item.current || options[0] || "";
        if (current && !options.includes(current))
            options.unshift(current);

        groups.push({
            name,
            type: item.type || "",
            current,
            options
        });
    }

    const globalGroup = groups.find((group) => group.name === "GLOBAL");
    const globalOrder = new Map((globalGroup?.options || []).map((name, index) => [name, index]));

    groups.sort((a, b) => {
        if (a.name === "GLOBAL") return -1;
        if (b.name === "GLOBAL") return 1;

        const aOrder = globalOrder.has(a.name) ? globalOrder.get(a.name) : Number.MAX_SAFE_INTEGER;
        const bOrder = globalOrder.has(b.name) ? globalOrder.get(b.name) : Number.MAX_SAFE_INTEGER;

        if (aOrder !== bOrder)
            return aOrder - bOrder;

        return a.name.localeCompare(b.name);
    });

    return {
        proxyMap: proxies,
        groups
    };
};

const normalizeProvidersState = (response) => {
    const providers = response && typeof response.providers === "object" ? response.providers : {};

    return Object.values(providers)
        .filter((provider) => {
            return provider &&
                provider.name &&
                lower(provider.vehicleType || provider.type) !== "compatible" &&
                Array.isArray(provider.proxies);
        })
        .map((provider) => ({
            name: provider.name,
            vehicleType: provider.vehicleType || provider.type || "",
            updatedAt: provider.updatedAt || "",
            proxies: Array.isArray(provider.proxies)
                ? provider.proxies.filter((proxy) => lower(proxy?.type) !== "compatible")
                : []
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
};

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
            const [proxies, configs, proxyProviders] = await Promise.all([
                mihomoApi.fetchProxies(token),
                mihomoApi.fetchConfigs(token),
                mihomoApi.fetchProxyProviders(token)
            ]);
            const nodesState = normalizeNodesState(proxies);

            return {
                token,
                mode: configs?.mode || "rule",
                nodesState,
                providersState: normalizeProvidersState(proxyProviders),
                configLoadFailed,
                fetchFailed: false
            };
        } catch (e) {
            console.error("Failed to load Mihomo proxy groups", e);
            ui.addNotification(
                _("Error"),
                E("p", _("Failed to load Mihomo proxy groups") + ": " + (e.message || String(e))),
                "danger"
            );
            return {
                token,
                mode: "rule",
                nodesState: normalizeNodesState(null),
                providersState: normalizeProvidersState(null),
                configLoadFailed,
                fetchFailed: true,
                fetchError: e.message || String(e)
            };
        }
    },

    render: function (result) {
        const DELAY_TEST_CONCURRENCY = 3;
        const NON_TESTABLE_PROXY_TYPES = new Set(["reject", "rejectdrop", "pass", "compatible"]);

        const container = E("div", { class: "cbi-section fade-in" });
        const modeWrap = E("div", { class: "jc-actions-wrap" });
        const content = E("div", { class: "jc-nodes-layout" });
        const groupSections = new Map();
        const providerSections = new Map();

        const state = {
            token: result.token || "",
            mode: result.mode || "rule",
            loading: false,
            modeLoading: false,
            pendingKey: "",
            delayLoadingGroup: "",
            delayLoadingProvider: "",
            groupDelays: Object.create(null),
            providerDelays: Object.create(null),
            nodesState: result.nodesState,
            providersState: result.providersState || []
        };

        const getProxyType = (proxyName) => {
            const proxy = state.nodesState.proxyMap[proxyName];
            return String(proxy?.type || _("Unknown")).toUpperCase();
        };
        const getProxyEntry = (proxyName) => state.nodesState.proxyMap[proxyName] || null;
        const canTestProxyDelay = (proxyName) => {
            const proxy = getProxyEntry(proxyName);
            const proxyType = lower(proxy?.type);

            if (!proxy)
                return false;
            if (Array.isArray(proxy.all) && proxy.all.length > 0)
                return false;

            return !NON_TESTABLE_PROXY_TYPES.has(proxyType);
        };

        const getDelayText = (delayMap, optionName) => {
            const delay = delayMap ? delayMap[optionName] : null;

            if (typeof delay === "number" && Number.isFinite(delay) && delay >= 0)
                return {
                    text: `${delay} ms`,
                    className: "jc-option-meta-delay"
                };

            if (delay === "timeout")
                return {
                    text: _("Timeout"),
                    className: "jc-option-meta-timeout"
                };

            return null;
        };

        const createOptionCard = (group, optionName, proxyType, isActive, onClick, extraMeta, pendingKey) => {
            const isPending = state.pendingKey === pendingKey;
            const delayInfo = getDelayText(state.groupDelays[group.name], optionName);
            const metaText = extraMeta || delayInfo?.text;
            const metaClass = extraMeta ? "jc-option-meta jc-option-meta-current" : `jc-option-meta${delayInfo?.className ? ` ${delayInfo.className}` : ""}`;

            const card = E("button", {
                type: "button",
                class: `jc-card jc-option-card${isActive ? " jc-option-card-active" : ""}`,
                title: optionName,
                click: onClick
            }, [
                E("div", { class: "jc-option-card-top" }, [
                    E("span", { class: "jc-option-name" }, optionName)
                ]),
                E("div", { class: "jc-option-card-bottom" }, [
                    E("div", { class: "jc-option-type" }, isPending ? _("Applying...") : proxyType),
                    metaText ? E("div", { class: metaClass }, metaText) : ""
                ])
            ]);

            card.disabled = !!state.loading || state.delayLoadingGroup === group.name || !!state.delayLoadingProvider;
            return card;
        };

        const runProxyDelayTests = async (candidates, delayMap) => {
            let nextIndex = 0;

            const runWorker = async () => {
                while (nextIndex < candidates.length) {
                    const optionName = candidates[nextIndex++];

                    try {
                        const result = await mihomoApi.fetchProxyDelay(optionName, state.token, mihomoApi.fetchTimeout, {
                            url: common.defaultHealthCheckUrls[0],
                            timeout: String(mihomoApi.fetchTimeout)
                        });

                        if (typeof result?.delay === "number" && Number.isFinite(result.delay) && result.delay >= 0)
                            delayMap[optionName] = result.delay;
                        else
                            delayMap[optionName] = "timeout";
                    } catch (e) {
                        delayMap[optionName] = "timeout";
                    }
                }
            };

            await Promise.all(Array.from({
                length: Math.min(DELAY_TEST_CONCURRENCY, candidates.length || 1)
            }, () => runWorker()));
        };

        const handleGroupDelay = async (group) => {
            if (state.loading || state.delayLoadingGroup || state.delayLoadingProvider)
                return;

            state.delayLoadingGroup = group.name;
            state.groupDelays[group.name] = Object.create(null);
            syncModeSelect();
            rerenderGroupSection(group.name);

            try {
                await runProxyDelayTests(group.options.filter(canTestProxyDelay), state.groupDelays[group.name]);
            } finally {
                state.delayLoadingGroup = "";
                syncModeSelect();
                rerenderGroupSection(group.name);
            }
        };

        const handleProviderDelay = async (provider) => {
            if (state.loading || state.delayLoadingGroup || state.delayLoadingProvider)
                return;

            state.delayLoadingProvider = provider.name;
            state.providerDelays[provider.name] = Object.create(null);
            syncModeSelect();
            rerenderProviderSection(provider.name);

            try {
                const candidates = (provider.proxies || [])
                    .map((proxy) => proxy?.name)
                    .filter(canTestProxyDelay);

                await runProxyDelayTests(candidates, state.providerDelays[provider.name]);
            } finally {
                state.delayLoadingProvider = "";
                syncModeSelect();
                rerenderProviderSection(provider.name);
            }
        };

        const createGroupSection = (group) => {
            const cards = [];
            const isDelayLoading = state.delayLoadingGroup === group.name;
            const delayButton = E("button", {
                type: "button",
                class: "cbi-button cbi-button-neutral jc-group-delay-button",
                title: _("Test delay"),
                "aria-label": _("Test delay"),
                click: async (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    await handleGroupDelay(group);
                }
            }, isDelayLoading ? _("Testing...") : _("Test delay"));

            delayButton.disabled = !!state.loading || !!state.delayLoadingGroup;

            if (isAutoGroup(group.type)) {
                cards.push(createOptionCard(
                    group,
                    _("Auto"),
                    group.type || _("Unknown"),
                    false,
                    async () => {
                        await handleSelection(group, "", true);
                    },
                    group.current || null,
                    `${group.name}::auto`
                ));
            }

            group.options.forEach((optionName) => {
                cards.push(createOptionCard(
                    group,
                    optionName,
                    getProxyType(optionName),
                    optionName === group.current,
                    async () => {
                        await handleSelection(group, optionName, false);
                    },
                    null,
                    `${group.name}::${optionName}`
                ));
            });

            return E("section", { class: "jc-group-section" }, [
                E("div", { class: "jc-group-header" }, [
                    E("h4", { class: "jc-group-title" }, group.name === "GLOBAL" ? _("Global") : group.name),
                    E("div", { class: "jc-group-header-actions" }, [
                        E("div", { class: "jc-group-badges" }, [
                            E("span", { class: "jc-group-badge" }, group.type || _("Unknown")),
                            group.current ? E("span", { class: "jc-group-badge jc-group-badge-current" }, group.current) : ""
                        ]),
                        delayButton
                    ])
                ]),
                E("div", { class: "jc-option-grid" }, cards)
            ]);
        };

        const formatProviderUpdatedAt = (value) => {
            if (!value)
                return "";

            try {
                return new Date(value).toLocaleString();
            } catch (e) {
                return String(value);
            }
        };

        const createProviderCard = (provider, proxy) => {
            const delayInfo = getDelayText(state.providerDelays[provider.name], proxy.name);
            let metaText = "";
            let metaClass = "jc-option-meta";

            if (delayInfo?.text) {
                metaText = delayInfo.text;
                metaClass = `jc-option-meta ${delayInfo.className}`;
            } else if (proxy.alive === false) {
                metaText = _("Timeout");
                metaClass = "jc-option-meta jc-option-meta-timeout";
            }

            return E("div", { class: "jc-card jc-option-card jc-provider-card" }, [
                E("div", { class: "jc-option-card-top" }, [
                    E("span", { class: "jc-option-name" }, proxy.name || _("Unknown"))
                ]),
                E("div", { class: "jc-option-card-bottom" }, [
                    E("div", { class: "jc-option-type" }, String(proxy.type || _("Unknown")).toUpperCase()),
                    metaText ? E("div", { class: metaClass }, metaText) : ""
                ])
            ]);
        };

        const createProviderSection = (provider) => {
            const updatedText = formatProviderUpdatedAt(provider.updatedAt);
            const isDelayLoading = state.delayLoadingProvider === provider.name;
            const delayButton = E("button", {
                type: "button",
                class: "cbi-button cbi-button-neutral jc-group-delay-button",
                title: _("Test delay"),
                "aria-label": _("Test delay"),
                click: async (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    await handleProviderDelay(provider);
                }
            }, isDelayLoading ? _("Testing...") : _("Test delay"));

            delayButton.disabled = !!state.loading || !!state.delayLoadingGroup || !!state.delayLoadingProvider;

            return E("section", { class: "jc-group-section jc-provider-section" }, [
                E("div", { class: "jc-group-header" }, [
                    E("h4", { class: "jc-group-title" }, provider.name),
                    E("div", { class: "jc-group-header-actions" }, [
                        E("div", { class: "jc-group-badges" }, [
                            provider.vehicleType ? E("span", { class: "jc-group-badge" }, provider.vehicleType) : "",
                            E("span", { class: "jc-group-badge" }, String((provider.proxies || []).length)),
                            updatedText ? E("span", { class: "jc-group-badge" }, updatedText) : ""
                        ]),
                        delayButton
                    ])
                ]),
                E("div", { class: "jc-option-grid" }, (provider.proxies || []).map((proxy) => createProviderCard(provider, proxy)))
            ]);
        };

        const mountGroupSection = (group) => {
            const section = createGroupSection(group);
            groupSections.set(group.name, section);
            return section;
        };

        const mountProviderSection = (provider) => {
            const section = createProviderSection(provider);
            providerSections.set(provider.name, section);
            return section;
        };

        const rerenderGroupSection = (groupName) => {
            const oldNode = groupSections.get(groupName);
            const group = state.nodesState.groups.find((entry) => entry.name === groupName);

            if (!oldNode || !oldNode.parentNode || !group) {
                renderNodes();
                return;
            }

            const nextNode = createGroupSection(group);
            oldNode.replaceWith(nextNode);
            groupSections.set(groupName, nextNode);
        };

        const rerenderProviderSection = (providerName) => {
            const oldNode = providerSections.get(providerName);
            const provider = state.providersState.find((entry) => entry.name === providerName);

            if (!oldNode || !oldNode.parentNode || !provider) {
                renderNodes();
                return;
            }

            const nextNode = createProviderSection(provider);
            oldNode.replaceWith(nextNode);
            providerSections.set(providerName, nextNode);
        };

        const renderNodes = () => {
            content.replaceChildren();
            groupSections.clear();
            providerSections.clear();

            if (result.configLoadFailed) {
                content.appendChild(E("div", { class: "jc-card jc-empty-card" }, [
                    E("div", { class: "jc-card-header" }, _("Nodes")),
                    E("div", { class: "jc-empty-text" }, _("Failed to load configuration"))
                ]));
                return;
            }

            if (state.nodesState.groups.length === 0 && !state.providersState.length) {
                content.appendChild(E("div", { class: "jc-card jc-empty-card" }, [
                    E("div", { class: "jc-card-header" }, _("Nodes")),
                    E("div", { class: "jc-empty-text" }, _("No selectable proxy groups or providers were found"))
                ]));
                return;
            }

            const globalGroup = state.nodesState.groups.find((group) => group.name === "GLOBAL");
            const otherGroups = state.nodesState.groups.filter((group) => group.name !== "GLOBAL");

            if (globalGroup)
                content.appendChild(mountGroupSection(globalGroup));

            otherGroups.forEach((group) => {
                content.appendChild(mountGroupSection(group));
            });

            state.providersState.forEach((provider) => {
                content.appendChild(mountProviderSection(provider));
            });
        };

        const fetchNodesState = async () => {
            const [proxies, configs, proxyProviders] = await Promise.all([
                mihomoApi.fetchProxies(state.token),
                mihomoApi.fetchConfigs(state.token),
                mihomoApi.fetchProxyProviders(state.token)
            ]);
            const nodesState = normalizeNodesState(proxies);

            state.nodesState = nodesState;
            state.providersState = normalizeProvidersState(proxyProviders);
            state.mode = configs?.mode || state.mode || "rule";
            result.fetchFailed = false;
            result.fetchError = "";
        };

        const modeLabel = E("span", { class: "jc-mode-label" }, _("Mode"));
        const modeDropdown = new ui.Dropdown(lower(state.mode) || "rule", {
            "rule": _("Rule"),
            "global": _("Global"),
            "direct": _("Direct")
        }, {
            sort: false,
            optional: false
        });
        const modeDropdownNode = modeDropdown.render();
        modeDropdownNode.classList.add("jc-mode-select");

        const syncModeSelect = () => {
            modeDropdown.setValue(lower(state.mode) || "rule");
            if (!!state.loading || !!state.modeLoading || !!state.delayLoadingGroup || !!state.delayLoadingProvider) {
                modeDropdownNode.setAttribute("disabled", "disabled");
            } else {
                modeDropdownNode.removeAttribute("disabled");
            }
        };

        const handleModeChange = async (ev) => {
            const nextMode = modeDropdown.getValue();
            const previousMode = state.mode;

            if (!nextMode || nextMode === previousMode)
                return;

            state.modeLoading = true;
            syncModeSelect();

            try {
                await mihomoApi.patchConfigs({ mode: nextMode }, state.token);
                state.mode = nextMode;
                await fetchNodesState();
            } catch (e) {
                state.mode = previousMode;
                console.error(`Failed to switch Mihomo mode to ${nextMode}`, e);
            } finally {
                state.modeLoading = false;
                syncModeSelect();
            }
        };

        modeDropdownNode.addEventListener("cbi-dropdown-change", handleModeChange);

        const handleSelection = async (group, optionName, useAutoReset) => {
            const pendingKey = `${group.name}::${useAutoReset ? "auto" : optionName}`;
            if (state.loading)
                return;

            state.pendingKey = pendingKey;
            state.loading = true;
            syncModeSelect();
            renderNodes();

            try {
                if (useAutoReset) {
                    await mihomoApi.resetGroupSelection(group.name, state.token);
                } else {
                    await mihomoApi.updateProxySelection(group.name, optionName, state.token);
                }

                await fetchNodesState();
            } catch (e) {
                console.error(`Failed to update selector ${group.name}`, e);
            } finally {
                state.pendingKey = "";
                state.loading = false;
                syncModeSelect();
                renderNodes();
            }
        };

        modeWrap.appendChild(E("div", { class: "cbi-section-actions jc-primary-actions" }, [
            E("span", { class: "jc-mode-wrap" }, [
                modeLabel,
                modeDropdownNode
            ])
        ]));

        syncModeSelect();
        renderNodes();

        const style = E("style", {}, `
            .jc-actions-wrap,.jc-card-header{border:1px solid var(--border-color-medium, #d9d9d9);background:var(--background-color-medium, #f6f6f6);}
            .jc-actions-wrap{margin-bottom:1rem;padding:.7em .8em;border-radius:0.375rem;}
            .jc-primary-actions,.jc-group-header,.jc-group-header-actions,.jc-group-badges{display:flex;flex-wrap:wrap;align-items:center;}
            .jc-primary-actions{gap:.65em;margin:0;}
            .jc-mode-wrap,.jc-card-header{display:inline-flex;align-items:center;}
            .jc-mode-wrap{flex-wrap:wrap;gap:.55em;}
            .jc-mode-label,.jc-group-title,.jc-group-badge-current,.jc-option-name,.jc-option-meta-delay,.jc-option-meta-timeout{font-weight:600;}
            .jc-mode-select{min-width:8.125rem;margin:0;}
            .jc-nodes-layout,.jc-group-section,.jc-card{display:flex;flex-direction:column;}
            .jc-nodes-layout{gap:1.125rem;}
            .jc-group-section{gap:0.625rem;}
            .jc-group-header{justify-content:space-between;gap:0.625rem;}
            .jc-group-title{margin:0;font-size:1.05rem;}
            .jc-provider-section .jc-group-title{font-weight:500;}
            .jc-group-header-actions{justify-content:flex-end;gap:0.5rem;}
            .jc-group-badges{gap:0.25rem;}
            .jc-group-badge{display:inline-flex;align-items:center;padding:0.1rem 0.55rem;border-radius:9999px;font-size:0.8em;line-height:1.25;font-family:inherit;box-sizing:border-box;color:var(--primary-color-medium, #4f8cff);border:1px solid rgba(79,140,255,0.25);background:rgba(79,140,255,0.1);font-weight:600;}
            .jc-group-badge-current{color:var(--warning-color-medium, #fd7e14);border-color:rgba(253,126,20,0.25);background:rgba(253,126,20,0.1);font-weight:600;}
            .jc-option-meta-current{color:var(--warning-color-medium, #fd7e14);font-weight:600;}
            button.cbi-button.jc-group-delay-button{display:inline-flex;align-items:center;font:inherit;font-family:inherit;font-size:0.88em;font-weight:500;line-height:1.2;margin:0;min-width:0;min-height:0;height:auto;padding:0.18rem 0.5rem;border-radius:0.25rem;box-sizing:border-box;color:var(--success-color-medium, #2f9e44);border:1px solid rgba(47, 158, 68, 0.3);background:rgba(47, 158, 68, 0.05);appearance:none;-webkit-appearance:none;transition:border-color .18s ease, background-color .18s ease, transform .18s ease;}
            button.cbi-button.jc-group-delay-button:hover:not(:disabled),button.cbi-button.jc-group-delay-button:focus-visible:not(:disabled){border-color:var(--success-color-medium, #2f9e44);background:rgba(47, 158, 68, 0.12);transform:translateY(-0.0625rem);}
            button.cbi-button.jc-group-delay-button:disabled,.jc-option-card:disabled{opacity:.7;transform:none;}
            .jc-option-card:hover:not(:disabled),.jc-option-card:focus-visible:not(:disabled){border-color:var(--primary-color-medium, #4f8cff);background:rgba(79, 140, 255, .06);transform:translateY(-0.0625rem);}
            .jc-option-grid{display:grid;grid-template-columns:repeat(auto-fill, minmax(10.3125rem, 1fr));gap:0.75rem;}
            .jc-card{padding:.75em;border:1px solid var(--border-color-medium, #d9d9d9);border-radius:0.25rem;box-sizing:border-box;}
            .jc-card-header{align-self:flex-start;margin-bottom:.7em;padding:.2em .45em;border-radius:0.375rem;}
            .jc-provider-card{cursor:default;background:rgba(240, 140, 0, .08);transform:none;border:1px solid rgba(240, 140, 0, .35);transition:none;}
            .jc-option-card{width:100%;align-items:flex-start;gap:.35em;text-align:left;cursor:pointer;background:transparent;color:inherit;font:inherit;transition:border-color .18s ease, background-color .18s ease, transform .18s ease;}
            .jc-option-card:disabled{cursor:default;}
            .jc-option-card-active{border-color:var(--primary-color-medium, #4f8cff);background:rgba(79, 140, 255, .08);}
            .jc-option-card-top,.jc-option-card-bottom{width:100%;display:flex;align-items:flex-start;justify-content:space-between;}
            .jc-option-card-top{gap:0.5rem;}
            .jc-option-card-bottom{gap:0.75rem;}
            .jc-option-name{white-space:normal;overflow-wrap:anywhere;}
            .jc-option-type,.jc-option-meta{min-width:0;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
            .jc-option-type{flex:1 1 auto;font-size:.9em;color:var(--text-color-medium, #888);}
            .jc-option-meta{flex:0 1 auto;text-align:right;font-size:.82em;color:var(--text-color-medium, #888);}
            .jc-option-meta-delay{color:var(--success-color-medium, #2f9e44);}
            .jc-option-meta-timeout{color:var(--error-color-medium, #f44336);}
            .jc-empty-card{min-height:11.25rem;}
            .jc-empty-text{margin:0;color:var(--text-color-medium, #888);white-space:normal;}
            [data-theme="dark"] .jc-card-header,[data-theme="dark"] .jc-actions-wrap{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.04);}
            [data-theme="dark"] .jc-group-badge{color:#66a1ff;border-color:rgba(102,161,255,0.3);background:rgba(79,140,255,0.16);}
            [data-theme="dark"] .jc-group-badge-current{color:var(--warning-color-medium, #fd7e14);border-color:rgba(253,126,20,0.3);background:rgba(253,126,20,0.14);}
            [data-theme="dark"] .jc-option-card:hover:not(:disabled),[data-theme="dark"] .jc-option-card:focus-visible:not(:disabled){background:rgba(79, 140, 255, .12);}
            [data-theme="dark"] .jc-option-card-active{background:rgba(79, 140, 255, .14);}
            @media (max-width:43.75rem){.jc-group-header{align-items:flex-start;}.jc-option-grid{grid-template-columns:1fr 1fr;}}
            @media (max-width:32.5rem){.jc-option-grid{grid-template-columns:1fr;}}
        `);

        container.appendChild(E("h3", { class: "cbi-section-title" }, _("Nodes")));
        container.appendChild(E("div", { class: "cbi-section-descr" }, _("View and select proxy nodes. You can also test latency for individual nodes or groups.")));
        container.appendChild(modeWrap);
        container.appendChild(content);
        container.appendChild(style);

        return container;
    }
});