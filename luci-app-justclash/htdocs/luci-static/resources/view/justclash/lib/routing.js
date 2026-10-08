"use strict";
"require baseclass";
"require uci";
"require view.justclash.common as common";

const defaultExitSectionTypes = ["proxies", "proxy_group"];
const BULK_IMPORT_MAX_ITEMS = 128;

const isJsonObject = (value) =>
    Object.prototype.toString.call(value) === "[object Object]" && !Array.isArray(value);

const parseBulkProxyObjects = (value) => {
    let parsed;

    try {
        parsed = JSON.parse(value);
    } catch {
        throw new Error(_("Invalid JSON format"));
    }

    if (!Array.isArray(parsed))
        throw new Error(_("JSON must be an array"));

    if (!parsed.length)
        throw new Error(_("JSON array cannot be empty"));

    if (parsed.length > BULK_IMPORT_MAX_ITEMS)
        throw new Error(_("JSON array must contain no more than %d proxy objects.").format(BULK_IMPORT_MAX_ITEMS));

    const names = new Set();

    return parsed.map((item, index) => {
        if (!isJsonObject(item))
            throw new Error(_("Entry %d must be a JSON object.").format(index + 1));

        const name = String(item.name || "").trim();
        const nameValidation = common.validateSimpleName(name);

        if (nameValidation !== true)
            throw new Error(_("Entry %d: %s").format(index + 1, nameValidation));

        if (names.has(name))
            throw new Error(_("Proxy name in entry %d is duplicated.").format(index + 1));

        names.add(name);

        const proxyObject = JSON.parse(JSON.stringify(item));
        delete proxyObject.name;

        const objectJson = JSON.stringify(proxyObject);
        const objectValidation = common.validateProxyJsonObject(objectJson);

        if (objectValidation !== true)
            throw new Error(_("Entry %d: %s").format(index + 1, objectValidation));

        return {
            name,
            objectJson: common.normalizeProxyJsonObject(objectJson)
        };
    });
};

const collectNamedOptions = (configName, baseOptions, sectionTypes, excludedSectionId) => {
    const result = baseOptions.map(item => ({ ...item }));
    const seen = new Set(result.map(item => item.value));

    sectionTypes.forEach((type) => {
        uci.sections(configName, type).forEach((section) => {
            const name = String(section.name || "").trim();

            if (section[".name"] !== excludedSectionId && section.enabled !== "0" && name && !seen.has(name)) {
                seen.add(name);
                result.push({ value: name, text: name });
            }
        });
    });

    return result;
};

const collectExitOptions = (configName, baseOptions) =>
    collectNamedOptions(configName, baseOptions, defaultExitSectionTypes);

const makeDynamic = (option, configName, baseOptions, sectionTypes = defaultExitSectionTypes, excludeCurrentSection = false) => {
    const originalLoad = option.load;

    option.load = function (sectionId) {
        const choices = collectNamedOptions(
            configName,
            baseOptions,
            sectionTypes,
            excludeCurrentSection ? sectionId : null
        );

        this.keylist = choices.map(item => item.value);
        this.vallist = choices.map(item => item.text);

        return originalLoad.call(this, sectionId);
    };
};

const validateBulkProxyNames = (configName, entries) => {
    const existingNames = new Set(
        uci.sections(configName, "proxies")
            .map(section => String(section.name || "").trim())
            .filter(Boolean)
    );
    const duplicateIndex = entries.findIndex(entry => existingNames.has(entry.name));

    return duplicateIndex === -1
        ? true
        : _("Proxy name in entry %d already exists.").format(duplicateIndex + 1);
};

const removeGroupMemberReferences = (configName, sectionType, name) => {
    const isProvider = sectionType === "proxy_provider";
    const memberOption = isProvider ? "providers" : "proxies";

    uci.sections(configName, "proxy_group").forEach((group) => {
        const sectionId = group[".name"];
        const members = Array.isArray(group[memberOption])
            ? group[memberOption]
            : group[memberOption] ? [group[memberOption]] : [];
        const remaining = members.filter(member => member !== name);

        if (remaining.length !== members.length) {
            if (remaining.length)
                uci.set(configName, sectionId, memberOption, remaining);
            else
                uci.unset(configName, sectionId, memberOption);
        }

        const otherMembers = group[isProvider ? "proxies" : "providers"];
        const emptiedGroup = remaining.length !== members.length && !remaining.length
            && !(Array.isArray(otherMembers) ? otherMembers.length : otherMembers);

        if ((!isProvider && group.default_selected === name) || emptiedGroup)
            uci.unset(configName, sectionId, "default_selected");
    });

};

const resetExitRuleReferences = (configName, name) => {
    ["final_rules", "mixed_port_rules"].forEach((type) => {
        const fallback = common.endRuleOptions[type === "mixed_port_rules" ? 1 : 0].value;
        uci.sections(configName, type).forEach((section) => {
            if (section.exit_rule === name)
                uci.set(configName, section[".name"], "exit_rule", fallback);
        });
    });
};

const resetDownloadReferences = (configName, name) => {
    ["proxy_provider", "block_rules"].forEach((type) => {
        uci.sections(configName, type).forEach((section) => {
            if (section.proxy === name)
                uci.set(configName, section[".name"], "proxy", common.endRuleOptions[0].value);
        });
    });
};

const clearObjectDialerReference = (configName, section, name) => {
    if (section.mode !== "object" || !section.proxy_link_object)
        return;

    let object;
    try {
        object = JSON.parse(section.proxy_link_object);
    } catch {
        return;
    }

    const outbound = Array.isArray(object) && object.length === 1 ? object[0] : object;
    if (isJsonObject(outbound) && outbound["dialer-proxy"] === name) {
        delete outbound["dialer-proxy"];
        uci.set(configName, section[".name"], "proxy_link_object", JSON.stringify(object));
    }
};

const clearDialerReferences = (configName, name) => {
    uci.sections(configName, "proxies").forEach((section) => {
        if (section.dialer_proxy === name)
            uci.unset(configName, section[".name"], "dialer_proxy");

        clearObjectDialerReference(configName, section, name);
    });

    uci.sections(configName, "proxy_provider").forEach((section) => {
        if (section.override_dialer_proxy === name)
            uci.unset(configName, section[".name"], "override_dialer_proxy");
    });
};

const removeRoutingReferences = (configName, sectionType, name) => {
    if (!name)
        return;

    removeGroupMemberReferences(configName, sectionType, name);
    if (sectionType === "proxy_provider")
        return;

    resetExitRuleReferences(configName, name);
    resetDownloadReferences(configName, name);
    clearDialerReferences(configName, name);
};

const removeProxySections = (configName, sectionIds) => {
    sectionIds.slice().reverse().forEach(sectionId => uci.remove(configName, sectionId));
};

const addBulkProxySections = (configName, entries) => {
    const sectionIds = [];

    try {
        entries.forEach((entry) => {
            const sectionId = uci.add(configName, "proxies");

            if (!sectionId)
                throw new Error(_("Unable to add proxy entry."));

            sectionIds.push(sectionId);
            uci.set(configName, sectionId, "enabled", "1");
            uci.set(configName, sectionId, "name", entry.name);
            uci.set(configName, sectionId, "mode", "object");
            uci.set(configName, sectionId, "proxy_link_object", entry.objectJson);
        });
    } catch (error) {
        removeProxySections(configName, sectionIds);
        throw error;
    }

    return sectionIds;
};

return baseclass.extend({
    collectExitOptions,
    makeDynamic,
    parseBulkProxyObjects,
    validateBulkProxyNames,
    removeRoutingReferences,
    addBulkProxySections,
    removeProxySections
});
