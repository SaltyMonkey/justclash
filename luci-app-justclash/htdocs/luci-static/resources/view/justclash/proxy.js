"use strict";
"require fs";
"require form";
"require uci";
"require ui";
"require view";


return view.extend({

    load: function() {
       return Promise.all([
            uci.load("justclash"),
        ]).catch(e => {
            ui.addNotification(null, E("p", _("Unable to read the contents") + ": %s ".format(e.message) ));
        });
    },
    render: function () {
         let m, s, o, tabname;

        m = new form.Map("justclash");

        s = m.section(form.NamedSection, "proxy");
        s.anonymous = true;
        s.addremove = false;

        tabname = "coresettings_tab";
        s.tab(tabname, "Core settings");

        o = s.taboption(tabname, form.ListValue, "log_level", _("Logging level:"))
        o.value("no", _("str_no"));
        o.value("check", _("str_yes"));
        o.value("checkandupdate", _("str_check_and_update"));
        o.description = _("Set up logging level in mihomo core.");
        o.default = "no";

        o = s.taboption(tabname, form.Value, "tproxy_port", _("Tproxy port:"));
        o.description = _("Mihomo TProxy port for incoming traffic from user networks.");
        o.datatype = "port";

        o = s.taboption(tabname, form.Flag, "unified_delay", _("Unified delay:"));
        o.description = _("Unified delay for RTT checks.");
        o.default = 1;

        o = s.taboption(tabname, form.Value, "routing_mark", _("Routing mark:"));
        o.description = _("Special mark for internal routing tables.");
        o.datatype = "uinteger";

        o = s.taboption(tabname, form.Value, "tcp_concurrent", _("TCP concurrent:"));
        o.description = _("tcp_concurrent_description")

        o = s.taboption(tabname, form.Value, "external_controller_port", _("External controller port:"));
        o.description = _("API server port.")
        o.datatype = "uinteger";

        o = s.taboption(tabname, form.ListValue, "global_client_fingerprint", _("Global client fingerprint:"))
        o.value("chrome", "chrome")
        o.value("firefox", "firefox")
        o.value("safari","safari");
        o.description = _("Client fingerprint for protols which supports it.");
        o.default = "chrome";

        o = s.taboption(tabname, form.Value, "keep_alive_idle", _("Keep alive idle:"));
        o.description = _("keep_alive_idle_description")
        o.datatype = "uinteger";

        o = s.taboption(tabname, form.Value, "keep_alive_interval", _("Keep alive interval:"));
        o.description = _("keep_alive_interval_description")
        o.datatype = "uinteger";

        o = s.taboption(tabname, form.Flag, "profile_store_selected", _("profile_store_selected"));
        o.description = _("profile_store_selected_description")

        o = s.taboption(tabname, form.Flag, "profile_store_fake_ip", _("profile_store_fake_ip"));
        o.description = _("profile_store_fake_ip_description")

        o = s.taboption(tabname, form.DynamicList, "ignore_to_sniff_domains", _("Skip analyse for domains:"));
        o.description = _("ignore_to_sniff_domains_description")

        tabname = "ntpsettings_tab";
        s.tab(tabname, "NTP settings");

        o = s.taboption(tabname, form.Flag, "core_ntp_enabled", _("Enable NTP client:"));
        o.description = _("core_ntp_enabled_description")

        o = s.taboption(tabname, form.Value, "core_ntp_server", _("Endpoint NTP server:"));
        o.description = _("core_ntp_server_description")
        o.datatype = "ipaddr";

        o = s.taboption(tabname, form.Value, "core_ntp_port", _("NTP port:"));
        o.description = _("core_ntp_port_description")
        o.datatype = "port";

        o = s.taboption(tabname, form.Value, "core_ntp_interval", _("Check interval"));
        o.description = _("core_ntp_interval_description")
        o.datatype = "uinteger";

        o = s.taboption(tabname, form.Flag, "core_ntp_write_system", _("Write to system:"));
        o.description = _("core_ntp_write_system_description")
        o.default = 0;

        tabname = "dnssettings_tab";
        s.tab(tabname, "DNS settings");

        o = s.taboption(tabname, form.Value, "dns_listen_port", _("DNS listen port:"));
        o.description = _("dns_listen_port_description")
        o.datatype = "port";

        o = s.taboption(tabname, form.Flag, "use_system_hosts", _("Use system hosts:"));
        o.description = _("use_system_hosts_description")

        o = s.taboption(tabname, form.Value, "fake_ip_range", _("Fake IP range:"));
        o.description = _("fake_ip_range_description")

        o = s.taboption(tabname, form.DynamicList, "default_nameserver", _("Default nameservers:"));
        o.description = _("default_nameserver_description")

        o = s.taboption(tabname, form.DynamicList, "direct_nameserver", _("Direct nameservers:"));
        o.description = _("direct_nameserver_description")

        o = s.taboption(tabname, form.DynamicList, "proxy_server_nameserver", _("Proxy nameservers:"));
        o.description = _("proxy_server_nameserver_description")

        o = s.taboption(tabname, form.DynamicList, "nameserver", _("Nameservers:"));
        o.description = _("nameserver_description")

        o = s.taboption(tabname, form.DynamicList, "ignore_fake_ip_domains", _("Skip fake ip for domains:"));
        o.description = _("ignore_fake_ip_domains_description")

        let map_promise = m.render();
        return map_promise;
    }
});