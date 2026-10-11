"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand";
import { Mascot } from "@/components/mascot";
import { Appear } from "@/components/motion";
import { PrimaryButton, Screen } from "@/components/ui";

const CODE = /^[A-HJ-NP-Z2-9]{6}$/;

export default function Join() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const valid = CODE.test(code);
  // Six characters that cannot be a code (the alphabet has no 0, 1, I or O): say so, with one shake.
  const wrong = code.length === 6 && !valid;
  return (
    <Screen>
      <Logo className="self-center" />
      <Appear className="flex flex-1 flex-col items-center justify-center gap-5 py-6 text-center">
        <Mascot mood={valid ? "happy" : "surprised"} size={176} disc priority />
        <h1 className="text-[30px] font-black leading-[1.1] tracking-[-.02em]">
          Guess together.
          <br />
          <span className="text-coral">The pot really moves.</span>
        </h1>
      </Appear>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) router.push(`/r/${code}`);
        }}
      >
        <label htmlFor="code" className="text-center text-[13px] font-bold text-ink-3">
          Room code
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          placeholder="DEVW3J"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={wrong}
          className={`rounded-[18px] border-2 bg-surface py-3.5 pl-[.28em] text-center text-[26px] font-black uppercase tracking-[.28em] outline-none placeholder:text-[#E3D2C6] focus:border-coral ${wrong ? "shake border-coral" : "border-line"}`}
        />
        {wrong && <p className="text-center text-[13px] font-extrabold text-coral-d">That doesn&apos;t look like a room code. Check it with your host.</p>}
        <PrimaryButton type="submit" disabled={!valid}>
          Enter room →
        </PrimaryButton>
        <p className="text-center text-[13px] font-bold text-ink-3">Nothing to install. You just need a name.</p>
      </form>
    </Screen>
  );
}
