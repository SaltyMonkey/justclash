"use strict";
"require baseclass";
"require rpc";

const callSessionAccess = rpc.declare({
    object: "session",
    method: "access",
    params: ["scope", "object", "function"],
    expect: { access: false }
});

return baseclass.extend({
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
