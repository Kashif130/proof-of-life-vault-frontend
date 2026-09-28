export type VaultStatus = "ACTIVE" | "TRIGGERED" | "INHERITABLE";

export interface Beneficiary {
  address: string;
  bps: number; // basis points, out of 10000
  claimed: boolean;
  claimed_at: string;
}

export interface VaultData {
  owner: string;
  has_backup_signer: boolean;
  backup_signer: string;
  check_in_interval_seconds: number;
  last_check_in_at: string;
  created_at: string;
  github_url: string;
  twitter_url: string;
  website_url: string;
  beneficiary_count: number;
  claimed_count: number;
  status: VaultStatus;
  triggered_at: string;
  contestation_deadline: string;
  finalized_at: string;
  balance: string; // wei, as decimal string
  distributable_balance: string;
  life_signal_check_attempts: number;
  last_life_signal_check_at: string;
  life_signal_verdict: string;
  life_signal_rationale: string;
}

export interface BurnerWallet {
  address: `0x${string}`;
  createdAt: string;
}

export type WalletMode = "none" | "burner-locked" | "burner-unlocked" | "injected";

/** A usable signer: an address, optionally paired with the private key that controls it
 *  (present for an unlocked burner wallet, absent for an injected/extension wallet, where
 *  the extension itself holds the key and signs via the browser). */
export interface Signer {
  address: `0x${string}`;
  privateKey?: `0x${string}`;
  /** The EIP-1193 provider of the injected wallet the user picked (absent for the burner). */
  provider?: import("./injectedWallets").Eip1193Provider;
}
