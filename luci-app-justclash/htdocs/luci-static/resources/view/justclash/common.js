"require baseclass";

return baseclass.extend({
    binName: "justclash",
    initdPath: "/etc/init.d/justclash",
    binPath: "/usr/bin/justclash",
    genNameProxyPrefix: "proxy_",
    genNameProxyGroupPrefix: "proxygroup_",
    defaultLoggingLevels: ["info", "warning", "error", "silent", "debug"],
    defaultProxyGroupCheckUrl: "https://www.gstatic.com/generate_204",
    defaultProxyGroupInterval: 300,
    defaultProxyGroupsTypes: ["fallback", "load-balancer"],
    defaultProxyGroupsBalanceModeStrategies: ["consistent-hashing", "round-robin"],
    defaultFingerprints: ["chrome", "firefox", "safari", "random", "edge"],
    defaultUpdateOptions: ["no", "check", "chekandupdate"],
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
            if (decoded.includes(":")) {
                [method, password] = decoded.split(":");
            } else {

                [method, password] = leftPartStr.split(":");
            }
        } catch {

            [method, password] = leftPartStr.split(":");
        }

        if (!method || !password) throw new Error("Invalid method/password");

        let server = "", port = "";

        if (rightPartStr.includes(":")) {
            [server, port] = rightPartStr.split(":");
            port = port.split(/[?#]/)[0];
        } else {
            throw new Error("Invalid server/port");
        }

        return {
            name: "ss_node",
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
    /*   parseDirectLink: function (link) {
           if (!link.startsWith("direct://")) throw new Error("Not a interface link");

           const [_, rest] = url.split("direct://");
           if(!rest || rest && rest.length === 0) throw "Incorrect direct link"

           const config = {
               name: `${rest}-direct`,
               type: "direct",
               "interface-name": `${rest}`
           };

           return config;
       },*/
    parseSocks5Link: function (socks5String) {
        if (!socks5String || typeof socks5String !== 'string' || !socks5String.startsWith("socks5://")) {
            throw new Error('Invalid SOCKS5 string provided');
        }

        const trimmed = socks5String.trim();
        let url = trimmed;

        try {
            const parsed = new URL(url);

            // Validate hostname
            if (!parsed.hostname) {
                throw new Error('Missing hostname in SOCKS5 URL');
            }

            // Validate port
            const port = parseInt(parsed.port) || 1080;
            if (port < 1 || port > 65535) {
                throw new Error('Invalid port number: ' + port);
            }

            const result = {
                type: 'socks5',
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
            throw new Error('Failed to parse SOCKS5 string: ' + error.message);
        }
    },
    parseSSHLink: function (link) {
        if (!link.startsWith("ssh://")) throw "Invalid ssh:// link";

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
    parseProxyLink: function (proxyLink) {

    },
    objToYaml: function (obj, indent = 0) {
        const pad = "  ".repeat(indent);
        let yaml = "";

        if (Array.isArray(obj)) {
            obj.forEach(item => {
                if (typeof item === "object" && item !== null) {
                    yaml += `${pad}-\n`;
                    yaml += this.objToYaml(item, indent + 1);
                } else {
                    yaml += `${pad}- ${item}\n`;
                }
            });
            return yaml;
        }

        for (const key in obj) {
            const val = obj[key];
            if (val === null || val === undefined) continue;

            if (typeof val === "object" && !Array.isArray(val)) {
                yaml += `${pad}${key}:\n`;
                yaml += this.objToYaml(val, indent + 1);
            } else if (Array.isArray(val)) {
                yaml += `${pad}${key}:\n`;
                val.forEach(item => {
                    if (typeof item === "object") {
                        yaml += `${pad}  -\n` + this.objToYaml(item, indent + 3);
                    } else {
                        yaml += `${pad}  - ${item}\n`;
                    }
                });
            } else if (typeof val === "string") {
                if (/[:#\-\?\[\]\{\},&\*!\|>'"%@`]/.test(val) || val.includes("\n")) {
                    yaml += `${pad}${key}: "${val.replace(/"/g, '\\"')}"\n`;
                } else {
                    yaml += `${pad}${key}: ${val}\n`;
                }
            } else {
                yaml += `${pad}${key}: ${val}\n`;
            }
        }

        return yaml;
    },
    splitAndTrimString: function (value, delimiter = ',') {

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
        if (typeof value === 'string') {
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
        if (val.startsWith("system://") ||
            val.startsWith("https://") ||
            val.startsWith("tls://") ||
            val.startsWith("udp://")) {
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
        // Проверяем формат токена
        const pattern = /^\d{6,}:[A-Za-z0-9_-]+$/;
        return pattern.test(val)
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
    }

});