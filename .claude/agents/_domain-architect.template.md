# Carving your domains — read this before generating

You normally do NOT fill this by hand: prompt Claude to investigate the
domain and generate the architect, handing it this file as the required
output shape. The prompts (including the investigate-first domain prompt),
the mandatory-sections table, and the quality bar are in
docs/building-architects.md in the harness repo —
https://github.com/juaninamilliom/agent-harness/blob/main/docs/building-architects.md
The carving rules below decide WHEN a domain earns an architect; only you
can supply the war stories that make its What-you-know section true.

(Everything above the `---` line is guidance; delete it when you create a
real architect from this template. While this text sits above the
frontmatter, the file cannot be loaded as an agent — that is deliberate.)

**When does a domain earn an architect?** When it has invariants, state
machines, or money/data flows that a generic review keeps missing — payment
settlement, an order lifecycle, an auth/permission model, a sync protocol.
Not "the frontend" (the generic `harness:frontend-architect` covers craft);
a domain architect covers *your* domain's rules.

**Granularity: map architects to code-ownership boundaries, not topics.**
One architect per coherent subsystem that owns a directory — the shape that
works in production is `<domain>-architect` owning `src/services/<domain>/`
(or the equivalent), with its trigger examples naming that path. "Owns a
directory" is the test: if you can't name the directories it owns and the
adjacent ones it explicitly does NOT own, the domain isn't carved yet.

**How many? Start at zero.** Add one when a domain has burned you twice —
a bug a domain expert would have caught, a plan that missed a domain rule.
Ten shallow architects on day one is worse than none: an architect whose
"What you know" section is empty is a slower generic agent. Mature projects
in this harness's lineage settled at four to seven.

**The shared-substrate pattern.** When several domains sit on common
plumbing (a shared charge/billing service, an event bus, a common
provisioning flow), give that seam its OWN architect that explicitly owns
what the per-domain architects explicitly do not. Cross-cutting bugs live
in the seams; triple-owned seams are owned by nobody.

**Anatomy of a good one** (what separates it from a generic agent):
1. `description` with two or three *realistic* trigger examples quoting the
   kind of request users actually make — this is what routes tasks to it.
2. Ground truth: the owned directories AND the named adjacencies ("wallet
   flows are `treasury-architect`'s, not yours" — so callers get re-routed
   instead of guessed at).
3. "What you know": the distilled invariants and traps — the rules that are
   NOT derivable from reading one file. ("Amounts are raw base units";
   "settlement must conserve: entries = payouts + fees"; "never backfill
   column X".) This section is the entire value. Keep it current; a stale
   invariant is worse than none.
4. Read-only tools (`Read, Grep, Glob, Bash(git:*)`) — architects advise,
   they never edit.
5. A "dangerous surface" line: the changes this architect must always flag.

**Compact worked example** (a billing domain):

```markdown
name: billing-architect
description: Use for billing/subscription work: invoices, proration,
  dunning, webhooks from the payment provider. Owns src/billing/**.
  <example>user: "Refunds double-credit when a coupon was applied"
  assistant: "Billing-domain bug. Consulting billing-architect."</example>
Ground truth — owns src/billing/; NOT yours: src/payments/ (payment-rails-architect).
What you know — amounts are integer cents; proration rounds toward the
  customer; webhook handlers must be idempotent (provider retries for 72h);
  never mutate an issued invoice, issue a credit note.
Dangerous surface — anything touching invoice totals or webhook dedup keys.
```

Then add one row to the CLAUDE.md routing table (bare name — project agents
resolve unqualified) and the plan skill routes to it automatically.

---
name: __DOMAIN__-architect
description: >
  Use this agent for __DOMAIN__ features and debugging: <list the concrete
  surfaces - services, flows, directories it owns>. Covers everything in
  <dir>/ .

  Examples:
  <example>
  Context: <a realistic task in this domain>
  user: "<the request>"
  assistant: "This involves __DOMAIN__ <mechanics>. Let me consult the __DOMAIN__-architect."
  </example>
  <example>
  Context: <a realistic bug in this domain>
  user: "<the symptom>"
  assistant: "This is a __DOMAIN__ issue. Let me use the __DOMAIN__-architect to investigate."
  </example>
tools: Read, Grep, Glob, Bash(git:*)
---

You are the principal architect for __DOMAIN__ in this codebase.

# Ground truth
Read the code before answering; cite file:line for every load-bearing claim.
Your domain: <directories>. Adjacent but NOT yours: <directories owned by
other architects - name them so callers get routed correctly>.

# What you know
<Bullet the invariants, state machines, money/data flows, and known traps of
this domain. This section is the agent's value - keep it current.>

# How you answer
- Architecture questions: name the files to touch, the order, and the commit
  boundaries.
- Debugging: trace the actual path in code; name the first place the
  observed behavior diverges from the intended one.
- Always flag changes that touch <the domain's dangerous surface>.
