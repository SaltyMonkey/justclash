"require baseclass";

return baseclass.extend({
    binName: "justclash",
    initdPath: "/etc/init.d/justclash",
    binPath: "/usr/bin/justclash",
    defaultLoggingLevels: ["info"],
    defaultProxyGroupCheckUrl: "https://www.gstatic.com/generate_204",
    defaultProxyGroupInterval: 300,
    defaultProxyGroupsTypes: ["fallback", "load-balancer"],
    defaultProxyGroupsBalanceModeStrategies: ["consistent-hashing", "round-robin"],
    defaultFingerprints: ["chrome", "firefox", "safari"],
    defaultUpdateOptions: ["no", "check", "chekandupdate"],
    availableRuleSets: [
    {
        name:"1",
        link: ""
    },
    {
        name:"2",
        link: ""
    },
    {
        name:"3",
        link: ""
    },
    {
        name:"4",
        link: ""
    }
    ],
    availableBlockRulesets: [
    {
        name: "OISD NSFW small",
        link: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/ads/oisd-nsfw-small.rms"
    },
    {
        name: "OISD ADS small",
        link: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/ads/oisd-small.rms"
    },
    {
        name: "Hagezi ADS Pro mini",
        link: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/ads/hagezi-pro-mini-ads.rms"
    }],
    generateRandomName: function (prefix) {
        return `${prefix}-${Math.random().toString(16).substr(2, 8)}`;
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
                name: decodeURIComponent(fragment),
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
    objToYaml: function (obj, indent = 0) {
        const pad = "  ".repeat(indent);
        let yaml = "";

        for (const key in obj) {
            const val = obj[key];
            if (val === null || val === undefined) continue;

            if (typeof val === "object" && !Array.isArray(val)) {
                yaml += `${pad}${key}:\n`;
                yaml += objToYaml(val, indent + 1);
            } else if (Array.isArray(val)) {
                yaml += `${pad}${key}:\n`;
                val.forEach(item => {
                    if (typeof item === "object") {
                        yaml += `${pad}-\n` + objToYaml(item, indent + 2);
                    } else {
                        yaml += `${pad}- ${item}\n`;
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
    }
});