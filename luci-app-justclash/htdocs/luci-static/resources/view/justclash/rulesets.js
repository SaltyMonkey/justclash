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


        const hideBuiltInCheckbox = E("input", {
            type: "checkbox",
            id: "jc-hide-builtin",
            checked: true,
            change: function (ev) {
                const checked = ev.target.checked;
                const builtinRows = document.querySelectorAll(".jc-builtin-row");
                builtinRows.forEach(row => {
                    if (checked) {
                        row.classList.add("jc-hidden-row");
                    } else {
                        row.classList.remove("jc-hidden-row");
                    }
                });
            }
        });

        const actionWrap = E("div", { class: "jc-actions-wrap" }, [
            E("label", { for: "jc-hide-builtin", class: "jc-action-label" }, [
                hideBuiltInCheckbox,
                _("Hide built-in rulesets")
            ])
        ]);

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
            .jc-actions-wrap {
                display: flex;
                gap: 20px;
                align-items: center;
                flex-wrap: wrap;
                padding: 10px 15px;
                border: 1px solid var(--border-color-medium, #d9d9d9);
                border-radius: 6px;
                background: var(--background-color-medium, #f6f6f6);
                margin-bottom: 15px;
            }
            .jc-action-label {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                font-weight: 500;
                margin: 0;
            }
            .jc-error-list {
                margin: 0;
                padding-left: 20px;
                text-align: left;
            }
            [data-theme="dark"] .jc-actions-wrap {
                border-color: rgba(255, 255, 255, .08);
                background: rgba(255, 255, 255, .04);
            }
            .jc-hidden-row {
                display: none !important;
            }
            .jc-grid-container:not(:has(.jc-grid-row:not(.jc-hidden-row))) .jc-grid-header {
                display: none;
            }
            .jc-grid-container {
                display: flex;
                flex-direction: column;
                border: 1px solid var(--border-color-medium, #d9d9d9);
                border-radius: 8px;
                overflow: hidden;
                background-color: var(--background-color-low, #fff);
                margin-bottom: 15px;
            }
            [data-theme="dark"] .jc-grid-container {
                background-color: rgba(0, 0, 0, 0.1);
            }
            .jc-grid-header {
                display: grid;
                grid-template-columns: 1.2fr 1.2fr 0.8fr 2.5fr 1.8fr 50px;
                gap: 12px;
                padding: 10px 15px;
                background-color: var(--background-color-medium, #f6f6f6);
                border-bottom: 1px solid var(--border-color-medium, #d9d9d9);
                font-weight: bold;
                color: var(--text-color-high, inherit);
            }
            .jc-grid-row {
                display: grid;
                grid-template-columns: 1.2fr 1.2fr 0.8fr 2.5fr 1.8fr 50px;
                gap: 12px;
                padding: 10px 15px;
                align-items: center;
                border-bottom: 1px solid var(--border-color-low, #f0f0f0);
                transition: background-color 0.15s ease;
                color: var(--text-color, inherit);
            }
            .jc-grid-row:last-child {
                border-bottom: none;
            }
            .jc-grid-row:hover {
                background-color: var(--background-color-medium, rgba(0, 0, 0, 0.02));
            }
            [data-theme="dark"] .jc-grid-row:hover {
                background-color: rgba(255, 255, 255, 0.03);
            }
            .jc-grid-col {
                min-width: 0;
                display: flex;
                align-items: center;
            }
            .jc-grid-col.jc-col-id code {
                font-family: monospace;
            }
            .jc-url-cell {
                word-break: break-all;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .jc-grid-col input,
            .jc-grid-col select {
                width: 100% !important;
                box-sizing: border-box !important;
                height: 30px !important;
                padding: 4px 6px !important;
                margin: 0 !important;
            }

            @media (max-width: 768px) {
                .jc-grid-header {
                    display: none;
                }
                .jc-grid-row {
                    grid-template-columns: 1fr;
                    gap: 10px;
                    padding: 15px;
                    border-bottom: 1px solid var(--border-color-medium, #d9d9d9);
                }
                .jc-grid-row:last-child {
                    border-bottom: none;
                }
                .jc-grid-col {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    width: 100%;
                }
                .jc-grid-col::before {
                    content: attr(data-label);
                    font-size: 10px;
                    font-weight: bold;
                    color: var(--text-color-medium, #888);
                    margin-bottom: 4px;
                    text-transform: uppercase;
                }
                .jc-grid-col.jc-col-action {
                    align-items: flex-end;
                    margin-top: 5px;
                }
                .jc-grid-col.jc-col-action::before {
                    display: none;
                }
            }
        `);

        return E("div", { class: "fade-in" }, [
            style,
            actionWrap,
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
                    url: parts[4] || "",
                    auth: parts[5] || ""
                };
            })
            .filter(item => item.name && item.id);
    },

    renderPanel: function (builtInRules, userRules, isBlock) {
        const sectionTitle = isBlock ? _("Blocking Rulesets") : _("Routing Rulesets");

        const grid = E("div", { class: "jc-grid-container" }, [
            E("div", { class: "jc-grid-header" }, [
                E("div", { class: "jc-grid-col" }, _("Readable name")),
                E("div", { class: "jc-grid-col" }, _("Name")),
                E("div", { class: "jc-grid-col" }, _("Type")),
                E("div", { class: "jc-grid-col" }, _("URL / Local Path")),
                E("div", { class: "jc-grid-col" }, _("Authorization")),
                E("div", { class: "jc-grid-col" }, "")
            ])
        ]);

        if (isBlock) {
            this.blockingGrid = grid;
        } else {
            this.routingGrid = grid;
        }

        // Add built-in rulesets
        builtInRules.forEach(rule => {
            grid.appendChild(this.createRowElement(rule, true, isBlock));
        });

        // Add user-defined rulesets
        userRules.forEach(rule => {
            grid.appendChild(this.createRowElement(rule, false, isBlock));
        });

        const addBtn = E("button", {
            type: "button",
            class: "cbi-button cbi-button-add",
            click: () => {
                const newRow = this.createRowElement({ name: "", id: "", type: "domain", format: "mrs", url: "", auth: "" }, false, isBlock);
                grid.appendChild(newRow);
            }
        }, _("Add Custom Ruleset"));

        const panel = E("div", { class: "cbi-section fade-in" }, [
            E("h3", { class: "cbi-section-title" }, sectionTitle),
            E("div", { class: "cbi-section-descr" }, isBlock
                ? _("Rulesets used to block matching domains or IP ranges entirely.")
                : _("Rulesets used to determine which proxy or direct connection is used for outgoing traffic.")),
            E("div", { class: "cbi-section-node" }, [
                grid,
                E("div", { class: "cbi-section-create" }, addBtn)
            ])
        ]);

        return panel;
    },

    createRowElement: function (rule = { name: "", id: "", type: "domain", format: "mrs", url: "", auth: "" }, isBuiltIn = false, isBlock = false) {
        const row = E("div", {
            class: isBuiltIn ? "jc-grid-row jc-builtin-row jc-hidden-row" : "jc-grid-row jc-custom-row"
        });

        if (isBuiltIn) {
            row.appendChild(E("div", { class: "jc-grid-col jc-col-name", "data-label": _("Readable name") }, rule.name));
            row.appendChild(E("div", { class: "jc-grid-col jc-col-id", "data-label": _("Name") }, E("code", {}, rule.id)));
            row.appendChild(E("div", { class: "jc-grid-col jc-col-type", "data-label": _("Type") }, E("span", { class: "jc-badge-type " + rule.type }, rule.type.toUpperCase())));

            const isHttp = rule.url.startsWith("http://") || rule.url.startsWith("https://");
            const urlNode = isHttp
                ? E("a", { class: "jc-url-link", href: rule.url, download: "" }, rule.url)
                : rule.url;

            row.appendChild(E("div", { class: "jc-grid-col jc-col-url jc-url-cell", "data-label": _("URL / Local Path") }, urlNode));
            row.appendChild(E("div", { class: "jc-grid-col jc-col-auth jc-url-cell", "data-label": _("Authorization") }, rule.auth ? "••••••" : ""));
            row.appendChild(E("div", { class: "jc-grid-col jc-col-action" }, E("span", { class: "jc-badge-builtin" }, _("Built-in"))));
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
                placeholder: _("e.g. my_custom_rules")
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

            const authInput = E("input", {
                type: "password",
                class: "cbi-input-text",
                value: rule.auth || "",
                placeholder: _("e.g. Bearer token (optional)")
            });

            const deleteBtn = E("button", {
                type: "button",
                class: "cbi-button cbi-button-remove",
                click: function () {
                    row.remove();
                }
            }, "X");

            row.appendChild(E("div", { class: "jc-grid-col jc-col-name", "data-label": _("Readable name") }, nameInput));
            row.appendChild(E("div", { class: "jc-grid-col jc-col-id", "data-label": _("Name") }, idInput));
            row.appendChild(E("div", { class: "jc-grid-col jc-col-type", "data-label": _("Type") }, typeSelect));
            row.appendChild(E("div", { class: "jc-grid-col jc-col-url jc-url-cell", "data-label": _("URL / Local Path") }, urlInput));
            row.appendChild(E("div", { class: "jc-grid-col jc-col-auth", "data-label": _("Authorization") }, authInput));
            row.appendChild(E("div", { class: "jc-grid-col jc-col-action" }, deleteBtn));

            row.nameInput = nameInput;
            row.idInput = idInput;
            row.typeSelect = typeSelect;
            row.urlInput = urlInput;
            row.authInput = authInput;

            // Apply validation rules using LuCI's ui.addValidator
            ui.addValidator(nameInput, "string", false, function(value) {
                if (!value || value.trim() === "") {
                    return _("Readable name is required.");
                }
                if (!/^[a-zA-Zа-яА-ЯёЁ0-9_\s-]+$/.test(value)) {
                    return _("Readable name contains invalid characters. Only letters, numbers, spaces, underscores, and dashes are allowed.");
                }
                return true;
            }, "blur", "keyup");

            ui.addValidator(idInput, "string", false, function(value) {
                const simpleNameErr = common.validateSimpleName(value);
                if (simpleNameErr !== true) {
                    return simpleNameErr;
                }
                // Check for duplicates in the current list
                const gridContainer = idInput.closest(".jc-grid-container");
                if (!gridContainer) return true;

                const customInputs = gridContainer.querySelectorAll(".jc-custom-row .jc-col-id input");
                let count = 0;
                customInputs.forEach(input => {
                    if (input.value.trim() === value) {
                        count++;
                    }
                });

                if (count > 1) {
                    return _("Duplicate Name \"%s\" in this list.").format(value);
                }

                // Check against built-in IDs
                const builtInIds = isBlock ? this.builtInBlockingIds : this.builtInRoutingIds;
                if (builtInIds && builtInIds.includes(value)) {
                    return _("Reserved or built-in Name \"%s\".").format(value);
                }

                return true;
            }.bind(this), "blur", "keyup");

            ui.addValidator(urlInput, "string", false, function(value) {
                if (!value || value.trim() === "") {
                    return _("URL / Local Path is required.");
                }
                if (value.includes("|") || value.includes("\n")) {
                    return _("URL / Local Path cannot contain pipe (|) or newlines.");
                }
                if (!/^(https?:\/\/|\/)/.test(value)) {
                    return _("URL / Local Path must start with http://, https://, or /");
                }
                return true;
            }, "blur", "keyup");

            ui.addValidator(authInput, "string", true, function(value) {
                if (value && (value.includes("|") || value.includes("\n"))) {
                    return _("Authorization cannot contain pipe (|) or newlines.");
                }
                return true;
            }, "blur", "keyup");
        }

        return row;
    },

    saveData: async function (_apply) {
        const routingRows = this.routingGrid.querySelectorAll(".jc-custom-row");
        const blockingRows = this.blockingGrid.querySelectorAll(".jc-custom-row");

        const routingData = [];
        const blockingData = [];

        const errors = [];

        // Validate Routing Rulesets
        routingRows.forEach((row, i) => {
            // Trigger real-time validation via blur events
            row.nameInput.dispatchEvent(new window.Event("blur"));
            row.idInput.dispatchEvent(new window.Event("blur"));
            row.urlInput.dispatchEvent(new window.Event("blur"));
            row.authInput.dispatchEvent(new window.Event("blur"));

            const nameErr = row.nameInput.getAttribute("data-tooltip");
            const idErr = row.idInput.getAttribute("data-tooltip");
            const urlErr = row.urlInput.getAttribute("data-tooltip");
            const authErr = row.authInput.getAttribute("data-tooltip");

            if (nameErr) errors.push(_("Routing Ruleset #%d (Readable name): %s").format(i + 1, nameErr));
            if (idErr) errors.push(_("Routing Ruleset #%d (Name): %s").format(i + 1, idErr));
            if (urlErr) errors.push(_("Routing Ruleset #%d (URL / Local Path): %s").format(i + 1, urlErr));
            if (authErr) errors.push(_("Routing Ruleset #%d (Authorization): %s").format(i + 1, authErr));

            if (!nameErr && !idErr && !urlErr && !authErr) {
                const name = row.nameInput.value.trim();
                const id = row.idInput.value.trim();
                const type = row.typeSelect.value;
                const url = row.urlInput.value.trim();
                const auth = row.authInput.value.trim();
                if (auth) {
                    routingData.push(`${name}|${id}|${type}|mrs|${url}|${auth}`);
                } else {
                    routingData.push(`${name}|${id}|${type}|mrs|${url}`);
                }
            }
        });

        // Validate Blocking Rulesets
        blockingRows.forEach((row, i) => {
            // Trigger real-time validation via blur events
            row.nameInput.dispatchEvent(new window.Event("blur"));
            row.idInput.dispatchEvent(new window.Event("blur"));
            row.urlInput.dispatchEvent(new window.Event("blur"));
            row.authInput.dispatchEvent(new window.Event("blur"));

            const nameErr = row.nameInput.getAttribute("data-tooltip");
            const idErr = row.idInput.getAttribute("data-tooltip");
            const urlErr = row.urlInput.getAttribute("data-tooltip");
            const authErr = row.authInput.getAttribute("data-tooltip");

            if (nameErr) errors.push(_("Blocking Ruleset #%d (Readable name): %s").format(i + 1, nameErr));
            if (idErr) errors.push(_("Blocking Ruleset #%d (Name): %s").format(i + 1, idErr));
            if (urlErr) errors.push(_("Blocking Ruleset #%d (URL / Local Path): %s").format(i + 1, urlErr));
            if (authErr) errors.push(_("Blocking Ruleset #%d (Authorization): %s").format(i + 1, authErr));

            if (!nameErr && !idErr && !urlErr && !authErr) {
                const name = row.nameInput.value.trim();
                const id = row.idInput.value.trim();
                const type = row.typeSelect.value;
                const url = row.urlInput.value.trim();
                const auth = row.authInput.value.trim();
                if (auth) {
                    blockingData.push(`${name}|${id}|${type}|mrs|${url}|${auth}`);
                } else {
                    blockingData.push(`${name}|${id}|${type}|mrs|${url}`);
                }
            }
        });

        if (errors.length > 0) {
            const errorContent = E("ul", { class: "jc-error-list" },
                errors.map(err => E("li", {}, err))
            );
            ui.addTimeLimitedNotification(_("Validation Error"), errorContent, common.notificationTimeout, "danger");
            return false;
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

    handleSave: function (_ev) {
        return this.saveData(false);
    },
    handleReset: null,
    handleSaveApply: null
});
