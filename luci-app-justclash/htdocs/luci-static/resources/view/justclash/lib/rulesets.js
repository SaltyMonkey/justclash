"use strict";
"require baseclass";

const MAX_LOCATION_LENGTH = 4096;
const MAX_AUTH_LENGTH = 4096;
const CONTROL_CHARACTERS = /[\x00-\x1F\x7F]/;
const LOCAL_EXTENSIONS = {
    domain: [".mrs"],
    ipcidr: [".txt", ".list"]
};

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

const validateRulesetLocation = (value, type) => {
    const val = value ? value.trim() : "";

    if (!val)
        return _("URL / Local Path is required.");

    if (!Object.prototype.hasOwnProperty.call(LOCAL_EXTENSIONS, type))
        return _("Unsupported ruleset type.");

    if (val.length > MAX_LOCATION_LENGTH)
        return _("URL / Local Path must not exceed %d characters.").format(MAX_LOCATION_LENGTH);

    if (val.includes("|") || CONTROL_CHARACTERS.test(val))
        return _("URL / Local Path cannot contain pipe (|) or control characters.");

    if (/^https?:\/\//i.test(val)) {
        try {
            const url = new URL(val);

            if (!["http:", "https:"].includes(url.protocol)
                || !url.hostname
                || url.username
                || url.password)
                return _("Use an HTTP(S) URL without embedded credentials.");

            return true;
        } catch {
            return _("Invalid HTTP(S) URL.");
        }
    }

    if (!val.startsWith("/"))
        return _("URL / Local Path must be an HTTP(S) URL or an absolute path.");

    if (val.includes("//")
        || /(^|\/)\.{1,2}(\/|$)/.test(val)
        || /[\s"'`$;&|<>\\]/.test(val))
        return _("Local path contains unsafe characters or path segments.");

    const lowerPath = val.toLowerCase();
    const allowedExtensions = LOCAL_EXTENSIONS[type];

    if (!allowedExtensions.some(extension => lowerPath.endsWith(extension)))
        return type === "domain"
            ? _("Domain ruleset local path must end with .mrs.")
            : _("IP CIDR ruleset local path must end with .txt or .list.");

    return true;
};

const validateAuth = (value) => {
    const val = value ? value.trim() : "";

    if (!val)
        return true;

    if (val.length > MAX_AUTH_LENGTH)
        return _("Authorization must not exceed %d characters.").format(MAX_AUTH_LENGTH);

    if (val.includes("|") || CONTROL_CHARACTERS.test(val))
        return _("Authorization cannot contain pipe (|) or control characters.");

    return true;
};

return baseclass.extend({
    createEmptyRule,
    parse,
    serialize,
    serializeList,
    validateReadableName,
    validateRulesetLocation,
    validateAuth
});
