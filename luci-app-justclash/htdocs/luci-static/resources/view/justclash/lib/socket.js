"use strict";
"require baseclass";
"require view.justclash.api.ubus as luciSession";

const createConnector = ({ isMounted, open, onInactive }) => {
    let cleanup = null;
    let connecting = false;
    let mountObserver = null;

    const stop = () => {
        if (mountObserver) {
            mountObserver.disconnect();
            mountObserver = null;
        }

        const close = cleanup;
        cleanup = null;

        if (close)
            close();
    };

    const handleInactive = () => {
        stop();
        if (onInactive)
            onInactive();
    };

    const guard = (handler) => (...args) => {
        if (!isMounted()) {
            handleInactive();
            return;
        }

        return handler(...args);
    };

    const connect = async () => {
        if (connecting || document.hidden)
            return false;

        connecting = true;

        try {
            stop();

            if (!await luciSession.isSessionAlive()) {
                handleInactive();
                return false;
            }

            if (document.hidden || !isMounted()) {
                if (!isMounted())
                    handleInactive();
                return false;
            }

            cleanup = open({ guard }) || null;

            // SPA navigation skips beforeunload, because apparently one lifecycle is too easy.
            mountObserver = new MutationObserver(() => {
                if (!isMounted())
                    handleInactive();
            });
            mountObserver.observe(document.body, { childList: true, subtree: true });

            return true;
        } finally {
            connecting = false;
        }
    };

    return { connect, stop };
};

return baseclass.extend({ createConnector });
