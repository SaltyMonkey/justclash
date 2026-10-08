# Configuration Lifecycle

[Documentation](../README.md)

Saved UCI configuration, generated YAML, and the running Mihomo state serve
different purposes. A value visible in an editor is not necessarily active yet.

## Save and Apply Changes

| Action | Result |
| --- | --- |
| Save a Routing row | Updates the form's pending configuration |
| LuCI **Save** | Saves pending UCI changes without applying the service configuration |
| LuCI **Save & Apply** | Commits configuration and triggers the JustClash service reload |
| `uci set` / `uci add_list` | Stages UCI changes |
| `uci commit justclash` | Writes those changes to the persistent configuration |
| `service justclash reload` | Stops and starts the managed service using current configuration |
| Choose a member under **Nodes** | Changes the running core's group selection; storage depends on profile/cache settings |

After manual edits, commit and reload explicitly. LuCI **Rules** and **Nodes** are
runtime views; the **Setup** pages define saved configuration. See
[LuCI availability](../troubleshooting/luci.md).

## Validation and Missing Values

Initialization loads UCI and validates the fields described by the native schema.
Missing or empty options with defaults receive values in that process's memory.
This does not rewrite `/etc/config/justclash`, and it does not restore arbitrary
missing connection definitions, subscriptions, or referenced outbounds.

Invalid supplied values are not replaced automatically. Disabled dynamic
sections are validated too. Type validation is followed by startup and Mihomo
configuration checks; a well-formed name alone does not prove its target exists.

The packaged configuration, LuCI presets, schema fallbacks, and Mihomo defaults
are different layers and can differ. For example, the schema fills absent group
health-check settings for automatic group types, while `select` allows them to
remain absent. The current LuCI group editor still supplies check presets.

Use the [UCI reference](../reference/uci.md) for field details and
[startup troubleshooting](../troubleshooting/startup.md) for failures. Recovery
through defaults is limited to declared defaults; it is not a full config reset.

## Generated YAML Cache

JustClash stores generated YAML and the companion routing snapshots in its
RAM-backed runtime directory. On start or reload, it regenerates them when a
required file is missing or the saved input fingerprint differs.

The fingerprint covers:

- generation-relevant UCI configuration, excluding selected startup/updater fields;
- the JustClash package version;
- the resolved controller bind address;
- the presence and contents of built-in and user ruleset catalogs.

Dashboard URL settings remain part of the configuration fingerprint. Editing a
catalog or updating service data affects generation on the next start/reload;
it does not modify an already running core by itself.

When the files and fingerprint match, Mihomo validates the cached YAML before
reuse. If that validation fails, startup aborts; it does not silently regenerate
the same configuration. A core-only update does not change the fingerprint, but
the new core still performs this validation.

A router reboot clears runtime files and requires regeneration. Random
User-Agents are resolved during generation, so a cache-reusing restart keeps the
previously chosen value. Editing generated YAML is not a persistent configuration
method: a later regeneration replaces it.

## Persistent Data

**Setup: Service → Storage** controls persistent downloaded rules and Mihomo
cache/profile data separately. These switches do not make generated YAML the
authoritative configuration. Enable persistence only when surviving reboot is
worth the storage use and flash writes.

## DNS Recovery

JustClash keeps its DNS backup in the affected `dnsmasq` section of the `dhcp`
UCI package, separately from the current JustClash settings. Existing
`justclash_server`, `justclash_noresolv`, and `justclash_cachesize` backup fields
are accompanied by `justclash_<option>_present` flags, `justclash_applied_server`,
and `justclash_applied`. The last flag is set before modifying DNS, so a failed
apply can also be cleaned up. These are internal recovery fields, not settings
to edit in LuCI.

Cleanup uses this saved state even after DNS management is disabled or the
listener port is changed. It restores an old configuration before applying a
new one. After a successful commit and dnsmasq restart, it sets
`justclash_applied=0`. The inactive snapshot remains until the next apply
overwrites it. For `server`, cleanup removes the saved JustClash upstream,
restores the original servers, and keeps manually added servers without
duplicates. Original servers come first, followed by additional current entries.
The package's one-time UCI migration restores complete backups from the previous
format directly and then removes their legacy fields. It also removes stale legacy
snapshots left after a clean stop. The next DNS apply creates a snapshot in the
current format. Conflicting manual edits, incomplete backups, and unrecognized older
formats remain untouched. Runtime recovery still rejects those ambiguous states and
prevents a new DNS configuration from being applied. Quoted server lists (including
UCI-quoted entries containing whitespace) are rejected rather than parsed as shell
expressions.

The backup is persistent because the DNS changes themselves are committed to
UCI. Do not delete recovery fields to silence an error: doing so loses the
information needed to restore the original settings. They can contain private
DNS configuration; redact their values before sharing diagnostics.


Stop JustClash before an OpenWrt firmware upgrade so preserved dnsmasq
configuration does not point to a listener that is absent after reboot. Follow
[Maintenance](../guides/maintenance.md#before-an-openwrt-firmware-upgrade).
