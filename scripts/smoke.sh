#!/usr/bin/env bash
# Post-deploy smoke check. Usage: scripts/smoke.sh https://your-service.onrender.com
set -u
BASE="${1:?usage: smoke.sh <base-url>}"; BASE="${BASE%/}"
fail=0
check() { # name path expected-status
  code=$(curl -s -o /dev/null -m 60 -w '%{http_code}' "$BASE$2")
  if [ "$code" = "$3" ]; then echo "PASS $1 ($code)"; else echo "FAIL $1 (got $code, want $3)"; fail=1; fi
}
start=$(date +%s)
check "home page" "/" 200
echo "first response took $(( $(date +%s) - start ))s (cold start)"
check "history api" "/api/weather/history" 200
check "unknown api is not a 5xx" "/api/nope" 404
exit $fail
