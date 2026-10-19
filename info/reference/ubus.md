# ubus API Reference

[Documentation](../README.md)

The `justclash` package registers the `justclash-core` ubus object through an rpcd executable plugin. LuCI uses this API for service control, status, diagnostics, configuration display, logs, and updates, but the API is also available without `luci-app-justclash` installed.

Use the [Command-Line Reference](cli.md) for interactive shell administration. The ubus API is intended for LuCI and other local RPC clients.

This rpcd API works while Mihomo is stopped. Live LuCI data uses the separate
Mihomo controller API; see [LuCI Page Availability](../troubleshooting/luci.md).

## Discover the API

```sh
ubus list justclash-core
ubus -v list justclash-core
```

The verbose form shows the accepted request fields and their types.

## Methods

| Method | Request | ACL class | Purpose |
| --- | --- | --- | --- |
| `status` | `{}` | Read | Return service running state and boot enablement |
| `versions` | `{}` | Read | Return the installed package and core versions |
| `check` | `{}` | Read | Generate the safe, redacted diagnostic summary |
| `config_show` | `{ "target": "mihomo" }` or `{ "target": "service" }` | Read | Return a configuration with credential fields redacted |
| `logs` | `{ "lines": 40 }` | Read | Return recent JustClash entries from the OpenWrt system log |
| `start` | `{}` | Write | Start the service |
| `stop` | `{}` | Write | Stop the service |
| `restart` | `{}` | Write | Restart the service |
| `enable` | `{}` | Write | Enable service startup at boot |
| `disable` | `{}` | Write | Disable service startup at boot |
| `hardware_id` | `{}` | Write | Return the generated hardware identifier |
| `config_show_unsafe` | `{ "target": "mihomo" }` or `{ "target": "service" }` | Write | Return an unredacted configuration |
| `resources_update` | `{ "target": "core" }` or `{ "target": "data" }` | Write | Update the selected resource |

The unsafe configuration method is intentionally separate from `config_show`. rpcd ACL rules authorize methods, not individual parameter values, so an `unsafe` boolean on the read method would allow read-only callers to request credentials.

## Examples

Read service status:

```sh
ubus call justclash-core status
```

Read package and core versions:

```sh
ubus call justclash-core versions
```

Generate the safe diagnostic summary:

```sh
ubus call justclash-core check
```

Display a redacted configuration:

```sh
ubus call justclash-core config_show '{ "target": "mihomo" }'
ubus call justclash-core config_show '{ "target": "service" }'
```

Display an unredacted configuration only in a trusted local session:

```sh
ubus call justclash-core config_show_unsafe '{ "target": "mihomo" }'
```

Read recent service logs:

```sh
ubus call justclash-core logs '{ "lines": 40 }'
```

Run a service action:

```sh
ubus call justclash-core restart
```

Update built-in service data:

```sh
ubus call justclash-core resources_update '{ "target": "data" }'
```

Read the hardware identifier in a trusted local session:

```sh
ubus call justclash-core hardware_id
```

## Response Format

The `status` method returns:

```json
{
  "code": 0,
  "running": true,
  "enabled": true
}
```

`running` and `enabled` are JSON booleans. This response contains only current
service state, so polling it does not run version commands.

The `versions` method returns:

```json
{
  "code": 0,
  "package_version": "PACKAGE_VERSION",
  "core_version": "CORE_VERSION"
}
```

The core version comes from the installed binary; Mihomo does not need to be
running. LuCI queries versions on page load and after a core update, separately
from periodic state polling.

Version fields were moved out of `status`. Clients that previously read
`package_version` or `core_version` from that response must call `versions`
instead. Update the JustClash and LuCI packages together and refresh LuCI.

All remaining methods return the application result in this form:

```json
{
  "code": 0,
  "stdout": "RESULT"
}
```

Clients must check the application-level `code` field. A successful ubus transport call does not by itself mean that the requested operation succeeded.

## Access Control

LuCI access is defined in `/usr/share/rpcd/acl.d/luci-app-justclash.json`.
The [method table](#methods) lists each method's ACL class.
Both `status` and `versions` are available through the read ACL.

`hardware_id` does not modify the system, but it is deliberately placed in the write ACL class because it exposes a stable device identifier.

The `justclash` package installs the rpcd implementation as `/usr/libexec/rpcd/justclash-core`. The separate name avoids a file-ownership collision with RPC helpers shipped by older `luci-app-justclash` packages. The current LuCI package supplies the session ACL and calls the API through the shared JavaScript wrapper in `api/ubus.js`; views should not declare duplicate RPC methods directly.

## Sensitive Output

`check` is the preferred method for information that may be shared. It intentionally omits configuration, addresses, domains, identifiers, and raw network state.

`config_show` redacts known credential fields but can still reveal endpoints, routing policy, and local topology. `logs` can contain addresses, domains, and connection details. Inspect their output before sharing it.

`hardware_id` can identify a device across requests. `config_show_unsafe` can expose passwords, tokens, authorization data, private URLs, and other secrets. Keep their output local and grant access to these methods only to trusted administrators.
