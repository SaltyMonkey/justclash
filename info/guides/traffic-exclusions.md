# Traffic Exclusions

[Documentation](../README.md)

A firewall exclusion keeps traffic outside Mihomo. Excluded connections do not appear in the dashboard and cannot be changed by later Mihomo rules. Use a `DIRECT` routing rule instead when traffic should remain visible to the core.

## Scope Matrix

| Setting | Traffic scope | Match | Address family |
| --- | --- | --- | --- |
| `nft_skuid_exclude_router` | Router-originated | Socket owner/UID | IPv4 and IPv6 |
| `nft_ports_exclude_router` | Router-originated TCP/UDP | Source or destination port | IPv4 and IPv6 |
| `nft_ports_exclude` | Forwarded client TCP/UDP | Source or destination port | IPv4 and IPv6 |
| `nft_mac_exclude` | Forwarded local-segment clients | Source MAC | Layer 2, covering either IP family |
| `nft_ips_exclude` | Forwarded clients | Source IPv4 address/CIDR | IPv4 only |

Client exclusions are evaluated for traffic entering devices selected in `tproxy_input_interfaces`.

## Exclusion or `DIRECT`?

| Requirement | Use |
| --- | --- |
| Keep the connection visible and apply Mihomo policy | `DIRECT` outbound rule |
| Keep traffic entirely in the kernel path | Firewall exclusion |
| Prevent a router daemon from looping through Mihomo | Socket owner or routing mark |
| Bypass one high-volume application port | Narrow port exclusion |

Exclusions matter most in Full Interception. In Partial Interception, unmatched traffic already remains direct.

## Router-Originated Traffic

Router traffic and client traffic are enabled together through **Create nftables**. Router-specific exclusions below remain independent of client exclusions.

### Socket Owner

```sh
uci add_list justclash.settings.nft_skuid_exclude_router='<SERVICE_USER_OR_UID>'
uci commit justclash
service justclash restart
```

Use a dedicated service account where possible. Forwarded LAN traffic has no local socket owner and cannot match this rule.

### Router Ports

```sh
uci add_list justclash.settings.nft_ports_exclude_router='<PORT_OR_RANGE>'
uci commit justclash
service justclash restart
```

Port exclusions match both source and destination TCP/UDP ports. They are broad; prefer a socket owner when several services use the same number.

### Routing Marks

Mihomo outbound sockets use a dedicated mark to prevent interception loops. External PBR systems can use per-outbound `routing_mark`, but marks must be coordinated with existing policy-routing rules.

## Forwarded Client Traffic

### By MAC Address

```sh
uci add_list justclash.settings.nft_mac_exclude='<CLIENT_MAC>'
```

MAC matching works only on a directly visible Ethernet or Wi-Fi segment. It does not identify a client behind another router.

### By IPv4 Address or Subnet

```sh
uci add_list justclash.settings.nft_ips_exclude='<CLIENT_IPV4_OR_CIDR>'
```

`nft_ips_exclude` currently generates an IPv4 source rule. It does not create an equivalent IPv6-address exclusion. Use a MAC exclusion on a local segment or define an explicit IPv6 design instead of assuming the IPv4 entry applies twice.

Reserve a stable DHCP address before using a single-address exclusion.

### By Port

```sh
uci add_list justclash.settings.nft_ports_exclude='<PORT_OR_RANGE>'
```

This applies to every selected client interface. JustClash does not combine the port with a client address in the same setting.

Commit manual client changes:

```sh
uci commit justclash
service justclash restart
```

## Fake-IP and Bypassed Clients

A bypassed client can still query the router. If Mihomo returns a Fake-IP result, the client attempts to reach that synthetic address directly and the connection fails.

For a complete client bypass, provide DNS that returns real addresses. For a
domain-only exception, use `fake_ip_exclude_domains`, `fake_ip_exclude_rulesets`,
or `fake_ip_exclude_geosites`.

```sh
uci add_list justclash.proxy.fake_ip_exclude_domains='<DOMAIN_SUFFIX>'
uci commit justclash
service justclash restart
```

In Partial Interception, a Fake-IP exception can also bypass routing policy.
Check the [DNS and traffic path requirements](../concepts/routing.md#dns-and-fake-ip)
before adding an exception for a domain that should use an outbound.

For a complete bypassed network, see [Guest Network Configuration](guest-network.md).

## Verification

```sh
justclash.sh check nft
justclash.sh check routes
```

Then verify:

- excluded traffic does not appear under **Connections**;
- Mihomo `DIRECT` traffic does appear;
- domain and raw-address behavior both match the design;
- IPv4 and IPv6 are tested separately.

The diagnostic commands can expose local addresses and routes. Use `check` when sharing results.

## Remove an Exclusion

```sh
uci del_list justclash.settings.nft_ports_exclude='<PORT_OR_RANGE>'
uci commit justclash
service justclash restart
```

Use the corresponding field name for MAC, address, router-port, or socket-owner exclusions.
