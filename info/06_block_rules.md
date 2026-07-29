# Block Rules

Block rules can stop domains through Mihomo DNS policy and stop address ranges through routing rules. Start with a small set of lists, verify the result, and add more only when the router has enough memory and the lists do not overlap unnecessarily.

## Enable Blocking in LuCI

1. Open **Services -> JustClash -> Routing**.
2. Find **Block rules**.
3. Enable the section.
4. Select one or more blocklist IDs.
5. Keep the action set to `REJECT` unless you intentionally route matches elsewhere.
6. Save & Apply.

Available built-in and user-defined IDs are managed on **RuleSets**. See [User-Defined RuleSets](05_user_defined_rulesets.md).

## Minimal UCI Configuration

```sh
uci set justclash.block_rules=block_rules
uci set justclash.block_rules.enabled='1'
uci set justclash.block_rules.proxy='REJECT'
uci add_list justclash.block_rules.enabled_blocklist='<BLOCKLIST_ID>'
uci commit justclash
service justclash restart
```

Remove a selected list with `uci del_list`, or use LuCI to avoid quoting mistakes.

## Manual Entries

Add a domain suffix:

```sh
uci add_list justclash.block_rules.additional_domain_blockroute='<DOMAIN_SUFFIX>'
```

Add an address or subnet:

```sh
uci add_list justclash.block_rules.additional_destip_blockroute='<ADDRESS_OR_CIDR>'
```

Then commit and restart:

```sh
uci commit justclash
service justclash restart
```

## How Matches Are Applied

### Domain Matches

Domain blocklists and manual domain entries are added to Mihomo DNS policy. Matching queries receive a successful empty response instead of a routable result. This avoids creating a connection only to reject it later.

This behavior depends on clients using the JustClash DNS path. A client using an external resolver or encrypted DNS directly may bypass domain-level DNS blocking.

### Address Matches

IP-CIDR blocklists and manual address entries produce high-priority reject rules. In partial mode, supported text IP-CIDR lists can also populate nftables sets so raw-address connections are intercepted before Mihomo evaluates the reject rule.

## Important Limitations

- A client excluded at the firewall does not reach Mihomo and is not protected by Mihomo block rules.
- Domain blocking does not control applications that bypass the configured DNS path.
- In partial mode, raw-address blocking requires an active address list that nftables can match.
- Very large or overlapping lists increase memory use and startup/update work.
- Fake-IP exclusions and custom nameserver policies can change which DNS rule sees a domain first.

## Verification

1. Check startup logs:

   ```sh
   justclash.sh logs 100
   ```

2. Confirm active rules in **Rules**.
3. Confirm active providers in **Nodes** or the dashboard.
4. Test a known entry from the selected list without publishing the domain or result in support logs.
5. For an IP-CIDR list in partial mode, run:

   ```sh
   justclash.sh diag_nft
   ```

If a domain is not blocked, first determine which resolver the client actually used. Adding three more lists before answering that question is a traditional but ineffective debugging technique.
