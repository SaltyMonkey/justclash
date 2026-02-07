"require baseclass";

return baseclass.extend({
    justclashLuciVersion: "__COMPILED_VERSION_VARIABLE__",
    justclashOnlineVersionUrl: "__ONLINE_VERSION_CHECK_URL__",
    binName: "justclash",
    initdPath: "/etc/init.d/justclash",
    binPath: "/usr/bin/justclash",
    blockRulesetsFilePath: "/etc/justclash/block.rulesets.txt",
    rulesetsFilePath: "/etc/justclash/rulesets.txt",
    logsCount: "400",
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
        { value: "60", text: _("Every 60 seconds") },
    ],
    defaultNtpTimeoutCheckValuesSec: [
        { value: "60", text: _("Every minute") },
        { value: "300", text: _("Every 5 minutes") },
        { value: "600", text: _("Every 10 minutes") },
        { value: "1200", text: _("Every 20 minutes") },
        { value: "3600", text: _("Every hour") }
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
    defaultRuleSetUpdateInterval: [
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
        { value: "200", text: _("Server code 200") },
        { value: "204", text: _("Server code 204") },
    ],
    defaultHealthCheckTimeoutMs: [
        { value: "1000", text: _("1 second") },
        { value: "2000", text: _("2 seconds") },
        { value: "3000", text: _("3 seconds") },
        { value: "5000", text: _("5 seconds") },
        { value: "10000", text: _("10 seconds") },
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
        { value: "load-balancer", text: _("Load balancer") },
        { value: "url-test", text: _("URL Test") }
    ],
    defaultProxyGroupsBalanceModeStrategies: [
        { value: "consistent-hashing", text: _("Consistent hashing") },
        { value: "round-robin", text: _("Round robin") }
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
    defaultUserAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.2.6172.169 Safari/537.36",
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
    defaultTimeoutForWSReconnect: 10000,
    minimalRuleSetUpdateInterval: 21600,
    endRuleOptions: [
        { value: "DIRECT", text: _("Direct") },
        { value: "BY RULES", text: _("By rules") },
        { value: "REJECT", text: _("Reject") }
    ],
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
        } catch {
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
            "trojan-go://",
            "hy2://",
            "hysteria2://",
            "ss://",
            "socks5://",
            "socks4://",
            "socks://",
            "https://",
            "mierus://",
            "sudoku://"
        ];

        if (!val || val === "") return _("Proxy link cannot be empty!");

        const prefix = allowedPrefixes.find(p => val.startsWith(p));
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
                new RegExp(part);
            } catch {
                return _("Invalid expression in ") + ctxLabel + ": " + part;
            }
        }

        return true;
    },
    adjectives: [
        'agile','ancient','arcane','astral','atomic','bold','brave','bright','calm','clean',
        'clever','cold','cool','cosmic','crisp','dark','deep','digital','distant','dry',
        'eager','early','electric','epic','even','fast','fine','firm','fresh','friendly',
        'frozen','gentle','grand','green','happy','hard','hidden','hot','humble','icy',
        'inner','iron','kind','large','light','lively','local','lucky','lunar','magic',
        'major','mellow','mighty','modern','muted','native','neat','new','nimble','noble',
        'noisy','northern','odd','open','quiet','quick','rare','rapid','raw','ready',
        'red','remote','rich','rocky','royal','rugged','safe','sharp','silent','silver',
        'simple','smooth','solid','solar','soft','stable','steady','stellar','strong','subtle',
        'sunny','swift','tame','tiny','tough','true','vivid','warm','wild','wise','young'
    ],
    nouns:  [
        'aardvark','albatross','alligator','alpaca','anchovy','anemone','angelfish','anole','ant','anteater',
        'antelope','ape','armadillo','auk','axolotl','baboon','badger','bandicoot','barnacle','barracuda',
        'bat','beagle','bear','beaver','bee','beetle','beluga','bison','boar','bobcat',
        'bonobo','budgie','buffalo','bull','bulldog','bumblebee','butterfly','buzzard','camel','canary',
        'capybara','caracal','caribou','carp','cassowary','cat','catfish','caterpillar','centipede','chameleon',
        'cheetah','chicken','chihuahua','chimpanzee','chinchilla','chipmunk','cicada','clam','clownfish','cobra',
        'cockatoo','cockroach','cod','condor','coral','cougar','cow','coyote','crab','crane',
        'crayfish','cricket','crocodile','crow','cuckoo','cuttlefish','dachshund','deer','dingo','dodo',
        'dog','dolphin','donkey','dormouse','dove','dragonfly','duck','eagle','earthworm','echidna',
        'eel','egret','elephant','elk','emu','falcon','ferret','finch','firefly','fish',
        'flamingo','flea','fly','fox','frog','gazelle','gecko','gerbil','gibbon','giraffe',
        'goat','goldfish','goose','gopher','gorilla','grasshopper','greyhound','grouse','guineapig','gull',
        'haddock','halibut','hamster','hare','harrier','hawk','hedgehog','heron','herring','hippo',
        'honeybee','hornet','horse','hound','hummingbird','hyena','ibex','ibis','iguana','impala',
        'jackal','jaguar','jellyfish','kangaroo','kingfisher','kiwi','koala','koi','komodo','kookaburra',
        'krill','ladybird','lamprey','lemur','leopard','lion','lizard','llama','lobster','locust',
        'lynx','macaw','mackerel','magpie','manatee','mandrill','manta','marmot','meerkat','minnow',
        'mole','mongoose','monkey','moose','mosquito','moth','mouse','mule','narwhal','newt',
        'nightingale','nudibranch','octopus','okapi','opossum','orangutan','orca','ostrich','otter','owl',
        'oyster','panda','pangolin','panther','parakeet','parrot','peacock','pelican','penguin','perch',
        'pheasant','pig','pigeon','piranha','platypus','pony','porcupine','porpoise','possum','prawn',
        'pufferfish','pug','puma','python','quail','quokka','rabbit','raccoon','ram','rat',
        'rattlesnake','raven','ray','reindeer','rhino','robin','roach','rooster','salamander','salmon',
        'sandpiper','sardine','scallop','scorpion','seahorse','seal','sealion','shark','sheep','shrew',
        'shrimp','skunk','sloth','slug','snail','snake','sparrow','spider','squid','squirrel',
        'starfish','stingray','stork','swan','tadpole','tapir','tarantula','tern','termite','tiger',
        'toad','toucan','trout','tuna','turkey','turtle','urchin','viper','vulture','walrus',
        'wasp','weasel','whale','wolf','wolverine','wombat','woodpecker','worm','yak','zebra'
    ],
    _pickFromArrRandomly: function (arr){
        return arr[Math.floor(Math.random() * arr.length)];
    },
    generateRandomName: function (arrAdj, arrNoun) {
        return `${this._pickFromArrRandomly(arrAdj)}_${this._pickFromArrRandomly(arrNoun)}_${Math.random().toString(16).substr(2, 8)}`;
    },
    //for autogeneration, titles luci-app-justclash.json
    stub_status_tab: _("Status"),
    stub_logs_tab: _("Logs"),
    stub_connections_tab: _("Connections"),
    stub_routing_tab: _("Routing"),
    stub_service_tab: _("Service"),
    stub_proxy_tab: _("Proxy")
});