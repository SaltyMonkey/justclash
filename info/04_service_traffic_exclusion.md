# Traffic Exclusions

Traffic exclusions keep selected connections out of Mihomo. Use them for devices, router services, or high-volume ports that must always use native routing.

An exclusion is a firewall decision, not a Mihomo `DIRECT` rule. Excluded traffic never reaches the core, never appears in its connection list, and cannot be changed by later Mihomo rules.

## When Exclusions Help

| Situation | Recommended action |
| --- | --- |
| A high-volume client must always go direct | Exclude its MAC address or stable client address. |
| A router daemon must avoid interception | Exclude its socket owner, port, or mark its sockets. |
| Only one application port should bypass | Add a client or router port exclusion. |
| Traffic should remain visible to Mihomo but exit directly | Use a `DIRECT` outbound rule instead of a firewall exclusion. |

Exclusions matter most in full routing mode. In partial mode, unmatched traffic already stays in the kernel fast path.

## Traffic Bypassed by Design

JustClash bypasses traffic to private and local destinations so LAN-to-LAN access and router administration do not enter the proxy. Manual exclusions are intended mainly for WAN-bound traffic.

## Router-Originated Traffic

Router traffic is controlled by **Set router traffic rules at startup**.

### Socket Mark

Mihomo marks its outbound sockets so they bypass interception and do not loop back into the core. A compatible router service can use the same socket-mark approach when it supports `SO_MARK` or an equivalent option.

Custom marks on individual outbounds or providers can also be used by external policy-routing systems. Do not reuse marks without checking the other routing rules on the router.

### Socket Owner

Use `nft_skuid_exclude_router` for a daemon that runs under a dedicated user:

```sh
uci add_list justclash.settings.nft_skuid_exclude_router='<SERVICE_USER>'
uci commit justclash
service justclash restart
```

This applies only to locally generated traffic. Forwarded LAN packets do not have a local socket owner.

### Router Ports

Use `nft_ports_exclude_router` to bypass matching source or destination ports for router-originated TCP and UDP traffic:

```sh
uci add_list justclash.settings.nft_ports_exclude_router='<PORT_OR_RANGE>'
uci commit justclash
service justclash restart
```

Port exclusions are broad. Prefer a dedicated socket owner when multiple services share the same port number.

## LAN Client Traffic

Client exclusions apply to traffic entering through interfaces listed in `tproxy_input_interfaces`.

### By MAC Address

```sh
uci add_list justclash.settings.nft_mac_exclude='<CLIENT_MAC>'
```

MAC matching is useful on a local Ethernet or Wi-Fi segment. It does not identify clients across routed hops.

### By Address or Subnet

```sh
uci add_list justclash.settings.nft_ips_exclude='<CLIENT_ADDRESS_OR_SUBNET>'
```

Use a DHCP reservation before excluding a single address. Otherwise the exclusion may move to a different device after a lease change.

### By Port

```sh
uci add_list justclash.settings.nft_ports_exclude='<PORT_OR_RANGE>'
```

This matches source or destination ports for forwarded TCP and UDP traffic. It affects every intercepted client unless another condition narrows the traffic before it reaches the JustClash rule.

Commit and restart after manual changes:

```sh
uci commit justclash
service justclash restart
```

## Fake-IP and Bypassed Clients

A bypassed client can still send DNS requests to the router. If Mihomo answers with a Fake-IP address, the client then tries to reach that non-public address directly because its traffic is excluded. The connection fails.

Choose one of these designs:

1. **Intercept the client.** Keep it on the normal JustClash DNS and traffic path.
2. **Bypass the client completely.** Give it a DNS path that returns real addresses.
3. **Exclude only specific domains from Fake-IP.** Use this only when those domains are also meant to go direct, especially in partial mode.

### Real-IP Filters

The following proxy-section lists make Mihomo return real addresses for selected matches:

- `fake_ip_exclude_domains`
- `fake_ip_exclude_rulesets`
- `fake_ip_exclude_geosites`

Example:

```sh
uci add_list justclash.proxy.fake_ip_exclude_domains='<DOMAIN_SUFFIX>'
uci commit justclash
service justclash restart
```

> [!WARNING]
> In partial routing mode, a real address may bypass interception. Do not add a proxied domain to a Fake-IP exclusion unless an active IP-CIDR list still intercepts its addresses.

### Separate DNS for a Bypassed Network

For a fully bypassed guest or client network, distribute an appropriate real-address resolver through that network's DHCP settings. If a local encrypted resolver is used, run it under a dedicated user and exclude that user from router interception.

Do not globally replace the dnsmasq upstream used by JustClash just to accommodate one bypassed client. That changes DNS behavior for every network and usually breaks Fake-IP interception in a much more communal way.

See [Guest Network Configuration](08_use_guest_network.md) for complete network-level examples.

## Verification

After applying exclusions:

1. Confirm the service starts without nftables errors.
2. Run:

   ```sh
   justclash.sh diag_nft
   justclash.sh diag_route
   ```

3. Check **Connections** in LuCI:
   - excluded traffic should not appear;
   - traffic routed through `DIRECT` inside Mihomo should appear.
4. Test both domain-based and raw-address connections.
5. Test IPv6 separately when enabled.
