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
        const directDomains = common.valueToArray(section.additional_domain_direct);
        const directDomainsKeyword = common.valueToArray(section.additional_domain_keyword_direct);
        const directDomainsRegex = common.valueToArray(section.additional_domain_regex_direct);
        const directDomainsSrcIp = common.valueToArray(section.additional_srcip_direct);
        const directDomainsDestIp = common.valueToArray(section.additional_destip_direct);

        [
            [directDomains, "DOMAIN-SUFFIX"],
            [directDomainsKeyword, "DOMAIN-KEYWORD"],
            [directDomainsRegex, "DOMAIN-REGEX"],
            [directDomainsSrcIp, "SRC-IP-CIDR"],
            [directDomainsDestIp, "IP-CIDR"]
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
        const selectedRuleSets = [];
        const selectedBlockRuleSetsNames = common.valueToArray(section.enabled_blocklist);
        const domainBlockRoutes = common.valueToArray(section.additional_domain_blockroute);
        const destipBlockRoutes = common.valueToArray(section.additional_destip_blockroute);
        selectedBlockRuleSetsNames.forEach(ruleset => {
            const rs = rulesets.availableBlockRulesets.find(x => ruleset === x.yamlName);
            if (rs) {
                let copy = Object.assign({}, rs);
                const yamlName = copy.yamlName;
                delete copy.name;
                delete copy.yamlName;
                selectedRuleSets[yamlName] = copy;
            }
            else {
                console.warn("parseBlockRulesSection", "selectedBlockRuleSetsNames missed", ruleset);
            }
        });

        [
            [Object.keys(selectedRuleSets), "RULE-SET"],
            [domainBlockRoutes, "DOMAIN-SUFFIX"],
            [destipBlockRoutes, "IP-CIDR"]
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
        const selectedRuleSets = [];
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
            const srcipRoutes = common.valueToArray(section.additional_srcip_route);
            const domainRoutes = common.valueToArray(section.additional_domain_route);
            const destipRoutes = common.valueToArray(section.additional_destip_route);
            selectedRuleSetsNames.forEach(ruleset => {
                const rs = rulesets.availableRuleSets.find(x => ruleset === x.yamlName);
                if (rs) {
                    let copy = Object.assign({}, rs);
                    const yamlName = copy.yamlName;
                    delete copy.name;
                    delete copy.yamlName;
                    selectedRuleSets[yamlName] = copy;
                } else {
                    console.warn("parseProxiesSection", "selectedBlockRuleSetsNames missed", ruleset);
                }
            });
            [
                [Object.keys(selectedRuleSets), "RULE-SET"],
                [srcipRoutes, "SRC-IP-CIDR"],
                [domainRoutes, "DOMAIN-SUFFIX"],
                [destipRoutes, "IP-CIDR"]
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
        const selectedRuleSets = [];

        let proxyList = null;
        if (section.proxies_list)
            proxyList = common.splitAndTrimString(s.proxies_list, ",");

        if (proxyList && proxyList.length > 1) {
            proxyGroups.push({
                sectionName,
                type: section.group_type,
                strategy: section.strategy,
                url: section.check_url,
                interval: section.interval,
                timeout: 5000,
                use: proxyList,
                lazy: false
            });
            const selectedRuleSetsNames = common.valueToArray(s.enabled_list);
            const srcipRoutes = common.valueToArray(section.additional_srcip_route);
            const domainRoutes = common.valueToArray(s.additional_domain_route);
            const destipRoutes = common.valueToArray(s.additional_destip_route);
            selectedRuleSetsNames.forEach(ruleset => {
                const rs = rulesets.availableRuleSets.find(x => ruleset === x.yamlName);
                if (rs) {
                    let copy = Object.assign({}, rs);
                    const yamlName = copy.yamlName;
                    delete copy.name;
                    delete copy.yamlName;
                    selectedRuleSets[yamlName] = copy;
                } else {
                    console.warn("parseProxyGroupsSection", "selectedBlockRuleSetsNames is missing", ruleset);
                }
            });
            [
                [Object.keys(selectedRuleSets), "RULE-SET"],
                [srcipRoutes, "SRC-IP-CIDR"],
                [domainRoutes, "DOMAIN-SUFFIX"],
                [destipRoutes, "IP-CIDR"]
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
    parseFinalRulesSection: function (section, sectionName) {
        let dest = section.final_destination.trim();
        if (!dest || (dest && dest.length === 0)) dest = "DIRECT";
        return { rules: [`MATCH,${dest}`] };
    },
    handleSaveApply: function (ev) {
        return this.handleSave(ev).then(() => {
            return uci.load(common.binName).then(() => {
                const allSections = uci.sections(common.binName);

                let virtualRuleSets = {};
                let virtualProxies = [];
                let virtualProxyGroups = [];
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
                            virtualRuleSets = { ...virtualRuleSets, ...proxiesRet.selectedRuleSets };;
                            break;
                        case "proxy_group":
                            const proxyGroupRet = this.parseProxiesSection(s, name);
                            virtualProxyGroups.push(...proxyGroupRet.proxyGroups);
                            virtualRules.push(...proxyGroupRet.rules);
                            virtualRuleSets = { ...virtualRuleSets, ...proxyGroupRet.selectedRuleSets };;
                            break;
                        case "block_rules":
                            const blockRulesRet = this.parseBlockRulesSection(s);
                            virtualBlockRules.push(...blockRulesRet.rules);
                            virtualRuleSets = { ...virtualRuleSets, ...blockRulesRet.selectedRuleSets };;
                            break;
                        case "direct_rules":
                            const directRulesRet = this.parseDirectRulesSection(s);
                            virtualDirectRules.push(...directRulesRet.rules);
                            //virtualRuleSets ={ ...virtualRuleSets, ...blockRulesRet.selectedRuleSets}; ;
                            break;
                        case "final_rules":
                            const finalRulesRet = this.parseFinalRulesSection(s);
                            virtualFinalRules.push(...finalRulesRet.rules);
                            break;
                    }
                }

                console.log(virtualRules);
                console.log(virtualBlockRules);
                console.log(common.objToYaml(virtualProxies, 1));
                console.log(common.objToYaml(virtualProxyGroups, 1));
                console.log(common.objToYaml(virtualRuleSets, 1));
                const compiledRules = common.objToYaml([...virtualDirectRules, ...virtualBlockRules, ...virtualRules, ...virtualFinalRules]);

                uci.set(common.binName, "compiled", "rules", compiledRules);
                uci.set(common.binName, "compiled", "proxies", common.objToYaml(virtualProxies, 1));
                uci.set(common.binName, "compiled", "proxy_groups", common.objToYaml(virtualProxyGroups, 1));
                uci.set(common.binName, "compiled", "rule_providers", common.objToYaml(virtualRuleSets, 1));

                console.log(uci.sections(common.binName));
                uci.save(common.binName).then(() => {
                    console.log(uci.sections(common.binName));
                    rpc.call("uci", "commit", { config: common.binName });
                }).then(() => { ui.changes.apply(false); });
            });
        });
    },
    render() {
        let m, s, s2, s3, s4, s5, o;

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
        o.validate = function (section_id, value) {
            return (common.isValidProxyLink(value)) ? true : _("Invalid link.");
        };

        o = s.option(form.MultiValue, "enabled_list", _("Use with rules:"));
        rulesets.availableRuleSets.forEach(item => {
            o.value(item.yamlName, _(`${item.name}`));
        });
        o.description = _("Predefined RULE-SET lists, select those which you want to route through proxy. Leave empty if you will use proxy with proxy-groups.");
        o.optional = true;

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
            if (!value) return _("Field must not be empty");

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
        o.default = common.defaultProxyGroupInterval;
        o.rmempty = false;

        o = s2.option(form.MultiValue, "enabled_list", _("Use with rules:"));
        rulesets.availableRuleSets.forEach(item => {
            o.value(item.yamlName, _(`${item.name}`));
        });
        o.description = _("Predefined RULE-SET lists, select ones which you want to route through proxy. Leave empty if you will use proxy with proxy-groups.");

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

        o = s4.option(form.MultiValue, "enabled_blocklist ", _("REJECT RULE_SET:"));
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
        o.default = "DIRECT";
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