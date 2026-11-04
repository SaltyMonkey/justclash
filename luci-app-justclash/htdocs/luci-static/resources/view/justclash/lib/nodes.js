"use strict";
"require baseclass";

const GROUP_TYPES_WITH_RESET = new Set(["urltest", "url-test", "fallback"]);
const NON_TESTABLE_PROXY_TYPES = new Set(["reject", "rejectdrop", "pass", "compatible"]);

const lower = (value) => String(value || "").toLowerCase();
const isAutoGroup = (type) => GROUP_TYPES_WITH_RESET.has(lower(type));
const canSelectGroup = (type) => ["selector", "select"].includes(lower(type)) || isAutoGroup(type);

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
    const proxyProviderMap = Object.create(null);
    const proxyTestUrlMap = Object.create(null);
    const proxyGroupTestUrlMap = Object.create(null);

    if (rawProvidersResponse && typeof rawProvidersResponse.providers === "object") {
        for (const [providerName, provider] of Object.entries(rawProvidersResponse.providers)) {
            if (provider && Array.isArray(provider.proxies)) {
                for (const proxy of provider.proxies) {
                    if (proxy?.name && lower(provider.vehicleType || provider.type) !== "compatible" &&
                        (!rawProxies[proxy.name]?.["provider-name"] || rawProxies[proxy.name]["provider-name"] === providerName)) {
                        const testUrl = provider.testUrl || "";
                        proxyTestUrlMap[proxy.name] = proxy.name in proxyTestUrlMap && proxyTestUrlMap[proxy.name] !== testUrl
                            ? "" : testUrl;
                    }

                    if (proxy && proxy.name && !proxies[proxy.name]) {
                        proxies[proxy.name] = proxy;
                        proxyProviderMap[proxy.name] = providerName;
                    }
                }
            }
        }
    }

    const groups = [];

    for (const [name, item] of Object.entries(proxies)) {
        if (!item || !Array.isArray(item.all) || item.all.length === 0)
            continue;

        const options = unique(item.all);
        const current = item.now || item.current || "";
        if (current && !options.includes(current))
            options.unshift(current);

        groups.push({
            name,
            type: item.type || "",
            testUrl: item.testUrl || "",
            current,
            options
        });

        if (name !== "GLOBAL" && item.testUrl) {
            for (const option of options)
                proxyGroupTestUrlMap[option] = unique([...(proxyGroupTestUrlMap[option] || []), item.testUrl]);
        }
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

    return { proxyMap: proxies, proxyProviderMap, proxyTestUrlMap, proxyGroupTestUrlMap, groups };
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
            testUrl: provider.testUrl || "",
            updatedAt: provider.updatedAt || "",
            subscriptionUserinfo: provider.subscriptionUserinfo || provider.subscriptionInfo || null,
            proxies: provider.proxies.filter((proxy) => lower(proxy?.type) !== "compatible")
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
};

const getAutomaticDelay = (proxy, testUrl) => {
    // The last check of some other URL is not suddenly this URL's check. Tempting, though.
    const history = testUrl ? proxy?.extra?.[testUrl]?.history : null;
    const last = Array.isArray(history) && history.length ? history[history.length - 1] : null;
    if (typeof last?.delay !== "number" || !Number.isFinite(last.delay) || last.delay < 0)
        return null;

    return last.delay === 0 || proxy.extra[testUrl].alive === false ? "timeout" : last.delay;
};

const getNodeAutomaticDelay = (nodesState, name, testUrl = "") => {
    const visited = new Set();
    const chain = [];
    let proxy = nodesState.proxyMap[name];

    while (proxy) {
        if (visited.has(name))
            return null;
        visited.add(name);
        chain.push({ name, proxy });
        const current = proxy.now || proxy.current;
        if (!Array.isArray(proxy.all) || !current)
            break;
        name = current;
        proxy = nodesState.proxyMap[name];
    }

    const testUrls = testUrl ? [testUrl] : unique(chain.flatMap((entry) => [
        entry.proxy.testUrl,
        nodesState.proxyTestUrlMap[entry.name],
        ...(nodesState.proxyGroupTestUrlMap[entry.name] || [])
    ]));
    let latest = null;

    // A selector can own a check result too; following `now` must not erase that little detail.
    for (const entry of chain) {
        for (const url of testUrls) {
            const delay = getAutomaticDelay(entry.proxy, url);
            if (delay === null)
                continue;
            const history = entry.proxy.extra[url].history;
            const time = Date.parse(history[history.length - 1].time) || 0;
            if (!latest || time > latest.time)
                latest = { delay, time };
        }
    }

    return latest ? latest.delay : null;
};

const canTestProxy = (proxy) => {
    if (!proxy || (Array.isArray(proxy.all) && proxy.all.length > 0))
        return false;

    return !NON_TESTABLE_PROXY_TYPES.has(lower(proxy.type));
};

return baseclass.extend({
    lower,
    isAutoGroup,
    canSelectGroup,
    normalizeNodesState,
    normalizeProvidersState,
    getAutomaticDelay,
    getNodeAutomaticDelay,
    canTestProxy
});
