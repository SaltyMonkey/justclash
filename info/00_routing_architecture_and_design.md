# Choosing a Routing Mode

JustClash can intercept all selected traffic or only traffic identified by Fake-IP and active IP-CIDR lists. This choice changes what the final rule can control, how much traffic Mihomo sees, and how much router capacity the service uses.

## Quick Decision

Use **Partial Route** when:

- only selected services or destinations should use a proxy;
- most traffic should remain in the kernel fast path;
- the router has limited CPU or memory;
- direct connections to unmatched IP addresses are acceptable.

Use **Full Route** when:

- every selected connection must be evaluated by Mihomo;
- the default rule must apply to all unmatched traffic;
- raw-IP applications must follow GEOIP or IP rules;
- complete connection visibility matters more than minimum resource use.

## Behavior Comparison

| Behavior | Partial Route | Full Route |
| --- | --- | --- |
| Domain traffic matched through Fake-IP | Intercepted | Intercepted |
| Active IP-CIDR RuleSets | Intercepted through nftables sets | Evaluated by Mihomo |
| Unmatched real-IP traffic | Direct kernel routing | Evaluated by Mihomo |
| Final `MATCH` rule | Applies only to intercepted traffic | Applies to all selected traffic |
| Raw-IP GEOIP matching | Incomplete | Available |
| CPU and memory use | Usually lower | Usually higher |
| Connections visible in the dashboard | Intercepted connections only | All selected connections |

## Partial Route

Partial mode builds nftables sets from enabled IP-CIDR RuleSets and intercepts traffic addressed to those sets or to the configured Fake-IP ranges. Other traffic does not enter Mihomo.

This has two important consequences:

1. A proxy default rule cannot affect traffic that bypassed the firewall interception step.
2. A domain excluded from Fake-IP may resolve to a real address and go direct unless that address is also covered by an active IP-CIDR list.

The background ruleset worker updates nftables sets when Mihomo refreshes text IP-CIDR files. Domain `.mrs` files are used by Mihomo and are not converted into kernel IP sets.

## Full Route

Full mode redirects traffic from the selected client interfaces and, when enabled, router-originated traffic to Mihomo. Routing rules are then evaluated in one place.

This mode is easier to reason about when policies include:

- a proxy default route;
- GEOIP decisions for applications that connect directly to addresses;
- complete blocking and observation of selected clients;
- policy ordering that must be consistent for domain and address traffic.

The cost is additional userspace processing. Use client, port, or router-process exclusions for high-volume traffic that should stay direct.

## DNS and Fake-IP

JustClash can configure dnsmasq to forward client DNS requests to Mihomo. Mihomo returns Fake-IP addresses for domains that need policy handling. The subsequent connection to the Fake-IP range is intercepted and mapped back to the original domain.

Do not give Fake-IP answers to a client whose traffic bypasses interception. Either intercept that client or provide it with a resolver path that returns real addresses. See [Traffic Exclusions](04_service_traffic_exclusion.md).

## TProxy and TUN

JustClash uses nftables and TProxy instead of creating a virtual TUN interface. TProxy preserves the original destination and works directly with OpenWrt policy routing. The service therefore manages three connected parts:

1. nftables interception rules;
2. policy-routing rules and tables;
3. Mihomo listeners and routing policy.

Disabling only one part manually usually produces an impressively confusing half-working network. Change the corresponding JustClash setting instead.

## Router Traffic

Router-originated traffic is controlled separately from forwarded client traffic:

- **Set traffic rules at startup** controls client interception.
- **Set router traffic rules at startup** controls local router traffic.
- socket-owner, port, and routing-mark exclusions prevent loops or bypass selected services.

Mihomo outbound traffic carries a dedicated mark so it is not intercepted again.

## IPv6

When IPv6 support is enabled, JustClash creates the corresponding IPv6 interception and policy-routing rules. Partial mode also maintains IPv6 sets for active text IP-CIDR sources.

When IPv6 support is disabled, IPv6 traffic is bypassed rather than partially intercepted. Verify the behavior on dual-stack clients after changing this setting; an IPv4-only test does not prove the IPv6 policy works.

## Switching Modes Safely

1. Stop high-volume transfers.
2. Change **Routing mode** in **Service -> Traffic rules**.
3. Review the default rule and Fake-IP exclusions.
4. Confirm the selected client interfaces.
5. Save & Apply.
6. Check **Connections**, **Rules**, and **System logs**.
7. Run:

```sh
justclash.sh diag_nft
justclash.sh diag_route
```

If full mode overloads the router, return to partial mode or add narrow traffic exclusions instead of disabling random nftables chains by hand.
