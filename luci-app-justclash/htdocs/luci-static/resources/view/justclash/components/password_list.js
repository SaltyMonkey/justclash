"use strict";
"require baseclass";
"require form";
"require ui";

// Free-form secret lists use DynamicList's item labels and draft input.
const PasswordList = ui.DynamicList.extend({
    render() {
        this.revealed = false;
        const node = this.super("render", []);
        const input = node.querySelector(".add-item > input");
        input.type = "password";
        input.autocomplete = "new-password";
        node.querySelector(".add-item").appendChild(E("button", {
            type: "button",
            class: "cbi-button cbi-button-neutral",
            title: _("Reveal/hide password"),
            "aria-label": _("Reveal/hide password"),
            "aria-pressed": "false",
            click: (event) => {
                event.preventDefault();
                this.revealed = !this.revealed;
                input.type = this.revealed ? "text" : "password";
                event.currentTarget.setAttribute("aria-pressed", String(this.revealed));
                node.querySelectorAll(".item").forEach((item) => {
                    item.querySelector("span").textContent = this.revealed
                        ? item.querySelector('input[type="hidden"]').value : "••••••••";
                });
            }
        }, "∗"));
        return node;
    },
    addItem(node, value, text, flash) {
        return this.super("addItem", [node, value, this.revealed ? value : "••••••••", flash]);
    },
    getValue() {
        const values = this.super("getValue", []);
        const input = this.node.querySelector(".add-item > input");
        // DynamicList only reads a pending entry from input[type=text].
        if (input.value.match(/\S/) && !input.classList.contains("cbi-input-invalid") && !values.includes(input.value))
            values.push(input.value);
        return values;
    }
});

const PasswordListValue = form.DynamicList.extend({
    renderWidget(sectionId, optionIndex, cfgvalue) {
        const widget = new PasswordList(L.toArray(cfgvalue ?? this.default), null, {
            id: this.cbid(sectionId),
            optional: this.optional || this.rmempty,
            datatype: this.datatype,
            placeholder: this.placeholder,
            validate: this.getValidator(sectionId),
            disabled: this.readonly ?? this.map.readonly
        });
        return widget.render();
    }
});

return baseclass.extend({ Value: PasswordListValue });
