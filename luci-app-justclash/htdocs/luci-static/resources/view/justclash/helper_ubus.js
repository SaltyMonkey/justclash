"use strict";
"require baseclass";
"require rpc";
"require view.justclash.helper_common as common";

const callServiceList = rpc.declare({
    object: "service",
    method: "list",
    params: ["name"],
    expect: { "": {} }
});

const callInitList = rpc.declare({
    object: "luci",
    method: "getInitList",
    params: ["name"],
    expect: { "": {} }
});

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

return baseclass.extend({
    async getSystemBoard() {
        return callSystemBoard();
    },

    async isServiceAutoStartEnabled() {
        try {
            const res = await callInitList(common.binName);
            return !!(res && res[common.binName] && res[common.binName].enabled);
        } catch {
            return false;
        }
    },

    async isServiceRunning() {
        try {
            const res = await callServiceList(common.binName);
            const instances = (res && res[common.binName] && res[common.binName].instances) ? res[common.binName].instances : {};
            return Object.values(instances).some(instance => instance.running);
        } catch {
            return false;
        }
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
