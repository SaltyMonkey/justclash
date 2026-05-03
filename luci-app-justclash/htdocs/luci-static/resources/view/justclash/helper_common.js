"use strict";
"require baseclass";

return baseclass.extend({
    // Project constants
    justclashLuciVersion: "__COMPILED_VERSION_VARIABLE__",
    binName: "justclash",
    initdPath: "/etc/init.d/justclash",
    binPath: "/usr/bin/justclash",
    blockRulesetsFilePath: "/etc/justclash/block.rulesets.txt",
    rulesetsFilePath: "/etc/justclash/rulesets.txt",
    logsCount: "400",

    // Default option values
    defaultNtpServers: [
        { value: "194.190.168.1", text: "ntp.msk-ix.ru" },
        { value: "89.109.251.22", text: "ntp2.vniiftri.ru" },
        { value: "89.109.251.23", text: "ntp3.vniiftri.ru" },
        { value: "216.239.35.4", text: "time2.google.com" },
        { value: "216.239.35.8", text: "time3.google.com" },
    ],
    defaultKeepAliveSec: [
        { value: "15", text: _("Every 15 seconds") },
        { value: "25", text: _("Every 25 seconds") },
        { value: "35", text: _("Every 35 seconds") },
        { value: "45", text: _("Every 45 seconds") },
        { value: "60", text: _("Every 1 minute") },
    ],
    defaultNtpIntervalValuesMin: [
        { value: "30", text: _("Every 30 minutes") },
        { value: "60", text: _("Every 60 minutes") },
        { value: "120", text: _("Every 120 minutes") },
        { value: "180", text: _("Every 180 minutes") }
    ],
    defaultBootDelayValuesSec: [
        { value: "5", text: _("5 seconds") },
        { value: "10", text: _("10 seconds") },
        { value: "20", text: _("20 seconds") },
        { value: "40", text: _("40 seconds") }
    ],
    defaultFakeIPTtlValues: [
        { value: "1", text: _("For 1 minute") },
        { value: "2", text: _("For 2 minutes") },
        { value: "3", text: _("For 3 minutes") },
    ],
    defaultIPDnsCache: [
        { value: "1024", text: _("1024 entries") },
        { value: "2048", text: _("2048 entries") },
        { value: "4096", text: _("4096 entries") },
        { value: "8192", text: _("8192 entries") },
        { value: "16384", text: _("16384 entries") },
    ],
    defaultRuleSetUpdateIntervalSec: [
        { value: "86400", text: _("Every 24 hours") },
        { value: "43200", text: _("Every 12 hours") },
        { value: "172800", text: _("Every 48 hours") },
        { value: "259200", text: _("Every 72 hours") },
    ],
    defaultProxyGroupIntervalSec: [
        { value: "60", text: _("Every 1 minute") },
        { value: "120", text: _("Every 2 minutes") },
        { value: "180", text: _("Every 3 minutes") },
        { value: "360", text: _("Every 6 minutes") },
    ],
    defaultUrlTestToleranceMs: [
        { value: "10", text: _("10 milliseconds") },
        { value: "20", text: _("20 milliseconds") },
        { value: "30", text: _("30 milliseconds") },
        { value: "40", text: _("40 milliseconds") },
        { value: "50", text: _("50 milliseconds") },
        { value: "100", text: _("100 milliseconds") },
    ],
    defaultHealthCheckResultCode: [
        { value: "200", text: _("Response code 200") },
        { value: "204", text: _("Response code 204") },
    ],
    defaultHealthCheckTimeoutMs: [
        { value: "1000", text: _("1 second") },
        { value: "2000", text: _("2 seconds") },
        { value: "3000", text: _("3 seconds") },
        { value: "5000", text: _("5 seconds") },
        { value: "10000", text: _("10 seconds") },
    ],
    defaultMaxFailedTimes: [
        { value: "1", text: "1" },
        { value: "2", text: "2" },
        { value: "3", text: "3" },
        { value: "4", text: "4" },
        { value: "5", text: "5" },
        { value: "10", text: "10" },
    ],
    defaultProxyProviderHealthCheckSec: [
        { value: "60", text: _("Every 1 minute") },
        { value: "120", text: _("Every 2 minutes") },
        { value: "180", text: _("Every 3 minutes") },
        { value: "360", text: _("Every 6 minutes") },
        { value: "720", text: _("Every 12 minutes") },
    ],
    defaultProxyProviderUpdateIntervalSec: [
        { value: "1800", text: _("Every 30 minutes") },
        { value: "3600", text: _("Every hour") },
        { value: "10800", text: _("Every 3 hour") }
    ],
    defaultDownloadSizeLimits: [
        { value: "0", text: "0 MiB" },
        { value: "1048576", text: "1 MiB" },
        { value: "2097152", text: "2 MiB" },
        { value: "3145728", text: "3 MiB" },
        { value: "5242880", text: "5 MiB" },
        { value: "10485760", text: "10 MiB" },
        { value: "26214400", text: "25 MiB" }
    ],
    defaultProxiesModes: [
        { value: "object", text: _("Object") },
        { value: "uri", text: _("URL") }
    ],
    defaultLoggingLevels: [
        "info",
        "warning",
        "error",
        "debug",
        "silent"
    ],
    defaultHealthCheckUrls: [
        "https://www.gstatic.com/generate_204",
        "https://clients3.google.com/generate_204",
        "https://cp.cloudflare.com/generate_204",
        "https://www.gstatic.cn/generate_204",
        "https://g.cn/generate_204",
    ],
    defaultProxyGroupsTypes: [
        { value: "fallback", text: _("Fallback") },
        { value: "load-balance", text: _("Load balancer") },
        { value: "url-test", text: _("URL Test") }
    ],
    defaultProxyGroupsBalanceModeStrategies: [
        { value: "consistent-hashing", text: _("Consistent hashing") },
        { value: "round-robin", text: _("Round robin") },
        { value: "sticky-sessions", text: _("Sticky sessions") }
    ],
    defaultNftOptions: [
        { value: "BY RULES", text: _("By rules") },
        { value: "DROP", text: _("Drop") }
    ],
    defaultNftNtpOptions: [
        { value: "BY RULES", text: _("By rules") },
        { value: "DROP", text: _("Drop") },
        { value: "DIRECT", text: _("Direct") }
    ],
    defaultUserAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7727.101 Safari/537.36",
    defaultFingerprints: [
        "chrome",
        "firefox",
        "safari",
        "android",
        "360",
        "iOS",
        "random",
        "randomized",
        "edge"
    ],
    defaultUpdateOptions: [
        { value: "no", text: _("Disabled") },
        { value: "checkandupdate", text: _("Check and do update") }
    ],
    defaultUpdateChannelOptions: [
        { value: "stable", text: _("Stable") },
        { value: "alpha", text: _("Alpha") }
    ],

    // Shared timing values
    notificationTimeout: 3000,
    defaultTimeoutForWSReconnect: 10000,
    minimalRuleSetUpdateInterval: 21600,

    // Common option sets
    endRuleOptions: [
        { value: "DIRECT", text: _("Direct") },
        { value: "BY RULES", text: _("By rules") },
        { value: "REJECT", text: _("Reject") }
    ],

    // Form helpers and validators
    hasControlChars: function (value) {
        return /[\x00-\x1F\x7F]/.test(String(value || ""));
    },
    validateIntegerRange: function (value, min, max) {
        const val = String(value || "").trim();

        if (!/^\d+$/.test(val))
            return _("Use a non-negative integer");

        const number = Number(val);
        if (!Number.isSafeInteger(number))
            return _("Number is too large");

        if (min !== null && number < min)
            return _("Value must be at least %s").replace("%s", min);

        if (max !== null && number > max)
            return _("Value must not exceed %s").replace("%s", max);

        return true;
    },
    validateHttpStatus: function (value) {
        return this.validateIntegerRange(value, 100, 599);
    },
    validateSecondsInterval: function (value) {
        return this.validateIntegerRange(value, 1, 31536000);
    },
    validateMillisecondsTimeout: function (value) {
        return this.validateIntegerRange(value, 100, 60000);
    },
    filterOutboundDeviceSelect: function (section_id, value) {
        if (value === "lo") {
            return false;
        }

        const device = (this.devices || []).find(function (dev) {
            return dev.getName() === value;
        });

        return !device || device.getType() !== "loopback";
    },
    filterInboundDeviceSelect: function (section_id, value) {
        if (["wan", "phy0-ap0", "phy1-ap0", "pppoe-wan"].indexOf(value) !== -1) {
            return false;
        }

        const device = (this.devices || []).find(function (dev) {
            return dev.getName() === value;
        });

        if (!device) {
            return true;
        }

        const type = device.getType();
        return type !== "wifi" && type !== "wireless" && !type.includes("wlan");
    },
    isValidHttpUrl: function (value) {
        const val = String(value || "").trim();

        if (!val || /\s/.test(val) || this.hasControlChars(val))
            return false;

        try {
            const url = new URL(val);
            return ["http:", "https:"].includes(url.protocol)
                && !!url.hostname
                && !url.username
                && !url.password;
        } catch {
            return false;
        }
    },
    isValidResourceFilePath: function (value) {
        const val = String(value || "").trim();

        if (val === "") return true;

        if (val.startsWith("http://") || val.startsWith("https://")) {
            if (!this.isValidHttpUrl(val))
                return false;

            try {
                const url = new URL(val);
                return url.pathname.toLowerCase().endsWith(".mrs");
            } catch {
                return false;
            }
        }

        // Local paths are consumed later by shell/YAML glue. Feeding it metacharacters would be bold, and not in a good way.
        if (val.startsWith("/")
            && val.toLowerCase().endsWith(".mrs")
            && !val.includes("..")
            && !/[\s"'`$;&|<>\\]/.test(val)
            && !this.hasControlChars(val))
            return true;

        return false;
    },
    isValidDnsServer: function (value) {
        const val = String(value || "").trim();

        if (!val || /\s/.test(val) || this.hasControlChars(val))
            return false;

        if (this.isValidIpv4(val))
            return true;

        try {
            const url = new URL(val);
            const allowedProtocols = ["https:", "tls:", "udp:", "quic:"];

            if (!allowedProtocols.includes(url.protocol)
                || !url.hostname
                || url.username
                || url.password
                || url.hash)
                return false;

            if (url.port) {
                const port = Number(url.port);
                if (!Number.isInteger(port) || port < 1 || port > 65535)
                    return false;
            }

            return true;
        } catch {
            return false;
        }
    },
    validateDnsServer: function (value) {
        return this.isValidDnsServer(value)
            ? true
            : _("Invalid nameserver format. Allowed: quic://, https://, tls://, udp:// or IPv4.");
    },
    isValidIpv4: function (value) {
        const val = String(value || "").trim();
        const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipv4Regex.test(val);
    },
    isValidCronString: function (value) {
        const val = String(value || "").trim();
        const cronRegex = /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([012]?\d|3[01])) (\*|([0]?\d|1[0-2])) (\*|[0-6])$/;

        return cronRegex.test(val);
    },
    isValidSimpleName: function (value) {
        const val = String(value || "").trim();
        const pattern = /^[a-z0-9_]+$/;
        return val.length <= 64 && pattern.test(val);
    },
    validateSimpleName: function (value) {
        return this.isValidSimpleName(value)
            ? true
            : _("Name must contain 1-64 lowercase letters, digits, and underscores");
    },
    validateUsernameOrUid: function (value) {
        const trimmedValue = String(value || "").trim();

        if (!trimmedValue)
            return true;

        if (/^\d+$/.test(trimmedValue))
            return this.validateIntegerRange(trimmedValue, 0, 65535);

        return /^[A-Za-z_][A-Za-z0-9_-]*[$]?$/.test(trimmedValue)
            ? true
            : _("Use a user name or numeric UID");
    },
    validateRoutingMark: function (value) {
        const val = String(value || "").trim();

        if (!val)
            return true;

        if (this.hasControlChars(val) || /\s/.test(val))
            return _("Routing mark must not contain whitespace or control characters");

        if (!/^\d+$/.test(val))
            return _("Use a decimal number, for example 268435456");

        const mark = Number(val);
        if (!Number.isSafeInteger(mark))
            return _("Routing mark is too large");

        if (mark < 1 || mark > 2147483647)
            return _("Routing mark must be between 1 and 2147483647");

        if (mark === 3 || mark === 255)
            return _("Routing mark 0x3 and 0xff are reserved by JustClash");

        return true;
    },
    validateProxyAuthenticationEntry: function (value) {
        const val = value ? value.trim() : "";

        if (!val) {
            return true;
        }

        if (/\s/.test(val) || this.hasControlChars(val))
            return _("Value must not contain whitespace or control characters");

        const parts = val.split(":");
        if (parts.length > 2) {
            return _("Only one : separator is allowed");
        }

        if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
            return _("Value must use the user:pass format");
        }

        return true;
    },
    validateApiSecret: function (value) {
        const val = String(value || "").trim();

        if (!val)
            return _("API password cannot be empty");

        if (val.length < 8)
            return _("Use at least 8 characters");

        if (/\s/.test(val) || this.hasControlChars(val))
            return _("Value must not contain whitespace or control characters");

        return true;
    },
    isValidProxyLink: function (value) {
        const val = value ? value.trim() : "";

        const allowedPrefixes = [
            "vless://",
            "trojan://",
            "trojan-go://",
            "hy2://",
            "hysteria2://",
            "ss://",
            "socks5://",
            "socks://",
            "mierus://",
            "sudoku://"
        ];

        if (!val || val === "") return _("Proxy link cannot be empty!");

        if (val.length > 8192) return _("Proxy link is too long");

        if (this.hasControlChars(val)) return _("Proxy link contains control characters!");

        const prefix = allowedPrefixes.find(p => val.toLowerCase().startsWith(p));
        if (!prefix) return _("Input is not supported or incorrect!");

        if (/\s/.test(val)) return _("Proxy link contains not encoded whitespace!");

        try {
            new URL(val);

            return true;

        } catch {
            return _("Proxy link can't be parsed!");
        }
    },
    isValidDomainSuffix: function (value) {
        if (!value || String(value).trim() === "") return true;

        value = String(value).trim().toLowerCase();

        if (/\s/.test(value) || this.hasControlChars(value))
            return _("Domain must not contain spaces or control characters");

        if (!value.includes("."))
            return _("Domain must contain at least one dot");

        if (/^[.-]/.test(value) || /[.-]$/.test(value))
            return _("Suffix must not start or end with a dot or hyphen");

        if (/\.\./.test(value))
            return _("Double dots are not allowed");

        const parts = value.split(".");

        if (parts.some(part => part.length === 0))
            return _("There must be no empty segments between dots");

        if (parts.some(part => part.length > 63))
            return _("Each domain segment must not exceed 63 characters");

        if (parts.some(part => !/^[a-z0-9-]+$/.test(part)))
            return _("Domain segments may contain only letters, digits, and hyphens");

        if (parts.some(part => part.startsWith("-") || part.endsWith("-")))
            return _("Domain segments must not start or end with a hyphen");

        if (value.length > 253)
            return _("Suffix length must not exceed 253 characters");

        return true;
    },
    isValidDomainMatcher: function (value) {
        let val = String(value || "").trim();

        if (!val)
            return true;

        if (val === "*")
            return true;

        if (val.startsWith("+.") || val.startsWith("*."))
            val = val.slice(2);

        return this.isValidDomainSuffix(val);
    },
    validateNameserverPolicy: function (value) {
        const val = String(value || "").trim();

        if (!val)
            return true;

        const separatorIndex = val.indexOf("/");
        if (separatorIndex <= 0 || separatorIndex === val.length - 1)
            return _("Invalid policy format. Use domain/nameserver.");

        const matcher = val.slice(0, separatorIndex).trim();
        const nameserver = val.slice(separatorIndex + 1).trim();
        const matcherValidation = this.isValidDomainMatcher(matcher);

        if (matcherValidation !== true)
            return matcherValidation;

        return this.validateDnsServer(nameserver);
    },
    validateProxyJsonObject: function (value) {
        let parsed;

        if (!value || String(value).trim() === "")
            return _("JSON object cannot be empty");

        try {
            parsed = JSON.parse(value);
        } catch {
            return _("Invalid JSON format");
        }

        if (Object.prototype.toString.call(parsed) !== "[object Object]" || Array.isArray(parsed))
            return _("JSON must be an object");

        if (parsed.name)
            return _("Name field must not be defined in object.");

        if (parsed.type === "direct" && (parsed.server || parsed.port))
            return _("DIRECT proxy type must be defined without server or port fields.");

        if (parsed["routing-mark"] !== undefined) {
            const markValidation = this.validateRoutingMark(parsed["routing-mark"]);
            if (markValidation !== true)
                return markValidation;
        }

        if (parsed.type === "direct")
            return true;

        if (!parsed.type || !parsed.server || parsed.port === undefined || parsed.port === null)
            return _("JSON must contain at least type, server and port fields.");

        if (typeof parsed.type !== "string" || !/^[a-z0-9-]+$/.test(parsed.type))
            return _("Proxy type contains unsupported characters");

        if (typeof parsed.server !== "string" || !parsed.server.trim() || /\s/.test(parsed.server) || this.hasControlChars(parsed.server))
            return _("Server must be a non-empty host without whitespace");

        return this.validateIntegerRange(String(parsed.port), 1, 65535);
    },
    validateProxyTypeFilter: function (value) {
        const val = String(value || "").trim();

        if (!val) return true;

        if (!/^[a-z0-9|]+$/.test(val))
            return _("Only lowercase letters, digits, and the '|' separator are allowed. No spaces or special symbols.");

        if (val.startsWith("|") || val.endsWith("|") || val.includes("||"))
            return _("Empty proxy types are not allowed");

        const allowedTypes = ["vmess", "vless", "ss", "ssr", "trojan", "hysteria2", "snell", "http", "socks5", "mieru"];
        const types = val.split("|");

        for (let i = 0; i < types.length; i++) {
            if (!allowedTypes.includes(types[i]))
                return _("Unsupported type: ") + types[i];
        }

        return true;
    },
    validateExitRule: function (value) {
        const val = String(value || "").trim();

        if (!val)
            return _("This field cannot be empty");

        if (this.endRuleOptions.some(item => item.value === val))
            return true;

        return this.isValidSimpleName(val)
            ? true
            : _("Use a proxy/group name or supported action");
    },
    validateListUpdateInterval: function (value) {
        if (!value || String(value).trim() === "")
            return true;

        return this.validateIntegerRange(value, this.minimalRuleSetUpdateInterval, 31536000);
    },
    isValidKeywordOrRegexList: function (value, ctxLabel) {
        if (!value || value.trim() === "") return true;

        const parts = value.split("|");
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            if (!part) continue;

            try {
                new RegExp(part);
            } catch {
                return _("Invalid expression in ") + ctxLabel + ": " + part;
            }
        }

        return true;
    },
    // Keep menu-only titles translatable for luci-app-justclash.json.
    stub_nodes_tab: _("Nodes"),
    stub_connections_tab: _("Connections"),
    stub_routing_tab: _("Routing"),
    stub_proxy_tab: _("Proxy")
});
