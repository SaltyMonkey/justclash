# Mixed Port Configuration and Custom Routing Nuances

This guide explains how to configure and use the local Mixed Port (local transport listener) in the service, including the custom routing behavior options.

---

## 1. Overview of the Mixed Port

JustClash can open a local port that supports multiple inbound transport protocols simultaneously. This is called the **Mixed Port** (default port: `7892`).

Unlike the default interceptor (which transparently redirects client packets at the firewall level), the Mixed Port is a **local listener**. Clients must be manually configured to use the router's IP and the mixed port (e.g., in a browser's network settings, terminal export variables, or application configurations).

### Configuration Options (UCI)
* **`use_mixed_port`**: Set to `1` to enable the mixed port listener.
* **`mixed_port`**: The port number on which the listener runs (default: `7892`).
* **`proxy_authentication`**: Optional list of username/password pairs for access control (e.g. `user:pass`).

* **Via LuCI Web Interface**:
  Go to *Services -> JustClash -> Proxy Tab*.
  * Enable **Use mixed port** and specify the **Mixed port** number (e.g., `7892`).
  * Add access credentials to the **Proxy authentication** list if needed.

* **Via Console (UCI)**:
  ```bash
  uci set justclash.proxy.use_mixed_port='1'
  uci set justclash.proxy.mixed_port='7892'
  uci add_list justclash.proxy.proxy_authentication='admin:my_secret_pass'
  uci commit justclash
  service justclash restart
  ```

---

## 2. Client-Side Usage Examples

Once enabled, LAN clients can direct their traffic through the mixed port manually:

* **Web Browsers (e.g. Firefox)**:
  Configure browser connection settings:
  - **Manual Gateway Host**: Router IP (e.g., `192.168.1.1`), Port: `7892` (using standard local listener).
  - **HTTP Outbound**: Router IP, Port: `7892`.
* **Terminal Outbound Environment (Linux/macOS)**:
  ```bash
  export http_proxy="http://admin:my_secret_pass@192.168.1.1:7892"
  export https_proxy="http://admin:my_secret_pass@192.168.1.1:7892"
  ```

---

## 3. Custom Behavior Nuance (`mixed_port_rules`)

A critical feature of JustClash is the ability to customize how traffic entering via the mixed port is processed. This is configured via the `exit_rule` option in the `mixed_port_rules` section.

```ini
config mixed_port_rules 'mixed_port_rules'
    option exit_rule 'BY RULES'
```

### Mode A: `BY RULES` (Default)
When `exit_rule` is set to `BY RULES`, JustClash does not generate any special routing overrides for the mixed port.
* **Behavior**: Any connection arriving through the local mixed port listener is evaluated against the standard core routing rules (including domain blocklists, rulesets, geo-IP, and final match rules) just like standard transparently intercepted traffic.

### Mode B: Outbound Override (e.g., `DIRECT` or a specific group name)
If you set `exit_rule` to a specific outbound gateway or outbound group (for example, `DIRECT` or `group1`), JustClash prepends a high-priority matching rule to the top of the core rules table:
```yaml
rules:
  - IN-TYPE,SOCKS/HTTP,DIRECT
```

* **Behavior**: Since rules are processed sequentially, this top-level rule instantly matches all connections arriving via the local mixed port listener.
* **The Nuance**: This traffic **completely bypasses** all subsequent domain blocklists, direct rulesets, geo-IP rules, and final match configurations. It is forwarded immediately to the specified destination (e.g. routed directly to the WAN if set to `DIRECT`, or sent through a specific tunnel group).

#### Configuration Example (Force Mixed Port to go DIRECT):
* **Via LuCI Web Interface**:
  Go to *Services -> JustClash -> Routing Tab*. Under **Mixed Port Rules**, set the **Exit rule** to your desired outbound (e.g., `DIRECT` or a proxy group).

* **Via Console (UCI)**:
```bash
uci set justclash.mixed_port_rules.exit_rule='DIRECT'
uci commit justclash
service justclash restart
```
This forces all browser traffic on port 7892 to go `DIRECT`, bypassing core rules entirely.

---
