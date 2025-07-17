"use strict";
"require ui";
"require view";
"require uci";
"require view.justclash.common as common";
"require view.justclash.rulesets as rulesets";
"require form";
"require rpc";

return view.extend({
    parseDirectRulesSection: function (section) {
        const rules = [];
        [
            [common.valueToArray(section.additional_domain_direct), "DOMAIN-SUFFIX"],
            [common.valueToArray(section.additional_domain_keyword_direct), "DOMAIN-KEYWORD"],
            [common.valueToArray(section.additional_domain_regex_direct), "DOMAIN-REGEX"],
            [common.valueToArray(section.additional_srcip_direct), "SRC-IP-CIDR"],
            [common.valueToArray(section.additional_destip_direct), "IP-CIDR"]
        ].forEach(([arr, type]) => {
            arr.forEach(item => {
                const val = item.trim();
                if (val) rules.push(`${type},${val},DIRECT`);
            });
        });
        return { rules };
    },

    parseBlockRulesSection: function (section) {
        const rules = [];
        const selectedRuleSets = {};
        const selectedBlockRuleSetsNames = common.valueToArray(section.enabled_blocklist);

        selectedBlockRuleSetsNames.forEach(ruleset => {
            const rs = rulesets.availableBlockRulesets.find(x => ruleset === x.yamlName);
            if (rs) {
                let copy = Object.assign({}, rs);
                const yamlName = copy.yamlName;
                delete copy.name;
                delete copy.yamlName;
                copy.proxy = common.defaultRuleSetProxy;
                copy.interval = common.defaultRuleSetUpdateInterval;
                copy.type = copy.type || "http";
                copy.format = copy.format || "mrs";
                selectedRuleSets[yamlName] = copy;
            } else {
                console.warn("parseBlockRulesSection", "selectedBlockRuleSetsNames missed", ruleset);
            }
        });

        [
            [Object.keys(selectedRuleSets), "RULE-SET"],
            [common.valueToArray(section.additional_domain_blockroute), "DOMAIN-SUFFIX"],
            [common.valueToArray(section.additional_destip_blockroute), "IP-CIDR"]
        ].forEach(([arr, type]) => {
            arr.forEach(val => {
                const trimmed = val.trim();
                if (trimmed) rules.push(`${type},${trimmed},REJECT`);
            });
        });

        return { rules, selectedRuleSets };
    },

    parseProxiesSection: function (section, sectionName) {
        const rules = [];
        const selectedRuleSets = {};
        const proxies = [];
        let proxyObject = null;

        const link = section.proxy_link?.trim();
        if (link) {
            try {
                proxyObject = common.parseProxyLink(link);
                proxyObject.name = sectionName;
                proxies.push(proxyObject);
            } catch (e) {
                console.error(_("Cannot parse proxy URI:"), e);
            }
        }
        if (proxyObject) {
            const selectedRuleSetsNames = common.valueToArray(section.enabled_list);
            selectedRuleSetsNames.forEach(ruleset => {
                const rs = rulesets.availableRuleSets.find(x => ruleset === x.yamlName);
                if (rs) {
                    let copy = Object.assign({}, rs);
                    const yamlName = copy.yamlName;
                    delete copy.name;
                    delete copy.yamlName;
                    copy.proxy = section.use_proxy_for_list_update ? sectionName : common.defaultRuleSetProxy;
                    copy.interval = parseInt(section.list_update_interval, 10) || common.defaultRuleSetUpdateInterval;
                    copy.type = copy.type || "http";
                    copy.format = copy.format || "mrs";
                    selectedRuleSets[yamlName] = copy;
                } else {
                    console.warn("parseProxiesSection", "selectedBlockRuleSetsNames missed", ruleset);
                }
            });
            [
                [Object.keys(selectedRuleSets), "RULE-SET"],
                [common.valueToArray(section.additional_srcip_route), "SRC-IP-CIDR"],
                [common.valueToArray(section.additional_domain_route), "DOMAIN-SUFFIX"],
                [common.valueToArray(section.additional_destip_route), "IP-CIDR"]
            ].forEach(([arr, type]) => {
                arr.forEach(val => {
                    const trimmed = val.trim();
                    if (trimmed) rules.push(`${type},${trimmed},${sectionName}`);
                });
            });
        } else {
            console.warn("parseProxiesSection", "proxyObject is missing", link);
        }

        return { proxies, rules, selectedRuleSets };
    },

    parseProxyGroupsSection: function (section, sectionName) {
        const proxyGroups = [];
        const rules = [];
        const selectedRuleSets = {};

        let proxyList = null;
        let providerList = null;

        if (section.proxies_list)
            proxyList = common.splitAndTrimString(section.proxies_list, ",");
        if (section.providers_list)
            providerList = common.splitAndTrimString(section.providers_list, ",");

        if (proxyList && proxyList.length > 1) {
            proxyGroups.push({
                sectionName,
                type: section.group_type,
                strategy: section.strategy,
                url: section.check_url,
                interval: parseInt(section.interval, 10),
                timeout: 5000,
                proxies: proxyList,
                use: providerList,
                lazy: false
            });
            const selectedRuleSetsNames = common.valueToArray(section.enabled_list);
            selectedRuleSetsNames.forEach(ruleset => {
                const rs = rulesets.availableRuleSets.find(x => ruleset === x.yamlName);
                if (rs) {
                    let copy = Object.assign({}, rs);
                    const yamlName = copy.yamlName;
                    delete copy.name;
                    delete copy.yamlName;
                    copy.proxy = section.use_proxy_group_for_list_update ? sectionName : common.defaultRuleSetProxy;
                    copy.interval = parseInt(section.list_update_interval, 10) || common.defaultRuleSetUpdateInterval;
                    copy.type = copy.type || "http";
                    copy.format = copy.format || "mrs";
                    selectedRuleSets[yamlName] = copy;
                } else {
                    console.warn("parseProxyGroupsSection", "selectedBlockRuleSetsNames is missing", ruleset);
                }
            });
            [
                [Object.keys(selectedRuleSets), "RULE-SET"],
                [common.valueToArray(section.additional_srcip_route), "SRC-IP-CIDR"],
                [common.valueToArray(section.additional_domain_route), "DOMAIN-SUFFIX"],
                [common.valueToArray(section.additional_destip_route), "IP-CIDR"]
            ].forEach(([arr, type]) => {
                arr.forEach(val => {
                    const trimmed = val.trim();
                    if (trimmed) rules.push(`${type},${trimmed},${sectionName}`);
                });
            });
        } else {
            console.warn("parseProxyGroupsSection", "proxyList is missing or wrong", proxyList);
        }

        return { proxyGroups, rules, selectedRuleSets };
    },
    parseProxyProvidersSection: function (section, sectionName) {
        const proxyProviders = {};

        const url = section.subscription?.trim();

        const provider = {
            type: "http",
            url,
            interval: parseInt(section.update_interval, 10) || common.defaultProxyProviderUpdateIntervalSec
        };

        if (section.health_check) {
            provider["health-check"] = {
                enable: true,
                lazy: true,
                url: section.health_check_url?.trim() || common.defaultProxyGroupCheckUrl,
                interval: parseInt(section.health_check_interval, 10) || common.defaultProxyProviderHealthCheckSec,
                timeout: parseInt(section.health_check_timeout, 10) || common.defaultHealthCheckTimeoutMs
            };
        }

        if (section.filter) {
            provider.filter = section.filter.trim();
        }

        if (section.exclude_filter) {
            provider["exclude-filter"] = section["exclude_filter"].trim();
        }

        if (section.exclude_type) {
            provider["exclude-type"] = section["exclude_type"].trim();
        }

        proxyProviders[sectionName] = provider;

        return { proxyProviders };
    },
    parseFinalRulesSection: function (section, sectionName) {
        let dest = section.final_destination.trim();
        if (!dest) dest = "DIRECT";
        return { rules: [`MATCH,${dest}`] };
    },

    handleSaveApply: async function (ev) {
        try {
            await this.handleSave(ev);
            await uci.load(common.binName);
            const allSections = uci.sections(common.binName);

            let virtualRuleSets = {};
            let virtualProxies = [];
            let virtualProxyGroups = [];
            let virtualProxyProviders = {};

            let virtualRules = [];

            let virtualDirectRules = [];
            let virtualBlockRules = [];
            let virtualFinalRules = [];
            for (const s of allSections) {
                const type = s[".type"];
                const name = s.name ? s.name.trim() : "";
                switch (type) {
                    case "proxies":
                        const proxiesRet = this.parseProxiesSection(s, name);
                        virtualProxies.push(...proxiesRet.proxies);
                        virtualRules.push(...proxiesRet.rules);
                        virtualRuleSets = { ...virtualRuleSets, ...proxiesRet.selectedRuleSets };
                        break;
                    case "proxy_group":
                        const proxyGroupRet = this.parseProxyGroupsSection(s, name);
                        virtualProxyGroups.push(...proxyGroupRet.proxyGroups);
                        virtualRules.push(...proxyGroupRet.rules);
                        virtualRuleSets = { ...virtualRuleSets, ...proxyGroupRet.selectedRuleSets };
                        break;
                    case "proxy_provider":
                        const proxyProviderRet = this.parseProxyProvidersSection(s, name);
                        virtualProxyProviders = { ...virtualProxyProviders, ...proxyProviderRet.proxyProviders };
                        break;
                    case "block_rules":
                        const blockRulesRet = this.parseBlockRulesSection(s);
                        virtualBlockRules.push(...blockRulesRet.rules);
                        virtualRuleSets = { ...virtualRuleSets, ...blockRulesRet.selectedRuleSets };
                        break;
                    case "direct_rules":
                        const directRulesRet = this.parseDirectRulesSection(s);
                        virtualDirectRules.push(...directRulesRet.rules);
                        break;
                    case "final_rules":
                        const finalRulesRet = this.parseFinalRulesSection(s);
                        virtualFinalRules.push(...finalRulesRet.rules);
                        break;
                }
            }

            const compiledRules = [
                ...virtualDirectRules,
                ...virtualBlockRules,
                ...virtualRules,
                ...virtualFinalRules
            ];

            uci.set(common.binName, "compiled", "rules", JSON.stringify(compiledRules));
            uci.set(common.binName, "compiled", "proxies", JSON.stringify(virtualProxies));
            uci.set(common.binName, "compiled", "proxy_groups", JSON.stringify(virtualProxyGroups));
            uci.set(common.binName, "compiled", "rule_providers", JSON.stringify(virtualRuleSets, null, 2));
            uci.set(common.binName, "compiled", "proxy_providers", JSON.stringify(virtualProxyProviders, null, 2));

            await uci.save(common.binName);
            await rpc.call("uci", "commit", { config: common.binName });
            await ui.changes.apply(false);

        } catch (e) {
            console.error("Ошибка при сохранении и применении настроек:", e);
            ui.showModal(_("Error"), _("Failed to save or apply settings: ") + e.message);
        }
    },
    render() {
        let m, s, s2, spp, s3, s4, s5, o;

        m = new form.Map(common.binName);
        s = m.section(form.TypedSection, "proxies", _("Proxies list:"), _("Proxies defined as outbound connections."));
        s.anonymous = true;
        s.addremove = true;

        o = s.option(form.Value, "name", _("Name:"));
        o.description = _("Virtual proxy name.");
        o.rmempty = false;
        o.cfgvalue = function (section_id) {
            const val = uci.get(common.binName, section_id, "name");
            if (val)
                return val;
            return common.generateRandomName(common.genNameProxyPrefix);
        };
        o.validate = function (section_id, value) {
            return (common.isValidSimpleName(value)) ? true : _("Name must contain only lowercase letters, digits, and underscores");
        };

        o = s.option(form.Value, "proxy_link", _("URI:"));
        o.description = _("URI link with connection parameters.");
        o.password = true;
        o.rmempty = false;
        o.validate = function (section_id, value) {
            return (common.isValidProxyLink(value)) ? true : _("Invalid link.");
        };

        o = s.option(form.MultiValue, "enabled_list", _("Use with rules:"));
        rulesets.availableRuleSets.forEach(item => {
            o.value(item.yamlName, _(`${item.name}`));
        });
        o.description = _("Predefined RULE-SET lists, select those which you want to route through proxy. Leave empty if you will use proxy with proxy-groups.");

        o = s.option(form.Flag, "use_proxy_for_list_update", _("Get lists through proxy:"));
        o.description = _("If enabled, RULE-SET lists will be updated through proxy.");
        o.optional = true;
        o.default = "0";

        o = s.option(form.Value, "list_update_interval", _("List update interval:"));
        o.datatype = "uinteger";
        o.default = common.defaultRuleSetUpdateInterval;
        o.optional = true;
        o.validate = function (section_id, value) {
            if (value === "") return true;
            let v = parseInt(value);
            if (isNaN(v) || v < common.minimalRuleSetUpdateInterval) {
                return _(`Value must be above ${common.minimalRuleSetUpdateInterval}secs.`);
            }
            return true;
        };

        o = s.option(form.DynamicList, "additional_domain_route", _("DOMAIN-SUFFIX:"));
        o.description = _("Each element is a DOMAIN-SUFFIX rule to route through proxy with Mihomo syntax.");
        o.optional = true;
        o.validate = function (section_id, value) {
            return (common.isValidDomainSuffix(value));
        };

        o = s.option(form.DynamicList, "additional_destip_route", _("IP-CIDR:"));
        o.description = _("Each element is an IP-CIDR rule to route through proxy with Mihomo syntax. IPv4 only right now.");
        o.optional = true;
        o.datatype = "cidr4";

        o = s.option(form.DynamicList, "additional_srcip_route", _("SRC-IP-CIDR:"));
        o.description = _("Each element is an SRC-IP-CIDR rule to route through proxy with Mihomo syntax. IPv4 only right now.");
        o.optional = true;
        o.editable = true;
        o.datatype = "cidr4";

        s2 = m.section(form.TypedSection, "proxy_group", _("Proxy groups:"), _("Group proxies for special routing (fallback, load balancing)."));
        s2.anonymous = true;
        s2.addremove = true;
        s2.validate = function (section_id) {
            const proxies = this.data?.state?.values?.justclash?.[common.binName]?.['proxies_list'] || [];
            const providers = this.data?.state?.values?.justclash?.[common.binName]?.['providers_list'] || [];

            if (!providers && !proxies) return _('Providers or Proxies must be filled.');
            return true;
        };

        o = s2.option(form.Value, "name", _("Name:"));
        o.description = _("Proxy group name.");
        o.rmempty = false;
        o.cfgvalue = function (section_id) {
            const val = uci.get(common.binName, section_id, "name");
            if (val)
                return val;
            return common.generateRandomName(common.genNameProxyGroupPrefix);
        };
        o.validate = function (section_id, value) {
            return (common.isValidSimpleName(value)) ? true : _("Name must contain only lowercase letters, digits, and underscores");
        };

        o = s2.option(form.ListValue, "group_type", _("Group type:"));
        common.defaultProxyGroupsTypes.forEach(item => {
            o.value(item, _(`${item}`));
        });
        o.rmempty = false;
        o.default = common.defaultProxyGroupsTypes[0];

        o = s2.option(form.ListValue, "strategy", _("Group strategy:"));
        common.defaultProxyGroupsBalanceModeStrategies.forEach(item => {
            o.value(item, _(`${item}`));
        });
        o.default = common.defaultProxyGroupsBalanceModeStrategies[0];
        o.depends("group_type", "load-balancer");

        o = s2.option(form.Value, "proxies_list", _("Proxies:"));
        o.placeholder = "proxy-name1, proxy-name2";
        o.validate = function (section_id, value) {
            if (!value) return true;

            let arr = value.split(",").map(s => s.trim()).filter(s => s.length > 0);

            if (arr.length === 0) return _("Field must not be empty");

            for (let name of arr) {
                if (!common.isValidSimpleName(name)) {
                    return _("Name must contain only lowercase letters, digits, and underscores");
                }
            }

            return true;
        };

        o = s2.option(form.Value, "providers_list", _("Providers:"));
        o.placeholder = "provider-name1, provider-name2";
        o.validate = function (section_id, value) {
            if (!value) return true;

            let arr = value.split(",").map(s => s.trim()).filter(s => s.length > 0);

            if (arr.length === 0) return _("Field must not be empty");

            for (let name of arr) {
                if (!common.isValidSimpleName(name)) {
                    return _("Name must contain only lowercase letters, digits, and underscores");
                }
            }

            return true;
        };

        o = s2.option(form.Value, "check_url", _("Check URL:"));
        o.placeholder = common.defaultProxyGroupCheckUrl;
        o.default = common.defaultProxyGroupCheckUrl;
        o.rmempty = false;
        o.validate = function (section_id, value) {
            return (common.isValidHttpUrl(value)) ? true : _("Only http:// or https:// URLs are allowed.");
        };
        o.description = _("URL for node availability check (required for group functionality).");

        o = s2.option(form.Value, "interval", _("Check interval:"));
        o.datatype = "uinteger";
        o.default = common.defaultProxyGroupIntervalSec;
        o.rmempty = false;

        o = s2.option(form.MultiValue, "enabled_list", _("Use with rules:"));
        rulesets.availableRuleSets.forEach(item => {
            o.value(item.yamlName, _(`${item.name}`));
        });
        o.description = _("Predefined RULE-SET lists, select those which you want to route through proxy-group.");

        o = s2.option(form.Flag, "use_proxy_group_for_list_update", _("Get lists through proxy:"));
        o.description = _("If enabled, RULE-SET lists will be updated through proxy.");
        o.optional = true;
        o.default = "0";

        o = s2.option(form.Value, "list_update_interval", _("List update interval:"));
        o.datatype = "uinteger";
        o.default = common.defaultRuleSetUpdateInterval;
        o.optional = true;
        o.validate = function (section_id, value) {
            if (value === "") return true;
            let v = parseInt(value);
            if (isNaN(v) || v < common.minimalRuleSetUpdateInterval) {
                return _(`Value must be above ${common.minimalRuleSetUpdateInterval}secs.`);
            }
            return true;
        };

        o = s2.option(form.DynamicList, "additional_domain_route", _("DOMAIN-SUFFIX:"));
        o.description = _("One element is one DOMAIN-SUFFIX rule with mihomo syntax.");
        o.optional = true;
        o.editable = true;
        o.validate = function (section_id, value) {
            return (common.isValidDomainSuffix(value));
        };

        o = s2.option(form.DynamicList, "additional_destip_route", _("IP-CIDR:"));
        o.description = _("One element is one IP-CIDR rule with mihomo syntax. IPV4 only right now.");
        o.optional = true;
        o.editable = true;
        o.datatype = "cidr4";

        o = s2.option(form.DynamicList, "additional_srcip_route", _("SRC-IP-CIDR:"));
        o.description = _("Each element is one SRC-IP-CIDR rule to block with proxy (mihomo syntax). IPV4 only right now.");
        o.optional = true;
        o.editable = true;
        o.datatype = "cidr4";

        spp = m.section(form.TypedSection, "proxy_provider", _("Proxy provider:"), _("Proxy providers are external subscription URLs that dynamically load a list of proxies. "));
        spp.anonymous = true;
        spp.addremove = true;

        o = spp.option(form.Value, "name", _("Name:"));
        o.rmempty = false;
        o.cfgvalue = function (section_id) {
            const val = uci.get(common.binName, section_id, "name");
            if (val)
                return val;
            return common.generateRandomName(common.genNameProxyProviderPrefix);
        };
        o.validate = function (section_id, value) {
            return (common.isValidSimpleName(value)) ? true : _("Name must contain only lowercase letters, digits, and underscores");
        };

        o = spp.option(form.Value, "subscription", _("Subscription URL:"));
        o.placeholder = "https://yourSubscriptionUrl";
        o.rmempty = false;
        o.validate = function (section_id, value) {
            return (common.isValidHttpUrl(value)) ? true : _("Only http:// or https:// URLs are allowed.");
        };
        o.description = _("Your complete subscription URL with http:// or https://.");

        o = spp.option(form.Value, "update_interval", _("Update interval:"));
        o.datatype = "uinteger";
        o.default = common.defaultProxyProviderIntervalSec;
        o.description = _("Time interval for subscription update check.");

        o = spp.option(form.Flag, "health_check", _("Health check:"));
        o.default = "1";
        o.rmempty = false;

        o = spp.option(form.Value, "health_check_url", _("Check URL:"));
        o.placeholder = common.defaultProxyGroupCheckUrl;
        o.default = common.defaultProxyGroupCheckUrl;
        o.rmempty = false;
        o.validate = function (section_id, value) {
            return (common.isValidHttpUrl(value)) ? true : _("Only http:// or https:// URLs are allowed.");
        };
        o.description = _("URL for node availability check (required for proxy provider functionality).");
        o.depends("health_check", "1");

        o = spp.option(form.Value, "health_check_interval", _("Check interval:"));
        o.datatype = "uinteger";
        o.default = common.defaultProxyProviderHealthCheckSec;
        o.depends("health_check", "1");
        o.description = _("Time interval between health checks in seconds.");

        o = spp.option(form.Value, "health_check_timeout", _("Check timeout:"));
        o.datatype = "uinteger";
        o.default = common.defaultHealthCheckTimeoutMs;
        o.depends("health_check", "1");
        o.description = _("Timeout for each individual health check in milliseconds.");

        o = spp.option(form.Value, "filter", _("Filter:"));
        o.description = _("Filter nodes that contain keywords or match regular expressions. Multiple patterns can be separated with | (pipe).");
        o.optional = true;
        o.rmempty = true;
        o.placeholder = "HK|US|(?i)Netflix";
        o.validate = function (section_id, value) {
            return common.isValidKeywordOrRegexList(value, "filter");
        };

        o = spp.option(form.Value, "exclude_filter", _("Exclude filter:"));
        o.description = _("Exclude nodes that match keywords or regular expressions. Multiple patterns can be separated with | (pipe).");
        o.optional = true;
        o.rmempty = true;
        o.placeholder = "CN|(?i)douyin";
        o.validate = function (section_id, value) {
            return common.isValidKeywordOrRegexList(value, "exclude_filter");
        };

        o = spp.option(form.Value, "exclude_type", _("Exclude type:"));
        o.description = _("Exclude type filter.");
        o.optional = true;
        o.rmempty = true;
        o.validate = function (section_id, value) {
            if (!value) return true;
            const regex = /^[a-z0-9|]+$/;
            if (!regex.test(value)) {
                return _("Only lowercase letters, digits, and the '|' separator are allowed. No spaces or special symbols.");
            }

            // Опционально: можно указать допустимые типы
            const allowedTypes = ["vmess", "vless", "ss", "ssr", "trojan", "hysteria2", "snell", "http", "socks5"];
            const types = value.split("|");

            for (let i = 0; i < types.length; i++) {
                const type = types[i].trim();
                if (type && !allowedTypes.includes(type)) {
                    return _("Unsupported type: ") + type;
                }
            }

            return true;
        };
        s3 = m.section(form.NamedSection, "direct_rules", "direct_rules", _("DIRECT rules:"), _("Additional settings for DIRECT rules. Will be handled before proxies, proxy groups and REJECT rules."));
        s3.addremove = false;

        o = s3.option(form.DynamicList, "additional_domain_direct", _("DOMAIN-SUFFIX pass:"));
        o.description = _("Each element is a DOMAIN-SUFFIX rule to pass in DIRECT (Mihomo syntax).");
        o.optional = true;
        o.editable = true;
        o.validate = function (section_id, value) {
            return (common.isValidDomainSuffix(value));
        };

        o = s3.option(form.DynamicList, "domain_keyword_direct", _("DOMAIN-KEYWORD pass:"));
        o.description = _("Each element is one DOMAIN-KEYWORD rule to pass in DIRECT (Mihomo syntax).");
        o.optional = true;
        o.editable = true;
        o.validate = function (section_id, value) {
            return (common.isValidDomainKeyword(value));
        };

        o = s3.option(form.DynamicList, "additional_domain_regexp_direct", _("DOMAIN-REGEX pass:"));
        o.description = _("Each element is a DOMAIN-REGEX rule to pass in DIRECT (Mihomo syntax).");
        o.optional = true;
        o.editable = true;
        o.validate = function (section_id, value) {
            return (common.isValidDomainRegexp(value));
        };

        o = s3.option(form.DynamicList, "additional_srcip_direct", _("SRC-IP-CIDR pass:"));
        o.description = _("Each element is one SRC-IP-CIDR rule to pass in DIRECT (Mihomo syntax). IPV4 only right now.");
        o.optional = true;
        o.editable = true;
        o.datatype = "cidr4";

        o = s3.option(form.DynamicList, "additional_destip_direct", _("IP-CIDR pass:"));
        o.description = _("Each element is one IP-CIDR rule to pass in DIRECT (Mihomo syntax). IPV4 only right now.");
        o.optional = true;
        o.editable = true;
        o.datatype = "cidr4";

        s4 = m.section(form.NamedSection, "block_rules", "block_rules", _("REJECT rules:"), _("Additional settings for REJECT rules. Will be handled before proxies and proxy groups."));
        s4.addremove = false;

        o = s4.option(form.MultiValue, "enabled_blocklist", _("Use with rules:"));
        rulesets.availableBlockRulesets.forEach(item => {
            o.value(item.yamlName, _(`${item.name}`));
        });
        o.description = _("Predefined RULE-SET lists with ads/badware. Select those you want to block with the proxy. Leave empty if you don't want to block anything.");

        o = s4.option(form.DynamicList, "additional_domain_blockroute", _("DOMAIN-SUFFIX block:"));
        o.description = _("Each element is a DOMAIN-SUFFIX rule to block with proxy (Mihomo syntax).");
        o.optional = true;
        o.editable = true;
        o.validate = function (section_id, value) {
            return (common.isValidDomainSuffix(value));
        };

        o = s4.option(form.DynamicList, "additional_destip_blockroute", _("IP-CIDR block:"));
        o.description = _("Each element is an IP-CIDR rule to block with proxy (Mihomo syntax). IPv4 only right now.");
        o.optional = true;
        o.editable = true;
        o.datatype = "cidr4";

        s5 = m.section(form.NamedSection, "final_rules", "final_rules", _("FINAL rule:"), _("Additional settings for the final rules applied after all others. Use it to override or enforce specific behaviors."));
        s5.addremove = false;

        o = s5.option(form.Value, "final_destination", _("Destination:"));
        o.default = common.defaultRuleSetProxy;
        o.placeholder = common.defaultRuleSetProxy;
        o.rmempty = false;
        o.validate = function (section_id, value) {
            if (!value || value.trim().length === 0) {
                return _("This field cannot be empty");
            }
            return true;
        };
        return m.render().then(formEl => {
            return E("div", {}, [
                this.addCSS(),
                formEl
            ]);
        });
    },
    addCSS() {
        return E("style", {}, `
            .cbi-section {
                border: 0 !important;
                border-bottom: 1px solid #595959 !important;
            }
            .cbi-section-create {
                width: 100% !important;
                padding: 10px 0 10px 0 !important;
            }
        `);
    },
    destroy() {

    }
});