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
            renderNodes();

            try {
                await runProxyDelayTests(group.options.filter(canTestProxyDelay), state.groupDelays[group.name]);
            } finally {
                state.delayLoadingGroup = "";
                syncModeSelect();
                renderNodes();
            }
        };

        const handleProviderDelay = async (provider) => {
            if (state.loading || state.delayLoadingGroup || state.delayLoadingProvider)
                return;

            state.delayLoadingProvider = provider.name;
            state.providerDelays[provider.name] = Object.create(null);
            syncModeSelect();
            renderNodes();

            try {
                const candidates = (provider.proxies || [])
                    .map((proxy) => proxy?.name)
                    .filter(canTestProxyDelay);

                await runProxyDelayTests(candidates, state.providerDelays[provider.name]);
            } finally {
                state.delayLoadingProvider = "";
                syncModeSelect();
                renderNodes();
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

            return E("section", { class: "jc-group-section" }, [
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

        const renderNodes = () => {
            content.replaceChildren();

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
                content.appendChild(createGroupSection(globalGroup));

            otherGroups.forEach((group) => {
                content.appendChild(createGroupSection(group));
            });

            state.providersState.forEach((provider) => {
                content.appendChild(createProviderSection(provider));
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
                renderNodes();
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
                state.pendingKey = "";
                state.loading = false;
                syncModeSelect();
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
            .jc-actions-wrap {
                margin-bottom: 16px;
                padding: 0.7em 0.8em;
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

            .jc-primary-actions .cbi-button {
                margin: 0 !important;
            }

            .jc-mode-wrap {
                display: inline-flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 0.55em;
            }

            .jc-mode-label {
                font-weight: 600;
            }

            .jc-mode-select {
                min-width: 130px;
                margin: 0 !important;
            }

            .jc-nodes-layout {
                display: flex;
                flex-direction: column;
                gap: 18px;
            }

            .jc-group-section {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .jc-group-header {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
            }

            .jc-group-title {
                margin: 0;
                font-size: 1.05rem;
                font-weight: 600;
            }

            .jc-group-header-actions {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: flex-end;
                gap: 8px;
            }

            .jc-group-badges {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            .jc-group-badge,
            .jc-group-delay-button {
                display: inline-flex;
                align-items: center;
                padding: 0.2em 0.55em;
                border: 1px solid var(--border-color-medium, #d9d9d9);
                border-radius: 999px;
                background: var(--background-color-medium, #f6f6f6);
                font-size: 0.88em;
                line-height: 1.2;
            }

            .jc-group-badge {
                opacity: 0.88;
            }

            .jc-group-badge-current {
                font-weight: 600;
            }

            .jc-group-delay-button {
                margin: 0 !important;
                min-width: 0;
                color: var(--text-color, inherit);
                font-weight: 500;
                opacity: 0.88;
                transition: border-color 0.18s ease, background-color 0.18s ease, transform 0.18s ease;
            }

            .jc-group-delay-button:hover:not(:disabled),
            .jc-group-delay-button:focus-visible:not(:disabled) {
                border-color: var(--primary-color-medium, #4f8cff);
                background: rgba(79, 140, 255, 0.06);
                transform: translateY(-1px);
            }

            .jc-group-delay-button:disabled {
                opacity: 0.7;
                transform: none;
            }

            .jc-option-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(165px, 1fr));
                gap: 12px;
            }

            .jc-card {
                display: flex;
                flex-direction: column;
                padding: 0.75em;
                border: 1px solid var(--border-color-medium, #bfbfbf);
                border-radius: 4px;
                box-sizing: border-box;
                color: var(--text-color, inherit);
            }

            .jc-card-header {
                display: inline-flex;
                align-items: center;
                align-self: flex-start;
                margin-bottom: 0.7em;
                padding: 0.2em 0.45em;
                border: 1px solid var(--border-color-medium, #d9d9d9);
                border-radius: 6px;
                background: var(--background-color-medium, #f6f6f6);
                font-size: 0.96em;
                color: var(--text-color, inherit);
                opacity: 0.88;
            }

            .jc-provider-card {
                cursor: default;
                background: transparent;
                transform: none !important;
            }

            .jc-option-card {
                width: 100%;
                align-items: flex-start;
                gap: 0.35em;
                text-align: left;
                cursor: pointer;
                background: transparent;
                color: inherit;
                font: inherit;
                transition: border-color 0.18s ease, background-color 0.18s ease, transform 0.18s ease;
            }

            .jc-option-card:hover:not(:disabled),
            .jc-option-card:focus-visible:not(:disabled) {
                border-color: var(--primary-color-medium, #4f8cff);
                background: rgba(79, 140, 255, 0.06);
                transform: translateY(-1px);
            }

            .jc-option-card:disabled {
                cursor: default;
                opacity: 0.7;
            }

            .jc-option-card-active {
                border-color: var(--primary-color-medium, #4f8cff);
                background: rgba(79, 140, 255, 0.08);
            }

            .jc-option-card-top,
            .jc-option-card-bottom {
                width: 100%;
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
            }

            .jc-option-card-top {
                gap: 8px;
            }

            .jc-option-card-bottom {
                gap: 12px;
            }

            .jc-option-name {
                font-weight: 600;
                white-space: normal;
                overflow-wrap: anywhere;
            }

            .jc-option-current-badge {
                display: inline-flex;
                flex: 0 0 auto;
                align-items: center;
                padding: 0.15em 0.45em;
                border-radius: 999px;
                background: rgba(79, 140, 255, 0.14);
                color: var(--primary-color-medium, #356fd9);
                font-size: 0.78em;
                font-weight: 600;
            }

            .jc-option-type,
            .jc-option-meta {
                min-width: 0;
                line-height: 1.25;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .jc-option-type {
                flex: 1 1 auto;
                font-size: 0.9em;
                opacity: 0.8;
            }

            .jc-option-meta {
                flex: 0 1 auto;
                text-align: right;
                font-size: 0.82em;
                opacity: 0.72;
            }

            .jc-option-meta-delay {
                color: var(--success-color-medium, #2f9e44);
                opacity: 1;
                font-weight: 600;
            }

            .jc-option-meta-timeout {
                color: var(--error-color-medium, #d9485f);
                opacity: 1;
                font-weight: 600;
            }

            .jc-empty-card {
                min-height: 180px;
            }

            .jc-empty-text {
                margin: 0;
                color: var(--text-color, inherit);
                opacity: 0.82;
                white-space: normal;
            }

            [data-theme="dark"] .jc-card-header,
            [data-theme="dark"] .jc-actions-wrap,
            [data-theme="dark"] .jc-group-badge,
            [data-theme="dark"] .jc-group-delay-button {
                border-color: rgba(255,255,255,0.08);
                background: rgba(255,255,255,0.04);
            }

            [data-theme="dark"] .jc-option-card:hover:not(:disabled),
            [data-theme="dark"] .jc-option-card:focus-visible:not(:disabled) {
                background: rgba(79, 140, 255, 0.12);
            }

            [data-theme="dark"] .jc-option-card-active {
                background: rgba(79, 140, 255, 0.14);
            }

            @media (max-width:700px) {
                .jc-group-header {
                    align-items: flex-start;
                }

                .jc-option-grid {
                    grid-template-columns: 1fr 1fr;
                }
            }

            @media (max-width:520px) {
                .jc-option-grid {
                    grid-template-columns: 1fr;
                }
            }
        `);

        container.appendChild(E("h3", { class: "cbi-section-title" }, _("Nodes")));
        container.appendChild(modeWrap);
        container.appendChild(content);
        container.appendChild(style);

        return container;
    }
});
