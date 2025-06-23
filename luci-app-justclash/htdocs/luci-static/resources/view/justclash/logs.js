"use strict";
"require view";
"require fs";
"require ui";
"require view.justclash.common as common";

return view.extend({
    load: function() {

    },
    render: function() {
        const logBox = E("textarea", {
            readonly: "readonly",
            id: "logBox",
            rows: "200",
            wrap: "off",
            style: "width: 100%; font-family: monospace; white-space: pre; overflow: auto;"
        }, [ logs ]);
        logBox.value = _("No data");

        const buttonBar = E("div", { style: "margin-bottom: 1em;" }, [ ]);

        const createButton = (action, cssClass, label) => {
            return E("button", {
                class: `cbi-button ${cssClass}`,
                id: `button${action}`,
                click: ui.createHandlerFn(this, () => {
                    const buttons = buttonBar.querySelectorAll("button");
                    buttons.forEach(btn => btn.disabled = true);
                    fs.exec(common.initdPath, [action]).then(result => {

                    }).catch(e => {
                        ui.addNotification(_("Error"), e.message, "danger");
                    }).finally(() => {
                        buttons.forEach(btn => btn.disabled = false);
                    });
                })
            }, [
                label
            ]);
        };
        const refreshBtn = E("button", {
            class: "cbi-button cbi-button-action",
            click: () => {
                refreshBtn.disabled = true;
                refreshBtn.innerText = "Обновляется...";
                fs.exec("/bin/logread", [])
                    .then(res => {
                        logBox.value = res.stdout || "Нет логов";
                        refreshBtn.innerText = "Обновить";
                    })
                    .catch(err => {
                        logBox.value = "Ошибка: " + err.message;
                        refreshBtn.innerText = "Обновить";
                    })
                    .finally(() => {
                        refreshBtn.disabled = false;
                    });
            }
        }, ["Обновить"]);

        // Кнопка прокрутки к концу
        const tailBtn = E("button", {
            class: "cbi-button cbi-button-neutral",
            click: () => {
                logBox.scrollTop = logBox.scrollHeight;
            },
            style: "margin-left: 0.5em"
        }, ["To end"]);

         const copyBtn = E("button", {
            class: "cbi-button cbi-button-neutral",
            click: () => {
                logBox.scrollTop = logBox.scrollHeight;
            },
            style: "margin-left: 0.5em"
        }, ["Copy"]);


        return E("div", { class: "cbi-section" }, [
            E("h2", {}, _("Logs view")),
            buttonBar,
            logBox
        ]);
    }
});