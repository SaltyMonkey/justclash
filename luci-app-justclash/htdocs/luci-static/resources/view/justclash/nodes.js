"use strict";
"require view";
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
            await uci.load("justclash");
            token = uci.get("justclash", "proxy", "api_password") || "";
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
            const metaClass = extraMeta ? "jc-option-meta" : `jc-option-meta${delayInfo?.className ? ` ${delayInfo.className}` : ""}`;

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
                    group.current ? `${_("Current")}: ${group.current}` : null,
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
                            group.current ? E("span", { class: "jc-group-badge jc-group-badge-current" }, `${_("Current")}: ${group.current}`) : ""
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
                const emptyText = result.fetchFailed
                    ? `${_("Failed to load proxy groups")}: ${result.fetchError || _("Error")}`
                    : _("No selectable proxy groups or providers were found");

                content.appendChild(E("div", { class: "jc-card jc-empty-card" }, [
                    E("div", { class: "jc-card-header" }, _("Nodes")),
                    E("div", { class: "jc-empty-text" }, emptyText)
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
        const modeSelect = E("select", { class: "cbi-input-select jc-mode-select" }, [
            E("option", { value: "rule" }, _("Rule")),
            E("option", { value: "global" }, _("Global")),
            E("option", { value: "direct" }, _("Direct"))
        ]);
        modeSelect.value = state.mode;

        const syncModeSelect = () => {
            modeSelect.value = state.mode;
            modeSelect.disabled = !!state.loading || !!state.modeLoading || !!state.delayLoadingGroup || !!state.delayLoadingProvider;
        };

        const handleModeChange = async (ev) => {
            const nextMode = String(ev.target.value || "");
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

        modeSelect.addEventListener("change", handleModeChange);

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
                const groupExists = state.nodesState.groups.some((entry) => entry.name === group.name);
                state.pendingKey = "";
                state.loading = false;
                syncModeSelect();

                if (groupExists)
                    rerenderGroupSection(group.name);
                else
                    renderNodes();
            }
        };

        modeWrap.appendChild(E("div", { class: "cbi-section-actions jc-primary-actions" }, [
            E("span", { class: "jc-mode-wrap" }, [
                modeLabel,
                modeSelect
            ])
        ]));

        syncModeSelect();
        renderNodes();

        const style = E("style", {}, `
            .jc-actions-wrap,.jc-card-header,.jc-group-badge,.jc-group-delay-button{border:1px solid var(--border-color-medium, #d9d9d9);background:var(--background-color-medium, #f6f6f6);}
            .jc-actions-wrap{margin-bottom:16px;padding:.7em .8em;border-radius:6px;}
            .jc-primary-actions,.jc-group-header,.jc-group-header-actions,.jc-group-badges{display:flex;flex-wrap:wrap;align-items:center;}
            .jc-primary-actions{gap:.65em;margin:0;}
            .jc-primary-actions .cbi-button{margin:0 !important;}
            .jc-mode-wrap,.jc-card-header,.jc-group-badge,.jc-group-delay-button,.jc-option-current-badge{display:inline-flex;align-items:center;}
            .jc-mode-wrap{flex-wrap:wrap;gap:.55em;}
            .jc-mode-label,.jc-group-title,.jc-group-badge-current,.jc-option-name,.jc-option-current-badge,.jc-option-meta-delay,.jc-option-meta-timeout{font-weight:600;}
            .jc-mode-select{min-width:130px;margin:0 !important;}
            .jc-nodes-layout,.jc-group-section,.jc-card{display:flex;flex-direction:column;}
            .jc-nodes-layout{gap:18px;}
            .jc-group-section{gap:10px;}
            .jc-group-header{justify-content:space-between;gap:10px;}
            .jc-group-title{margin:0;font-size:1.05rem;}
            .jc-provider-section .jc-group-title{font-weight:500;opacity:.82;}
            .jc-group-header-actions{justify-content:flex-end;gap:8px;}
            .jc-group-badges{gap:8px;}
            .jc-group-badge,.jc-group-delay-button{padding:.2em .55em;border-radius:999px;font-size:.88em;line-height:1.2;opacity:.88;}
            .jc-group-delay-button{margin:0 !important;min-width:0;color:var(--text-color, inherit);font-weight:500;transition:border-color .18s ease, background-color .18s ease, transform .18s ease;}
            .jc-group-delay-button:hover:not(:disabled),.jc-group-delay-button:focus-visible:not(:disabled),.jc-option-card:hover:not(:disabled),.jc-option-card:focus-visible:not(:disabled){border-color:var(--primary-color-medium, #4f8cff);background:rgba(79, 140, 255, .06);transform:translateY(-1px);}
            .jc-group-delay-button:disabled,.jc-option-card:disabled{opacity:.7;transform:none;}
            .jc-option-grid{display:grid;grid-template-columns:repeat(auto-fill, minmax(165px, 1fr));gap:12px;}
            .jc-card{padding:.75em;border:1px solid var(--border-color-medium, #bfbfbf);border-radius:4px;box-sizing:border-box;color:var(--text-color, inherit);}
            .jc-card-header{align-self:flex-start;margin-bottom:.7em;padding:.2em .45em;border-radius:6px;font-size:.96em;color:var(--text-color, inherit);opacity:.88;}
            .jc-provider-card{cursor:default;background:rgba(240, 140, 0, .08);transform:none !important;border:1px solid rgba(240, 140, 0, .35) !important;transition:none !important;}
            .jc-option-card{width:100%;align-items:flex-start;gap:.35em;text-align:left;cursor:pointer;background:transparent;color:inherit;font:inherit;transition:border-color .18s ease, background-color .18s ease, transform .18s ease;}
            .jc-option-card:disabled{cursor:default;}
            .jc-option-card-active{border-color:var(--primary-color-medium, #4f8cff);background:rgba(79, 140, 255, .08);}
            .jc-option-card-top,.jc-option-card-bottom{width:100%;display:flex;align-items:flex-start;justify-content:space-between;}
            .jc-option-card-top{gap:8px;}
            .jc-option-card-bottom{gap:12px;}
            .jc-option-name{white-space:normal;overflow-wrap:anywhere;}
            .jc-option-current-badge{flex:0 0 auto;padding:.15em .45em;border-radius:999px;background:rgba(79, 140, 255, .14);color:var(--primary-color-medium, #356fd9);font-size:.78em;}
            .jc-option-type,.jc-option-meta{min-width:0;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
            .jc-option-type{flex:1 1 auto;font-size:.9em;opacity:.8;}
            .jc-option-meta{flex:0 1 auto;text-align:right;font-size:.82em;opacity:.72;}
            .jc-option-meta-delay{color:var(--success-color-medium, #2f9e44);}
            .jc-option-meta-timeout{color:var(--error-color-medium, #d9485f);}
            .jc-empty-card{min-height:180px;}
            .jc-empty-text{margin:0;color:var(--text-color, inherit);opacity:.82;white-space:normal;}
            [data-theme="dark"] .jc-card-header,[data-theme="dark"] .jc-actions-wrap,[data-theme="dark"] .jc-group-badge,[data-theme="dark"] .jc-group-delay-button{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.04);}
            [data-theme="dark"] .jc-option-card:hover:not(:disabled),[data-theme="dark"] .jc-option-card:focus-visible:not(:disabled){background:rgba(79, 140, 255, .12);}
            [data-theme="dark"] .jc-option-card-active{background:rgba(79, 140, 255, .14);}
            @media (max-width:700px){.jc-group-header{align-items:flex-start;}.jc-option-grid{grid-template-columns:1fr 1fr;}}
            @media (max-width:520px){.jc-option-grid{grid-template-columns:1fr;}}
        `);

        container.appendChild(E("h3", { class: "cbi-section-title" }, _("Nodes")));
        container.appendChild(modeWrap);
        container.appendChild(content);
        container.appendChild(style);

        return container;
    }
});
