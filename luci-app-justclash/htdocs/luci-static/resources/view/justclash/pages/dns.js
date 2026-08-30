"use strict";
"require uci";
"require form";
"require view";
"require view.justclash.common as common";
"require view.justclash.lib.form as formConstants";

return view.extend({
    async load() {
        const activeRulesets = new Set();
        const activeGeosites = new Set();

        try {
            await uci.load(common.binName);

            uci.sections(common.binName).forEach((section) => {
                const sectionId = section[".name"];

                if (["proxies", "proxy_group"].includes(section[".type"])
                    && uci.get(common.binName, sectionId, "enabled") !== "0") {
                    const rulesets = uci.get(common.binName, sectionId, "enabled_list");
                    const geosites = uci.get(common.binName, sectionId, "enabled_geosite_list");

                    (Array.isArray(rulesets) ? rulesets : [rulesets]).forEach(name => name && activeRulesets.add(name));
                    (Array.isArray(geosites) ? geosites : [geosites]).forEach(name => name && activeGeosites.add(name));
                }

                if (section[".type"] === "block_rules"
                    && uci.get(common.binName, sectionId, "enabled") !== "0") {
                    const rulesets = uci.get(common.binName, sectionId, "enabled_blocklist");
                    const geosites = uci.get(common.binName, sectionId, "enabled_geosite_blocklist");

                    (Array.isArray(rulesets) ? rulesets : [rulesets]).forEach(name => name && activeRulesets.add(name));
                    (Array.isArray(geosites) ? geosites : [geosites]).forEach(name => name && activeGeosites.add(name));
                }
            });
        } catch { /* ignore */ }

        return {
            rulesetsItems: Array.from(activeRulesets).map(name => ({ rawName: name, readableName: `(Set) ${name}` })),
            geositeItems: Array.from(activeGeosites).map(name => ({ rawName: name, readableName: `(Geo) ${name}` }))
        };
    },

    render(result) {
        let m, s, o, tabname;

        const primitives = formConstants.boolean;
        const datatypes = formConstants.datatypes;

        m = new form.Map(common.binName);
        s = m.section(form.NamedSection, "proxy", "proxy", _("DNS settings"), _("DNS resolver, fake-IP, policy, and hosts settings used by Mihomo."));

        tabname = "dnsbasic_tab";
        s.tab(tabname, _("Basic"));

        o = s.taboption(tabname, form.Value, "dns_listen_port", _("DNS listen port:"));
        o.description = _("Port where Mihomo built-in DNS server listens.");
        o.datatype = datatypes.PORT;
        o.placeholder = "7894";
        o.default = "7894";
        o.rmempty = true;

        o = s.taboption(tabname, form.Value, "dns_cache_max_size", _("DNS cache size:"));
        o.description = _("Maximum number of DNS cache entries kept by Mihomo.");
        o.default = common.defaultIPDnsCache[2].value;
        common.defaultIPDnsCache.forEach(item => {
            o.value(item.value, item.text);
        });
        o.rmempty = false;
        o.datatype = "integer";
        o.validate = function (section_id, value) {
            return common.validateIntegerRange(value, 1, 1048576);
        };

        tabname = "dnsnameservers_tab";
        s.tab(tabname, _("Nameservers"));

        o = s.taboption(tabname, form.DynamicList, "default_nameserver", _("Default nameservers:"));
        o.description = _("Default nameservers used at startup. Recommended to use UDP ones.");
        o.rmempty = false;
        o.editable = true;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") return true;
            return common.validateDnsServer(value);
        };

        o = s.taboption(tabname, form.DynamicList, "proxy_server_nameserver", _("Proxy nameservers:"));
        o.description = _("Nameservers used to resolve proxy server hostnames.");
        o.rmempty = false;
        o.editable = true;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") return true;
            return common.validateDnsServer(value);
        };

        o = s.taboption(tabname, form.DynamicList, "direct_nameserver", _("Direct nameservers:"));
        o.description = _("Direct nameservers used for DIRECT rules.");
        o.rmempty = true;
        o.editable = true;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") return true;
            return common.validateDnsServer(value);
        };

        o = s.taboption(tabname, form.DynamicList, "nameserver", _("Nameservers:"));
        o.description = _("Main nameservers used for regular DNS queries.");
        o.rmempty = false;
        o.editable = true;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") return true;
            return common.validateDnsServer(value);
        };

        tabname = "dnspolicies_tab";
        s.tab(tabname, _("Policies"));

        o = s.taboption(tabname, form.DynamicList, "nameserver_policy", _("Nameserver policy:"));
        o.description = _("Domain-specific DNS policy in the format domain/nameserver. Domain matchers may include +., *. or *.");
        o.rmempty = true;
        o.editable = true;
        o.validate = function (section_id, value) {
            return common.validateNameserverPolicy(value);
        };

        tabname = "dnsfakeip_tab";
        s.tab(tabname, _("Fake IP"));

        o = s.taboption(tabname, form.Value, "fake_ip_range", _("Fake IP range:"));
        o.description = _("IPv4 CIDR range used for fake-IP responses.");
        o.default = "198.18.0.1/22";
        o.rmempty = false;
        o.readonly = true;
        o.datatype = "cidr4";

        o = s.taboption(tabname, form.Value, "fake_ip_range6", _("Fake IP range (IPv6):"));
        o.description = _("IPv6 CIDR range used for fake-IP responses.");
        o.default = "2001:2::1/48";
        o.rmempty = false;
        o.readonly = true;
        o.datatype = "cidr6";

        o = s.taboption(tabname, form.Value, "fake_ip_ttl", _("Fake IP TTL:"));
        o.description = _("TTL for fake-IP DNS responses (in seconds).");
        o.datatype = datatypes.UINTEGER;
        o.rmempty = false;
        common.defaultFakeIPTtlValues.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultFakeIPTtlValues[0].value;
        o.validate = function (section_id, value) {
            return common.validateIntegerRange(value, 1, 86400);
        };

        o = s.taboption(tabname, form.DynamicList, "fake_ip_exclude_rulesets", _("Force real IP rulesets:"));
        result.rulesetsItems.forEach(item => {
            o.value(item.rawName, item.readableName);
        });
        o.description = _("Select active RULE-SETs that should resolve through real IP before fake-IP matches are applied.");
        o.rmempty = true;
        o.retain = true;
        o.editable = true;
        o.optional = true;

        o = s.taboption(tabname, form.DynamicList, "fake_ip_exclude_geosites", _("Force real IP geosites:"));
        result.geositeItems.forEach(item => {
            o.value(item.rawName, item.readableName);
        });
        o.description = _("Select active GEOSITEs that should resolve through real IP before fake-IP matches are applied.");
        o.rmempty = true;
        o.retain = true;
        o.editable = true;
        o.optional = true;

        o = s.taboption(tabname, form.DynamicList, "fake_ip_exclude_domains", _("Force real IP rules:"));
        o.description = _("Entries that should resolve through real IP before fake-IP matches are applied; use plain suffixes like example.com.");
        o.rmempty = true;
        o.retain = true;
        o.editable = true;
        o.optional = true;
        o.validate = function (section_id, value) {
            return common.isValidDomainSuffix(value);
        };

        tabname = "dnshosts_tab";
        s.tab(tabname, _("Hosts"));

        o = s.taboption(tabname, form.Flag, "use_system_hosts", _("Use system hosts:"));
        o.description = _("Load DNS entries from the system hosts file when possible.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.DynamicList, "hosts", _("Hosts mapping:"));
        o.description = _("Domain-specific IP mapping in the format domain/ip (example: cloudflare-dns.com/1.1.1.1).");
        o.rmempty = true;
        o.editable = true;
        o.validate = function (section_id, value) {
            return common.validateHostsEntry(value);
        };

        const style = E("style", {}, `
            ul.dropdown { max-height:320px !important; }
            .cbi-value[data-name="dns_listen_port"] .cbi-value-title {
                color: var(--error-color-medium, #f44336) !important;
            }
        `);

        return m.render().then(formEl => E("div", {}, [style, formEl]));
    }
});
