"use strict";
"require form";
"require ui";
"require view";
"require view.justclash.common as common";


return view.extend({

    render: function () {
        let m, s, o, tabname;

        m = new form.Map(common.binName);

        s = m.section(form.NamedSection, "proxy");

        tabname = "coresettings_tab";
        s.tab(tabname, _("Basic settings"));

        o = s.taboption(tabname, form.ListValue, "log_level", _("Logging level:"));
        common.defaultLoggingLevels.forEach(item => {
            o.value(item, _(`${item}`));
        });
        o.description = _("Logging level in Mihomo core.");
        o.default = common.defaultLoggingLevels[0];
        o.rmempty = false;

        o = s.taboption(tabname, form.Value, "tproxy_port", _("Tproxy port:"));
        o.description = _("Listening port of Mihomo Transparent Proxy (TPROXY) for redirected TCP/UDP traffic.");
        o.datatype = "port";
        o.rmempty = false;

        o = s.taboption(tabname, form.Flag, "use_mixed_port", _("Enable mixed port:"));
        o.description = _("Enable mixed port to allow incoming connections supporting both HTTP(S) and SOCKS5 protocols.");
        o.default = "0";
        o.rmempty = false;

        o = s.taboption(tabname, form.Value, "mixed_port", _("Mixed port:"));
        o.description = _("Mihomo mixed port for handling incoming traffic with support for HTTP(S) and SOCKS5 protocols.");
        o.depends("use_mixed_port", "1");
        o.datatype = "port";
        o.rmempty = false;

        o = s.taboption(tabname, form.Flag, "unified_delay", _("Unified delay:"));
        o.description = _("Unified delay for RTT checks.");
        o.default = "1";
        o.rmempty = false;

        o = s.taboption(tabname, form.Flag, "tcp_concurrent", _("TCP concurrent:"));
        o.description = _("Enable concurrent TCP connection attempts.");
        o.rmempty = false;
        o.default = "1";

        o = s.taboption(tabname, form.Value, "external_controller_port", _("External controller port:"));
        o.description = _("API server port for the external controller.");
        o.datatype = "uinteger";
        o.rmempty = false;

        o = s.taboption(tabname, form.ListValue, "global_client_fingerprint", _("Global client fingerprint:"));
        common.defaultFingerprints.forEach(item => {
            o.value(item, _(`${item}`));
        });
        o.description = _("Client fingerprint for protocols that support it.");
        o.default = common.defaultFingerprints[0];
        o.rmempty = false;

        o = s.taboption(tabname, form.Value, "global_ua", _("Global user agent:"));
        o.description = _("Global UA for external resources download.");
        o.default = common.defaultUserAgent;
        o.rmempty = false;

        o = s.taboption(tabname, form.Flag, "etag_support", _("ETag support:"));
        o.description = _("ETag support for external resources download.");
        o.rmempty = false;
        o.default = "1";

        o = s.taboption(tabname, form.Value, "keep_alive_idle", _("Keep alive idle:"));
        o.description = _("How long a connection can remain idle before the system starts sending keep-alive probes to check if the other end is still responsive.");
        o.datatype = "uinteger";
        o.rmempty = false;
        o.default = "15";

        o = s.taboption(tabname, form.Value, "keep_alive_interval", _("Keep alive interval:"));
        o.description = _("How frequently TCP keepalive probes are sent after a connection has been idle for the duration specified by keep-alive idle.");
        o.datatype = "uinteger";
        o.rmempty = false;
        o.default = "15";

        o = s.taboption(tabname, form.Flag, "profile_store_selected", _("Cache profile data:"));
        o.description = _("Cache profile data if possible.");
        o.rmempty = false;
        o.default = "1";

        o = s.taboption(tabname, form.Flag, "profile_store_fake_ip", _("Cache Fake IP:"));
        o.description = _("Cache fake IP data when possible.");
        o.rmempty = false;
        o.default = "1";

        o = s.taboption(tabname, form.DynamicList, "ignore_to_sniff_domains", _("Excluded from sniffer domains:"));
        o.description = _("Domains excluded from detailed analysis when possible. Sometimes this can help with errors in apps.");
        o.rmempty = false;
        o.editable = true;

        tabname = "dnssettings_tab";
        s.tab(tabname, _("DNS settings"));

        o = s.taboption(tabname, form.Value, "dns_listen_port", _("DNS listen port:"));
        o.description = _("Proxy DNS server listen port.");
        o.datatype = "port";
        o.rmempty = false;

        o = s.taboption(tabname, form.Flag, "use_system_hosts", _("Use system hosts:"));
        o.description = _("Load DNS entries from system if possible.");
        o.rmempty = false;
        o.default = "1";

        o = s.taboption(tabname, form.Value, "dns_cache_max_size", _("DNS cache size:"));
        o.description = _("DNS cache size.");
        o.default = "1024";
        o.rmempty = false;
        o.datatype = "integer";

        o = s.taboption(tabname, form.ListValue, "fake_ip_filter_mode", _("Fake IP filter:"));
        o.value("blacklist", _(`blacklist`));
        o.value("whitelist", _(`whitelist`))
        o.description = _("Fake IP working mode.");
        o.default = "whitelist"
        o.rmempty = false;

        o = s.taboption(tabname, form.Value, "fake_ip_range", _("Fake IP range:"));
        o.description = _("CIDR for fake IP.");
        o.default = "198.18.0.1/22";
        o.rmempty = false;
        o.readonly = true;
        o.datatype = "cidr4";

        o = s.taboption(tabname, form.DynamicList, "default_nameserver", _("Default nameservers:"));
        o.description = _("Default nameservers used at startup. Recommended to use UDP ones.");
        o.rmempty = false;
        o.editable = true;
        o.validate = function (section_id, value) {
            if (!value || (value && value.length === 0)) return true;
            if ((!common.isValidIpv4(value)) && (!common.isValidDomainProto(value)))
                return _("Invalid nameserver format. Allowed: quic://, https://, tls://, udp:// or IPv4.");

            return true;
        };
        o = s.taboption(tabname, form.DynamicList, "direct_nameserver", _("Direct nameservers:"));
        o.description = _("Direct nameservers used for DIRECT rules.");
        o.rmempty = false;
        o.editable = true;
        o.validate = function (section_id, value) {
            if (!value || (value && value.length === 0)) return true;
            if ((!common.isValidIpv4(value)) && (!common.isValidDomainProto(value)))
                return _("Invalid nameserver format. Allowed: quic://, https://, tls://, udp:// or IPv4.");

            return true;
        };
        o = s.taboption(tabname, form.DynamicList, "proxy_server_nameserver", _("Proxy nameservers:"));
        o.description = _("Proxy nameservers used for proxy rules.");
        o.rmempty = false;
        o.editable = true;
        o.validate = function (section_id, value) {
            if (!value || (value && value.length === 0)) return true;

            if ((!common.isValidIpv4(value)) && (!common.isValidDomainProto(value)))
                return _("Invalid nameserver format. Allowed: quic://, https://, tls://, udp:// or IPv4.");

            return true;
        };
        o = s.taboption(tabname, form.DynamicList, "nameserver", _("Nameservers:"));
        o.description = _("nameserver_description");
        o.rmempty = false;
        o.editable = true;
        o.validate = function (section_id, value) {
            if (!value || (value && value.length === 0)) return true;
            if ((!common.isValidIpv4(value)) && (!common.isValidDomainProto(value)))
                return _("Invalid nameserver format. Allowed: quic://, https://, tls://, udp:// or IPv4.");

            return true;
        };

        o = s.taboption(tabname, form.DynamicList, "custom_fake_ip_domains", _("Use fake IP for domains:"));
        o.description = _("Include selected domains for the Fake IP cache.");
        o.rmempty = false;
        o.editable = true;
        o.depends("fake_ip_filter_mode", "whitelist");

        o = s.taboption(tabname, form.DynamicList, "ignore_fake_ip_domains", _("Skip fake IP for domains:"));
        o.description = _("Exclude selected domains from the Fake IP cache. This can sometimes help with bugs in apps.");
        o.rmempty = false;
        o.editable = true;
        o.depends("fake_ip_filter_mode", "blacklist");

        tabname = "ntpsettings_tab";
        s.tab(tabname, _("NTP settings"));

        o = s.taboption(tabname, form.Flag, "core_ntp_enabled", _("Enable NTP client:"));
        o.description = _("Enable built-in NTP client in proxy.");
        o.rmempty = false;
        o.default = "1";

        o = s.taboption(tabname, form.Value, "core_ntp_server", _("Endpoint NTP server:"));
        o.description = _("External NTP server for time syncing.");
        o.datatype = "ipaddr";
        o.rmempty = false;

        o = s.taboption(tabname, form.Value, "core_ntp_port", _("NTP port:"));
        o.description = _("External NTP server port.");
        o.datatype = "port";
        o.rmempty = false;

        o = s.taboption(tabname, form.Value, "core_ntp_interval", _("NTP check interval:"));
        o.description = _("Interval to check time (in seconds).");
        o.datatype = "uinteger";
        o.rmempty = false;
        o.default = "600";

        o = s.taboption(tabname, form.Flag, "core_ntp_write_system", _("Write to system:"));
        o.description = _("Try to correct system time using the NTP server.");
        o.default = "0";
        o.rmempty = false;

        let map_promise = m.render();
        return map_promise;
    },
    destroy() {

    }
});