# Geodata, Geosite, and GeoIP

JustClash supports two ways to classify destinations:

- **RuleSet mode** uses individual active providers, usually `.mrs` files and text IP-CIDR sources.
- **Geodata mode** uses combined `geosite.dat` and `geoip.dat` databases.

Choose one based on the policies you need and the resources available on the router.

## Comparison

| Feature | RuleSet mode | Geodata mode |
| --- | --- | --- |
| Data loaded | Selected providers only | Combined domain and address databases |
| Memory use | Usually lower | Usually higher |
| LuCI workflow | Select catalog IDs | Enter Geosite and GeoIP category names |
| Partial-mode IP synchronization | Supported for text IP-CIDR sources | Binary GeoIP data is not converted into nftables sets |
| Compatibility with community rule examples | RuleSet-specific | Common `GEOSITE` and `GEOIP` syntax |

Use RuleSet mode on constrained routers or when only a small number of lists is needed. Use Geodata when existing policy is already expressed in Geosite/GeoIP categories and the router has enough memory.

## Enable Geodata Mode

LuCI:

1. Open **Services -> JustClash -> Proxy -> GeoData settings**.
2. Enable Geodata mode.
3. Optionally enable automatic updates and set the interval.
4. Save & Apply.

UCI:

```sh
uci set justclash.proxy.geodata_mode='1'
uci set justclash.proxy.geodata_autoupdate='1'
uci set justclash.proxy.geodata_autoupdate_interval='24'
uci commit justclash
service justclash restart
```

Monitor memory after enabling the databases, especially on low-memory devices.

## Add Geosite and GeoIP Policies

When Geodata mode is enabled, routing sections expose fields for category names.

- **Geosite** categories match domains.
- **GeoIP** categories match destination addresses.

Categories can be assigned to:

- individual proxies;
- proxy groups;
- block rules.

Use the exact category identifiers provided by the selected database source. A category name that exists in one distribution may not exist in another.

Generated rules follow Mihomo syntax conceptually:

```yaml
rules:
  - GEOSITE,<CATEGORY>,<OUTBOUND>
  - GEOIP,<CATEGORY>,<OUTBOUND>
```

## Partial Routing Limitation

Geosite matching works with the Fake-IP DNS path because matching domain traffic is intercepted before rule evaluation.

GEOIP matching cannot control every raw-address connection in partial mode. If the destination address is not already in an active nftables set, the connection bypasses Mihomo and the GEOIP rule is never evaluated.

Use full routing when GEOIP policy must apply to all selected traffic. Alternatively, use supported text IP-CIDR RuleSets for the specific address ranges that partial-mode nftables must intercept.

## Fake-IP Filters

`fake_ip_exclude_geosites` makes selected Geosite matches receive real addresses. In partial mode, those real addresses can bypass interception. Use this option for domains intended to go direct or for cases covered by an active address list.

## Update Sources

The database URLs are configured in the `settings` section:

- `mihomo_geosite_url`
- `mihomo_geoip_url`

UCI template:

```sh
uci set justclash.settings.mihomo_geosite_url='<GEOSITE_DAT_URL>'
uci set justclash.settings.mihomo_geoip_url='<GEOIP_DAT_URL>'
uci commit justclash
service justclash restart
```

Use direct downloadable files compatible with the installed Mihomo version. Changing the source can also change category names and contents; review policies after a source migration.

## Verification and Troubleshooting

1. Check that both database files download successfully.
2. Confirm the category names exist in the selected source.
3. Inspect active rules in LuCI.
4. Watch memory use after loading the databases.
5. In partial mode, distinguish domain tests from raw-address tests.

```sh
justclash.sh logs 100
justclash.sh diag_mihomo_config
```

If a GEOIP rule appears correct but raw-address traffic remains direct in partial mode, that is an interception limitation rather than a category parser failure. See [Choosing a Routing Mode](00_routing_architecture_and_design.md).
