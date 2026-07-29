# User-Defined RuleSets

A RuleSet definition tells JustClash where a list comes from and what it contains. Defining a RuleSet does not activate it by itself. You must also select its ID in a proxy, proxy group, or block-rules section.

## Add a RuleSet in LuCI

1. Open **Services -> JustClash -> RuleSets**.
2. Choose the user-defined routing or blocking catalog.
3. Add a row.
4. Set a display name and a unique ID.
5. Select the content type and source format.
6. Enter a remote URL or an absolute local path.
7. Save the row, then **Save & Apply**.
8. Open **Routing** and select the new ID where it should be used.

Use short stable IDs. Renaming an ID requires updating every section that references it.

## Supported Source Types

| Content type | Supported format | Used for |
| --- | --- | --- |
| `domain` | `mrs` | Domain routing or DNS blocking. |
| `ipcidr` | `mrs` | Mihomo IP routing in full mode. |
| `ipcidr` | `text` | Mihomo routing and nftables set synchronization in partial mode. |

Text sources are intentionally limited to IP-CIDR content. Domain text files are not converted into Mihomo RuleSet providers by this catalog.

## Manual Catalog Files

Advanced users can edit:

- `/etc/justclash/user.rulesets.txt` for routing RuleSets;
- `/etc/justclash/user.block.rulesets.txt` for blocking RuleSets.

Each non-comment line uses:

```text
Name|ID|Type|Format|URL_or_Path[|Authorization]
```

Fields:

| Field | Meaning |
| --- | --- |
| `Name` | Human-readable LuCI label. |
| `ID` | Stable identifier referenced by UCI sections. |
| `Type` | `domain` or `ipcidr`. |
| `Format` | `mrs`, or `text` for IP-CIDR sources. |
| `URL_or_Path` | Remote HTTP(S) source or absolute local path. |
| `Authorization` | Optional authorization header value. |

Safe templates:

```text
Remote domains|remote-domains|domain|mrs|<RULESET_URL>
Local networks|local-networks|ipcidr|text|/etc/justclash/local-networks.list
Protected source|protected-source|domain|mrs|<RULESET_URL>|<AUTHORIZATION_HEADER>
```

> [!WARNING]
> The optional authorization field is a credential. Protect the catalog file and do not include that line in diagnostic output.

## Activate a RuleSet

After defining the catalog entry, select its ID in one of these places:

- a **Proxy** or **Proxy group** to route matching traffic;
- **Block rules** to block matching traffic;
- a Fake-IP exclusion list when matching domains must receive real addresses.

For CLI automation, use the corresponding list option in the target UCI section. The exact option depends on the section type and whether the RuleSet is used for routing, blocking, or Fake-IP filtering.

## Partial Routing Requirements

Partial mode can intercept raw-address traffic only when nftables has an address list to match. Therefore:

- use an `ipcidr|text` source when the list must populate nftables sets;
- keep one address or CIDR per line;
- do not expect a binary domain `.mrs` file to produce kernel address sets;
- verify that the persistent-rules setting points to storage with enough space if downloaded lists must survive reboot.

## Downloading and Caching

Mihomo downloads active remote RuleSets, validates their format, and updates them according to the configured interval. JustClash generates provider definitions and, in partial mode, watches supported text IP-CIDR files so refreshed data reaches nftables.

Enable persistent external rules only when flash wear, storage capacity, and reboot behavior have been considered. RAM-backed rules are downloaded again after reboot but avoid persistent writes.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| ID is not visible in Routing | Validate the catalog line and ensure the ID is unique. |
| Provider appears but is not downloaded | Confirm the RuleSet is selected by an enabled routing or block section. |
| Partial mode ignores raw addresses | Use an active `ipcidr|text` source and check `diag_nft`. |
| Download fails | Check WAN, authorization, URL reachability, and system time. |
| Updated catalog is not visible | Run `justclash.sh service_data_update` for built-in catalogs, or reload after editing user files. |

Useful commands:

```sh
service justclash restart
justclash.sh logs 100
justclash.sh diag_nft
```
