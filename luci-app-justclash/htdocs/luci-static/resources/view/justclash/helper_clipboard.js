"use strict";
"require baseclass";

let clipboardTextarea = null;

return baseclass.extend({
    async copy(text) {
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const ta = clipboardTextarea || document.createElement("textarea");
        clipboardTextarea = ta;
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";

        if (!ta.parentNode)
            document.body.appendChild(ta);

        ta.focus();
        ta.select();

        if (!document.execCommand("copy"))
            throw new Error(_("Unable to copy to clipboard"));
    }
});
