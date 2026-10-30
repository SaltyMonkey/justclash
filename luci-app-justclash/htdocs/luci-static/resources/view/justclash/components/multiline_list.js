"use strict";
"require baseclass";
"require form";

const MultilineList = form.TextValue.extend({
    rows: 12,
    monospace: true,
    parseEntries(value) {
        return String(value || "").split(/[\r\n]+/).map(entry => entry.trim()).filter(Boolean);
    },
    renderWidget(sectionId, optionIndex, cfgvalue) {
        const value = (Array.isArray(cfgvalue) ? cfgvalue : cfgvalue ? [cfgvalue] : []).join("\n");
        return form.TextValue.prototype.renderWidget.call(this, sectionId, optionIndex, value);
    },
    validate(sectionId, value) {
        const entries = this.parseEntries(value);
        for (let i = 0; i < entries.length; i++) {
            const result = this.validateEntry(entries[i]);
            if (result !== true)
                return _("Entry %d: %s").format(i + 1, result);
        }
        return true;
    },
    write(sectionId, value) {
        const entries = [...new Set(this.parseEntries(value))];
        return entries.length
            ? form.TextValue.prototype.write.call(this, sectionId, entries)
            : this.remove(sectionId);
    }
});

return baseclass.extend({ Value: MultilineList });
