#!/usr/bin/env bash
# One loader. No shell eval/config sourcing, no private defaults.
promo_external() {
  local p
  p=$(realpath -m -- "$1") || return 2
  case "$p" in
    /|"$PROMO_ROOT"|"$PROMO_ROOT"/*|"${HOME:-/root}"|"${HOME:-/root}"/*|/var/run|/var/run/*|/run|/run/*|/proc|/proc/*|/sys|/sys/*|/dev|/dev/*)
      echo "Unsafe external artifact/input path: $p" >&2; return 2 ;;
  esac
  [[ "$p" != *:* && "$p" != *,* && "$p" != *$'\n'* ]] || { echo 'Unsupported mount path characters' >&2; return 2; }
  printf '%s\n' "$p"
}
promo_env() {
  local tool
  for tool in node realpath timeout git mktemp; do
    command -v "$tool" >/dev/null || { echo "Required tool missing: $tool" >&2; return 2; }
  done
  [[ -n "$PROMO_ARTIFACTS" ]] || { echo '--artifacts is required (outside Git)' >&2; return 2; }
  PROMO_ARTIFACTS=$(promo_external "$PROMO_ARTIFACTS") || return 2
  PROMO_CONFIG=$(realpath -e -- "$PROMO_CONFIG") || return 2
  [[ -f "$PROMO_CONFIG" ]] || return 2
  if [[ -n "$PROMO_INPUTS" ]]; then
    PROMO_INPUTS=$(promo_external "$PROMO_INPUTS") || return 2
    [[ -d "$PROMO_INPUTS" ]] || { echo "Missing inputs: $PROMO_INPUTS" >&2; return 2; }
  fi
  [[ "$PROMO_CPUS" =~ ^[0-9]+(\.[0-9]+)?$ ]] &&
    awk -v n="$PROMO_CPUS" 'BEGIN{exit !(n>0 && n<=2)}' || { echo 'CPU range: (0,2]' >&2; return 2; }
  [[ "$PROMO_MEMORY" =~ ^([1-4]g|[5-9][0-9][0-9]m|[1-3][0-9][0-9][0-9]m|40[0-8][0-9]m|409[0-6]m)$ ]] || {
    echo 'Memory range: 500m..4096m or 1g..4g' >&2; return 2;
  }
  [[ "$PROMO_TIMEOUT" =~ ^[1-9][0-9]{0,3}$ ]] && ((PROMO_TIMEOUT <= 1800)) || {
    echo 'Timeout range: 1..1800 seconds per operation' >&2; return 2;
  }
  case "$PROMO_WATCHDOG" in not_applicable|unavailable) ;; *) echo 'Invalid watchdog state' >&2; return 2 ;; esac
  PROMO_IMAGE=${PROMO_IMAGE:-promo-render:2026-09-29}
  export PROMO_ROOT PROMO_CONFIG
  return 0
}
promo_aggregate() {
  local r result=0
  for r in "$@"; do
    case "$r" in 0) ;; 1) result=1 ;; *) [[ $result == 1 ]] || result=2 ;; esac
  done
  return "$result"
}

promo_validate() {
  local raw=0 stop=none log="$PROMO_ATTEMPT/config-validation.supervisor"
  LC_ALL=C timeout --verbose -k 2 10 bash -c 'exec node "$1" validate 2>"$2"' bash \
    "$PROMO_ROOT/lib/promo-video/receipt.mjs" "$PROMO_ATTEMPT/config-validation.txt" 2>"$log" || raw=$?
  if grep -Eq '(^|/)timeout: sending signal ' "$log"; then stop=timeout; fi
  cat "$PROMO_ATTEMPT/config-validation.txt" "$log" >&2
  node "$PROMO_ROOT/lib/promo-video/receipt.mjs" validation "$raw" "$stop" || return 2
  [[ $raw == 0 && $stop == none ]] || { echo "Config validation not performed: raw_exit=$raw cause=$stop" >&2; return 2; }
}
