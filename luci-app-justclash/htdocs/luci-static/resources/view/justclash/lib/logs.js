"use strict";
"require baseclass";

const EMPTY_TEXT = _("No log entries");
const LEVEL_RULES = [
    { type: "error", tokens: ["error", "level=error", "daemon.err", "user.err"] },
    { type: "warning", tokens: ["warn", "level=warn", "warning", "daemon.warn"] },
    { type: "info", tokens: ["info", "level=info"] },
    { type: "debug", tokens: ["debug", "level=debug"] }
];
const BADGE_TYPES = new Set(LEVEL_RULES.map(rule => rule.type));

const normalizeType = (value) => {
    const type = typeof value === "string" ? value.trim().toLowerCase() : "";

    if (type === "warn")
        return "warning";

    return BADGE_TYPES.has(type) ? type : "";
};

const classifyText = (text) => {
    const lowerText = String(text || "").toLowerCase();
    const matchedRule = LEVEL_RULES.find(rule =>
        rule.tokens.some(token => lowerText.includes(token))
    );

    return matchedRule ? matchedRule.type : "";
};

const parseJsonValue = (value) => {
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};

const formatRawEntry = (value) => {
    const parsed = parseJsonValue(value);

    if (parsed && typeof parsed === "object" && parsed.payload !== undefined) {
        const type = parsed.type ? `[${String(parsed.type).toUpperCase()}] ` : "";
        return `${type}${parsed.payload}`;
    }

    return value;
};

const createLogRow = (entry) => {
    const type = normalizeType(entry?.type);
    const children = [];

    if (type)
        children.push(E("span", { class: `jc-log-type-badge jc-log-type-badge-${type}` }, type.toUpperCase()));

    children.push(E("span", { class: "jc-log-message" }, entry?.text || ""));

    return E("div", {
        class: `jc-log-line${type ? ` jc-log-line-${type}` : ""}`
    }, children);
};

return baseclass.extend({
    emptyText: EMPTY_TEXT,

    parseSystemText(rawText) {
        return String(rawText || "")
            .split("\n")
            .map(line => line.replace(/\r$/, ""))
            .filter(line => line.trim())
            .map(line => ({
                text: line,
                type: classifyText(line),
                raw: line
            }));
    },

    normalizeRealtimeMessage(rawMessage) {
        const message = typeof rawMessage === "string" ? rawMessage.trim() : "";

        if (!message)
            return null;

        const parsed = parseJsonValue(message);

        if (parsed && typeof parsed === "object" && parsed.payload !== undefined && parsed.payload !== null) {
            const text = typeof parsed.payload === "string"
                ? parsed.payload.trim()
                : JSON.stringify(parsed.payload);

            if (!text)
                return null;

            return {
                text,
                type: normalizeType(parsed.type),
                raw: message
            };
        }

        return {
            text: message,
            type: "",
            raw: message
        };
    },

    appendToBuffer(buffer, entry, limit) {
        buffer.push(entry);

        const maxEntries = Number(limit);
        if (!Number.isFinite(maxEntries) || maxEntries <= 0)
            return;

        const overflow = buffer.length - maxEntries;
        if (overflow > 0)
            buffer.splice(0, overflow);
    },

    renderEntries(container, entries, reversed = false) {
        if (!entries.length) {
            container.replaceChildren(document.createTextNode(EMPTY_TEXT));
            return;
        }

        const fragment = document.createDocumentFragment();
        const visibleEntries = reversed ? [...entries].reverse() : entries;

        visibleEntries.forEach(entry => fragment.appendChild(createLogRow(entry)));
        container.replaceChildren(fragment);
    },

    appendEntries(container, entries, reversed = false, limit = 0) {
        if (!entries.length)
            return;

        const batch = limit > 0 && entries.length > limit ? entries.slice(-limit) : entries;
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < batch.length; i++)
            fragment.appendChild(createLogRow(batch[reversed ? batch.length - i - 1 : i]));

        if (limit > 0 && batch.length === limit) {
            container.replaceChildren(fragment);
            return;
        }

        if (container.childNodes.length === 1 && container.firstChild?.nodeType === Node.TEXT_NODE)
            container.replaceChildren();

        const count = container.childNodes.length;
        const overflow = limit > 0 ? count + batch.length - limit : 0;
        if (overflow > 0) {
            // Drop one contiguous range instead of walking retired rows in JavaScript.
            const range = document.createRange();
            range.setStart(container, reversed ? count - overflow : 0);
            range.setEnd(container, reversed ? count : overflow);
            range.deleteContents();
        }

        if (reversed)
            container.insertBefore(fragment, container.firstChild);
        else
            container.appendChild(fragment);
    },

    formatText(entries) {
        return entries
            .map(entry => formatRawEntry(entry.raw || entry.text))
            .join("\n");
    },

    formatJson(entries) {
        return JSON.stringify(
            entries.map(entry => parseJsonValue(entry.raw || entry.text)),
            null,
            4
        );
    }
});
