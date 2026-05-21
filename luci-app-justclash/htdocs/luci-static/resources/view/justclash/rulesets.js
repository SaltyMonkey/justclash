"use strict";
"require view";
"require ui";
"require view.justclash.helper_common as common";
"require view.justclash.helper_fs as fsApi";

return view.extend({
    builtInRoutingIds: [],
    builtInBlockingIds: [],

    routingGrid: null,
    blockingGrid: null,

    load: async function () {
        const [rulesets, userRulesets, blockRulesets, userBlockRulesets] = await Promise.all([
            fsApi.readFileSafe(common.rulesetsFilePath),
            fsApi.readFileSafe(common.userRulesetsFilePath),
            fsApi.readFileSafe(common.blockRulesetsFilePath),
            fsApi.readFileSafe(common.userBlockRulesetsFilePath)
        ]);

        return {
            rulesets,
            userRulesets,
            blockRulesets,
            userBlockRulesets
        };
    },

    render: function (result) {
        const builtInRouting = this.parseRules(result.rulesets);
        const builtInBlocking = this.parseRules(result.blockRulesets);

        this.builtInRoutingIds = builtInRouting.map(r => r.id);
        this.builtInBlockingIds = builtInBlocking.map(r => r.id);

        const userRouting = this.parseRules(result.userRulesets);
        const userBlocking = this.parseRules(result.userBlockRulesets);

        const header = E("h2", {}, _("User-defined Rulesets"));
        const desc = E("p", { class: "cbi-map-descr" }, _("Manage custom routing and blocking rulesets. Both remote URLs and local paths must point to binary MRS ruleset files. Local rulesets are loaded as file-based rulesets in Mihomo. Saving changes here writes to files but does not restart the service. Reload the service from the Status tab or apply changes in Routing/Proxy tabs to take effect."));

        const routingPanel = this.renderPanel(builtInRouting, userRouting, false);
        const blockingPanel = this.renderPanel(builtInBlocking, userBlocking, true);

        const style = E("style", {}, `
            .jc-badge-type {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: bold;
                text-transform: uppercase;
                line-height: 1.2;
            }
            .jc-badge-type.domain {
                background-color: rgba(16, 96, 255, 0.1);
                color: var(--primary-color-medium, #1060FF);
                border: 1px solid rgba(16, 96, 255, 0.2);
            }
            .jc-badge-type.ipcidr {
                background-color: rgba(40, 167, 69, 0.1);
                color: var(--success-color-medium, #28a745);
                border: 1px solid rgba(40, 167, 69, 0.2);
            }
            .jc-badge-type.classical {
                background-color: rgba(253, 126, 20, 0.1);
                color: #fd7e14;
                border: 1px solid rgba(253, 126, 20, 0.2);
            }
            .jc-badge-builtin {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 10px;
                background-color: var(--background-color-medium, #f6f6f6);
                color: var(--text-color-medium, #888);
                border: 1px solid var(--border-color-medium, #d9d9d9);
                font-weight: 500;
            }
            .cbi-section-table-row {
                transition: background-color 0.15s ease;
            }
            .cbi-section-table-row:hover {
                background-color: var(--background-color-medium, rgba(0, 0, 0, 0.02)) !important;
            }
            [data-theme="dark"] .cbi-section-table-row:hover {
                background-color: rgba(255, 255, 255, 0.03) !important;
            }
            .jc-url-cell {
                max-width: 350px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .jc-url-cell:has(input) {
                overflow: visible;
                white-space: normal;
                max-width: none;
            }
            .cbi-section-table td input,
            .cbi-section-table td select {
                width: 100% !important;
                box-sizing: border-box !important;
                max-width: 100% !important;
                min-width: 0 !important;
                height: 30px !important;
                padding: 4px 6px !important;
                margin: 0 !important;
            }
            .cbi-button-remove {
                font-weight: bold;
                padding: 2px 8px !important;
                height: 26px !important;
                line-height: 1 !important;
            }
        `);

        return E("div", { class: "cbi-map fade-in" }, [
            style,
            header,
            desc,
            routingPanel,
            blockingPanel
        ]);
    },

    parseRules: function (content) {
        if (!content) return [];
        return content.split("\n")
            .map(line => line.trim())
            .filter(line => line && !line.startsWith("#"))
            .map(line => {
                const parts = line.split("|").map(p => p.trim());
                return {
                    name: parts[0] || "",
                    id: parts[1] || "",
                    type: parts[2] || "domain",
                    format: parts[3] || "mrs",
                    url: parts[4] || ""
                };
            })
            .filter(item => item.name && item.id);
    },

    renderPanel: function (builtInRules, userRules, isBlock) {
        const sectionTitle = isBlock ? _("Blocking Rulesets") : _("Routing Rulesets");

        const table = E("table", { class: "cbi-section-table" }, [
            E("tr", { class: "cbi-section-table-titles" }, [
                E("th", { class: "th", style: "width: 20%;" }, _("Name")),
                E("th", { class: "th", style: "width: 20%;" }, _("ID")),
                E("th", { class: "th", style: "width: 15%;" }, _("Type")),
                E("th", { class: "th", style: "width: 35%;" }, _("URL / Local Path")),
                E("th", { class: "th", style: "width: 10%;" }, _("Actions"))
            ])
        ]);

        if (isBlock) {
            this.blockingGrid = table;
        } else {
            this.routingGrid = table;
        }

        // Add built-in rulesets
        builtInRules.forEach(rule => {
            table.appendChild(this.createRowElement(rule, true));
        });

        // Add user-defined rulesets
        userRules.forEach(rule => {
            table.appendChild(this.createRowElement(rule, false));
        });

        const addBtn = E("button", {
            type: "button",
            class: "cbi-button cbi-button-add",
            click: () => {
                const newRow = this.createRowElement({ name: "", id: "", type: "domain", format: "mrs", url: "" }, false);
                table.appendChild(newRow);
            }
        }, _("Add Custom Ruleset"));

        const panel = E("div", { class: "cbi-section" }, [
            E("h3", { class: "cbi-section-title" }, sectionTitle),
            E("div", { class: "cbi-section-node" }, [
                table,
                E("div", { class: "cbi-section-create" }, addBtn)
            ])
        ]);

        return panel;
    },

    createRowElement: function (rule = { name: "", id: "", type: "domain", format: "mrs", url: "" }, isBuiltIn = false) {
        const tr = E("tr", {
            class: isBuiltIn ? "cbi-section-table-row jc-builtin-row" : "cbi-section-table-row jc-custom-row"
        });

        if (isBuiltIn) {
            tr.appendChild(E("td", { class: "td" }, rule.name));
            tr.appendChild(E("td", { class: "td" }, E("code", {}, rule.id)));
            tr.appendChild(E("td", { class: "td" }, E("span", { class: "jc-badge-type " + rule.type }, rule.type.toUpperCase())));
            tr.appendChild(E("td", { class: "td jc-url-cell" }, rule.url));
            tr.appendChild(E("td", { class: "td" }, E("span", { class: "jc-badge-builtin" }, _("Built-in"))));
        } else {
            const nameInput = E("input", {
                type: "text",
                class: "cbi-input-text",
                value: rule.name,
                placeholder: _("e.g. My Custom Rules")
            });

            const idInput = E("input", {
                type: "text",
                class: "cbi-input-text",
                value: rule.id,
                placeholder: _("e.g. my-custom-rules")
            });

            const typeSelect = E("select", { class: "cbi-input-select" }, [
                E("option", { value: "domain" }, _("Domain")),
                E("option", { value: "ipcidr" }, _("IP CIDR"))
            ]);
            typeSelect.value = (rule.type === "ipcidr") ? "ipcidr" : "domain";

            const urlInput = E("input", {
                type: "text",
                class: "cbi-input-text",
                value: rule.url,
                placeholder: _("e.g. https://... or /etc/justclash/...")
            });

            const deleteBtn = E("button", {
                type: "button",
                class: "cbi-button cbi-button-remove",
                title: _("Delete"),
                click: function () {
                    tr.remove();
                }
            }, "×");

            tr.appendChild(E("td", { class: "td" }, nameInput));
            tr.appendChild(E("td", { class: "td" }, idInput));
            tr.appendChild(E("td", { class: "td" }, typeSelect));
            tr.appendChild(E("td", { class: "td jc-url-cell" }, urlInput));
            tr.appendChild(E("td", { class: "td" }, deleteBtn));

            tr.nameInput = nameInput;
            tr.idInput = idInput;
            tr.typeSelect = typeSelect;
            tr.urlInput = urlInput;
        }

        return tr;
    },

    saveData: async function (apply) {
        const routingRows = this.routingGrid.querySelectorAll(".jc-custom-row");
        const blockingRows = this.blockingGrid.querySelectorAll(".jc-custom-row");

        const routingData = [];
        const blockingData = [];

        const seenRoutingIds = new Set(this.builtInRoutingIds);
        const seenBlockingIds = new Set(this.builtInBlockingIds);

        // Validate Routing Rulesets
        for (let i = 0; i < routingRows.length; i++) {
            const card = routingRows[i];
            const name = card.nameInput.value.trim();
            const id = card.idInput.value.trim();
            const type = card.typeSelect.value;
            const url = card.urlInput.value.trim();

            const rowErrors = [];

            if (!name) {
                rowErrors.push(_("Routing Ruleset #%d: Name is required.").format(i + 1));
            } else if (name.includes("|") || name.includes("\n")) {
                rowErrors.push(_("Routing Ruleset #%d: Name cannot contain pipe (|) or newlines.").format(i + 1));
            }

            if (!id) {
                rowErrors.push(_("Routing Ruleset #%d: ID is required.").format(i + 1));
            } else if (!/^[a-z0-9-]+$/.test(id)) {
                rowErrors.push(_("Routing Ruleset #%d: ID must contain only lowercase letters, numbers, and dashes.").format(i + 1));
            } else if (seenRoutingIds.has(id)) {
                rowErrors.push(_("Routing Ruleset #%d: Duplicate or reserved ID '%s'.").format(i + 1, id));
            } else {
                seenRoutingIds.add(id);
            }

            if (!url) {
                rowErrors.push(_("Routing Ruleset #%d: URL / Local Path is required.").format(i + 1));
            } else if (url.includes("|") || url.includes("\n")) {
                rowErrors.push(_("Routing Ruleset #%d: URL / Local Path cannot contain pipe (|) or newlines.").format(i + 1));
            }

            if (rowErrors.length > 0) {
                const errorContent = E("ul", { style: "margin: 0; padding-left: 20px; text-align: left;" },
                    rowErrors.map(err => E("li", {}, err))
                );
                ui.addTimeLimitedNotification(_("Validation Error"), errorContent, common.notificationTimeout, "danger");
                return false;
            }

            routingData.push(`${name}|${id}|${type}|mrs|${url}`);
        }

        // Validate Blocking Rulesets
        for (let i = 0; i < blockingRows.length; i++) {
            const card = blockingRows[i];
            const name = card.nameInput.value.trim();
            const id = card.idInput.value.trim();
            const type = card.typeSelect.value;
            const url = card.urlInput.value.trim();

            const rowErrors = [];

            if (!name) {
                rowErrors.push(_("Blocking Ruleset #%d: Name is required.").format(i + 1));
            } else if (name.includes("|") || name.includes("\n")) {
                rowErrors.push(_("Blocking Ruleset #%d: Name cannot contain pipe (|) or newlines.").format(i + 1));
            }

            if (!id) {
                rowErrors.push(_("Blocking Ruleset #%d: ID is required.").format(i + 1));
            } else if (!/^[a-z0-9-]+$/.test(id)) {
                rowErrors.push(_("Blocking Ruleset #%d: ID must contain only lowercase letters, numbers, and dashes.").format(i + 1));
            } else if (seenBlockingIds.has(id)) {
                rowErrors.push(_("Blocking Ruleset #%d: Duplicate or reserved ID '%s'.").format(i + 1, id));
            } else {
                seenBlockingIds.add(id);
            }

            if (!url) {
                rowErrors.push(_("Blocking Ruleset #%d: URL / Local Path is required.").format(i + 1));
            } else if (url.includes("|") || url.includes("\n")) {
                rowErrors.push(_("Blocking Ruleset #%d: URL / Local Path cannot contain pipe (|) or newlines.").format(i + 1));
            }

            if (rowErrors.length > 0) {
                const errorContent = E("ul", { style: "margin: 0; padding-left: 20px; text-align: left;" },
                    rowErrors.map(err => E("li", {}, err))
                );
                ui.addTimeLimitedNotification(_("Validation Error"), errorContent, common.notificationTimeout, "danger");
                return false;
            }

            blockingData.push(`${name}|${id}|${type}|mrs|${url}`);
        }

        const routingContent = routingData.length > 0 ? routingData.join("\n") + "\n" : "";
        const blockingContent = blockingData.length > 0 ? blockingData.join("\n") + "\n" : "";

        try {
            await fsApi.saveFileSafe(routingContent, blockingContent);

            ui.addTimeLimitedNotification(
                null,
                E("p", _("User rulesets saved successfully. (Note: service is not reloaded. To apply, save & apply on Routing or Proxy tabs, or reload from Status tab).")),
                common.notificationTimeout,
                "success"
            );
            return true;
        } catch (e) {
            ui.addTimeLimitedNotification(_("Save Error"), E("p", `${e.message || e}`), common.notificationTimeout, "danger");
            return false;
        }
    },

    handleSave: function (ev) {
        return this.saveData(false);
    },

    handleSaveApply: function (ev) {
        return this.saveData(true);
    }
});
