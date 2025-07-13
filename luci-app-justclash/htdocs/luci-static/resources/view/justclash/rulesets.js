"require baseclass";

return baseclass.extend({
    availableBlockRulesets: [
        {
            name: "OISD NSFW small",
            yamlName: "oisd-nsfw-small",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/ads/oisd-nsfw-small.rms"
        },
        {
            name: "OISD NSFW",
            yamlName: "oisd-nsfw",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/ads/oisd-nsfw.rms"
        },
        {
            name: "OISD ADS small",
            yamlName: "oisd-ads-small",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/ads/oisd-small.rms"
        },
        {
            name: "OISD ADS big",
            yamlName: "oisd-ads-big",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/ads/oisd-big.rms"
        },
        {
            name: "Hagezi ADS Pro mini",
            yamlName: "hagezi-ads-pro-mini",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/ads/hagezi-pro-mini-ads.rms"
        },
        {
            name: "Hagezi ADS Pro",
            yamlName: "hagezi-ads-pro",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/ads/hagezi-pro-ads.rms"
        }
    ],
    availableRuleSets: [
        {
            name: "Just Domains",
            yamlName: "justdomains",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/bypass/just-domains.rms"
        },
        {
            name: "ITDog Russia inside",
            yamlName: "russia-inside",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/bypass/itdog-russia-inside.rms"
        },
        {
            name: "Antifilter Community",
            yamlName: "antifilter",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/bypass/antifilter-community.rms"
        },
        {
            name: "No Russia hosts (deprecated)",
            yamlName: "no-russia-hosts",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/bypass/no-russia-hosts.rms"
        },
        {
            name: "Twitch-fix",
            yamlName: "twitch-fix",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/twitch-fix.rms"
        },
        {
            name: "Amazon",
            yamlName: "amazon",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/amazon.rms"
        },
        {
            name: "Atlassian",
            yamlName: "atlassian",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/atlassian.rms"
        },
        {
            name: "Linux domains",
            yamlName: "nix",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/nix.rms"
        },
        {
            name: "ChatGPT",
            yamlName: "chatgpt",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/chatgpt.rms"
        },
        {
            name: "Copilot",
            yamlName: "copilot",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/copilot.rms"
        },
        {
            name: "Grok",
            yamlName: "grok",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/grok.com.rms"
        },
        {
            name: "Discord",
            yamlName: "discord",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/discord.rms"
        },

        {
            name: "HDRezka",
            yamlName: "hdrezka",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/hdrezka.rms"
        },
        {
            name: "Hetzner",
            yamlName: "hetzner",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/hetzner.rms"
        },
        {
            name: "Instagram",
            yamlName: "instagram",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/instagram.rms"
        },
        {
            name: "Kinozal",
            yamlName: "kinozal",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/kinozal.rms"
        },
        {
            name: "LinkedIn",
            yamlName: "linkedin",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/linkedin.rms"
        },
        {
            name: "LostFilm",
            yamlName: "lostfilm",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/lostfilm.rms"
        },
        {
            name: "Medium",
            yamlName: "medium",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/medium.rms"
        },
        {
            name: "Meta",
            yamlName: "meta",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/meta.rms"
        },
        {
            name: "Netflix",
            yamlName: "netflix",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/netflix.rms"
        },
        {
            name: "NNMClub",
            yamlName: "nnmclub",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/nnmclub.rms"
        },
        {
            name: "OVH",
            yamlName: "ovh",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/ovh.rms"
        },
        {
            name: "RuTracker",
            yamlName: "rutracker",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/rutracker.rms"
        },
        {
            name: "Spotify",
            yamlName: "spotify",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/spotify.rms"
        },
        {
            name: "Telegram",
            yamlName: "telegram",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/telegram.rms"
        },
        {
            name: "x-com",
            yamlName: "xcom",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/x-com.rms"
        },
        {
            name: "Youtube",
            yamlName: "youtube",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/youtube.rms"
        },
        {
            name: "Deepl",
            yamlName: "deepl",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/deepl.rms"
        },
        {
            name: "Cloudflare",
            yamlName: "cloudflare",
            behavior: "domain",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/cloudflare.rms"
        },
        {
            name: "Cloudfront CIDR",
            yamlName: "cloudfront-cidr",
            behavior: "ipcidr",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/subnets/ipv4/cloudfront.rms"
        },
        {
            name: "Cloudflare CIDR",
            yamlName: "cloudflare-cidr",
            behavior: "ipcidr",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/subnets/ipv4/cloudflare.rms"
        },
        {
            name: "Discord CIDR",
            yamlName: "discord-cidr",
            behavior: "ipcidr",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/subnets/ipv4/discord.rms"
        },
        {
            name: "Telegram CIDR",
            yamlName: "telegram-cidr",
            behavior: "ipcidr",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/subnets/ipv4/telegram.rms"
        }

    ]
});