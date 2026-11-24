"use strict";
"require baseclass";
"require ui";
"require view.justclash.common as common";
"require view.justclash.lib.routing as routingOptions";

const BULK_IMPORT_ROWS = 18;

const create = ({ map, configName, providerDefaults, replaceForm, notificationTimeout }) => {
    const proxySuccess = _("Added %d proxy entries. Review and save the configuration to keep them.");
    const formats = [
        {
            title: _("Add proxies in bulk (JSON)"),
            description: _("Paste a JSON array of proxy objects. Each object must contain a unique name. Imported entries are added to the form and remain unsaved until you save or apply the configuration."),
            placeholder: _("Example: %s").format("[\n  { ... }\n]"),
            sectionType: "proxies",
            parse: value => routingOptions.parseBulkProxyObjects(value).map(({ name, objectJson }) => ({
                name, mode: "object", proxy_link_object: objectJson
            })),
            validate: routingOptions.validateBulkProxyNames,
            success: proxySuccess
        },
        {
            title: _("Add proxies in bulk (URI)"),
            description: _("Paste one proxy URI per line. Names are generated automatically and can be edited before saving."),
            sectionType: "proxies",
            parse: value => routingOptions.parseBulkLinks(value, link => common.isValidProxyLink(link)).map(link => ({
                mode: "uri", proxy_link_uri: link
            })),
            success: proxySuccess
        },
        {
            title: _("Add providers in bulk (URL)"),
            description: _("Paste one HTTP(S) subscription URL per line. Names are generated automatically and can be edited before saving."),
            sectionType: "proxy_provider",
            parse: value => routingOptions.parseBulkLinks(value, link => common.validateHttpUrl(link)).map(link => ({
                ...providerDefaults, subscription: link
            })),
            success: _("Added %d proxy providers. Review and save the configuration to keep them.")
        }
    ];
    let importing = false;

    const showBulkImportModal = (format) => {
        if (importing)
            return;

        const editor = E("textarea", {
            class: "cbi-input-textarea",
            rows: BULK_IMPORT_ROWS,
            spellcheck: "false",
            style: "box-sizing:border-box;width:100%;min-height:18rem;font-family:ui-monospace,monospace;",
            placeholder: format.placeholder || ""
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
                if (importing)
                    return;

                errorNode.hidden = true;
                errorNode.textContent = "";
                let entries;
                try {
                    entries = format.parse(editor.value);
                } catch (error) {
                    showError(error.message);
                    return;
                }

                importing = true;
                addButton.disabled = true;
                try {
                    try {
                        await map.parse();
                    } catch {
                        showError(_("Fix existing form validation errors before importing."));
                        return;
                    }

                    const nameValidation = format.validate?.(configName, entries) ?? true;
                    if (nameValidation !== true) {
                        showError(nameValidation);
                        return;
                    }

                    let addedSectionIds = [];
                    try {
                        addedSectionIds = routingOptions.addBulkSections(configName, format.sectionType, entries);
                        await replaceForm(await map.render());
                    } catch {
                        routingOptions.removeBulkSections(configName, addedSectionIds);
                        showError(_("Unable to add imported entries."));
                        return;
                    }

                    ui.hideModal();
                    ui.addTimeLimitedNotification(
                        null,
                        E("p", format.success.format(entries.length)),
                        notificationTimeout,
                        "success"
                    );
                } finally {
                    importing = false;
                    addButton.disabled = false;
                }
            }
        }, [_("Add")]);

        ui.showModal(format.title, [
            E("p", format.description),
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
                    click: () => {
                        if (!importing)
                            ui.hideModal();
                    }
                }, [_("Cancel")])
            ])
        ]);

        editor.focus();
    };

    return E("div", { class: "cbi-section" }, [
        E("div", { class: "cbi-section-actions", style: "display:flex;flex-wrap:wrap;gap:0.5rem;" },
            formats.map(format => E("button", {
                type: "button",
                class: "cbi-button cbi-button-action",
                click: () => showBulkImportModal(format)
            }, [format.title])))
    ]);
};

return baseclass.extend({ create });
