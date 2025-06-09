"use strict";
"require ui";
"require view";
"require uci";
"require view.justclash.common as common";
"require form";

return view.extend({
    load: function () {
        return Promise.all([
            uci.load("justclash"),
        ]).catch(e => {
            ui.addNotification(null, E("p", _("Unable to read the contents") + ": %s ".format(e.message)));
        });
    },

    render() {
        let m, s, s2, s3, o;

        m = new form.Map("justclash");

        const input = E("input", {
            type: "text",
            placeholder: "vless:// | ss:// | etc",
            class: "cbi-input-text jc-flex-one",
        });

        const button = E("button", {
            class: "cbi-button cbi-button-add",
            click: function (ev) {
                ev.preventDefault();

                const val = input.value.trim();

                const sid = "new_" + Math.random().toString(36).substr(2, 8);
                console.log(s.cfgsections)
                s.cfgsections.push(sid);
                s.data[sid] = {
                    name: parts[0],
                    value: parts[1],
                    policy: parts[2]
                };

                m.renderMoreOptions();
            }
        }, _("Add link"));

        const inputGroup = E("div", {
            class: "jc-input-group"
        }, [input, button]);


        s = m.section(form.TypedSection, "proxies", _(), _());
        s.anonymous = true;
        s.addremove = false;
        s.handleSave = function (section_id) {
            const val = this.formvalue(section_id, "name");
            uci.set("justclash", section_id, "name", val);
            uci.set("justclash", section_id, "internal_id", val + "_meta");
        };

        o = s.option(form.DynamicList, "name", _("name:"));
        o.description = _("name_description");
        o = s.option(form.ListValue, "enabled_list", _("enabled_list:"));
        o.multiple = true;
        common.availableRuleSets.forEach(item => {
            o.value(item.name, _(`${item.name}`));
        });
        o = s.option(form.DynamicList, "additional_domain_route", _("additional_domain_route:"));
        o.description = _("additional_domain_route_description");
        o = s.option(form.DynamicList, "additional_destip_route", _("additional_destip_route:"));
        o.description = _("additional_destip_route_description");
        o = s.option(form.DynamicList, "additional_srcip_route", _("additional_srcip_route:"));
        o.description = _("additional_srcip_route_description");

        s2 = m.section(form.TypedSection, "proxy_group", _(), _());
        s2.anonymous = true;
        s2.addremove = true;
        s2.handleSave = function (section_id) {
            const val = this.formvalue(section_id, "name");
            uci.set("justclash", section_id, "name", val);
            uci.set("justclash", section_id, "internal_id", val + "_meta");
        };

        o = s2.option(form.DynamicList, "name", _("name:"));
        o.description = _("name_description");
        o = s2.option(form.ListValue, "group_type", _("group_type:"));
        common.defaultProxyGroupsTypes.forEach(item => {
            o.value(item, _(`${item}`));
        });

        o = s2.option(form.ListValue, "strategy", _("strategy:"));
        common.defaultProxyGroupsBalanceModeStrategies.forEach(item => {
            o.value(item, _(`${item}`));
        });
        o.depends("group_type", "load-balancer")

        o = s2.option(form.Value, "proxies_list", _("proxies_list:"));
        o.placeholder = "proxy-name1, proxy-name2";

        o = s2.option(form.Value, "check_url", _("checkUrl:"));
        o.placeholder = "https://www.gstatic.com/generate_204";
        o.default = common.defaultProxyGroupCheckUrl;

        o = s2.option(form.Value, "interval", _("interval:"));
        o.default = common.defaultProxyGroupInterval;

        o = s2.option(form.ListValue, "enabled_list", _("enabled_list:"));
        o.multiple = true;
        common.availableRuleSets.forEach(item => {
            o.value(item.name, _(`${item.name}`));
        });
        o = s2.option(form.DynamicList, "additional_domain_route", _("additional_domain_route:"));
        o.description = _("additional_domain_route_description");
        o = s2.option(form.DynamicList, "additional_destip_route", _("additional_destip_route:"));
        o.description = _("additional_destip_route_description");
        o = s2.option(form.DynamicList, "additional_srcip_route", _("additional_srcip_route:"));
        o.description = _("additional_srcip_route_description");

        s3 = m.section(form.NamedSection, "block_rules", _(), _());
        o = s3.option(form.ListValue, "enabled_blocklist ", _("enabled_blocklist :"));
        o.multiple = true;
        common.availableBlockRulesets.forEach(item => {
            o.value(item.name, _(`${item.name}`));
        });
        o = s3.option(form.DynamicList, "additional_domain_blockroute", _("additional_domain_blockroute:"));
        o.description = _("additional_domain_blockroute_description");
        o = s3.option(form.DynamicList, "additional_destip_blockroute", _("additional_destip_blockroute:"));
        o.description = _("additional_destip_blockroute_description");

        return m.render().then(formEl => {
            return E("div", {}, [
                this.addCSS(),
                inputGroup,
                formEl
            ]);
        });
    },
    addCSS() {
        return E("style", {}, `
            .jc-input-group {
                display: flex;
                gap: 1em;
                align-items: center;
                margin-bottom: 1em;
            }
            .jc-flex-one {
                flex: 1;
            }
            .cbi-section:nth-of-type(1) .cbi-section-create {
                display: none;
            }
        `);
    },
    destroy() {

    }
});