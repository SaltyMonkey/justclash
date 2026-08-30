# Update, Backup, Restore, and Removal

JustClash packages, the Mihomo core, and downloaded service data have separate lifecycles. Updating one does not necessarily update the others.

## What Is Being Updated

| Component | Typical update path | Persistent state affected |
| --- | --- | --- |
| `justclash` and LuCI packages | Online installer or local APK/IPK files | Package migrations may update the UCI schema |
| Mihomo core | Installer `--update-core` or `justclash.sh core_update` | Replaces the CPU-specific runtime binary |
| Rulesets and service data | LuCI actions, schedules, or `service_data_update` | Refreshes downloaded catalogs; generated YAML is rebuilt on the next start or reload |
| User configuration | LuCI or UCI | Stored under `/etc/config/justclash` and selected files under `/etc/justclash/` |

The package version and Mihomo version are intentionally independent. A package update can preserve the current core, while the online automated installation updates the core to the current stable build before installing the selected JustClash release.

## Generated Configuration After Updates

The generated Mihomo YAML is cached in the RAM-backed runtime directory. Its fingerprint includes the JustClash package version, relevant UCI settings, the resolved controller address, and the built-in and user ruleset catalog files. A changed package version or catalog therefore invalidates the old YAML on the next service start or reload instead of reusing output produced from older generator inputs.

Updating the Mihomo core alone does not change this fingerprint. Cached YAML is still validated by the installed core before reuse; a validation failure aborts startup rather than silently running an incompatible configuration.

## Before an Update

1. Resolve or commit any pending LuCI changes.
2. Create a protected backup.
3. Record the installed package and core versions locally.
4. Download the release checksum file when installing packages manually.
5. Keep enough free space for both the downloaded assets and temporary extraction.

```sh
justclash.sh version
justclash.sh core_info_mihomo
```

Do not publish this output together with configuration or diagnostics. Version output is harmless by itself, but nearby shell history and copied terminal output may not be.

## Create a Backup

The package declares these user-managed conffiles:

- `/etc/config/justclash`;
- `/etc/justclash/user.rulesets.txt`;
- `/etc/justclash/user.block.rulesets.txt`.

A broader backup of `/etc/justclash/` also captures custom catalogs and TLS files stored below that directory:

```sh
BACKUP_FILE="/tmp/justclash-backup-$(date +%Y%m%d-%H%M%S).tar.gz"

umask 077
tar -C / -czf "$BACKUP_FILE" \
	etc/config/justclash \
	etc/justclash
chmod 600 "$BACKUP_FILE"

printf 'Backup created: %s\n' "$BACKUP_FILE"
```

`/tmp` is RAM-backed and is erased on reboot. Copy the archive to protected storage before updating. If certificate or key paths point outside `/etc/justclash/`, back those files up separately.

> [!CAUTION]
> The archive can contain API passwords, provider credentials, private URLs, authorization headers, hardware identifiers, and TLS private keys. Do not attach it to an issue or store it in a public cloud link.

## Before an OpenWrt Firmware Upgrade

Always stop JustClash manually before starting `sysupgrade`, Attended Sysupgrade, or another OpenWrt firmware replacement:

```sh
service justclash stop
```

A clean stop removes the JustClash nftables state, restores the saved dnsmasq configuration, and restarts dnsmasq. Wait for that command to finish and confirm ordinary DNS resolution works before starting the firmware upgrade.

If the firmware upgrade begins while JustClash is still active, the preserved DHCP/dnsmasq configuration can continue pointing DNS at a local Mihomo listener that is no longer running during the transition or after the first boot. The result is a router that appears online while name resolution has quietly left the building.

After the new firmware boots, verify that the matching JustClash packages and Mihomo core are present and that native DNS works. Only then start JustClash again:

```sh
service justclash start
```

## Verify Manual Release Files

Download `SHA256SUMS` from the same release as the APK/IPK files. Verify every selected package before installation.

For one file:

```sh
PACKAGE_FILE='<EXACT_PACKAGE_FILENAME>'
CHECKSUM_LINE="$(grep -F "  $PACKAGE_FILE" SHA256SUMS)"

if [ -z "$CHECKSUM_LINE" ]; then
	echo 'Package is not listed in SHA256SUMS' >&2
	exit 1
fi

printf '%s\n' "$CHECKSUM_LINE" | sha256sum -c -
```

Repeat the check for the base package, LuCI application, and optional translation package. Do not install a file that is missing from `SHA256SUMS` or does not report `OK`.

## Update with the Online Installer

Use the canonical one-liners and parameter table in [Quick Start → Online Installer](00_quick_start.md#online-installer):

- automatic mode installs the latest JustClash release and stable Mihomo core;
- `--custom_version` selects an exact stable or `X.Y.Z_rcN` JustClash release but does not pin Mihomo;
- `--update-core` updates only the stable Mihomo core after preparing installer dependencies.

Keeping the executable examples in Quick Start prevents the installer invocation from drifting between two documents.

## Update from Local Packages

Place only the packages for the router's package manager in one directory and verify them first.

```sh
service justclash stop

# APK-based OpenWrt
apk add --allow-untrusted ./*.apk

# OPKG-based OpenWrt
opkg install --force-reinstall ./*.ipk

service justclash start
```

Run only the APK or OPKG command used by that router. Do not mix formats. Install the base package and LuCI application from the same JustClash release.

## Verify an Update

```sh
justclash.sh version
justclash.sh core_info_mihomo
justclash.sh diag_redacted
```

Then verify in LuCI:

1. the service starts;
2. the expected nodes and groups are present;
3. DNS and routing work for a permitted test destination;
4. scheduled jobs and provider refreshes still use the intended settings;
5. controller access still requires the configured API password.

## Downgrade and Rollback

Installing an older package is not a schema rollback. A newer release may have migrated configuration fields that an older release does not understand.

Safe order:

1. stop the service;
2. install the older package files or select their exact release with `--custom_version`;
3. inspect the current UCI schema before restoring anything;
4. restore the backup created before the upgrade when the schemas are compatible;
5. start the service and run redacted diagnostics.

The core updater does not provide a guaranteed automatic rollback copy. Keep the previous core binary outside the router, or in protected local storage when space permits, if an exact core rollback is required.

## Restore a Backup

Inspect the archive before extraction:

```sh
tar -tzf '/tmp/<BACKUP_FILE>.tar.gz'
```

Restore only a trusted archive:

```sh
service justclash stop
tar -C / -xzf '/tmp/<BACKUP_FILE>.tar.gz'
chmod 600 /etc/config/justclash
uci -q show justclash >/dev/null
service justclash start
justclash.sh diag_redacted
```

Restoring a backup also restores its credentials. Rotate the API password and any provider credentials when the archive may have been copied, exposed, or stored without encryption.

## Reset Is Not Restore

`config_reset` backs up the active UCI configuration and replaces it with package defaults. It also generates a new API password.

Use reset to recover from a broken configuration, not as an update or downgrade procedure. Follow the canonical command sequence in [Command-Line Reference → Reset Configuration](02_cli-commands.md#reset-configuration). The generated backup can contain secrets and should remain local.

## Remove JustClash

### Online Installer Menu

Run the interactive command from [Quick Start → Online Installer](00_quick_start.md#online-installer), then choose **Uninstall JustClash package**.

The installer removes the JustClash packages and the Mihomo core. Create a backup first; do not rely on package-manager conffile retention as the only copy.

### Manual Package Removal

Stop the service, remove any installed translation package first, then remove LuCI and the base package:

```sh
service justclash stop

# APK-based OpenWrt
apk del luci-app-justclash justclash

# OPKG-based OpenWrt
opkg remove luci-app-justclash justclash
```

Remove an installed `luci-i18n-justclash-*` package before these commands. Manual package removal does not intentionally delete the separately downloaded Mihomo binary:

```sh
rm -f /usr/bin/mihomo
```

Shared dependencies such as `curl` or `jq-full` are not removed automatically because other packages may use them.

### Full Configuration Purge

Only after a verified backup, remove the remaining configuration and state explicitly:

```sh
rm -f /etc/config/justclash
rm -rf /etc/justclash /tmp/justclash
```

This purge is destructive and removes custom ruleset catalogs and TLS material stored under `/etc/justclash/`. It cannot be undone without a backup.

## Final Checklist

- The selected package format matches the router.
- Every manually downloaded package passed SHA256 verification.
- JustClash was stopped and native DNS was restored before an OpenWrt firmware upgrade.
- The backup exists outside `/tmp` before reboot or removal.
- Package and core versions were verified separately.
- Restored credentials were rotated when archive confidentiality was uncertain.
- Full purge was used only when retained configuration was not wanted.
