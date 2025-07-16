"require baseclass";

const BASE_URL = "https://raw.githubusercontent.com/SaltyMonkey/mrs-parsed-data/refs/heads/main";

function buildRules(items, category, defaultBehavior = "domain") {
    return items.map(([name, yamlName, fileName, behavior]) => ({
        name,
        yamlName,
        behavior: behavior || defaultBehavior,
        url: `${BASE_URL}/${category}/${fileName || yamlName}.rms`,
    }));
}

const availableBlockRulesets = [];

availableBlockRulesets.push(...buildRules([
    ["Google ADS", "google-ads"],
    ["OISD NSFW small", "oisd-nsfw-small"],
    ["OISD ADS small", "oisd-ads-small", "oisd-small"],
    ["Hagezi ADS Pro mini", "hagezi-ads-pro-mini", "hagezi-pro-mini-ads"],
], "ads"));

availableBlockRulesets.push(...buildRules([
    ["Hagezi badware Apple", "hagezi-badware-apple", "hagezi-sw-apple"],
    ["Hagezi badware Huawei", "hagezi-badware-huawei", "hagezi-sw-huawei"],
    ["Hagezi badware LGWebOS", "hagezi-badware-lgwebos", "hagezi-sw-lgwebos"],
    ["Hagezi badware RealmeOppo", "hagezi-badware-realmeoppo", "hagezi-sw-oppo-realme"],
    ["Hagezi badware Samsung", "hagezi-badware-samsung", "hagezi-sw-samsung"],
    ["Hagezi badware Vivo", "hagezi-badware-vivo", "hagezi-sw-vivo"],
    ["Hagezi badware WinOffice", "hagezi-badware-winoffice", "hagezi-sw-winoffice"],
    ["Hagezi badware Xiaomi", "hagezi-badware-xiaomi", "hagezi-sw-xiaomi"],
], "badware"));

const availableRuleSets = [];

availableRuleSets.push(...buildRules([
    ["Just Domains", "justdomains", "just-domains"],
    ["ITDog Russia inside", "russia-inside", "itdog-russia-inside"],
    ["Antifilter Community", "antifilter", "antifilter-community"],
    ["No Russia hosts", "no-russia-hosts"],
], "bypass"));

availableRuleSets.push(...buildRules([
    ["Twitch-fix", "twitch-fix"],
    ["Amazon", "amazon"],
    ["Anydesk", "anydesk"],
    ["Atlassian", "atlassian"],
    ["ChatGPT", "chatgpt"],
    ["ClaudeAI", "claudeai"],
    ["Cloudflare", "cloudflare"],
    ["Copilot", "copilot"],
    ["Deepl", "deepl"],
    ["Discord", "discord"],
    ["Docker", "docker"],
    ["Gemini", "gemini"],
    ["Grok", "grok", "grok.com"],
    ["x-com", "x-com"],
    ["Youtube", "youtube"],
    ["Telegram", "telegram"],
    ["Hetzner", "hdrezka", "hetzner"],
    ["OVH", "ovh"],
    ["Nix", "nix"]
], "services"));

availableRuleSets.push(...buildRules([
    ["AntifilterComm CIDR", "antifilter-cidr", "antifilter-community", "ipcidr"],
    ["Cloudfront CIDR", "cloudfront-cidr", "cloudfront", "ipcidr"],
    ["Cloudflare CIDR", "cloudflare-cidr", "cloudflare", "ipcidr"],
    ["Discord Voice CIDR", "discord-voice-cidr", "discord-voice", "ipcidr"],
    ["Telegram CIDR", "telegram-cidr", "telegram", "ipcidr"]
], "subnets/ipv4"));

return baseclass.extend({
    availableBlockRulesets,
    availableRuleSets
});
