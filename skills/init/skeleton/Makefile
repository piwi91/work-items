# Sessions start in the code repo because under the sandbox git writes only in a worktree the session started in.
# The code repo comes from the item's `repos:` (or the enclosing git repo in in-repo mode): see `wi repo`.
# --autonomous is required: a background run cannot ask questions.
# Flags come from the Claude Code docs (agent-view, worktrees) and are untested here.
TRACKER := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
SELF := $(lastword $(MAKEFILE_LIST))
REPO ?=
WI ?= $(shell command -v wi || ls $(HOME)/.claude/plugins/cache/*/work-items/*/bin/wi 2>/dev/null | sort -V | tail -1)
CLAUDE_FLAGS ?= --settings '{"crossSessionInbound":"accept"}'
ID ?= $(word 2,$(MAKECMDGOALS))
$(if $(ID),$(eval $(ID):;@:))
UP := $(shell echo '$(ID)' | tr a-z A-Z)
LOW := $(shell echo '$(ID)' | tr A-Z a-z)
code = code="$$(WI_ROOT="$(TRACKER)" "$(WI)" repo $(UP) $(REPO))"
need = @test -n "$(ID)" || { echo "missing ID: make $@ ID=<ID>" >&2; exit 1; }

.DEFAULT_GOAL := help
.PHONY: help agents implement logs attach stop clean-worktree

help:
	@echo "implement <ID>        start a background session in its own worktree (REPO=<slug> for multi-repo items)"
	@echo "agents                list background sessions"
	@echo "logs <ID>             show session logs"
	@echo "attach <ID>           attach to a session"
	@echo "stop <ID>             stop a session"
	@echo "clean-worktree <ID>   remove the leftover worktree (REPO=<slug> for multi-repo items)"
	@echo "The ID is case-insensitive: 'implement-e1-f1', 'implement e1-f1' and 'implement ID=e1-f1' all work."

implement:
	$(need)
	@$(code) && cd "$$code" && WI_ROOT="$(TRACKER)" claude --bg --worktree $(LOW) --name $(UP) --add-dir "$(TRACKER)" $(CLAUDE_FLAGS) "/work-items:implement $(UP) --autonomous"

agents:
	claude agents

logs attach stop:
	$(need)
	claude $@ $(UP)

clean-worktree:
	$(need)
	@$(code) && cd "$$code" && git worktree remove .claude/worktrees/$(LOW)

$(foreach t,implement logs attach stop clean-worktree,$(eval $(t)-%:;@$$(MAKE) --no-print-directory -f $(SELF) $(t) ID=$$*))
