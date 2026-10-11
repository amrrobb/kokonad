"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { continueAsGuest, signInEnabled } from "@/lib/signer";
import { Logo } from "./brand";
import { Mascot } from "./mascot";
import { Appear } from "./motion";
import { PrimaryButton, RoomHeader, Screen } from "./ui";

type Props = { code?: string; title: string; body: string };

/**
 * Shown instead of a screen that needs an account when nobody is signed in.
 * Without sign-in configured there is nothing to offer: the tab's own account appears right after
 * the first client render, so this draws nothing for that one frame.
 */
export function SignIn(props: Props) {
  return signInEnabled ? <SignInScreen {...props} /> : null;
}

/** Only rendered under DynamicContextProvider, so the hook below is always in context. */
function SignInScreen({ code, title, body }: Props) {
  const { setShowAuthFlow, sdkHasLoaded } = useDynamicContext();
  return (
    <Screen>
      {code ? <RoomHeader code={code} /> : <Logo className="self-center" />}
      <div className="flex flex-1 flex-col gap-4">
        <Appear className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
          <Mascot mood="surprised" size={156} disc priority />
          <h1 className="mt-1 text-[30px] font-black leading-[1.1] tracking-[-.02em]">{title}</h1>
          <p className="max-w-[28ch] font-extrabold text-ink-2 [text-wrap:pretty]">{body}</p>
        </Appear>
        <div className="mt-auto flex flex-col gap-3">
          <PrimaryButton onClick={() => setShowAuthFlow(true)} disabled={!sdkHasLoaded}>
            {sdkHasLoaded ? "Continue" : "One moment…"}
          </PrimaryButton>
          <p className="text-center text-[13px] font-bold text-ink-3">Nothing to install. Your coins stay with your account.</p>
          <button type="button" onClick={continueAsGuest} className="py-2 text-center text-[14px] font-black text-coral" data-testid="play-as-guest">
            Just play on this device
          </button>
          <p className="-mt-2 text-center text-[12px] font-bold text-ink-3">Quickest way in. Your coins stay in this tab until you close it.</p>
        </div>
      </div>
    </Screen>
  );
}
