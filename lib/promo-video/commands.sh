#!/usr/bin/env bash
# Adapters forward existing rendering and gate implementations, never synthesize verdicts.
promo_check() {
  local name=$1; shift
  local rc=0
  "$@" || rc=$?
  case "$rc" in 0|1|2) ;; *) rc=2 ;; esac
  node "$PROMO_ROOT/lib/promo-video/receipt.mjs" check "$name" "$rc" || return 2
  return "$rc"
}
promo_image() {
  type -P docker >/dev/null || { echo 'Docker CLI missing; provision separately' >&2; return 2; }
  local id
  PROMO_DOCKER_BIN=$(type -P docker)
  export PROMO_DOCKER_BIN
  id=$(promo_docker image inspect -f '{{.Id}}' "$PROMO_IMAGE" 2>/dev/null) || {
    echo "Pinned image absent/unavailable: $PROMO_IMAGE (no pull attempted)" >&2; return 2;
  }
  [[ "$id" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo 'No valid Docker image identity' >&2; return 2; }
  PROMO_IMAGE_ID=$id
  export PROMO_IMAGE_ID
  node "$PROMO_ROOT/lib/promo-video/receipt.mjs" image "$id"
}
promo_dependencies() {
  local rem="$PROMO_ROOT/promo/remotion" package
  for package in remotion @remotion/cli; do
    [[ -f "$rem/node_modules/$package/package.json" ]] || {
      echo "Missing prepared $package dependencies; coordinator must provision from the existing lockfile" >&2; return 2;
    }
  done
  node - "$rem" <<'NODE'
const fs=require('node:fs'),path=require('node:path'),root=process.argv[2];
for(const p of ['remotion','@remotion/cli']) {
  if(JSON.parse(fs.readFileSync(path.join(root,'node_modules',p,'package.json'))).version!=='4.0.529') process.exit(2);
}
NODE
}
promo_tools() {
  [[ $(uname -s) == Linux && ${BASH_VERSINFO[0]} -ge 4 ]] || { echo 'Linux/Bash 4+ required' >&2; return 2; }
  node -e 'if(Number(process.versions.node.split(".")[0])<20) process.exit(2)' || { echo 'Node 20+ required' >&2; return 2; }
  local tool f
  for tool in bash docker node git timeout realpath awk flock sha256sum; do
    type -P "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; return 2; }
  done
  [[ -w "$PROMO_ARTIFACTS" ]] || { echo 'Artifact directory is not writable' >&2; return 2; }
  for f in package.json package-lock.json tsconfig.json shared/scripts/in-container.sh shared/scripts/probe.sh shared/src/index.ts; do
    [[ -r "$PROMO_ROOT/promo/remotion/$f" ]] || { echo "Missing renderer input: $f" >&2; return 2; }
  done
  node - "$PROMO_ROOT/promo/remotion/package.json" <<'NODE'
const p=require(process.argv[2]);
for(const n of ['remotion','@remotion/cli','@remotion/fonts']) if(p.dependencies[n]!=='4.0.529') process.exit(2);
NODE
}
promo_watchdog() {
  [[ "$PROMO_WATCHDOG" == not_applicable ]] || { echo 'Required watchdog unavailable; not performed' >&2; return 2; }
}
promo_doctor() {
  local results=() f rc
  for f in tools image dependencies watchdog; do
    promo_check "$f" "promo_$f"; rc=$?; results+=("$rc")
  done
  promo_aggregate "${results[@]}"
}
promo_capture() {
  promo_check tools promo_tools || return $?
  promo_check image promo_image || return $?
  promo_check watchdog promo_watchdog || return $?
  local assets="$PROMO_ATTEMPT/assets" rc
  mkdir -p "$assets"
  node "$PROMO_ROOT/lib/promo-video/receipt.mjs" capture-stage || return 2
  promo_container capture "$PROMO_ATTEMPT/capture.txt" \
    --mount "type=bind,src=$PROMO_ROOT/demo/synthetic,dst=/harness/demo/synthetic,readonly" \
    --mount "type=bind,src=$PROMO_ROOT/promo/capture,dst=/harness/promo/capture,readonly" \
    --mount "type=bind,src=$PROMO_ATTEMPT/config.mjs,dst=/config.mjs,readonly" \
    --mount "type=bind,src=$assets,dst=/assets" \
    -e NODE_PATH=/usr/local/lib/node_modules:/usr/lib/node_modules \
    "$PROMO_IMAGE_ID" node /harness/demo/synthetic/record.mjs /assets /config.mjs
  rc=$?; promo_check capture-result bash -c "exit $rc" || return $?
  promo_container capture-log "$PROMO_ATTEMPT/capture-log.txt" \
    --mount "type=bind,src=$PROMO_ROOT/.claude/skills/promo-video/scripts,dst=/s,readonly" \
    --mount "type=bind,src=$assets,dst=/assets,readonly" \
    "$PROMO_IMAGE_ID" node /s/gate-log.mjs /assets/record-log-demo.json /assets
  rc=$?; promo_check capture-log bash -c "exit $rc" || return $?
  node "$PROMO_ROOT/lib/promo-video/receipt.mjs" bind "$assets" || return 2
  echo "Capture inputs: $assets"
}
# Docker interception only inside preserved shell gates. Strip their lifecycle/resource
# flags and apply our lifecycle. All actual commands still go to the host Docker CLI.
docker() {
  # Preserved gates still name the default image; route their image checks and
  # run calls to the exact image selected by the portable attempt.
  if [[ ${1:-} == image && ${2:-} == inspect && ${3:-} == promo-render:2026-09-29 ]]; then
    shift 3; promo_docker image inspect "$PROMO_IMAGE_ID" "$@"; return $?;
  fi
  if [[ ${1:-} != run ]]; then promo_docker "$@"; return $?; fi
  shift
  local args=() op="${PROMO_GATE:?gate identity required}" log="$PROMO_ATTEMPT/${PROMO_GATE}.txt" rc
  while (($#)); do
    case "$1" in
      --rm) shift ;; --name|--network) shift 2 ;;
      --cpus=*|--memory=*) shift ;;
      *) [[ $1 != "$PROMO_IMAGE" && $1 != promo-render:2026-09-29 ]] && args+=("$1") || args+=("$PROMO_IMAGE_ID"); shift ;;
    esac
  done
  local n=1 base=$op
  while [[ -e "$PROMO_ATTEMPT/$op.cid" && $n -lt 100 ]]; do ((n++)); op="$base-$n"; done
  [[ ! -e "$PROMO_ATTEMPT/$op.cid" ]] || return 2
  log="$PROMO_ATTEMPT/$op.txt"
  trap promo_interrupt INT TERM
  promo_container "$op" "$log" "${args[@]}"; rc=$?
  cat "$log"; return "$rc"
}
promo_gate() {
  local gate=$1; shift
  PROMO_GATE=$gate
  export PROMO_GATE
  export -f docker promo_docker promo_container promo_observe promo_aggregate promo_interrupt promo_owned_cid promo_cleanup
  # Preserved gates invoke `timeout docker`, which cannot see Bash functions.
  # A tiny external shim makes their run calls enter this same lifecycle adapter.
  local shim="$PROMO_ATTEMPT/gate-bin"
  mkdir -p "$shim" || return 2
  printf '%s\n' '#!/usr/bin/env bash' 'docker "$@"' > "$shim/docker"
  chmod +x "$shim/docker" || return 2
  PROMO_DOCKER_BIN=${PROMO_DOCKER_BIN:-$(type -P docker)}
  export PROMO_DOCKER_BIN
  if [[ $gate == transitions-make ]]; then
    PATH="$shim:$PATH" promo_check "$gate" node "$PROMO_ROOT/.claude/skills/promo-video/scripts/gate-transitions.mjs" make "$@"
  else
    PATH="$shim:$PATH" promo_check "$gate" bash "$PROMO_ROOT/.claude/skills/promo-video/scripts/$gate.sh" "$@"
  fi
}
promo_render() {
  [[ -n "$PROMO_INPUTS" ]] || { echo 'render requires --inputs CAPTURE_ATTEMPT/assets' >&2; return 2; }
  promo_check tools promo_tools || return $?
  promo_check image promo_image || return $?
  promo_check dependencies promo_dependencies || return $?
  promo_check watchdog promo_watchdog || return $?
  promo_check capture-source node "$PROMO_ROOT/lib/promo-video/receipt.mjs" capture-prior || return $?
  # The preserved render entrypoint forwards portable execution after these checks.
  bash "$PROMO_ROOT/promo/remotion/shared/render.sh" demo &
  PROMO_CHILD_PID=$!
  local rc=0
  wait "$PROMO_CHILD_PID" || rc=$?
  PROMO_CHILD_PID=
  return "$rc"
}
promo_render_portable() {
  local rc=0 f work="$PROMO_ATTEMPT/work" out="$PROMO_ATTEMPT/out/final"
  node "$PROMO_ROOT/lib/promo-video/receipt.mjs" stage || return 2
  mkdir -p "$out/proof" "$out/logs"
  export PROMO_REMOTION="$work" PROMO_ASSETS="$PROMO_INPUTS"
  promo_gate gate-config demo "$out/proof/config-inspect.tsv" || return $?
  # One owner lock, bounded wait; no dependency installation or external network.
  exec 9>"$PROMO_ARTIFACTS/render.lock"
  flock -w 10 9 || { echo 'Render lock unavailable' >&2; return 2; }
  local mounts=(--mount "type=bind,src=$work,dst=/work,readonly"
    --mount "type=bind,src=$PROMO_ROOT/promo/remotion/node_modules,dst=/deps/node_modules,readonly"
    --mount "type=bind,src=$PROMO_INPUTS,dst=/assets,readonly"
    --mount "type=bind,src=$out,dst=/out" -w /work -e PROMO_PROJECT=demo
    -e NODE_PATH=/usr/local/lib/node_modules:/usr/lib/node_modules)
  # Font assets come only from the pinned image. Copy to external public staging.
  promo_container fonts "$out/logs/fonts.txt" \
    --mount "type=bind,src=$work/demo/public,dst=/public" "$PROMO_IMAGE_ID" bash -c \
    'mkdir -p /public/fonts; cp /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf /public/fonts/regular.ttf; cp /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf /public/fonts/bold.ttf' || return $?
  # Public videos must be in the public dir for webpack; avoid absolute symlink loops.
  for f in 16x9 9x16 1x1; do
    [[ -s "$PROMO_INPUTS/demo-$f.webm" ]] || return 2
    cp "$PROMO_INPUTS/demo-$f.webm" "$work/demo/public/rec/" || return 2
  done
  node "$PROMO_ROOT/lib/promo-video/receipt.mjs" execution-seal || return $?
  promo_container bundle "$out/logs/bundle.txt" "${mounts[@]}" "$PROMO_IMAGE_ID" bash -c \
    'bash shared/scripts/in-container.sh bundle /out/bundle' || return $?
  local flags=(--codec=h264 --crf=20 --pixel-format=yuv420p --color-space=bt709
    --offthreadvideo-cache-size-in-bytes=536870912 --concurrency=1)
  for f in 16x9 9x16 1x1; do
    promo_container "$f" "$out/logs/$f.txt" "${mounts[@]}" "$PROMO_IMAGE_ID" bash -c \
      'bash shared/scripts/in-container.sh render "$@"' \
      render /out/bundle "promo-$f" "/out/$f.mp4" "${flags[@]}" || return $?
    local w=1080 h=1080; [[ $f != 16x9 ]] || w=1920; [[ $f != 9x16 ]] || h=1920
    promo_container "probe-$f" "$out/logs/probe-$f.txt" "${mounts[@]}" "$PROMO_IMAGE_ID" \
      bash shared/scripts/probe.sh "/out/$f.mp4" "$w" "$h" || return $?
  done
  promo_container 16x9-repeat "$out/logs/16x9-repeat.txt" "${mounts[@]}" "$PROMO_IMAGE_ID" \
    bash shared/scripts/in-container.sh render /out/bundle promo-16x9 /out/16x9-repeat.mp4 "${flags[@]}" || return $?
  promo_check repro cmp -- "$out/16x9.mp4" "$out/16x9-repeat.mp4" || return $?
  promo_gate gate-media "$out" demo || return $?
  promo_gate storyboard demo "$out" "$out/proof/config-inspect.tsv" "$out/proof" || return $?
  promo_gate transitions-make demo "$out/proof/config-inspect.tsv" "$PROMO_INPUTS" "$out/proof/transitions" || return $?
  node "$PROMO_ROOT/lib/promo-video/receipt.mjs" captions || return $?
  node "$PROMO_ROOT/lib/promo-video/receipt.mjs" execution-check || return $?
  node "$PROMO_ROOT/lib/promo-video/receipt.mjs" bind "$out" "$PROMO_INPUTS" || return 2
  echo "Render attempt: $PROMO_ATTEMPT"
}
promo_verify() {
  [[ -n "$PROMO_INPUTS" ]] || { echo 'verify requires --inputs RENDER_ATTEMPT' >&2; return 2; }
  local assets rc results=() out="$PROMO_INPUTS/out/final" proof="$PROMO_INPUTS/out/final/proof"
  promo_check image promo_image || return $?
  assets=$(node "$PROMO_ROOT/lib/promo-video/receipt.mjs" prior); rc=$?
  promo_check source-receipt bash -c "exit $rc" || return $?
  assets=$(promo_external "$assets") || return 2
  promo_check watchdog promo_watchdog || return $?
  promo_gate gate-media "$out" demo; results+=("$?")
  promo_check gate-verdict bash "$PROMO_ROOT/.claude/skills/promo-video/scripts/gate-verdict.sh" \
    "$proof" "$out" "$proof/config-inspect.tsv" "$proof/captions-proof.tsv" "$assets" \
    "$PROMO_INPUTS/work/demo/demo-intervals.tsv"; results+=("$?")
  promo_check gate-transitions node "$PROMO_ROOT/.claude/skills/promo-video/scripts/gate-transitions.mjs" \
    check demo "$assets" "$proof/transitions"; results+=("$?")
  promo_check gate-receipt bash "$PROMO_ROOT/.claude/skills/promo-video/scripts/gate-receipt.sh" \
    demo "$PROMO_INPUTS/receipt.json"; results+=("$?")
  promo_aggregate "${results[@]}"
}
