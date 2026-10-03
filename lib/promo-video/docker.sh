#!/usr/bin/env bash
# CID files are written by Docker on creation; proposed names are never cleanup targets.
promo_docker() {
  local executable=${PROMO_DOCKER_BIN:-$(type -P docker)}
  [[ -n "$executable" ]] || return 2
  timeout --foreground -k 2 10 "$executable" "$@"
}
promo_owned_cid() {
  local cid
  [[ -f ${PROMO_ACTIVE_CIDFILE:-} ]] || return 2
  cid=$(cat "$PROMO_ACTIVE_CIDFILE")
  [[ $cid =~ ^[a-f0-9]{64}$ ]] || return 2
  PROMO_ACTIVE_CONTAINER=$cid
}
promo_observe() {
  local cid=$1 rc=$2 op=$3 stop=$4 state
  state=$(promo_docker container inspect "$cid" 2>/dev/null) || state=null
  node "$PROMO_ROOT/lib/promo-video/receipt.mjs" observe "$op" "$cid" "$rc" "$stop" "$state"
}
promo_cleanup() {
  local rc=$1 stop=$2 obs=2 cleanup=0 stop_raw=not_requested remove_raw=0 order=inspect,remove
  if promo_owned_cid; then
    if [[ $stop != none ]]; then
      stop_raw=0 order=stop,inspect,remove
      promo_docker stop --time 2 "$PROMO_ACTIVE_CONTAINER" >/dev/null 2>&1 || stop_raw=$?
      [[ $stop_raw == 0 ]] || cleanup=2
    fi
    promo_observe "$PROMO_ACTIVE_CONTAINER" "$rc" "$PROMO_ACTIVE_OP" "$stop"; obs=$?
    promo_docker rm -f "$PROMO_ACTIVE_CONTAINER" >/dev/null 2>&1 || remove_raw=$?
    [[ $remove_raw == 0 ]] || cleanup=2
    node "$PROMO_ROOT/lib/promo-video/receipt.mjs" check "$PROMO_ACTIVE_OP-cleanup" "$cleanup" \
      "cid=$PROMO_ACTIVE_CONTAINER stop_raw_exit=$stop_raw remove_raw_exit=$remove_raw order=$order" || cleanup=2
  else
    node "$PROMO_ROOT/lib/promo-video/receipt.mjs" check "$PROMO_ACTIVE_OP-ownership" 2 "No created CID; proposed name left untouched; run_raw_exit=$rc cause=$stop" || true
  fi
  PROMO_ACTIVE_CONTAINER= PROMO_ACTIVE_CIDFILE=
  promo_aggregate "$obs" "$cleanup"
}
promo_interrupt() {
  trap '' INT TERM
  if [[ -n ${PROMO_CHILD_PID:-} ]]; then
    kill -TERM "$PROMO_CHILD_PID" 2>/dev/null || true
    wait "$PROMO_CHILD_PID" 2>/dev/null || true
  fi
  if [[ -n ${PROMO_ACTIVE_PID:-} ]]; then
    kill -TERM "$PROMO_ACTIVE_PID" 2>/dev/null || true
    wait "$PROMO_ACTIVE_PID" 2>/dev/null || true
  fi
  [[ -z ${PROMO_ACTIVE_CIDFILE:-} ]] || promo_cleanup 143 interrupted || true
  # Only the outer public supervisor finalizes after all children have exited.
  exit 2
}
promo_container() {
  local op=$1 log=$2; shift 2
  local name="promo-$(basename "$PROMO_ATTEMPT" | tr '[:upper:]' '[:lower:]')-$op"
  local rc=0 obs=2 stop=none supervisor="$log.supervisor"
  [[ ${PROMO_IMAGE_ID:-} =~ ^sha256:[a-f0-9]{64}$ ]] || return 2
  promo_docker container inspect "$name" >/dev/null 2>&1 && {
    echo "Container already exists; leaving it untouched: $name" >&2; return 2;
  }
  PROMO_ACTIVE_OP=$op PROMO_ACTIVE_CIDFILE="$PROMO_ATTEMPT/$op.cid"
  [[ ! -e $PROMO_ACTIVE_CIDFILE ]] || return 2
  trap promo_interrupt INT TERM
  LC_ALL=C timeout --verbose --foreground -k 5 "$PROMO_TIMEOUT" bash -c \
    'log=$1; shift; exec "$@" >"$log" 2>&1' bash "$log" \
    "${PROMO_DOCKER_BIN:-$(type -P docker)}" run --pull=never --cidfile "$PROMO_ACTIVE_CIDFILE" \
    --label "promo.attempt=$(basename "$PROMO_ATTEMPT")" --name "$name" --restart=no \
    --cpus="$PROMO_CPUS" --memory="$PROMO_MEMORY" --pids-limit=256 --shm-size=256m --ulimit fsize=1073741824:1073741824 \
    --network=none --cap-drop=ALL --security-opt=no-new-privileges \
    "$@" 2>"$supervisor" &
  PROMO_ACTIVE_PID=$!
  wait "$PROMO_ACTIVE_PID" || rc=$?
  PROMO_ACTIVE_PID=
  if grep -Eq '(^|/)timeout: sending signal ' "$supervisor"; then stop=timeout; fi
  promo_cleanup "$rc" "$stop"; obs=$?
  # Creation/inspection/cleanup ambiguity is incomplete; observed defects win.
  promo_aggregate "$obs" "$([[ $rc == 0 ]] && echo 0 || { [[ $stop != none || $rc == 125 || $rc == 126 || $rc == 127 || $rc == 2 ]] && echo 2 || echo 1; })"
}
