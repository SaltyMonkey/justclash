"use strict";
"require ui";
"require view";
"require uci";
"require view.justclash.common as common";
"require form";
"require rpc";
"require fs";

return view.extend({
    async load() {
        const [
            rulesetsFile, blockRulesetsFile
        ] = await Promise.all([
            fs.read(common.rulesetsFilePath),
            fs.read(common.blockRulesetsFilePath),
        ]);
        const rulesetsLines = rulesetsFile.split('\n');

        const rulesetsItems = rulesetsLines
            .filter(line => line.trim() && !line.trim().startsWith('#'))
            .map(line => {
                const [name, yamlName] = line.split('|');
                return { name, yamlName };
            });

        const blockRulesetsLines = blockRulesetsFile.split('\n');

        const blockRulesetsItems = blockRulesetsLines
            .filter(line => line.trim() && !line.trim().startsWith('#'))
            .map(line => {
                const [name, yamlName] = line.split('|');
                return { name, yamlName };
            });

        return {
            rulesetsItems, blockRulesetsItems
        };
    },
    render(result) {
        let m, s, s2, spp, s3, s4, s5, o, tabname;

        m = new form.Map(common.binName);
        s = m.section(form.TypedSection, "proxies", _("Proxies list:"), _("Proxies defined as outbound connections."));
        s.anonymous = true;
        s.addremove = true;

        tabname = "proxiesbasic_tab";
        s.tab(tabname, _("Basic"));

        o = s.taboption(tabname, form.Value, "name", _("Name:"));
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

        o = s.taboption(tabname, form.Flag, "defined_as_custom_object", _("Object mode:"));
        o.description = _("If selected, allow to define proxy as JSON object.");
        o.rmempty = false;
        o.default = "0";

        o = s.taboption(tabname, form.TextValue, "proxy_link_object", _("JSON object:"));
        o.description = _("JSON object with connection parameters.");
        o.rows = 10;
        o.optional = true;
        o.depends("defined_as_custom_object", "1");
        o.validate = function (section_id, value) {
            //if (!value || value.length === 0) return true;
            try {
                const parsed = JSON.parse(value);
                if (!parsed.type || !parsed.server || !parsed.port) {
                    return _('JSON must contain at least type, server and server fields');
                }
                return true;
            } catch (e) {
                return _('Invalid JSON format');
            }
        };

        o = s.taboption(tabname, form.Value, "proxy_link", _("URI mode:"));
        o.description = _("URI link with connection parameters.");
        o.password = true;
        o.optional = true;
        o.validate = function (section_id, value) {
            return (common.isValidProxyLink(value)) ? true : _("Invalid link.");
        };
        o.depends("defined_as_custom_object", "0");

        tabname = "proxieslists_tab";
        s.tab(tabname, _("Rules"));

        o = s.taboption(tabname, form.MultiValue, "enabled_list", _("Use with rules:"));
        result.rulesetsItems.forEach(item => {
            o.value(item.yamlName, _(`${item.name}`));
        });
        o.description = _("Predefined RULE-SET lists, select those which you want to route through proxy. Leave empty if you will use proxy with proxy-groups.");

        o = s.taboption(tabname, form.Flag, "use_proxy_for_list_update", _("Get lists through proxy:"));
        o.description = _("If selected, RULE-SET lists will be updated through proxy.");
        o.optional = true;
        o.default = "0";

        o = s.taboption(tabname, form.Value, "list_update_interval", _("List update interval:"));
        o.datatype = "uinteger";
        o.default = common.defaultRuleSetUpdateInterval;
        o.placeholder = common.defaultRuleSetUpdateInterval;
        o.optional = true;
        o.validate = function (section_id, value) {
            if (value === "") return true;
            let v = parseInt(value);
            if (isNaN(v) || v < common.minimalRuleSetUpdateInterval) {
                return _(`Value must be above ${common.minimalRuleSetUpdateInterval}secs.`);
            }
            return true;
        };

        /*o = s.taboption(tabname, form.DynamicList, "user_list", _("User with custom rules:"));
        o.description = _("Custom RULE-SET list paths placed locally, use complete filesystem path here. Example: /etc/customlist.mrs");
        o.editable = true;*/

        tabname = "proxiesmanualrules_tab";
        s.tab(tabname, _("Manual"));

        o = s.taboption(tabname, form.DynamicList, "additional_domain_route", _("Domain suffix:"));
        o.description = _("Each element is a DOMAIN-SUFFIX rule to route through proxy (Example: google.com).");
        o.optional = true;
        o.placeholder = "domain.tld";
        o.validate = function (section_id, value) {
            return (common.isValidDomainSuffix(value));
        };

        o = s.taboption(tabname, form.DynamicList, "additional_destip_route", _("IPv4 CIDR:"));
        o.description = _("Each element is an IP-CIDR rule to route through proxy (Example: 1.1.1.1/32). IPv4 only right now.");
        o.placeholder = "8.8.8.8/32";
        o.optional = true;
        o.datatype = "cidr4";

        o = s.taboption(tabname, form.DynamicList, "additional_srcip_route", _("Source IPv4 CIDR:"));
        o.description = _("Each element is an SRC-IP-CIDR rule to route through proxy (Example: 192.168.31.212/32). IPv4 only right now.");
        o.placeholder = "192.168.31.212/32";
        o.optional = true;
        o.editable = true;
        o.datatype = "cidr4";

        spp = m.section(form.TypedSection, "proxy_provider", _("Proxy provider:"), _("Proxy providers are external subscription URLs that dynamically load a list of proxies. "));
        spp.anonymous = true;
        spp.addremove = true;

        tabname = "proxyprovidersbasic_tab";
        spp.tab(tabname, _("Basic"));

        o = spp.taboption(tabname, form.Value, "name", _("Name:"));
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

        o = spp.taboption(tabname, form.Value, "subscription", _("Subscription URL:"));
        o.placeholder = "https://yourSubscriptionUrl";
        o.rmempty = false;
        o.validate = function (section_id, value) {
            return (common.isValidHttpUrl(value)) ? true : _("Only http:// or https:// URLs are allowed.");
        };
        o.description = _("Your complete subscription URL with http:// or https://.");

        o = spp.taboption(tabname, form.Value, "update_interval", _("Update interval:"));
        o.rmempty = false;
        o.datatype = "uinteger";
        o.placeholder = common.defaultProxyProviderIntervalSec;
        o.default = common.defaultProxyProviderIntervalSec;
        o.description = _("Time interval for subscription update check.");

        tabname = "proxyproviderhelthchk_tab";
        spp.tab(tabname, _("Health check"));

        o = spp.taboption(tabname, form.Flag, "health_check", _("Health check:"));
        o.default = "1";
        o.rmempty = false;

        o = spp.taboption(tabname, form.Value, "health_check_url", _("Check URL:"));
        o.placeholder = common.defaultProxyGroupCheckUrl;
        o.default = common.defaultProxyGroupCheckUrl;
        o.rmempty = false;
        o.validate = function (section_id, value) {
            return (common.isValidHttpUrl(value)) ? true : _("Only http:// or https:// URLs are allowed.");
        };
        o.description = _("URL for node availability check (required for proxy provider functionality).");
        o.depends("health_check", "1");

        o = spp.taboption(tabname, form.Value, "health_check_expected_status", _("Check status:"));
        o.rmempty = false;
        o.datatype = "uinteger";
        o.placeholder = common.defaultHealthCheckResult;
        o.default = common.defaultHealthCheckResult;
        o.depends("health_check", "1");
        o.description = _("Required response status for node availability check (required for proxy provider functionality).");

        o = spp.taboption(tabname, form.Value, "health_check_interval", _("Check interval:"));
        o.datatype = "uinteger";
        o.placeholder = common.defaultProxyProviderHealthCheckSec;
        o.default = common.defaultProxyProviderHealthCheckSec;
        o.depends("health_check", "1");
        o.description = _("Time interval between health checks in seconds.");

        o = spp.taboption(tabname, form.Value, "health_check_timeout", _("Check timeout:"));
        o.datatype = "uinteger";
        o.default = common.defaultHealthCheckTimeoutMs;
        o.depends("health_check", "1");
        o.description = _("Timeout for each individual health check in milliseconds.");

        tabname = "proxyproviderfilter_tab";
        spp.tab(tabname, _("Filters"));

        o = spp.taboption(tabname, form.Value, "filter", _("Filter:"));
        o.description = _("Filter nodes that contain keywords or match regular expressions. Multiple patterns can be separated with | (pipe).");
        o.optional = true;
        o.rmempty = true;
        o.placeholder = "HK|US|(?i)Netflix";
        o.validate = function (section_id, value) {
            return common.isValidKeywordOrRegexList(value, "filter");
        };

        o = spp.taboption(tabname, form.Value, "exclude_filter", _("Exclude filter:"));
        o.description = _("Exclude nodes that match keywords or regular expressions. Multiple patterns can be separated with | (pipe).");
        o.optional = true;
        o.rmempty = true;
        o.placeholder = "CN|(?i)douyin";
        o.validate = function (section_id, value) {
            return common.isValidKeywordOrRegexList(value, "exclude_filter");
        };

        o = spp.taboption(tabname, form.Value, "exclude_type", _("Exclude type:"));
        o.description = _("Exclude type filter.");
        o.placeholder = "vless|vmess|ss";
        o.optional = true;
        o.rmempty = true;
        o.validate = function (section_id, value) {
            if (!value) return true;
            const regex = /^[a-z0-9|]+$/;
            if (!regex.test(value)) {
                return _("Only lowercase letters, digits, and the '|' separator are allowed. No spaces or special symbols.");
            }

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

        s2 = m.section(form.TypedSection, "proxy_group", _("Proxy groups:"), _("Group proxies for special routing (fallback, load balancing)."));
        s2.anonymous = true;
        s2.addremove = true;

        tabname = "proxygroupsbasic_tab";
        s2.tab(tabname, _("Basic"));

        o = s2.taboption(tabname, form.Value, "name", _("Name:"));
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

        o = s2.taboption(tabname, form.ListValue, "group_type", _("Group type:"));
        common.defaultProxyGroupsTypes.forEach(item => {
            o.value(item, _(`${item}`));
        });
        o.rmempty = false;
        o.default = common.defaultProxyGroupsTypes[0];

        o = s2.taboption(tabname, form.ListValue, "strategy", _("Group strategy:"));
        common.defaultProxyGroupsBalanceModeStrategies.forEach(item => {
            o.value(item, _(`${item}`));
        });
        o.default = common.defaultProxyGroupsBalanceModeStrategies[0];
        o.depends("group_type", "load-balancer");

        o = s2.taboption(tabname, form.DynamicList, "proxies", _("Proxies:"));
        o.placeholder = "proxy-name";
        o.optional = true;
        o.editable = true;
        o.validate = function (section_id, value) {
            return (common.isValidSimpleName(value)) ? true : _("Name must contain only lowercase letters, digits, and underscores");
        };

        o = s2.taboption(tabname, form.DynamicList, "providers", _("Providers:"));
        o.placeholder = "provider-name";
        o.optional = true;
        o.editable = true;
        o.validate = function (section_id, value) {
            return (common.isValidSimpleName(value)) ? true : _("Name must contain only lowercase letters, digits, and underscores");
        };

        tabname = "proxygrouphelthchk_tab";
        s2.tab(tabname, _("Health check"));

        o = s2.taboption(tabname, form.Value, "check_url", _("Check URL:"));
        o.placeholder = common.defaultProxyGroupCheckUrl;
        o.default = common.defaultProxyGroupCheckUrl;
        o.rmempty = false;
        o.validate = function (section_id, value) {
            return (common.isValidHttpUrl(value)) ? true : _("Only http:// or https:// URLs are allowed.");
        };
        o.description = _("URL for node availability check (required for proxy group functionality).");

        o = s2.taboption(tabname, form.Value, "expected_status", _("Check status:"));
        o.placeholder = common.defaultHealthCheckResult;
        o.default = common.defaultHealthCheckResult;
        o.datatype = "uinteger";
        o.rmempty = false;
        o.description = _("Required response status for node availability check (required for proxy group functionality).");

        o = s2.taboption(tabname, form.Value, "check_interval", _("Check interval:"));
        o.datatype = "uinteger";
        o.placeholder = common.defaultProxyGroupIntervalSec;
        o.default = common.defaultProxyGroupIntervalSec;
        o.description = _("Time interval between health checks in seconds.");

        o = s2.taboption(tabname, form.Value, "tolerance", _("Tolerance:"));
        o.datatype = "uinteger";
        o.default = common.defaultUrlTestTolerance;
        o.description = _("Proxies switch tolerance, measured in milliseconds (ms).");
        o.depends("group_type", "url-test");

        o = s2.taboption(tabname, form.Value, "check_timeout", _("Check timeout:"));
        o.datatype = "uinteger";
        o.default = common.defaultHealthCheckTimeoutMs;
        o.description = _("Timeout for each individual health check in milliseconds.");

        tabname = "proxiesgroupfilter_tab";
        s2.tab(tabname, _("Filters"));

        o = s2.taboption(tabname, form.Value, "filter", _("Filter:"));
        o.description = _("Filter nodes that contain keywords or match regular expressions. Multiple patterns can be separated with | (pipe).");
        o.optional = true;
        o.rmempty = true;
        o.placeholder = "HK|US|(?i)Netflix";
        o.validate = function (section_id, value) {
            return common.isValidKeywordOrRegexList(value, "filter");
        };

        o = s2.taboption(tabname, form.Value, "exclude_filter", _("Exclude filter:"));
        o.description = _("Exclude nodes that match keywords or regular expressions. Multiple patterns can be separated with | (pipe).");
        o.optional = true;
        o.rmempty = true;
        o.placeholder = "CN|(?i)douyin";
        o.validate = function (section_id, value) {
            return common.isValidKeywordOrRegexList(value, "exclude_filter");
        };

        o = s2.taboption(tabname, form.Value, "exclude_type", _("Exclude type:"));
        o.description = _("Exclude type filter.");
        o.placeholder = "vless|vmess|ss";
        o.optional = true;
        o.rmempty = true;
        o.validate = function (section_id, value) {
            if (!value) return true;
            const regex = /^[a-z0-9|]+$/;
            if (!regex.test(value)) {
                return _("Only lowercase letters, digits, and the '|' separator are allowed. No spaces or special symbols.");
            }

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

        tabname = "proxiesgrouplist_tab";
        s2.tab(tabname, _("Rules"));

        o = s2.taboption(tabname, form.MultiValue, "enabled_list", _("Use with rules:"));
        result.rulesetsItems.forEach(item => {
            o.value(item.yamlName, _(`${item.name}`));
        });
        o.description = _("Predefined RULE-SET lists, select those which you want to route through proxy-group.");

        o = s2.taboption(tabname, form.Flag, "use_proxy_group_for_list_update", _("Get lists through proxy:"));
        o.description = _("If selected, RULE-SET lists will be updated through proxy group.");
        o.optional = true;
        o.default = "0";

        o = s2.taboption(tabname, form.Value, "list_update_interval", _("List update interval:"));
        o.datatype = "uinteger";
        o.placeholder = common.defaultRuleSetUpdateInterval;
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

        /*o = s2.taboption(tabname, form.DynamicList, "user_list", _("User with custom rules:"));
        o.description = _("Custom RULE-SET list paths placed locally, use complete filesystem path here. Example: /etc/customlist.mrs");
        o.editable = true;*/

        tabname = "proxiesgroupmanualrules_tab";
        s2.tab(tabname, _("Manual"));

        o = s2.taboption(tabname, form.DynamicList, "additional_domain_route", _("Domain suffix:"));
        o.description = _("Each element is a DOMAIN-SUFFIX rule to route through proxy group (Example: google.com).");
        o.optional = true;
        o.placeholder = "domain.tld";
        o.editable = true;
        o.validate = function (section_id, value) {
            return (common.isValidDomainSuffix(value));
        };

        o = s2.taboption(tabname, form.DynamicList, "additional_destip_route", _("IPv4 CIDR:"));
        o.description = _("Each element is an IP-CIDR rule to route through proxy group (Example: 1.1.1.1/32). IPv4 only right now.");
        o.placeholder = "8.8.8.8/32";
        o.optional = true;
        o.editable = true;
        o.datatype = "cidr4";

        o = s2.taboption(tabname, form.DynamicList, "additional_srcip_route", _("Source IPv4 CIDR:"));
        o.description = _("Each element is an SRC-IP-CIDR rule to route through proxy group (Example: 192.168.31.212/32). IPv4 only right now.");
        o.placeholder = "192.168.31.212/32";
        o.optional = true;
        o.editable = true;
        o.datatype = "cidr4";

        s3 = m.section(form.NamedSection, "direct_rules", "direct_rules", _("DIRECT rules:"), _("Additional settings for DIRECT rules. Will be handled before proxies, proxy groups and REJECT rules."));
        s3.addremove = false;

        tabname = "directbasic_tab";
        s3.tab(tabname, _("Basic"));

        o = s3.taboption(tabname, form.DynamicList, "additional_domain_direct", _("Domain suffix:"));
        o.description = _("Each element is a DOMAIN-SUFFIX rule to pass in DIRECT (Example: google.com).");
        o.placeholder = "domain.tld";
        o.optional = true;
        o.editable = true;
        o.validate = function (section_id, value) {
            return (common.isValidDomainSuffix(value));
        };

        o = s3.taboption(tabname, form.DynamicList, "additional_domain_keyword_direct", _("Domain keyword:"));
        o.description = _("Each element is one DOMAIN-KEYWORD rule to pass in DIRECT (Example: google).");
        o.placeholder = "google";
        o.optional = true;
        o.editable = true;
        o.validate = function (section_id, value) {
            return (common.isValidDomainKeyword(value));
        };

        o = s3.taboption(tabname, form.DynamicList, "additional_domain_regexp_direct", _("Domain regex:"));
        o.description = _("Each element is a DOMAIN-REGEX rule to pass in DIRECT (Example: ^abc.*com).");
        o.placeholder = "^abc.*com";
        o.optional = true;
        o.editable = true;
        o.validate = function (section_id, value) {
            return (common.isValidDomainRegexp(value));
        };

        o = s3.taboption(tabname, form.DynamicList, "additional_srcip_direct", _("Source IPv4 CIDR:"));
        o.description = _("Each element is one SRC-IP-CIDR rule to pass in DIRECT (Example: 192.168.31.212/32). IPV4 only right now.");
        o.placeholder = "192.168.31.212/32";
        o.optional = true;
        o.editable = true;
        o.datatype = "cidr4";

        o = s3.taboption(tabname, form.DynamicList, "additional_destip_direct", _("IPv4 CIDR:"));
        o.description = _("Each element is one IP-CIDR rule to pass in DIRECT (Example: 1.1.1.1/32). IPV4 only right now.");
        o.placeholder = "8.8.8.8/32";
        o.optional = true;
        o.editable = true;
        o.datatype = "cidr4";

        tabname = "directruleslist_tab";
        s3.tab(tabname, _("Rules"));

        o = s3.taboption(tabname, form.MultiValue, "enabled_list", _("Use with rules:"));
        result.rulesetsItems.forEach(item => {
            o.value(item.yamlName, _(`${item.name}`));
        });
        o.description = _("Predefined RULE-SET lists, select those which you want to route through DIRECT.");

        o = s3.taboption(tabname, form.Value, "list_update_interval", _("List update interval:"));
        o.datatype = "uinteger";
        o.placeholder = common.defaultRuleSetUpdateInterval;
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

        s4 = m.section(form.NamedSection, "block_rules", "block_rules", _("REJECT rules:"), _("Additional rules for REJECT rules. Will be handled before proxies and proxy groups."));
        s4.addremove = false;

        tabname = "rejectrules_tab";
        s4.tab(tabname, _("Rules"));

        o = s4.taboption(tabname, form.MultiValue, "enabled_blocklist", _("Use with rules:"));
        result.blockRulesetsItems.forEach(item => {
            o.value(item.yamlName, _(`${item.name}`));
        });
        o.description = _("Predefined RULE-SET lists with ads/badware. Select those you want to block with the proxy. Leave empty if you don't want to block anything.");

        /*o = s2.taboption(tabname, form.DynamicList, "user_list", _("User with custom rules:"));
        o.description = _("Custom RULE-SET list paths placed locally, use complete filesystem path here. Example: /etc/custom_blocklist.mrs");
        o.editable = true;*/

        tabname = "rejectmanualrules_tab";
        s4.tab(tabname, _("Manual"));

        o = s4.taboption(tabname, form.DynamicList, "additional_domain_blockroute", _("Domain suffix:"));
        o.description = _("Each element is a DOMAIN-SUFFIX rule to block with proxy (Example: google.com).");
        o.optional = true;
        o.placeholder = "domain.tld";
        o.editable = true;
        o.validate = function (section_id, value) {
            return (common.isValidDomainSuffix(value));
        };

        o = s4.taboption(tabname, form.DynamicList, "additional_destip_blockroute", _("IPv4 CIDR:"));
        o.description = _("Each element is an IP-CIDR rule to block with proxy (Example: 1.1.1.1/32). IPv4 only right now.");
        o.placeholder = "8.8.8.8/32";
        o.optional = true;
        o.editable = true;
        o.datatype = "cidr4";

        s5 = m.section(form.NamedSection, "final_rules", "final_rules", _("FINAL rule:"), _("Additional settings for the final rules applied after all others. Use it to override or enforce specific behaviors."));
        s5.addremove = false;

        tabname = "finalbasic_tab";
        s5.tab(tabname, _("Basic"));

        o = s5.taboption(tabname, form.Value, "final_destination", _("Destination:"));
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
            ul.dropdown {
                height: 315px;
            }
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