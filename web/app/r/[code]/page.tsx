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
import { useSigner } from "@/lib/signer";
import { SignIn } from "@/components/sign-in";
import { Avatar, Coin, Moment, PrimaryButton, RoomHeader, Screen, coins } from "@/components/ui";
import { Mascot } from "@/components/mascot";
import { QuestionScreen } from "@/components/question";
import { motion } from "motion/react";
import { Appear, POP, PopItem } from "@/components/motion";

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
  const signer = useSigner();
  if (!signer) return <SignIn code={code} title="Almost in." body="Continue to get your account and your coins." />;
  // Keyed by account: signing in as someone else starts this screen over.
  return <Room key={signer.address} code={code} me={signer.address} />;
}

function Room({ code, me }: { code: string; me: Address }) {
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
        <Moment mood="oops" level={1} title="Can't reach the game right now." body="Check your connection and reload." />
      </Screen>
    );
  }
  if (roomQ.isLoading || (room && !view)) {
    return (
      <Screen>
        <RoomHeader code={code} />
        <Moment mood="surprised" level={1} title={`Finding room ${code}…`} />
      </Screen>
    );
  }
  if (room === null) {
    return (
      <Screen>
        <RoomHeader code={code} />
        <Moment mood="oops" level={1} title="Room not found." body="Check the code with your host.">
          <Link href="/join" className="ledge mt-3 rounded-full border border-line bg-surface px-6 py-3 font-black">
            Try another code
          </Link>
        </Moment>
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
            {/* Keyed by question: a new question starts from a clean screen. Without the key the previous
                question's pick stayed selected and its "already opened my answer" flag blocked every later reveal. */}
            <QuestionScreen key={String(questionQ.data.id)} room={room as Address} view={view} q={questionQ.data} onChange={refresh} />
          </div>
        </Screen>
      );
    }
    return (
      <Screen>
        <RoomHeader code={code} balance={balance} />
        <Appear className="mt-4 flex flex-1 flex-col gap-4">
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-2 text-center">
            <Mascot mood="sleepy" size={168} disc priority />
            <h1 className="mt-2 text-[30px] font-black leading-[1.1] tracking-[-.02em]">Hi, {myName}.</h1>
            <p className="font-extrabold text-ink-2">The host is setting up questions.</p>
          </div>
          <section className="rounded-[22px] border border-line bg-card p-4">
            <h2 className="text-[16px] font-black">In the room ({view.people.length})</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {view.people.map((p) => (
                <PopItem key={p.address} className={`flex items-center gap-1.5 rounded-full border bg-surface py-1 pl-1 pr-3 text-[13px] font-extrabold ${p.address === me ? "border-coral" : "border-line"}`}>
                  <Avatar address={p.address} name={p.name} />
                  {p.name}
                </PopItem>
              ))}
            </ul>
          </section>
          <p className="flex items-center gap-2.5 rounded-[18px] bg-peach px-4 py-3.5 text-[15px] font-black">
            <Coin size={22} />
            <span>{coins(view.me.deposit)} coins in your balance</span>
          </p>
          <p className="px-2 pb-1 text-center text-[13px] font-bold text-ink-3">Keep this screen open. The first question shows up here the moment the host opens it.</p>
        </Appear>
      </Screen>
    );
  }

  // Setup in progress or failed
  if (joining || failed) {
    return (
      <Screen>
        <RoomHeader code={code} />
        <div className="mt-6 flex flex-1 flex-col gap-5">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              {failed ? (
                <>
                  <h1 className="text-[24px] font-black leading-[1.15]">Something didn&apos;t go through.</h1>
                  <p className="mt-2 font-extrabold text-ink-2">{failed.message}</p>
                </>
              ) : (
                <>
                  <h1 className="text-[24px] font-black leading-[1.15]">Setting up your account…</h1>
                  <p className="mt-2 font-extrabold text-ink-2">Takes a few seconds. Don&apos;t close this tab.</p>
                </>
              )}
            </div>
            <Mascot mood={failed ? "oops" : "surprised"} size={96} disc />
          </div>
          <ul className="flex flex-col gap-2">
            {STEPS.map(([step, label]) => {
              const ok = done.includes(step);
              const bad = failed?.step === step;
              return (
                <li key={step} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-4 py-3 text-[14px] font-extrabold">
                  <motion.span
                    key={ok ? "ok" : bad ? "bad" : "wait"}
                    initial={ok || bad ? { scale: 0.3 } : false}
                    animate={{ scale: 1 }}
                    transition={POP}
                    className={`grid h-6 w-6 place-items-center rounded-full text-[12px] font-black ${ok ? "bg-green text-white" : bad ? "bg-danger text-white" : "bg-bg-2 text-ink-3"}`}
                  >
                    {ok ? "✓" : bad ? "!" : "…"}
                  </motion.span>
                  {label}
                </li>
              );
            })}
          </ul>
          {failed && (
            <div className="mt-auto flex flex-col gap-3">
              <PrimaryButton onClick={join}>Try again</PrimaryButton>
              <p className="text-center text-[13px] font-bold text-ink-3">Still stuck? Show this screen to your host.</p>
            </div>
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
        className="flex flex-1 flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) void join();
        }}
      >
        <Appear className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
          <Mascot mood={name.trim() ? "happy" : "surprised"} size={156} disc priority />
          <h1 className="mt-1 text-[30px] font-black leading-[1.1] tracking-[-.02em]">Almost in.</h1>
          <p className="font-extrabold text-ink-2">What should we call you?</p>
        </Appear>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 24))}
          placeholder="Your name"
          autoComplete="nickname"
          className="rounded-[18px] border-2 border-line bg-surface px-4 py-3.5 text-center text-[20px] font-black outline-none placeholder:text-[#D9C6BA] focus:border-coral"
        />
        <PrimaryButton type="submit" disabled={!name.trim()}>
          Join room
        </PrimaryButton>
      </form>
    </Screen>
  );
}
