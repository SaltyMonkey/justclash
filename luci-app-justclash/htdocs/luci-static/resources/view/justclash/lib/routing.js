"use strict";
"require baseclass";
"require uci";

const defaultExitSectionTypes = ["proxies", "proxy_group"];

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

return baseclass.extend({ collectExitOptions, makeDynamic });
