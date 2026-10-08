# Security and Access

[Documentation](../README.md)

JustClash crosses two separate security boundaries:

- the local Mihomo controller accepts commands and exposes connection metadata;
- remote providers receive download requests, headers, identifiers, and authorization data.

Controller passwords, TLS, firewall policy, and provider request headers solve different problems. A realistic-looking User-Agent is not authentication, TLS does not restrict who may connect, and a strong password does not make an exposed controller a good idea.

Protect the controller with:

1. a narrow network binding;
2. a strong generated API password;
3. OpenWrt firewall restrictions;
4. TLS whenever the browser reaches LuCI over HTTPS.

## API Password After Installation

A fresh installation replaces the packaged placeholder or a known legacy default
with a generated API password. The shared generator reads 24 random bytes from
`/dev/urandom` and Base64-encodes them into 32 characters. It checks the pipeline
result, output length, and character set before accepting the value.

An existing non-default password is preserved during a normal package upgrade.
Running `config reset` creates new, independently generated API and Mixed Port
passwords together with the restored default configuration.

The generated password is not printed during installation. To use an external dashboard or another API client, set a password that the client can store securely under **Services → JustClash → Setup: Proxy → Controller/API settings**.

### Rotate the Password from SSH

Generate the value on the router instead of placing a literal password in shell history:

```sh
API_SECRET="$(tr -d '-' </proc/sys/kernel/random/uuid 2>/dev/null)"

if [ "${#API_SECRET}" -lt 32 ]; then
	echo 'Failed to obtain a sufficiently long random value' >&2
	unset API_SECRET
	exit 1
fi

uci set justclash.proxy.api_password="$API_SECRET"
uci commit justclash
unset API_SECRET
service justclash restart
```

Do not print the variable, paste the resulting secret into diagnostics, or include `/etc/config/justclash` in a public bug report. The configuration and its backups can contain the controller password and provider credentials.

Rotate the password after suspected disclosure, before exposing the controller to another trusted network, and after restoring a configuration whose handling history is uncertain. Every dashboard or API client using the old value must then be updated.

## Mixed Port Authentication

Mixed Port uses `proxy_authentication`, independently of the controller's
`api_password`. It requires its own credentials and firewall restrictions;
authentication does not encrypt HTTP/SOCKS traffic. Follow
[Mixed Port](mixed-port.md#authentication-format) for credential handling,
client setup, and listener security.

## Download User-Agents

JustClash can set a global User-Agent for downloads and a separate override for each proxy provider:

- **Setup: Proxy → Basic settings → User-Agent for downloads** controls `global_ua` for external downloads such as subscriptions and rule lists.
- **Setup: Routing → Proxy providers → Security → User agent header** controls `header_user_agent` for one provider. An empty provider value inherits the global behavior.

The fields accept a literal User-Agent or one of these special values:

| Value | Generated header | Use it when |
| --- | --- | --- |
| `__random__` | One entry selected from the bundled browser User-Agent list | An endpoint accepts ordinary browser clients but rejects an unfamiliar downloader identity |
| `__justclash__` | `JustClash/<installed-version>` | The server should identify requests from this package in its logs |
| `__mihomo__` | `Mihomo/<core-version>` | The provider expects or records a Mihomo client identity; this is the per-provider default |
| Literal text | The exact configured value | The provider documents a required User-Agent |

`__random__` is resolved when JustClash generates the Mihomo configuration and
written as a normal header value. It changes on regeneration, rather than on
every request. A restart that reuses the [cached YAML](../concepts/configuration-lifecycle.md#generated-yaml-cache)
keeps the selected value.

### Why User-Agent Selection Exists

Some download endpoints use User-Agent checks for compatibility, traffic classification, support diagnostics, or crude client allowlists. Choosing the expected value can make an otherwise valid provider or ruleset download succeed.

It is not an anonymity feature and does not hide the router address, subscription URL, authorization header, hardware identifier, or request timing. `__random__` also does not grant access to a protected resource. Prefer `__justclash__`, `__mihomo__`, or a provider-documented literal when stable server-side logging and allowlists matter.

Do not place credentials in a User-Agent. LuCI rejects CR/LF characters to prevent additional HTTP headers from being injected through this field.

## Controller Binding

`controller_bind_interface` is an OpenWrt network name, not a device name. JustClash resolves its current address and uses it for the controller listener. The special value `-` intentionally listens on all IPv4 interfaces.

```sh
uci set justclash.proxy.controller_bind_interface='<TRUSTED_NETWORK>'
uci set justclash.proxy.api_password='<STRONG_API_PASSWORD>'
uci commit justclash
service justclash restart
```

> [!WARNING]
> The special value `-` exposes the controller listener on all IPv4 interfaces. Invalid network names and networks without a usable address abort startup. Treat firewall restrictions as mandatory when using `-`.

Never expose the controller directly to WAN.

## Configure TLS and Check Access

If LuCI is served over HTTPS, its live controller connection must also use
trusted HTTPS/WSS. Follow [Controller TLS](controller-tls.md) for certificate
formats, setup, reverse proxies, and browser trust. Passwords, binding, firewall
policy, and TLS remain separate controls.

After applying access changes, check Status and a live page from a trusted
client. Confirm that untrusted networks cannot reach the controller. If live
pages cannot connect, use [LuCI troubleshooting](../troubleshooting/luci.md).
