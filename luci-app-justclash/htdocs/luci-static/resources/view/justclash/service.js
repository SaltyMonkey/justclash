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
        s = m.section(form.NamedSection, "settings", "main", _("Service settings:"), _("Main service settings and scheduled tasks."));

        tabname = "servicebasic_tab";
        s.tab(tabname, _("Basic settings"));

        o = s.taboption(tabname, form.Flag, "delayed_boot", _("Delay startup after boot:"));
        o.description = _("Start the service a little later after the router boots. Useful if the router needs extra time to bring up storage, WAN, or other services.");
        o.rmempty = false;
        o.default = primitives.FALSE;

        o = s.taboption(tabname, form.Value, "delayed_boot_value", _("Startup delay:"));
        o.datatype = datatypes.UINTEGER;
        common.defaultBootDelayValuesSec.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultBootDelayValuesSec[1].value;
        o.retain = true;
        o.depends("delayed_boot", primitives.TRUE);

        o.rmempty = false;
        o.description = _("Choose how many seconds to wait before the first service start after boot.");

        o = s.taboption(tabname, form.Flag, "skip_environment_checks", _("Skip startup checks:"));
        o.description = _("Skip some safety checks during startup. This can speed up startup, but it may hide problems with files, permissions, or system settings.");
        o.rmempty = false;
        o.default = primitives.FALSE;

        o = s.taboption(tabname, form.Flag, "mihomo_persistent_temp_files", _("Store downloaded lists in router memory:"));
        o.description = _("If enabled, downloaded rules stay in internal router storage after restart. Use this only if you need it, because frequent writes can wear out built-in flash memory faster.");
        o.rmempty = false;
        o.default = primitives.FALSE;

        o = s.taboption(tabname, form.Flag, "ntpd_start", _("Start time sync service:"));
        o.description = _("Start time sync so the system clock stays correct for secure connections. Without correct time, secure downloads and API connections may fail.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.Flag, "dnsmasq_apply_changes", _("Change DNS settings at startup:"));
        o.description = _("Update DNS settings automatically when the service starts. Use this if you want JustClash to manage dnsmasq DNS settings for you.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.Flag, "nft_apply_changes", _("Set traffic rules at startup:"));
        o.description = _("Create traffic rules so client devices use the proxy. Disable this only if you already manage traffic redirection rules outside JustClash.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.Flag, "nft_apply_changes_router", _("Set router traffic rules at startup:"));
        o.description = _("Create traffic rules so the router's own traffic also uses the proxy. Enable this only if you want updates, package installs, and other router traffic to go through the proxy too.");
        o.rmempty = false;
        o.default = primitives.FALSE;

        // copypasted from Podkop devs
        o = s.taboption(tabname, widgets.DeviceSelect, "tproxy_input_interfaces", _("Client traffic interface:"), _("Select which network interface client traffic comes from."));
        o.default = "br-lan";
        o.depends("nft_apply_changes", primitives.TRUE);
        o.retain = true;
        o.noaliases = true;
        o.nobridges = false;
        o.noinactive = false;
        o.multiple = true;
        o.description = _("Select which network interface client traffic comes from. This is usually your LAN bridge; do not select WAN unless you know exactly why.");
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

        o = s.taboption(tabname, form.ListValue, "nft_quic_mode", _("Client QUIC traffic:"));
        o.description = _("Choose how to handle QUIC traffic from devices on your network. The selected mode decides whether this traffic is redirected, bypassed, or blocked.");
        o.depends("nft_apply_changes", primitives.TRUE);
        o.retain = true;
        o.rmempty = false;
        o.default = common.defaultNftOptions[0].value;
        common.defaultNftOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });

        o = s.taboption(tabname, form.ListValue, "nft_dot_mode", _("Client DoT traffic:"));
        o.description = _("Choose how to handle DoT traffic from devices on your network. The selected mode decides whether this traffic is redirected, bypassed, or blocked.");
        o.depends("nft_apply_changes", primitives.TRUE);
        o.retain = true;
        o.rmempty = false;
        o.default = common.defaultNftOptions[0].value;
        common.defaultNftOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });

        o = s.taboption(tabname, form.ListValue, "nft_dot_quic_mode", _("Client DoQ traffic:"));
        o.description = _("Choose how to handle DoQ traffic from devices on your network. The selected mode decides whether this traffic is redirected, bypassed, or blocked.");
        o.depends("nft_apply_changes", primitives.TRUE);
        o.retain = true;
        o.rmempty = false;
        o.default = common.defaultNftOptions[0].value;
        common.defaultNftOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });

        o = s.taboption(tabname, form.ListValue, "nft_ntp_mode", _("Client NTP traffic:"));
        o.description = _("Choose how to handle time sync requests from devices on your network. The selected mode decides whether these requests are redirected, bypassed, or blocked.");
        o.depends("nft_apply_changes", primitives.TRUE);
        o.retain = true;
        o.rmempty = false;
        o.default = common.defaultNftOptions[0].value;
        common.defaultNftNtpOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });

        o = s.taboption(tabname, form.ListValue, "nft_ntp_mode_router", _("Router NTP traffic:"));
        o.description = _("Choose how to handle time sync requests from the router itself. The selected mode decides whether these requests are redirected, bypassed, or blocked.");
        o.depends("nft_apply_changes_router", primitives.TRUE);
        o.retain = true;
        o.rmempty = false;
        o.default = common.defaultNftOptions[0].value;
        common.defaultNftNtpOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });

        tabname = "serviceautomation_tab";
        s.tab(tabname, _("Scheduled tasks"));

        o = s.taboption(tabname, form.Flag, "mihomo_autorestart", _("Restart Mihomo automatically:"));
        o.description = _("Restart Mihomo on a schedule, for example once a week or once a day.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.ListValue, "mihomo_autoupdate", _("Update Mihomo automatically:"));
        common.defaultUpdateOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });
        o.description = _("Choose whether Mihomo should update automatically, and under what conditions.");
        o.rmempty = false;
        o.default = common.defaultUpdateOptions[0].value;

        o = s.taboption(tabname, form.ListValue, "mihomo_autoupdate_channel", _("Update channel:"));
        common.defaultUpdateChannelOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });
        o.description = _("Choose which release channel to use for automatic Mihomo updates. Stable is safer, while newer channels may include newer features and newer bugs.");
        o.rmempty = false;
        o.default = common.defaultUpdateChannelOptions[0].value;

        o = s.taboption(tabname, form.Value, "mihomo_cron_autorestart_string", _("Restart schedule:"));
        o.placeholder = "0 5 * * 0";
        o.default = "0 5 * * 0";
        o.rmempty = false;
        o.description = _("Use cron format to choose when Mihomo should restart automatically.");
        o.validate = function (section_id, value) {
            return (common.isValidCronString(value)) ? true : _("Invalid schedule format. Use: 'minute hour day month weekday' (for example, '0 3 * * 0')");
        };

        o = s.taboption(tabname, form.Value, "mihomo_cron_update_string", _("Update schedule:"));
        o.placeholder = "0 5 * * 0";
        o.default = "0 5 * * 0";
        o.rmempty = false;
        o.description = _("Use cron format to choose when Mihomo should check for updates automatically.");
        o.validate = function (section_id, value) {
            return (common.isValidCronString(value)) ? true : _("Invalid schedule format. Use: 'minute hour day month weekday' (for example, '0 3 * * 0')");
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
