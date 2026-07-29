"use strict";
"require baseclass";
"require view.justclash.api.ubus as ubusApi";
"require view.justclash.api.mihomo as mihomoApi";
"require view.justclash.lib.socket as socketRuntime";

const POLL_INTERVAL = 3000;

const parseSocketPayload = (event) => {
    try {
        return JSON.parse(event.data);
    } catch {
        return null;
    }
};

const createPoller = ({ token, isMounted, onUpdate, onInactive, interval = POLL_INTERVAL }) => {
    let timer = null;
    let updating = false;

    const stop = () => {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
    };

    const refresh = async () => {
        if (updating)
            return true;

        updating = true;

        try {
            if (!await ubusApi.isSessionAlive()) {
                onInactive();
                return false;
            }

            const [isRunning, isAutostarting] = await Promise.all([
                ubusApi.isServiceRunning().catch(() => false),
                ubusApi.isServiceAutoStartEnabled().catch(() => false)
            ]);

            let currentMode = "";
            if (isRunning) {
                try {
                    const configs = await mihomoApi.fetchConfigs(token);
                    currentMode = configs.mode || "";
                } catch {
                    // Service state remains useful even when the controller decides not to cooperate.
                }
            }

            requestAnimationFrame(() => {
                if (isMounted())
                    onUpdate({ isRunning, isAutostarting, currentMode });
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

const createSockets = ({ token, containerCheck, onTraffic, onConnections, onMemory, onInactive }) =>
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

            cleanups.push(mihomoApi.createConnectionsWebSocket({
                token,
                interval: 1000,
                containerCheck,
                onMessage: guard((event) => {
                    const data = parseSocketPayload(event);
                    if (data && Array.isArray(data.connections))
                        onConnections(data);
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
    createPoller,
    createSockets
});
