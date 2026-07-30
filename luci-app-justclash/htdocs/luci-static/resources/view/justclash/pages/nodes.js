"use strict";
"require view";
"require ui";
"require uci";
"require view.justclash.common as common";
"require view.justclash.api.mihomo as mihomoApi";
"require view.justclash.lib.nodes as nodesModel";

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
            const nodesState = nodesModel.normalizeNodesState(proxies, proxyProviders);

            return {
                token,
                mode: configs?.mode || "rule",
                nodesState,
                providersState: nodesModel.normalizeProvidersState(proxyProviders),
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
                nodesState: nodesModel.normalizeNodesState(null, null),
                providersState: nodesModel.normalizeProvidersState(null),
                configLoadFailed,
                fetchFailed: true,
                fetchError: e.message || String(e)
            };
        }
    },

    render: function (result) {
        const DELAY_TEST_CONCURRENCY = 3;
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
            return nodesModel.canTestProxy(getProxyEntry(proxyName));
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
            if (state.loading || state.delayLoadingGroup || state.delayLoadingProvider || state.updatingProvider)
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

        const handleProviderUpdate = async (provider) => {
            if (state.loading || state.delayLoadingGroup || state.delayLoadingProvider || state.updatingProvider)
                return;

            state.updatingProvider = provider.name;
            syncModeSelect();
            rerenderProviderSection(provider.name);

            try {
                await mihomoApi.updateProxyProvider(provider.name, state.token, 30000);
                await fetchNodesState();
            } catch (e) {
                ui.addNotification(null, E("p", _("Failed to update provider %s: %s").format(provider.name, e.message)), "error");
            } finally {
                state.updatingProvider = "";
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

            if (nodesModel.isAutoGroup(group.type)) {
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

        const formatSubscriptionInfo = (info) => {
            if (!info || typeof info !== "object") return null;

            const d = info.Download || info.download || 0;
            const u = info.Upload || info.upload || 0;
            const t = info.Total || info.total || 0;
            const e = info.Expire || info.expire || 0;

            if (!d && !u && !t && !e) return null;

            const usedStr = common.formatBytes(d + u);
            const totalStr = t === 0 ? "∞" : common.formatBytes(t);

            let text = `${_("Traffic")}: ${usedStr} / ${totalStr}`;

            if (e) {
                const date = new Date(e * 1000);
                text += ` | ${_("Expire")}: ${date.toLocaleDateString()}`;
            }

            return text;
        };

        const createProviderSection = (provider) => {
            const updatedText = formatProviderUpdatedAt(provider.updatedAt);
            const isDelayLoading = state.delayLoadingProvider === provider.name;
            const isUpdating = state.updatingProvider === provider.name;
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

            const updateButton = E("button", {
                type: "button",
                class: "cbi-button cbi-button-action jc-group-delay-button",
                title: _("Update"),
                "aria-label": _("Update"),
                click: async (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    await handleProviderUpdate(provider);
                }
            }, isUpdating ? _("Updating...") : _("Update"));

            const isDisabled = !!state.loading || !!state.delayLoadingGroup || !!state.delayLoadingProvider || !!state.updatingProvider;
            delayButton.disabled = isDisabled;
            updateButton.disabled = isDisabled;

            const subInfoText = formatSubscriptionInfo(provider.subscriptionUserinfo || provider.subscriptionInfo);
            const subInfoNode = subInfoText ? E("div", { class: "jc-provider-subinfo", style: "font-size:0.85em;opacity:0.75;" }, subInfoText) : "";

            return E("section", { class: "jc-group-section jc-provider-section" }, [
                E("div", { class: "jc-group-header" }, [
                    E("div", { style: "display:flex;flex-direction:column;gap:0.15rem;" }, [
                        E("h4", { class: "jc-group-title" }, provider.name),
                        subInfoNode
                    ]),
                    E("div", { class: "jc-group-header-actions" }, [
                        E("div", { class: "jc-group-badges" }, [
                            provider.vehicleType ? E("span", { class: "jc-group-badge" }, provider.vehicleType) : "",
                            E("span", { class: "jc-group-badge" }, String((provider.proxies || []).length)),
                            updatedText ? E("span", { class: "jc-group-badge" }, updatedText) : ""
                        ]),
                        updateButton,
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
            const nodesState = nodesModel.normalizeNodesState(proxies, proxyProviders);

            state.nodesState = nodesState;
            state.providersState = nodesModel.normalizeProvidersState(proxyProviders);
            state.mode = configs?.mode || state.mode || "rule";
            result.fetchFailed = false;
            result.fetchError = "";
        };

        const modeLabel = E("span", { class: "jc-mode-label" }, _("Mode"));
        const modeDropdown = new ui.Dropdown(nodesModel.lower(state.mode) || "rule", {
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
            modeDropdown.setValue(nodesModel.lower(state.mode) || "rule");
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
            .jc-group-badge{display:inline-flex;align-items:center;padding:0.1rem 0.55rem;border-radius:9999px;font-size:0.8em;line-height:1.25;font-family:inherit;box-sizing:border-box;color:var(--primary-color-medium, #4f8cff);border:1px solid color-mix(in srgb, var(--primary-color-medium, #4f8cff) 25%, transparent);background:color-mix(in srgb, var(--primary-color-medium, #4f8cff) 10%, transparent);font-weight:600;}
            .jc-group-badge-current{color:var(--warn-color-medium, #fd7e14);border-color:color-mix(in srgb, var(--warn-color-medium, #fd7e14) 25%, transparent);background:color-mix(in srgb, var(--warn-color-medium, #fd7e14) 10%, transparent);font-weight:600;}
            .jc-option-meta-current{color:var(--warn-color-medium, #fd7e14);font-weight:600;}
            button.cbi-button.jc-group-delay-button{display:inline-flex;align-items:center;font:inherit;font-family:inherit;font-size:0.88em;font-weight:500;line-height:1.2;margin:0;min-width:0;min-height:0;height:auto;padding:0.18rem 0.5rem;border-radius:0.25rem;box-sizing:border-box;color:var(--success-color-medium, #2f9e44);border:1px solid color-mix(in srgb, var(--success-color-medium, #2f9e44) 30%, transparent);background:color-mix(in srgb, var(--success-color-medium, #2f9e44) 6%, transparent);appearance:none;-webkit-appearance:none;transition:border-color .18s ease, background-color .18s ease, transform .18s ease;}
            button.cbi-button.jc-group-delay-button:hover:not(:disabled),button.cbi-button.jc-group-delay-button:focus-visible:not(:disabled){border-color:var(--success-color-medium, #2f9e44);background:color-mix(in srgb, var(--success-color-medium, #2f9e44) 12%, transparent);transform:translateY(-0.0625rem);}
            button.cbi-button.jc-group-delay-button:disabled,.jc-option-card:disabled{opacity:.7;transform:none;}
            .jc-option-card:hover:not(:disabled),.jc-option-card:focus-visible:not(:disabled){border-color:var(--primary-color-medium, #4f8cff);background:color-mix(in srgb, var(--primary-color-medium, #4f8cff) 6%, transparent);transform:translateY(-0.0625rem);}
            .jc-option-grid{display:grid;grid-template-columns:repeat(auto-fill, minmax(10.3125rem, 1fr));gap:0.75rem;}
            .jc-card{padding:.75em;border:1px solid var(--border-color-medium, #d9d9d9);border-radius:0.25rem;box-sizing:border-box;}
            .jc-card-header{align-self:flex-start;margin-bottom:.7em;padding:.2em .45em;border-radius:0.375rem;}
            .jc-provider-card{cursor:default;background:color-mix(in srgb, var(--warn-color-medium, #fd7e14) 8%, transparent);transform:none;border:1px solid color-mix(in srgb, var(--warn-color-medium, #fd7e14) 35%, transparent);transition:none;}
            .jc-option-card{width:100%;align-items:flex-start;gap:.35em;text-align:left;cursor:pointer;background:transparent;color:inherit;font:inherit;transition:border-color .18s ease, background-color .18s ease, transform .18s ease;}
            .jc-option-card:disabled{cursor:default;}
            .jc-option-card-active{border-color:var(--primary-color-medium, #4f8cff);background:color-mix(in srgb, var(--primary-color-medium, #4f8cff) 8%, transparent);}
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
            :root[data-darkmode="true"] .jc-card-header,:root[data-darkmode="true"] .jc-actions-wrap{border-color:var(--border-color-medium, rgba(255,255,255,.08));background:var(--background-color-high, rgba(255,255,255,.04));}
            :root[data-darkmode="true"] .jc-option-card:hover:not(:disabled),:root[data-darkmode="true"] .jc-option-card:focus-visible:not(:disabled){background:color-mix(in srgb, var(--primary-color-medium, #66a1ff) 12%, transparent);}
            :root[data-darkmode="true"] .jc-option-card-active{background:color-mix(in srgb, var(--primary-color-medium, #66a1ff) 14%, transparent);}
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
