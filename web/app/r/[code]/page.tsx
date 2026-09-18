"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { encodeFunctionData, type Address } from "viem";
import { roomAbi, tokenAbi } from "@/lib/abi";
import { contracts } from "@/lib/deployments";
import { PlainError, send } from "@/lib/relay";
import { findRoom, readLatestQuestion, readRoom } from "@/lib/room";
import { getAccount } from "@/lib/signer";
import { Avatar, PrimaryButton, RoomHeader, Screen, coins } from "@/components/ui";
import { QuestionScreen } from "@/components/question";

type Step = "account" | "coins" | "join";
const STEPS: Array<[Step, string]> = [
  ["account", "Setting up account"],
  ["coins", "Grabbing your coins"],
  ["join", "Joining the room"],
];

function savedName(): string {
  try {
    return localStorage.getItem("kokonad:name") ?? "";
  } catch {
    return "";
  }
}

export default function RoomPage() {
  const code = String(useParams<{ code: string }>().code).toUpperCase();
  const me = getAccount().address;
  // The first render is "Finding room…", so reading the saved name here cannot cause a hydration mismatch.
  const [name, setName] = useState(() => (typeof window === "undefined" ? "" : savedName()));
  const [done, setDone] = useState<Step[]>([]);
  const [failed, setFailed] = useState<{ step: Step; message: string } | null>(null);
  const [joining, setJoining] = useState(false);

  const roomQ = useQuery({ queryKey: ["room-address", code], queryFn: () => findRoom(code), staleTime: Infinity });
  const room = roomQ.data;
  const viewQ = useQuery({
    queryKey: ["room", room, me],
    queryFn: () => readRoom(room as Address, me),
    enabled: !!room,
    refetchInterval: 2000,
  });
  const view = viewQ.data;
  const joined = !!view?.me.joined;
  const questionQ = useQuery({
    queryKey: ["question", room, me],
    queryFn: () => readLatestQuestion(room as Address, me),
    enabled: !!room && joined,
    refetchInterval: 2000,
  });
  const refresh = () => {
    void viewQ.refetch();
    void questionQ.refetch();
  };

  async function join() {
    if (!room || !view) return;
    try {
      localStorage.setItem("kokonad:name", name.trim());
    } catch {
      /* display name is a convenience only */
    }
    setJoining(true);
    setFailed(null);
    let step: Step = "account";
    try {
      setDone(["account"]);
      step = "coins";
      if (!view.sponsored) {
        // Pooled room: the participant brings their own coins (testnet: minted), then allows the room to take them.
        await send(contracts.KokoToken, encodeFunctionData({ abi: tokenAbi, functionName: "mint", args: [me, view.startingDeposit] }));
        await send(contracts.KokoToken, encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [room, view.startingDeposit] }));
      }
      setDone(["account", "coins"]);
      step = "join";
      await send(room, encodeFunctionData({ abi: roomAbi, functionName: "join", args: [code, name.trim()] }));
      setDone(["account", "coins", "join"]);
      await viewQ.refetch();
    } catch (err) {
      setFailed({ step, message: err instanceof PlainError ? err.message : "Something didn't go through. Your account is fine." });
    } finally {
      setJoining(false);
    }
  }

  if (roomQ.isError || viewQ.isError) {
    return (
      <Screen>
        <RoomHeader code={code} />
        <p className="mt-10 text-center font-extrabold text-ink-2">Can&apos;t reach the game right now. Check your connection and reload.</p>
      </Screen>
    );
  }
  if (roomQ.isLoading || (room && !view)) {
    return (
      <Screen>
        <RoomHeader code={code} />
        <p className="mt-10 text-center font-extrabold text-ink-3">Finding room {code}…</p>
      </Screen>
    );
  }
  if (room === null) {
    return (
      <Screen>
        <RoomHeader code={code} />
        <div className="mt-10 flex flex-col gap-3 text-center">
          <h1 className="text-[24px] font-black">Room not found.</h1>
          <p className="font-extrabold text-ink-2">Check the code with your host.</p>
          <Link href="/" className="mt-4 font-black text-coral">
            Try another code
          </Link>
        </div>
      </Screen>
    );
  }
  if (!view) return null;

  // Lobby
  if (view.me.joined) {
    const myName = view.people.find((p) => p.address === me)?.name || name;
    // Balance = coins still in the room (deposit) + coins won and paid out to the account. Both from the chain.
    const balance = view.me.deposit + view.me.held;
    if (questionQ.data) {
      return (
        <Screen>
          <RoomHeader code={code} balance={balance} />
          <div className="mt-6 flex flex-1 flex-col">
            <QuestionScreen room={room as Address} view={view} q={questionQ.data} onChange={refresh} />
          </div>
        </Screen>
      );
    }
    return (
      <Screen>
        <RoomHeader code={code} balance={balance} />
        <div className="mt-8 flex flex-col gap-5">
          <div>
            <h1 className="text-[30px] font-black leading-[1.1] tracking-[-.02em]">Hi, {myName}.</h1>
            <p className="mt-2 font-extrabold text-ink-2">The host is setting up questions.</p>
          </div>
          <section className="rounded-[22px] border border-line bg-card p-4">
            <h2 className="text-[16px] font-black">In the room ({view.people.length})</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {view.people.map((p) => (
                <li key={p.address} className={`flex items-center gap-1.5 rounded-full border bg-surface py-1 pl-1 pr-3 text-[13px] font-extrabold ${p.address === me ? "border-coral" : "border-line"}`}>
                  <Avatar address={p.address} name={p.name} />
                  {p.name}
                </li>
              ))}
            </ul>
          </section>
          <p className="rounded-[14px] bg-peach px-4 py-3 text-[14px] font-extrabold">✓ {coins(view.me.deposit)} coins in your balance</p>
          <p className="text-center text-[13px] font-bold text-ink-3">The game starts when the host opens the first question.</p>
        </div>
      </Screen>
    );
  }

  // Setup in progress or failed
  if (joining || failed) {
    return (
      <Screen>
        <RoomHeader code={code} />
        <div className="mt-10 flex flex-col gap-5">
          {failed ? (
            <div>
              <h1 className="text-[24px] font-black">Something didn&apos;t go through.</h1>
              <p className="mt-2 font-extrabold text-ink-2">{failed.message}</p>
            </div>
          ) : (
            <div>
              <h1 className="text-[24px] font-black">Setting up your account…</h1>
              <p className="mt-2 font-extrabold text-ink-2">Takes a few seconds. Don&apos;t close this tab.</p>
            </div>
          )}
          <ul className="flex flex-col gap-2">
            {STEPS.map(([step, label]) => {
              const ok = done.includes(step);
              const bad = failed?.step === step;
              return (
                <li key={step} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-4 py-3 text-[14px] font-extrabold">
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-[12px] font-black ${ok ? "bg-green text-white" : bad ? "bg-danger text-white" : "bg-bg-2 text-ink-3"}`}>
                    {ok ? "✓" : bad ? "!" : "…"}
                  </span>
                  {label}
                </li>
              );
            })}
          </ul>
          {failed && (
            <>
              <PrimaryButton onClick={join}>Try again</PrimaryButton>
              <p className="text-center text-[13px] font-bold text-ink-3">Still stuck? Show this screen to your host.</p>
            </>
          )}
        </div>
      </Screen>
    );
  }

  // Name entry
  return (
    <Screen>
      <RoomHeader code={code} />
      <form
        className="mt-10 flex flex-1 flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) void join();
        }}
      >
        <div>
          <h1 className="text-[30px] font-black leading-[1.1] tracking-[-.02em]">Almost in.</h1>
          <p className="mt-2 font-extrabold text-ink-2">What should we call you?</p>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 24))}
          placeholder="Your name"
          autoComplete="nickname"
          className="rounded-[18px] border-2 border-line bg-surface px-4 py-3 text-[18px] font-black outline-none focus:border-coral"
        />
        <div className="mt-auto">
          <PrimaryButton type="submit" disabled={!name.trim()}>
            Join room
          </PrimaryButton>
        </div>
      </form>
    </Screen>
  );
}
