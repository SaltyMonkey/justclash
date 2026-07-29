"use strict";
"require baseclass";

const DEFAULT_INTERVAL = 1000;
const INTERVAL_OPTIONS = [250, 500, 1000, 2000, 5000];

const normalizeFilterValue = (value) => String(value || "").trim().toLowerCase();

const joinEndpoint = (address, port) => {
    if (!address)
        return "";

    return port === undefined || port === null || port === ""
        ? String(address)
        : `${address}:${port}`;
};

const formatEndpoints = (conn) => {
    const metadata = conn?.metadata || {};

    return {
        src: joinEndpoint(metadata.sourceIP, metadata.sourcePort),
        dest: metadata.destinationIP
            ? joinEndpoint(metadata.destinationIP, metadata.destinationPort)
            : String(metadata.remoteDestination || "")
    };
};

const normalizeConnection = (conn) => {
    const metadata = conn?.metadata || {};
    const host = normalizeFilterValue(metadata.host);
    const sniffHost = normalizeFilterValue(metadata.sniffHost);
    const sourceIP = normalizeFilterValue(metadata.sourceIP);
    const endpointIP = normalizeFilterValue(metadata.destinationIP || metadata.remoteDestination);

    return {
        hostSniff: [host, sniffHost].filter(Boolean).join(" "),
        sourceEndpointIP: [sourceIP, endpointIP].filter(Boolean).join(" "),
        chains: normalizeFilterValue((conn?.chains || []).join(", ")),
        rule: normalizeFilterValue(conn?.rulePayload || conn?.rule)
    };
};

const matchesFilters = (normalized, filters) =>
    Object.keys(filters).every((key) => !filters[key] || normalized?.[key]?.includes(filters[key]));

const formatIntervalLabel = (interval) => interval >= 1000
    ? `${interval / 1000} s`
    : `${interval} ms`;

return baseclass.extend({
    DEFAULT_INTERVAL,
    INTERVAL_OPTIONS,
    normalizeFilterValue,
    formatEndpoints,
    normalizeConnection,
    matchesFilters,
    formatIntervalLabel
});
