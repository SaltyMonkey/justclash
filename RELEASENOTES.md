## [0.2.5] - 30092025

- Install-script: Only stable core download
- Install-script: Rename
- Install-script: Refactor and bugfixes
- Install-script: Added `--force-space` flag
- Workflow: Refactor GitHub workflow with matrix mode
- Service: Optimized config file hash (hash only for mihomo config related sections)
- Service: Added Mieru simple URL support
- Service: Big refactor for file structure
- Service: Big refactor for code structure
- Service: Added migration support
- Service: Updated generated YAML structure (removed options: tracing, use-hosts)
- Service: Better input data cleanup and sanitization
- Service: Minor netfilter tables optimization
- Service: Updated default ruleset lists
- Service: Fixed MIPS arch detection for mihomo download
- Service: Fixed amd64/default arch detection for mihomo download (amd64-v3 now)
- Service: Fixed cron functions logic
- Service: Optimized logging functions
- Service: Removed unused `info_conns_console` functions
- Service: Optimized `apk` check calls in main script
- Service: Optimized `apk` check calls in info script
- Service: Added mixed-port support
- Service: Added simple custom routing for mixed-port
- Service: Added basic sniffer options customization
- Service: Added max_failed_times support
- Service: Added URL decoding for `alph` part in URL
- Service: Added support for `encryption` part in URL
- Service: Added skip_environment_checks logic
- Service: Removed connection tab
- Service: Update mihomo download logic with GitHub API usage
- Service: Removed multi-channel download for mihomo
- Service: Added zashboard support
- Service: Added zashboard optional logic
- Service: Added HWID support for proxy-providers
- Service: Added `SAFE_PATHS` logic support
- Service: Fixed `SAFE_PATHS` usage for custom local rule-set with CIDR
- Service: Fixed local rule-set list configuration
- Service: Fixed custom rule-set with CIDR configuration
- Service: Added custom behavior for NTP/DoT/DoQ/QUIC traffic
- InitD: Minor refactor
- InitD: Fixed incorrect delayed boot
- UCI: Updated default DNS in config
- UCI: Updated `ignore_fake_ip_domains` with "+.cudy.net"
- UCI: Added new options
- UCI: Update default keep alive options
- LuCI: Translation rework
- LuCI: Added sniffer tab
- LuCI: Minor changes in widget positions
- LuCI: Fixed optional field for some widgets
- LuCI: Added widgets for new features
- Makefile: Minor changes

**This version requires:**
- UCI config must be reset
- Browser cache must be cleaned up

## [0.1.0] - 29082025

- Service: nf tables optimization
- Service: Fix non working tproxy_input_interfaces option
- Service: Refactor UCI settings options naming
- Service: Refactor code
- Service: Optimize delays for start/restart (speedup load process)
- Service: Optimize internal checks in code
- Service: Added tproxy_excluded_ip for nf tables reject
- Service: Fix block_rule_section_handler
- Service: Added skip for config.yaml rebuild if possible
- Service: Improve diagnostic function with more data being shown
- Service: Fix broken fakeip dns server check in diagnostic
- Service: Fix broken service autostart check in diagnostic
- Service: Added warnings for incorrect custom cidr/domain lists parsers
- LuCI: Update form elements for refactored UCI options
- LuCI: Simplification for Status page code
- LuCI: Better visuals for Status page start button

This version requires:
- UCI config must be reset

## [0.0.89] - 18082025

- LuCI: Fix typo

This version requires:
- Browser cache must be cleaned up

## [0.0.88] - 18082025

- Service: Optimize greps
- Service: Refacting
- Service: Update diagnostic
- Service: Fix rulesets handling in proxies
- Service: Added custom logic for delayed vstart
- Service: Added custom fake-ip logic
- Service: Remove unused code
- Init.d: Fix restart logic
- Init.d: Added autoreload with UCI config update
- LuCI: Added back restart button
- LuCI: Minor dropdown height change
- LuCI: Added fake ip mode controls
- LuCI: Added delayed boot controls

This version requires:
- Browser cache must be cleaned up
- UCI config must be reset

## [0.0.73] - 16082025

- Service: Optimize reading from persistent storage
- Service: Added custom resourcs handlers (support https/http links and local files, only MRS)
- Install: Added banip in conflicts
- Install: Added banip in removable options
- LuCI: Changed validation for Object proxy mode
- LuCI: Added custom resource fields for direct section (only MRS)
- LuCI: Added custom resource fields for proxy groups sections (only MRS)
- LuCI: Added custom resource fields for proxies sections (only MRS)
- LuCI: Fixed dropdown height for FINAL match
- LuCI: Changed tabbing position for direct rules
- LuCI: Top level tabs translation
- LuCI: Updated predefined fingerprints list
- UCI: Changed default keep alive values

This version requires:
- Browser cache must be cleaned up
- UCI config must be reset

## [0.0.68] - 13082025

- Service: Logic implementation for block NTP
- Service: Fix for DoQ block option
- Service: Optimize reading from persistent storage
- Service: Refactoring
- LuCI: Added predefined values to final_destination as list
- LuCI: Added RULE-SETS to DIRECT rules
- LuCI: change visual forms for some values
- UCI: Block DoQ and QUIC by default
- UCI: Update default config

This version requires:
- Browser cache must be cleaned up
- UCI config must be reset

## [0.0.65] - 08082025

- Config: Default DNS settings update
- Service: Dns-failsafe-proxy added in conflicts
- Service: Updated default rulesets
- Service: Added `dns-cache-max-size` for mihomo
- LuCI: Translation update

## [0.0.64] - 29072025

- New feature: keep downloaded RULE-SETs at NAND optionally
- Bugfix: Incorrect rules generation if no RULE-SET was selected

## [0.0.62] - 29072025

- LuCI: Reworked Logs tab with new features
- LuCI: Doubled logs required with button in Logs tab
- Fix core updater for new changes in Mihomo repository
- LuCI: Logs page translation

## [0.0.61] - 28072025

- Fixed incorrect boot

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
