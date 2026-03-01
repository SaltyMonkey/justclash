"use strict";
"require view";
"require uci";
"require view.justclash.common as common";
"require form";
"require fs";

return view.extend({
    async load() {
        let rulesetsItems = [];
        let blockRulesetsItems = [];

        try {
            const rulesetsFile = await fs.read(common.rulesetsFilePath);
            if (rulesetsFile) {
                const rulesetsLines = rulesetsFile.split('\n');
                rulesetsItems = rulesetsLines
                    .filter(line => line.trim() && !line.trim().startsWith('#'))
                    .map(line => {
                        const [name, yamlName] = line.split('|');
                        return { name: name ? name.trim() : null, yamlName: yamlName ? yamlName.trim() : null };
                    })
                    .filter(item => item.name && item.yamlName);
            }
        } catch (e) {
            ui.addNotification(null, E("p", _("Failed to load rulesets") + ": " + (e.message || e)), "error", 3000);
            console.error("Error loading rulesets:", e);
        }

        try {
            const blockRulesetsFile = await fs.read(common.blockRulesetsFilePath);
            if (blockRulesetsFile) {
                const blockRulesetsLines = blockRulesetsFile.split('\n');
                blockRulesetsItems = blockRulesetsLines
                    .filter(line => line.trim() && !line.trim().startsWith('#'))
                    .map(line => {
                        const [name, yamlName] = line.split('|');
                        return { name: name ? name.trim() : null, yamlName: yamlName ? yamlName.trim() : null };
                    })
                    .filter(item => item.name && item.yamlName);
            }
        } catch (e) {
            ui.addNotification(null, E("p", _("Failed to load rulesets") + ": " + (e.message || e)), "error", 3000);
            console.error("Error loading rulesets:", e);
        }

        return {
            rulesetsItems,
            blockRulesetsItems
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
        s.sortable = true;

        tabname = "proxiesbasic_tab";
        s.tab(tabname, _("Basic"));

        o = s.taboption(tabname, form.Flag, "enabled", _("Enabled"));
        o.description = _("Enable or disable this proxy entry without removing it.");
        o.default = o.enabled;
        o.rmempty = false;

        o = s.taboption(tabname, form.Value, "name", _("Name:"));
        o.description = _("Proxy name.");
        o.rmempty = false;
        o.cfgvalue = function (section_id) {
            const val = uci.get(common.binName, section_id, "name");
            if (val)
                return val;
            return common.generateRandomName(common.adjectives, common.nouns);
        };
        o.validate = function (section_id, value) {
            return (common.isValidSimpleName(value)) ? true : _("Name must contain only lowercase letters, digits, and underscores");
        };

        o = s.taboption(tabname, form.ListValue, "mode", _("Mode:"));
        o.description = _("If selected, allow to define proxy as JSON object.");
        common.defaultProxiesModes.forEach(item => {
            o.value(item.value, item.text);
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
        //o.password = true;
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
            o.value(item.yamlName, item.name);
        });
        o.description = _("Predefined RULE-SET lists, select those which you want to route through proxy. Leave empty if you will use proxy with proxy-groups.");

        o = s.taboption(tabname, form.DynamicList, "custom_enabled_domain_list", _("Use with custom domain list:"));
        o.description = _("Each entry can be a web link or an absolute local path to an MRS rules file.");
        o.optional = true;
        o.editable = true;
        o.placeholder = "/etc/justclash/list.mrs";
        o.validate = function (section_id, value) {
            return common.isValidResourceFilePath(value) ? true : _("MRS file is required.");
        };

        o = s.taboption(tabname, form.DynamicList, "custom_enabled_cidr_list", _("Use with custom CIDR list:"));
        o.description = _("Each entry can be a web link or an absolute local path to an MRS rules file.");
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
        o.description = _("How often remote lists should be checked for updates, in seconds.");
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
        s.tab(tabname, _("Custom rules"));

        o = s.taboption(tabname, form.DynamicList, "additional_domain_route", _("Domain suffix:"));
        o.description = _("Traffic to domains matching this suffix will go through this proxy (example: google.com).");
        o.optional = true;
        o.placeholder = "domain.tld";
        o.validate = function (section_id, value) {
            return (common.isValidDomainSuffix(value));
        };

        o = s.taboption(tabname, form.DynamicList, "additional_destip_route", _("IPv4 CIDR:"));
        o.description = _("Traffic to this IPv4 address or subnet will go through this proxy (example: 1.1.1.1/32).");
        o.placeholder = "8.8.8.8/32";
        o.optional = true;
        o.datatype = datatypes.CIDR4;

        o = s.taboption(tabname, form.DynamicList, "additional_srcip_route", _("Source IPv4 CIDR:"));
        o.description = _("Traffic from this local IPv4 address or subnet will go through this proxy (example: 192.168.31.212/32).");
        o.placeholder = "192.168.31.212/32";
        o.optional = true;
        o.editable = true;
        o.datatype = datatypes.CIDR4;

        spp = m.section(form.TypedSection, "proxy_provider", _("Proxy provider:"), _("Proxy providers are external subscription URLs that dynamically load a list of proxies. "));
        spp.anonymous = true;
        spp.addremove = true;
        spp.sortable = true;

        tabname = "proxyprovidersbasic_tab";
        spp.tab(tabname, _("Basic"));

        o = spp.taboption(tabname, form.Flag, "enabled", _("Enabled"));
        o.description = _("Enable or disable this proxy provider without removing it.");
        o.default = o.enabled;
        o.rmempty = false;

        o = spp.taboption(tabname, form.Value, "name", _("Name:"));
        o.rmempty = false;
        o.cfgvalue = function (section_id) {
            const val = uci.get(common.binName, section_id, "name");
            if (val)
                return val;
            return common.generateRandomName(common.adjectives, common.nouns);
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
        s2.sortable = true;

        tabname = "proxygroupsbasic_tab";
        s2.tab(tabname, _("Basic"));

        o = s2.taboption(tabname, form.Flag, "enabled", _("Enabled"));
        o.description = _("Enable or disable this proxy group without removing it.");
        o.default = o.enabled;
        o.rmempty = false;

        o = s2.taboption(tabname, form.Value, "name", _("Name:"));
        o.description = _("Proxy group name.");
        o.rmempty = false;
        o.cfgvalue = function (section_id) {
            const val = uci.get(common.binName, section_id, "name");
            if (val)
                return val;
            return common.generateRandomName(common.adjectives, common.nouns);
        };
        o.validate = function (section_id, value) {
            return (common.isValidSimpleName(value)) ? true : _("Name must contain only lowercase letters, digits, and underscores");
        };

        o = s2.taboption(tabname, form.ListValue, "group_type", _("Group type:"));
        common.defaultProxyGroupsTypes.forEach(item => {
            o.value(item.value, item.text);
        });
        o.rmempty = false;
        o.default = common.defaultProxyGroupsTypes[0].value;

        o = s2.taboption(tabname, form.ListValue, "strategy", _("Group strategy:"));
        common.defaultProxyGroupsBalanceModeStrategies.forEach(item => {
            o.value(item.value, item.text);
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
        common.defaultHealthCheckResultCode.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultHealthCheckResultCode[1].value;
        o.datatype = datatypes.UINTEGER;
        o.rmempty = false;
        o.description = _("Required response status for node availability check (required for proxy group functionality).");

        o = s2.taboption(tabname, form.Value, "check_interval", _("Check interval:"));
        o.datatype = datatypes.UINTEGER;
        common.defaultProxyGroupIntervalSec.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultProxyGroupIntervalSec[2].value;
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
        o.default = common.defaultHealthCheckTimeoutMs[3].value;
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
            o.value(item.yamlName, item.name);
        });
        o.description = _("Predefined RULE-SET lists, select those which you want to route through proxy-group.");

        o = s2.taboption(tabname, form.DynamicList, "custom_enabled_domain_list", _("Use with custom domain list:"));
        o.description = _("Each entry can be a web link or an absolute local path to an MRS rules file.");
        o.optional = true;
        o.editable = true;
        o.placeholder = "/etc/justclash/list.mrs";
        o.validate = function (section_id, value) {
            return common.isValidResourceFilePath(value) ? true : _("MRS file is required.");
        };

        o = s2.taboption(tabname, form.DynamicList, "custom_enabled_cidr_list", _("Use with custom CIDR list:"));
        o.description = _("Each entry can be a web link or an absolute local path to an MRS rules file.");
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
        o.description = _("How often remote lists should be checked for updates, in seconds.");
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
        s2.tab(tabname, _("Custom rules"));

        o = s2.taboption(tabname, form.DynamicList, "additional_domain_route", _("Domain suffix:"));
        o.description = _("Traffic to domains matching this suffix will go through the selected proxy group (example: google.com).");
        o.optional = true;
        o.placeholder = "domain.tld";
        o.editable = true;
        o.validate = function (section_id, value) {
            return (common.isValidDomainSuffix(value));
        };

        o = s2.taboption(tabname, form.DynamicList, "additional_destip_route", _("IPv4 CIDR:"));
        o.description = _("Traffic to this IPv4 address or subnet will go through the selected proxy group (example: 1.1.1.1/32).");
        o.placeholder = "8.8.8.8/32";
        o.optional = true;
        o.editable = true;
        o.datatype = datatypes.CIDR4;

        o = s2.taboption(tabname, form.DynamicList, "additional_srcip_route", _("Source IPv4 CIDR:"));
        o.description = _("Traffic from this local IPv4 address or subnet will go through the selected proxy group (example: 192.168.31.212/32).");
        o.placeholder = "192.168.31.212/32";
        o.optional = true;
        o.editable = true;
        o.datatype = datatypes.CIDR4;

        s3 = m.section(form.NamedSection, "direct_rules", "direct_rules", _("DIRECT rules:"), _("Extra direct rules. These are applied before proxy rules, proxy groups, and block rules."));
        s3.addremove = false;

        tabname = "directruleslist_tab";
        s3.tab(tabname, _("Rules"));

        o = s3.taboption(tabname, form.DynamicList, "enabled_list", _("Use with rules:"));
        o.optional = true;
        result.rulesetsItems.forEach(item => {
            o.value(item.yamlName, item.name);
        });
        o.description = _("Ready-made lists for traffic that should bypass the proxy.");

        o = s3.taboption(tabname, form.DynamicList, "custom_enabled_domain_list", _("Use with custom domain list:"));
        o.description = _("Each entry can be a web link or an absolute local path to an MRS rules file.");
        o.optional = true;
        o.editable = true;
        o.placeholder = "/etc/justclash/list.mrs";
        o.validate = function (section_id, value) {
            return common.isValidResourceFilePath(value) ? true : _("MRS file is required.");
        };

        o = s3.taboption(tabname, form.DynamicList, "custom_enabled_cidr_list", _("Use with custom CIDR list:"));
        o.description = _("Each entry can be a web link or an absolute local path to an MRS rules file.");
        o.optional = true;
        o.editable = true;
        o.placeholder = "/etc/justclash/cidr-list.mrs";
        o.validate = function (section_id, value) {
            return common.isValidResourceFilePath(value) ? true : _("MRS file is required.");
        };

        o = s3.taboption(tabname, form.Value, "list_update_interval", _("List update interval:"));
        o.description = _("How often remote lists should be checked for updates, in seconds.");
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

        o = s3.taboption(tabname, form.Value, "proxy", _("Download lists through:"));
        o.description = _("Choose which proxy or group should be used when downloading these lists from the internet.");
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
        s3.tab(tabname, _("Custom rules"));

        o = s3.taboption(tabname, form.DynamicList, "additional_domain_direct", _("Domain suffix:"));
        o.description = _("Traffic to domains matching this suffix will bypass the proxy (example: google.com).");
        o.placeholder = "domain.tld";
        o.optional = true;
        o.editable = true;
        o.validate = function (section_id, value) {
            return (common.isValidDomainSuffix(value));
        };

        o = s3.taboption(tabname, form.DynamicList, "additional_srcip_direct", _("Source IPv4 CIDR:"));
        o.description = _("Traffic from this local IPv4 address or subnet will bypass the proxy (example: 192.168.31.212/32).");
        o.placeholder = "192.168.31.212/32";
        o.optional = true;
        o.editable = true;
        o.datatype = datatypes.CIDR4;

        o = s3.taboption(tabname, form.DynamicList, "additional_destip_direct", _("IPv4 CIDR:"));
        o.description = _("Traffic to this IPv4 address or subnet will bypass the proxy (example: 1.1.1.1/32).");
        o.placeholder = "8.8.8.8/32";
        o.optional = true;
        o.editable = true;
        o.datatype = datatypes.CIDR4;

        s4 = m.section(form.NamedSection, "block_rules", "block_rules", _("Block rules:"), _("Extra block rules. These are applied before proxy rules and groups, so matching traffic is stopped first."));
        s4.addremove = false;

        tabname = "rejectrules_tab";
        s4.tab(tabname, _("Rules"));

        o = s4.taboption(tabname, form.DynamicList, "enabled_blocklist", _("Use with rules:"));
        result.blockRulesetsItems.forEach(item => {
            o.value(item.yamlName, item.name);
        });
        o.description = _("Ready-made blocklists for ads and harmful sites. Matching traffic will be blocked. Choose the ones you want to use, or leave this empty.");

        o = s4.taboption(tabname, form.Value, "proxy", _("Download lists through:"));
        o.description = _("Choose which proxy or group should be used when downloading these lists from the internet.");
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
        s4.tab(tabname, _("Custom rules"));

        o = s4.taboption(tabname, form.DynamicList, "additional_domain_blockroute", _("Domain suffix:"));
        o.description = _("Traffic to domains matching this suffix will be blocked (example: google.com).");
        o.optional = true;
        o.placeholder = "domain.tld";
        o.editable = true;
        o.validate = function (section_id, value) {
            return (common.isValidDomainSuffix(value));
        };

        o = s4.taboption(tabname, form.DynamicList, "additional_destip_blockroute", _("IPv4 CIDR:"));
        o.description = _("Traffic to this IPv4 address or subnet will be blocked (example: 1.1.1.1/32).");
        o.placeholder = "8.8.8.8/32";
        o.optional = true;
        o.editable = true;
        o.datatype = datatypes.CIDR4;

        smp = m.section(form.NamedSection, "mixed_port_rules", "mixed_port_rules", _("Shared port rule:"), _("Extra settings for traffic that arrives through the shared proxy port. Use this when that port should behave differently from the default route."));
        smp.addremove = false;

        tabname = "mixedportbasic_tab";
        smp.tab(tabname, _("Basic"));

        o = smp.taboption(tabname, form.Value, "exit_rule", _("Send traffic to:"));
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

        s5 = m.section(form.NamedSection, "final_rules", "final_rules", _("Default rule:"), _("Used when no other rule matches. This is the fallback action for the remaining traffic."));
        s5.addremove = false;

        tabname = "finalbasic_tab";
        s5.tab(tabname, _("Basic"));

        optionFinal = s5.taboption(tabname, form.Value, "exit_rule", _("Send traffic to:"));
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
