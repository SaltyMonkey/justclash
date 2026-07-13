"use strict";
"require view";
"require uci";
"require view.justclash.helper_common as common";
"require view.justclash.helper_fs as fsApi";
"require form";
"require tools.widgets as widgets";

const JSON_OBJECT_ROWS = 10;

return view.extend({
    async load() {
        let rulesetsItems = [];
        let blockRulesetsItems = [];
        let geoDataMode = false;

        try {
            const inbuildRules = await fsApi.readNameYamlEntries(common.rulesetsFilePath);
            const userRules = await fsApi.readNameYamlEntries(common.userRulesetsFilePath);
            const combinedRules = [...inbuildRules, ...userRules];
            const seenRules = new Set();
            rulesetsItems = combinedRules.filter(item => {
                if (seenRules.has(item.yamlName)) return false;
                seenRules.add(item.yamlName);
                return true;
            });

            const inbuildBlockRules = await fsApi.readNameYamlEntries(common.blockRulesetsFilePath);
            const userBlockRules = await fsApi.readNameYamlEntries(common.userBlockRulesetsFilePath);
            const combinedBlockRules = [...inbuildBlockRules, ...userBlockRules];
            const seenBlock = new Set();
            blockRulesetsItems = combinedBlockRules.filter(item => {
                if (seenBlock.has(item.yamlName)) return false;
                seenBlock.add(item.yamlName);
                return true;
            });
        } catch (e) { }

        try {
            await uci.load(common.binName);
            geoDataMode = (uci.get(common.binName, "proxy", "geodata_mode") === "1") || false;
        } catch (e) { }

        return {
            rulesetsItems,
            blockRulesetsItems,
            geoDataMode
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
        s = m.section(form.GridSection, "proxies", _("Proxies list:"), _("Proxies defined as outbound connections."));
        s.anonymous = true;
        s.addremove = true;
        s.nodescriptions = true;
        s.cloneable = true;
        s.sortable = true;

        tabname = "proxiesbasic_tab";
        s.tab(tabname, _("Basic"));

        o = s.taboption(tabname, form.Flag, "enabled", _("Enabled"));
        o.description = _("Enable or disable this proxy entry without removing it.");
        o.default = primitives.TRUE;
        o.rmempty = false;
        o.editable = true;

        o = s.taboption(tabname, form.Value, "name", _("Name:"));
        o.description = _("Proxy name.");
        o.rmempty = false;
        o.cfgvalue = function (section_id) {
            const val = uci.get(common.binName, section_id, "name");
            if (val)
                return val;
            return common.generateRandomName();
        };
        o.validate = function (section_id, value) {
            return common.validateSimpleName(value);
        };

        o = s.taboption(tabname, form.ListValue, "mode", _("Mode:"));
        o.description = _("Choose whether this proxy is defined as a URL or a JSON object.");
        common.defaultProxiesModes.forEach(item => {
            o.value(item.value, item.text);
        });
        o.rmempty = false;
        o.default = common.defaultProxiesModes[1].value;
        o.modalonly = true;

        o = s.taboption(tabname, form.TextValue, "proxy_link_object", _("JSON object:"));
        o.description = _("JSON object with connection parameters.");
        o.rows = JSON_OBJECT_ROWS;
        o.optional = true;
        o.modalonly = true;
        o.depends("mode", "object");
        o.validate = function (section_id, value) {
            return common.validateProxyJsonObject(value);
        };

        o = s.taboption(tabname, form.Value, "proxy_link_uri", _("Link:"));
        o.description = _("URI link with connection parameters.");
        //o.password = true;
        o.optional = true;
        o.placeholder = "vless://uuid@server:port?type=grpc&security=reality";
        o.validate = function (section_id, value) {
            return (common.isValidProxyLink(value));
        };
        o.depends("mode", "uri");
        o.modalonly = true;

        o = s.taboption(tabname, form.Value, "dialer_proxy", _("Connect through:"));
        o.description = _("Route this proxy through the specified proxy server, or connect directly if left empty.");
        o.optional = true;
        o.placeholder = "proxyname_";
        o.validate = function (section_id, value) {
            if (value === "" || value === undefined || value === null) {
                return true;
            }
            return common.validateSimpleName(value);
        };
        o.depends("mode", "uri");
        o.modalonly = true;

        o = s.taboption(tabname, widgets.DeviceSelect, "interface_name", _("Bind to interface:"));
        o.description = _("Bind this proxy to a specific network device. Leave empty to let the system choose the outgoing interface.");
        o.optional = true;
        o.noaliases = true;
        o.nobridges = true;
        o.noinactive = false;
        o.multiple = false;
        o.filter = common.filterOutboundDeviceSelect;
        o.depends("mode", "uri");
        o.modalonly = true;

        o = s.taboption(tabname, form.ListValue, "ip_version", _("IP version (outbound):"));
        o.description = _(
            "IP version used by outbound proxy connections when server is a domain name.<br>" +
            "<b>dual</b> — Default dual-stack resolution.<br>" +
            "<b>ipv4</b> — Use IPv4 only.<br>" +
            "<b>ipv6</b> — Use IPv6 only.<br>" +
            "<b>ipv4-prefer</b> — Dual-stack resolution, race connections with IPv4 preference.<br>" +
            "<b>ipv6-prefer</b> — Dual-stack resolution, race connections with IPv6 preference."
        );
        common.defaultIPVersionValues.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultIPVersionValues[0].value;
        o.rmempty = false;
        o.depends("mode", "uri");
        o.modalonly = true;

        o = s.taboption(tabname, form.Value, "routing_mark", _("Routing mark:"));
        o.description = _("Optional Linux fwmark applied by Mihomo to outbound connections of this proxy. Leave empty to use the global mark.");
        o.optional = true;
        o.rmempty = true;
        o.placeholder = "268435456";
        o.depends("mode", "uri");
        o.validate = function (section_id, value) {
            return common.validateRoutingMark(value);
        };
        o.modalonly = true;

        tabname = "proxieslists_tab";
        s.tab(tabname, _("Lists"));

        o = s.taboption(tabname, form.DynamicList, "enabled_list", _("Use with rules:"));
        result.rulesetsItems.forEach(item => {
            o.value(item.yamlName, item.name);
        });
        o.description = _("Predefined rule set lists. Select the ones you want to route through the proxy. Leave this empty if you use proxy groups.");
        o.modalonly = true;

        o = s.taboption(tabname, form.Flag, "use_proxy_for_list_update", _("Get lists through proxy:"));
        o.description = _("If selected, rule set lists will be updated through the proxy.");
        o.optional = true;
        o.default = primitives.FALSE;
        o.modalonly = true;

        o = s.taboption(tabname, form.Value, "list_update_interval", _("List update interval:"));
        o.description = _("How often remote lists should be checked for updates, in seconds.");
        o.datatype = datatypes.UINTEGER;
        common.defaultRuleSetUpdateIntervalSec.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultRuleSetUpdateIntervalSec[1].value;
        o.optional = true;
        o.validate = function (section_id, value) {
            return common.validateListUpdateInterval(value);
        };
        o.modalonly = true;

        o = s.taboption(tabname, form.Value, "size_limit", _("Size limit:"));
        o.description = _("Maximum download size in bytes. Use 0 to disable the limit.");
        o.datatype = datatypes.UINTEGER;
        common.defaultDownloadSizeLimits.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultDownloadSizeLimits[5].value;
        o.rmempty = false;
        o.optional = true;
        o.modalonly = true;

        if (result.geoDataMode) {
            tabname = "proxiesgeodatarules_tab";
            s.tab(tabname, _("Geodata rules"));

            o = s.taboption(tabname, form.DynamicList, "enabled_geosite_list", _("Use with geosite:"));
            o.description = _("Selected geosite lists. Select the ones you want to route through the proxy. Leave this empty if you use proxy groups.");
            o.modalonly = true;
            o.optional = true;
            o.editable = true;

            o = s.taboption(tabname, form.DynamicList, "enabled_geoip_list", _("Use with geoip:"));
            o.description = _("Selected geosite lists. Select the ones you want to route through the proxy. Leave this empty if you use proxy groups.");
            o.modalonly = true;
            o.optional = true;
            o.editable = true;
        }

        tabname = "proxiesmanualrules_tab";
        s.tab(tabname, _("Manual rules"));

        o = s.taboption(tabname, form.DynamicList, "additional_domain_route", _("Domain suffix:"));
        o.description = _("Traffic to domains matching this suffix will go through this proxy (example: google.com).");
        o.optional = true;
        o.placeholder = "domain.tld";
        o.validate = function (section_id, value) {
            return (common.isValidDomainSuffix(value));
        };
        o.modalonly = true;

        o = s.taboption(tabname, form.DynamicList, "additional_destip_route", _("IPv4 CIDR:"));
        o.description = _("Traffic to this IPv4 address or subnet will go through this proxy (example: 1.1.1.1/32).");
        o.placeholder = "8.8.8.8/32";
        o.optional = true;
        o.datatype = datatypes.CIDR4;
        o.modalonly = true;

        o = s.taboption(tabname, form.DynamicList, "additional_srcip_route", _("Source IPv4 CIDR:"));
        o.description = _("Traffic from this local IPv4 address or subnet will go through this proxy (example: 192.168.31.212/32).");
        o.placeholder = "192.168.31.212/32";
        o.optional = true;
        o.editable = true;
        o.datatype = datatypes.CIDR4;
        o.modalonly = true;

        spp = m.section(form.GridSection, "proxy_provider", _("Proxy provider:"), _("Proxy providers are external subscription URLs that dynamically load a list of proxies."));
        spp.anonymous = true;
        spp.addremove = true;
        spp.nodescriptions = true;
        spp.cloneable = true;
        spp.sortable = true;

        tabname = "proxyprovidersbasic_tab";
        spp.tab(tabname, _("Basic"));

        o = spp.taboption(tabname, form.Flag, "enabled", _("Enabled"));
        o.description = _("Enable or disable this proxy provider without removing it.");
        o.default = primitives.TRUE;
        o.rmempty = false;
        o.editable = true;

        o = spp.taboption(tabname, form.Value, "name", _("Name:"));
        o.description = _("Proxy provider name.");
        o.rmempty = false;
        o.cfgvalue = function (section_id) {
            const val = uci.get(common.binName, section_id, "name");
            if (val)
                return val;
            return common.generateRandomName();
        };
        o.validate = function (section_id, value) {
            return common.validateSimpleName(value);
        };

        o = spp.taboption(tabname, form.Value, "subscription", _("Subscription URL:"));
        o.placeholder = "https://yourSubscriptionUrl";
        o.rmempty = false;
        o.validate = function (section_id, value) {
            return common.validateHttpUrl(value);
        };
        o.description = _("Your complete subscription URL with http:// or https://.");
        o.modalonly = true;

        o = spp.taboption(tabname, form.Value, "override_dialer_proxy", _("Connect through:"));
        o.description = _("Apply this dialer-proxy to nodes loaded from this provider. Leave empty to connect directly.");
        o.optional = true;
        o.placeholder = "proxyname_";
        o.validate = function (section_id, value) {
            if (value === "" || value === undefined || value === null) {
                return true;
            }
            return common.validateSimpleName(value);
        };
        o.modalonly = true;

        o = spp.taboption(tabname, widgets.DeviceSelect, "override_interface_name", _("Bind to interface:"));
        o.description = _("Apply this interface binding to nodes loaded from this provider. Leave empty to use the system-selected interface.");
        o.optional = true;
        o.noaliases = true;
        o.nobridges = true;
        o.noinactive = false;
        o.multiple = false;
        o.filter = common.filterOutboundDeviceSelect;
        o.modalonly = true;

        o = spp.taboption(tabname, form.Value, "override_routing_mark", _("Routing mark:"));
        o.description = _("Optional Linux fwmark applied to nodes loaded from this provider through Mihomo provider override. Leave empty to use node or global settings.");
        o.optional = true;
        o.rmempty = true;
        o.placeholder = "268435456";
        o.validate = function (section_id, value) {
            return common.validateRoutingMark(value);
        };
        o.modalonly = true;

        o = spp.taboption(tabname, form.ListValue, "override_ip_version", _("IP version override:"));
        o.description = _(
            "Override ip-version for all proxy nodes loaded from this provider."
        );
        common.defaultIPVersionValues.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultIPVersionValues[0].value;
        o.rmempty = false;
        o.modalonly = true;

        o = spp.taboption(tabname, form.Value, "update_interval", _("Update interval:"));
        o.rmempty = false;
        o.datatype = datatypes.UINTEGER;
        common.defaultProxyProviderUpdateIntervalSec.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultProxyProviderUpdateIntervalSec[1].value;
        o.description = _("Time interval for subscription update check in seconds.");
        o.modalonly = true;

        o = spp.taboption(tabname, form.Value, "size_limit", _("Size limit:"));
        o.description = _("Maximum download size in bytes. Use 0 to disable the limit.");
        o.datatype = datatypes.UINTEGER;
        common.defaultDownloadSizeLimits.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultDownloadSizeLimits[5].value;
        o.rmempty = false;
        o.optional = true;
        o.modalonly = true;

        o = spp.taboption(tabname, form.Value, "proxy", _("Get subscription with:"));
        o.description = _("Use the selected proxy to get subscription data from the server.");
        o.value(common.endRuleOptions[0].value, common.endRuleOptions[0].text);
        o.default = common.endRuleOptions[0].value;
        o.rmempty = false;
        o.validate = function (section_id, value) {
            return common.validateExitRule(value);
        };
        o.modalonly = true;

        tabname = "proxyproviderheaders_tab";
        spp.tab(tabname, _("Security"));

        o = spp.taboption(tabname, form.Flag, "header_hwid", _("HWID support:"));
        o.default = primitives.FALSE;
        o.description = _("Send HWID data headers to server with proxy provider request. Leave it unchecked if you don't need it.");
        o.editable = true;
        o.rmempty = false;
        o.modalonly = true;

        o = spp.taboption(tabname, form.Value, "header_authorization", _("Authorization header:"));
        o.description = _("Send custom Authorization header to server with proxy provider request. Leave it empty if you don't need it.");
        o.editable = true;
        o.rmempty = true;
        o.modalonly = true;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") {
                return true;
            }
            if (/[\r\n]/.test(value)) {
                return _("Newlines (CR/LF) are not allowed in HTTP headers.");
            }
            return true;
        };

        o = spp.taboption(tabname, form.Value, "header_user_agent", _("User agent header:"));
        o.description = _("Send custom useragent header to server with proxy provider request. Leave it empty if you don't need it.");
        o.editable = true;
        o.rmempty = true;
        o.modalonly = true;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") {
                return true;
            }
            if (/[\r\n]/.test(value)) {
                return _("Newlines (CR/LF) are not allowed in HTTP headers.");
            }
            return true;
        };

        o = spp.taboption(tabname, form.Value, "age_private_key", _("AGE private key:"));
        o.description = _("Private key for AGE encryption. Optional.");
        o.password = true;
        o.rmempty = true;
        o.modalonly = true;
        o.validate = function(section_id, value) {
            return common.validateAgePrivateKey(value);
        };

        o = spp.taboption(tabname, form.Value, "header_age_public_key", _("AGE public key:"));
        o.description = _("Public key for AGE encryption. Optional.");
        o.rmempty = true;
        o.modalonly = true;
        o.validate = function(section_id, value) {
            return common.validateAgePublicKey(value);
        };

        tabname = "proxyproviderhelthchk_tab";
        spp.tab(tabname, _("Health check"));

        o = spp.taboption(tabname, form.Flag, "health_check", _("Health check:"));
        o.default = primitives.TRUE;
        o.rmempty = false;
        o.description = _("Enable availability checks for nodes from this proxy provider.");
        o.modalonly = true;

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
        o.retain = true;
        o.depends("health_check", primitives.TRUE);
        o.modalonly = true;

        o = spp.taboption(tabname, form.Value, "health_check_expected_status", _("Check status:"));
        o.rmempty = false;
        o.datatype = datatypes.UINTEGER;
        common.defaultHealthCheckResultCode.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultHealthCheckResultCode[1].value;
        o.retain = true;
        o.depends("health_check", primitives.TRUE);
        o.description = _("Required response status for node availability check (required for proxy provider functionality).");
        o.validate = function (section_id, value) {
            return common.validateHttpStatus(value);
        };
        o.modalonly = true;

        o = spp.taboption(tabname, form.Value, "health_check_interval", _("Check interval:"));
        o.datatype = datatypes.UINTEGER;
        common.defaultProxyProviderHealthCheckSec.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultProxyProviderHealthCheckSec[3].value;
        o.retain = true;
        o.depends("health_check", primitives.TRUE);
        o.description = _("Time interval between health checks in seconds.");
        o.validate = function (section_id, value) {
            return common.validateSecondsInterval(value);
        };
        o.modalonly = true;

        o = spp.taboption(tabname, form.Value, "health_check_timeout", _("Check timeout:"));
        o.datatype = datatypes.UINTEGER;
        common.defaultHealthCheckTimeoutMs.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultHealthCheckTimeoutMs[3].value;
        o.retain = true;
        o.depends("health_check", primitives.TRUE);
        o.description = _("Timeout for each individual health check in milliseconds.");
        o.validate = function (section_id, value) {
            return common.validateMillisecondsTimeout(value);
        };
        o.modalonly = true;

        o = spp.taboption(tabname, form.Flag, "health_check_lazy", _("Lazy:"));
        o.default = primitives.TRUE;
        o.rmempty = false;
        o.description = _("Run provider health checks only when needed instead of probing on every interval.");
        o.modalonly = true;

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
        o.modalonly = true;

        o = spp.taboption(tabname, form.Value, "exclude_filter", _("Exclude filter:"));
        o.description = _("Exclude nodes that match keywords or regular expressions. Multiple patterns can be separated with | (pipe).");
        o.optional = true;
        o.rmempty = true;
        o.placeholder = "CN|(?i)douyin";
        o.validate = function (section_id, value) {
            return common.isValidKeywordOrRegexList(value, "exclude_filter");
        };
        o.modalonly = true;

        o = spp.taboption(tabname, form.Value, "exclude_type", _("Exclude type:"));
        o.description = _("Exclude nodes by proxy type.");
        o.placeholder = "vless|vmess|ss|mieru";
        o.optional = true;
        o.rmempty = true;
        o.validate = function (section_id, value) {
            return common.validateProxyTypeFilter(value);
        };
        o.modalonly = true;

        s2 = m.section(form.GridSection, "proxy_group", _("Proxy groups:"), _("Group proxies for special routing (fallback, load balancing, URL test)."));
        s2.anonymous = true;
        s2.addremove = true;
        s2.nodescriptions = true;
        s2.cloneable = true;
        s2.sortable = true;

        tabname = "proxygroupsbasic_tab";
        s2.tab(tabname, _("Basic"));

        o = s2.taboption(tabname, form.Flag, "enabled", _("Enabled"));
        o.description = _("Enable or disable this proxy group without removing it.");
        o.default = primitives.TRUE;
        o.rmempty = false;
        o.editable = true;

        o = s2.taboption(tabname, form.Value, "name", _("Name:"));
        o.description = _("Proxy group name.");
        o.rmempty = false;
        o.cfgvalue = function (section_id) {
            const val = uci.get(common.binName, section_id, "name");
            if (val)
                return val;
            return common.generateRandomName();
        };
        o.validate = function (section_id, value) {
            return common.validateSimpleName(value);
        };

        o = s2.taboption(tabname, form.ListValue, "group_type", _("Group type:"));
        common.defaultProxyGroupsTypes.forEach(item => {
            o.value(item.value, item.text);
        });
        o.rmempty = false;
        o.default = common.defaultProxyGroupsTypes[0].value;
        o.description = _("Choose how this group selects a proxy, such as select, fallback, load balancing, or URL test.");
        o.modalonly = true;

        o = s2.taboption(tabname, form.ListValue, "strategy", _("Group strategy:"));
        common.defaultProxyGroupsBalanceModeStrategies.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultProxyGroupsBalanceModeStrategies[0].value;
        o.depends("group_type", "load-balance");
        o.depends("group_type", "load-balancer");
        o.description = _("Choose how the load-balance group distributes traffic across available proxies.");
        o.modalonly = true;

        o = s2.taboption(tabname, widgets.DeviceSelect, "interface_name", _("Bind to interface:"));
        o.description = _("Bind this proxy group to a specific network device. Leave empty to let the system choose the outgoing interface.");
        o.optional = true;
        o.noaliases = true;
        o.nobridges = true;
        o.noinactive = false;
        o.multiple = false;
        o.filter = common.filterOutboundDeviceSelect;
        o.modalonly = true;

        o = s2.taboption(tabname, form.ListValue, "ip_version", _("IP version (group):"));
        o.description = _(
            "IP version preference for this proxy group when connecting to endpoints."
        );
        common.defaultIPVersionValues.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultIPVersionValues[0].value;
        o.rmempty = false;
        o.modalonly = true;

        o = s2.taboption(tabname, form.DynamicList, "proxies", _("Proxies:"));
        o.description = _("List proxy entries that belong to this group.");
        o.placeholder = "proxy-name";
        o.optional = true;
        o.editable = true;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") return true;
            return common.validateSimpleName(value);
        };
        o.modalonly = true;

        o = s2.taboption(tabname, form.DynamicList, "providers", _("Providers:"));
        o.description = _("List proxy providers whose nodes should be included in this group.");
        o.placeholder = "provider-name";
        o.optional = true;
        o.editable = true;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") return true;
            return common.validateSimpleName(value);
        };
        o.modalonly = true;

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
        o.modalonly = true;

        o = s2.taboption(tabname, form.Value, "expected_status", _("Check status:"));
        common.defaultHealthCheckResultCode.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultHealthCheckResultCode[1].value;
        o.datatype = datatypes.UINTEGER;
        o.rmempty = false;
        o.description = _("Required response status for node availability check (required for proxy group functionality).");
        o.validate = function (section_id, value) {
            return common.validateHttpStatus(value);
        };
        o.modalonly = true;

        o = s2.taboption(tabname, form.Value, "check_interval", _("Check interval:"));
        o.datatype = datatypes.UINTEGER;
        common.defaultProxyGroupIntervalSec.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultProxyGroupIntervalSec[2].value;
        o.rmempty = false;
        o.description = _("Time interval between health checks in seconds.");
        o.validate = function (section_id, value) {
            return common.validateSecondsInterval(value);
        };
        o.modalonly = true;

        o = s2.taboption(tabname, form.Value, "tolerance", _("Tolerance:"));
        o.datatype = datatypes.UINTEGER;
        common.defaultUrlTestToleranceMs.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultUrlTestToleranceMs[4].value;
        o.rmempty = false;
        o.description = _("Proxies switch tolerance, measured in milliseconds (ms).");
        o.depends("group_type", "url-test");
        o.validate = function (section_id, value) {
            return common.validateIntegerRange(value, 0, 10000);
        };
        o.modalonly = true;

        o = s2.taboption(tabname, form.Value, "default_selected", _("Default selected:"));
        o.description = _("Name of the proxy/group that should be selected by default.");
        o.depends("group_type", "select");
        o.rmempty = true;
        o.modalonly = true;

        o = s2.taboption(tabname, form.Value, "check_timeout", _("Check timeout:"));
        o.datatype = datatypes.UINTEGER;
        common.defaultHealthCheckTimeoutMs.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultHealthCheckTimeoutMs[3].value;
        o.description = _("Timeout for each individual health check in milliseconds.");
        o.validate = function (section_id, value) {
            return common.validateMillisecondsTimeout(value);
        };
        o.modalonly = true;

        o = s2.taboption(tabname, form.Value, "max_failed_times", _("Max failed times:"));
        o.datatype = datatypes.UINTEGER;
        common.defaultMaxFailedTimes.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultMaxFailedTimes[4].value;
        o.placeholder = common.defaultMaxFailedTimes[4].value;
        o.description = _("How many failed health checks are allowed before the node is treated as unavailable.");
        o.validate = function (section_id, value) {
            return common.validateIntegerRange(value, 1, 100);
        };
        o.modalonly = true;

        o = s2.taboption(tabname, form.Flag, "lazy", _("Lazy:"));
        o.default = primitives.TRUE;
        o.rmempty = false;
        o.description = _("Run group health checks only when needed instead of probing on every interval.");
        o.modalonly = true;

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
        o.modalonly = true;

        o = s2.taboption(tabname, form.Value, "exclude_filter", _("Exclude filter:"));
        o.description = _("Exclude nodes that match keywords or regular expressions. Multiple patterns can be separated with | (pipe).");
        o.optional = true;
        o.rmempty = true;
        o.placeholder = "CN|(?i)douyin";
        o.validate = function (section_id, value) {
            return common.isValidKeywordOrRegexList(value, "exclude_filter");
        };
        o.modalonly = true;

        o = s2.taboption(tabname, form.Value, "exclude_type", _("Exclude type:"));
        o.description = _("Exclude nodes by proxy type.");
        o.placeholder = "vless|vmess|ss|mieru";
        o.optional = true;
        o.rmempty = true;
        o.validate = function (section_id, value) {
            return common.validateProxyTypeFilter(value);
        };
        o.modalonly = true;

        tabname = "proxiesgrouplist_tab";
        s2.tab(tabname, _("Lists"));

        o = s2.taboption(tabname, form.DynamicList, "enabled_list", _("Use with rules:"));
        result.rulesetsItems.forEach(item => {
            o.value(item.yamlName, item.name);
        });
        o.description = _("Predefined rule set lists. Select the ones you want to route through the proxy group.");
        o.modalonly = true;

        o = s2.taboption(tabname, form.Flag, "use_proxy_group_for_list_update", _("Get lists through proxy group:"));
        o.description = _("If selected, rule set lists will be updated through the proxy group.");
        o.optional = true;
        o.default = primitives.FALSE;
        o.modalonly = true;

        o = s2.taboption(tabname, form.Value, "list_update_interval", _("List update interval:"));
        o.description = _("How often remote lists should be checked for updates, in seconds.");
        o.datatype = datatypes.UINTEGER;
        common.defaultRuleSetUpdateIntervalSec.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultRuleSetUpdateIntervalSec[1].value;
        o.optional = true;
        o.validate = function (section_id, value) {
            return common.validateListUpdateInterval(value);
        };
        o.modalonly = true;

        o = s2.taboption(tabname, form.Value, "size_limit", _("Size limit:"));
        o.description = _("Maximum download size in bytes. Use 0 to disable the limit.");
        o.datatype = datatypes.UINTEGER;
        common.defaultDownloadSizeLimits.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultDownloadSizeLimits[5].value;
        o.rmempty = false;
        o.optional = true;
        o.modalonly = true;

        if (result.geoDataMode) {
            tabname = "proxiesgroupgeodatarules_tab";
            s2.tab(tabname, _("Geodata rules"));

            o = s2.taboption(tabname, form.DynamicList, "enabled_geosite_list", _("Use with geosite:"));
            o.description = _("Selected geosite lists. Select the ones you want to route through the proxy. Leave this empty if you use proxy groups.");
            o.modalonly = true;
            o.optional = true;
            o.editable = true;

            o = s2.taboption(tabname, form.DynamicList, "enabled_geoip_list", _("Use with geoip:"));
            o.description = _("Selected geosite lists. Select the ones you want to route through the proxy. Leave this empty if you use proxy groups.");
            o.modalonly = true;
            o.optional = true;
            o.editable = true;
        }

        tabname = "proxiesgroupmanualrules_tab";
        s2.tab(tabname, _("Manual rules"));

        o = s2.taboption(tabname, form.DynamicList, "additional_domain_route", _("Domain suffix:"));
        o.description = _("Traffic to domains matching this suffix will go through the selected proxy group (example: google.com).");
        o.optional = true;
        o.placeholder = "domain.tld";
        o.editable = true;
        o.validate = function (section_id, value) {
            return (common.isValidDomainSuffix(value));
        };
        o.modalonly = true;

        o = s2.taboption(tabname, form.DynamicList, "additional_destip_route", _("IPv4 CIDR:"));
        o.description = _("Traffic to this IPv4 address or subnet will go through the selected proxy group (example: 1.1.1.1/32).");
        o.placeholder = "8.8.8.8/32";
        o.optional = true;
        o.editable = true;
        o.datatype = datatypes.CIDR4;
        o.modalonly = true;

        o = s2.taboption(tabname, form.DynamicList, "additional_srcip_route", _("Source IPv4 CIDR:"));
        o.description = _("Traffic from this local IPv4 address or subnet will go through the selected proxy group (example: 192.168.31.212/32).");
        o.placeholder = "192.168.31.212/32";
        o.optional = true;
        o.editable = true;
        o.datatype = datatypes.CIDR4;
        o.modalonly = true;

        s4 = m.section(form.GridSection, "block_rules", _("Block rules:"), _("Extra block rules. These are applied before proxy rules and groups, so matching traffic is stopped first."));
        s4.anonymous = true;
        s4.addremove = false;
        s4.nodescriptions = true;
        s4.filter = function (section_id) {
            return section_id === "block_rules";
        };

        tabname = "rejectrules_tab";
        s4.tab(tabname, _("Lists"));

        o = s4.taboption(tabname, form.Flag, "enabled", _("Enabled"));
        o.description = _("Enable or disable block rules.");
        o.default = primitives.TRUE;
        o.rmempty = false;
        o.editable = true;

        o = s4.taboption(tabname, form.DynamicList, "enabled_blocklist", _("Use with rules:"));
        result.blockRulesetsItems.forEach(item => {
            o.value(item.yamlName, item.name);
        });
        o.description = _("Ready-made blocklists for ads and harmful sites. Matching traffic will be blocked. Choose the ones you want to use, or leave this empty.");
        o.modalonly = true;

        o = s4.taboption(tabname, form.Value, "proxy", _("Download lists through:"));
        o.description = _("Choose which proxy or group should be used when downloading these lists from the internet.");
        o.value(common.endRuleOptions[0].value, common.endRuleOptions[0].text);
        o.default = common.endRuleOptions[0].value;
        o.rmempty = false;
        o.validate = function (section_id, value) {
            return common.validateExitRule(value);
        };
        o.modalonly = true;

        o = s4.taboption(tabname, form.Value, "list_update_interval", _("List update interval:"));
        o.description = _("How often remote lists should be checked for updates, in seconds.");
        o.datatype = datatypes.UINTEGER;
        o.optional = true;
        common.defaultRuleSetUpdateIntervalSec.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultRuleSetUpdateIntervalSec[1].value;
        o.validate = function (section_id, value) {
            return common.validateListUpdateInterval(value);
        };
        o.modalonly = true;

        o = s4.taboption(tabname, form.Value, "size_limit", _("Size limit:"));
        o.description = _("Maximum download size in bytes. Use 0 to disable the limit.");
        o.datatype = datatypes.UINTEGER;
        common.defaultDownloadSizeLimits.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultDownloadSizeLimits[5].value;
        o.rmempty = false;
        o.optional = true;
        o.modalonly = true;

        if (result.geoDataMode) {
            tabname = "rejectgeodatarules_tab";
            s4.tab(tabname, _("Geodata rules"));

            o = s4.taboption(tabname, form.DynamicList, "enabled_geosite_blocklist", _("Use with geosite:"));
            o.description = _("Selected geosite lists. Select the ones you want to route through the proxy. Leave this empty if you use proxy groups.");
            o.modalonly = true;
            o.optional = true;
            o.editable = true;

            o = s4.taboption(tabname, form.DynamicList, "enabled_geoip_blocklist", _("Use with geoip:"));
            o.description = _("Selected geosite lists. Select the ones you want to route through the proxy. Leave this empty if you use proxy groups.");
            o.modalonly = true;
            o.optional = true;
            o.editable = true;
        }

        tabname = "rejectmanualrules_tab";
        s4.tab(tabname, _("Manual rules"));

        o = s4.taboption(tabname, form.DynamicList, "additional_domain_blockroute", _("Domain suffix:"));
        o.description = _("Traffic to domains matching this suffix will be blocked (example: google.com).");
        o.optional = true;
        o.placeholder = "domain.tld";
        o.editable = true;
        o.validate = function (section_id, value) {
            return (common.isValidDomainSuffix(value));
        };
        o.modalonly = true;

        o = s4.taboption(tabname, form.DynamicList, "additional_destip_blockroute", _("IPv4 CIDR:"));
        o.description = _("Traffic to this IPv4 address or subnet will be blocked (example: 1.1.1.1/32).");
        o.placeholder = "8.8.8.8/32";
        o.optional = true;
        o.editable = true;
        o.datatype = datatypes.CIDR4;
        o.modalonly = true;

        smp = m.section(form.NamedSection, "mixed_port_rules", "mixed_port_rules", _("Mihomo mixed port rule:"), _("Extra settings for traffic that arrives through the Mihomo mixed port. Use this when that port should behave differently from the default route."));

        tabname = "mixedportbasic_tab";
        smp.tab(tabname, _("Basic"));

        o = smp.taboption(tabname, form.Value, "exit_rule", _("Send traffic to:"));
        common.endRuleOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });
        o.default = common.endRuleOptions[1].value;
        o.rmempty = false;
        o.description = _("Choose which proxy, group, or action handles traffic that comes in through the Mihomo mixed port.");
        o.validate = function (section_id, value) {
            return common.validateExitRule(value);
        };

        s5 = m.section(form.NamedSection, "final_rules", "final_rules", _("Default rule:"), _("Used when no other rule matches. This is the fallback action for the remaining traffic."));

        tabname = "finalbasic_tab";
        s5.tab(tabname, _("Basic"));

        optionFinal = s5.taboption(tabname, form.Value, "exit_rule", _("Send traffic to:"));
        optionFinal.value(common.endRuleOptions[0].value, common.endRuleOptions[0].text);
        optionFinal.value(common.endRuleOptions[2].value, common.endRuleOptions[2].text);
        optionFinal.default = common.endRuleOptions[0].value;
        optionFinal.rmempty = false;
        optionFinal.description = _("Choose the fallback action for traffic that does not match any earlier rule.");
        optionFinal.validate = function (section_id, value) {
            return common.validateExitRule(value);
        };

        //            .cbi-section:not(:nth-last-of-type(-n+2)) > .cbi-section-node { max-height:395px; min-height:395px; overflow-y:auto; }
        //
        //@media (max-width: 768px) {
        //    .cbi-section:not(:nth-last-of-type(-n+2)) > .cbi-section-node { max-height:none; min-height:0; overflow-y:visible; }
        //}
        //.cbi-section-create { width:100% !important; padding:10px 0 !important; }
        //.cbi-section { border:0 !important; border-bottom:1px solid #595959 !important; }
        const style = E("style", {}, `
            ul.dropdown { max-height:320px !important; }
            .cbi-value { margin-bottom:14px !important; }
            .cbi-value[data-name="enabled"] .cbi-value-title,
            .cbi-value[data-name="proxy_link_uri"] .cbi-value-title,
            .cbi-value[data-name="subscription"] .cbi-value-title,
            .cbi-value[data-name="group_type"] .cbi-value-title,
            .cbi-value[data-name="enabled_list"] .cbi-value-title,
            .cbi-value[data-name="enabled_blocklist"] .cbi-value-title,
            .cbi-value[data-name="use_proxy_for_list_update"] .cbi-value-title,
            .cbi-value[data-name="additional_domain_route"] .cbi-value-title,
            .cbi-value[data-name="additional_domain_blockroute"] .cbi-value-title,
            .cbi-value[data-name="health_check"] .cbi-value-title,
            .cbi-value[data-name="filter"] .cbi-value-title {
                border-left: 4px solid var(--error-color-medium, #f44336) !important;
                padding-left: 12px !important;
            }
        `);
        return m.render().then(formEl => E("div", {}, [style, formEl]));
    }
});
