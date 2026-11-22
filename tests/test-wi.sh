#!/usr/bin/env bash
# Builds throwaway trackers and checks bin/wi against them. Run: bash tests/test-wi.sh
set -u
WI="$(cd "$(dirname "$0")/.." && pwd)/bin/wi"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
fails=0

new_tracker() {
  rm -rf "$T/r"
  mkdir -p "$T/r/backlog" "$T/r/refined" "$T/r/in-progress" "$T/r/in-review" "$T/r/completed" "$T/r/design"
  printf '## E1 — Core\n_why_\n' > "$T/r/EPICS.md"
  : > "$T/r/design/a.md"
}

# item <dir> <id> <status> [last_reviewed] [deps] [design] [epic] [file]
item() {
  local lower; lower="$(echo "$2" | tr 'A-Z' 'a-z')"
  printf -- '---\nid: %s\ntitle: Title %s\nepic: %s\ntype: F\npriority: P3\nsize: S\ndepends_on: [%s]\ndesign: %s\nstatus: %s\nlast_reviewed: %s\n---\n# x\n' \
    "$2" "$2" "${7:-E1 — Core}" "${5:-}" "${6:-—}" "$3" "${4:-$(date +%F)}" > "$T/r/$1/${8:-$lower-x}.md"
}

wi() { WI_ROOT="$T/r" bash "$WI" "$@" 2>&1; }

check() { # name, condition result (0 = pass)
  if [ "$2" -eq 0 ]; then echo "ok   $1"; else echo "FAIL $1"; fails=$((fails + 1)); fi
}

validate_fails_with() { # name, pattern
  local out rc; out="$(wi validate)"; rc=$?
  [ $rc -eq 1 ] && echo "$out" | grep -qF -- "$2"; check "$1" $?
}

# mk <state> <id> <type> <priority> <size> [deps] [title]
mk() {
  local lower epic; lower="$(echo "$2" | tr 'A-Z' 'a-z')"; epic="$(echo "$2" | sed 's/^[Ee]\([0-9]*\).*/\1/')"
  printf -- '---\nid: %s\ntitle: %s\nepic: E%s — x\ntype: %s\npriority: %s\nsize: %s\ndepends_on: [%s]\ndesign: —\nstatus: %s\nlast_reviewed: %s\n---\n' \
    "$2" "${7:-T $2}" "$epic" "$3" "$4" "$5" "${6:-}" "$1" "$(date +%F)" > "$T/r/$1/$lower-x.md"
}

new_tracker
item backlog E1-F1 backlog
item refined E1-F2 refined "" "" design/a.md
item refined E1-F3 blocked
item in-progress E1-F4 needs-attention
item in-review E1-F5 in-review
item completed E1-F6 completed
item completed E1-F7 dropped
wi validate >/dev/null; check "valid tracker validates" $?

new_tracker; item backlog E1-F1 refined
validate_fails_with "status/folder mismatch fails" "status refined does not fit folder backlog"

new_tracker; item backlog E1-F1 backlog "" "" "" "" foo
validate_fails_with "bad slug fails" "slug must start with e1-f1-"

new_tracker; item backlog E1-F1 backlog "" "" design/nope.md
validate_fails_with "missing design file fails" "design file not found: design/nope.md"

new_tracker; item backlog E1-F1 backlog "" "" "" "E9 — Nope"
validate_fails_with "unknown epic fails" "epic E9 not in EPICS.md"

new_tracker; item backlog E1-F1 backlog; item completed E1-F1 completed "" "" "" "" e1-f1-other
validate_fails_with "duplicate id fails" "duplicate E1-F1"

new_tracker; item backlog E1-F1 backlog "" E1-F9
validate_fails_with "unknown dependency fails" "E1-F1: unknown dependency E1-F9"

new_tracker; item completed E1-F3 completed; item backlog E1-F7 backlog; item in-review E2-F1 in-review
[ "$(wi nextid E1 F)" = "E1-F8" ]; check "nextid is max+1 across all states" $?
[ "$(wi nextid E3 B)" = "E3-B1" ]; check "nextid starts at 1" $?

new_tracker
item backlog E1-F1 backlog 2000-01-01
item backlog E1-F2 backlog
item completed E1-F3 completed 2000-01-01
out="$(wi stale 60)"
{ echo "$out" | grep -qw E1-F1 && ! echo "$out" | grep -qw E1-F2 && ! echo "$out" | grep -qw E1-F3; }; check "stale lists only old open items" $?

new_tracker
item backlog E1-F1 backlog
item refined E1-F2 blocked
item completed E1-F3 dropped
item backlog E1-F4 backlog "" E1-F1
item backlog E1-F5 backlog "" E1-F3
item completed E1-F6 completed
item backlog E1-F7 backlog "" E1-F6
out="$(wi next)"
{ echo "$out" | grep -qw E1-F1 && echo "$out" | grep -qw E1-F7 \
  && ! echo "$out" | grep -qw E1-F2 && ! echo "$out" | grep -qw E1-F3 \
  && ! echo "$out" | grep -qw E1-F4 && ! echo "$out" | grep -qw E1-F5; }; check "next skips blocked, dropped, open and dropped deps" $?

new_tracker; mk backlog E1-F1 F P3 S "" "Fix C# parser"; mk backlog E1-F2 F P3 S "" "Plain # comment"
out="$(wi list)"
{ echo "$out" | grep -qF "Fix C# parser" && echo "$out" | grep -qF "Plain" && ! echo "$out" | grep -qF "comment"; }; check "title with # survives, spaced # comment is stripped" $?

new_tracker; mk backlog E1-F1 F P3 S; printf 'no frontmatter\n' > "$T/r/backlog/junk.md"
[ "$(wi list | wc -l | tr -d ' ')" = 1 ]; check "list skips item without id" $?
[ "$(wi next | wc -l | tr -d ' ')" = 1 ]; check "next skips item without id" $?

new_tracker; mk backlog e1-f9 F P3 S
validate_fails_with "lowercase id fails" "bad id e1-f9"
new_tracker; mk backlog E1-F1 B P3 S
validate_fails_with "type not matching id letter fails" "type B does not match id E1-F1"
new_tracker; mk backlog E1-F1 X P3 S
validate_fails_with "type outside F|B fails" "type X does not match id E1-F1"
new_tracker; mk backlog E1-F1 F P9 S
validate_fails_with "bad priority fails" "bad priority P9"
new_tracker; mk backlog E1-F1 F P3 HUGE
validate_fails_with "bad size fails" "bad size HUGE"
new_tracker; mk backlog E1-F1 F "" ""
wi validate >/dev/null; check "empty priority and size pass validate" $?

new_tracker; mk backlog E1-F1 F P3 S; mk backlog E1-F2 F P3 S " E1-F1 , E1-F2 "
wi validate >/dev/null; check "depends_on with spaces validates" $?
wi next | grep -qw E1-F2; [ $? -ne 0 ]; check "depends_on with spaces still blocks on open deps" $?

new_tracker; mk backlog E1-F1 F P3 S
wi validate >/dev/null; check "design em dash passes validate" $?
out="$(cd / && WI_ROOT="$T/r" bash "$WI" list 2>&1)"
echo "$out" | grep -qF E1-F1; check "WI_ROOT works from any directory" $?

out="$(wi nextid 2>&1)"; rc=$?
[ $rc -ne 0 ] && echo "$out" | grep -qF "usage: nextid E<n> F|B"; check "nextid without args prints usage" $?
new_tracker; mk backlog E1-F3 F P3 S; mk backlog E10-F2 F P3 S
[ "$(wi nextid E1 F)" = "E1-F4" ]; check "nextid E1 ignores E10 items" $?
[ "$(wi nextid E10 F)" = "E10-F3" ]; check "nextid E10 counts only E10 items" $?

new_tracker; mk backlog E1-F1 F P3 S
sed -i.bak '/^last_reviewed/d' "$T/r/backlog/e1-f1-x.md"
wi stale 60 | grep -qE 'E1-F1 +never'; check "stale lists item without last_reviewed as never" $?

new_tracker
printf '## E1 — a\n_w_\nfocus: now\n## E2 — b\n_w_\nfocus: later\n## E3 — c\n_w_\n' > "$T/r/EPICS.md"
mk backlog E2-F1 F P1 XS
mk backlog E3-F1 F P3 S
mk backlog E1-F10 F P2 S
mk backlog E1-F3 F P2 S
mk backlog E1-F4 F P2 XS
mk backlog E1-B1 B P2 M
mk backlog E1-F2 F P2 S
mk backlog E1-F11 F P2 XS E1-F2
mk backlog E1-F1 F P1 XL
expected="E1-F1 E1-F2 E1-B1 E1-F4 E1-F3 E1-F10 E3-F1 E2-F1"
[ "$(wi next | awk '{print $1}' | tr '\n' ' ' | sed 's/ $//')" = "$expected" ]; check "next orders by focus, priority, fan-in, bug, size, numeric id" $?

new_design() { printf '# D\nintro\n## Work items\n<!-- wi:items -->\n<!-- /wi:items -->\ntail\n' > "$T/r/design/${1:-a}.md"; }

new_tracker; new_design
item backlog E1-F1 backlog; item in-progress E1-F2 in-progress "" "" design/a.md; item completed E1-F3 completed "" "" design/a.md
wi index >/dev/null
idx="$T/r/INDEX.md"
{ head -1 "$idx" | grep -qF '<!-- generated by wi index, do not edit -->' && grep -qF '## E1 — Core' "$idx" \
  && grep -qF '[E1-F1](backlog/e1-f1-x.md)' "$idx" && grep -qF '[E1-F2](in-progress/e1-f2-x.md)' "$idx" && ! grep -qF 'E1-F3' "$idx" \
  && [ "$(grep -n 'E1-F1' "$idx" | head -1 | cut -d: -f1)" -lt "$(grep -n 'E1-F2' "$idx" | head -1 | cut -d: -f1)" ]; }; check "index lists open items per epic, not completed" $?
grep -qF '(design/a.md) | ' "$idx" && grep -qF '| 1/2 |' "$idx"; check "index design row has open/total count" $?
cp "$idx" "$T/first"; wi index >/dev/null; cmp -s "$idx" "$T/first"; check "index twice is identical" $?
d="$T/r/design/a.md"
{ grep -qF intro "$d" && tail -1 "$d" | grep -qx tail && grep -qF '[E1-F3](../completed/e1-f3-x.md)' "$d" \
  && grep -qF '[E1-F2](../in-progress/e1-f2-x.md)' "$d" && ! grep -qF 'E1-F1' "$d"; }; check "index fills only the design marker block, incl. completed" $?
wi validate | grep -qx ok; check "validate ok after index" $?

new_tracker; printf 'keep\n' > "$T/r/design/a.md"; item backlog E1-F1 backlog "" "" design/a.md
wi index >/dev/null; [ "$(cat "$T/r/design/a.md")" = keep ]; check "design without markers untouched" $?

new_tracker; new_design; item backlog E1-F1 backlog
wi index >/dev/null
mv "$T/r/backlog/e1-f1-x.md" "$T/r/in-progress/"; sed -i.bak 's/^status: .*/status: in-progress/' "$T/r/in-progress/e1-f1-x.md"; rm -f "$T/r/in-progress/"*.bak
validate_fails_with "validate fails stale after a state change" "stale: run wi index"
wi index >/dev/null; wi validate | grep -qx ok; check "validate passes after index" $?

new_tracker; new_design; item backlog E1-F1 backlog "" "" design/a.md
wi index >/dev/null; sed -i.bak 's/Title E1-F1/Hand edit/' "$T/r/design/a.md"
validate_fails_with "validate fails when design block hand-edited" "stale: run wi index"

new_tracker; printf '# Epics\n' > "$T/r/EPICS.md"
[ "$(wi validate)" = ok ]; check "empty tracker validates ok" $?
wi list >/dev/null && wi next >/dev/null; check "empty tracker list and next exit 0" $?

[ $fails -eq 0 ] && echo "all passed" || { echo "$fails failed"; exit 1; }
