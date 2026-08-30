"use strict";
"require baseclass";
"require rpc";

const callSystemBoard = rpc.declare({
    object: "system",
    method: "board",
    params: [],
    expect: { "": {} }
});

const callSessionAccess = rpc.declare({
    object: "session",
    method: "access",
    params: ["scope", "object", "function"],
    expect: { access: false }
});

const callStatus = rpc.declare({
    object: "justclash",
    method: "status",
    params: []
});

const declareAction = (method, params = []) => rpc.declare({
    object: "justclash",
    method,
    params,
    timeout: 300000
});

const callStart = declareAction("start");
const callStop = declareAction("stop");
const callRestart = declareAction("restart");
const callEnable = declareAction("enable");
const callDisable = declareAction("disable");
const callDiagRedacted = declareAction("diag_redacted");
const callDiagMihomoConfig = declareAction("diag_mihomo_config");
const callDiagMihomoConfigUnsafe = declareAction("diag_mihomo_config_unsafe");
const callDiagServiceConfig = declareAction("diag_service_config");
const callDiagServiceConfigUnsafe = declareAction("diag_service_config_unsafe");
const callServiceLogs = declareAction("logs", ["lines"]);
const callUpdateCore = declareAction("update_core");
const callUpdateRulesets = declareAction("update_rulesets");

const assertSuccess = (result) => {
    if (!result || result.code !== 0)
        throw new Error(result && result.stdout ? result.stdout : _("JustClash RPC call failed."));

    return result;
};

return baseclass.extend({
    async getStatus() {
        return assertSuccess(await callStatus());
    },

    async start() {
        return assertSuccess(await callStart());
    },

    async stop() {
        return assertSuccess(await callStop());
    },

    async restart() {
        return assertSuccess(await callRestart());
    },

    async enable() {
        return assertSuccess(await callEnable());
    },

    async disable() {
        return assertSuccess(await callDisable());
    },

    async diagRedacted() {
        return assertSuccess(await callDiagRedacted());
    },

    async getMihomoConfig() {
        return assertSuccess(await callDiagMihomoConfig());
    },

    async getMihomoConfigUnsafe() {
        return assertSuccess(await callDiagMihomoConfigUnsafe());
    },

    async getServiceConfig() {
        return assertSuccess(await callDiagServiceConfig());
    },

    async getServiceConfigUnsafe() {
        return assertSuccess(await callDiagServiceConfigUnsafe());
    },

    async getServiceLogs(lines) {
        return assertSuccess(await callServiceLogs(lines));
    },

    async updateCore() {
        return assertSuccess(await callUpdateCore());
    },

    async updateRulesets() {
        return assertSuccess(await callUpdateRulesets());
    },

    async getSystemBoard() {
        return callSystemBoard();
    },

    async canAccess(scope, object, func) {
        try {
            return !!(await callSessionAccess(scope, object, func));
        } catch (e) {
            console.debug(`[LuCI session] access check failed for ${scope}/${object}/${func}`, e);
            return false;
        }
    },

    async isSessionAlive() {
        const alive = await this.canAccess("uci", "luci", "read");
        console.debug(`[LuCI session] ${alive ? "alive" : "expired"}`);
        return alive;
    }
});
