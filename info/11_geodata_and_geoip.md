# Geodata, Geosite, and GeoIP

JustClash supports two classification models:

- **Ruleset mode:** selected rule providers, usually `.mrs` or text IP-CIDR files;
- **Geodata mode:** combined Geosite and GeoIP databases.

## Comparison

| Feature | Ruleset mode | Geodata mode |
| --- | --- | --- |
| Loaded data | Selected providers | Combined databases |
| Typical memory use | Lower | Higher |
| Domain policy | Domain rulesets | Geosite categories |
| Address policy | IP-CIDR rulesets | GeoIP categories |
| Partial nftables synchronization | `ipcidr/text` only | Not available for binary GeoIP |

Use selected rulesets on constrained routers. Use Geodata when policy already depends on Geosite/GeoIP categories and the router has enough memory.

## Enable Geodata

LuCI: **Services → JustClash → Setup: Proxy → GeoData settings**.

```sh
uci set justclash.proxy.geodata_mode='1'
uci set justclash.proxy.geodata_autoupdate='1'
uci set justclash.proxy.geodata_autoupdate_interval='<HOURS>'
uci commit justclash
service justclash restart
```

Record baseline memory usage before enabling the databases, then compare it under **Status** after startup and after rules are active.

## Configure Database Sources

LuCI: **Services → JustClash → Setup: Service → External resources**.

UCI fields:

- `settings.mihomo_geosite_url`;
- `settings.mihomo_geoip_url`.

```sh
uci set justclash.settings.mihomo_geosite_url='<GEOSITE_DATABASE_URL>'
uci set justclash.settings.mihomo_geoip_url='<GEOIP_DATABASE_URL>'
uci commit justclash
service justclash restart
```

Use direct downloadable files compatible with the installed Mihomo version. A new source can use different category names or contents; review every policy after migration.

Private database URLs are sensitive and should not appear in diagnostics.

## Add Policies

When Geodata mode is enabled, routing sections expose:

- `enabled_geosite_list` for domain categories;
- `enabled_geoip_list` for destination-address categories;
- corresponding blocklist fields in `block_rules`.

Categories can target individual proxies, groups, or block rules.

Conceptually generated rules are:

```yaml
rules:
  - GEOSITE,<CATEGORY>,<OUTBOUND>
  - GEOIP,<CATEGORY>,<OUTBOUND>
```

Use exact category identifiers from the selected database source.

## Partial Interception Limitation

Geosite policy works with the Fake-IP DNS path because the domain connection is intercepted before rule evaluation.

GeoIP cannot classify every raw-address connection in Partial Interception. If the address is absent from an active nftables set, the connection bypasses Mihomo before the GeoIP rule is evaluated.

Choose one:

- use Full Interception when GEOIP must apply to all selected traffic;
- use a supported `ipcidr/text` ruleset for address ranges that Partial Interception must capture;
- accept direct bypass for unmatched raw-address traffic.

## Fake-IP Filters

`fake_ip_exclude_geosites` returns real addresses for selected Geosite categories.

In Partial Interception, those real addresses can bypass Mihomo. Use this only for direct categories or categories also covered by an active text IP-CIDR set.

## Resource and Storage Checklist

- Check free storage before downloading new databases.
- Monitor Mihomo memory after enabling Geodata.
- Avoid unnecessarily short update intervals.
- Confirm persistent storage policy before keeping large databases across reboot.
- Retest category availability after changing sources.

## Verification

1. Confirm both database downloads completed.
2. Confirm selected category names exist.
3. Inspect generated rules locally.
4. Test a permitted domain category.
5. Test a permitted raw-address case separately.
6. Compare memory usage with the baseline.

```sh
justclash.sh logs 100
justclash.sh diag_mihomo_config
```

These outputs can include private sources, categories, domains, or topology. Use `diag_redacted` when sharing results.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Database does not download | WAN, system time, URL, source compatibility |
| Category is ignored | Exact name and selected database |
| Domain policy works, raw-address policy does not | Partial Interception limitation |
| Memory pressure increases | Disable Geodata or return to selected rulesets |
| Policy changes after source migration | Category definitions differ between sources |

## Rollback

1. Remove Geosite/GeoIP category references from routing sections.
2. Disable `geodata_mode`.
3. Save & Apply.
4. Verify the equivalent ruleset policy before removing database files.

See [Choosing a Routing Mode](00_routing_architecture_and_design.md) and [User-Defined Rulesets](05_user_defined_rulesets.md).
