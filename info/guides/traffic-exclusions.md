# Traffic Exclusions

[Documentation](../README.md)

A firewall exclusion keeps traffic outside Mihomo. Excluded connections do not appear in the dashboard and cannot be changed by later Mihomo rules. Use a `DIRECT` routing rule instead when traffic should remain visible to the core.

## Scope Matrix

| Setting | Traffic scope | Match | Address family |
| --- | --- | --- | --- |
| `nft_skuid_exclude_router` | Router-originated | Socket owner/UID | IPv4 and IPv6 |
| `nft_ports_exclude_router` | Router-originated TCP/UDP | Source or destination port | IPv4 and IPv6 |
| `nft_ports_exclude` | Client firewall rules | TCP/UDP source or destination port | IPv4 and IPv6 |
| `nft_mac_exclude` | Forwarded local-segment clients | Source MAC | Layer 2, covering either IP family |
| `nft_ips_exclude` | Forwarded clients | Source address/CIDR | IPv4 and IPv6 |

Client exclusions are evaluated for traffic entering devices selected in `tproxy_input_interfaces`.

## Exclusion or `DIRECT`?

| Requirement | Use |
| --- | --- |
| Keep the connection visible and apply Mihomo policy | `DIRECT` outbound rule |
| Keep traffic entirely in the kernel path | Firewall exclusion |
| Prevent a router daemon from looping through Mihomo | Socket owner or routing mark |
| Bypass one high-volume application port | Narrow port exclusion |

Unmatched connections already use the kernel's normal routing. Exclusions can
bypass traffic that would otherwise match interception rules.

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

### By IP Address or Subnet

```sh
uci add_list justclash.settings.nft_ips_exclude='<CLIENT_IP_OR_CIDR>'
```

For dual-stack clients, add an address or CIDR for each family. IPv6 entries
apply when IPv6 support is enabled in JustClash.

Reserve a stable DHCP address before using a single-address exclusion.

### By Port

```sh
uci add_list justclash.settings.nft_ports_exclude='<PORT_OR_RANGE>'
```

Port exclusions apply in the client firewall chain on every selected client
interface. That chain evaluates **Client DNS traffic → Drop** after port
exclusions. **Hijack** and **Bypassed DNS redirect port** use earlier DNS redirect
rules.

Commit manual client changes:

```sh
uci commit justclash
service justclash restart
```

## Fake-IP and Bypassed Clients

A bypassed client can still query the router. If the router gives it a Fake-IP
answer, the client attempts to reach that synthetic address directly and the
connection fails.

Under **Setup: Service → Traffic rules**, enable **Create nftables** and set
**Bypassed DNS redirect port** to the port of a separate resolver on the router.
This redirect takes precedence over **Client DNS traffic** and covers TCP and
UDP queries on port 53, including queries addressed to the router.

- On **Client traffic interfaces**, the redirect applies to clients bypassed by
  IP or MAC address.
- Under **Additional DNS redirect interfaces**, select other devices or bridges
  to redirect DNS for every client on them. If an interface appears in both
  lists, the IP and MAC exclusions decide which clients use the separate port.

An empty port disables the redirect to the separate resolver. When the port is
empty and matching IP/MAC exclusions or additional DNS interfaces are configured,
**Service logs** shows `DNS redirect port is not configured`. JustClash continues
applying the other firewall rules.

A DNS-only second dnsmasq instance can listen on this port and use its own
upstreams that return real addresses. JustClash manages forwarding on the first
dnsmasq instance. Keep DHCP for the subnet on the main instance, bind the second
resolver to the selected interfaces' router addresses, and permit both TCP and
UDP to its port in the corresponding firewall zones. Configure local DHCP names
separately if clients of the second resolver need them.

Plain DNS over IPv6 also uses TCP and UDP port 53. With IPv6 support enabled in
JustClash, the separate resolver must accept IPv6 queries on the configured port.
Clients can keep receiving their DNS server address from DHCPv6 or Router
Advertisements. With IPv6 support disabled in JustClash, IPv6 queries still go
to the resolver configured on the client.

For a domain-only exception, use `fake_ip_exclude_domains` or
`fake_ip_exclude_geosites`.

```sh
uci add_list justclash.proxy.fake_ip_exclude_domains='<DOMAIN_SUFFIX>'
uci commit justclash
service justclash restart
```

A Fake-IP exception can send a connection outside Mihomo if its real address
and source miss the interception rules. Check the [DNS and traffic path
requirements](../concepts/routing.md#dns-and-fake-ip) for domains that should use
an outbound.

For a complete bypassed network, see [Guest Network Configuration](guest-network.md).

## Verification

```sh
justclash.sh check nft --unsafe
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
