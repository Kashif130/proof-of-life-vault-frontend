import { useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { Check, Copy, Loader2, X } from "lucide-react";
import { useToast } from "../context/ToastContext";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brass-400 text-vault-950 hover:bg-brass-300 disabled:bg-brass-600/50 disabled:text-vault-700 shadow-[0_1px_0_0_rgba(255,255,255,0.25)_inset]",
  secondary:
    "bg-transparent text-bone-100 border border-vault-600 hover:border-brass-400 hover:text-brass-300 disabled:opacity-40",
  ghost: "bg-transparent text-bone-400 hover:text-bone-100 disabled:opacity-40",
  danger: "bg-clay-500 text-bone-100 hover:bg-clay-400 disabled:bg-clay-600/40",
};

export function Button({
  variant = "primary",
  loading = false,
  icon,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium tracking-[0.01em] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-400 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function Card({
  children,
  className = "",
  as: Component = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
}) {
  return (
    <Component
      className={`rounded-lg border border-vault-700 bg-vault-900/80 shadow-vault backdrop-blur-sm ${className}`}
    >
      {children}
    </Component>
  );
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between">
      <span className="text-[13px] font-medium text-bone-200">{children}</span>
      {hint && <span className="text-[12px] text-bone-500">{hint}</span>}
    </div>
  );
}

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-md border border-vault-600 bg-vault-950/60 px-3 py-2.5 text-[14px] text-bone-100 placeholder:text-bone-500 outline-none transition-colors focus:border-brass-400 ${className}`}
      {...rest}
    />
  );
}

export function Textarea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-md border border-vault-600 bg-vault-950/60 px-3 py-2.5 text-[14px] text-bone-100 placeholder:text-bone-500 outline-none transition-colors focus:border-brass-400 ${className}`}
      {...rest}
    />
  );
}

export function HelperText({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "error" }) {
  return (
    <p className={`mt-1.5 text-[12px] ${tone === "error" ? "text-clay-400" : "text-bone-500"}`}>
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function Modal({
  title,
  onClose,
  children,
  width = "max-w-md",
}: {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  width?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-vault-950/80 p-4 backdrop-blur-sm">
      <div className={`w-full ${width} rounded-lg border border-vault-700 bg-vault-900 shadow-vault`}>
        <div className="flex items-center justify-between border-b border-vault-700 px-5 py-4">
          <h2 className="font-display text-[17px] text-bone-100">{title}</h2>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1 text-bone-500 hover:bg-vault-800 hover:text-bone-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Address / copy helpers
// ---------------------------------------------------------------------------

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 text-[12px] text-bone-500 hover:text-brass-300"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function AddressPill({ address, you = false }: { address: string; you?: boolean }) {
  const short = address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-vault-600 bg-vault-950/50 px-2.5 py-1 font-mono text-[12px] text-bone-200">
      {short}
      {you && <span className="rounded-full bg-brass-400/20 px-1.5 text-[10px] text-brass-300">you</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Toast viewport
// ---------------------------------------------------------------------------

export function ToastViewport() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-md border px-4 py-3 shadow-vault backdrop-blur ${
            t.kind === "error"
              ? "border-clay-500/50 bg-clay-500/10"
              : t.kind === "success"
                ? "border-verdigris-500/50 bg-verdigris-500/10"
                : "border-vault-600 bg-vault-900"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium text-bone-100">{t.title}</p>
              {t.detail && <p className="mt-0.5 text-[12px] text-bone-400">{t.detail}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-bone-500 hover:text-bone-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
