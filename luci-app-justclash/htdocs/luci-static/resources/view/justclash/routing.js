"use strict";
"require view";
//"require uci";
"require view.justclash.common as common";
"require form";
"require fs";

return view.extend({
    async load() {
        const [
            rulesetsFile, blockRulesetsFile
        ] = await Promise.all([
            fs.read(common.rulesetsFilePath),
            fs.read(common.blockRulesetsFilePath),
        ]);
        //ui.addNotification(null, E("p", _("Unable to read the contents") + ": " + (e.message || e)), "error");
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
        let m, s, s2, spp, s3, s4, s5, smp, o, optionFinal, tabname;

        const primitives = {
            TRUE: "1",
            FALSE: "0"
        };

        const datatypes = {
            PORT: "port",
            UINTEGER: "uinteger",
            IPADDR: "ipaddr",
            CIDR4: "cidr4"
        };

        m = new form.Map(common.binName);
        s = m.section(form.TypedSection, "proxies", _("Proxies list:"), _("Proxies defined as outbound connections."));
        s.anonymous = true;
        s.addremove = true;

        tabname = "proxiesbasic_tab";
        s.tab(tabname, _("Basic"));

        o = s.taboption(tabname, form.Value, "name", _("Name:"));
        o.description = _("Proxy name.");
        o.rmempty = false;
        /*o.cfgvalue = function (section_id) {
            const val = uci.get(common.binName, section_id, "name");
            if (val)
                return val;
            return common.generateRandomName(common.genNameProxyPrefix);
        };*/
        o.validate = function (section_id, value) {
            return (common.isValidSimpleName(value)) ? true : _("Name must contain only lowercase letters, digits, and underscores");
        };

        o = s.taboption(tabname, form.ListValue, "mode", _("Mode:"));
        o.description = _("If selected, allow to define proxy as JSON object.");
        common.defaultProxiesModes.forEach(item => {
            o.value(item.value, _(`${item.text}`));
        });
        o.rmempty = false;
        o.default = common.defaultProxiesModes[1].value;

        o = s.taboption(tabname, form.TextValue, "proxy_link_object", _("JSON object:"));
        o.description = _("JSON object with connection parameters.");
        o.rows = 10;
        o.optional = true;
        o.depends("mode", "object");
        o.validate = function (section_id, value) {
            //if (!value || value.length === 0) return true;
            try {
                const parsed = JSON.parse(value);
                if (parsed.name)
                    return _('Name field must not be defined in object.');
                if (parsed.type == "direct" && (parsed.server || parsed.port))
                    return _('DIRECT proxy type must be defined without server or port fields.');
                if (parsed.type == "direct") return true;

                if (!parsed.type || !parsed.server || !parsed.port)
                    return _('JSON must contain at least type, server and server fields.');
                return true;
            } catch {
                return _('Invalid JSON format');
            }
        };

        o = s.taboption(tabname, form.Value, "proxy_link_uri", _("URL mode:"));
        o.description = _("URI link with connection parameters.");
        o.password = true;
        o.optional = true;
        o.placeholder = "vless://uuid@server:port?type=grpc&security=reality";
        o.validate = function (section_id, value) {
            return (common.isValidProxyLink(value));
        };
        o.depends("mode", "uri");

        o = s.taboption(tabname, form.Value, "dialer_proxy", _("Connect through:"));
        o.description = _("Route connections through the specified proxy server, or connect directly if left empty.");
        o.optional = true;
        o.placeholder = "proxyname_";
        o.validate = function (section_id, value) {
            if (value === "" || value === undefined || value === null) {
                return true;
            }
            return (common.isValidSimpleName(value)) ? true : _("Invalid name.");
        };
        o.depends("mode", "uri");

        tabname = "proxieslists_tab";
        s.tab(tabname, _("Rules"));

        o = s.taboption(tabname, form.DynamicList, "enabled_list", _("Use with rules:"));
        result.rulesetsItems.forEach(item => {
            o.value(item.yamlName, _(`${item.name}`));
        });
        o.description = _("Predefined RULE-SET lists, select those which you want to route through proxy. Leave empty if you will use proxy with proxy-groups.");

        o = s.taboption(tabname, form.DynamicList, "custom_enabled_domain_list", _("Use with custom domain list:"));
        o.description = _("Each element is custom rules-provider MRS file from WEB or absolute local file path.");
        o.optional = true;
        o.editable = true;
        o.placeholder = "/etc/justclash/list.mrs";
        o.validate = function (section_id, value) {
            return common.isValidResourceFilePath(value) ? true : _("MRS file is required.");
        };

        o = s.taboption(tabname, form.DynamicList, "custom_enabled_cidr_list", _("Use with custom CIDR list:"));
        o.description = _("Each element is custom rules-provider MRS file from WEB or absolute local file path.");
        o.optional = true;
        o.editable = true;
        o.placeholder = "/etc/justclash/cidr-list.mrs";
        o.validate = function (section_id, value) {
            return common.isValidResourceFilePath(value) ? true : _("MRS file is required.");
        };

        o = s.taboption(tabname, form.Flag, "use_proxy_for_list_update", _("Get lists through proxy:"));
        o.description = _("If selected, RULE-SET lists will be updated through proxy.");
        o.optional = true;
        o.default = primitives.FALSE;

        o = s.taboption(tabname, form.Value, "list_update_interval", _("List update interval:"));
        o.description = _("Interval for updates check in seconds.");
        o.datatype = datatypes.UINTEGER;
        common.defaultRuleSetUpdateInterval.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultRuleSetUpdateInterval[1].value;
        o.optional = true;
        o.validate = function (section_id, value) {
            if (value === "") return true;
            let v = parseInt(value);
            if (isNaN(v) || v < common.minimalRuleSetUpdateInterval) {
                return _(`Value must be above ${common.minimalRuleSetUpdateInterval}secs.`);
            }
            return true;
        };

        tabname = "proxiesmanualrules_tab";
        s.tab(tabname, _("Manual"));

        o = s.taboption(tabname, form.DynamicList, "additional_domain_route", _("Domain suffix:"));
        o.description = _("DOMAIN-SUFFIX rule to route through proxy (Example: google.com).");
        o.optional = true;
        o.placeholder = "domain.tld";
        o.validate = function (section_id, value) {
            return (common.isValidDomainSuffix(value));
        };

        o = s.taboption(tabname, form.DynamicList, "additional_destip_route", _("IPv4 CIDR:"));
        o.description = _("IP-CIDR rule to route through proxy (Example: 1.1.1.1/32). IPv4 only right now.");
        o.placeholder = "8.8.8.8/32";
        o.optional = true;
        o.datatype = datatypes.CIDR4;

        o = s.taboption(tabname, form.DynamicList, "additional_srcip_route", _("Source IPv4 CIDR:"));
        o.description = _("SRC-IP-CIDR rule to route through proxy (Example: 192.168.31.212/32). IPv4 only right now.");
        o.placeholder = "192.168.31.212/32";
        o.optional = true;
        o.editable = true;
        o.datatype = datatypes.CIDR4;

        spp = m.section(form.TypedSection, "proxy_provider", _("Proxy provider:"), _("Proxy providers are external subscription URLs that dynamically load a list of proxies. "));
        spp.anonymous = true;
        spp.addremove = true;

        tabname = "proxyprovidersbasic_tab";
        spp.tab(tabname, _("Basic"));

        o = spp.taboption(tabname, form.Value, "name", _("Name:"));
        o.rmempty = false;
        /*o.cfgvalue = function (section_id) {
            const val = uci.get(common.binName, section_id, "name");
            if (val)
                return val;
            return common.generateRandomName(common.genNameProxyProviderPrefix);
        };*/
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

        o = spp.taboption(tabname, form.Value, "override_dialer_proxy", _("Connect through:"));
        o.description = _("Route connections through the specified proxy server, or connect directly if left empty.");
        o.optional = true;
        o.placeholder = "proxyname_";
        o.validate = function (section_id, value) {
            if (value === "" || value === undefined || value === null) {
                return true;
            }
            return (common.isValidSimpleName(value)) ? true : _("Invalid name.");
        };

        o = spp.taboption(tabname, form.Flag, "subscription_hwid_support", _("HWID support:"));
        o.default = primitives.FALSE;
        o.description = _("Send HWID data to server with proxy provider request.");

        o = spp.taboption(tabname, form.Value, "update_interval", _("Update interval:"));
        o.rmempty = false;
        o.datatype = datatypes.UINTEGER;
        common.defaultProxyProviderUpdateIntervalSec.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultProxyProviderUpdateIntervalSec[1].value;
        o.description = _("Time interval for subscription update check in seconds.");

        o = spp.taboption(tabname, form.Value, "proxy", _("Get subscription with:"));
        o.description = _("Use selected proxy to get subscription data from server.");
        o.value(common.endRuleOptions[0].value, common.endRuleOptions[0].text);
        o.default = common.endRuleOptions[0].value;
        o.rmempty = false;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") {
                return _("This field cannot be empty");
            }
            return true;
        };

        tabname = "proxyproviderhelthchk_tab";
        spp.tab(tabname, _("Health check"));

        o = spp.taboption(tabname, form.Flag, "health_check", _("Health check:"));
        o.default = primitives.TRUE;
        o.rmempty = false;

        o = spp.taboption(tabname, form.Value, "health_check_url", _("Check URL:"));
        common.defaultHealthCheckUrls.forEach(item => {
            o.value(item);
        });
        o.default = common.defaultHealthCheckUrls[0];
        o.rmempty = false;
        o.validate = function (section_id, value) {
            return (common.isValidHttpUrl(value)) ? true : _("Only http:// or https:// URLs are allowed.");
        };
        o.description = _("URL for node availability check (required for proxy provider functionality).");
        o.depends("health_check", primitives.TRUE);

        o = spp.taboption(tabname, form.Value, "health_check_expected_status", _("Check status:"));
        o.rmempty = false;
        o.datatype = datatypes.UINTEGER;
        common.defaultHealthCheckResultCode.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultHealthCheckResultCode[1].value;
        o.depends("health_check", primitives.TRUE);
        o.description = _("Required response status for node availability check (required for proxy provider functionality).");

        o = spp.taboption(tabname, form.Value, "health_check_interval", _("Check interval:"));
        o.datatype = datatypes.UINTEGER;
        common.defaultProxyProviderHealthCheckSec.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultProxyProviderHealthCheckSec[3].value;
        o.depends("health_check", primitives.TRUE);
        o.description = _("Time interval between health checks in seconds.");

        o = spp.taboption(tabname, form.Value, "health_check_timeout", _("Check timeout:"));
        o.datatype = datatypes.UINTEGER;
        common.defaultHealthCheckTimeoutMs.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultHealthCheckTimeoutMs[3].value;
        o.depends("health_check", primitives.TRUE);
        o.description = _("Timeout for each individual health check in milliseconds.");

        o = spp.taboption(tabname, form.Flag, "health_check_lazy", _("Lazy:"));
        o.default = primitives.TRUE;

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
        o.placeholder = "vless|vmess|ss|mieru";
        o.optional = true;
        o.rmempty = true;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") return true;
            const regex = /^[a-z0-9|]+$/;
            if (!regex.test(value)) {
                return _("Only lowercase letters, digits, and the '|' separator are allowed. No spaces or special symbols.");
            }

            const allowedTypes = ["vmess", "vless", "ss", "ssr", "trojan", "hysteria2", "snell", "http", "socks5", "mieru"];
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
        /*o.cfgvalue = function (section_id) {
            const val = uci.get(common.binName, section_id, "name");
            if (val)
                return val;
            return common.generateRandomName(common.genNameProxyGroupPrefix);
        };*/
        o.validate = function (section_id, value) {
            return (common.isValidSimpleName(value)) ? true : _("Name must contain only lowercase letters, digits, and underscores");
        };

        o = s2.taboption(tabname, form.ListValue, "group_type", _("Group type:"));
        common.defaultProxyGroupsTypes.forEach(item => {
            o.value(item.value, _(`${item.text}`));
        });
        o.rmempty = false;
        o.default = common.defaultProxyGroupsTypes[0].value;

        o = s2.taboption(tabname, form.ListValue, "strategy", _("Group strategy:"));
        common.defaultProxyGroupsBalanceModeStrategies.forEach(item => {
            o.value(item.value, _(`${item.text}`));
        });
        o.default = common.defaultProxyGroupsBalanceModeStrategies[0].value;
        o.depends("group_type", "load-balancer");

        o = s2.taboption(tabname, form.DynamicList, "proxies", _("Proxies:"));
        o.placeholder = "proxy-name";
        o.optional = true;
        o.editable = true;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") return true;
            return (common.isValidSimpleName(value)) ? true : _("Name must contain only lowercase letters, digits, and underscores");
        };

        o = s2.taboption(tabname, form.DynamicList, "providers", _("Providers:"));
        o.placeholder = "provider-name";
        o.optional = true;
        o.editable = true;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") return true;
            return (common.isValidSimpleName(value)) ? true : _("Name must contain only lowercase letters, digits, and underscores");
        };

        tabname = "proxygrouphelthchk_tab";
        s2.tab(tabname, _("Health check"));

        o = s2.taboption(tabname, form.Value, "check_url", _("Check URL:"));
        common.defaultHealthCheckUrls.forEach(item => {
            o.value(item);
        });
        o.default = common.defaultHealthCheckUrls[0];
        o.rmempty = false;
        o.validate = function (section_id, value) {
            return (common.isValidHttpUrl(value)) ? true : _("Only http:// or https:// URLs are allowed.");
        };
        o.description = _("URL for node availability check (required for proxy group functionality).");

        o = s2.taboption(tabname, form.Value, "expected_status", _("Check status:"));
        o.placeholder = common.defaultHealthCheckResult;
        o.default = common.defaultHealthCheckResult;
        o.datatype = datatypes.UINTEGER;
        o.rmempty = false;
        o.description = _("Required response status for node availability check (required for proxy group functionality).");

        o = s2.taboption(tabname, form.Value, "check_interval", _("Check interval:"));
        o.datatype = datatypes.UINTEGER;
        common.defaultProxyGroupIntervalSec.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultProxyGroupIntervalSec[2];
        o.description = _("Time interval between health checks in seconds.");

        o = s2.taboption(tabname, form.Value, "tolerance", _("Tolerance:"));
        o.datatype = datatypes.UINTEGER;
        common.defaultUrlTestToleranceMs.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultUrlTestToleranceMs[4].value;
        o.description = _("Proxies switch tolerance, measured in milliseconds (ms).");
        o.depends("group_type", "url-test");

        o = s2.taboption(tabname, form.Value, "check_timeout", _("Check timeout:"));
        o.datatype = datatypes.UINTEGER;
        common.defaultHealthCheckTimeoutMs.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultHealthCheckTimeoutMs[3];
        o.description = _("Timeout for each individual health check in milliseconds.");

        o = s2.taboption(tabname, form.Value, "max_failed_times", _("Max failed times:"));
        o.datatype = datatypes.UINTEGER;
        o.default = '5';
        o.placeholder = '5';
        o.description = _("Timeout for each individual health check in milliseconds.");

        o = s2.taboption(tabname, form.Flag, "lazy", _("Lazy:"));
        o.default = primitives.TRUE;

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
        o.placeholder = "vless|vmess|ss|mieru";
        o.optional = true;
        o.rmempty = true;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") return true;
            const regex = /^[a-z0-9|]+$/;
            if (!regex.test(value)) {
                return _("Only lowercase letters, digits, and the '|' separator are allowed. No spaces or special symbols.");
            }

            const allowedTypes = ["vmess", "vless", "ss", "ssr", "trojan", "hysteria2", "snell", "http", "socks5", "mieru"];
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

        o = s2.taboption(tabname, form.DynamicList, "enabled_list", _("Use with rules:"));
        result.rulesetsItems.forEach(item => {
            o.value(item.yamlName, _(`${item.name}`));
        });
        o.description = _("Predefined RULE-SET lists, select those which you want to route through proxy-group.");

        o = s2.taboption(tabname, form.DynamicList, "custom_enabled_domain_list", _("Use with custom domain list:"));
        o.description = _("Each element is custom rules-provider MRS file from WEB or absolute local file path.");
        o.optional = true;
        o.editable = true;
        o.placeholder = "/etc/justclash/list.mrs";
        o.validate = function (section_id, value) {
            return common.isValidResourceFilePath(value) ? true : _("MRS file is required.");
        };

        o = s2.taboption(tabname, form.DynamicList, "custom_enabled_cidr_list", _("Use with custom CIDR list:"));
        o.description = _("Each element is custom rules-provider MRS file from WEB or absolute local file path.");
        o.optional = true;
        o.editable = true;
        o.placeholder = "/etc/justclash/cidr-list.mrs";
        o.validate = function (section_id, value) {
            return common.isValidResourceFilePath(value) ? true : _("MRS file is required.");
        };

        o = s2.taboption(tabname, form.Flag, "use_proxy_group_for_list_update", _("Get lists through proxy-group:"));
        o.description = _("If selected, RULE-SET lists will be updated through proxy group.");
        o.optional = true;
        o.default = primitives.FALSE;

        o = s2.taboption(tabname, form.Value, "list_update_interval", _("List update interval:"));
        o.description = _("Interval for updates check in seconds.");
        o.datatype = datatypes.UINTEGER;
        common.defaultRuleSetUpdateInterval.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultRuleSetUpdateInterval[1].value;
        o.optional = true;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") return true;
            let v = parseInt(value);
            if (isNaN(v) || v < common.minimalRuleSetUpdateInterval) {
                return _(`Value must be above ${common.minimalRuleSetUpdateInterval}secs.`);
            }
            return true;
        };

        tabname = "proxiesgroupmanualrules_tab";
        s2.tab(tabname, _("Manual"));

        o = s2.taboption(tabname, form.DynamicList, "additional_domain_route", _("Domain suffix:"));
        o.description = _("DOMAIN-SUFFIX rule to route through proxy group (Example: google.com).");
        o.optional = true;
        o.placeholder = "domain.tld";
        o.editable = true;
        o.validate = function (section_id, value) {
            return (common.isValidDomainSuffix(value));
        };

        o = s2.taboption(tabname, form.DynamicList, "additional_destip_route", _("IPv4 CIDR:"));
        o.description = _("IP-CIDR rule to route through proxy group (Example: 1.1.1.1/32). IPv4 only right now.");
        o.placeholder = "8.8.8.8/32";
        o.optional = true;
        o.editable = true;
        o.datatype = datatypes.CIDR4;

        o = s2.taboption(tabname, form.DynamicList, "additional_srcip_route", _("Source IPv4 CIDR:"));
        o.description = _("SRC-IP-CIDR rule to route through proxy group (Example: 192.168.31.212/32). IPv4 only right now.");
        o.placeholder = "192.168.31.212/32";
        o.optional = true;
        o.editable = true;
        o.datatype = datatypes.CIDR4;

        s3 = m.section(form.NamedSection, "direct_rules", "direct_rules", _("DIRECT rules:"), _("Additional settings for DIRECT rules. Will be handled before proxies, proxy groups and REJECT rules."));
        s3.addremove = false;

        tabname = "directruleslist_tab";
        s3.tab(tabname, _("Rules"));

        o = s3.taboption(tabname, form.DynamicList, "enabled_list", _("Use with rules:"));
        o.optional = true;
        result.rulesetsItems.forEach(item => {
            o.value(item.yamlName, _(`${item.name}`));
        });
        o.description = _("Predefined RULE-SET lists, select those which you want to route through DIRECT.");

        o = s3.taboption(tabname, form.DynamicList, "custom_enabled_domain_list", _("Use with custom domain list:"));
        o.description = _("Each element is custom rules-provider MRS file from WEB or absolute local file path.");
        o.optional = true;
        o.editable = true;
        o.placeholder = "/etc/justclash/list.mrs";
        o.validate = function (section_id, value) {
            return common.isValidResourceFilePath(value) ? true : _("MRS file is required.");
        };

        o = s3.taboption(tabname, form.DynamicList, "custom_enabled_cidr_list", _("Use with custom CIDR list:"));
        o.description = _("Each element is custom rules-provider MRS file from WEB or absolute local file path.");
        o.optional = true;
        o.editable = true;
        o.placeholder = "/etc/justclash/cidr-list.mrs";
        o.validate = function (section_id, value) {
            return common.isValidResourceFilePath(value) ? true : _("MRS file is required.");
        };

        o = s3.taboption(tabname, form.Value, "list_update_interval", _("List update interval:"));
        o.description = _("Interval for updates check in seconds.");
        o.datatype = datatypes.UINTEGER;
        o.optional = true;
        common.defaultRuleSetUpdateInterval.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultRuleSetUpdateInterval[1].value;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") return true;
            let v = parseInt(value);
            if (isNaN(v) || v < common.minimalRuleSetUpdateInterval) {
                return _(`Value must be above ${common.minimalRuleSetUpdateInterval}secs.`);
            }
            return true;
        };

        o = s3.taboption(tabname, form.Value, "proxy", _("Get lists with:"));
        o.description = _("Use selected proxy or proxy-group to get lists from server.");
        o.value(common.endRuleOptions[0].value, common.endRuleOptions[0].text);
        o.default = common.endRuleOptions[0].value;
        o.rmempty = false;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") {
                return _("This field cannot be empty");
            }
            return true;
        };

        tabname = "directbasic_tab";
        s3.tab(tabname, _("Manual"));

        o = s3.taboption(tabname, form.DynamicList, "additional_domain_direct", _("Domain suffix:"));
        o.description = _("DOMAIN-SUFFIX rule to pass in DIRECT (Example: google.com).");
        o.placeholder = "domain.tld";
        o.optional = true;
        o.editable = true;
        o.validate = function (section_id, value) {
            return (common.isValidDomainSuffix(value));
        };

        o = s3.taboption(tabname, form.DynamicList, "additional_srcip_direct", _("Source IPv4 CIDR:"));
        o.description = _("SRC-IP-CIDR rule to pass in DIRECT (Example: 192.168.31.212/32). IPV4 only right now.");
        o.placeholder = "192.168.31.212/32";
        o.optional = true;
        o.editable = true;
        o.datatype = datatypes.CIDR4;

        o = s3.taboption(tabname, form.DynamicList, "additional_destip_direct", _("IPv4 CIDR:"));
        o.description = _("IP-CIDR rule to pass in DIRECT (Example: 1.1.1.1/32). IPV4 only right now.");
        o.placeholder = "8.8.8.8/32";
        o.optional = true;
        o.editable = true;
        o.datatype = datatypes.CIDR4;

        s4 = m.section(form.NamedSection, "block_rules", "block_rules", _("REJECT rules:"), _("Additional rules for REJECT rules. Will be handled before proxies and proxy groups."));
        s4.addremove = false;

        tabname = "rejectrules_tab";
        s4.tab(tabname, _("Rules"));

        o = s4.taboption(tabname, form.DynamicList, "enabled_blocklist", _("Use with rules:"));
        result.blockRulesetsItems.forEach(item => {
            o.value(item.yamlName, _(`${item.name}`));
        });
        o.description = _("Predefined RULE-SET lists with ads/badware. Select those you want to block with the proxy. Leave empty if you don't want to block anything.");

        o = s4.taboption(tabname, form.Value, "proxy", _("Get lists with:"));
        o.description = _("Use selected proxy or proxy-group to get lists from server.");
        o.value(common.endRuleOptions[0].value, common.endRuleOptions[0].text);
        o.default = common.endRuleOptions[0].value;
        o.rmempty = false;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") {
                return _("This field cannot be empty");
            }
            return true;
        };

        tabname = "rejectmanualrules_tab";
        s4.tab(tabname, _("Manual"));

        o = s4.taboption(tabname, form.DynamicList, "additional_domain_blockroute", _("Domain suffix:"));
        o.description = _("DOMAIN-SUFFIX rule to block with proxy (Example: google.com).");
        o.optional = true;
        o.placeholder = "domain.tld";
        o.editable = true;
        o.validate = function (section_id, value) {
            return (common.isValidDomainSuffix(value));
        };

        o = s4.taboption(tabname, form.DynamicList, "additional_destip_blockroute", _("IPv4 CIDR:"));
        o.description = _("IP-CIDR rule to block with proxy (Example: 1.1.1.1/32). IPv4 only right now.");
        o.placeholder = "8.8.8.8/32";
        o.optional = true;
        o.editable = true;
        o.datatype = datatypes.CIDR4;

        smp = m.section(form.NamedSection, "mixed_port_rules", "mixed_port_rules", _("Mixed port rule:"), _("Additional settings for the mixed port. Use it to override or enforce specific behavior."));
        smp.addremove = false;

        tabname = "mixedportbasic_tab";
        smp.tab(tabname, _("Basic"));

        o = smp.taboption(tabname, form.Value, "exit_rule", _("Destination:"));
        common.endRuleOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });
        o.default = common.endRuleOptions[1].value;
        o.rmempty = false;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") {
                return _("This field cannot be empty");
            }
            return true;
        };

        s5 = m.section(form.NamedSection, "final_rules", "final_rules", _("Final rule:"), _("Additional settings for the final rules applied after all others. Use it to override or enforce specific behaviors."));
        s5.addremove = false;

        tabname = "finalbasic_tab";
        s5.tab(tabname, _("Basic"));

        optionFinal = s5.taboption(tabname, form.Value, "exit_rule", _("Destination:"));
        optionFinal.value(common.endRuleOptions[0].value, common.endRuleOptions[0].text);
        optionFinal.value(common.endRuleOptions[2].value, common.endRuleOptions[2].text);
        optionFinal.default = common.endRuleOptions[0].value;
        optionFinal.rmempty = false;
        optionFinal.validate = function (section_id, value) {
            if (!value || value.trim() === "") {
                return _("This field cannot be empty");
            }
            return true;
        };

        const style = E("style", {}, `
            ul.dropdown {
                max-height: 320px !important;
            }
            .cbi-value {
                margin-bottom: 14px !important;
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

        return m.render().then(formEl => {
            return E("div", {}, [
                style,
                formEl
            ]);
        });
    }
});