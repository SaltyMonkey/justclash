"use strict";
"require baseclass";
"require fs";
"require view.justclash.common as common";

return baseclass.extend({
    async readFileSafe(path, fallback = "") {
        try {
            const content = await fs.read(path);
            return content ?? fallback;
        } catch {
            return fallback;
        }
    },

    async saveFileSafe(routingContent, blockingContent) {
        const routingBackup = await fs.read(common.userRulesetsFilePath) ?? "";
        const blockingBackup = await fs.read(common.userBlockRulesetsFilePath) ?? "";

        try {
            await fs.write(common.userRulesetsFilePath, routingContent ?? "");
            await fs.write(common.userBlockRulesetsFilePath, blockingContent ?? "");
        } catch {
            let rollbackFailed = false;

            try {
                await fs.write(common.userRulesetsFilePath, routingBackup);
            } catch {
                rollbackFailed = true;
            }

            try {
                await fs.write(common.userBlockRulesetsFilePath, blockingBackup);
            } catch {
                rollbackFailed = true;
            }

            throw new Error(rollbackFailed
                ? _("Failed to save rulesets and rollback was incomplete.")
                : _("Failed to save rulesets; previous content was restored."));
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
    }
});
