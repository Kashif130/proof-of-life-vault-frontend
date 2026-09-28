# Proof of Life Vault — frontend

A premium, fully wired frontend for the `ProofOfLifeVault` Intelligent Contract on
[GenLayer](https://genlayer.com): create a self-sovereign digital-inheritance vault, deposit
funds, name beneficiaries, check in to keep it yours, and — if you ever go quiet — let it become
inheritable through a fixed, generous, permissionless process.

Built with Vite + React + TypeScript + Tailwind, talking to the chain directly through
[`genlayer-js`](https://www.npmjs.com/package/genlayer-js). No backend, no API keys.

## What's included

- **Every contract method**, wired end to end: create/update a vault, deposit, owner-withdraw,
  check-in (owner or backup signer), trigger/contest/finalize the inheritance lifecycle, the
  optional consensus life-signal check, and per-beneficiary claiming.
- **A browser-native wallet**, so nobody needs to install anything first:
  - **Create a wallet in one click** — a fresh key pair is generated client-side and encrypted
    with a password you choose (AES-GCM, PBKDF2-derived key). Nothing ever leaves the browser.
  - **Export / reveal the private key** at any time, to back it up or move it elsewhere.
  - **Import an existing private key** instead, if you already have one.
  - **Connect any EVM browser wallet** (MetaMask, Rabby, Coinbase Wallet, Trust, OKX and other EIP-6963 / injected wallets) as an alternative to the
    built-in one.
- **Pages**: an overview/landing page, vault creation, a full owner dashboard, a public explorer
  of every registered vault, a public per-vault page (deposit / trigger / run the life-signal
  check / finalize — all permissionless, exactly as the contract allows), and a claim flow for
  beneficiaries.
- A design system themed around the idea of a vault and a ledger — not a generic SaaS-card kit.

## 1. Deploy the contract first

This repo is the **frontend only**. You need a deployed `ProofOfLifeVault` contract address
before anything here will work.

1. Open [studio.genlayer.com](https://studio.genlayer.com).
2. Create a new contract and paste in `ProofOfLifeVault.py`.
3. Deploy it on StudioNet and copy the resulting contract address.

(You can also deploy with the GenLayer CLI / `genlayer-js`'s `deployContract`, or against
`localnet` if you're running a local GenLayer node — see the network options below.)

## 2. Configure the frontend

```bash
cp .env.example .env
```

Edit `.env`:

```bash
VITE_CONTRACT_ADDRESS=0xYourDeployedContractAddress
VITE_GENLAYER_NETWORK=studionet   # studionet | localnet | testnetAsimov | testnetBradbury
```

## 3. Run it locally

```bash
npm install
npm run dev
```

## 4. Deploy to Vercel

This repo is Vercel-ready as-is:

1. Push it to a Git repository and import it in Vercel (framework preset: **Vite**).
2. Add `VITE_CONTRACT_ADDRESS` and `VITE_GENLAYER_NETWORK` as Environment Variables in the
   Vercel project settings (same values as your `.env`).
3. Deploy. `vercel.json` already includes the SPA rewrite so client-side routes
   (`/vault/:owner`, `/claim/:owner`, …) work on refresh and on direct link.

## Notes on the built-in wallet

The generated wallet is a convenience signer for a Studio/testnet environment, not a hardened
production wallet:

- The private key only ever exists in memory (while unlocked) or encrypted in `localStorage`.
  Clearing site data / a different browser / a different device means a different wallet unless
  you've exported and re-imported the key.
- There's no recovery phrase flow — the exported private key **is** the backup. Store it like
  one.
- Studio/testnet accounts need a native-token balance to pay for consensus/keeper fees on writes.
  If a transaction fails with an insufficient-funds-style error, fund the connected address first
  (via GenLayer Studio's own tooling, or by depositing from an already-funded account).

## Project structure

```
src/
  lib/           contract + chain + wallet-crypto + formatting helpers (no UI)
  context/       WalletContext (burner + injected wallets), ToastContext
  components/    shared UI primitives, layout, wallet panel, vault-specific widgets
  hooks/         useVault (polling reads), useCountdown
  pages/         Landing, CreateVault, Dashboard, Explore, VaultDetail, Claim
```

## Honest limitations (inherited from the contract itself)

- A finalized vault cannot be reclaimed, even if the owner reappears.
- A permanently lost key with no backup signer configured has no clean resolution short of the
  timeout — set a backup signer and life-signal URLs in advance.
- The backup signer can only prove life, never touch funds or configuration.
- The life-signal check is best-effort, not proof.
- There's no sybil resistance on beneficiaries and no legal-executor fast path.

See `DECISION.md` and the contract's own header comment in the original submission for the full
design rationale.


## Troubleshooting

### `NonceTooHigh(expected=219,actual=1699)` when creating a vault or depositing

The transaction was rejected by the node before it reached the contract, so nothing was written.
It means the wallet's cached transaction count for this network (1699) is ahead of the node's
(219). Causes: a Studio/local network reset, or the same account having been used on another
network with the same chain id.

The app now also switches (or adds) the GenLayer network in an injected wallet before every
write, so a wallet left on a different network can no longer stamp a foreign nonce.

Fix if it still happens: reset the wallet's cached nonce for this network (MetaMask: Settings > Advanced > Clear
activity tab data; Rabby: Settings > Clear Pending), confirm the wallet is on the same GenLayer
network as `VITE_GENLAYER_NETWORK`, then retry. The built-in wallet is not affected. The app now
shows this guidance in the error toast instead of the raw RPC error.

### Network handling on wallet connect

When an injected wallet is connected, the app immediately asks it to switch to the GenLayer network
set by `VITE_GENLAYER_NETWORK` (default: StudioNet). If the network isn't in the wallet yet, the
wallet shows its "Add network" popup; if it is, the wallet switches automatically. The same check
runs again before every transaction.
