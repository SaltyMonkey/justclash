"use strict";
"require baseclass";

const GROUP_TYPES_WITH_RESET = new Set(["urltest", "fallback", "loadbalance", "load-balance"]);
const NON_TESTABLE_PROXY_TYPES = new Set(["reject", "rejectdrop", "pass", "compatible"]);

const lower = (value) => String(value || "").toLowerCase();
const isAutoGroup = (type) => GROUP_TYPES_WITH_RESET.has(lower(type));

const unique = (items) => {
    const seen = new Set();

    return (items || []).filter((item) => {
        if (!item || seen.has(item))
            return false;

        seen.add(item);
        return true;
    });
};

const normalizeNodesState = (response, rawProvidersResponse) => {
    const rawProxies = response && typeof response.proxies === "object" ? response.proxies : {};
    const proxies = Object.assign({}, rawProxies);

    if (rawProvidersResponse && typeof rawProvidersResponse.providers === "object") {
        for (const provider of Object.values(rawProvidersResponse.providers)) {
            if (provider && Array.isArray(provider.proxies)) {
                for (const proxy of provider.proxies) {
                    if (proxy && proxy.name && !proxies[proxy.name])
                        proxies[proxy.name] = proxy;
                }
            }
        }
    }

    const groups = [];

    for (const [name, item] of Object.entries(proxies)) {
        if (!item || !Array.isArray(item.all) || item.all.length === 0)
            continue;

        const options = unique(item.all);
        const current = item.now || item.current || options[0] || "";
        if (current && !options.includes(current))
            options.unshift(current);

        groups.push({
            name,
            type: item.type || "",
            current,
            options
        });
    }

    const globalGroup = groups.find((group) => group.name === "GLOBAL");
    const globalOrder = new Map((globalGroup?.options || []).map((name, index) => [name, index]));

    groups.sort((a, b) => {
        if (a.name === "GLOBAL") return -1;
        if (b.name === "GLOBAL") return 1;

        const aOrder = globalOrder.has(a.name) ? globalOrder.get(a.name) : Number.MAX_SAFE_INTEGER;
        const bOrder = globalOrder.has(b.name) ? globalOrder.get(b.name) : Number.MAX_SAFE_INTEGER;

        if (aOrder !== bOrder)
            return aOrder - bOrder;

        return a.name.localeCompare(b.name);
    });

    return { proxyMap: proxies, groups };
};

const normalizeProvidersState = (response) => {
    const providers = response && typeof response.providers === "object" ? response.providers : {};

    return Object.values(providers)
        .filter((provider) => provider &&
            provider.name &&
            lower(provider.vehicleType || provider.type) !== "compatible" &&
            Array.isArray(provider.proxies))
        .map((provider) => ({
            name: provider.name,
            vehicleType: provider.vehicleType || provider.type || "",
            updatedAt: provider.updatedAt || "",
            subscriptionUserinfo: provider.subscriptionUserinfo || provider.subscriptionInfo || null,
            proxies: provider.proxies.filter((proxy) => lower(proxy?.type) !== "compatible")
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
};

const canTestProxy = (proxy) => {
    if (!proxy || (Array.isArray(proxy.all) && proxy.all.length > 0))
        return false;

    return !NON_TESTABLE_PROXY_TYPES.has(lower(proxy.type));
};

return baseclass.extend({
    lower,
    isAutoGroup,
    normalizeNodesState,
    normalizeProvidersState,
    canTestProxy
});
