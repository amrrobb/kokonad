import Image from "next/image";
import Link from "next/link";

/** The mark and the name, as on the landing page. Every screen carries it (DESIGN.md §6). */
export function Logo({ size = 34, word = true, className = "" }: { size?: number; word?: boolean; className?: string }) {
  return (
    <Link href="/" aria-label="Kokonad, home" className={`flex shrink-0 items-center gap-2 ${className}`} data-testid="logo">
      <Image src="/mascot/logo-128.png" alt="" width={size} height={size} priority />
      {word && (
        <span aria-hidden="true" className="font-black tracking-[-.02em]" style={{ fontSize: Math.round(size * 0.62) }}>
          Kokonad
        </span>
      )}
    </Link>
  );
}
