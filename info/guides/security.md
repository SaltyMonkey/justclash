# Security and Access

[Documentation](../README.md)

JustClash crosses four separate security boundaries:

- the local Mihomo controller accepts commands and exposes connection metadata;
- an enabled inbound lets clients send traffic through the router and its configured outbounds;
- remote providers receive download requests, headers, identifiers, and authorization data;
- downloaded software, dashboards, and routing data run on or influence the router and its administration clients.

Controller and inbound credentials, TLS, firewall policy, and provider request headers solve different problems. A realistic-looking User-Agent is not authentication, TLS does not restrict who may connect, and strong credentials do not make an exposed listener a good idea.

Protect both the controller and enabled inbounds with:

1. a trusted controller binding through `controller_bind_interface`; inbounds use wildcard listening on all interfaces;
2. separate credentials: `api_password` and each inbound's `authentication` list;
3. OpenWrt firewall restrictions for each listener, covering IPv4 and IPv6 where supported.

A bind address selects where the listener accepts connections; firewall rules restrict which clients may reach it. Configure controller TLS whenever the browser reaches LuCI over HTTPS. HTTP/SOCKS transport protection is covered under [Inbound Authentication](#inbound-authentication).

## Controller and Proxy Access

The controller is Mihomo's management API. Its password authorizes reading
connection metadata and logs, selecting group members, changing runtime settings,
and closing connections. LuCI's live pages connect directly from the browser to
this API. An external dashboard or API client can use it without a LuCI session,
so the controller needs its own authentication even when LuCI requires a login.

Inbounds also have authentication: each listener requires its own `user:pass`
accounts. These accounts authorize proxy use; they do not grant controller API
access. Conversely, the API password is not an inbound account. Use distinct
credentials so granting someone proxy access does not give them management
access. Binding a listener and choosing an outbound are separate from checking
who may connect.

### Defaults on a Fresh Installation

These are package defaults, not a description of an existing router's firewall
or saved configuration. Network services are available only while running and
where firewall policy permits access.

| Component | Default configuration | Authentication |
| --- | --- | --- |
| JustClash LuCI pages | Available through the router's installed LuCI service | OpenWrt/LuCI login and application permissions |
| Mihomo controller | Active while Mihomo runs; TCP port `9090` on the selected `lan` address, preferring IPv4 and falling back to IPv6 | An independently generated `api_password` |
| Additional web dashboard | Disabled (`use_dashboard=0`); disabling it does not disable the controller API or LuCI's live pages | Uses the controller's API password for API access |
| HTTP/SOCKS inbounds | None configured; create and enable rows explicitly | Configure at least one account per inbound; no proxy accounts are generated automatically |

Controller TLS is disabled by default (`api_tls=0`), so its API uses HTTP rather
than an encrypted connection. Keep access within a trusted network or protected
tunnel, and configure [controller TLS](controller-tls.md) for HTTPS/WSS access.
Binding to the `lan` address selects a destination address; it does not enforce a
source-network allowlist. Restrict allowed clients through the firewall.

Built-in TProxy listeners serve transparent interception and bind to loopback.
They use the interception rules to select client traffic and do not use
HTTP/SOCKS inbound accounts. They are separate from the explicit proxy listeners
created under **Setup: Inbounds**.

## External Resources and HTTPS

JustClash and Mihomo download external resources during installation and resource updates, and when configured providers refresh their data. These include installation packages, the Mihomo core, web dashboards, ruleset catalogs, routing and blocking lists, GeoIP/Geosite databases, and proxy subscriptions. Both bundled default sources and administrator-supplied sources are part of this trust boundary. Their content can change independently of a JustClash release.

> [!WARNING]
> External resources can contain malicious code, unsafe or incorrect routing data, or files that cause parsing and startup failures. Requiring HTTPS protects transport; it does not establish that the publisher or downloaded content is safe.

| Resource | Security concern |
| --- | --- |
| Installer, packages, and Mihomo core | Executable code runs with the privileges of the installer or service; a compromised source can compromise the router. |
| Web dashboard | Downloaded JavaScript runs in the administrator's browser and must be trusted with any controller credentials and data supplied to it. |
| Rulesets and GeoIP/Geosite databases | Their contents affect routing and blocking decisions. Incorrect or malicious data can send traffic along unintended paths, bypass intended policy, or disrupt service. |
| Proxy subscriptions | The provider supplies outbound destinations and receives download requests and configured headers. HTTPS does not make those destinations or the provider trustworthy. |

### Where HTTPS Is Enforced

- **Core updates:** the package updater and standalone installer require HTTPS for release metadata, archives, and checksums, and reject redirects to HTTP. Both verify SHA-256 and gzip before removing the installed core. See the [core update procedure](maintenance.md#core-update-procedure).
- **Ruleset catalogs:** configured download sources require HTTPS, and the package downloader rejects redirects to HTTP.
- **Dashboard and GeoIP/Geosite sources:** JustClash requires HTTPS in their source settings. Mihomo performs these downloads; JustClash's shell redirect restrictions do not apply to that downloader.
- **User-defined rulesets:** the LuCI editor requires HTTPS for remote routing and blocking lists and also accepts absolute local paths. This restriction is not enforced by the server-side catalog parser.

This is not a universal HTTPS requirement for every download. Proxy-provider fields still accept HTTP as well as HTTPS, and package installation has separate download and package-manager paths. Do not assume that every external resource uses the core updater's transport and verification policy.

### What the Checks Do Not Guarantee

HTTPS reduces the risk of interception and modification in transit when certificate verification succeeds. A compromised publisher, repository account, release process, or hosting service can still supply harmful content over a valid HTTPS connection.

The core's expected SHA-256 comes from the release API or the custom source's `checksums.txt`. A matching digest confirms that the archive matches that supplied value; it is not independent proof of publisher identity or code safety if the source is compromised. The core updater does not verify an independent publisher signature. The gzip check establishes archive integrity, not whether the extracted binary is trustworthy. These checks do not extend to every downloaded dashboard, subscription, or data file.

Review **Service → External resources**, provider sources, and user-defined ruleset sources before using or changing them. Use publishers you trust, including for the bundled defaults, and keep known-good copies for recovery. Local ruleset files avoid a remote fetch but still require trusted contents. Follow [Maintenance](maintenance.md) for update checks and backups; the project cannot guarantee the safety or availability of third-party resources.

## LuCI Access Assumption: Trusted Administrators

JustClash assumes that every user granted access to the application is a trusted administrator. A separate role for viewing controller data without management privileges is not provided.

The application's read ACL permits reading the entire `justclash` UCI package, including `api_password` and other sensitive settings. Live pages need that password to connect directly from the browser to the Mihomo controller. The same password also authorizes management requests, such as changing the core configuration and closing connections. LuCI's read/write ACL distinction applies to UCI and ubus operations; it does not restrict direct requests made with the controller password.

Grant JustClash access only to trusted administrators. Assigning only the application's read ACL does not create a safe view-only account. This is an accepted limitation of the administrator-only access model. If view-only users are needed, the access model must first be changed to keep the controller password and other secrets on the server and authorize viewing and management separately.

Revoking a LuCI session does not revoke a controller password already obtained by the user. When withdrawing an administrator's controller access, rotate the API password as well.

## API Password After Installation

A fresh installation generates an API password with `openssl rand -base64 24`.
It contains 24 random bytes encoded as 32 Base64 characters. The command result,
output length, and character set are checked before accepting it.

An existing non-default password is preserved during a normal package upgrade.
Running `config reset` generates a new API password and restores the default
configuration, which has no inbounds.

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

## Inbound Authentication

### Inbound Listening and Firewall

Wildcard listening is deliberate. Inbounds are explicit HTTP/SOCKS proxy entry
points for applications on the router and on trusted LAN or VPN networks. A
client connects to a router address reachable from its network; the same inbound
port, credentials, and route apply across those addresses. This avoids tying the
listener to one network address or requiring a separate inbound for each network.

Each inbound uses `listen: 0.0.0.0`, covering all router IPv4 addresses, including
loopback, LAN, VPN, and WAN addresses where present. Newly added addresses are
covered too. On systems supporting dual stack, Mihomo's Go listener can also
accept IPv6; disabling JustClash IPv6 interception does not guarantee an
IPv4-only inbound. Wildcard binding makes firewall policy the access boundary.

- Allow the inbound port only from intended source zones or clients. Connections
  terminate on the router, so use its firewall **input** policy; rules controlling
  forwarding between networks do not by themselves restrict this listener.
- Review both IPv4 and IPv6 access, including WAN and guest networks. Do not rely
  on NAT or an IPv4-only check to protect IPv6. Include UDP when using the UDP
  functionality of Mixed Port or SOCKS.
- **Client traffic interfaces**, interception exclusions, and **Create nftables**
  do not control inbound access. JustClash does not create inbound access rules;
  existing OpenWrt zone policies can already allow connections.

Before enabling an inbound, review these rules. Test access from an allowed
network and rejection from an excluded network, for each available address
family. Review access again when adding an interface or changing firewall zones.

### Credentials and Proxy Access

Configure each listener and its own **Authentication** entries under **Setup: Inbounds**.
An empty authentication list or invalid entry causes the entire inbound to be
skipped with a warning in the service log. Local applications also need
credentials. The controller's API password is independent of these users.

Authentication does not encrypt the client-to-proxy connection or its credential
exchange. Requesting an HTTPS website does not encrypt the initial HTTP CONNECT
or SOCKS authentication exchange. Controller TLS settings apply to the API only.
Use inbounds on trusted networks or through a protected tunnel such as a VPN;
credentials alone are insufficient protection for public exposure.

Give proxy access only to trusted users. An authenticated client can request
destinations reachable through the selected route, potentially including router
services and private networks. Proxy authentication does not isolate those
destinations, and forwarding restrictions on the client's network are not a
substitute for controlling connections made by the proxy.

Follow [Inbounds](inbounds.md#authentication-format) for the credential format,
routing choices, and client configuration.

## Download User-Agents

JustClash can set a global User-Agent for downloads and a separate override for each proxy provider:

- **Setup: Proxy → Basic settings → User-Agent for downloads** controls `global_ua` for external downloads such as subscriptions and rule lists. Missing or empty values default to `__random__`.
- **Setup: Routing → Proxy providers → Security → User agent header** controls `header_user_agent` for one provider. Missing or empty values use the Mihomo preset (`Mihomo/<core-version>`).

The fields accept a literal User-Agent or one of these special values:

| Value | Generated header | Use it when |
| --- | --- | --- |
| `__random__` | One entry selected from the bundled browser User-Agent list | An endpoint accepts ordinary browser clients but rejects an unfamiliar downloader identity |
| `__justclash__` | `JustClash/<installed-version>` | The server should identify requests from this package in its logs |
| `__mihomo__` | `Mihomo/<core-version>` | The provider expects or records a Mihomo client identity |
| Literal text | The exact configured value | The provider documents a required User-Agent |

New providers in LuCI default to `__mihomo__`. Random browser identities come
from a bundled desktop User-Agent snapshot, updated with the package; choosing
`__random__` does not download a list at runtime.

`__random__` is resolved when JustClash generates the Mihomo configuration and
written as a normal header value. It is selected again on regeneration, rather
than on every request. A restart that reuses the [cached YAML](../concepts/configuration-lifecycle.md#generated-yaml-cache)
keeps the selected value.

### Why User-Agent Selection Exists

Some download endpoints use User-Agent checks for compatibility, traffic classification, support diagnostics, or crude client allowlists. Choosing the expected value can make an otherwise valid provider or ruleset download succeed.

It is not an anonymity feature and does not hide the router address, subscription URL, authorization header, hardware identifier, or request timing. `__random__` also does not grant access to a protected resource. Prefer `__justclash__`, `__mihomo__`, or a provider-documented literal when stable server-side logging and allowlists matter.

Do not place credentials in a User-Agent. LuCI rejects CR/LF characters to prevent additional HTTP headers from being injected through this field.

## Controller Binding

`controller_bind_interface` is an OpenWrt network name, not a device name. JustClash tries its first IPv4 address, then falls back to IPv6. IPv6 controller endpoints use `[address]:<port>` syntax. The special value `-` skips address lookup and generates `:<port>` with an empty host. Mihomo then uses wildcard listening, which can include IPv6 depending on the system.

```sh
uci set justclash.proxy.controller_bind_interface='<TRUSTED_NETWORK>'
uci set justclash.proxy.api_password='<STRONG_API_PASSWORD>'
uci commit justclash
service justclash restart
```

> [!WARNING]
> The special value `-` uses wildcard listening. Apply firewall restrictions for both IPv4 and IPv6 where supported. Invalid network names and networks without a usable IPv4 or IPv6 address abort startup.

Never expose the controller directly to WAN.

## Configure TLS and Check Access

If LuCI is served over HTTPS, its live controller connection must also use
trusted HTTPS/WSS. Follow [Controller TLS](controller-tls.md) for certificate
formats, setup, reverse proxies, and browser trust. Passwords, binding, firewall
policy, and TLS remain separate controls.

After applying access changes, check Status and a live page from a trusted
client. Confirm that untrusted networks cannot reach the controller. If live
pages cannot connect, use [LuCI troubleshooting](../troubleshooting/luci.md).
