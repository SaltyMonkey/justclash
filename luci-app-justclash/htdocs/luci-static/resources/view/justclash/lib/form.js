"use strict";
"require baseclass";

return baseclass.extend({
    boolean: {
        TRUE: "1",
        FALSE: "0"
    },
    datatypes: {
        PORT: "port",
        UINTEGER: "uinteger",
        IPADDR: "ipaddr",
        CIDR: "or(cidr4,cidr6)",
        CIDR4: "cidr4",
        IP4ADDR_OR_CIDR4: "or(ip4addr,cidr4)",
        MACADDR: "macaddr",
        IP4ADDR: "ip4addr"
    }
});
