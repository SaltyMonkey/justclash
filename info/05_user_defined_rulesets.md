# Managing User-Defined RuleSets in the service

The service allows you to add your own custom routing lists (RuleSets) via the LuCI web interface. For advanced users and automation, these lists can also be managed manually in the filesystem via SSH.

These custom catalogs can then be used in `block_rules` to drop traffic, or in `proxy_groups` to selectively route traffic.

---

## 1. Managing via LuCI Web Interface

The easiest way to add custom lists is through the router's web interface:

1. Navigate to **Services -> JustClash -> RuleSets Tab**.
2. Scroll to the **User-Defined** sections.
3. Click the add button to define your custom URL or path.
4. Save the changes. The new list will immediately become available in dropdowns throughout the JustClash interface (e.g., in the Block Rules or Routing tabs).

---

## 2. Advanced: Manually Editing via CLI

Advanced users can manually define custom catalogs directly in the filesystem via SSH. There are two files depending on the intended use:

### File Locations
* **Blocking RuleSets**: `/etc/justclash/user.block.rulesets.txt`
* **Routing RuleSets (Proxies/Bypasses)**: `/etc/justclash/user.rulesets.txt`

### Format Syntax
Each list must be defined on a new line using the following pipe-separated (`|`) format:
`Name|ID|Type|Format|URL_or_Path[|Authorization]`

* **Name**: A human-readable display name (e.g., `My Custom Blocklist`).
* **ID**: A unique, alphanumeric internal identifier (e.g., `my-custom-list`). This is the ID you use in the `block_rules` or `proxy_groups` UCI sections.
* **Type**: The behavior type. Use `domain` for domain-based lists or `ipcidr` for IP subnets.
* **Format**: The format of the source file. Use `mrs` for binary Mihomo rule-sets. For `ipcidr` rulesets, JustClash **only** supports `text` format (a plain text file containing one IP address or CIDR range per line).
  > [!NOTE]
  > The `text` format is **strictly limited to `ipcidr` rulesets** to allow direct parsing and injection into firewall `nftables` sets (the synchronizer cannot parse compiled binary `.mrs` files). Domain-based rulesets must continue to use `mrs` format.
* **URL_or_Path**: The `http://` / `https://` download link, or an absolute path to a local file on the router (e.g., `/etc/justclash/my_local_list.mrs`).
* **Authorization** *(Optional)*: An authorization header or Bearer token if the download URL requires authentication.

### Examples

**Example 1: Remote URL (Domain list)**
```text
# Name|ID|Type|Format|URL_or_Path[|Authorization]
My Privacy List|my-privacy|domain|mrs|https://example.com/privacy.mrs
```

**Example 2: Local File (IP list)**
```text
# Name|ID|Type|Format|URL_or_Path[|Authorization]
Local Drop IPs|local-drop|ipcidr|text|/etc/justclash/drop.list
```

**Example 3: Remote URL with Authorization**
```text
# Name|ID|Type|Format|URL_or_Path[|Authorization]
Premium Tracker Block|premium-track|domain|mrs|https://example.com/premium.mrs|Bearer my_secret_token
```

### Applying Changes
After modifying the `.txt` files via CLI, the new `ID` will instantly be available to enable in your UCI configuration or LuCI interface. Note that to fully apply routing changes, you must save and apply settings in the Routing or Proxy tabs, or reload the service from the Status tab.

---

## 3. Why Ruleset Downloading and Caching is Delegated to Mihomo
Instead of writing custom shell scripts with `curl` or `wget` to download and update rulesets, JustClash delegates the entire downloading, updating, and caching lifecycle of rulesets to the **Mihomo Core:**

* **Safety & Integrity Checks:** Mihomo validates the downloaded file format (`mrs` or `text`) before writing it to the cache directory. This prevents corrupted downloads from crashing the transparent proxy or breaking the firewall.
* **HTTP/ETag and Caching Optimizations:** Mihomo supports standard HTTP caching headers and ETag validation. If a remote ruleset has not changed, Mihomo will not download it again, saving WAN bandwidth and flash write cycles.
* **Robust Authentication & Headers:** Mihomo natively handles complex HTTP headers (including private token authorizations) securely, without leaking credentials in process lists (as `wget` command line arguments would).
* **Native Update Scheduling:** Mihomo runs a highly optimized scheduler that pulls updates in background threads without blocking main network routing threads or spawning shell subprocesses on low-powered routers.
