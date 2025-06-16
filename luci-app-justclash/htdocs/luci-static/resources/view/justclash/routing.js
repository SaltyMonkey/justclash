"use strict";
"require ui";
"require view";
"require uci";
"require view.justclash.common as common";
"require view.justclash.rulesets as rulesets";
"require form";
"require rpc";

return view.extend({
    load: function () {
        return Promise.all([
            uci.load(common.binName),
        ]).catch(e => {
            ui.addNotification(null, E("p", _("Unable to read the contents") + ": %s ".format(e.message)));
        });
    },
    handleSaveApply: function (ev) {
        return this.handleSave(ev).then(() => {
            return uci.load(common.binName).then(() => {
                const allSections = uci.sections(common.binName);

                let virtualRuleSets = {};
                let virtualProxies = [];
                let virtualProxyGroups = [];
                let virtualRules = "";
                let virtualBlockRules = "";
                let addedProxyNames = [];

                for (const s of allSections) {
                    const type = s[".type"];
                    const name = s.name.trim();
                    switch (type) {
                        case "proxies":
                            const link = s.proxy_link.trim();;

                            let obj = null;
                            if (link) {
                                try {
                                    obj = common.parseProxyLink(link);
                                    obj.name = name;
                                    virtualProxies.push(obj);
                                    addedProxyNames.push(name);
                                } catch (e) {
                                    console.error(_("Cannot parse proxy URI:"), e);
                                }
                            }
                            if (obj) {
                                const selectedRuleSetsNames = common.valueToArray(s.enabled_list);
                                const domainRoutes = common.valueToArray(s.additional_domain_route);
                                const destipRoutes = common.valueToArray(s.additional_destip_route);
                                selectedRuleSetsNames.forEach(ruleset => {
                                    const rs = rulesets.availableRuleSets.find(x => ruleset === x.yamlName);
                                    if (rs) {
                                        let copy = Object.assign({}, rs);
                                        const yamlName = copy.yamlName;
                                        delete copy.name;
                                        delete copy.yamlName;
                                        virtualRuleSets[yamlName] = copy;

                                        virtualRules += ` - RULE-SET,${yamlName},${name}\n`;
                                    }
                                });
                                domainRoutes.forEach(domain => {
                                    virtualRules += ` - DOMAIN-SUFFIX,${domain},${name}\n`;
                                });
                                destipRoutes.forEach(cidr => {
                                    virtualRules += ` - IP-CIDR,${cidr},${name}\n`;
                                });
                            }
                            break;

                        case "proxy_group":
                            let proxyList = null;
                            if (s.proxies_list) proxyList = common.splitAndTrimString(s.proxies_list, ",");
                            if (proxyList && proxyList.length > 1) {
                                virtualProxyGroups.push({
                                    name,
                                    type: s.group_type,
                                    strategy: s.strategy,
                                    url: s.check_url,
                                    interval: s.interval,
                                    timeout: 5000,
                                    proxies: proxyList,
                                    lazy: false
                                });
                                const selectedRuleSetsNames = common.valueToArray(s.enabled_list);
                                const domainRoutes = common.valueToArray(s.additional_domain_route);
                                const destipRoutes = common.valueToArray(s.additional_destip_route);
                                selectedRuleSetsNames.forEach(ruleset => {
                                    const rs = rulesets.availableRuleSets.find(x => ruleset === x.yamlName);
                                    if (rs) {
                                        let copy = Object.assign({}, rs);
                                        const yamlName = copy.yamlName;
                                        delete copy.name;
                                        delete copy.yamlName;
                                        virtualRuleSets[yamlName] = copy;

                                        virtualRules += ` - RULE-SET,${yamlName},${name}\n`;
                                    }
                                });
                                domainRoutes.forEach(domain => {
                                    virtualRules += ` - DOMAIN-SUFFIX,${domain},${name}\n`;
                                });

                                destipRoutes.forEach(cidr => {
                                    virtualRules += ` - IP-CIDR,${cidr},${name}\n`;
                                });
                            }
                            break;
                        case "block_rules":
                            const selectedBlockRuleSetsNames = common.valueToArray(s.enabled_blocklist);
                            const domainBlockRoutes = common.valueToArray(s.additional_domain_blockroute);
                            const destipBlockRoutes = common.valueToArray(s.additional_destip_blockroute);
                            const disableQuick = s.disable_quic;
                            selectedBlockRuleSetsNames.forEach(ruleset => {
                                const rs = rulesets.availableBlockRulesets.find(x => ruleset === x.yamlName);
                                if (rs) {
                                    let copy = Object.assign({}, rs);
                                    const yamlName = copy.yamlName;
                                    delete copy.name;
                                    delete copy.yamlName;
                                    virtualRuleSets[yamlName] = copy;

                                    virtualBlockRules += ` - RULE-SET,${yamlName},REJECT\n`;
                                }
                            });
                            domainBlockRoutes.forEach(domain => {
                                virtualBlockRules += ` - DOMAIN-SUFFIX,${domain},REJECT\n`;
                            });

                            destipBlockRoutes.forEach(cidr => {
                                virtualBlockRules += ` - IP-CIDR,${cidr},REJECT\n`;
                            });
                            break;
                        default:
                            // Handle unknown types if needed
                            break;
                    }
                }

                console.log(virtualRules);
                console.log(virtualBlockRules);
                console.log(common.objToYaml(virtualProxies, 1));
                console.log(common.objToYaml(virtualProxyGroups, 1));
                console.log(common.objToYaml(virtualRuleSets, 1));

                uci.set(common.binName, "compiled", "rules", `${virtualBlockRules}${virtualRules}`);
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
        let m, s, s2, s3, o;

        m = new form.Map(common.binName);
        s = m.section(form.TypedSection, "proxies", _("Proxies"), _("Proxies defined as outbounds"));
        s.anonymous = true;
        s.addremove = true;

        o = s.option(form.Value, "name", _("Name:"));
        o.description = _("Proxy name.");
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

        o = s.option(form.Value, "proxy_link", _("Proxy URI:"));
        o.description = _("URI link with proxy data.");
        o.password = true;
        o.validate = function (section_id, value) {
            return (common.isValidProxyLink(value)) ? true : _("Invalid link.");
        };

        o = s.option(form.MultiValue, "enabled_list", _("Use for rules:"));
        rulesets.availableRuleSets.forEach(item => {
            o.value(item.yamlName, _(`${item.name}`));
        });
        o.optional = true;

        o = s.option(form.DynamicList, "additional_domain_route", _("Manual DOMAIN-SUFFIX rules:"));
        o.description = _("One element is one DOMAIN-SUFFIX rule with mihomo syntax.");
        o.optional = true;

        o = s.option(form.DynamicList, "additional_destip_route", _("Manual IP-CIDR rules:"));
        o.description = _("One element is one IP-CIDR rule with mihomo syntax. IPV4 only right now.");
        o.optional = true;
        o.datatype = "cidr4";

        s2 = m.section(form.TypedSection, "proxy_group", _("Proxy groups:"), _("Proxy groups for defined proxies"));
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

        o = s2.option(form.Value, "check_url", _("Check URL:"));
        o.placeholder = common.defaultProxyGroupCheckUrl;
        o.default = common.defaultProxyGroupCheckUrl;
        o.rmempty = false;
        o.validate = function (section_id, value) {
            return (common.isValidHttpUrl(value)) ? true : _("Only http:// or https:// URLs are allowed.");
        };

        o = s2.option(form.Value, "interval", _("Check interval:"));
        o.datatype = "uinteger";
        o.default = common.defaultProxyGroupInterval;
        o.rmempty = false;

        o = s2.option(form.MultiValue, "enabled_list", _("Use for rules:"));
        rulesets.availableRuleSets.forEach(item => {
            o.value(item.yamlName, _(`${item.name}`));
        });

        o = s2.option(form.DynamicList, "additional_domain_route", _("Manual DOMAIN-SUFFIX rules:"));
        o.description = _("One element is one DOMAIN-SUFFIX rule with mihomo syntax.");
        o.optional = true;
        o.editable = true;

        o = s2.option(form.DynamicList, "additional_destip_route", _("Manual IP-CIDR rules:"));
        o.description = _("One element is one IP-CIDR rule with mihomo syntax. IPV4 only right now.");
        o.optional = true;
        o.editable = true;
        o.datatype = "cidr4";

        s3 = m.section(form.NamedSection, "block_rules", _("REJECT rules"), _("Additional rules for REJECT rules. Will be handled first."));
        s3.addremove = false;

        o = s3.option(form.Flag, "disable_quic", _("Disable QUIC:"));
        //o.description = _("disable_quic_description.");
        o.default = "0";

        o = s3.option(form.MultiValue, "enabled_blocklist ", _("Use blocklists:"));
        rulesets.availableBlockRulesets.forEach(item => {
            o.value(item.yamlName, _(`${item.name}`));
        });

        o = s3.option(form.DynamicList, "additional_domain_blockroute", _("Manual DOMAIN-SUFFIX block rules:"));
        o.description = _("One element is one DOMAIN-SUFFIX rule with mihomo syntax.");
        o.optional = true;
        o.editable = true;

        o = s3.option(form.DynamicList, "additional_destip_blockroute", _("Manual IP-CIDR block rules:"));
        o.description = _("One element is one IP-CIDR rule with mihomo syntax. IPV4 only right now.");
        o.optional = true;
        o.editable = true;
        o.datatype = "cidr4";

        return m.render().then(formEl => {
            return E("div", {}, [
                this.addCSS(),
                formEl
            ]);
        });
    },
    addCSS() {
        return E("style", {}, `
        `);
    },
    destroy() {

    }
});