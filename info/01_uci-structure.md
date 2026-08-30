# UCI Configuration Reference

JustClash stores its configuration in `/etc/config/justclash`. LuCI edits the same UCI package; direct UCI commands are intended for automation, recovery, and advanced setups.

> [!IMPORTANT]
> This document describes the current schema, not a replacement default configuration. Package upgrades may add defaults or migrate fields. Keep the installed package config as the source of truth.

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

`uci show` can expose endpoints, credentials, domains, client addresses, and routing policy. Use `justclash.sh diag_redacted` when sharing diagnostics.

## Section Model

| Section type | Cardinality | Purpose |
| --- | --- | --- |
| `main settings` | One named section | Service startup, traffic interception, scheduling, storage, and downloads |
| `proxy proxy` | One named section | Mihomo runtime, controller, DNS, sniffer, mixed port, and Geodata |
| `proxies` | Zero or more anonymous sections | Individual outbound definitions |
| `proxy_provider` | Zero or more anonymous sections | Remote provider definitions |
| `proxy_group` | Zero or more anonymous sections | Selection, failover, latency, and balancing groups |
| `block_rules block_rules` | One named section | Domain/address blocking and blocklist providers |
| `mixed_port_rules mixed_port_rules` | One named section | First rule for explicit mixed-port traffic |
| `final_rules final_rules` | One named section | Final action after all other rules |

LuCI creates dynamic sections with generated UCI IDs. Rules refer to the user-visible `name`, not necessarily to the UCI section ID.

## `main settings`

### Startup and Storage

| Field | Type | Purpose |
| --- | --- | --- |
| `wait_for_wan` | Boolean | Wait for an active default route during boot |
| `wait_for_wan_max` | Unsigned integer | Maximum WAN wait in seconds |
| `delayed_boot` | Boolean | Add a fixed startup delay |
| `delayed_boot_value` | Unsigned integer | Delay in seconds |
| `skip_environment_checks` | Boolean | Skip non-critical conflict checks and compatibility fixes |
| `ntpd_start` | Boolean | Run one-shot system-time synchronization before startup |
| `mihomo_persistent_ext_rules` | Boolean | Store downloaded external rules on persistent storage |
| `mihomo_persistent_cache` | Boolean | Store Mihomo profile/cache data persistently |

### Traffic Interception

| Field | Type | Purpose |
| --- | --- | --- |
| `routing_mode` | Choice: `partial`, `full` | Select interception architecture |
| `ipv6_enabled` | Boolean | Enable IPv6 interception and Fake-IP support when WAN IPv6 is usable |
| `dnsmasq_apply_changes` | Boolean | Manage dnsmasq forwarding for Mihomo DNS |
| `nft_apply_changes` | Boolean | Install client traffic rules |
| `nft_apply_changes_router` | Boolean | Install router-originated traffic rules |
| `tproxy_input_interfaces` | List of device names | Client interfaces subject to interception |
| `nft_skuid_exclude_router` | List of users or UIDs | Bypass router sockets owned by selected users |
| `nft_ports_exclude_router` | List of ports/ranges | Bypass router TCP/UDP source or destination ports |
| `nft_ports_exclude` | List of ports/ranges | Bypass forwarded TCP/UDP source or destination ports |
| `nft_mac_exclude` | List of MAC addresses | Bypass matching local clients |
| `nft_ips_exclude` | List of IPv4 addresses/CIDRs | Bypass matching IPv4 clients |
| `pbr_priority` | Unsigned integer | Priority used by JustClash policy-routing rules |
| `nft_quic_mode` | Choice | QUIC handling policy |
| `nft_dns_udp_mode` | Choice | Plain client UDP DNS policy (`BY RULES`, `DROP`, or `HIJACK` to the router DNS service) |
| `nft_dot_mode` | Choice | DNS-over-TLS handling policy |
| `nft_doh_mode` | Choice | DNS-over-HTTPS handling policy |
| `nft_dot_quic_mode` | Choice | DNS-over-QUIC handling policy |
| `nft_ntp_mode` | Choice | Client NTP handling policy |
| `nft_ntp_mode_router` | Choice | Router NTP handling policy |

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
| `mihomo_core_source_type` | Choice | Core update source type |
| `mihomo_github_repo` | String | Repository identifier used by the configured updater |
| `mihomo_github_channel` | Choice | Stable or configured prerelease channel |
| `mihomo_custom_core_url` | URL | Custom core archive source |
| `mihomo_rulesets_files_download_url` | URL | Service ruleset catalog source |
| `mihomo_dashboard_zashboard_url` | URL | Dashboard archive source |
| `mihomo_dashboard_metacubexd_url` | URL | Dashboard archive source |
| `mihomo_dashboard_yacd_meta_url` | URL | Dashboard archive source |
| `mihomo_geosite_url` | URL | Geosite database source |
| `mihomo_geoip_url` | URL | GeoIP database source |
| `mihomo_mem_limit` | Unsigned integer | Optional Mihomo memory limit |
| `mihomo_gogc` | Unsigned integer | Optional Go GC target |
| `mihomo_gomaxprocs` | Unsigned integer | Optional Go CPU-thread limit |

URL fields may contain private sources. Do not include their values in bug reports.

## `proxy proxy`

### Runtime and Controller

| Field | Type | Purpose |
| --- | --- | --- |
| `log_level` | Choice | Mihomo log verbosity |
| `interface_name` | Device name | Default outbound interface binding |
| `tproxy_port` | Port | Transparent TProxy listener |
| `use_mixed_port` | Boolean | Enable explicit HTTP/SOCKS listener |
| `mixed_port` | Port | Explicit mixed listener |
| `proxy_authentication` | List of `user:pass` credentials | Required access control for non-loopback Mixed Port clients |
| `controller_bind_interface` | OpenWrt network name or `-` | Network whose address is used for API binding; `-` listens on all IPv4 interfaces |
| `use_dashboard` | Boolean | Enable local dashboard hosting |
| `dashboard_repo` | Choice | Selected dashboard |
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

| Field | Type | Purpose |
| --- | --- | --- |
| `dns_listen_port` | Port | Mihomo DNS listener |
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

## `proxies`

| Field group | Fields |
| --- | --- |
| Identity | `enabled`, `name`, `mode` |
| Definition | `proxy_link_uri`, `proxy_link_object` |
| Outbound chaining | `dialer_proxy` |
| Network binding | `interface_name`, `routing_mark`, `ip_version` |
| Rulesets | `enabled_list`, `use_proxy_for_list_update`, `list_update_interval`, `size_limit` |
| Domain policy | `additional_domain_route`, `enabled_geosite_list` |
| Destination policy | `additional_destip_route`, `enabled_geoip_list` |
| Source policy | `additional_srcip_route` |

`proxy_link_uri` and `proxy_link_object` can contain credentials.

## `proxy_provider`

| Field group | Fields |
| --- | --- |
| Identity/source | `enabled`, `name`, `subscription`, `update_interval`, `size_limit` |
| Download path | `proxy` |
| Overrides | `override_dialer_proxy`, `override_interface_name`, `override_routing_mark`, `override_ip_version` |
| Headers and encryption | `header_hwid`, `header_hwid_custom`, `header_authorization`, `header_user_agent`, `age_private_key`, `header_age_public_key` |
| Health check | `health_check`, `health_check_url`, `health_check_expected_status`, `health_check_interval`, `health_check_timeout`, `health_check_lazy` |
| Filtering | `filter`, `exclude_filter`, `exclude_type` |

The subscription, authorization header, hardware identifier, and private key are sensitive.

## `proxy_group`

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
| Destination policy | `additional_destip_route`, `enabled_geoip_list` |
| Source policy | `additional_srcip_route` |

Allowed `group_type` values are `select`, `fallback`, `load-balance`, and `url-test`.

## Singleton Rule Sections

### `block_rules`

| Field | Purpose |
| --- | --- |
| `enabled` | Enable blocking |
| `enabled_blocklist` | Selected domain/IP block rulesets |
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
justclash.sh diag_redacted
```

Use raw UCI or unsafe diagnostic output only locally.

## Recovery

```sh
service justclash stop
justclash.sh diag_service_config
justclash.sh config_reset
service justclash start
```

`config_reset` backs up the active configuration before restoring package defaults. Review the generated backup locally because it can contain secrets.
