# Managing User-Defined RuleSets in the service

The service allows you to add your own custom routing lists (RuleSets) via the LuCI web interface. For advanced users and automation, these lists can also be managed manually in the filesystem via SSH.

These custom catalogs can then be used in `block_rules` to drop traffic, or in `direct_rules` / `proxy_groups` to selectively route traffic.

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
* **Routing RuleSets (Proxies/Direct)**: `/etc/justclash/user.rulesets.txt`

### Format Syntax
Each list must be defined on a new line using the following pipe-separated (`|`) format:
`Name|ID|Type|Format|URL_or_Path[|Authorization]`

* **Name**: A human-readable display name (e.g., `My Custom Blocklist`).
* **ID**: A unique, alphanumeric internal identifier (e.g., `my-custom-list`). This is the ID you use in the `block_rules` or `direct_rules` UCI sections.
* **Type**: The behavior type. Use `domain` for domain-based lists or `ipcidr` for IP subnets.
* **Format**: The format of the source file. Currently, JustClash **only** supports the `mrs` (Mihomo rule-set) format.
* **URL_or_Path**: The `http://` / `https://` download link, or an absolute path to a local file on the router (e.g., `/etc/justclash/my_local_list.mrs`).
* **Authorization** *(Optional)*: An authorization header or Bearer token if the download URL requires authentication.

### Examples

**Example 1: Remote URL (Domain list)**
```text
# Name|ID|Type|mrs|URL_or_Path[|Authorization]
My Privacy List|my-privacy|domain|mrs|https://example.com/privacy.mrs
```

**Example 2: Local File (IP list)**
```text
# Name|ID|Type|mrs|URL_or_Path[|Authorization]
Local Drop IPs|local-drop|ipcidr|mrs|/etc/justclash/drop.mrs
```

**Example 3: Remote URL with Authorization**
```text
# Name|ID|Type|mrs|URL_or_Path[|Authorization]
Premium Tracker Block|premium-track|domain|mrs|https://example.com/premium.mrs|Bearer my_secret_token
```

### Applying Changes
After modifying the `.txt` files via CLI, the new `ID` will instantly be available to enable in your UCI configuration or LuCI interface. Note that to fully apply routing changes, you must save and apply settings in the Routing or Proxy tabs, or reload the service from the Status tab.
