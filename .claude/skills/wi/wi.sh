#!/usr/bin/env bash
# Work-item tracker helper: list [state] | next | nextid <E<n>> <F|B> | validate | stale [days]
# Portable (bash 3.2 + awk): no generated index files, everything is read from frontmatter.
set -euo pipefail

STATES="backlog refined in-progress in-review completed"
OPEN_STATES="backlog refined in-progress in-review"

tracker_root() {
  if [[ -n "${WI_ROOT:-}" ]]; then echo "$WI_ROOT"
  elif [[ -f work-items/EPICS.md ]]; then echo work-items
  elif [[ -f EPICS.md && -d backlog ]]; then echo .
  else echo "no tracker: set WI_ROOT, or run '/wi init'" >&2; exit 1
  fi
}

ROOT="$(tracker_root)"
cd "$ROOT"

# One tab-separated record per item: state id epic type priority size status deps title file design last_reviewed
records() {
  local s f
  for s in $STATES; do
    for f in "$s"/*.md; do
      [[ -e "$f" ]] || continue
      awk -v state="$s" -v file="$f" '
        /^---$/ { n++; if (n == 2) exit; next }
        n == 1 { k = $0; sub(/:.*/, "", k); v = $0; sub(/^[^:]*:[ ]*/, "", v); sub(/[ \t]+#.*/, "", v); fm[k] = v }
        END {
          if (fm["id"] == "") exit
          e = fm["epic"]; sub(/ .*/, "", e)
          d = fm["depends_on"]; gsub(/[][ ]/, "", d)
          printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n", state, fm["id"], e, fm["type"], fm["priority"], fm["size"], fm["status"], d, fm["title"], file, fm["design"], fm["last_reviewed"]
        }' "$f"
    done
  done
}

epic_focus() { # "E<n> now|later" lines from EPICS.md
  awk '/^## E[0-9]+ / { e = $2 } e && /^focus:/ { print e, $2 }' EPICS.md
}

cmd_list() {
  local want="${1:-}"
  records | awk -F'\t' -v want="$want" '
    want == "" || $1 == want { printf "%-11s %-8s %-3s %-2s %-3s %-10s %s\n", $1, $2, $5, $4, $6, $7, $9 }'
}

# Pick-up ladder: deps done → epic focus → priority → unblock weight → bug first → smaller → ID.
cmd_next() {
  { epic_focus | sed 's/^/F\t/; s/ /\t/'; records | sed 's/^/R\t/'; } | awk -F'\t' -v open="$OPEN_STATES" '
    BEGIN { split(open, o, " "); for (i in o) isopen[o[i]] = 1 }
    $1 == "F" { focus[$2] = $3; next }
    { st[$3] = $2; ep[$3] = $4; ty[$3] = $5; pr[$3] = $6; sz[$3] = $7; status[$3] = $8; deps[$3] = $9; ti[$3] = $10 }
    END {
      for (id in st) if (isopen[st[id]]) { n = split(deps[id], d, ","); for (i = 1; i <= n; i++) fanin[d[i]]++ }
      split("XS S M L XL XXL", sizes, " "); for (i in sizes) srank[sizes[i]] = i
      for (id in st) {
        if (st[id] != "backlog" && st[id] != "refined") continue
        if (status[id] == "blocked" || status[id] == "dropped") continue
        ready = 1; n = split(deps[id], d, ",")
        for (i = 1; i <= n; i++) if (d[i] != "" && (st[d[i]] != "completed" || status[d[i]] == "dropped")) ready = 0
        if (!ready) continue
        f = (focus[ep[id]] == "now") ? 0 : ((focus[ep[id]] == "later") ? 2 : 1)
        p = (pr[id] == "") ? "P3" : pr[id]
        s = (sz[id] in srank) ? srank[sz[id]] : 3
        match(id, /[0-9]+/); en = substr(id, RSTART, RLENGTH)
        rest = substr(id, RSTART + RLENGTH); match(rest, /[0-9]+/); mn = substr(rest, RSTART, RLENGTH)
        printf "%d%s%03d%d%d%04d%04d\t%-8s %-8s %-3s %-2s %-3s %s\n", f, p, 999 - fanin[id], ((ty[id] == "B") ? 0 : 1), s, en, mn, id, st[id], p, ty[id], sz[id], ti[id]
      }
    }' | sort | cut -f2-
}

cmd_nextid() { # E<n> F|B
  local epic="${1:?usage: nextid E<n> F|B}" type="${2:?usage: nextid E<n> F|B}"
  records | awk -F'\t' -v pre="$epic-$type" '
    index($2, pre) == 1 { n = substr($2, length(pre) + 1) + 0; if (n > max) max = n }
    END { print pre (max + 1) }'
}

cmd_validate() {
  local epics; epics="$(grep -o '^## E[0-9]*' EPICS.md | sed 's/## //' | tr '\n' ' ')"
  records | awk -F'\t' -v epics="$epics" '
    function bad_(msg) { print msg; bad = 1 }
    BEGIN {
      split(epics, e, " "); for (i in e) epic[e[i]] = 1
      allowed["backlog"] = " backlog "; allowed["refined"] = " refined blocked "
      allowed["in-progress"] = " in-progress blocked needs-attention "
      allowed["in-review"] = " in-review needs-attention "; allowed["completed"] = " completed dropped "
    }
    { count[$2]++; where[$2] = where[$2] " " $1; st[$2] = $1; deps[$2] = $8 }
    $2 !~ /^E[0-9]+-[FB][0-9]+$/ { bad_("bad id " $2 " in " $10) }
    $4 != "" && $2 ~ /^E[0-9]+-[FB][0-9]+$/ && $4 != substr($2, index($2, "-") + 1, 1) { bad_($10 ": type " $4 " does not match id " $2) }
    $5 != "" && $5 !~ /^P[1-5]$/ { bad_($10 ": bad priority " $5) }
    $6 != "" && $6 !~ /^(XS|S|M|L|XL|XXL)$/ { bad_($10 ": bad size " $6) }
    $2 == "" || $9 == "" || ($1 != "completed" && $4 == "") { bad_("missing id/title/type in " $1 ": " $2) }
    index(allowed[$1], " " $7 " ") == 0 { bad_($10 ": status " $7 " does not fit folder " $1) }
    { slug = $10; sub(/^[^\/]*\//, "", slug); if (index(slug, tolower($2) "-") != 1) bad_($10 ": slug must start with " tolower($2) "-") }
    $11 != "" && $11 != "—" && system("test -f \"" $11 "\"") != 0 { bad_($10 ": design file not found: " $11) }
    !($3 in epic) { bad_($10 ": epic " $3 " not in EPICS.md") }
    END {
      for (id in count) if (count[id] > 1) bad_("duplicate " id ":" where[id])
      for (id in deps) { n = split(deps[id], d, ","); for (i = 1; i <= n; i++) if (d[i] != "" && !(d[i] in st)) bad_(id ": unknown dependency " d[i]) }
      exit bad
    }' && echo "ok"
}

cmd_stale() { # [days]: open items not reviewed for N days
  local days="${1:-60}" cutoff
  cutoff="$(date -d "-$days days" +%F 2>/dev/null || date -v-"$days"d +%F)"
  records | awk -F'\t' -v cutoff="$cutoff" -v open="$OPEN_STATES" '
    BEGIN { split(open, o, " "); for (i in o) isopen[o[i]] = 1 }
    isopen[$1] && ($12 == "" || $12 < cutoff) { printf "%-11s %-8s %s  %s\n", $1, $2, ($12 == "" ? "never" : $12), $9 }'
}

case "${1:-list}" in
  list) cmd_list "${2:-}" ;;
  next) cmd_next ;;
  nextid) cmd_nextid "${2:-}" "${3:-}" ;;
  validate) cmd_validate ;;
  stale) cmd_stale "${2:-60}" ;;
  *) echo "usage: wi.sh list [state] | next | nextid <E<n>> <F|B> | validate | stale [days]" >&2; exit 2 ;;
esac
