"require baseclass";

return baseclass.extend({
    justclashLuciVersion: "__COMPILED_VERSION_VARIABLE__",
    justclashOnlineVersionUrl: "__ONLINE_VERSION_CHECK_URL__",
    binName: "justclash",
    initdPath: "/etc/init.d/justclash",
    binPath: "/usr/bin/justclash",
    blockRulesetsFilePath: "/etc/justclash/block.rulesets.txt",
    rulesetsFilePath: "/etc/justclash/rulesets.txt",
    //genNameProxyPrefix: "proxy",
    //genNameProxyProviderPrefix: "provider",
    logsCount: "800",
    defaultProxiesModes: [{ value: "object", text: "Object" }, { value: "uri", text: "URL" }],
    genNameProxyGroupPrefix: "proxygroup",
    defaultLoggingLevels: ["info", "warning", "error", "silent", "debug"],
    defaultProxyGroupCheckUrl: "https://www.gstatic.com/generate_204",
    defaultProxyProvidersCheckUrl: "https://www.gstatic.com/generate_204",
    defaultProxyGroupIntervalSec: 360,
    defaultProxyGroupsTypes: [{ value: "fallback", text: "Fallback" }, { value: "load-balancer", text: "Load balancer" }, { value: "url-test", text: "URL Test" }],
    defaultProxyGroupsBalanceModeStrategies: [{ value: "consistent-hashing", text: "Consistent hashing" }, { value: "round-robin", text: "Round robin" }],
    defaultUrlTestTolerance: 50,
    defaultProxyProviderIntervalSec: 3600,
    defaultProxyProviderHealthCheckSec: 360,
    defaultHealthCheckTimeoutMs: 5000,
    defaultHealthCheckResult: 204,
    defaultNftOptions: [{ value: "BY RULES", text: _("By rules") }, { value: "DROP", text: _("Drop") }],
    defaultNftNtpOptions: [{ value: "BY RULES", text: _("By rules") }, { value: "DROP", text: _("Drop") }, { value: "DIRECT", text: _("Direct") }],
    defaultUserAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.2.6172.169 Safari/537.36",
    defaultFingerprints: ["chrome", "firefox", "safari", "android", "360", "iOS", "random", "edge"],
    defaultUpdateOptions: [{ value: "no", text: _("Disabled") }, { value: "checkandupdate", text: _("Check and do update") }],
    defaultTimeoutForWSReconnect: 10000,
    defaultRuleSetUpdateInterval: 86400,
    minimalRuleSetUpdateInterval: 21600,
    endRuleOptions: [{ value: "DIRECT", text: _("Direct") }, { value: "BY RULES", text: _("By rules") }, { value: "REJECT", text: _("Reject") }],
    generateRandomName: function (prefix) {
        return `${prefix}${Math.random().toString(16).substr(2, 8)}`;
    },
    splitAndTrimString: function (value, delimiter = ",") {

        return value.split(delimiter)
            .map(item => item.trim())
            .filter(item => item.length > 0);
    },
    valueToArray: function (value) {
        // Already an array
        if (Array.isArray(value)) {
            return value;
        }

        // String value
        if (typeof value === "string") {
            return value.length > 0 ? [value] : [];
        }

        // Number or other primitive types
        if (value !== null && value !== undefined) {
            return [value];
        }

        // Null or undefined
        return [];
    },
    isValidHttpUrl: function (value) {
        try {
            const url = new URL(value);
            return ["http:", "https:"].includes(url.protocol);
        } catch (e) {
            return false;
        }
    },
    isValidResourceFilePath: function (value) {
        if (value === "") return true;
        if ((value.startsWith("http://")
            || value.startsWith("https://")
            || value.startsWith("/"))
            && value.endsWith(".mrs"))
            return true;
        return false;
    },
    isValidDomainProto: function (value) {
        const val = value.trim();
        if (val.startsWith("https://") ||
            val.startsWith("tls://") ||
            val.startsWith("udp://") ||
            val.startsWith("quic://")) {
            return true;
        } else {
            return false;
        }
    },
    isValidIpv4: function (value) {
        const val = value.trim();
        const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipv4Regex.test(val);
    },
    isValidCronString: function (value) {
        const val = value.trim();
        const cronRegex = /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([012]?\d|3[01])) (\*|([0]?\d|1[0-2])) (\*|[0-6])$/;

        return cronRegex.test(val);
    },
    compareArraysWithReturnedResult: function (arr1, arr2) {
        return arr1.filter(value => arr2.includes(value));
    },
    isValidSimpleName: function (value) {
        const val = value.trim();
        const pattern = /^[a-zA-Z0-9_.><-]+$/;
        return pattern.test(val);
    },
    isValidProxyLink: function (value) {
        const val = value ? value.trim() : "";

        const allowedPrefixes = [
            "vless://",
            "trojan://",
            "ss://",
            "socks5://",
            "socks4://",
            "socks://",
            "https://",
            "mierus://"
        ];

        if (!val || val === "") return _("Proxy link cannot be empty!");

        const prefix = allowedPrefixes.find(p => val.startsWith(p));
        if (!prefix) return _("Input is not supported or incorrect!");

        if (/\s/.test(val)) return _("Proxy link contains not encoded whitespace!");

        try {
            new URL(val);

            return true;

        } catch (e) {
            return _("Proxy link can't be parsed!"); // Невалидный URL, например, ошибка разбора
        }
    },
    isValidDomainSuffix: function (value) {
        if (!value || value.trim() === "") return true;

        value = value.trim();

        if (/\s/.test(value))
            return _("Domain must not contain spaces");

        if (!value.includes("."))
            return _("Domain must contain at least one dot");

        if (/^[.-]/.test(value) || /[.-]$/.test(value))
            return _("Suffix must not start or end with a dot or hyphen");

        if (/\.\.|--/.test(value))
            return _("Double dots or double hyphens are not allowed");

        if (value.split(".").some(part => part.length === 0))
            return _("There must be no empty segments between dots");

        if (value.split(".").some(part => part.length > 63))
            return _("Each domain segment must not exceed 63 characters");
        if (value.length > 253)
            return _("Suffix length must not exceed 253 characters");

        return true;
    },
    isValidDomainKeyword: function (value) {
        value = value.trim();

        if (!value || value.trim() === "") return true;

        if (/\s/.test(value))
            return _("Keyword must not contain spaces");

        if (/,/.test(value))
            return _("Only one keyword per field is allowed");

        if (value.length < 2)
            return _("Keyword should be at least 2 characters long");

        return true;
    },
    isValidDomainRegexp: function (value) {
        if (!value || value.trim() === "") return true;

        value = value.trim();

        if (/^\s|\s$/.test(value))
            return _("Regexp must not start or end with a space");

        try {
            new RegExp(value);
        } catch (e) {
            return _("Invalid regular expression: ") + (e.message || e);
        }

        return true;
    },
    isValidKeywordOrRegexList: function (value, ctxLabel) {
        if (!value || value.trim() === "") return true;

        const parts = value.split("|");
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            if (!part) continue;

            try {
                new RegExp(part); // поддерживается и keyword, и regexp
            } catch (e) {
                return _("Invalid expression in ") + ctxLabel + ": " + part;
            }
        }

        return true;
    },
    //for autogeneration, titles luci-app-justclash.json
    stub_status_tab: _("Status"),
    stub_logs_tab: _("Logs"),
    stub_connections_tab: _("Connections"),
    stub_routing_tab: _("Routing"),
    stub_service_tab: _("Service"),
    stub_proxy_tab: _("Proxy")
});