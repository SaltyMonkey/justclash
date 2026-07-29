# Guest Network Configuration

A guest network needs two independent decisions:

1. Should its client traffic be intercepted by JustClash?
2. Which DNS path should guest clients use?

Configuring only one side often produces Fake-IP answers with direct traffic, which is an efficient way to make the network look connected while nothing useful opens.

## Choose a Design

| Design | Client interface intercepted | DNS behavior |
| --- | --- | --- |
| Same policy as the main LAN | Yes | Use the normal router/JustClash DNS path. |
| Fully direct guest network | No | Give guests a resolver path that returns real addresses. |
| Direct network with filtered DNS | No | Give guests a selected filtering resolver. |
| Direct network with a local encrypted resolver | No | Redirect only guest DNS to a dedicated local resolver instance. |

Use the OpenWrt device or bridge name in JustClash, not the firewall-zone label. They are often similar and are not interchangeable.

## Intercept the Guest Network

Use this when guest clients should follow the same proxy, block, and final rules as the main LAN.

LuCI:

1. Open **Services -> JustClash -> Service -> Traffic rules**.
2. Add the guest bridge under **Client traffic interfaces**.
3. Save & Apply.

UCI template:

```sh
uci add_list justclash.settings.tproxy_input_interfaces='<GUEST_BRIDGE>'
uci commit justclash
service justclash restart
```

Keep guest DHCP configured to advertise the router as DNS. JustClash will pass those requests through the normal dnsmasq-to-Mihomo path.

Verify both IPv4 and IPv6. When IPv6 is enabled in the guest network but disabled in JustClash, IPv6 traffic is intentionally bypassed.

## Keep the Guest Network Direct

Use this when guest clients must never enter Mihomo.

1. Remove the guest bridge from `tproxy_input_interfaces`.
2. Ensure no broader firewall rule sends the guest zone into the JustClash TProxy path.
3. Configure guest DHCP and IPv6 router advertisements to provide resolvers that return real addresses.
4. Renew the client lease before testing.

Remove the interface with LuCI, or:

```sh
uci del_list justclash.settings.tproxy_input_interfaces='<GUEST_BRIDGE>'
uci commit justclash
service justclash restart
```

Configure DNS in **Network -> Interfaces -> Guest -> DHCP Server**. The exact DHCP and RDNSS settings depend on whether the guest network uses IPv4, IPv6, or both.

> [!WARNING]
> A direct guest client must not receive Fake-IP answers. If it still queries the global JustClash DNS path, domain connections can fail even though raw-address connectivity works.

## Direct Guest Network with Filtered DNS

This design is the same as the fully direct network, but guest DHCP advertises a resolver that provides the required filtering policy.

The filtering service is independent from JustClash:

- JustClash does not enforce its block rules for excluded guests.
- Availability and privacy depend on the selected resolver.
- IPv6 clients need equivalent IPv6 resolver advertisement or a deliberate IPv6 policy.

Do not globally replace the router resolver just to change guest behavior. Configure the guest DHCP scope separately.

## Local Encrypted Resolver for Guests

Use a dedicated local resolver instance when guests should go direct but their DNS upstream should be encrypted.

Recommended design:

1. Run the resolver on a dedicated local port.
2. Disable its automatic global dnsmasq and firewall modifications.
3. Run it under a dedicated system user.
4. Add that user to `nft_skuid_exclude_router` so its upstream traffic goes direct.
5. Redirect DNS from the guest zone only to the dedicated listener.
6. Keep the guest bridge out of `tproxy_input_interfaces`.

Example user exclusion:

```sh
uci add_list justclash.settings.nft_skuid_exclude_router='<RESOLVER_USER>'
uci commit justclash
service justclash restart
```

Create the guest-only DNS redirect with standard OpenWrt firewall configuration. Use placeholders for the guest zone, listener address, and listener port; do not copy an example that assumes another router's topology.

## Verification Checklist

### Intercepted Guest

- Guest bridge is in **Client traffic interfaces**.
- Guest DNS uses the router.
- Connections appear in the Mihomo **Connections** view.
- The expected proxy or block rule matches.

### Direct Guest

- Guest bridge is absent from the interception list.
- Guest DNS returns real addresses.
- Connections do not appear in Mihomo.
- IPv4 and IPv6 follow the same intended policy.

Useful commands:

```sh
justclash.sh diag_nft
justclash.sh diag_route
justclash.sh logs 100
```

For per-client bypass instead of a complete guest-network design, see [Traffic Exclusions](04_service_traffic_exclusion.md).
