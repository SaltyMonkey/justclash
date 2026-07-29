"use strict";
"require baseclass";

const createEmptyRule = () => ({
    name: "",
    id: "",
    type: "domain",
    format: "mrs",
    url: "",
    auth: ""
});

const parse = (content) => {
    if (!content)
        return [];

    return content.split("\n")
        .map(line => line.trim())
        .filter(line => line && !line.startsWith("#"))
        .map((line) => {
            const parts = line.split("|").map(part => part.trim());

            return {
                name: parts[0] || "",
                id: parts[1] || "",
                type: parts[2] || "domain",
                format: parts[3] || "mrs",
                url: parts[4] || "",
                auth: parts[5] || ""
            };
        })
        .filter(rule => rule.name && rule.id);
};

const serialize = (rule) => {
    const type = rule.type === "ipcidr" ? "ipcidr" : "domain";
    const fields = [
        String(rule.name || "").trim(),
        String(rule.id || "").trim(),
        type,
        type === "ipcidr" ? "text" : "mrs",
        String(rule.url || "").trim()
    ];
    const auth = String(rule.auth || "").trim();

    if (auth)
        fields.push(auth);

    return fields.join("|");
};

const serializeList = (rules) => rules.length > 0
    ? rules.map(serialize).join("\n") + "\n"
    : "";

const validateReadableName = (value) => {
    if (!value || value.trim() === "")
        return _("Readable name is required.");

    if (!/^[a-zA-Z\u0430-\u044f\u0410-\u042f\u0451\u04010-9_\s-]+$/.test(value))
        return _("Readable name contains invalid characters. Only letters, numbers, spaces, underscores, and dashes are allowed.");

    return true;
};

const validateLocation = (value) => {
    if (!value || value.trim() === "")
        return _("URL / Local Path is required.");
    if (value.includes("|") || value.includes("\n"))
        return _("URL / Local Path cannot contain pipe (|) or newlines.");
    if (!/^(https?:\/\/|\/)/.test(value))
        return _("URL / Local Path must start with http://, https://, or /");

    return true;
};

const validateAuth = (value) => value && (value.includes("|") || value.includes("\n"))
    ? _("Authorization cannot contain pipe (|) or newlines.")
    : true;

return baseclass.extend({
    createEmptyRule,
    parse,
    serialize,
    serializeList,
    validateReadableName,
    validateLocation,
    validateAuth
});
