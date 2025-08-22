"use strict";
"require form";
"require ui";
"require view";
"require view.justclash.common as common";
"require tools.widgets as widgets";

return view.extend({
    render: function () {
        let m, s, o, tabname;

        m = new form.Map(common.binName);
        s = m.section(form.NamedSection, "settings");

        tabname = "serviceautomation_tab";
        s.tab(tabname, _("Basic settings"));

        o = s.taboption(tabname, form.Flag, "delayed_boot", _("Delayed boot:"));
        o.description = _("If enabled, the service start will be delayed at router boot.");
        o.rmempty = false;
        o.default = "0";

        o = s.taboption(tabname, form.Value, "delayed_boot_value", _("Delayed boot timeout:"));
        o.datatype = "uinteger";
        o.placeholder = "10";
        o.depends("delayed_boot", "1");
        o.rmempty = true;
        o.description = _("Delay timeout value in seconds.");

        o = s.taboption(tabname, form.Flag, "mihomo_persistent_temp_files", _("Persistent temp files:"));
        o.description = _("If enabled, the service will keep downloaded rules at persistent storage. WARNING! DANGEROUS FOR YOUR NAND!");
        o.rmempty = false;
        o.default = "0";

        o = s.taboption(tabname, form.Flag, "ntpd_start", _("Start ntpd:"));
        o.description = _("If enabled, the service starts ntpd to sync system time and ensure TLS works correctly.");
        o.rmempty = false;
        o.default = "1";

        o = s.taboption(tabname, form.Flag, "dnsmasq_apply_changes", _("Edit DNS server at startup:"));
        o.description = _("If enabled, the service will edit DNS settings in dnsmasq configuration at start.");
        o.rmempty = false;
        o.default = "1";

        o = s.taboption(tabname, form.Flag, "nft_apply_changes", _("Edit NF tables at startup:"));
        o.description = _("If enabled, the service creates NF tables to redirect traffic to the TPROXY port.");
        o.rmempty = false;
        o.default = "1";

        o = s.taboption(tabname, form.Flag, "nft_block_quic", _("Block QUIC from clients:"));
        o.description = _("If enabled, the service will block QUIC traffic with nf tables. Can solve issues with streams sometimes.");
        o.depends("nft_apply_changes", "1");
        o.rmempty = false;
        o.default = "0";

        o = s.taboption(tabname, form.Flag, "nft_block_dot", _("Block DoT from clients:"));
        o.description = _("If enabled, the service will block DOT traffic with nf tables. Can solve DNS issues for some hardware.");
        o.depends("nft_apply_changes", "1");
        o.rmempty = false;
        o.default = "0";

        o = s.taboption(tabname, form.Flag, "nft_block_dot_quic", _("Block DoQ from clients:"));
        o.description = _("If enabled, the service will block DOT traffic with nf tables. Can solve DNS issues for some hardware.");
        o.depends("nft_apply_changes", "1");
        o.rmempty = false;
        o.default = "0";

        o = s.taboption(tabname, form.Flag, "nft_block_ntp", _("Block NTP from clients:"));
        o.description = _("If enabled, the service will block NTP traffic with nf tables.");
        o.depends("nft_apply_changes", "1");
        o.rmempty = false;
        o.default = "0";

        // copypasted from Podkop devs
        o = s.taboption(tabname, widgets.DeviceSelect, "tproxy_input_interfaces", _("Source network interface:"), _("Select the network interface from which the traffic will originate"));
        o.default = "br-lan";
        o.depends("nft_apply_changes", "1");
        o.noaliases = true;
        o.nobridges = false;
        o.noinactive = false;
        o.multiple = true;
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

        o = s.taboption(tabname, form.DynamicList, "tproxy_excluded_ip", _("Exclude IP from tproxy:"));
        o.description = _("Each element is IPv4 to exclude from tproxy access.");
        o.rmempty = false;
        o.placeholder = "192.168.31.123";
        o.editable = true;
        o.validate = function (section_id, value) {
            if (!value || value.trim().length === 0)
                return true;

            return (common.isValidIpv4(value));
        };

        tabname = "coreautomation_tab";
        s.tab(tabname, _("Tasks"));

        o = s.taboption(tabname, form.Flag, "mihomo_autorestart", _("Mihomo autorestart:"));
        o.description = _("When enabled, the service will configure Mihomo autorestart by cron string.");
        o.rmempty = false;
        o.default = "1";

        o = s.taboption(tabname, form.ListValue, "mihomo_update_channel", _("Mihomo autoupdate channel:"));
        common.defaultProxyUpdateChannelOptions.forEach(item => {
            o.value(item, _(`${item}`));
        });
        o.description = _("Update channel for Mihomo. Recommended: alpha.");
        o.rmempty = false;
        o.default = common.defaultProxyUpdateChannelOptions[0];

        o = s.taboption(tabname, form.ListValue, "mihomo_autoupdate", _("Mihomo autoupdate:"));
        common.defaultUpdateOptions.forEach(item => {
            o.value(item, _(`${item}`));
        });
        o.description = _("Mode for Mihomo autoupdate job.");
        o.rmempty = false;
        o.default = common.defaultUpdateOptions[0];

        o = s.taboption(tabname, form.Flag, "mihomo_cron_autorestart_telegram_notify", _("Telegram notify for Mihomo autorestart:"));
        o.description = _("When enabled, the service will send Telegram notification for Mihomo autorestart cron job.");
        o.rmempty = false;
        o.default = "0";

        o = s.taboption(tabname, form.Flag, "mihomo_cron_update_telegram_notify", _("Telegram notify for Mihomo autoupdate:"));
        o.description = _("When enabled, the service will send Telegram notification for Mihomo autoupdate cron job.");
        o.rmempty = false;

        o = s.taboption(tabname, form.Value, "mihomo_cron_autorestart_string", _("Mihomo autorestart cron:"));
        o.placeholder = "0 3 * * 0";
        o.default = "0 3 * * 0";
        o.rmempty = false;
        o.description = _("Special cron string for Mihomo autorestart job.");
        o.validate = function (section_id, value) {
            return (common.isValidCronString(value)) ? true : _("Invalid cron format. Expected: 'minute hour day month weekday' (e.g., '0 3 * * 0')");
        };

        o = s.taboption(tabname, form.Value, "mihomo_cron_update_string", _("Mihomo autoupdate cron:"));
        o.placeholder = "0 3 * * 0";
        o.default = "0 3 * * 0";
        o.rmempty = false;
        o.description = _("Special cron string for Mihomo autoupdate job.");
        o.validate = function (section_id, value) {
            return (common.isValidCronString(value)) ? true : _("Invalid cron format. Expected: 'minute hour day month weekday' (e.g., '0 3 * * 0')");
        };

        tabname = "telegramcredentials_tab";
        s.tab(tabname, _("Credentials"));

        o = s.taboption(tabname, form.Value, "telegram_chat_id", _("Telegram chat ID:"));
        o.datatype = "uinteger";
        o.placeholder = "123456789";
        o.rmempty = true;
        o.description = _("Telegram chat ID where to send notification.");

        o = s.taboption(tabname, form.Value, "telegram_bot_token", _("Telegram bot token:"));
        o.placeholder = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
        o.description = _("Telegram bot control token. WARNING! NEVER SEND IT TO ANYONE!");
        o.rmempty = true;
        o.password = true;
        o.validate = function (section_id, value) {
            return (common.isValidTelegramBotToken(value)) ? true : _("Invalid Telegram Bot Token");
        };

        let map_promise = m.render();
        return map_promise;
    },
    addCSS() {
        return E("style", {}, `

        `);
    },
    destroy() {

    }
});