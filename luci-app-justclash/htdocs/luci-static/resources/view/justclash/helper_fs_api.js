"use strict";
"require baseclass";
"require fs";
"require view.justclash.helper_common as common";

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
        const res = await fs.exec(common.initdPath, ["enabled"]);
        return res.code === 0;
    },

    async isServiceRunning() {
        const res = await fs.exec(common.initdPath, ["running"]);
        return res.code === 0;
    }
});
