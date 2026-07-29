"use strict";
"require baseclass";
"require uci";

const collectExitOptions = (configName, baseOptions) => {
    const result = baseOptions.map(item => ({ ...item }));
    const seen = new Set(result.map(item => item.value));

    ["proxies", "proxy_group"].forEach((type) => {
        uci.sections(configName, type).forEach((section) => {
            const name = String(section.name || "").trim();

            if (section.enabled !== "0" && name && !seen.has(name)) {
                seen.add(name);
                result.push({ value: name, text: name });
            }
        });
    });

    return result;
};

const makeDynamic = (option, configName, baseOptions) => {
    const originalLoad = option.load;

    option.load = function (sectionId) {
        const choices = collectExitOptions(configName, baseOptions);

        this.keylist = choices.map(item => item.value);
        this.vallist = choices.map(item => item.text);

        return originalLoad.call(this, sectionId);
    };
};

return baseclass.extend({ collectExitOptions, makeDynamic });
