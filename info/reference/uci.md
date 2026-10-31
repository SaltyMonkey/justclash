# UCI Configuration Reference

[Documentation](../README.md)

JustClash stores its configuration in `/etc/config/justclash`. LuCI edits the same UCI package; direct UCI commands are intended for automation, recovery, and advanced setups.

> [!IMPORTANT]
> This reference is not a replacement default configuration. Package upgrades may add defaults or migrate fields. The installed configuration records your saved choices; schema fallbacks and
> LuCI presets may differ. This reference describes behavior rather than providing
> a complete replacement config.

## Safe Workflow

```sh
# Back up before manual edits
cp /etc/config/justclash /etc/config/justclash.backup

# Inspect locally
uci show justclash

# Commit and reload after changes
uci commit justclash
service justclash reload
```

`uci show` can expose endpoints, credentials, domains, client addresses, and routing policy. Use `justclash.sh check` when sharing diagnostics.

### Validation and Missing Values

JustClash validates the loaded UCI configuration during initialization, before
startup applies changes. For options with schema defaults, missing or empty
values are filled in the process's in-memory configuration. This does not
rewrite `/etc/config/justclash`; optional fields without defaults remain unset.

For fields covered by the schema, an invalid nonempty value is reported and
initialization fails. It is not silently replaced by a default. Existing disabled sections are validated too,
so correct or remove an invalid section rather than only disabling it.

## Section Model

| Section type | Cardinality | Purpose |
| --- | --- | --- |
| `main settings` | One named section | Service startup, traffic interception, scheduling, storage, and downloads |
| `proxy proxy` | One named section | Mihomo runtime, controller, DNS, sniffer, mixed port, and Geodata |
| `proxies` | Zero or more named or anonymous sections | Individual outbound definitions |
| `proxy_provider` | Zero or more named or anonymous sections | Remote provider definitions |
| `proxy_group` | Zero or more named or anonymous sections | Selection, failover, latency, and balancing groups |
| `block_rules block_rules` | One named section | Domain/address blocking and blocklist providers |
| `mixed_port_rules mixed_port_rules` | One named section | First rule for explicit mixed-port traffic |
| `final_rules final_rules` | One named section | Final action after all other rules |

LuCI creates dynamic sections with generated UCI IDs. Rules refer to the user-visible `name`, not necessarily to the UCI section ID.

For the relationship and setup sequence, see
[Outbounds, providers, and groups](../guides/routing.md).

The singleton `proxy proxy` section configures the Mihomo runtime. Individual
connections belong in `proxies` or come from `proxy_provider`; they are not
additional singleton `proxy` sections.

## `main settings`

### Startup and Storage

| Field | Type | Purpose |
| --- | --- | --- |
| `wait_for_wan` | Boolean | Wait for an active default route during boot |
| `wait_for_wan_max` | Unsigned integer | Maximum WAN wait in seconds |
| `delayed_boot` | Boolean | Add a fixed startup delay |
| `delayed_boot_value` | Unsigned integer | Delay in seconds |
| `ntpd_start` | Boolean | Run one-shot system-time synchronization before startup |
| `mihomo_persistent_ext_rules` | Boolean | Store downloaded external rules on persistent storage |
| `mihomo_persistent_cache` | Boolean | Store Mihomo profile/cache data persistently |

### Traffic Interception

`nft_apply_changes` is the single **Create nftables** switch: `1` creates client
and router interception rules together with policy routing; `0` skips both.
The `full` / `partial` mode and the separate client/router exclusions still apply.
DNS forwarding remains controlled independently by `dnsmasq_apply_changes`.

On upgrade, `nft_apply_changes_router` is removed and the existing
`nft_apply_changes` value is preserved. Since that remaining switch now controls
both paths, a previously enabled client path becomes combined interception. A
router-only legacy setting is not carried forward. When restoring an older backup,
remove the retired router flag; it is no longer read at runtime.

| Field | Type | Purpose |
| --- | --- | --- |
| `routing_mode` | Choice: `partial`, `full` | Select interception architecture |
| `ipv6_enabled` | Boolean | Enable IPv6 interception and Fake-IP support when WAN IPv6 is usable |
| `dnsmasq_apply_changes` | Boolean | Manage dnsmasq forwarding for Mihomo DNS |
| `nft_apply_changes` | Boolean | Create nftables rules and policy routing for both client and router traffic |
| `tproxy_input_interfaces` | List of device names | Client interfaces subject to interception |
| `nft_skuid_exclude_router` | List of users or UIDs | Bypass router sockets owned by selected users |
| `nft_ports_exclude_router` | List of ports/ranges | Bypass router TCP/UDP source or destination ports |
| `nft_ports_exclude` | List of ports/ranges | Bypass forwarded TCP/UDP source or destination ports |
| `nft_mac_exclude` | List of MAC addresses | Bypass matching local clients |
| `nft_ips_exclude` | List of IPv4 addresses/CIDRs | Bypass matching IPv4 clients |
| `pbr_priority` | Unsigned integer | Priority used by JustClash policy-routing rules |
| `nft_quic_mode` | `BY RULES` / `DROP` | QUIC handling policy |
| `nft_dns_mode` | Choice | Plain client TCP/UDP port 53 DNS policy (`BY RULES`, `DROP`, or `HIJACK` to the router DNS service) |
| `nft_dot_mode` | `BY RULES` / `DROP` | DNS-over-TLS handling policy |
| `nft_doh_mode` | `BY RULES` / `DROP` | DNS-over-HTTPS handling policy |
| `nft_dot_quic_mode` | `BY RULES` / `DROP` | DNS-over-QUIC handling policy |
| `nft_ntp_mode` | Choice | Client NTP handling policy |
| `nft_ntp_mode_router` | Choice | Router NTP handling policy |

The `REJECT` choice has been removed only from the four `nft_*_mode` settings above. Package migration converts existing QUIC/DoT/DoH/DoQ `REJECT` settings to `DROP`, preserving blocking without sending a rejection response. The default QUIC policy is now `DROP`. This does not disable blocklists: their blocking rules run inside Mihomo, separately from these OpenWrt firewall settings. When restoring an older configuration after migration, replace these four firewall settings with `DROP` before starting the service.

### Scheduling, Core, and Downloads

| Field | Type | Purpose |
| --- | --- | --- |
| `mihomo_autorestart` | Boolean | Enable scheduled service restart |
| `mihomo_cron_autorestart_string` | Cron expression | Restart schedule |
| `mihomo_service_data_autoupdate` | Boolean | Enable scheduled service-data refresh |
| `mihomo_cron_service_data_update_string` | Cron expression | Service-data refresh schedule |
| `mihomo_scheduled_work` | Boolean | Enable scheduled start/stop window |
| `mihomo_cron_scheduled_work_start_string` | Cron expression | Scheduled start |
| `mihomo_cron_scheduled_work_stop_string` | Cron expression | Scheduled stop |
| `mihomo_core_source_type` | Choice | Core update source type. Updates always download and verify SHA-256 and gzip before removing the installed core. See [core update procedure](../guides/maintenance.md#core-update-procedure). |
| `mihomo_github_repo` | `username/repo` | Repository used for GitHub core updates; new-install default provides the slim kernel version |
| `mihomo_github_channel` | Choice | Stable or configured prerelease channel |
| `mihomo_custom_core_url` | HTTPS URL | Custom core archive source with a shared `checksums.txt` file in `sha256sum` format. See [core update requirements](../guides/maintenance.md#what-is-being-updated). |
| `mihomo_rulesets_files_download_url` | HTTPS URL | Service ruleset catalog source |
| `mihomo_dashboard_zashboard_url` | HTTPS URL | Dashboard archive source |
| `mihomo_dashboard_metacubexd_url` | HTTPS URL | Dashboard archive source |
| `mihomo_dashboard_yacd_meta_url` | HTTPS URL | Dashboard archive source |
| `mihomo_geosite_url` | HTTPS URL | Geosite database source |
| `mihomo_geoip_url` | HTTPS URL | GeoIP database source |
| `mihomo_mem_limit` | Unsigned integer | Required Mihomo memory limit |
| `mihomo_gogc` | Unsigned integer | Required Go GC target |
| `mihomo_gomaxprocs` | Unsigned integer | Required Go CPU-thread limit |

URL fields may contain private sources. Do not include their values in bug reports.

LuCI offers repositories for the slim kernel version and upstream Mihomo as editable presets. Configuration resets use the slim kernel version default; package upgrades keep an existing `mihomo_github_repo` value.

## `proxy proxy`

### Runtime and Controller

| Field | Type | Purpose |
| --- | --- | --- |
| `log_level` | Choice | Mihomo log verbosity |
| `interface_name` | Device name | Default outbound interface binding |
| `tproxy_port` | Port | Transparent TProxy listener |
| `use_mixed_port` | Boolean | Enable explicit HTTP/SOCKS listener |
| `mixed_port` | Port | Explicit mixed listener |
| `mixed_port_bind_interface` | OpenWrt network name or `-` | Mixed listener bind, independent of the controller; IPv4 first, then IPv6; default `lan`; `-` listens on all available addresses |
| `proxy_authentication` | List of `user:pass` credentials | Access control for non-loopback Mixed Port clients; installation and reset generate a `user:` credential with a random 32-character password |
| `controller_bind_interface` | OpenWrt network name or `-` | Network address used for API binding, trying IPv4 first and then IPv6; `-` emits `:<port>` with an empty host for wildcard listening |
| `use_dashboard` | Boolean | Enable local dashboard hosting |
| `dashboard_repo` | Choice | Selected dashboard; changing an already downloaded panel requires [manual cleanup](../guides/maintenance.md#switching-the-web-dashboard). |
| `api_password` | Secret | Mihomo API credential, generated during package installation |
| `api_tls` | Boolean | Enable direct API TLS |
| `api_tls_cert` | Absolute path | PEM certificate path |
| `api_tls_key` | Absolute path | PEM private-key path |

### Core Behavior

| Field | Type | Purpose |
| --- | --- | --- |
| `unified_delay` | Boolean | Use unified delay calculation |
| `tcp_concurrent` | Boolean | Enable concurrent TCP connection attempts |
| `global_ua` | String | Global HTTP user agent |
| `etag_support` | Boolean | Enable provider ETag handling |
| `keep_alive_idle` | Unsigned integer | TCP keep-alive idle interval |
| `keep_alive_interval` | Unsigned integer | TCP keep-alive probe interval |
| `profile_store_selected` | Boolean | Persist selected group state |
| `profile_store_fake_ip` | Boolean | Persist Fake-IP mappings |

### DNS

See [DNS and Fake-IP](../guides/dns.md) for resolver roles, policy syntax, and
real-IP exceptions. [DNS recovery](../concepts/configuration-lifecycle.md#dns-recovery)
describes restoration of the managed dnsmasq configuration.

| Field | Type | Purpose |
| --- | --- | --- |
| `dns_listen_port` | Port | Mihomo DNS listener; schema fallback is 1053, while the shipped configuration and current LuCI preset use 7894 |
| `dns_cache_max_size` | Unsigned integer | DNS cache entry limit |
| `use_system_hosts` | Boolean | Import system hosts |
| `hosts` | List | Static host mappings |
| `default_nameserver` | List | Bootstrap resolvers |
| `nameserver` | List | Normal DNS upstreams |
| `direct_nameserver` | List | Upstreams for direct policy |
| `proxy_server_nameserver` | List | Resolvers for proxy/provider hosts |
| `nameserver_policy` | List | Domain-specific upstream policy |
| `fake_ip_range` | IPv4 CIDR | IPv4 Fake-IP pool |
| `fake_ip_range6` | IPv6 CIDR | IPv6 Fake-IP pool |
| `fake_ip_ttl` | Unsigned integer | Fake-IP DNS TTL |
| `fake_ip_exclude_domains` | List | Domain matches receiving real addresses |
| `fake_ip_exclude_rulesets` | List | Ruleset matches receiving real addresses |
| `fake_ip_exclude_geosites` | List | Geosite matches receiving real addresses |

### Geodata, Sniffer, and Core NTP

| Field | Type | Purpose |
| --- | --- | --- |
| `geodata_mode` | Boolean | Enable combined Geosite/GeoIP databases |
| `geodata_autoupdate` | Boolean | Enable database updates |
| `geodata_autoupdate_interval` | Unsigned integer | Update interval in hours |
| `sniffer_enable` | Boolean | Enable protocol sniffing |
| `sniffer_parse_pure_ip` | Boolean | Sniff pure-address connections |
| `sniffer_override_destination` | Boolean | Replace destination using sniffed metadata |
| `sniffer_exclude_domain` | List | Domains excluded from sniffing |
| `sniffer_force_domain` | List | Domains forced through sniffing |
| `sniffer_skip_src_address` | List | Source addresses excluded from sniffing |
| `sniffer_skip_dst_address` | List | Destination addresses excluded from sniffing |
| `core_ntp_enabled` | Boolean | Enable Mihomo internal NTP |
| `core_ntp_server` | Host | Mihomo NTP server |
| `core_ntp_port` | Port | Mihomo NTP port |
| `core_ntp_interval` | Unsigned integer | Mihomo NTP interval |
| `core_ntp_write_system` | Boolean | Allow Mihomo to update system time |

Mihomo internal NTP is separate from `settings.ntpd_start`.

Under **Setup: Proxy → NTP settings**, LuCI offers IPv4 server presets including
Cloudflare. Selecting a preset stores its IP address in `core_ntp_server`; the
hostname and `(IPv4)` text are display labels. A custom hostname or address can
still be entered.

## `proxies`

A `proxies` section defines one named outbound.

Deleting an outbound in LuCI removes its name from every group's `proxies` list
and clears any matching `default_selected`. The same cleanup applies when a group
is deleted. References in the default rule reset to `DIRECT`; Mixed Port resets
to `BY RULES`, and subscription/blocklist download paths reset to `DIRECT`.
Matching connection-chaining fields are cleared, including `dialer-proxy` in
JSON outbounds. Empty groups are retained. Apply the pending changes with
Save & Apply.

Choose `mode='uri'` to use a link in `proxy_link_uri`, or `mode='object'` to
provide a Mihomo outbound object in `proxy_link_object`.

| Field | What it controls |
| --- | --- |
| `enabled` | Whether this outbound is generated |
| `name` | The name used when selecting this outbound in rules and groups |
| `mode` | `uri` for a link, or `object` for a Mihomo JSON object |
| `proxy_link_uri` | The connection link used in URI mode |
| `proxy_link_object` | The outbound definition used in object mode |
| `interface_name` | The outgoing network device for a URI-defined outbound; an empty value leaves it to the core's normal interface selection |
| `routing_mark` | Optional socket mark, decimal or hexadecimal, from `1` to `2147483647`; must leave internal bits `0x4` and `0x80` clear; see [fwmark handoff](../guides/fwmark-handoff.md) for bypass behavior and receiver requirements |
| `ip_version` | Name-resolution strategy: `dual`, `ipv4`, `ipv6`, `ipv4-prefer`, or `ipv6-prefer` |
| `dialer_proxy` | Another outbound or group through which the URI-defined outbound establishes its connection |
| `enabled_list` | Catalog IDs whose traffic should use this outbound; LuCI automatically offers both [IP matching modes](../guides/rulesets.md#dns-resolution-for-ip-rulesets) for each IP ruleset |
| `use_proxy_for_list_update` | Whether to download those rulesets through this outbound |
| `list_update_interval`, `size_limit` | Ruleset update interval and download size limit |
| `additional_domain_route`, `enabled_geosite_list` | Additional domain and Geosite matches |
| `additional_udp_dst_port_route`, `additional_tcp_dst_port_route` | Lists of individual destination ports (`1–65535`); match the selected protocol and port independently of domain rules; do not add Partial Interception |
| `additional_destip_route`, `enabled_geoip_list` | Destination-address and GeoIP matches |
| `additional_srcip_route` | Source-address matches |

The separate interface, mark, address-family, and chaining controls are read
by the URI parsers. In object mode, put the corresponding Mihomo fields in the
JSON object itself.

**Bind to interface** selects the outgoing device, while **Connect through**
selects another outbound or group as the connection's dialer. A group chooses
a member; `dialer_proxy` adds a connection through another outbound. Avoid
references that lead back to the same outbound. See the
[two-outbound example](../guides/routing.md#chain-two-outbounds-with-connect-through)
for the connection order and LuCI setup.

### A Direct Outbound with `direct://`

Set `mode='uri'` and `proxy_link_uri='direct://'` to generate a named outbound
with `type: direct`. Configure its interface, mark, and address-family settings
using the fields above. [Quick Start](../getting-started.md#3-add-an-outbound) shows
the LuCI fields for one path; [Multi-WAN](../guides/multiwan.md#direct-wan-outbounds)
adds multiple paths and switching between them.

Connection links and JSON objects can contain credentials; keep their values
out of shared configuration dumps.

## `proxy_provider`

A provider downloads and refreshes nodes from a subscription. Select
its `name` in a group's `providers` list to make those nodes available to that
group. Imported nodes do not need separate `proxies` sections in UCI.

Deleting a provider in LuCI removes it from every group's `providers` list.
If a group has no remaining members or providers, its `default_selected` is
cleared too. A provider name is separate from outbound names, so deleting a
provider does not reset routes through an outbound with the same name.

For the LuCI setup sequence, see
[Use a Subscription Instead](../getting-started.md#use-a-subscription-instead).

The provider's `proxy` option chooses how to download the subscription. It
does not decide which websites use the downloaded nodes; that is the job of
the group's routing assignments.

If the source cannot be reached directly, **Get subscription with** must use an
already working outbound or group. A group that relies on this same subscription
cannot provide the initial download path.

The **Override** tab applies connection settings to imported nodes. For example,
`override_interface_name` binds their outgoing connections to a device; it does
not select the path used to fetch the subscription itself.

| Field group | Fields |
| --- | --- |
| Identity/source | `enabled`, `name`, `subscription`, `update_interval`, `size_limit` |
| Download path | `proxy` |
| Overrides | `override_dialer_proxy`, `override_interface_name`, `override_routing_mark`, `override_ip_version`, `override_reality_mlkem768` |
| Headers and encryption | `header_hwid`, `header_hwid_custom`, `header_os_custom`, `header_os_version_custom`, `header_device_model_custom`, `header_authorization`, `header_user_agent`, `age_private_key`, `header_age_public_key` |
| Health check | `health_check`, `health_check_url`, `health_check_expected_status`, `health_check_interval`, `health_check_timeout`, `health_check_lazy` |
| Filtering | `filter`, `exclude_filter`, `exclude_type` |

`override_reality_mlkem768` is a LuCI toggle under Routing → Proxy providers → Override.
It defaults to `0`. When enabled, the generated provider `override` contains an
`override-expr` JSON array that sets `reality-opts.support-x25519mlkem768` to
`true` only on nodes that already have `reality-opts`. Other nodes are unchanged.

LuCI defaults to `header_hwid=real` and `header_user_agent=__justclash__`, which
sends `JustClash/<installed-version>`. On upgrade, empty or unset `header_hwid`
options in existing providers become `-`, preserving disabled identity headers.
Select **Disable** to save `header_hwid=-`. Outside this migration, the UI
defaults also apply when editing sections without the corresponding option.

With `header_hwid=real`, all four identity headers are read from the router.
`x-ver-os` contains only the OpenWrt version from `VERSION_ID`, without the OS name.
With `header_hwid=spoofed`, `x-hwid`, `x-device-os`, `x-ver-os`, and `x-device-model`
come only from their corresponding `header_*_custom` fields. Empty custom values
remain empty; they never fall back to the router identity.

The subscription, authorization header, identity fields, and private key are sensitive.

## `proxy_group`

A group's `proxies` list names manually configured outbounds or other groups; its
`providers` list names subscriptions whose nodes it can use. A group can use
both lists together.

| Field group | Fields |
| --- | --- |
| Identity | `enabled`, `name`, `group_type` |
| Members | `proxies`, `providers` |
| Selection | `default_selected` for `select` |
| Balancing | `strategy` for `load-balance` |
| Health check | `check_url`, `expected_status`, `check_interval`, `check_timeout`, `max_failed_times`, `lazy`, `tolerance` |
| Filtering | `filter`, `exclude_filter`, `exclude_type` |
| Rulesets | `enabled_list`, `use_proxy_group_for_list_update`, `list_update_interval`, `size_limit` |
| Domain policy | `additional_domain_route`, `enabled_geosite_list` |
| Destination ports | `additional_udp_dst_port_route`, `additional_tcp_dst_port_route`, with the same semantics as outbound port rules |
| Destination policy | `additional_destip_route`, `enabled_geoip_list` |
| Source policy | `additional_srcip_route` |

LuCI offers the same [IP matching modes](../guides/rulesets.md#dns-resolution-for-ip-rulesets)
for group rulesets as for outbound rulesets.

### Group Types

| `group_type` | Behavior |
| --- | --- |
| `select` | You choose a member under Nodes |
| `fallback` | Uses the first healthy member; later members are backups |
| `url-test` | Chooses using measured delay, with the configured tolerance |
| `load-balance` | Distributes connections across members |

For working failover and balancing examples, see
[Multi-WAN and Failover](../guides/multiwan.md#build-a-group).

## Singleton Rule Sections

### `block_rules`

| Field | Purpose |
| --- | --- |
| `enabled` | Enable blocking |
| `enabled_blocklist` | Selected domain/IP block rulesets; LuCI automatically offers both [IP matching modes](../guides/rulesets.md#dns-resolution-for-ip-rulesets) for each IP entry |
| `enabled_geosite_blocklist` | Selected Geosite categories |
| `enabled_geoip_blocklist` | Selected GeoIP categories |
| `proxy` | Outbound used to download blocklist files; this is not the block action |
| `list_update_interval` | Provider refresh interval |
| `size_limit` | Provider download limit |
| `additional_domain_blockroute` | Manual blocked domain suffixes |
| `additional_destip_blockroute` | Manual blocked IPv4 CIDRs |

Generated block actions are `REJECT`.

### `mixed_port_rules` and `final_rules`

| Section.field | Purpose |
| --- | --- |
| `mixed_port_rules.exit_rule` | `BY RULES`, `DIRECT`, or a fixed outbound for explicit mixed-port traffic |
| `final_rules.exit_rule` | Final action after earlier rules |

## Secret Handling

Treat these as sensitive:

- `api_password`;
- `proxy_authentication`;
- `proxy_link_uri` and credential-bearing JSON;
- `subscription`;
- `header_authorization`;
- `age_private_key`;
- private URLs, custom DNS policy, client identifiers, and local topology.

Use the redacted diagnostic:

```sh
justclash.sh check
```

Use raw UCI or unsafe diagnostic output only locally.

## Recovery

Use [startup troubleshooting](../troubleshooting/startup.md) to identify a failed
setting first. To restore a known configuration, follow
[Maintenance](../guides/maintenance.md#restore-a-backup). Resetting replaces saved
settings with package defaults and generates new credentials; the command is
documented under [Reset configuration](cli.md#reset-configuration).
