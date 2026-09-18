"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PrimaryButton, Screen } from "@/components/ui";

const CODE = /^[A-HJ-NP-Z2-9]{6}$/;

export default function Join() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const valid = CODE.test(code);
  return (
    <Screen>
      <div className="flex flex-1 flex-col justify-center gap-6">
        <div>
          <p className="text-[15px] font-black text-coral">Kokonad</p>
          <h1 className="mt-1 text-[30px] font-black leading-[1.1] tracking-[-.02em]">
            Guess together.
            <br />
            The pot really moves.
          </h1>
        </div>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) router.push(`/r/${code}`);
          }}
        >
          <label htmlFor="code" className="text-[13px] font-bold text-ink-3">
            Room code
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            placeholder="DEVW3J"
            autoComplete="off"
            className="rounded-[18px] border-2 border-line bg-surface py-3 text-center text-[26px] font-black uppercase tracking-[.28em] outline-none focus:border-coral"
          />
          <PrimaryButton type="submit" disabled={!valid}>
            Enter room →
          </PrimaryButton>
        </form>
        <p className="text-center text-[13px] font-bold text-ink-3">Nothing to install. You just need a name.</p>
      </div>
    </Screen>
  );
}
