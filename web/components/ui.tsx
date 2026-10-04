import type { ReactNode } from "react";
import { formatUnits } from "viem";

const AVATAR = ["#B9A2F0", "#F7C948", "#FFB08F", "#F9A8C9", "#7CC1F5", "#A8E6CF", "#9AD0CC", "#FFD1BA"];

/** Coins are 18-decimal KOKO; show them like money people count, e.g. 20 or 23.2. */
export function coins(wei: bigint): string {
  const n = Number(formatUnits(wei, 18));
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function Avatar({ address, name }: { address: string; name: string }) {
  const h = parseInt(address.slice(2, 10), 16);
  const initials = (name.trim() || "?").slice(0, 2).toUpperCase();
  return (
    <span className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-black text-ink" style={{ background: AVATAR[h % AVATAR.length] }}>
      {initials}
    </span>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col px-5 pb-5 pt-4">{children}</main>;
}

export function RoomHeader({ code, balance }: { code: string; balance?: bigint }) {
  return (
    <header className="flex items-center justify-between">
      <span className="text-[13px] font-extrabold text-ink-2">
        Room <b className="tracking-[.12em] text-ink">{code}</b>
      </span>
      <span data-balance-pill className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[14px] font-black tabular-nums">
        <span className="inline-block h-3.5 w-3.5 rounded-full bg-gold shadow-[inset_0_-2px_0_var(--color-gold-d)]" />
        {balance === undefined ? "0" : coins(balance)}
      </span>
    </header>
  );
}

export function PrimaryButton(props: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      className="w-full rounded-full bg-coral py-4 text-[16px] font-black text-white shadow-[0_10px_22px_rgba(255,107,74,.30)] transition hover:bg-coral-d active:scale-[.98] disabled:opacity-45 disabled:shadow-none"
    >
      {props.children}
    </button>
  );
}
