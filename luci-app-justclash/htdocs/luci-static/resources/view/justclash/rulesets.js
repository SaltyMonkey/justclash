"require baseclass";

return baseclass.extend({
    availableBlockRulesets: [
        {
            name: "Google ADS",
            yamlName: "google-ads",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/ads/google-ads.rms"
        },
        {
            name: "OISD NSFW small",
            yamlName: "oisd-nsfw-small",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/ads/oisd-nsfw-small.rms"
        },
        {
            name: "OISD ADS small",
            yamlName: "oisd-ads-small",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/ads/oisd-small.rms"
        },
        {
            name: "Hagezi ADS Pro mini",
            yamlName: "hagezi-ads-pro-mini",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/ads/hagezi-pro-mini-ads.rms"
        },
        {
            name: "Hagezi badware Apple",
            yamlName: "hagezi-badware-apple",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/badware/hagezi-sw-apple.rms"
        },
        {
            name: "Hagezi badware Huawei",
            yamlName: "hagezi-badware-huawei",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/badware/hagezi-sw-huawei.rms"
        },
        {
            name: "Hagezi badware LGWebOS",
            yamlName: "hagezi-badware-lgwebos",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/badware/hagezi-sw-lgwebos.rms"
        },
        {
            name: "Hagezi badware RealmeOppo",
            yamlName: "hagezi-badware-realmeoppo",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/badware/hagezi-sw-oppo-realme.rms"
        }, {
            name: "Hagezi badware Samsung",
            yamlName: "hagezi-badware-samsung",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/badware/hagezi-sw-samsung.rms"
        },
        {
            name: "Hagezi badware Vivo",
            yamlName: "hagezi-badware-vivo",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/badware/hagezi-sw-vivo.rms"
        },
        {
            name: "Hagezi badware WinOffice",
            yamlName: "hagezi-badware-winoffice",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/badware/hagezi-sw-winoffice.rms"
        },
        {
            name: "Hagezi badware Xiaomi",
            yamlName: "hagezi-badware-xiaomi",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/badware/hagezi-sw-xiaomi.rms"
        },
    ],
    availableRuleSets: [
        {
            name: "Just Domains",
            yamlName: "justdomains",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/bypass/just-domains.rms"
        },
        {
            name: "ITDog Russia inside",
            yamlName: "russia-inside",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/bypass/itdog-russia-inside.rms"
        },
        {
            name: "Antifilter Community",
            yamlName: "antifilter",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/bypass/antifilter-community.rms"
        },
        {
            name: "No Russia hosts",
            yamlName: "no-russia-hosts",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/bypass/no-russia-hosts.rms"
        },
        {
            name: "Twitch-fix",
            yamlName: "twitch-fix",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/services/twitch-fix.rms"
        },
        {
            name: "Amazon",
            yamlName: "amazon",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/services/amazon.rms"
        },
        {
            name: "Anydesk",
            yamlName: "anydesk",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/services/anydesk.rms"
        },
        {
            name: "Atlassian",
            yamlName: "atlassian",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/services/atlassian.rms"
        },
        {
            name: "ChatGPT",
            yamlName: "chatgpt",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/services/chatgpt.rms"
        },
        {
            name: "ClaudeAI",
            yamlName: "claudeai",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/services/claudeai.rms"
        },
        {
            name: "Cloudflare",
            yamlName: "cloudflare",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/services/cloudflare.rms"
        },
        {
            name: "Copilot",
            yamlName: "copilot",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/services/copilot.rms"
        },
        {
            name: "Deepl",
            yamlName: "deepl",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/services/deepl.rms"
        },
        {
            name: "Discord",
            yamlName: "discord",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/services/discord.rms"
        },
        {
            name: "Docker",
            yamlName: "docker",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/services/docker.rms"
        },
        {
            name: "Gemini",
            yamlName: "gemini",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/services/gemini.rms"
        },
        {
            name: "Grok",
            yamlName: "grok",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/services/grok.com.rms"
        },
                {
            name: "x-com",
            yamlName: "x-com",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/services/x-com.rms"
        },
        {
            name: "Youtube",
            yamlName: "youtube",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/services/youtube.rms"
        },
        {
            name: "Telegram",
            yamlName: "telegram",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/services/telegram.rms"
        },
        {
            name: "Hetzner",
            yamlName: "hdrezka",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/services/hetzner.rms"
        },
        {
            name: "OVH",
            yamlName: "ovh",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/services/ovh.rms"
        },
        {
            name: "Nix",
            yamlName: "nix",
            behavior: "domain",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/services/nix.rms"
        },
        {
            name: "AntifilterComm CIDR",
            yamlName: "antifilter-cidr",
            behavior: "ipcidr",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/subnets/ipv4/antifilter-community.rms"
        },
        {
            name: "Cloudfront CIDR",
            yamlName: "cloudfront-cidr",
            behavior: "ipcidr",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/subnets/ipv4/cloudfront.rms"
        },
        {
            name: "Cloudflare CIDR",
            yamlName: "cloudflare-cidr",
            behavior: "ipcidr",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/subnets/ipv4/cloudflare.rms"
        },
        {
            name: "Discord Voice CIDR",
            yamlName: "discord-voice-cidr",
            behavior: "ipcidr",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/subnets/ipv4/discord-voice.rms"
        },
        {
            name: "Telegram CIDR",
            yamlName: "telegram-cidr",
            behavior: "ipcidr",
            url: "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main/subnets/ipv4/telegram.rms"
        }

    ]
});