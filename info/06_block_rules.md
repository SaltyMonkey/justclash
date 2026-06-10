# Block Rules (Unwanted Domains and IP/CIDR)

The service includes a fully integrated, automated system for blocking unwanted domains and network addresses. You do not need to manually configure raw rule providers or external packages like `adblock` or `dnsmasq-full`. 

The core routing engine handles this natively via its built-in block catalogs and the dedicated `block_rules` configuration section.

---

## 1. Built-in and User-Defined Block Catalogs

The service ships with a comprehensive catalog of popular, community-maintained blocklists (such as **Hagezi**, **OISD**, and various category-specific blocking lists). 

You can view the available pre-configured blocklists, as well as define your own **User-Defined RuleSets**, directly from the web interface.

* **Via LuCI Web Interface**:
  Navigate to *Services -> JustClash -> RuleSets Tab*. Here you can browse all built-in catalogs and add any custom rule provider URLs via the User-Defined section.

---

## 2. Enabling Blocklists (Rule Providers)

To enable blocking, simply reference the identifiers from the catalog in the `block_rules` UCI section. The service will automatically generate the rule providers, download the lists, and configure the necessary `REJECT` routing rules and DNS exclusions.

### Configuration

* **Via Console (UCI)**:
  ```bash
  # 1. Enable the block rules section
  uci set justclash.block_rules=block_rules
  uci set justclash.block_rules.enabled='1'
  
  # 2. Add desired blocklists from the catalog (using their identifiers)
  uci add_list justclash.block_rules.enabled_blocklist='hagezi-light-ads'
  uci add_list justclash.block_rules.enabled_blocklist='oisd-small'
  uci add_list justclash.block_rules.enabled_blocklist='yandex-ads'
  
  # 3. (Optional) Customize the update interval (in seconds)
  uci set justclash.block_rules.list_update_interval='43200'
  
  # 4. Ensure the target action is set to REJECT
  uci set justclash.block_rules.proxy='REJECT'
  
  uci commit justclash
  service justclash restart
  ```

* **Via LuCI Web Interface**:
  Go to *Services -> JustClash -> Routing Tab -> Block Rules*. Enable the section and select your desired blocklists from the dropdown menu.

---

## 3. Manual Domain and IP Blocking

If you need to block specific domains or IP addresses manually (e.g., blocking a specific analytics server), you can add them directly to the `block_rules` section without needing to create a separate file.

* **Via Console (UCI)**:
  ```bash
  # Block a specific domain and its subdomains
  uci add_list justclash.block_rules.additional_domain_blockroute='telemetry.example.com'
  
  # Block a specific IP or CIDR subnet
  uci add_list justclash.block_rules.additional_destip_blockroute='198.51.100.50/32'
  
  uci commit justclash
  service justclash restart
  ```

* **Via LuCI Web Interface**:
  In the *Block Rules* section, add your specific domains to the **Additional Domains** list and IPs to the **Additional Destination IPs** list.

---

## 4. How It Works Under the Hood

When you enable these settings, The service automatically:
1. Compiles the selected blocklists into Mihomo `rule-providers`.
2. **Domain-based Blocking (DNS Sinkhole)**: For domain blocklists and manual domain routes, JustClash **does not** generate standard routing rules. Instead, it injects them exclusively into the `nameserver-policy` directed to `rcode://success` (along with Fake-IP exclusions). This means the core routing engine acts as a DNS sinkhole, instantly dropping unwanted queries and returning an empty response before any actual network connection is even attempted, saving CPU cycles.
3. **IP-based Blocking (Routing REJECT)**: For IP-based blocklists and manual IP block routes, it generates `IP-CIDR` routing rules targeting the `REJECT` action. These are placed at the very top of your routing table so unwanted traffic is dropped immediately.

> **Note:** Because domain-based blocking is handled purely at the DNS level and IP-based blocking through top-level `REJECT` rules, unwanted traffic is stopped as efficiently as possible without wasting router resources.


