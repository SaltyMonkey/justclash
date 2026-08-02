# Guest Network Configuration

A guest network requires two coordinated choices:

1. whether guest traffic is intercepted;
2. whether guest DNS returns Fake-IP or real addresses.

Configuring only one side commonly leaves clients with synthetic DNS answers and a direct traffic path.

## Choose a Design

| Design | Guest bridge intercepted | DNS result |
| --- | --- | --- |
| Same policy as main LAN | Yes | Normal JustClash/Fake-IP path |
| Fully direct guest | No | Real addresses |
| Direct guest with dedicated resolver | No | Real addresses from the selected resolver |

Use the OpenWrt device/bridge name in JustClash, not the firewall-zone label.

## Recipe A: Intercepted Guest

Use this when guests should receive the same routing and block policy as the main LAN.

1. Open **Services → JustClash → Setup: Service → Traffic rules**.
2. Add the guest bridge to **Client traffic interfaces**.
3. Keep **Change DNS settings at startup** enabled.
4. Configure guest DHCP to advertise the router as DNS.
5. Save & Apply.

```sh
uci add_list justclash.settings.tproxy_input_interfaces='<GUEST_BRIDGE>'
uci commit justclash
service justclash restart
```

Verify:

- guest DNS uses the router;
- connections appear under **Connections**;
- expected route and block rules match;
- IPv4 and IPv6 follow the intended policy.

## Recipe B: Fully Direct Guest

Use this when guest traffic must never enter Mihomo.

1. Remove the guest bridge from **Client traffic interfaces**.
2. Ensure no separate firewall rule redirects that bridge to the TProxy path.
3. Configure guest DHCP and IPv6 advertisements to provide resolvers returning real addresses.
4. Renew the client lease.

```sh
uci del_list justclash.settings.tproxy_input_interfaces='<GUEST_BRIDGE>'
uci commit justclash
service justclash restart
```

> [!WARNING]
> A direct guest client must not receive Fake-IP answers. Raw-address connectivity may work while every domain connection fails, which is technically connectivity but not the useful kind.

Do not replace the router-wide dnsmasq upstream merely to change one guest network. Configure the guest DHCP scope independently.

## Recipe C: Direct Guest with Dedicated Resolver

Use this when guest traffic remains direct but DNS needs a separate filtering or encrypted upstream.

Recommended design:

1. Run a dedicated local resolver instance on its own port.
2. Disable its automatic global dnsmasq/firewall integration.
3. Run it under a dedicated system user.
4. Exclude that user from router interception.
5. Redirect only guest DNS to the dedicated listener.
6. Keep the guest bridge outside `tproxy_input_interfaces`.

```sh
uci add_list justclash.settings.nft_skuid_exclude_router='<RESOLVER_USER>'
uci commit justclash
service justclash restart
```

Create the guest-only DNS redirect with the standard OpenWrt firewall configuration for the actual guest zone and resolver listener. Do not copy interface names or addresses from another router.

The dedicated resolver is outside JustClash policy:

- JustClash block rules do not protect direct guests;
- resolver availability and privacy depend on that service;
- IPv6 requires an equivalent resolver advertisement and traffic decision.

## Verification

### Intercepted Guest

- bridge is present in `tproxy_input_interfaces`;
- DNS uses the router;
- connections appear in Mihomo;
- expected rules match.

### Direct Guest

- bridge is absent from `tproxy_input_interfaces`;
- DNS returns real addresses;
- connections do not appear in Mihomo;
- IPv4 and IPv6 are both direct.

```sh
justclash.sh diag_nft
justclash.sh diag_route
```

These commands can expose local topology. Use `diag_redacted` when sharing results.

For per-client bypass instead of a whole network, see [Traffic Exclusions](04_service_traffic_exclusion.md).

## Rollback

Return the guest bridge and DHCP resolver settings to their previous values, renew the client lease, restart JustClash, and test both address families.
