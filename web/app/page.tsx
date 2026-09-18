import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-black">Kokonad</h1>
      <p className="text-ink-2">Live guessing games for community events.</p>
      <Link
        href="/spike"
        className="rounded-full bg-coral px-6 py-3 font-black text-white shadow-[0_10px_22px_rgba(255,107,74,.30)]"
      >
        Open the sign-in spike
      </Link>
    </main>
  );
}
