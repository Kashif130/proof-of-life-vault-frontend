# ProofOfLifeVault

*Version 1.1 -- includes a pre-submission self-review pass; see "v1.1: a self-review pass" in
DECISION.md for the five corrections it made.*

A self-sovereign digital-inheritance vault. An owner deposits funds and names beneficiaries with
percentage shares. As long as they periodically prove they're still around -- a plain `check_in()`
transaction, the cheapest and strongest proof of life there is -- the vault stays entirely theirs
to withdraw from. If they go quiet past their own configured interval, anyone may permissionlessly
start a fixed, generous 30-day contestation window; if no check-in arrives before it elapses, the
vault becomes inheritable and each beneficiary permissionlessly claims their share. No admin, no
protocol operator, and no third party ever has a lever over any single vault.

## Reviewer summary

- **Live app**: not included in this submission -- see "Scope" below.
- **Source**: part of this repository, under `proof-of-life-vault/`.
- **Contract**: add StudioNet contract address here when deployed.
- **Main workflow**: an owner creates a vault (`create_vault`) with beneficiaries and a check-in
  interval, then deposits funds (`deposit`, permissionless -- family can top it up too) and
  periodically calls `check_in` -> if the interval lapses, anyone permissionlessly calls
  `trigger_inheritance`, starting a fixed 30-day contestation window during which a fresh
  `check_in` (or an optional consensus-verified `run_life_signal_check`) instantly cancels it ->
  if the window elapses uncancelled, anyone calls `finalize_inheritance` -> each beneficiary
  permissionlessly calls `claim_share` for their percentage of the vault's final balance.

## Why this is a genuine Intelligent Contract, not just a timelock

A plain dead-man's switch -- release funds if nobody calls check-in by deadline X -- needs no
consensus round at all; it's a timestamp comparison any smart contract can do. What GenLayer's
consensus machinery adds here is a real, optional safety net for the scenario a pure timelock
cannot handle: an owner who is alive and digitally active, but has lost access to (or simply
forgotten) the one specific wallet this vault listens to. `run_life_signal_check` lets anyone ask
a consensus round to check the owner's registered public pages (GitHub, X/Twitter, a personal
website) for activity dated after their last formal check-in -- and if it finds any, the trigger
is cancelled exactly as if they'd checked in themselves. This is never required for the vault to
work (a vault with no registered life-signal URLs, or one nobody bothers to re-check, is governed
purely by the timeout), but it materially reduces the odds of an unnecessary release.

## The asymmetric-risk design principle this contract is built around

Every other contract in this series treats an unresolved or ambiguous evidence round the same
way: don't confidently resolve, stay open, let someone retry. This contract shares that instinct
but sharpens it, because the two mistakes it can make are wildly unequal in cost. Releasing a
living person's life savings to their heirs is a severe, likely-irreversible harm. Delaying a
legitimate inheritance by staying in contestation a while longer is, by comparison, an
inconvenience. That asymmetry shapes two concrete design decisions:

1. **The life-signal check's aggregation is deliberately lopsided.** Finding activity on ANY
   single registered source is enough to cancel the trigger -- a false positive here only delays
   things further. Concluding there is NO recent activity (a step toward an irreversible release)
   requires EVERY registered, fetchable source to agree there is none; if even one source's
   evidence is ambiguous, the round resolves to `INSUFFICIENT_EVIDENCE`, not a confident negative.
2. **A fresh manual check-in always wins, unconditionally.** No consensus verdict, however
   confident, can override an owner proving control of their own key. `check_in()` cancels a
   trigger immediately and always, regardless of what any life-signal round concluded or is
   currently mid-cooldown on.

## Architecture

- `contracts/ProofOfLifeVault.py` -- a single Intelligent Contract: self-sovereign vault
  creation and configuration (self-only, ACTIVE-only), permissionless funding and time-gated
  lifecycle transitions (`trigger_inheritance` / `finalize_inheritance`), an optional bounded
  consensus round (`_consensus_life_signal`) reusing the exact fetch-target hardening already
  reviewed and corrected on this series' other contracts, and deterministic, non-consensus,
  per-beneficiary claiming.
- `tests/direct/` -- direct-VM `gltest` tests covering vault creation and validation, funding and
  owner withdrawal, check-in (including the backup-signer path), the full trigger ->
  contestation -> finalize -> claim lifecycle, every life-signal aggregation case (single-source
  activity, all-negative, one-undetermined-forces-insufficient), cooldown and retry, and the
  fetch-target safeguard blocking a life-signal URL that resolves to a private address.

### Contract methods

| Method | Kind | Consensus round? | What it does |
| --- | --- | --- | --- |
| `create_vault(...)` | write, self-only | No | Creates the caller's one vault: interval, beneficiaries, optional life-signal URLs. |
| `update_beneficiaries` / `update_life_signals` / `update_check_in_interval` | write, owner-only, ACTIVE-only | No | Reconfigure a vault that hasn't been triggered. |
| `update_backup_signer(addr, enabled)` | write, owner-only | No | Names a second address that may also `check_in` on the owner's behalf. |
| `deposit(owner)` | payable write, permissionless | No | Adds funds to any vault -- family and friends may contribute too. |
| `owner_withdraw(amount)` | write, owner-only, ACTIVE-only | No | Withdraws the owner's own funds at will; this is not a one-way lock. |
| `check_in(owner)` | write, owner or backup signer | No | The primary proof-of-life signal. Immediately cancels any in-progress trigger. |
| `trigger_inheritance(owner)` | write, permissionless | No | Starts the fixed 30-day contestation window once the check-in interval has lapsed. |
| `run_life_signal_check(owner)` | write, permissionless | **Yes -- once per attempt** | Optional safety net: checks registered public pages for post-check-in activity. |
| `finalize_inheritance(owner)` | write, permissionless | No | Locks in the distributable balance once the contestation window elapses uncancelled. |
| `claim_share(owner)` | write, permissionless (beneficiary-gated by effect) | No | Deterministic per-beneficiary payout of their configured percentage; the last beneficiary to claim sweeps any rounding dust so the vault always empties to exactly zero. |
| `get_vault` / `get_beneficiaries` / `get_claimable_amount` / `seconds_until_triggerable` / `seconds_until_finalizable` / `list_vaults` / `is_registered` | view | No | Reads. |

## Why there is no admin, unlike every other contract in this series

CoverMesh, ContentAuthenticityOracle, and ReputationAttestor each have an admin for a specific,
narrow reason: bounding a shared safety parameter (a peril type's caps, a content type's fee, an
emergency blacklist lever) that affects many other people's outcomes. A digital-inheritance vault
has no equivalent shared parameter -- every consequential decision about a vault (its interval,
its beneficiaries, its life-signal URLs, whether to withdraw) is exclusively the owner's own
business, and nothing about one vault's configuration ever touches another vault's safety margins
or economics the way, say, a shared liquidity pool's utilization does. There is nothing left for
an admin to safely be responsible for, so this contract has none.

## Scope of this submission

This submission is **Contract + Tests**. A frontend (create a vault, track the countdown, watch a
contestation window, claim a share) is a natural next step but is not included here.

## Honest limitations

- **A finalized vault cannot be reclaimed.** Once `finalize_inheritance` succeeds and beneficiaries
  begin claiming, there is no owner override, even if the owner reappears -- `check_in()` itself
  explicitly rejects on an already-finalized vault rather than silently no-opping, so a
  reappearing owner gets a clear answer instead of a misleading success. The entire safety
  design front-loads protection into the generous contestation window, the always-winning manual
  check-in, and the optional life-signal net; once all of those have run their course with zero
  signal through any channel, this contract treats that as final, the same way real-world
  inheritance already isn't clawed back once distributed and spent.
- **A permanently lost primary key, with no backup signer configured, has no clean resolution
  short of the timeout.** If an owner is alive and even publicly active, but has lost the specific
  wallet this vault listens to and never registered a backup signer or life-signal URLs, this
  contract has no way to distinguish that from genuine disappearance -- it will eventually release
  to beneficiaries after the interval and contestation window elapse. `update_backup_signer` and
  the life-signal URLs exist specifically to reduce this risk, but only if configured in advance.
- **The backup signer can only prove life, never touch funds or configuration.** This is a
  deliberate, narrow scope, not an oversight: naming a backup signer is a much smaller trust
  decision than granting withdrawal or beneficiary-editing rights, and `update_backup_signer`
  keeps it that way -- the backup signer can call `check_in()` and nothing else.
- **The life-signal check is best-effort, not proof.** X/Twitter pages rendered without
  authentication frequently give no reliable date signal to a renderer at all (the same limitation
  ReputationAttestor documents for the same reason), which is exactly why a single source's
  `COULD_NOT_DETERMINE` is enough to prevent a confident `NO_RECENT_ACTIVITY` verdict rather than
  being silently ignored.
- **No sybil resistance on beneficiaries, and no legal-executor fast path.** Anyone the owner
  names as a beneficiary is trusted at face value; there is no verification that a beneficiary
  address belongs to who the owner believes it does, and there is no mechanism for a designated
  executor to submit, say, a death certificate to shortcut the waiting period -- every vault runs
  on the same fixed timeline regardless of real-world circumstances.
