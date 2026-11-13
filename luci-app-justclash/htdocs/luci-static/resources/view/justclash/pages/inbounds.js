"use strict";
"require form";
"require uci";
"require view";
"require view.justclash.common as common";
"require view.justclash.components.password_list as passwordList";
"require view.justclash.lib.form as formConstants";
"require view.justclash.lib.routing as routingOptions";

return view.extend({
    load() {
        return uci.load(common.binName);
    },
    render() {
        const m = new form.Map(common.binName, _("Setup: Inbounds"));
        const s = m.section(form.GridSection, "inbound", _("Inbounds:"),
            _("Create listeners on all interfaces, each with its own port, authentication, and outbound route. Use firewall rules to restrict access."));
        s.anonymous = true;
        s.addremove = true;
        s.nodescriptions = true;
        s.cloneable = true;
        s.sortable = true;

        const servicePorts = [
            Number(uci.get(common.binName, "proxy", "dns_listen_port") || "1053"),
            Number(uci.get(common.binName, "proxy", "tproxy_port") || "7893"),
            9090
        ];
        const validateInboundPort = function (sectionId, value) {
            const inbounds = uci.sections(common.binName, "inbound");
            const current = inbounds.find(inbound => inbound[".name"] === sectionId) || { ".name": sectionId };
            const readValue = (section, option) => {
                const id = section[".name"];
                const field = this.map.lookupOption(option, id)?.[0] || m.lookupOption(option, id)?.[0];
                return field?.formvalue(id) ?? section[option];
            };
            const enabled = this.option === "enabled" ? value : readValue(current, "enabled");
            if (Number(enabled ?? 1) !== 1)
                return true;

            const port = Number(this.option === "port" ? value : readValue(current, "port") || "7890");
            if (servicePorts.includes(port))
                return _("This port is reserved for JustClash DNS, TProxy, or the API controller.");

            const duplicate = inbounds.some(inbound => inbound[".name"] !== sectionId &&
                Number(readValue(inbound, "enabled") ?? 1) === 1 &&
                Number(readValue(inbound, "port") || "7890") === port);
            return duplicate ? _("This port is already assigned to another enabled inbound.") : true;
        };

        let o = s.option(form.Flag, "enabled", _("Enabled"));
        o.width = "10%";
        o.default = formConstants.boolean.TRUE;
        o.rmempty = false;
        o.editable = true;
        o.validate = validateInboundPort;

        o = s.option(form.DummyValue, "_inbound_type", _("Type"));
        o.width = "10%";
        o.modalonly = false;
        o.textvalue = function (sectionId) {
            const type = uci.get(common.binName, sectionId, "type") || "mixed";
            return E("span", { class: "jc-type-badge" }, type.toUpperCase());
        };

        o = s.option(form.DummyValue, "_inbound_port", _("Port:"));
        o.width = "10%";
        o.modalonly = false;
        o.textvalue = function (sectionId) {
            const port = uci.get(common.binName, sectionId, "port") || "7890";
            return E("span", { class: "jc-type-badge" }, port);
        };

        o = s.option(form.DummyValue, "_inbound_route", _("Send traffic to:"));
        o.width = "10%";
        o.modalonly = false;
        o.textvalue = function (sectionId) {
            const target = uci.get(common.binName, sectionId, "exit_rule") || "BY RULES";
            const label = common.endRuleOptions.find(item => item.value === target)?.text || target;
            return E("div", { class: "jc-connection-badges" }, [
                E("span", { class: "jc-type-badge" }, label)
            ]);
        };

        o = s.option(form.Value, "name", _("Name:"));
        o.description = _("Inbound name.");
        o.rmempty = false;
        o.cfgvalue = function (sectionId) {
            const value = uci.get(common.binName, sectionId, "name");
            return value || common.generateRandomName();
        };
        o.validate = function (sectionId, value) {
            return common.validateSimpleName(value);
        };

        o = s.option(form.ListValue, "type", _("Type"));
        o.value("mixed", _("Mixed Port"));
        o.value("socks", _("SOCKS"));
        o.value("http", _("HTTP"));
        o.default = "mixed";
        o.rmempty = false;
        o.modalonly = true;

        o = s.option(form.Value, "port", _("Port:"));
        o.default = "7890";
        o.placeholder = _("Example: %s").format("7890");
        o.datatype = "and(port,min(1))";
        o.rmempty = false;
        o.modalonly = true;
        o.validate = validateInboundPort;

        o = s.option(passwordList.Value, "authentication", _("Authentication:"));
        o.description = _("Add at least one user:pass entry. The first colon separates the fields; later colons belong to the password.");
        o.rmempty = false;
        o.modalonly = true;
        o.validate = function (sectionId, value) {
            return common.validateProxyAuthenticationEntry(value);
        };

        o = s.option(form.Value, "exit_rule", _("Send traffic to:"));
        o.description = _("Choose an outbound, group, DIRECT, or By rules. Core traffic blocking rules are applied first.");
        o.default = "BY RULES";
        o.rmempty = false;
        o.modalonly = true;
        o.validate = function (sectionId, value) {
            return common.validateExitRule(value);
        };
        routingOptions.makeDynamic(o, common.binName, common.endRuleOptions);

        const style = E("style", {}, `
            .jc-inbounds-form .jc-type-badge {
                display: inline-block;
                padding: 0.1rem 0.55rem;
                border-radius: 9999px;
                line-height: 1.5;
                white-space: nowrap;
                color: var(--jc-badge-color, var(--primary-color-medium, #4f8cff));
                border: 1px solid color-mix(in srgb, var(--jc-badge-color, var(--primary-color-medium, #4f8cff)) 25%, transparent);
                background: color-mix(in srgb, var(--jc-badge-color, var(--primary-color-medium, #4f8cff)) 10%, transparent);
            }
            .jc-inbounds-form .jc-connection-badges {
                display: flex;
                flex-wrap: wrap;
                gap: 0.25rem;
            }
            .jc-inbounds-form .jc-connection-badges .jc-type-badge {
                white-space: normal;
                overflow-wrap: anywhere;
            }
        `);
        return m.render().then(formEl => E("div", { class: "jc-inbounds-form" }, [style, formEl]));
    }
});
