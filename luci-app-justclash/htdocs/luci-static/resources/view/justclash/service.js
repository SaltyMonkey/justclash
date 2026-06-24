"use strict";
"require form";
"require view";
"require view.justclash.helper_common as common";
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
            CIDR4: "cidr4",
            MACADDR: "macaddr",
            IP4ADDR: "ip4addr"
        };

        m = new form.Map(common.binName);
        s = m.section(form.NamedSection, "settings", "main", _("Service settings:"), _("Main service settings and scheduled tasks."));

        tabname = "servicestartup_tab";
        s.tab(tabname, _("Startup"));

        o = s.taboption(tabname, form.Flag, "wait_for_wan", _("Wait for WAN connection on boot:"));
        o.description = _("Pause the startup process until the router establishes an active Internet connection (default route).");
        o.rmempty = false;
        o.default = primitives.FALSE;

        o = s.taboption(tabname, form.ListValue, "wait_for_wan_max", _("Maximum wait time for WAN (s):"));
        common.defaultWaitForWanMaxValues.forEach(item => {
            o.value(item.value, item.text);
        });
        o.datatype = datatypes.UINTEGER;
        o.default = "90";
        o.retain = true;
        o.depends("wait_for_wan", primitives.TRUE);
        o.description = _("Maximum time in seconds to wait for WAN connection before proceeding with the current state.");
        o.rmempty = false;

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

        o = s.taboption(tabname, form.Flag, "ntpd_start", _("Start time sync service:"));
        o.description = _("Start the built-in ntpd daemon so the system clock stays correct for secure connections. Without correct time, secure downloads and API connections may fail.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.ListValue, "mihomo_mem_limit", _("GOMEMLIMIT (Memory limit):"));
        common.defaultGoMemLimitValues.forEach(item => {
            o.value(item.value, item.text);
        });
        o.description = _("Limit the Go garbage collector memory usage (in MiB). Select a predefined limit or 0 to disable.");
        o.datatype = datatypes.STRING;
        o.rmempty = false;
        o.default = common.defaultGoMemLimitValues[0].value;

        tabname = "servicestorage_tab";
        s.tab(tabname, _("Storage"));

        o = s.taboption(tabname, form.Flag, "mihomo_persistent_ext_rules", _("Store Mihomo external rules persistently:"));
        o.description = _("Keep Mihomo external rule files in persistent router storage instead of temporary memory. Use this only if you need faster recovery after restart, because frequent writes can wear out built-in flash memory faster.");
        o.rmempty = false;
        o.default = primitives.FALSE;

        o = s.taboption(tabname, form.Flag, "mihomo_persistent_cache", _("Store Mihomo cache persistently:"));
        o.description = _("Keep Mihomo cache data such as selected groups and fake-IP mappings in persistent router storage instead of temporary memory. Use this only if you need it, because frequent writes can wear out built-in flash memory faster.");
        o.rmempty = false;
        o.default = primitives.FALSE;

        tabname = "servicetraffic_tab";
        s.tab(tabname, _("Traffic rules"));

        o = s.taboption(tabname, form.Flag, "dnsmasq_apply_changes", _("Change DNS settings at startup:"));
        o.description = _("Update DNS settings automatically when the service starts. Use this if you want JustClash to manage dnsmasq DNS settings for you.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.Flag, "nft_apply_changes", _("Set traffic rules at startup:"));
        o.description = _("Create traffic rules so client devices use the proxy. Disable this only if you already manage traffic redirection rules outside JustClash.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.Value, "pbr_priority", _("PBR priority:"));
        o.description = _("Priority for the policy routing rule that sends marked traffic to the local TPROXY table. Lower numbers run earlier.");
        o.datatype = datatypes.UINTEGER;
        o.default = "169";
        o.rmempty = false;
        o.retain = true;
        o.depends("nft_apply_changes", primitives.TRUE);
        o.validate = function (section_id, value) {
            return common.validateIntegerRange(value, 1, 32766);
        };

        o = s.taboption(tabname, form.Flag, "nft_apply_changes_router", _("Set router traffic rules at startup:"));
        o.description = _("Create traffic rules so the router's own traffic also uses the proxy. Enable this only if you want updates, package installs, and other router traffic to go through the proxy too.");
        o.rmempty = false;
        o.default = primitives.FALSE;

        o = s.taboption(tabname, form.DynamicList, "nft_skuid_exclude_router", _("Router socket owner exclusions:"));
        o.description = _("User names or numeric UIDs for router-originated sockets that should bypass proxy redirection rules. Useful for services like byedpi or https-dns-proxy that must reach the internet directly.");
        o.placeholder = "byedpi";
        o.rmempty = true;
        o.retain = true;
        o.depends("nft_apply_changes_router", primitives.TRUE);
        o.validate = function (section_id, value) {
            return common.validateUsernameOrUid(value);
        };

        o = s.taboption(tabname, form.DynamicList, "nft_ports_exclude_router", _("Router bypassed ports:"));
        o.description = _("Ports (destination or source, e.g., 22 or 80) for router traffic to bypass the proxy.");
        o.placeholder = "22";
        o.rmempty = true;
        o.retain = true;
        o.datatype = datatypes.PORT;
        o.depends("nft_apply_changes_router", primitives.TRUE);

        // copypasted from Podkop devs
        o = s.taboption(tabname, widgets.DeviceSelect, "tproxy_input_interfaces", _("Client traffic interfaces:"));
        o.default = "br-lan";
        o.depends("nft_apply_changes", primitives.TRUE);
        o.retain = true;
        o.noaliases = true;
        o.nobridges = false;
        o.noinactive = false;
        o.multiple = true;
        o.description = _("Select which interfaces receive client traffic that should be processed by JustClash. This is usually your LAN bridge; do not select WAN unless you know exactly why.");
        o.filter = common.filterInboundDeviceSelect;

        o = s.taboption(tabname, form.DynamicList, "nft_ports_exclude", _("Client bypassed ports:"));
        o.description = _("Ports (destination or source, e.g., 22 or 80) for client traffic to bypass the proxy.");
        o.placeholder = "22";
        o.rmempty = true;
        o.retain = true;
        o.datatype = datatypes.PORT;
        o.depends("nft_apply_changes", primitives.TRUE);

        o = s.taboption(tabname, form.DynamicList, "nft_mac_exclude", _("Client bypassed MAC addresses:"));
        o.description = _("MAC addresses of clients that should bypass the proxy.");
        o.placeholder = "00:11:22:33:44:55";
        o.rmempty = true;
        o.retain = true;
        o.datatype = datatypes.MACADDR;
        o.depends("nft_apply_changes", primitives.TRUE);

        o = s.taboption(tabname, form.DynamicList, "nft_ips_exclude", _("Client bypassed IP addresses:"));
        o.description = _("IP addresses or subnets (CIDR) of clients that should bypass the proxy.");
        o.placeholder = "192.168.1.100";
        o.rmempty = true;
        o.retain = true;
        o.datatype = datatypes.IP4ADDR;
        o.depends("nft_apply_changes", primitives.TRUE);

        o = s.taboption(tabname, form.ListValue, "nft_quic_mode", _("Client QUIC traffic:"));
        o.description = _("Choose how to handle QUIC traffic from devices on the selected client traffic interfaces. The selected mode decides whether this traffic is redirected or blocked.");
        o.depends("nft_apply_changes", primitives.TRUE);
        o.retain = true;
        o.rmempty = false;
        o.default = common.defaultNftOptions[0].value;
        common.defaultNftOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });

        o = s.taboption(tabname, form.ListValue, "nft_dot_mode", _("Client DoT traffic:"));
        o.description = _("Choose how to handle DoT traffic from devices on your network. The selected mode decides whether this traffic is redirected or blocked.");
        o.depends("nft_apply_changes", primitives.TRUE);
        o.retain = true;
        o.rmempty = false;
        o.default = common.defaultNftOptions[0].value;
        common.defaultNftOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });

        o = s.taboption(tabname, form.ListValue, "nft_doh_mode", _("Client DoH traffic:"));
        o.description = _("Choose how to handle DoH traffic from devices on your network to well-known DoH IPs. The selected mode decides whether this traffic is redirected or blocked.");
        o.depends("nft_apply_changes", primitives.TRUE);
        o.retain = true;
        o.rmempty = false;
        o.default = common.defaultNftOptions[0].value;
        common.defaultNftOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });

        o = s.taboption(tabname, form.ListValue, "nft_dot_quic_mode", _("Client DoQ traffic:"));
        o.description = _("Choose how to handle DoQ traffic from devices on your network. The selected mode decides whether this traffic is redirected or blocked.");
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
        o.default = common.defaultNftNtpOptions[0].value;
        common.defaultNftNtpOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });

        o = s.taboption(tabname, form.ListValue, "nft_ntp_mode_router", _("Router NTP traffic:"));
        o.description = _("Choose how to handle time sync requests from the router itself. The selected mode decides whether these requests are redirected, bypassed, or blocked.");
        o.depends("nft_apply_changes_router", primitives.TRUE);
        o.retain = true;
        o.rmempty = false;
        o.default = common.defaultNftNtpOptions[0].value;
        common.defaultNftNtpOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });

        tabname = "serviceautomation_tab";
        s.tab(tabname, _("Scheduled tasks"));

        o = s.taboption(tabname, form.Flag, "mihomo_autorestart", _("Restart Mihomo automatically:"));
        o.description = _("Restart Mihomo on a schedule, for example once a week or once a day.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.Value, "mihomo_cron_autorestart_string", _("Restart schedule:"));
        o.placeholder = "0 5 * * 0";
        o.default = "0 5 * * 0";
        o.rmempty = false;
        o.retain = true;
        o.depends("mihomo_autorestart", primitives.TRUE);
        o.description = _("Use cron format to choose when Mihomo should restart automatically.");
        o.validate = function (section_id, value) {
            return (common.isValidCronString(value)) ? true : _("Invalid schedule format. Use: 'minute hour day month weekday' (for example, '0 3 * * 0')");
        };

        o = s.taboption(tabname, form.Flag, "mihomo_service_data_autoupdate", _("Update rules and databases automatically:"));
        o.description = _("Update rules and databases on a schedule, for example once a week or once a day.");
        o.rmempty = false;
        o.default = primitives.FALSE;

        o = s.taboption(tabname, form.Value, "mihomo_cron_service_data_update_string", _("Update schedule:"));
        o.placeholder = "0 4 * * 0";
        o.default = "0 4 * * 0";
        o.rmempty = false;
        o.retain = true;
        o.depends("mihomo_service_data_autoupdate", primitives.TRUE);
        o.description = _("Use cron format to choose when rules and databases should update automatically.");
        o.validate = function (section_id, value) {
            return (common.isValidCronString(value)) ? true : _("Invalid schedule format. Use: 'minute hour day month weekday' (for example, '0 3 * * 0')");
        };

        o = s.taboption(tabname, form.Flag, "mihomo_scheduled_work", _("Enable scheduled work:"));
        o.description = _("Start and stop the proxy core on a daily schedule.");
        o.rmempty = false;
        o.default = primitives.FALSE;

        o = s.taboption(tabname, form.Value, "mihomo_cron_scheduled_work_start_string", _("Start schedule:"));
        o.placeholder = "0 5 * * *";
        o.default = "0 5 * * *";
        o.rmempty = false;
        o.retain = true;
        o.depends("mihomo_scheduled_work", primitives.TRUE);
        o.description = _("Use cron format to choose when the core should start.");
        o.validate = function (section_id, value) {
            return (common.isValidCronString(value)) ? true : _("Invalid schedule format.");
        };

        o = s.taboption(tabname, form.Value, "mihomo_cron_scheduled_work_stop_string", _("Stop schedule:"));
        o.placeholder = "0 23 * * *";
        o.default = "0 23 * * *";
        o.rmempty = false;
        o.retain = true;
        o.depends("mihomo_scheduled_work", primitives.TRUE);
        o.description = _("Use cron format to choose when the core should stop.");
        o.validate = function (section_id, value) {
            return (common.isValidCronString(value)) ? true : _("Invalid schedule format.");
        };

        tabname = "external_resources_tab";
        s.tab(tabname, _("External resources"));

        o = s.taboption(tabname, form.ListValue, "mihomo_core_source_type", _("Core update source:"));
        o.value("github", _("Github"));
        o.value("custom", _("Custom URL"));
        o.description = _("Choose where Mihomo core should be downloaded from. 'Github' will automatically fetch the latest release, 'Custom URL' allows downloading directly from your specified link.");
        o.rmempty = false;
        o.retain = true;
        o.default = "github";

        o = s.taboption(tabname, form.Value, "mihomo_github_repo", _("GitHub repository:"));
        o.description = _("GitHub repository for Mihomo core updates. Must be in the format 'username/repo'. Example: 'MetaCubeX/mihomo'.");
        o.placeholder = "MetaCubeX/mihomo";
        o.default = "MetaCubeX/mihomo";
        o.depends("mihomo_core_source_type", "github");
        o.rmempty = false;
        o.retain = true;

        o = s.taboption(tabname, form.ListValue, "mihomo_github_channel", _("Update channel:"));
        common.defaultUpdateChannelOptions.forEach(item => {
            o.value(item.value, `${item.text}`);
        });
        o.description = _("Choose which release channel to use for Mihomo updates. Stable is safer, while newer channels may include newer features and newer bugs.");
        o.depends("mihomo_core_source_type", "github");
        o.rmempty = false;
        o.retain = true;
        o.default = common.defaultUpdateChannelOptions[0].value;

        o = s.taboption(tabname, form.Value, "mihomo_custom_core_url", _("Custom core base URL:"));
        o.description = _("Base URL of the server hosting the core files (similar to GitHub releases). The server MUST contain a 'version.txt' file and the corresponding 'mihomo-linux-arch-version.gz' archives. Example: 'https://example.com/mihomo/'");
        o.placeholder = "https://example.com/mihomo";
        o.depends("mihomo_core_source_type", "custom");
        o.rmempty = false;
        o.retain = true;
        o.validate = function (section_id, value) {
            return common.validateHttpUrl(value);
        };

        o = s.taboption(tabname, form.Value, "mihomo_rulesets_files_download_url", _("Rulesets download URL:"));
        o.description = _("URL to download inbuild rulesets from. Leave empty to use the default.");
        o.rmempty = true;
        o.validate = function (section_id, value) {
            return common.validateHttpUrl(value);
        };

        o = s.taboption(tabname, form.Value, "mihomo_geosite_url", _("Geosite download URL:"));
        o.description = _("URL to download geosite.dat from. Leave empty to use the default.");
        o.rmempty = true;
        o.validate = function (section_id, value) {
            return common.validateHttpUrl(value);
        };

        o = s.taboption(tabname, form.Value, "mihomo_geoip_url", _("GeoIP download URL:"));
        o.description = _("URL to download geoip.dat from. Leave empty to use the default.");
        o.rmempty = true;
        o.validate = function (section_id, value) {
            return common.validateHttpUrl(value);
        };

        o = s.taboption(tabname, form.Value, "mihomo_dashboard_zashboard_url", _("Zashboard download URL:"));
        o.description = _("URL to download Zashboard dashboard from. Leave empty to use the default.");
        o.rmempty = true;
        o.validate = function (section_id, value) {
            return common.validateHttpZipUrl(value);
        };

        o = s.taboption(tabname, form.Value, "mihomo_dashboard_metacubexd_url", _("Metacubexd download URL:"));
        o.description = _("URL to download Metacubexd dashboard from. Leave empty to use the default.");
        o.rmempty = true;
        o.validate = function (section_id, value) {
            return common.validateHttpZipUrl(value);
        };

        o = s.taboption(tabname, form.Value, "mihomo_dashboard_yacd_meta_url", _("YACD-meta download URL:"));
        o.description = _("URL to download YACD-meta dashboard from. Leave empty to use the default.");
        o.rmempty = true;
        o.validate = function (section_id, value) {
            return common.validateHttpZipUrl(value);
        };

        const style = E("style", {}, `
            .cbi-value { margin-bottom:14px !important; }
            .cbi-value[data-name="ntpd_start"] .cbi-value-title,
            .cbi-value[data-name="nft_apply_changes_router"] .cbi-value-title,
            .cbi-value[data-name="dnsmasq_apply_changes"] .cbi-value-title,
            .cbi-value[data-name="nft_apply_changes"] .cbi-value-title,
            .cbi-value[data-name="tproxy_input_interfaces"] .cbi-value-title,
            .cbi-value[data-name="mihomo_github_channel"] .cbi-value-title,
            .cbi-value[data-name="wait_for_wan"] .cbi-value-title,
            .cbi-value[data-name="delayed_boot"] .cbi-value-title {
                border-left: 4px solid var(--error-color-medium, #f44336) !important;
                padding-left: 12px !important;
            }
        `);

        return m.render().then(formEl => { return E("div", {}, [ style, formEl ]);
        });
    }
});
