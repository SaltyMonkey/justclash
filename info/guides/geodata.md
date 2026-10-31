# Geodata, Geosite, and GeoIP

[Documentation](../README.md)

JustClash supports two classification models:

- **Ruleset mode:** selected rule providers; domain sources can use MRS, text, or
  YAML, while LuCI accepts text IP-CIDR sources. See [Custom rulesets](rulesets.md)
  for supported extensions and manually edited catalogs;
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

Use HTTPS URLs for direct downloadable files compatible with the installed Mihomo version. Leave a source field empty to use its default. A new source can use different category names or contents; review every policy after migration.

Private database URLs are sensitive and should not appear in diagnostics.

## Add Policies

When Geodata mode is enabled, routing sections expose:

- `enabled_geosite_list` for domain categories;
- `enabled_geoip_list` for destination-address categories;
- corresponding blocklist fields in `block_rules`.

Categories can target individual outbounds, groups, or block rules.

Conceptually generated rules are:

```yaml
rules:
  - GEOSITE,<CATEGORY>,<OUTBOUND>
  - GEOIP,<CATEGORY>,<OUTBOUND>
```

Use exact category identifiers from the selected database source.

## Partial Interception Limitation

Geosite can classify intercepted Fake-IP domain traffic. GeoIP cannot capture
a raw-address connection that never enters Mihomo. Use Full Interception when
GeoIP must apply to all selected traffic, or an active `ipcidr/text` ruleset to
capture specific ranges in Partial Interception. See
[routing-mode behavior](../concepts/routing.md#behavior-comparison).

## Fake-IP Filters

`fake_ip_exclude_geosites` returns real addresses for selected Geosite categories.

Check the [DNS and traffic path requirements](../concepts/routing.md#dns-and-fake-ip)
before excluding a category that should still follow outbound rules.

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
justclash.sh logs service 100
justclash.sh config show mihomo
```

These outputs can include private sources, categories, domains, or topology. Use `check` when sharing results.

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

See [Choosing a Routing Mode](../concepts/routing.md) and [User-Defined Rulesets](rulesets.md).
