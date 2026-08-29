"use strict";
"require form";
"require view";
"require view.justclash.common as common";
"require view.justclash.lib.form as formConstants";
"require tools.widgets as widgets";

return view.extend({
    render: function () {
        let m, s, o, tabname;

        const primitives = formConstants.boolean;
        const datatypes = formConstants.datatypes;

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

        o = s.taboption(tabname, widgets.DeviceSelect, "interface_name", _("Bind all outbound connections to interface:"));
        o.description = _("Bind Mihomo outbound connections to a specific network device by default. Leave empty to let the system choose the outgoing interface. Per-proxy and per-provider interface settings should override this value when set.");
        o.optional = true;
        o.noaliases = true;
        o.nobridges = true;
        o.noinactive = false;
        o.multiple = false;
        o.filter = common.filterOutboundDeviceSelect;

        o = s.taboption(tabname, form.Value, "tproxy_port", _("Transparent proxy port:"));
        o.description = _("Port used for redirected TCP/UDP traffic. Change it only if this port is already used by another service.");
        o.datatype = datatypes.PORT;
        o.placeholder = "7893";
        o.default = "7893";
        o.rmempty = false;

        o = s.taboption(tabname, form.Flag, "use_mixed_port", _("Enable Mihomo mixed port:"));
        o.description = _("Use the Mihomo mixed port so one port handles both HTTP(S) and SOCKS5 connections. This is useful when apps or devices connect to the router as a regular proxy.");
        o.default = primitives.FALSE;
        o.rmempty = false;

        o = s.taboption(tabname, form.Value, "mixed_port", _("Mihomo mixed port:"));
        o.description = _("Port used by the Mihomo mixed port listener for both HTTP(S) and SOCKS5 connections from apps and devices on your network.");
        o.depends("use_mixed_port", primitives.TRUE);
        o.retain = true;
        o.datatype = datatypes.PORT;
        o.placeholder = "7892";
        o.default = "7892";
        o.rmempty = false;

        o = s.taboption(tabname, form.DynamicList, "proxy_authentication", _("Mixed port authentication:"));
        o.description = _("Require username and password for access to the Mihomo mixed port. Add one entry per line in the format user:pass.");
        o.depends("use_mixed_port", primitives.TRUE);
        o.placeholder = "user1:pass1";
        o.optional = true;
        o.editable = true;
        o.validate = function (section_id, value) {
            return common.validateProxyAuthenticationEntry(value);
        };

        o = s.taboption(tabname, form.Flag, "unified_delay", _("Unified delay:"));
        o.description = _("Use the same delay value when checking response time, so test results stay more consistent.");
        o.default = primitives.TRUE;
        o.rmempty = false;

        o = s.taboption(tabname, form.Flag, "tcp_concurrent", _("Try TCP connections in parallel:"));
        o.description = _("Try several TCP connections at the same time. This can help on unstable networks, but it may create extra connection attempts.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.Value, "global_ua", _("User-Agent for downloads:"));
        o.placeholder = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...";
        o.description = _("User-Agent sent when downloading external files such as subscriptions or rule lists. Select a preset or type your own. Choose \"Random\" to pick a different browser UA on every service start.");
        o.default = common.defaultUaPresets[0].value;
        o.rmempty = false;
        common.defaultUaPresets.forEach(p => o.value(p.value, p.label));
        o.validate = function (section_id, value) {
            if (!value || value.trim() === "")
                return _("User-Agent cannot be empty.");
            if (/[\r\n]/.test(value))
                return _("Newlines (CR/LF) are not allowed in HTTP headers.");
            return true;
        };


        o = s.taboption(tabname, form.Flag, "etag_support", _("Check whether files changed:"));
        o.description = _("Only download external files again when the server says they changed. This saves bandwidth and avoids unnecessary updates.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.Value, "keep_alive_idle", _("Idle time before connection check:"));
        o.placeholder = "600";
        o.description = _("How long to wait with no activity before checking whether the connection is still alive. Shorter values detect dead connections sooner.");
        o.datatype = datatypes.UINTEGER;
        o.rmempty = false;
        common.defaultKeepAliveSec.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultKeepAliveSec[0].value;
        o.validate = function (section_id, value) {
            return common.validateIntegerRange(value, 1, 3600);
        };

        o = s.taboption(tabname, form.Value, "keep_alive_interval", _("Connection check interval:"));
        o.placeholder = "15";
        o.description = _("How often to repeat that check after the connection becomes idle.");
        o.datatype = datatypes.UINTEGER;
        o.rmempty = false;
        common.defaultKeepAliveSec.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultKeepAliveSec[0].value;
        o.validate = function (section_id, value) {
            return common.validateIntegerRange(value, 1, 3600);
        };

        o = s.taboption(tabname, form.Flag, "profile_store_selected", _("Save profile data:"));
        o.description = _("Keep profile data when possible, so selected items can be restored after a restart.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.Flag, "profile_store_fake_ip", _("Save fake IP addresses:"));
        o.description = _("Keep assigned fake IP addresses when possible, which can reduce repeated DNS work after restarts.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        tabname = "geodatasettings_tab";
        s.tab(tabname, _("GeoData settings"));

        o = s.taboption(tabname, form.Flag, "geodata_mode", _("Enable:"));
        o.description = _("Enable geodata features in rules.");
        o.rmempty = false;
        o.default = primitives.FALSE;

        o = s.taboption(tabname, form.Flag, "geodata_autoupdate", _("Enable autoupdate:"));
        o.description = _("Enable geodata features in rules.");
        o.rmempty = false;
        o.retain = true;
        o.default = primitives.FALSE;
        o.depends("geodata_mode", primitives.TRUE);

        o = s.taboption(tabname, form.Value, "geodata_autoupdate_interval", _("Update interval:"));
        o.description = _("Geodata update interval in hours.");
        o.rmempty = false;
        o.default = common.defaultGeoDataIntervalH[0].value;
        common.defaultGeoDataIntervalH.forEach(item => {
            o.value(item.value, item.text);
        });
        o.rmempty = false;
        o.retain = true;
        o.depends("geodata_autoupdate", primitives.TRUE);

        tabname = "apicontrollersettings_tab";
        s.tab(tabname, _("Controller/API settings"));

        // copypasted from Podkop devs
        o = s.taboption(tabname, widgets.NetworkSelect, "controller_bind_interface", _("Controller bind:"), _("Select which network will allow access to the API controller and dashboard."));
        o.default = "lan";
        o.optional = false;
        o.nocreate = true;
        o.multiple = false;
        o.description = _("Select which network will allow access to the API controller and dashboard.");

        o = s.taboption(tabname, form.Value, "api_password", _("API password:"));
        o.password = true;
        o.description = _("Password or token required to access the API controller.");
        o.rmempty = false;
        o.validate = function (section_id, value) {
            return common.validateApiSecret(value);
        };

        o = s.taboption(tabname, form.Flag, "use_dashboard", _("Enable dashboard:"));
        o.description = _("Enable an additional external web dashboard for Mihomo. Turn this on only if you need a separate dashboard interface.");
        o.default = primitives.FALSE;
        o.rmempty = false;

        o = s.taboption(tabname, form.ListValue, "dashboard_repo", _("Web dashboard:"));
        o.description = _("Choose which web dashboard Mihomo should download and serve.");
        o.value("zashboard", _("zashboard"));
        o.value("metacubexd", _("metacubexd"));
        o.value("yacd-meta", _("Yacd-meta"));
        o.default = "metacubexd";
        o.rmempty = false;
        o.retain = true;
        o.depends("use_dashboard", primitives.TRUE);

        o = s.taboption(tabname, form.Flag, "api_tls", _("Enable API TLS"));
        o.description = _("Enable secure HTTPS/WSS protocol for the Mihomo API controller.");
        o.rmempty = false;
        o.default = primitives.FALSE;

        o = s.taboption(tabname, form.Value, "api_tls_cert", _("API TLS certificate path"));
        o.description = _("Path to the PEM-encoded SSL/TLS certificate file.");
        o.placeholder = "/etc/justclash/api-cert.pem";
        o.default = "/etc/justclash/api-cert.pem";
        o.rmempty = false;
        o.retain = true;
        o.depends("api_tls", primitives.TRUE);

        o = s.taboption(tabname, form.Value, "api_tls_key", _("API TLS key path"));
        o.description = _("Path to the PEM-encoded SSL/TLS private key file.");
        o.placeholder = "/etc/justclash/api-key.pem";
        o.default = "/etc/justclash/api-key.pem";
        o.rmempty = false;
        o.retain = true;
        o.depends("api_tls", primitives.TRUE);

        tabname = "sniffersettings_tab";
        s.tab(tabname, _("Sniffer settings"));

        o = s.taboption(tabname, form.Flag, "sniffer_enable", _("Enable sniffer:"));
        o.description = _("Enable Mihomo traffic sniffing.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.Flag, "sniffer_parse_pure_ip", _("Parse pure IP:"));
        o.description = _("Force domain detection for traffic without resolved domain names.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.Flag, "sniffer_override_destination", _("Override destination:"));
        o.description = _("Override connection destination address with sniffed domain name.");
        o.rmempty = false;
        o.default = primitives.FALSE;

        o = s.taboption(tabname, form.DynamicList, "sniffer_exclude_domain", _("Excluded from sniffer domains:"));
        o.description = _("Domains excluded from detailed analysis when possible. Sometimes this can help with errors in apps.");
        o.rmempty = false;
        o.editable = true;
        o.optional = true;
        o.validate = function (section_id, value) {
            return common.isValidDomainMatcher(value);
        };

        o = s.taboption(tabname, form.DynamicList, "sniffer_force_domain", _("Forcefully sniff domains:"));
        o.description = _("Domains included for detailed analysis when possible. Sometimes this can help with errors in apps.");
        o.rmempty = false;
        o.editable = true;
        o.optional = true;
        o.validate = function (section_id, value) {
            return common.isValidDomainMatcher(value);
        };

        o = s.taboption(tabname, form.DynamicList, "sniffer_skip_src_address", _("Exclude from sniffer SRC CIDR traffic:"));
        o.description = _("Source address ranges excluded from sniffing.");
        o.rmempty = false;
        o.editable = true;
        o.optional = true;
        o.datatype = datatypes.CIDR4;

        o = s.taboption(tabname, form.DynamicList, "sniffer_skip_dst_address", _("Exclude from sniffer DST CIDR traffic:"));
        o.description = _("Destination address ranges excluded from sniffing.");
        o.rmempty = false;
        o.editable = true;
        o.optional = true;
        o.datatype = datatypes.CIDR4;

        tabname = "ntpsettings_tab";
        s.tab(tabname, _("NTP settings"));

        o = s.taboption(tabname, form.Flag, "core_ntp_enabled", _("Enable NTP client:"));
        o.description = _("Enable the built-in Mihomo NTP client.");
        o.rmempty = false;
        o.default = primitives.TRUE;

        o = s.taboption(tabname, form.Value, "core_ntp_server", _("Endpoint NTP server:"));
        o.description = _("Upstream NTP server used by Mihomo.");
        o.datatype = datatypes.IPADDR;
        common.defaultNtpServers.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultNtpServers[0].value;
        o.rmempty = false;

        o = s.taboption(tabname, form.Value, "core_ntp_port", _("NTP port:"));
        o.description = _("Upstream NTP server port.");
        o.datatype = datatypes.PORT;
        o.rmempty = false;

        o = s.taboption(tabname, form.Value, "core_ntp_interval", _("NTP check interval:"));
        o.description = _("How often Mihomo should sync time, in minutes.");
        o.datatype = datatypes.UINTEGER;
        o.rmempty = false;
        common.defaultNtpIntervalValuesMin.forEach(item => {
            o.value(item.value, item.text);
        });
        o.default = common.defaultNtpIntervalValuesMin[1].value;
        o.validate = function (section_id, value) {
            return common.validateIntegerRange(value, 1, 1440);
        };

        o = s.taboption(tabname, form.Flag, "core_ntp_write_system", _("Write to system:"));
        o.description = _("Allow Mihomo to write corrected time to the system clock.");
        o.default = primitives.FALSE;
        o.rmempty = false;

        const style = E("style", {}, `
             ul.dropdown { max-height:320px !important; }
            .cbi-value[data-name="tproxy_port"] .cbi-value-title,
            .cbi-value[data-name="use_mixed_port"] .cbi-value-title,
            .cbi-value[data-name="mixed_port"] .cbi-value-title,
            .cbi-value[data-name="controller_bind_interface"] .cbi-value-title,
            .cbi-value[data-name="api_password"] .cbi-value-title,
            .cbi-value[data-name="sniffer_enable"] .cbi-value-title,
            .cbi-value[data-name="core_ntp_enabled"] .cbi-value-title,
            .cbi-value[data-name="sniffer_enable"] .cbi-value-title,
            .cbi-value[data-name="core_ntp_write_system"] .cbi-value-title {
                color: var(--error-color-medium, #f44336) !important;
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
