# Update, Backup, Restore, and Removal

[Documentation](../README.md)

JustClash packages, the Mihomo core, and downloaded service data have separate lifecycles. Updating one does not necessarily update the others.

## What Is Being Updated

| Component | Typical update path | Persistent state affected |
| --- | --- | --- |
| `justclash` and LuCI packages | Online installer or local APK/IPK files | Package migrations may update the UCI schema |
| Mihomo core | Installer `--update-core` or `justclash.sh resources core update` | Replaces the CPU-specific runtime binary |
| Rulesets and service data | LuCI actions, schedules, or `resources data update` | Refreshes downloaded catalogs; generated YAML is rebuilt on the next start or reload |
| User configuration | LuCI or UCI | Stored under `/etc/config/justclash` and selected files under `/etc/justclash/` |

The package version and Mihomo version are intentionally independent. A package update can preserve the current core, while the online automated installation updates the core to the current stable build before installing the selected JustClash release.

The standalone installer and fresh package configurations use the slim kernel version by default. Existing UCI repository choices survive package upgrades. In LuCI, **Service → External resources** offers slim and upstream Mihomo repository presets and still accepts any `username/repo` value.

The package core updater compares version strings. Changing repositories alone does not reinstall a core when the selected release reports the same version as the installed binary.

Core updates require HTTPS for version metadata, archives, checksums, and redirects. For GitHub sources, both the standalone installer and package updater verify the archive's SHA-256 against the digest supplied by the release API. An unavailable or invalid digest prevents installation.

Ruleset catalog, dashboard archive, and GeoIP/Geosite source URLs must also use HTTPS. Empty fields use the HTTPS defaults. Existing HTTP overrides must be replaced before startup or resource updates can pass configuration validation. Catalog downloads reject redirects to HTTP. Dashboard and geodata downloads are performed by Mihomo; JustClash validates their configured URLs but does not control the core's redirect handling.

For a custom core source, **Service → External resources → Custom core base URL** must use HTTPS. The server must provide `version.txt`, the `mihomo-linux-arch-version.gz` archives, and a shared `checksums.txt` file in `sha256sum` format: a 64-character hexadecimal SHA-256 hash followed by the archive filename. The updater selects exactly one entry matching the archive's full filename; an optional `./` prefix and the binary-mode `*` marker are supported. Missing, duplicate, or malformed entries prevent the update. Hash mismatches are rejected before extracting the archive.

### Core Update Procedure

The package updater and standalone installer use the same replacement order:

1. Obtain the version and expected checksum, then download the compressed archive to `/tmp`.
2. Verify the archive's SHA-256 and gzip integrity while keeping the installed core.
3. Remove the installed core, extract the verified archive directly to the core path, and delete the temporary archive.

A download, checksum, or gzip failure keeps the installed core. The archive requires space in `/tmp` while the installed binary still occupies its core path. With the core on flash, this means RAM for the compressed archive and flash space for one uncompressed binary; no second uncompressed binary is kept.

There is no fallback to early removal when temporary space is insufficient. There is no rollback after removal: an extraction or write failure can still leave no usable core. Fresh installations skip removal, and an already current version is left unchanged. The package updater also stops if configuration validation fails.

The replacement order is fixed. The LuCI mode selector and support for the UCI option `mihomo_core_update_mode` have been removed. An existing value is ignored.

## Switching the Web Dashboard

Open **Services → JustClash → Setup: Proxy → Controller/API settings** to select
MetaCubeXD, Zashboard, or YACD-meta. All three use `/etc/justclash/dashboard`.
Mihomo skips automatic dashboard downloads when that directory already contains
files, even if the selected panel or its download URL has changed.

If a panel has already been downloaded:

1. Manually remove all files and subdirectories inside `/etc/justclash/dashboard`.
2. Select the desired **Web dashboard** and use **Save & Apply**.
3. Restart JustClash, then reopen the dashboard and confirm the selected
   interface appears. The download requires working network access.

Changing the selection regenerates YAML on the next start/reload, but does not
replace existing dashboard files. The same manual cleanup is needed to download
an installed panel from a changed source URL.

## Generated Configuration After Updates

Package and catalog updates invalidate the generated configuration on the next
service start or reload. After a core-only update, startup still validates the
cached YAML with the new core before reuse. See [Generated YAML Cache](../concepts/configuration-lifecycle.md#generated-yaml-cache)
for the complete reuse conditions.

## Before an Update

1. Resolve or commit any pending LuCI changes.
2. Create a protected backup.
3. Record the installed package and core versions locally.
4. Download the release checksum file when installing packages manually.
5. Keep enough free space for both the downloaded assets and temporary extraction.

```sh
justclash.sh version package
justclash.sh version core
```

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

If the firmware upgrade begins while JustClash is still active, the preserved DHCP/dnsmasq configuration can continue pointing DNS at a local Mihomo listener that is no longer running during the transition or after the first boot. The router can retain network connectivity while name resolution fails.

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

Run the command for the required task. These examples require a shell with
process substitution support; see [Quick Start](../getting-started.md#online-installer)
for the file-based alternative. With that alternative, append the same options
to `sh /tmp/justclash-install.sh` after a successful download.

```sh
# Install or update to the latest release without prompts
sh <(wget -qO- 'https://raw.githubusercontent.com/saltymonkey/justclash/refs/heads/main/service.sh') --automated

# Install a specific package release
sh <(wget -qO- 'https://raw.githubusercontent.com/saltymonkey/justclash/refs/heads/main/service.sh') --automated --custom_version 0.98.0_rc1

# Download or update only the Mihomo core
sh <(wget -qO- 'https://raw.githubusercontent.com/saltymonkey/justclash/refs/heads/main/service.sh') --update-core
```

For interactive use, run without arguments as shown in
[Quick Start](../getting-started.md#online-installer). Replace `0.98.0_rc1` with the
required version: `X.Y.Z` or `X.Y.Z_rcN`, optionally with a leading `v`.
Combine the options below as needed.

| Parameter | Short form | Effect |
| --- | --- | --- |
| `--automated` | `--auto`, `-y` | Installs without the translation prompt |
| `--silent` | `-s` | Hides normal stdout; errors remain visible |
| `--custom_version VERSION` | — | Selects a specific JustClash package release |
| `--update-core` | `-u` | Downloads or updates the stable Mihomo core without installing JustClash release packages |
| `--skip-space-check` | — | Skips the installer free-space check |

`--custom_version` pins the `justclash` and LuCI packages only. The installer still selects the current stable Mihomo core for the detected CPU architecture. It detects APK or OPKG automatically; interactive installation also asks which LuCI translation to install.


## Update from Local Packages

Place only the packages for the router's package manager in one directory and verify them first.

The base package explicitly restarts JustClash when the package manager sets
`PKG_UPGRADE=1` on a running router, so the service applies the installed code and
recreates its runtime state. First installations use OpenWrt's standard start
hook; offline image builds skip the explicit restart. The stop/start below also
covers older packages without the restart hook.

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
justclash.sh version package
justclash.sh version core
justclash.sh check
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
justclash.sh check
```

Restoring a backup also restores its credentials. Rotate the API password and any provider credentials when the archive may have been copied, exposed, or stored without encryption.

## Reset Is Not Restore

`config reset` backs up the active UCI configuration and replaces it with package defaults. It also generates new API and Mixed Port passwords.

Use reset to recover from a broken configuration, not as an update or downgrade procedure. Follow the canonical command sequence in [Command-Line Reference → Reset Configuration](../reference/cli.md#reset-configuration). The generated backup can contain secrets and should remain local.

## Remove JustClash

### Online Installer Menu

Run the interactive command from [Quick Start → Online Installer](../getting-started.md#online-installer), then choose **Uninstall JustClash package**.

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
