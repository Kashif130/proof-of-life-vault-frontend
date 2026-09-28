import { NavLink, Outlet } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { WalletPanel } from "./WalletPanel";
import { activeNetworkLabel, isContractConfigured } from "../lib/chains";

const navItems = [
  { to: "/", label: "Overview", end: true },
  { to: "/create", label: "Create a vault" },
  { to: "/dashboard", label: "My vault" },
  { to: "/explore", label: "Explore" },
  { to: "/claim", label: "Claim a share" },
];

export function Layout() {
  return (
    <div className="min-h-screen bg-vault-950 bg-grain text-bone-100 [background-size:18px_18px]">
      {!isContractConfigured && (
        <div className="border-b border-clay-500/40 bg-clay-500/10 px-4 py-2 text-center text-[12px] text-clay-400">
          No contract address is configured yet — set VITE_CONTRACT_ADDRESS in your .env before
          deploying.
        </div>
      )}
      <header className="border-b border-vault-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <NavLink to="/" className="flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-brass-400" strokeWidth={1.6} />
            <span className="font-display text-[19px] leading-none text-bone-100">
              Proof of Life <span className="text-brass-400">Vault</span>
            </span>
          </NavLink>
          <nav className="flex flex-wrap items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                    isActive ? "bg-vault-800 text-brass-300" : "text-bone-400 hover:text-bone-100"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <WalletPanel />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-vault-800">
        <div className="mx-auto max-w-6xl px-5 py-8 text-[12px] text-bone-500">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              No admin. No protocol operator. Every consequential decision belongs to the vault's
              owner, enforced by the contract, not by a person.
            </p>
            <p className="font-mono text-bone-600">{activeNetworkLabel}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
