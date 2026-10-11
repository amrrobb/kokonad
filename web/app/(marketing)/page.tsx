import Image from "next/image";
import Link from "next/link";

// Landing, direction 1B from design/handoff/landing.html. Copy and layout kept as approved.
// "Pot 21" and "+4.2" are illustration, not live figures (10 people × play 2 + seed 1).

const STEPS = [
  { icon: "/mascot/step-write-256.png", n: 1, title: "Write a question" },
  { icon: "/mascot/step-answer-256.png", n: 2, title: "Friends answer from their phones" },
  { icon: "/mascot/step-split-256.png", n: 3, title: "Pot splits the same second" },
];

const pad = "px-[clamp(20px,5vw,72px)]";

export default function Landing() {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        background:
          "radial-gradient(60vw 50vw at 92% 12%, #FBE0CF, transparent 66%), radial-gradient(50vw 40vw at 4% 96%, #FBE0CF, transparent 66%) #FBF3EA",
      }}
    >
      <header className={`flex items-center justify-between py-[clamp(18px,2vw,28px)] ${pad}`}>
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/mascot/logo-128.png" alt="" width={34} height={34} priority />
          <span className="text-[22px] font-black tracking-[-.02em]">Kokonad</span>
        </Link>
        {/* "Sign in" returns here once Dynamic sign-in is configured; until then there is nothing to sign into. */}
      </header>

      <section className={`mx-auto grid w-full max-w-[1440px] items-center gap-8 pb-6 pt-[clamp(16px,3vw,40px)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))] ${pad}`}>
        <div className="flex flex-col gap-[22px] [text-wrap:pretty]">
          <span className="rise self-start whitespace-nowrap rounded-full bg-peach px-4 py-2 text-[13px] font-black">Live guessing games for community events</span>
          <h1 style={{ "--i": 1 } as React.CSSProperties} className="rise m-0 text-[clamp(38px,5vw,72px)] font-black leading-none tracking-[-.03em]">
            Guess together.
            <br />
            <span className="text-coral">The pot really moves.</span>
          </h1>
          <p style={{ "--i": 2 } as React.CSSProperties} className="rise m-0 max-w-[560px] text-[clamp(15px,1.4vw,20px)] font-bold leading-[1.5] text-ink-2">
            Write a question in 10 seconds. The prize goes to whoever earned it, the moment you call it. Nobody checks, nobody holds money.
          </p>
          <div style={{ "--i": 3 } as React.CSSProperties} className="rise mt-1.5 flex flex-wrap gap-3">
            <Link href="/host" className="whitespace-nowrap rounded-full bg-coral px-[34px] py-[18px] text-[17px] font-black text-white shadow-[0_10px_22px_rgba(255,107,74,.30)] transition hover:bg-coral-d active:scale-[.98]">
              Create room →
            </Link>
            <Link href="/join" className="whitespace-nowrap rounded-full border border-line bg-surface px-7 py-[18px] text-[17px] font-black transition active:scale-[.98]">
              Have a code? Join
            </Link>
          </div>
        </div>

        <div style={{ "--i": 2 } as React.CSSProperties} className="rise relative mx-auto flex aspect-square w-full max-w-[600px] items-center justify-center">
          <div className="absolute h-[86%] w-[86%] translate-x-[3%] translate-y-[3%] rounded-full bg-peach" />
          <Image src="/mascot/mascot-surprised.png" alt="Kokonad coconut mascot" width={1024} height={1024} priority className="drift relative h-[94%] w-[94%] object-contain" />
          <span style={{ "--i": 1 } as React.CSSProperties} className="drift absolute left-0 top-[10%] flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface px-4 py-2.5 text-[15px] font-black">
            <span className="h-3.5 w-3.5 rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #FFE38A, #F2B72B 55%, #D99A12)" }} />
            Pot 21
          </span>
          <span style={{ "--i": 2 } as React.CSSProperties} className="drift absolute bottom-[12%] right-0 whitespace-nowrap rounded-full border border-line bg-surface px-4 py-2.5 text-[15px] font-black text-green">+4.2 in your balance</span>
        </div>
      </section>

      <section className={`mx-auto grid w-full max-w-[1440px] gap-4 pt-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))] ${pad}`}>
        {STEPS.map((s) => (
          <div key={s.n} style={{ "--i": 3 + s.n } as React.CSSProperties} className="rise flex items-center gap-[18px] rounded-[22px] border border-line bg-card p-[22px] transition-transform duration-200 hover:-translate-y-1">
            <span className="flex h-[60px] w-[60px] flex-none items-center justify-center rounded-[18px] bg-peach">
              <Image src={s.icon} alt="" width={52} height={52} />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-extrabold text-ink-3">Step {s.n}</span>
              <span className="text-[18px] font-black leading-[1.2]">{s.title}</span>
            </div>
          </div>
        ))}
      </section>

      <div className="mx-auto mt-7 w-[calc(100%-2*clamp(20px,5vw,72px))] max-w-[1296px] rounded-full bg-peach px-7 py-4 text-center text-[clamp(14px,1.1vw,16px)] font-black">
        Built for rooms of 5–50 people. Runs on Monad.
      </div>

      <footer className={`mt-auto flex flex-wrap items-center justify-between gap-3 pb-7 pt-14 text-[13px] font-bold text-ink-3 ${pad}`}>
        <div className="flex gap-[18px]">
          <a href="https://github.com/amrrobb/kokonad/blob/main/LICENSE">MIT</a>
          <a href="https://github.com/amrrobb/kokonad">GitHub</a>
        </div>
        <span>Made in Yogyakarta</span>
      </footer>
    </div>
  );
}
