include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-justclash
PKG_VERSION:=0.0.1
PKG_RELEASE:=1

LUCI_TITLE:=LuCI justclash app
LUCI_DEPENDS:=+luci-base +justclash
LUCI_PKGARCH:=all
LUCI_LANG.ru:=Русский (Russian)
LUCI_LANG.en:=English

PKG_MAINTAINER:=SaltyMonkey <https://github.com/SaltyMonkey>
PKG_LICENSE:=GPL-2.0-or-later

LUCI_LANGUAGES:=en ru

define Package/$(PKG_NAME)/postinst
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ]; then
	rm -f /tmp/luci-index*
	rm -rf /tmp/luci-modulecache/
	/etc/init.d/rpcd reload
	[ -f "/sbin/luci-reload" ] && /sbin/luci-reload
	[ -f "/etc/init.d/uhttpd" ] && /etc/init.d/uhttpd reload
fi
exit 0
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature