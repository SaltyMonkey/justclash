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
        s = m.section(form.NamedSection, "settings", "main", _("Service configuration:"), _("Main configuration for service startup options and tasks."));

        tabname = "servicebasic_tab";
        s.tab(tabname, _("Basic settings"));

        o = s.taboption(tabname, form.Flag, "delayed_boot", _("Delayed boot:"));
        o.description = _("The service start will be delayed at router boot.");
        o.rmempty = false;
        o.default = primitives.FALSE;

        o = s.taboption(tabname, form.Value, "delayed_boot_value", _("Delayed boot timeout:"));
        o.datatype = datatypes.UINTEGER;
        common.defaultBootDelayValuesSec.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultBootDelayValuesSec[1].value;
        o.retain = true;
        o.depends("delayed_boot", primitives.TRUE);

        o.rmempty = false;
        o.description = _("Delay value for first start after boot in seconds.");

        o = s.taboption(tabname, form.Flag, "skip_environment_checks", _("Skip environment checks:"));
        o.description = _("Minor checks in script will be disabled at start.");
        o.rmempty = false;
        o.default = primitives.FALSE;

        o = s.taboption(tabname, form.Flag, "mihomo_persistent_temp_files", _("Persistent temp files:"));
        o.description = _("If enabled, the service will keep downloaded rules at persistent storage. WARNING! DANGEROUS FOR YOUR NAND!");
        o.rmempty = false;
        o.default = primitives.FALSE;

        o = s.taboption(tabname, form.Flag, "ntpd_start", _("Start ntpd:"));
        o.description = _("The service will start ntpd to sync system time and ensure TLS works correctly in system.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.Flag, "dnsmasq_apply_changes", _("Edit DNS server at startup:"));
        o.description = _("The service will edit DNS settings in dnsmasq configuration at start.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.Flag, "nft_apply_changes", _("Edit netfilter tables at startup:"));
        o.description = _("Service creates netfilter tables to redirect traffic to the TPROXY port.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.Flag, "nft_apply_changes_router", _("Edit router netfilter tables at start:"));
        o.description = _("Service creates netfilter tables to redirect traffic from router to the TPROXY port.");
        o.rmempty = false;
        o.default = primitives.FALSE;

        // copypasted from Podkop devs
        o = s.taboption(tabname, widgets.DeviceSelect, "tproxy_input_interfaces", _("Source network interface:"), _("Select the network interface from which the traffic will originate"));
        o.default = "br-lan";
        o.depends("nft_apply_changes", primitives.TRUE);
        o.retain = true;
        o.noaliases = true;
        o.nobridges = false;
        o.noinactive = false;
        o.multiple = true;
        o.description = "Select the network interface from which the traffic will originate";
        o.filter = function (section_id, value) {
            if (["wan", "phy0-ap0", "phy1-ap0", "pppoe-wan"].indexOf(value) !== -1) {
                return false;
            }

            var device = this.devices.filter(function (dev) {
                return dev.getName() === value;
            })[0];

            if (device) {
                var type = device.getType();
                return type !== "wifi" && type !== "wireless" && !type.includes("wlan");
            }

            return true;
        };

        o = s.taboption(tabname, form.ListValue, "nft_quic_mode", _("QUIC traffic from clients:"));
        o.description = _("Select a way how QUIC traffic will be handled by netfilter tables.");
        o.depends("nft_apply_changes", primitives.TRUE);
        o.retain = true;
        o.rmempty = false;
        o.default = common.defaultNftOptions[0].value;
        common.defaultNftOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });

        o = s.taboption(tabname, form.ListValue, "nft_dot_mode", _("DoT traffic from clients:"));
        o.description = _("Select a way how DoT traffic will be handled by netfilter tables.");
        o.depends("nft_apply_changes", primitives.TRUE);
        o.retain = true;
        o.rmempty = false;
        o.default = common.defaultNftOptions[0].value;
        common.defaultNftOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });

        o = s.taboption(tabname, form.ListValue, "nft_dot_quic_mode", _("DoQ traffic from clients:"));
        o.description = _("Select a way how DoQ traffic will be handled by netfilter tables.");
        o.depends("nft_apply_changes", primitives.TRUE);
        o.retain = true;
        o.rmempty = false;
        o.default = common.defaultNftOptions[0].value;
        common.defaultNftOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });

        o = s.taboption(tabname, form.ListValue, "nft_ntp_mode", _("NTP traffic from clients:"));
        o.description = _("Select a way how NTP traffic will be handled by netfilter tables.");
        o.depends("nft_apply_changes", primitives.TRUE);
        o.retain = true;
        o.rmempty = false;
        o.default = common.defaultNftOptions[0].value;
        common.defaultNftNtpOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });

        o = s.taboption(tabname, form.ListValue, "nft_ntp_mode_router", _("NTP traffic from router:"));
        o.description = _("Select a way how NTP traffic from router will be handled by netfilter tables.");
        o.depends("nft_apply_changes_router", primitives.TRUE);
        o.retain = true;
        o.rmempty = false;
        o.default = common.defaultNftOptions[0].value;
        common.defaultNftNtpOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });

        tabname = "serviceautomation_tab";
        s.tab(tabname, _("Tasks"));

        o = s.taboption(tabname, form.Flag, "mihomo_autorestart", _("Mihomo autorestart:"));
        o.description = _("When enabled, the service will configure Mihomo autorestart by cron string.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.ListValue, "mihomo_autoupdate", _("Mihomo autoupdate:"));
        common.defaultUpdateOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });
        o.description = _("Mode for Mihomo autoupdate job.");
        o.rmempty = false;
        o.default = common.defaultUpdateOptions[0].value;

        o = s.taboption(tabname, form.ListValue, "mihomo_autoupdate_channel", _("Mihomo autoupdate channel:"));
        common.defaultUpdateChannelOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });
        o.description = _("Update channel for Mihomo autoupdate job.");
        o.rmempty = false;
        o.default = common.defaultUpdateChannelOptions[0].value;

        o = s.taboption(tabname, form.Value, "mihomo_cron_autorestart_string", _("Mihomo autorestart cron:"));
        o.placeholder = "0 5 * * 0";
        o.default = "0 5 * * 0";
        o.rmempty = false;
        o.description = _("Special cron string for Mihomo autorestart job.");
        o.validate = function (section_id, value) {
            return (common.isValidCronString(value)) ? true : _("Invalid cron format. Expected: 'minute hour day month weekday' (e.g., '0 3 * * 0')");
        };

        o = s.taboption(tabname, form.Value, "mihomo_cron_update_string", _("Mihomo autoupdate cron:"));
        o.placeholder = "0 5 * * 0";
        o.default = "0 5 * * 0";
        o.rmempty = false;
        o.description = _("Special cron string for Mihomo autoupdate job.");
        o.validate = function (section_id, value) {
            return (common.isValidCronString(value)) ? true : _("Invalid cron format. Expected: 'minute hour day month weekday' (e.g., '0 3 * * 0')");
        };

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