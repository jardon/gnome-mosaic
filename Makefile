# Retrieve the UUID from ``metadata.json``
UUID = $(shell grep -E '^[ ]*"uuid":' ./metadata.json | sed 's@^[ ]*"uuid":[ ]*"\(.\+\)",[ ]*@\1@')
VERSION = $(shell grep version tsconfig.json | awk -F\" '{print $$4}')

ifeq ($(XDG_DATA_HOME),)
XDG_DATA_HOME = $(HOME)/.local/share
endif

ifeq ($(strip $(DESTDIR)),)
INSTALLBASE = $(XDG_DATA_HOME)/gnome-shell/extensions
SCRIPTS_BASE = $(XDG_DATA_HOME)/gnome-mosaic/scripts
else
INSTALLBASE = $(DESTDIR)/usr/share/gnome-shell/extensions
SCRIPTS_BASE = $(DESTDIR)/usr/lib/gnome-mosaic/scripts
endif
INSTALLNAME = $(UUID)

PROJECTS = floating_exceptions

$(info UUID is "$(UUID)")

.PHONY: all clean install zip-file

sources = src/*.ts *.css

all: depcheck compile

clean:
	rm -rf _build target

# Configure local settings on system
configure:
	sh scripts/configure.sh

compile: $(sources) clean
	env PROJECTS="$(PROJECTS)" ./scripts/transpile.sh

# Rebuild, install, reconfigure local settings, restart shell, and listen to journalctl logs
debug: depcheck compile install configure enable restart-shell listen

depcheck:
	@echo depcheck
	@if ! command -v tsc >/dev/null; then \
		echo \
		echo 'You must install TypeScript >= 3.8 to transpile: (node-typescript on Debian systems)'; \
		exit 1; \
	fi

enable:
	gnome-extensions enable "gnome-mosaic@jardon.github.com"

disable:
	gnome-extensions disable "gnome-mosaic@jardon.github.com"

listen:
	journalctl -o cat -n 0 -f "$$(which gnome-shell)" | grep -v warning

local-install: depcheck compile install configure restart-shell enable

install:
	rm -rf $(INSTALLBASE)/$(INSTALLNAME)
	mkdir -p $(INSTALLBASE)/$(INSTALLNAME) $(SCRIPTS_BASE)
	cp -r _build/* $(INSTALLBASE)/$(INSTALLNAME)/

uninstall:
	rm -rf $(INSTALLBASE)/$(INSTALLNAME)

restart-shell:
	@echo "Restart shell!"
ifneq ($(WAYLAND_DISPLAY),) # Don't restart if WAYLAND_DISPLAY is set
	@echo "WAYLAND_DISPLAY is set, not restarting shell";
else
	if bash -c 'xprop -root &> /dev/null'; then \
		pkill -HUP gnome-shell; \
	else \
		gnome-session-quit --logout; \
	fi
	sleep 3
endif

update-repository:
	git fetch origin
	git reset --hard origin/master
	git clean -fd

zip-file: all
	cd _build && zip -qr "../$(UUID)_$(VERSION).zip" .

.NOTPARALLEL: debug local-install
