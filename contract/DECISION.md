# ProofOfLifeVault Decision Record

## The product

A self-sovereign inheritance vault: an owner deposits funds, names beneficiaries with percentage
shares, and keeps the vault entirely theirs by periodically proving they're still around. A missed
check-in starts a fixed, generous contestation window that a fresh check-in (or, optionally,
consensus-verified evidence of continued public activity) cancels outright; only if that window
elapses with zero signal of life through any channel does the vault become inheritable.

## Counterfactual: why not just a timelock

The simplest version of this idea needs no blockchain intelligence at all -- release funds if
nobody calls a function by deadline X is a timestamp comparison any smart contract can already do,
and several non-GenLayer projects already ship exactly that. The problem that plain design leaves
unsolved is the single most common real failure mode of self-custodied crypto: the owner is alive,
active, and reachable through any number of public channels, but has lost access to (or simply
forgotten) the one specific wallet a given vault happens to listen to. A pure timelock cannot
distinguish that from genuine disappearance. `run_life_signal_check` exists specifically to close
part of that gap: a consensus round can check public evidence a plain timelock has no way to look
at, and cancel a trigger on the strength of it -- the same "verify something real about the world,
not decidable from on-chain state alone" value proposition every other contract in this series is
built around, applied here to the one moment it matters most.

## Why the aggregation rule for life-signal evidence is deliberately asymmetric

Every other consensus round in this series treats ambiguity symmetrically: an unclear result stays
unresolved and gets retried, without a directional bias toward one outcome or the other, because
the two ways a round could be wrong are roughly comparable in cost (a delayed insurance payout
versus a wrongly-early one; a delayed reputation update versus a stale one). This contract cannot
make that assumption. Concluding `NO_RECENT_ACTIVITY` moves a vault one step closer to an
irreversible release of someone's life savings; concluding `RECENT_ACTIVITY_FOUND` merely leaves a
trigger running a bit longer, which the owner can still cancel with a single check-in transaction
at any moment. Treating those two errors as equally costly would be a mistake specific to this
contract's subject matter, so the aggregation rule is built asymmetrically on purpose: any single
registered, fetchable source finding activity is sufficient to conclude the person is likely
alive; concluding the opposite requires every registered, fetchable source to agree, and a single
`COULD_NOT_DETERMINE` anywhere in that set forces the round to `INSUFFICIENT_EVIDENCE` rather than
a confident negative. The prompt tells the model to prefer `COULD_NOT_DETERMINE` over guessing for
the same reason -- but as with every other trust boundary in this series, the actual gating is
enforced in this contract's own code (`gated_result`), not left to the model reliably following
that instruction on its own.

## Why fetch-availability is forced by code, not merely requested by prompt

An earlier draft of `_consensus_life_signal` asked the model to report `NOT_APPLICABLE` for any
source that was not registered or could not be fetched, but never actually enforced that at the
code level -- meaning a model that ignored the instruction (or was fed a page containing
misleading text after a fetch technically "succeeded" against a wrong target) could claim
`ACTIVITY_AFTER_CHECKIN` or `NO_ACTIVITY_AFTER_CHECKIN` for a source this contract's own code knew
had never actually been examined. This is exactly the class of mistake ReputationAttestor's own
review already caught once (a model's self-reported claim about evidence availability is not a
security boundary) and CoverMesh's numeric adapters were built to avoid from the start (the model
extracts, the code decides what the extraction is allowed to mean). The fix threads the
code-observed `*_registered`/`*_fetched` facts through the consensus round as plain data (computed
in `leader()` from the URL fields and the fetch outcome, never from anything the model said) and
forces the corresponding result to `NOT_APPLICABLE` whenever either is false, regardless of what
the model claimed -- closing the gap the same way, for the same underlying reason, as the fixes
already applied to the other two contracts in this series.

## Why fetch-target hardening is reused verbatim rather than re-derived

Life-signal URLs (a GitHub profile, an X/Twitter profile, a personal website) are exactly the same
caller-influenced fetch-target shape ReputationAttestor's evidence links are, right down to two of
the three sources being the identical domains (GitHub, X/Twitter). Re-deriving fresh validation
logic for the same threat model would risk reintroducing a gap that was already found and fixed
once -- the private/reserved/metadata-IP denylist, the live DNS-resolution re-check, and the
redirect-status refusal are copied over unchanged, including their own documented residual
limitation (a platform-level redirect the web primitives might follow internally before this
contract ever sees the 3xx status). This is the same reasoning CoverMesh's numeric/categorical
adapters already established for this series: proven safety machinery should be reused exactly,
not reinvented with a subtly different (and unreviewed) shape each time a new contract happens to
need it.

## Why there is no admin, and why a finalized vault cannot be reclaimed

CoverMesh, ContentAuthenticityOracle, and ReputationAttestor each give an admin control over a
genuinely shared safety parameter -- something that, if misconfigured, would affect many other
participants' outcomes at once (a pool's concentration cap, a content type's fee, an emergency
blacklist). A digital-inheritance vault has no equivalent shared surface: every parameter belongs
to exactly one person's own money and their own family's arrangement, and nothing about one
vault's configuration ever touches another vault's economics or safety margins. There is
accordingly nothing here an admin could safely be responsible for, so this contract has none --
and by the same logic, once a vault reaches `INHERITABLE` and beneficiaries begin claiming, there
is deliberately no owner-override path back, however the owner might reappear. Building one would
require some third party (an admin, an oracle, a court) to arbitrate a dispute between an owner
and beneficiaries who may have already spent what they received -- exactly the kind of centralized
arbitration this contract's entire design (front-loading every protection into the check-in
interval, the fixed contestation window, and the life-signal net) exists to avoid needing in the
first place. The honest cost of that choice is stated plainly in the README rather than glossed
over: a genuinely wrongful finalization has no recourse in this contract.

## Why `check_in()` always overrides any life-signal verdict, unconditionally

A consensus round, however carefully aggregated, is still inferring life from indirect public
evidence. A `check_in()` transaction is direct: it requires a signature from a key the owner
controls, which is the strongest proof of life this or any contract can ask for. Allowing any
consensus outcome -- even a confident `NO_RECENT_ACTIVITY` verdict already on record -- to somehow
outrank or delay a fresh manual check-in would invert the actual reliability ordering of the two
signals. `check_in()` therefore short-circuits directly to `ACTIVE` and clears any in-progress
trigger unconditionally, with no dependency on, or interaction with, whatever the life-signal
check most recently concluded.

## v1.1: a self-review pass, before any external review, found and fixed five real gaps

Every other contract in this series was hardened in response to an external reviewer's feedback.
This contract's first hardening pass came from deliberately re-reading its own logic line by line
looking for the same classes of mistake those reviews already caught elsewhere -- catching them
before submission is strictly better than catching them after. Five real issues were found:

**1. `finalize_inheritance` computed `distributable_balance` after its external transfer, not
before.** The original ordering wrote `status=INHERITABLE`, transferred the keeper reward, and
only THEN snapshotted `distributable_balance`. Every other value-moving function in this contract
(`claim_share`, `owner_withdraw`, `_pay_keeper_if_affordable`'s own internal ordering) already
follows checks-effects-interactions -- write all state, then transfer -- specifically to avoid a
reentrant call observing stale state. `finalize_inheritance` alone violated its own contract's
pattern: a reentrant `claim_share` during the reward transfer would have seen
`distributable_balance` still at its pre-finalization value of zero, permanently marking that
beneficiary's `claimed` flag true against a zero payout. Rather than reason about whether GenVM's
execution model actually permits this kind of reentrancy, the fix removes the question entirely:
every field finalize_inheritance touches is computed and written before the one transfer at the
end, exactly like every other function here.

**2. `check_in()` silently no-op'd on an already-`INHERITABLE` vault.** An owner who reappears
after finalization and calls `check_in()` out of habit or hope would have gotten a successful
transaction that changed nothing meaningful -- `last_check_in_at` would update, but with no path
back to `ACTIVE`, that update has no effect on anything. A successful-looking transaction that
silently does nothing is worse than an honest rejection: it invites the false belief that the
vault might still be recoverable. `check_in()` now explicitly rejects with a clear message when
the vault is already `INHERITABLE`.

**3. Rounding dust could get permanently stuck with no beneficiary able to claim it.** Every
beneficiary's share is `floor(distributable_balance * bps / 10000)`; because bps sum to exactly
10000, the sum of everyone's floor shares can only ever be less than or equal to
`distributable_balance`, never more -- but "less than" means a few wei of dust are mathematically
guaranteed whenever the shares don't divide evenly, and once every beneficiary has claimed their
own exact floor share, that dust has no owner left to claim it. The fix has the LAST beneficiary
to claim (tracked via a new `claimed_count` field compared against `beneficiary_count`) receive
the vault's exact remaining balance instead of their own floor share -- always at least as much as
before, sweeping the dust to whoever happens to claim last rather than abandoning it. A few wei of
claim-order advantage is an explicitly accepted, economically meaningless trade-off for guaranteed
full distribution.

**4. `claim_share` was the one write method that didn't check the contract clock was available.**
Every other state-changing method in this contract checks `if now == "": raise` before proceeding,
because a failed clock read is a transient platform issue, not a business-logic rejection, and
letting it through silently would have stored `claimed_at` as an empty string on an otherwise
successful claim. Brought in line with every sibling method for the same reason they all have it.

**5. The GitHub life-signal fetch was needlessly routed through the caller-controlled-host safety
pipeline.** `_safe_render_checked` (DNS-resolution check, then a redirect-status preflight, then
the actual render -- up to four non-deterministic operations) exists specifically for
`twitter_url`/`website_url`, whose *host* a caller chooses. The GitHub fetch's host is always the
fixed, trusted `api.github.com` this contract builds itself from an extracted username -- exactly
the same reasoning ReputationAttestor's own github fetch already applies, and exactly why RA never
routes its own github fetch through that pipeline either. Copy-pasting the checked variant onto a
fetch that never needed it wasn't a security bug, but it needlessly multiplied this round's
non-determinism cost for zero safety benefit; the fix brings the github fetch back to plain
`_safe_render`, matching precedent and keeping the round's total non-determinism budget in line
with what ReputationAttestor's own two-caller-controlled-source design already established as
acceptable.
