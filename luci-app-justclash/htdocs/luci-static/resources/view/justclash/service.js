'use strict';
'require fs';
'require form';
'require uci';
'require ui';
'require view';


return view.extend({

    load: function () {
        return Promise.all([
            uci.load("justclash"),
        ]).catch(e => {
            ui.addNotification(null, E('p', _('Unable to read the contents') + ': %s '.format(e.message)));
        });
    },
    render: function () {
        let m, s, o, tabname;

        m = new form.Map("justclash");

        s = m.section(form.NamedSection, 'settings');
        s.anonymous = true;
        s.addremove = false;

        tabname = 'serviceautomation_tab';
        s.tab(tabname, "Service automation");

        o = s.taboption(tabname, form.Flag, 'autostart', "Autostart");
        o.description = _('autostart_description');
        o.rmempty = false;
        o.default = 1;

        o = s.taboption(tabname, form.Flag, 'forcefully_update_ntp_at_load', _('forcefully_update_ntp_at_load'));
        o.description = _('forcefully_update_ntp_at_load_description');
        o.rmempty = false;
        o.default = 1;

        o = s.taboption(tabname, form.Flag, 'update_dns_server_at_load', _('update_dns_server_at_load'));
        o.description = _('update_dns_server_at_load_description');
        o.rmempty = false;
        o.default = 1;

        o = s.taboption(tabname, form.Flag, 'update_nft_tables_at_start', _('update_nft_tables_at_start'));
        o.description = _('update_nft_tables_at_start_description');
        o.rmempty = false;
        o.default = 1;

        o = s.taboption(tabname, form.ListValue, 'justclash_autoupdate', _('justclash_autoupdate'));
        o.value('no', _('str_no'));
        o.value('check', _('str_yes'));
        o.value('checkandupdate', _('str_check_and_update'));
        o.description = _("justclash_autoupdate_description");
        o.default = "no";

        o = s.taboption(tabname, form.Flag, 'justclash_cron_update_telegram_notify', _('justclash_cron_update_telegram_notify'));
        o.description = _("justclash_cron_update_telegram_notify_description");
        o.default = 0;

        o = s.taboption(tabname, form.Value, 'justclash_cron_update_string', _('justclash_cron_update_string'));
        o.placeholder = '0 3 * * 0';
        o.description = _("justclash_cron_update_string_description");
        o.default = '0 3 * * 0'

        tabname = 'coreautomation_tab';
        s.tab(tabname, "Core automation");

        o = s.taboption(tabname, form.Flag, 'mihomo_autorestart', 'mihomo_autorestart');
        o.rmempty = false;
        o.default = 1;

        o = s.taboption(tabname, form.ListValue, 'mihomo_autoupdate', 'mihomo_autorestart');
        o.value('no', _('str_no'));
        o.value('check', _('str_yes'));
        o.value('checkandupdate', _('str_check_and_update'));
        o.description = _("mihomo_autoupdate_description");
        o.default = "no";

        o = s.taboption(tabname, form.Flag, 'mihomo_cron_autorestart_telegram_notify', _('mihomo_cron_autorestart_telegram_notify'));
        o.description = _("mihomo_cron_autorestart_telegram_notify_description");
        o.rmempty = false;

        o = s.taboption(tabname, form.Flag, 'mihomo_cron_update_telegram_notify', _('mihomo_cron_update_telegram_notify'));
        o.description = _("mihomo_cron_update_telegram_notify_description");
        o.rmempty = false;

        o = s.taboption(tabname, form.Value, 'mihomo_cron_autorestart_string', _('mihomo_cron_autorestart_string'));
        o.placeholder = '0 3 * * 0';
        o.description = _("mihomo_cron_autorestart_string_description");

        o = s.taboption(tabname, form.Value, 'mihomo_cron_update_string', _('mihomo_cron_update_string'));
        o.placeholder = '0 3 * * 0';
        o.description = _("mihomo_cron_update_string_description");

        tabname = 'telegramcredentials_tab';
        s.tab(tabname, "Credentials");

        o = s.taboption(tabname, form.Value, 'telegram_chat_id', _('telegram_chat_id'));
        o.placeholder = '123456789';
        o.description = _("telegram_chat_id_description");

        o = s.taboption(tabname, form.Value, 'telegram_bot_token', _('telegram_bot_token'));
        o.placeholder = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
        o.description = _("telegram_bot_token_description");
        o.password = true;

        let map_promise = m.render();
        return map_promise;
    }
});