"require baseclass";

return baseclass.extend({
    binName: "justclash",
    initdPath: "/etc/init.d/justclash",
    binPath: "/usr/bin/justclash",
    binInfoPath: "/usr/bin/justclash_info",
    genNameProxyPrefix: "proxy",
    genNameProxyProviderPrefix: "provider",
    logsCount: "200",
    genNameProxyGroupPrefix: "proxygroup",
    defaultLoggingLevels: ["info", "warning", "error", "silent", "debug"],
    defaultProxyGroupCheckUrl: "https://www.gstatic.com/generate_204",
    defaultProxyProvidersCheckUrl: "https://www.gstatic.com/generate_204",
    defaultProxyGroupIntervalSec: 360,
    defaultProxyGroupsTypes: ["fallback", "load-balancer"],
    defaultProxyGroupsBalanceModeStrategies: ["consistent-hashing", "round-robin"],
    defaultProxyProviderIntervalSec: 3600,
    defaultProxyProviderHealthCheckSec: 360,
    defaultHealthCheckTimeoutMs: 5000,
    defaultFingerprints: ["chrome", "firefox", "safari", "random", "edge"],
    defaultUpdateOptions: ["no", "check", "chekandupdate"],
    defaultProxyUpdateChannelOptions: ["alpha", "stable"],
    defaultTimeoutForWSReconnect: 10000,
    defaultRuleSetUpdateInterval: 86500,
    minimalRuleSetUpdateInterval: 21600,
    defaultRuleSetProxy: "DIRECT",
    generateRandomName: function (prefix) {
        return `${prefix}${Math.random().toString(16).substr(2, 8)}`;
    },
    parseSSLink: function (link) {
        if (!link.startsWith("ss://")) throw new Error("Not a ss link");
        const onlyUrl = decodeURIComponent(link.slice(5));

        let leftPartStr, rightPartStr;

        if (onlyUrl.includes("@")) {
            [leftPartStr, rightPartStr] = onlyUrl.split("@");
        } else {
            throw new Error("Invalid ss link format, missing '@'");
        }

        let method = "", password = "";
        try {
            const decoded = atob(leftPartStr);
            [method, password] = decoded.split(":");
        } catch {
            [method, password] = leftPartStr.split(":");
        }

        if (!method || !password) throw new Error("Invalid method/password");

        let server = "", port = "";
        let paramsStr = "", name = "ss_node";

        if (rightPartStr.includes("#")) {
            [rightPartStr, name] = rightPartStr.split("#");
            name = decodeURIComponent(name);
        }
        if (rightPartStr.includes("?")) {
            [rightPartStr, paramsStr] = rightPartStr.split("?");
        }

        if (rightPartStr.includes(":")) {
            [server, port] = rightPartStr.split(":");
            port = port.split(/[?#]/)[0];
        } else {
            throw new Error("Invalid server/port");
        }

        return {
            name,
            type: "ss",
            server,
            port: Number(port),
            cipher: method,
            password,
            udp: true
        };
    },
    parseVlessLink: function (url) {
        if (!url.startsWith("vless://")) throw new Error("Not a vless link");

        try {
            const [_, rest] = url.split("vless://");
            const [mainPart, fragment = "vless-node"] = rest.split("#");
            const [credentialsAndHost, queryString = ""] = mainPart.split("?");

            const [uuid, hostPart] = credentialsAndHost.split("@");
            const [server, port = "443"] = hostPart.split(":");

            const params = Object.fromEntries(new URLSearchParams(queryString));

            const config = {
                name: decodeURIComponent(fragment) || "noname",
                type: "vless",
                server,
                port: parseInt(port, 10),
                uuid,
                udp: true,
                encryption: "none",
            };

            const security = params.security || "";
            const netType = params.type || "tcp";
            config.network = netType;

            if (security === "tls" || security === "reality") {
                config.tls = true;
                config.servername = params.sni || params.host || server;
                if (params.fp) config["client-fingerprint"] = params.fp;
                if (params.alpn) config.alpn = params.alpn.split(",");

                if (security === "reality") {
                    const r = {};
                    if (params.pbk) r["public-key"] = params.pbk;
                    if (params.sid) r["short-id"] = params.sid;
                    if (params.spx) r["spider-x"] = decodeURIComponent(params.spx);
                    config["reality-opts"] = r;
                }
            }

            if (params.flow && netType === "tcp") {
                config.flow = params.flow;
            }

            if (netType === "ws") {
                const ws = {};
                if (params.path) ws.path = decodeURIComponent(params.path);
                else ws.path = "/";
                if (params.host) ws.headers = { Host: params.host };
                config["ws-opts"] = ws;
            } else if (netType === "grpc") {
                const grpc = {};
                if (params.serviceName) grpc["service-name"] = params.serviceName;
                config["grpc-opts"] = grpc;
            }

            return config;

        } catch (err) {
            throw new Error("Parse error");
        }
    },
    parseVmessLink: function (url) {
        if (!url.startsWith("vmess://")) throw new Error("Not a vmess link");

        const payload = url.slice(8);

        //
        try {
            if (/^[0-9a-fA-F\-]+@.+?:\d+/.test(payload)) throw new Error("Not base64");

            const json = atob(payload);
            const vmess = JSON.parse(json);

            return buildVmessConfigFromJson(vmess);
        } catch (e) {
            try {
                // mainPart?query#fragment
                const [mainPart, fragment = "vmess-node"] = payload.split("#");
                const [credentialsAndHost, queryString = ""] = mainPart.split("?");
                const [uuid, hostPart] = credentialsAndHost.split("@");
                const [server, port = "443"] = hostPart.split(":");
                const params = Object.fromEntries(new URLSearchParams(queryString));

                const config = {
                    name: decodeURIComponent(fragment) || "vmess-node",
                    type: "vmess",
                    server,
                    port: parseInt(port, 10),
                    uuid,
                    alterId: params.alterId ? parseInt(params.alterId, 10) : 0,
                    cipher: params.cipher || "auto",
                    udp: true,
                    network: params.type || "tcp",
                };

                // TLS and etc
                if (params.security === "tls" || params.tls === "tls" || params.security === "xtls") {
                    config.tls = true;
                    config.servername = params.sni || params.host || server;
                    if (params.fp) config["client-fingerprint"] = params.fp;
                    if (params.alpn) config.alpn = params.alpn.split(",");
                }

                // additional
                if (params["packet-encoding"]) config["packet-encoding"] = params["packet-encoding"];
                if (params["global-padding"]) config["global-padding"] = params["global-padding"] === "true";
                if (params["authenticated-length"]) config["authenticated-length"] = params["authenticated-length"] === "true";

                // WebSocket
                if (config.network === "ws") {
                    const ws = {};
                    ws.path = params.path ? decodeURIComponent(params.path) : "/";
                    if (params.host) ws.headers = { Host: params.host };
                    config["ws-opts"] = ws;
                }
                // HTTP/2
                else if (config.network === "http") {
                    const http = {};
                    http.path = [params.path ? decodeURIComponent(params.path) : "/"];
                    if (params.host) http.headers = { Host: [params.host] };
                    config["http-opts"] = http;
                }
                // gRPC
                else if (config.network === "grpc") {
                    const grpc = {};
                    if (params.serviceName) grpc["service-name"] = params.serviceName;
                    config["grpc-opts"] = grpc;
                }

                return config;
            } catch (err2) {
                throw new Error("Invalid vmess link: neither base64-JSON nor vless-style");
            }
        }
    },
    buildVmessConfigFromJson: function (vmess) {
        const config = {
            name: vmess.ps || "vmess-node",
            type: "vmess",
            server: vmess.add,
            port: parseInt(vmess.port, 10),
            uuid: vmess.id,
            alterId: vmess.aid !== undefined ? parseInt(vmess.aid, 10) : 0,
            cipher: vmess.scy || "auto",
            udp: true,
            network: vmess.net || "tcp",
        };

        // TLS и дополнительные параметры
        if (vmess.tls === "tls" || vmess.tls === "xtls") {
            config.tls = true;
            config.servername = vmess.sni || vmess.host || vmess.add;
            if (vmess.alpn) config.alpn = vmess.alpn.split(",");
            if (vmess.fp) config["client-fingerprint"] = vmess.fp;
        }

        if (vmess["packet-encoding"]) config["packet-encoding"] = vmess["packet-encoding"];
        if (vmess["global-padding"]) config["global-padding"] = vmess["global-padding"] === true;
        if (vmess["authenticated-length"]) config["authenticated-length"] = vmess["authenticated-length"] === true;

        // WebSocket
        if (config.network === "ws") {
            const ws = { path: vmess.path || "/" };
            if (vmess.host) ws.headers = { Host: vmess.host };
            config["ws-opts"] = ws;
        }
        // HTTP/2
        else if (config.network === "http") {
            const http = { path: [vmess.path || "/"], method: "GET" };
            if (vmess.host) http.headers = { Host: [vmess.host] };
            config["http-opts"] = http;
        }
        // gRPC
        else if (config.network === "grpc") {
            const grpc = { "service-name": vmess.path || "" };
            config["grpc-opts"] = grpc;
        }

        return config;
    },
    parseProxyLink: function (link) {
        if (link && typeof link === "string") {
            if (link.startsWith("vless://")) return this.parseVlessLink(link);
            else if (link.startsWith("vmess://")) return this.parseVlessLink(link);
            else if (link.startsWith("ss://")) return this.parseSSLink(link);
            else if (link.startsWith("socks5://")) return this.parseSocks5Link(link);
            else if (link.startsWith("ssh://")) return this.parseSSHLink(link);
            else if (link.startsWith("mierus://")) return this.parseMierusLink(link);
        }
        throw Error("Link is not supported");
    },

    parseSocks5Link: function (url) {
        if (!url.startsWith("socks5://")) {
            throw new Error("Invalid socks5:// link");
        }

        try {
            const parsed = new URL(url);

            // Validate hostname
            if (!parsed.hostname) {
                throw new Error("Missing hostname in SOCKS5 URL");
            }

            // Validate port
            const port = parseInt(parsed.port) || 1080;
            if (port < 1 || port > 65535) {
                throw new Error("Invalid port number: " + port);
            }

            const result = {
                type: "socks5",
                name: `socks5_${parsed.hostname}_${port}`,
                server: parsed.hostname,
                port: port
            };

            // Add authentication if provided
            if (parsed.username) {
                result.username = decodeURIComponent(parsed.username);
            }

            if (parsed.password) {
                result.password = decodeURIComponent(parsed.password);
            }

            return result;

        } catch (error) {
            throw new Error("Failed to parse SOCKS5 string: " + error.message);
        }
    },
    parseTrojanLink: function (url) {
        if (!url.startsWith("trojan://")) {
            throw new Error("Not a trojan link");
        }

        try {
            const parsed = new URL(url);
            const server = parsed.hostname;
            const port = parseInt(parsed.port) || 443;
            const password = decodeURIComponent(parsed.username);
            const params = new URLSearchParams(parsed.search);
            const name = decodeURIComponent(parsed.hash.slice(1)) || "trojan-node";

            const sni = params.get('sni') || params.get('peer') || server;
            const skipCertVerify = params.get('allowInsecure') === '1' || params.get('insecure') === '1';
            const network = params.get('type') || 'tcp';
            const fingerprint = params.get('fp') || params.get('client-fingerprint');
            const alpn = params.get('alpn');
            const wsPath = params.get('path');
            const wsHost = params.get('host');
            const grpcServiceName = params.get('serviceName');

            // Формируем объект конфигурации
            const config = {
                name,
                type: "trojan",
                server,
                port,
                password,
                sni,
                'skip-cert-verify': skipCertVerify,
                udp: true,
            };

            if (network === 'ws') {
                config.network = 'ws';
                config['ws-opts'] = {
                    path: wsPath ? decodeURIComponent(wsPath) : '/',
                };
                if (wsHost) {
                    config['ws-opts'].headers = { Host: decodeURIComponent(wsHost) };
                }
            } else if (network === 'grpc') {
                config.network = 'grpc';
                config['grpc-opts'] = {
                    'grpc-service-name': grpcServiceName || '',
                };
            } else {
                config.network = 'tcp';
            }

            if (fingerprint) config['client-fingerprint'] = fingerprint;
            if (alpn) config.alpn = alpn.split(',');

            const ssEnabled = params.get('ss');
            if (ssEnabled) {
                const ssMethod = params.get('ss-method');
                const ssPassword = params.get('ss-password');
                if (ssMethod && ssPassword) {
                    config['ss-opts'] = {
                        enabled: true,
                        method: ssMethod,
                        password: ssPassword,
                    };
                }
            }

            return config;

        } catch (err) {
            throw new Error("Failed to parse trojan link: " + err.message);
        }
    },
    parseSSHLink: function (link) {
        if (!link.startsWith("ssh://")) throw new Error("Invalid ssh:// link");

        const url = new URL(link.replace("ssh://", "http://"));

        const username = decodeURIComponent(url.username || "");
        const password = decodeURIComponent(url.password || "");
        const server = url.hostname;
        const port = parseInt(url.port, 10);

        const params = new URLSearchParams(url.search);

        const privateKey = params.get("private-key");
        const privateKeyPass = params.get("private-key-passphrase");
        const hostKeyRaw = params.get("host-key"); // Can be comma-separated or repeated
        const hostKeyAlgorithmsRaw = params.get("host-key-algorithms");

        const node = {
            name: server,
            type: "ssh",
            server,
            port: isNaN(port) ? 22 : port,
            username
        };

        if (password) node.password = password;
        if (privateKey) node["private-key"] = privateKey;
        if (privateKeyPass) node["private-key-passphrase"] = privateKeyPass;

        if (hostKeyRaw) {
            node["host-key"] = hostKeyRaw.split(",").map(s => s.trim()).filter(Boolean);
        }

        if (hostKeyAlgorithmsRaw) {
            node["host-key-algorithms"] = hostKeyAlgorithmsRaw.split(",").map(s => s.trim()).filter(Boolean);
        }

        return node;
    },
    parseMierusLink: function (link) {
        if (!link.startsWith("mierus://")) throw new Error("Not a mieru link");

        const url = new URL(link.replace("mierus://", "http://"));

        const username = decodeURIComponent(url.username);
        const password = decodeURIComponent(url.password);
        const server = url.hostname;

        const params = new URLSearchParams(url.search);

        const profile = params.get("profile");
        if (!profile)
            throw "Missing required 'profile' parameter";

        const multiplexing = params.get("multiplexing") || null;

        const ports = params.getAll("port");
        const protocols = params.getAll("protocol");

        if (ports.length !== protocols.length)
            throw "port and protocol must appear the same number of times";

        const nodes = [];

        for (let i = 0; i < ports.length; i++) {
            const portStr = ports[i];
            const protocol = protocols[i].toUpperCase();

            if (protocol !== "TCP")
                throw `Unsupported protocol "${protocol}" for Mihomo. Only TCP allowed`;

            const node = {
                name: profile,
                type: "mieru",
                server: server,
                udp: true,
                transport: "TCP",
                username: username,
                password: password
            };

            if (portStr.includes("-")) {
                node["port-range"] = portStr;
            } else {
                node.port = parseInt(portStr);
            }

            if (multiplexing)
                node.multiplexing = multiplexing;

            nodes.push(node);
        }

        return nodes;
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
    isValidTelegramBotToken: function (value) {
        const val = value.trim();
        if (val.length === 0) return true;
        const pattern = /^\d{6,}:[A-Za-z0-9_-]+$/;
        return pattern.test(val);
    },
    compareArraysWithReturnedResult: function (arr1, arr2) {
        return arr1.filter(value => arr2.includes(value));
    },
    isValidSimpleName: function (value) {
        const val = value.trim();
        const pattern = /^[a-z0-9_]+$/;
        return pattern.test(val);
    },
    isValidProxyLink: function (value) {
        const val = value.trim();
        const allowedPrefixes = [
            "vless://",
            "vmess://",
            "trojan://",
            "ss://",
            "socks5://",
            "ssh://",
            "mieru://"
        ];

        for (const prefix of allowedPrefixes) {
            if (val.startsWith(prefix)) {
                return true; // OK
            }
        }

        return false;
    },
    isValidDomainSuffix: function (value) {
        if (!value || value.trim().length === 0)
            return true;

        value = value.trim();

        if (/\s/.test(value))
            return _("Domain must not contain spaces");

        if (!value.includes('.'))
            return _("Domain must contain at least one dot");

        if (/^[.-]/.test(value) || /[.-]$/.test(value))
            return _("Suffix must not start or end with a dot or hyphen");

        if (/\.\.|--/.test(value))
            return _("Double dots or double hyphens are not allowed");

        if (value.split('.').some(part => part.length === 0))
            return _("There must be no empty segments between dots");

        if (value.split('.').some(part => part.length > 63))
            return _("Each domain segment must not exceed 63 characters");
        if (value.length > 253)
            return _("Suffix length must not exceed 253 characters");

        return true;
    },
    isValidDomainKeyword: function (value) {
        if (!value || value.trim().length === 0)
            return true;

        value = value.trim();

        if (/\s/.test(value))
            return _("Keyword must not contain spaces");

        if (/,/.test(value))
            return _("Only one keyword per field is allowed");

        if (value.length < 2)
            return _("Keyword should be at least 2 characters long");

        return true;
    },
    isValidDomainRegexp: function (value) {
        // Allow empty value
        if (!value || value.trim().length === 0)
            return true;

        value = value.trim();

        // No spaces at start/end
        if (/^\s|\s$/.test(value))
            return _("Regexp must not start or end with a space");

        // Try to compile regexp
        try {
            new RegExp(value);
        } catch (e) {
            return _("Invalid regular expression: ") + (e.message || e);
        }

        return true;
    },
    isValidKeywordOrRegexList: function (value, ctxLabel) {
        if (!value) return true;

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
    }

});