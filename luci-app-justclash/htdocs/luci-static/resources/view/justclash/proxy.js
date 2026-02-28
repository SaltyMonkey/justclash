"use strict";
"require form";
"require view";
"require view.justclash.common as common";
"require tools.widgets as widgets";

return view.extend({

    render: function () {
        let m, s, o, tabname;

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

        s = m.section(form.NamedSection, "proxy", "proxy", _("Proxy settings"), _("Main proxy settings used by Mihomo."));

        tabname = "coresettings_tab";
        s.tab(tabname, _("Basic settings"));

        o = s.taboption(tabname, form.ListValue, "log_level", _("Logging level:"));
        common.defaultLoggingLevels.forEach(item => {
            o.value(item, _(`${item}`));
        });
        o.description = _("Choose how much information Mihomo writes to the log. Higher levels help with debugging, but create more log entries.");
        o.default = common.defaultLoggingLevels[0];
        o.rmempty = false;

        o = s.taboption(tabname, form.Value, "tproxy_port", _("Transparent proxy port:"));
        o.description = _("Port used for redirected TCP/UDP traffic. Change it only if this port is already used by another service.");
        o.datatype = datatypes.PORT;
        o.placeholder = "7893";
        o.default = "7893";
        o.rmempty = false;

        o = s.taboption(tabname, form.Flag, "use_mixed_port", _("Enable shared proxy port:"));
        o.description = _("Use one port for both HTTP(S) and SOCKS5 connections. This is useful when apps or devices connect to the router as a regular proxy.");
        o.default = primitives.FALSE;
        o.rmempty = false;

        o = s.taboption(tabname, form.Value, "mixed_port", _("Shared proxy port:"));
        o.description = _("Port that accepts both HTTP(S) and SOCKS5 connections from apps and devices on your network.");
        o.depends("use_mixed_port", primitives.TRUE);
        o.retain = true;
        o.datatype = datatypes.PORT;
        o.placeholder = "7892";
        o.default = "7892";
        o.rmempty = false;

        o = s.taboption(tabname, form.Flag, "unified_delay", _("Use one delay value:"));
        o.description = _("Use the same delay value when checking response time, so test results stay more consistent.");
        o.default = primitives.TRUE;
        o.rmempty = false;

        o = s.taboption(tabname, form.Flag, "tcp_concurrent", _("Try TCP connections in parallel:"));
        o.description = _("Try several TCP connections at the same time. This can help on unstable networks, but it may create extra connection attempts.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.ListValue, "global_client_fingerprint", _("Client profile for all connections:"));
        common.defaultFingerprints.forEach(item => {
            o.value(item, _(`${item}`));
        });
        o.description = _("How the client identifies itself for supported protocols. Leave the default unless your provider expects a specific profile.");
        o.default = common.defaultFingerprints[0];
        o.rmempty = false;

        o = s.taboption(tabname, form.Value, "global_ua", _("User-Agent for downloads:"));
        o.description = _("User-Agent sent when downloading external files such as subscriptions or rule lists.");
        o.default = common.defaultUserAgent;
        o.rmempty = false;

        o = s.taboption(tabname, form.Flag, "etag_support", _("Check whether files changed:"));
        o.description = _("Only download external files again when the server says they changed. This saves bandwidth and avoids unnecessary updates.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.Value, "keep_alive_idle", _("Idle time before connection check:"));
        o.description = _("How long to wait with no activity before checking whether the connection is still alive. Shorter values detect dead connections sooner.");
        o.datatype = datatypes.UINTEGER;
        o.rmempty = false;
        common.defaultKeepAliveSec.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultKeepAliveSec[0].value;

        o = s.taboption(tabname, form.Value, "keep_alive_interval", _("Connection check interval:"));
        o.description = _("How often to repeat that check after the connection becomes idle.");
        o.datatype = datatypes.UINTEGER;
        o.rmempty = false;
        common.defaultKeepAliveSec.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultKeepAliveSec[0].value;

        o = s.taboption(tabname, form.Flag, "profile_store_selected", _("Save profile data:"));
        o.description = _("Keep profile data when possible, so selected items can be restored after a restart.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.Flag, "profile_store_fake_ip", _("Save fake IP addresses:"));
        o.description = _("Keep assigned fake IP addresses when possible, which can reduce repeated DNS work after restarts.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        tabname = "apicontrollersettings_tab";
        s.tab(tabname, _("Controller/API settings"));

        // copypasted from Podkop devs
        o = s.taboption(tabname, widgets.NetworkSelect, "controller_bind_interface", _("Controller bind:"), _("Select which network will allow access to the API controller and dashboard."));
        o.default = "lan";
        o.optional = false;
        o.nocreate = true;
        o.multiple = false;
        o.description = _("Select which network will allow access to the API controller and dashboard.");

        o = s.taboption(tabname, form.Flag, "use_zashboard", _("Enable dashboard:"));
        o.description = _("Enable the web dashboard for Mihomo. Turn this on only if you need the dashboard interface.");
        o.default = primitives.FALSE;
        o.rmempty = false;

        o = s.taboption(tabname, form.Value, "api_password", _("API password:"));
        o.password = true;
        o.description = _("Password or token required to access the API controller.");
        o.rmempty = false;

        tabname = "dnssettings_tab";
        s.tab(tabname, _("DNS settings"));

        o = s.taboption(tabname, form.Value, "dns_listen_port", _("DNS listen port:"));
        o.description = _("Proxy DNS server listen port.");
        o.datatype = datatypes.PORT;
        o.placeholder = "7894";
        o.default = "7894";
        o.rmempty = false;

        o = s.taboption(tabname, form.Flag, "use_system_hosts", _("Use system hosts:"));
        o.description = _("Load DNS entries from system if possible.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.Value, "dns_cache_max_size", _("DNS cache size:"));
        o.description = _("IP DNS cache size.");
        o.default = common.defaultIPDnsCache[0].value;
        common.defaultIPDnsCache.forEach(item => {
            o.value(item.value, item.text);
        });
        o.rmempty = false;
        o.datatype = "integer";

        o = s.taboption(tabname, form.ListValue, "fake_ip_filter_mode", _("Fake IP filter:"));
        o.value("blacklist", _(`blacklist`));
        o.value("whitelist", _(`whitelist`));
        o.description = _("Fake IP working mode.");
        o.default = "whitelist";
        o.rmempty = false;

        o = s.taboption(tabname, form.Value, "fake_ip_range", _("Fake IP range:"));
        o.description = _("CIDR for fake IP.");
        o.default = "198.18.0.1/22";
        o.rmempty = false;
        o.readonly = true;
        o.datatype = "cidr4";

        o = s.taboption(tabname, form.Value, "fake_ip_ttl", _("Fake IP TTL:"));
        o.description = _("Time to live time for DNS records from fake IP.");
        o.datatype = datatypes.UINTEGER;
        o.rmempty = false;
        common.defaultFakeIPTtlValues.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultFakeIPTtlValues[0].value;

        o = s.taboption(tabname, form.DynamicList, "default_nameserver", _("Default nameservers:"));
        o.description = _("Default nameservers used at startup. Recommended to use UDP ones.");
        o.rmempty = false;
        o.editable = true;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") return true;
            if ((!common.isValidIpv4(value)) && (!common.isValidDomainProto(value)))
                return _("Invalid nameserver format. Allowed: quic://, https://, tls://, udp:// or IPv4.");

            return true;
        };
        o = s.taboption(tabname, form.DynamicList, "direct_nameserver", _("Direct nameservers:"));
        o.description = _("Direct nameservers used for DIRECT rules.");
        o.rmempty = false;
        o.editable = true;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") return true;
            if ((!common.isValidIpv4(value)) && (!common.isValidDomainProto(value)))
                return _("Invalid nameserver format. Allowed: quic://, https://, tls://, udp:// or IPv4.");

            return true;
        };
        o = s.taboption(tabname, form.DynamicList, "proxy_server_nameserver", _("Proxy nameservers:"));
        o.description = _("Nameservers used for proxy servers resolving.");
        o.rmempty = false;
        o.editable = true;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") return true;

            if ((!common.isValidIpv4(value)) && (!common.isValidDomainProto(value)))
                return _("Invalid nameserver format. Allowed: quic://, https://, tls://, udp:// or IPv4.");

            return true;
        };
        o = s.taboption(tabname, form.DynamicList, "nameserver", _("Nameservers:"));
        o.description = _("Nameservers used for all another traffic.");
        o.rmempty = false;
        o.editable = true;
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "") return true;
            if ((!common.isValidIpv4(value)) && (!common.isValidDomainProto(value)))
                return _("Invalid nameserver format. Allowed: quic://, https://, tls://, udp:// or IPv4.");

            return true;
        };

        o = s.taboption(tabname, form.DynamicList, "fake_ip_include_domains", _("Use fake IP for domains:"));
        o.description = _("Include selected domains for the Fake IP cache.");
        o.rmempty = false;
        o.retain = true;
        o.editable = true;
        o.optional = true;
        o.depends("fake_ip_filter_mode", "whitelist");

        o = s.taboption(tabname, form.DynamicList, "fake_ip_exclude_domains", _("Skip fake IP for domains:"));
        o.description = _("Exclude selected domains from the Fake IP cache. This can sometimes help with bugs in apps.");
        o.rmempty = false;
        o.retain = true;
        o.editable = true;
        o.optional = true;
        o.depends("fake_ip_filter_mode", "blacklist");

        tabname = "sniffersettings_tab";
        s.tab(tabname, _("Sniffer settings"));

        o = s.taboption(tabname, form.Flag, "sniffer_enable", _("Enable sniffer:"));
        o.description = _("Enable sniffer in proxy.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.Flag, "sniffer_parse_pure_ip", _("Parse pure IP:"));
        o.description = _("Force domain detection for traffic without resolved domain names.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.DynamicList, "sniffer_exclude_domain", _("Excluded from sniffer domains:"));
        o.description = _("Domains excluded from detailed analysis when possible. Sometimes this can help with errors in apps.");
        o.rmempty = false;
        o.editable = true;
        o.optional = true;

        o = s.taboption(tabname, form.DynamicList, "sniffer_force_domain", _("Forcefully sniff domains:"));
        o.description = _("Domains included for detailed analysis when possible. Sometimes this can help with errors in apps.");
        o.rmempty = false;
        o.editable = true;
        o.optional = true;

        o = s.taboption(tabname, form.DynamicList, "sniffer_skip_src_address", _("Exclude from sniffer SRC CIDR traffic:"));
        o.description = _("Domains excluded from detailed analysis when possible. Sometimes this can help with errors in apps.");
        o.rmempty = false;
        o.editable = true;
        o.optional = true;

        o = s.taboption(tabname, form.DynamicList, "sniffer_skip_dst_address", _("Exclude from sniffer DST CIDR traffic:"));
        o.description = _("Domains excluded from detailed analysis when possible. Sometimes this can help with errors in apps.");
        o.rmempty = false;
        o.editable = true;
        o.optional = true;

        tabname = "ntpsettings_tab";
        s.tab(tabname, _("NTP settings"));

        o = s.taboption(tabname, form.Flag, "core_ntp_enabled", _("Enable NTP client:"));
        o.description = _("Enable built-in NTP client in proxy.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.Value, "core_ntp_server", _("Endpoint NTP server:"));
        o.description = _("External NTP server for time syncing.");
        o.datatype = datatypes.IPADDR;
        common.defaultNtpServers.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultNtpServers[0].value;
        o.rmempty = false;

        o = s.taboption(tabname, form.Value, "core_ntp_port", _("NTP port:"));
        o.description = _("External NTP server port.");
        o.datatype = datatypes.PORT;
        o.rmempty = false;

        o = s.taboption(tabname, form.Value, "core_ntp_interval", _("NTP check interval:"));
        o.description = _("Interval to check time (in seconds).");
        o.datatype = datatypes.UINTEGER;
        o.rmempty = false;
        common.defaultNtpTimeoutCheckValuesSec.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultNtpTimeoutCheckValuesSec[1].value;

        o = s.taboption(tabname, form.Flag, "core_ntp_write_system", _("Write to system:"));
        o.description = _("Try to correct system time using the NTP server.");
        o.default = primitives.FALSE;
        o.rmempty = false;

        const style = E("style", {}, `
            .cbi-value {
                margin-bottom: 14px !important;
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
