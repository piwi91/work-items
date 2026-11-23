# Sessions start in the code repo because under the sandbox git writes only in a worktree the session started in.
# The code repo comes from the item's `repos:` (or the enclosing git repo in in-repo mode): see `wi repo`.
# --autonomous is required: a background run cannot ask questions.
# Flags come from the Claude Code docs (agent-view, worktrees) and are untested here.
TRACKER := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
REPO ?=
WI ?= $(shell command -v wi || ls $(HOME)/.claude/plugins/cache/*/work-items/*/bin/wi 2>/dev/null | sort -V | tail -1)
CLAUDE_FLAGS ?= --settings '{"crossSessionInbound":"accept"}'
wt = $(shell echo $(1) | tr A-Z a-z)
code = code="$$(WI_ROOT="$(TRACKER)" "$(WI)" repo $* $(REPO))"

.DEFAULT_GOAL := help
.PHONY: help agents

help:
	@echo "implement-<ID>        start a background session in its own worktree (REPO=<slug> for multi-repo items)"
	@echo "agents                list background sessions"
	@echo "logs-<ID>             show session logs"
	@echo "attach-<ID>           attach to a session"
	@echo "stop-<ID>             stop a session"
	@echo "clean-worktree-<ID>   remove the leftover worktree (REPO=<slug> for multi-repo items)"

implement-%:
	@$(code) && cd "$$code" && WI_ROOT="$(TRACKER)" claude --bg --worktree $(call wt,$*) --name $* --add-dir "$(TRACKER)" $(CLAUDE_FLAGS) "/work-items:implement $* --autonomous"

agents:
	claude agents

logs-%:
	claude logs $*

attach-%:
	claude attach $*

stop-%:
	claude stop $*

clean-worktree-%:
	@$(code) && cd "$$code" && git worktree remove .claude/worktrees/$(call wt,$*)
