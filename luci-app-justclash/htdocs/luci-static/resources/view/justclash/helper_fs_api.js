"use strict";
"require baseclass";
"require fs";
"require view.justclash.helper_common as common";
"require rpc";

const callServiceList = rpc.declare({
    object: "service",
    method: "list",
    params: ["name"],
    expect: { "": {} }
});

const callInitList = rpc.declare({
    object: "luci",
    method: "getInitList",
    params: ["name"],
    expect: { "": {} }
});

return baseclass.extend({
    async readFileSafe(path, fallback = "") {
        try {
            const content = await fs.read(path);
            return content != null ? content : fallback;
        } catch {
            return fallback;
        }
    },

    parseNameYamlEntries(content) {
        if (!content)
            return [];

        return content.split("\n")
            .filter(line => line.trim() && !line.trim().startsWith("#"))
            .map(line => {
                const [name, yamlName] = line.split("|");
                return {
                    name: name ? name.trim() : null,
                    yamlName: yamlName ? yamlName.trim() : null
                };
            })
            .filter(item => item.name && item.yamlName);
    },

    async readNameYamlEntries(path) {
        const content = await this.readFileSafe(path);
        return this.parseNameYamlEntries(content);
    },

    async isServiceAutoStartEnabled() {
        try {
            const res = await callInitList(common.binName);
            return !!(res && res[common.binName] && res[common.binName].enabled);
        } catch {
            return false;
        }
    },

    async isServiceRunning() {
        try {
            const res = await callServiceList(common.binName);
            const instances = (res && res[common.binName] && res[common.binName].instances) ? res[common.binName].instances : {};
            return Object.values(instances).some(instance => instance.running);
        } catch {
            return false;
        }
    }
});
