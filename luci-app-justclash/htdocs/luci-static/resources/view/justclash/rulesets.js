"require baseclass";

return baseclass.extend({
    availableBlockRulesets: [
        {
            name: "OISD NSFW small",
            yamlName: "oisd-nsfw-small",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/ads/oisd-nsfw-small.rms"
        },
        {
            name: "OISD NSFW",
            yamlName: "oisd-nsfw",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/ads/oisd-nsfw.rms"
        },
        {
            name: "OISD ADS small",
            yamlName: "oisd-ads-small",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/ads/oisd-small.rms"
        },
         {
            name: "OISD ADS big",
            yamlName: "oisd-ads-big",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/ads/oisd-big.rms"
        },
        {
            name: "Hagezi ADS Pro mini",
            yamlName: "hagezi-ads-pro-mini",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/ads/hagezi-pro-mini-ads.rms"
        },
        {
            name: "Hagezi ADS Pro",
            yamlName: "hagezi-ads-pro",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/ads/hagezi-pro-ads.rms"
        },
        {
            name: "Hagezi Badware Apple",
            yamlName: "hagezi-sw-apple",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/badware/hagezi-sw-apple.rms"
        },
        {
            name: "Hagezi Badware Huawei",
            yamlName: "hagezi-sw-huawei",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/badware/hagezi-sw-huawei.rms"
        }
    ],
    availableRuleSets: [
        {
            name: "ChatGPT",
            yamlName: "chatgpt",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/chatgpt.rms"
        },
        {
            name: "Just Domains",
            yamlName: "justdomains",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/bypass/just-domains.rms"
        },
        {
            name: "ITDog Russia inside",
            yamlName: "russia-inside",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/bypass/itdog-russia-inside.rms"
        },
        {
            name: "Antifilter Community",
            yamlName: "antifilter",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/bypass/antifilter-community.rms"
        },
        {
            name: "No Russia hosts (deprecated)",
            yamlName: "no-russia-hosts",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/bypass/no-russia-hosts.rms"
        },
        {
            name: "Copilot",
            yamlName: "copilot",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/copilot.rms"
        },
        {
            name: "Discord",
            yamlName: "discord",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/discord.rms"
        },
        {
            name: "Grok",
            yamlName: "grok",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/grok.com.rms"
        },
        {
            name: "HDRezka",
            yamlName: "hdrezka",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/hdrezka.rms"
        },
        {
            name: "Hetzner",
            yamlName: "hetzner",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/hetzner.rms"
        },
        {
            name: "Instagram",
            yamlName: "instagram",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/instagram.rms"
        },
        {
            name: "Kinozal",
            yamlName: "kinozal",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/kinozal.rms"
        },
        {
            name: "LinkedIn",
            yamlName: "linkedin",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/linkedin.rms"
        },
        {
            name: "LostFilm",
            yamlName: "lostfilm",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/lostfilm.rms"
        },
        {
            name: "Medium",
            yamlName: "medium",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/medium.rms"
        },
        {
            name: "Meta",
            yamlName: "meta",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/meta.rms"
        },
        {
            name: "Netflix",
            yamlName: "netflix",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/netflix.rms"
        },
        {
            name: "Linux domains",
            yamlName: "nix",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/nix.rms"
        },
        {
            name: "NNMClub",
            yamlName: "nnmclub",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/nnmclub.rms"
        },
        {
            name: "NNMClub",
            yamlName: "nnmclub",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/nnmclub.rms"
        },
        {
            name: "OVH",
            yamlName: "ovh",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/ovh.rms"
        },
        {
            name: "RuTracker",
            yamlName: "rutracker",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/rutracker.rms"
        },
        {
            name: "Spotify",
            yamlName: "spotify",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/spotify.rms"
        },
        {
            name: "Telegram",
            yamlName: "telegram",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/telegram.rms"
        },
        {
            name: "x-com",
            yamlName: "xcom",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/x-com.rms"
        },
        {
            name: "Youtube",
            yamlName: "youtube",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "domain",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/services/youtube.rms"
        },
        {
            name: "Cloudflare CIDR",
            yamlName: "cloudflare-cidr",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "cidr",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/subnets/ipv4/cloudflare.rms"
        },
        {
            name: "Discord CIDR",
            yamlName: "discord-cidr",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "cidr",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/subnets/ipv4/discord.rms"
        },
        {
            name: "Telegram CIDR",
            yamlName: "telegram-cidr",
            type: "http",
            interval: 86500,
            format: "mrs",
            behavior: "cidr",
            proxy: "DIRECT",
            url: "https://github.com/SaltyMonkey/mrs-parsed-data/raw/refs/heads/main/subnets/ipv4/telegram.rms"
        }
    ]
});