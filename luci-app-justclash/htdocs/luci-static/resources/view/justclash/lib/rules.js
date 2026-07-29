"use strict";
"require baseclass";

const normalizeList = (response) => Array.isArray(response?.rules) ? response.rules : [];

const getTypeClass = (type) => {
    const normalized = String(type || "").toLowerCase();

    if (["domain", "host", "keyword", "regex"].some(part => normalized.includes(part)))
        return "domain";
    if (["ip", "cidr", "geoip"].some(part => normalized.includes(part)))
        return "ipcidr";

    return "classical";
};

const createSearchText = (rule) => [rule?.type, rule?.payload, rule?.proxy]
    .map(value => String(value || "").toLowerCase())
    .join("\n");

const matchesSearch = (searchText, query) => !query || searchText.includes(query.toLowerCase().trim());

return baseclass.extend({
    normalizeList,
    getTypeClass,
    createSearchText,
    matchesSearch
});
