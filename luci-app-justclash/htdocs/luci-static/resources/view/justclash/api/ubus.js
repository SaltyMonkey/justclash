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
    object: "justclash-core",
    method: "status",
    params: []
});

const declareAction = (method, params = []) => rpc.declare({
    object: "justclash-core",
    method,
    params,
    timeout: 300000
});

const callStart = declareAction("start");
const callStop = declareAction("stop");
const callRestart = declareAction("restart");
const callEnable = declareAction("enable");
const callDisable = declareAction("disable");
const callCheck = declareAction("check");
const callHardwareId = declareAction("hardware_id");
const callConfigShow = declareAction("config_show", ["target"]);
const callConfigShowUnsafe = declareAction("config_show_unsafe", ["target"]);
const callServiceLogs = declareAction("logs", ["lines"]);
const callResourcesUpdate = declareAction("resources_update", ["target"]);

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

    async check() {
        return assertSuccess(await callCheck());
    },

    async getHardwareId() {
        return assertSuccess(await callHardwareId());
    },

    async getMihomoConfig() {
        return assertSuccess(await callConfigShow("mihomo"));
    },

    async getMihomoConfigUnsafe() {
        return assertSuccess(await callConfigShowUnsafe("mihomo"));
    },

    async getServiceConfig() {
        return assertSuccess(await callConfigShow("service"));
    },

    async getServiceConfigUnsafe() {
        return assertSuccess(await callConfigShowUnsafe("service"));
    },

    async getServiceLogs(lines) {
        return assertSuccess(await callServiceLogs(lines));
    },

    async updateCore() {
        return assertSuccess(await callResourcesUpdate("core"));
    },

    async updateData() {
        return assertSuccess(await callResourcesUpdate("data"));
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
