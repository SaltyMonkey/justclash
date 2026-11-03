"use strict";
"require baseclass";
"require view.justclash.api.ubus as ubusApi";
"require view.justclash.api.mihomo as mihomoApi";
"require view.justclash.lib.socket as socketRuntime";

const POLL_INTERVAL = 3000;
const RULES_REFRESH_INTERVAL = 60000;

const fetchConnectionCount = (token) =>
    mihomoApi.fetchConnectionCount(token)
        .then(data => Number.isSafeInteger(data?.count) && data.count >= 0 ? data.count : null)
        .catch(() => null);

const parseSocketPayload = (event) => {
    try {
        return JSON.parse(event.data);
    } catch {
        return null;
    }
};

const createPoller = ({ token, initialRunning = false, initialRuleCount = null, isMounted, onUpdate, onInactive, interval = POLL_INTERVAL }) => {
    let timer = null;
    let updating = false;
    let ruleCount = initialRuleCount;
    let lastRulesRefresh = initialRunning ? Date.now() : null;

    const stop = () => {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
    };

    const refresh = async ({ forceRulesRefresh = false } = {}) => {
        if (forceRulesRefresh)
            lastRulesRefresh = null;

        if (updating)
            return true;

        updating = true;

        try {
            if (!await ubusApi.isSessionAlive()) {
                onInactive();
                return false;
            }

            const status = await ubusApi.getStatus()
                .catch(() => ({ running: false, enabled: false }));
            const isRunning = !!status.running;
            const isAutostarting = !!status.enabled;
            let connectionCount = 0;

            if (!isRunning) {
                ruleCount = 0;
                lastRulesRefresh = null;
            } else {
                // Count only; the full connection list has its own page for a reason.
                const countRequest = fetchConnectionCount(token);
                if (lastRulesRefresh === null || Date.now() - lastRulesRefresh >= RULES_REFRESH_INTERVAL) {
                    lastRulesRefresh = Date.now();
                    ruleCount = await mihomoApi.fetchRules(token)
                        .then(data => Array.isArray(data?.rules) ? data.rules.length : null)
                        .catch(() => null);
                }
                connectionCount = await countRequest;
            }

            requestAnimationFrame(() => {
                if (isMounted())
                    onUpdate({ isRunning, isAutostarting, ruleCount, connectionCount });
            });

            return true;
        } finally {
            updating = false;
        }
    };

    const schedule = () => {
        if (timer !== null || document.hidden || !isMounted())
            return;

        timer = setTimeout(async () => {
            timer = null;

            if (!isMounted()) {
                onInactive();
                return;
            }

            const shouldContinue = await refresh();
            if (shouldContinue)
                schedule();
        }, interval);
    };

    const start = () => {
        stop();
        schedule();
    };

    return { start, stop, refresh, schedule };
};

const createSockets = ({ token, containerCheck, onTraffic, onMemory, onInactive }) =>
    socketRuntime.createConnector({
        isMounted: containerCheck,
        onInactive,
        open: ({ guard }) => {
            const cleanups = [];

            cleanups.push(mihomoApi.createTrafficWebSocket({
                token,
                containerCheck,
                onMessage: guard((event) => {
                    const data = parseSocketPayload(event);
                    if (data)
                        onTraffic(data);
                })
            }));

            cleanups.push(mihomoApi.createMemoryWebSocket({
                token,
                containerCheck,
                onMessage: guard((event) => {
                    const data = parseSocketPayload(event);
                    if (data)
                        onMemory(data);
                })
            }));

            return () => cleanups.forEach(cleanup => cleanup());
        }
    });

return baseclass.extend({
    fetchConnectionCount,
    createPoller,
    createSockets
});
