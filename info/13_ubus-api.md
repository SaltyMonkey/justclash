# ubus API Reference

The `justclash` package registers the `justclash` ubus object through an rpcd executable plugin. LuCI uses this API for service control, status, diagnostics, configuration display, logs, and updates, but the API is also available without `luci-app-justclash` installed.

Use the [Command-Line Reference](02_cli-commands.md) for interactive shell administration. The ubus API is intended for LuCI and other local RPC clients.

## Discover the API

```sh
ubus list justclash
ubus -v list justclash
```

The verbose form shows the accepted request fields and their types.

## Methods

| Method | Request | ACL class | Purpose |
| --- | --- | --- | --- |
| `status` | `{}` | Read | Return package and core versions plus service state |
| `check` | `{}` | Read | Generate the safe, redacted diagnostic summary |
| `config_show` | `{ "target": "mihomo" }` or `{ "target": "service" }` | Read | Return a configuration with credential fields redacted |
| `logs` | `{ "lines": 40 }` | Read | Return recent JustClash service log lines |
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
ubus call justclash status
```

Generate the safe diagnostic summary:

```sh
ubus call justclash check
```

Display a redacted configuration:

```sh
ubus call justclash config_show '{ "target": "mihomo" }'
ubus call justclash config_show '{ "target": "service" }'
```

Display an unredacted configuration only in a trusted local session:

```sh
ubus call justclash config_show_unsafe '{ "target": "mihomo" }'
```

Read recent service logs:

```sh
ubus call justclash logs '{ "lines": 40 }'
```

Run a service action:

```sh
ubus call justclash restart
```

Update built-in service data:

```sh
ubus call justclash resources_update '{ "target": "data" }'
```

Read the hardware identifier in a trusted local session:

```sh
ubus call justclash hardware_id
```

## Response Format

The `status` method returns:

```json
{
  "code": 0,
  "package_version": "VERSION",
  "core_version": "VERSION",
  "running": true,
  "enabled": true
}
```

Other methods return the application result in this form:

```json
{
  "code": 0,
  "stdout": "RESULT"
}
```

Clients must check the application-level `code` field. A successful ubus transport call does not by itself mean that the requested operation succeeded.

## Access Control

LuCI access is defined in `/usr/share/rpcd/acl.d/luci-app-justclash.json`:

- read access covers `status`, `check`, `config_show`, and `logs`;
- write access covers lifecycle actions, `hardware_id`, `config_show_unsafe`, and `resources_update`.

`hardware_id` does not modify the system, but it is deliberately placed in the write ACL class because it exposes a stable device identifier.

The `justclash` package installs the rpcd implementation as `/usr/libexec/rpcd/justclash`. The `luci-app-justclash` package supplies the LuCI session ACL and calls the API through the shared JavaScript wrapper in `api/ubus.js`; views should not declare duplicate RPC methods directly.

## Sensitive Output

`check` is the preferred method for information that may be shared. It intentionally omits configuration, addresses, domains, identifiers, and raw network state.

`config_show` redacts known credential fields but can still reveal endpoints, routing policy, and local topology. `logs` can contain addresses, domains, and connection details. Inspect their output before sharing it.

`hardware_id` can identify a device across requests. `config_show_unsafe` can expose passwords, tokens, authorization data, private URLs, and other secrets. Keep their output local and grant access to these methods only to trusted administrators.
