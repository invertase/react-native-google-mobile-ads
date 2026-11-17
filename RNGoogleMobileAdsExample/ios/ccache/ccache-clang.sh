#!/bin/sh
# CC wrapper: ccache + Xcode's real clang. Do not use as LD/LDPLUSPLUS.
set -eu
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
export CCACHE_CONFIGPATH="${CCACHE_CONFIGPATH:-$SCRIPT_DIR/ccache.conf}"
REAL="$(xcrun -find clang)"
if CCACHE_BIN="$(command -v ccache 2>/dev/null)" && [ -n "$CCACHE_BIN" ]; then
  exec "$CCACHE_BIN" "$REAL" "$@"
fi
exec "$REAL" "$@"
