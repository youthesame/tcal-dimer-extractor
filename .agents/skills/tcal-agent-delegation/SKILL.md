# tcal Agent Delegation Skill

Use this skill before delegating or simulating delegation in this repository.

## Hard Rule

Never send a subagent request, delegation JSON, or internal prompt as the final answer to the user.

Final answers must summarize completed user-visible work, verification, and any remaining risk. If delegation was unavailable or skipped, say that plainly.

## Delegation Checklist

Before delegating:

- Confirm an actual subagent mechanism is available in the current environment.
- Confirm the delegated task is read-oriented unless the user explicitly allowed subagents to edit.
- Make the task bounded: one directory, one question, or one narrow review scope.
- Do not perform the same delegated task locally while it is running.
- Wait for the result if progress depends on it.

If no subagent mechanism is available:

- Do not fabricate delegation.
- Do not output a pseudo-recipient such as `/root/...`.
- Explain the limitation briefly if it affects the work.
- Reduce the local work to the smallest safe inspection or edit needed for the user's request.

## Recommended Delegation Boundaries

Delegate these when a real subagent is available:

- Reading non-`AGENTS.md` files.
- Broad codebase exploration.
- Code review.
- TDD test creation.
- Web search.

Keep these in the parent agent:

- Final implementation edits.
- Final verification summary.
- User-facing decision-making and tradeoff calls.
