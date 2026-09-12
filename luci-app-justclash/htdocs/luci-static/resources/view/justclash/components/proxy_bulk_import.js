"use strict";
"require baseclass";
"require ui";
"require view.justclash.lib.routing as routingOptions";

const BULK_IMPORT_ROWS = 18;

const create = ({ map, configName, replaceForm, notificationTimeout }) => {
    const showBulkImportModal = () => {
        const editor = E("textarea", {
            class: "cbi-input-textarea",
            rows: BULK_IMPORT_ROWS,
            spellcheck: "false",
            style: "box-sizing:border-box;width:100%;min-height:18rem;font-family:ui-monospace,monospace;",
            placeholder: "[\n  { ... }\n]"
        });
        const errorNode = E("div", {
            class: "alert-message error",
            hidden: "",
            style: "margin-top:0.75rem;"
        });

        const showError = (message) => {
            errorNode.textContent = message;
            errorNode.hidden = false;
        };

        const addButton = E("button", {
            type: "button",
            class: "cbi-button cbi-button-action",
            click: async () => {
                let entries;

                errorNode.hidden = true;
                errorNode.textContent = "";

                try {
                    entries = routingOptions.parseBulkProxyObjects(editor.value);
                } catch (error) {
                    showError(error.message || _("Invalid JSON format"));
                    return;
                }

                addButton.disabled = true;

                try {
                    await map.parse();
                } catch {
                    showError(_("Fix existing form validation errors before importing."));
                    addButton.disabled = false;
                    return;
                }

                const nameValidation = routingOptions.validateBulkProxyNames(configName, entries);

                if (nameValidation !== true) {
                    showError(nameValidation);
                    addButton.disabled = false;
                    return;
                }

                let addedSectionIds = [];

                try {
                    addedSectionIds = routingOptions.addBulkProxySections(configName, entries);
                    await replaceForm(await map.render());
                    ui.hideModal();
                    ui.addTimeLimitedNotification(
                        null,
                        E("p", _("Added %d proxy entries. Review and save the configuration to keep them.").format(entries.length)),
                        notificationTimeout,
                        "success"
                    );
                } catch (error) {
                    routingOptions.removeProxySections(configName, addedSectionIds);
                    showError(error.message || _("Unable to add proxy entry."));
                    addButton.disabled = false;
                }
            }
        }, [_("Add")]);

        ui.showModal(_("Add in bulk"), [
            E("p", _("Paste a JSON array of proxy objects. Each object must contain a unique name. Imported entries are added to the form and remain unsaved until you save or apply the configuration.")),
            editor,
            errorNode,
            E("div", {
                class: "jc-modal-actions",
                style: "display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1rem;"
            }, [
                addButton,
                E("button", {
                    type: "button",
                    class: "cbi-button cbi-button-negative",
                    click: ui.hideModal
                }, [_("Cancel")])
            ])
        ]);

        editor.focus();
    };

    return E("div", { class: "cbi-section" }, [
        E("div", { class: "cbi-section-actions" }, [
            E("button", {
                type: "button",
                class: "cbi-button cbi-button-action",
                click: showBulkImportModal
            }, [_("Add in bulk")])
        ])
    ]);
};

return baseclass.extend({ create });
