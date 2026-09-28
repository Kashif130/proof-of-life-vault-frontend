import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Fingerprint, Radio, Scale, ShieldOff } from "lucide-react";
import { Card } from "../components/ui";

const steps = [
  {
    n: "01",
    title: "Create your vault",
    body: "Set a check-in interval and name beneficiaries with percentage shares. Only you can do this, and only while the vault is active.",
  },
  {
    n: "02",
    title: "Deposit and check in",
    body: "Fund it yourself, or let family top it up — deposits are permissionless. A plain check-in transaction, whenever suits you, keeps it entirely yours.",
  },
  {
    n: "03",
    title: "If you go quiet",
    body: "Once your interval lapses, anyone may permissionlessly start a fixed 30-day contestation window. A fresh check-in cancels it instantly, no matter what.",
  },
  {
    n: "04",
    title: "Beneficiaries claim",
    body: "If the window elapses with no signal through any channel, the vault becomes inheritable and each beneficiary claims their share directly.",
  },
];

const principles = [
  {
    icon: Fingerprint,
    title: "A fresh check-in always wins",
    body: "No consensus verdict, however confident, can override an owner proving control of their own key. This is the one unconditional rule in the contract.",
  },
  {
    icon: Radio,
    title: "An optional, honest safety net",
    body: "Register a GitHub, X, or personal site. During a contestation window, anyone can ask the network to check them for activity since your last check-in — and if it finds any, the trigger cancels itself.",
  },
  {
    icon: Scale,
    title: "Built on asymmetric risk",
    body: "Releasing a living person's savings is severe and irreversible. Delaying a legitimate inheritance is an inconvenience. Every ambiguous case in this contract resolves toward not releasing funds.",
  },
  {
    icon: ShieldOff,
    title: "No admin, ever",
    body: "No protocol operator, no owner-of-owners, no emergency lever over any single vault. Every consequential decision is either your own action or a fact about elapsed time.",
  },
];

export function Landing() {
  return (
    <div className="space-y-24">
      <section className="grid gap-10 pt-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="font-display text-[42px] leading-[1.08] text-bone-100 sm:text-[52px]"
          >
            Yours for as long as you're here.
            <br />
            <span className="text-brass-400">Theirs the moment you're not.</span>
          </motion.h1>
          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-bone-400">
            Proof of Life Vault is a self-sovereign digital-inheritance contract on GenLayer.
            Deposit funds, name beneficiaries, and keep full control for as long as you
            periodically prove you're still around — the cheapest, strongest signal there is: a
            plain transaction from your own key.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/create"
              className="inline-flex items-center gap-2 rounded-md bg-brass-400 px-5 py-3 text-[14px] font-medium text-vault-950 hover:bg-brass-300"
            >
              Create your vault <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/explore"
              className="inline-flex items-center gap-2 rounded-md border border-vault-600 px-5 py-3 text-[14px] font-medium text-bone-100 hover:border-brass-400"
            >
              Explore vaults
            </Link>
          </div>
        </div>

        <Card className="p-6">
          <p className="text-[11px] uppercase tracking-wide text-bone-500">Reviewer summary</p>
          <dl className="mt-4 space-y-3 text-[13px]">
            <div className="flex justify-between gap-4 border-b border-vault-800 pb-3">
              <dt className="text-bone-500">Contestation window</dt>
              <dd className="text-bone-100">Fixed 30 days, on every vault</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-vault-800 pb-3">
              <dt className="text-bone-500">Check-in interval</dt>
              <dd className="text-bone-100">30 days – 2 years, your choice</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-vault-800 pb-3">
              <dt className="text-bone-500">Beneficiaries</dt>
              <dd className="text-bone-100">1–10, by percentage share</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-bone-500">Admin keys</dt>
              <dd className="text-bone-100">None — by design</dd>
            </div>
          </dl>
        </Card>
      </section>

      <section>
        <h2 className="font-display text-[26px] text-bone-100">How it works</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.n} className="border-t border-vault-700 pt-4">
              <span className="font-mono text-[12px] text-brass-400">{step.n}</span>
              <h3 className="mt-2 font-display text-[17px] text-bone-100">{step.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-bone-400">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-[26px] text-bone-100">
          A genuine intelligent contract, not just a timelock
        </h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-bone-400">
          A plain dead-man's switch needs no consensus at all — it's a timestamp comparison any
          contract can do. What GenLayer's consensus machinery adds is a real, optional safety net
          for the one scenario a pure timelock can't handle: an owner who is alive and active, but
          has lost access to the specific wallet a vault listens to.
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {principles.map((p) => (
            <Card key={p.title} className="p-5">
              <p.icon className="h-5 w-5 text-brass-400" strokeWidth={1.6} />
              <h3 className="mt-3 font-display text-[16px] text-bone-100">{p.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-bone-400">{p.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <Card className="p-6">
          <h2 className="font-display text-[20px] text-bone-100">Honest limitations</h2>
          <ul className="mt-4 space-y-3 text-[13px] leading-relaxed text-bone-400">
            <li>
              A finalized vault cannot be reclaimed. Once distribution begins, there is no owner
              override — even if the owner reappears.
            </li>
            <li>
              A permanently lost key with no backup signer configured has no clean resolution
              short of the timeout. Set a backup signer and life-signal URLs in advance to reduce
              this risk.
            </li>
            <li>
              The backup signer can only prove life — never touch funds or configuration.
            </li>
            <li>
              The life-signal check is best-effort, not proof: a source that can't be read
              reliably is treated as inconclusive, never as a confident "no activity".
            </li>
            <li>
              There's no sybil resistance on beneficiaries and no legal-executor fast path — every
              vault runs on the same fixed timeline regardless of real-world circumstances.
            </li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
