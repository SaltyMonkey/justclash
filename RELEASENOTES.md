## [0.0.6] - 27072025

- Locked back `Relay group type` until next release - some changes required
- Added `NextDNS` to conflicts
- Updated default ruleset lists
- Added `boot delay` functionality (8 sec delay before service start after route boot)
- Generating more valid proxy-groups in config file (without unused fields)
- Added `tolerance` field for `url-test proxy group`
- LuCI: Added `global-ua` and `etag-support` fields for user change
- LuCI: Rearrange top tabs in service: will be `status -> conns -> logs -> etc` for better UX
- LuCI: Translated a lot resources for RU language
- Minor changes

This version requires:
- Browser cache must be cleaned up
- UCI config file required new field `delayed_boot ` to be set
```
config main 'settings'
    option delayed_boot '0'
```
You must reset config file or to add option manually

## [0.0.52] - 24072025

- Unlocked url-test groups
- Unlocked relay groups
- Better dropdown at routing page
- Updated default ruleset lists

## [0.0.5] - 23072025

- Mihomo binary will not be removed with main package
- Sync default uci configs
- Moved proxy links URI parse to ASH
- Added json object view for proxy field (untested)
- Moved to jq and coreutils-base64 when required
- Dynamic ruleset lists with rules
- Added more inbuild ruleset lists
- Fixed config reset action
- Fixed incorrect filepaths linked to /var
- Removed initd interface watch trigger to do service restart
- LuCI: Added warning dialog before config reset start
- LuCI: Added missed horizontal scrollbar for logs page
- LuCI: removed bloated logic for settings save
- LuCI: Removed hardcoded rulesets lists
- LuCI: Added RuleSets update button
- LuCI: Tabbed view for routing items

## [0.0.3] - 17072025

- LuCI: Added proxy-providers
- LuCi: Log page slight change
- LuCi: FakeIP readonly
- LuCi: Translation fix
- Service: Update stable core update
- Rule-Set: Optimize list
- Rule-Set: Do not merge in JustDomains list all parsed services

## [0.0.2] - 16072025

- LuCI: Fix connections page
- Justclash: Fix reports function
- RuleSets: Fix no-russia-hosts

## [0.0.1] - 15072025

First JustClash alpha released!
Bunch of features included as:

- Multi proxies support
- Proxy-group support
- Ready to use mrs RULE-SETs
- Easy to use config generation for Mihomo core
- Mihomo Auto update
- User Friendly UI
and etc

### Known issues

- Installer: automatically install RU language for LuCi interface
- Installer: automatically install Mihomo alpha only
- LuCi: Validation is missing for some fields in Routing tab
- LuCI: Missing proxy-providers feature
- LuCi: Main pages (first-level) can't be translated (owrt "feature")
- LuCI: Service must be restarted manually after settings change

### Caveats:

- Every router reboot FakeIP cache will be cleaned
- Every route reboot RULE-SETs will be downloaded again
- All unsaved changes will be lost when switching top level pages unless the "Save" or "Apply" button is pressed.
