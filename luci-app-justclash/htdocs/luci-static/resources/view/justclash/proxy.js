'use strict';
'require fs';
'require form';
'require uci';
'require ui';
'require view';


return view.extend({

    load: function() {
       return Promise.all([
            uci.load("justclash"),
        ]).catch(e => {
            ui.addNotification(null, E('p', _('Unable to read the contents') + ': %s '.format(e.message) ));
        });
    },
    render: function () {
         let m, s, o, tabname;

        m = new form.Map("justclash");

        s = m.section(form.NamedSection, 'proxy');
        s.anonymous = true;
        s.addremove = false;

        tabname = 'coresettings_tab';
        s.tab(tabname, "Core settings");

        o = s.taboption(tabname, form.ListValue, 'log_level', _('log_level'))
        o.value('no', _('str_no'));
        o.value('check', _('str_yes'));
        o.value('checkandupdate', _('str_check_and_update'));
        o.description = _("log_level_description");
        o.default = "no";

        o = s.taboption(tabname, form.Value, 'tproxy_port', _('tproxy_port'));
        o.description = _("tproxy_port_description");
        o.datatype = "port";

        o = s.taboption(tabname, form.Value, 'mixed_port', _('mixed_port'));
        o.description = _("mixed_port_description");
        o.datatype = "port";

        o = s.taboption(tabname, form.Flag, 'unified_delay', _('unified_delay'));
        o.description = _("unified_delay_description");
        o.default = 1;

        o = s.taboption(tabname, form.Value, 'routing_mark', _('routing_mark'));
        o.description = _("routing_mark_description");
        o.datatype = "uinteger";

        o = s.taboption(tabname, form.Value, 'tcp_concurrent', _('tcp_concurrent'));
        o.description = _("tcp_concurrent_description")

        o = s.taboption(tabname, form.Value, 'external_controller_port', _('external_controller_port'));
        o.description = _("external_controller_port_description")
        o.datatype = "uinteger";

        o = s.taboption(tabname, form.ListValue, 'global_client_fingerprint', _('global_client_fingerprint'))
        o.value('chrome', 'chrome')
        o.value('firefox', 'firefox')
        o.value('safari','safari');
        o.description = _("global_client_fingerprint_description");
        o.default = "chrome";

        o = s.taboption(tabname, form.Value, 'keep_alive_idle', _('keep_alive_idle'));
        o.description = _("keep_alive_idle_description")
        o.datatype = "uinteger";

        o = s.taboption(tabname, form.Value, 'keep_alive_interval', _('keep_alive_interval'));
        o.description = _("keep_alive_interval_description")
        o.datatype = "uinteger";

        o = s.taboption(tabname, form.Flag, 'profile_store_selected', _('profile_store_selected'));
        o.description = _("profile_store_selected_description")

        o = s.taboption(tabname, form.Flag, 'profile_store_fake_ip', _('profile_store_fake_ip'));
        o.description = _("profile_store_fake_ip_description")

        o = s.taboption(tabname, form.DynamicList, 'ignore_to_sniff_domains', _('ignore_to_sniff_domains'));
        o.description = _("ignore_to_sniff_domains_description")

        tabname = 'ntpsettings_tab';
        s.tab(tabname, "NTP settings");

        o = s.taboption(tabname, form.Flag, 'core_ntp_enabled', _("core_ntp_enabled"));
        o.description = _("core_ntp_enabled_description")

        o = s.taboption(tabname, form.Value, 'core_ntp_server', _('core_ntp_server'));
        o.description = _("core_ntp_server_description")
        o.datatype = "ipaddr";

        o = s.taboption(tabname, form.Value, 'core_ntp_port', _('core_ntp_port'));
        o.description = _("core_ntp_port_description")
        o.datatype = "port";

        o = s.taboption(tabname, form.Value, 'core_ntp_interval', _('core_ntp_interval'));
        o.description = _("core_ntp_interval_description")
        o.datatype = "uinteger";

        o = s.taboption(tabname, form.Flag, 'core_ntp_write_system', _('core_ntp_write_system'));
        o.description = _("core_ntp_write_system_description")
        o.default = 0;

        tabname = 'dnssettings_tab';
        s.tab(tabname, "DNS settings");

        o = s.taboption(tabname, form.Value, 'dns_listen_port', _('dns_listen_port'));
        o.description = _("dns_listen_port_description")
        o.datatype = "port";

        o = s.taboption(tabname, form.Flag, 'use_hosts', _('use_hosts'));
        o.description = _("use_hosts_description")

        o = s.taboption(tabname, form.Flag, 'use_system_hosts', _('use_system_hosts'));
        o.description = _("use_system_hosts_description")

        o = s.taboption(tabname, form.Value, 'fake_ip_range', _('fake_ip_range'));
        o.description = _("fake_ip_range_description")

        o = s.taboption(tabname, form.DynamicList, 'default_nameserver', _('default_nameserver'));
        o.description = _("default_nameserver_description")

        o = s.taboption(tabname, form.DynamicList, 'direct_nameserver', _('direct_nameserver'));
        o.description = _("direct_nameserver_description")

        o = s.taboption(tabname, form.DynamicList, 'proxy_server_nameserver', _('proxy_server_nameserver'));
        o.description = _("proxy_server_nameserver_description")

        o = s.taboption(tabname, form.DynamicList, 'nameserver', _('nameserver'));
        o.description = _("nameserver_description")

        o = s.taboption(tabname, form.DynamicList, 'ignore_fake_ip_domains', _('ignore_fake_ip_domains'));
        o.description = _("ignore_fake_ip_domains_description")

        let map_promise = m.render();
        return map_promise;
    }
});