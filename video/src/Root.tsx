import { Composition, Folder } from "remotion";
import { Demo, DEMO_FRAMES } from "./Demo";
import { ColdOpen, COLD_OPEN_FRAMES } from "./scenes/ColdOpen";
import { HostSetup, HOST_SETUP_FRAMES } from "./scenes/HostSetup";
import { Intro, INTRO_FRAMES } from "./scenes/Intro";
import { Join, JOIN_FRAMES } from "./scenes/Join";
import { Monad, MONAD_FRAMES } from "./scenes/Monad";
import { Outro, OUTRO_FRAMES } from "./scenes/Outro";
import { Payout, PAYOUT_FRAMES } from "./scenes/Payout";
import { Question, QUESTION_FRAMES } from "./scenes/Question";
import { Result, RESULT_FRAMES } from "./scenes/Result";
import { Reveal, REVEAL_FRAMES } from "./scenes/Reveal";
import { Split, SPLIT_FRAMES } from "./scenes/Split";

/** The hackathon caps the demo video at three minutes. */
if (DEMO_FRAMES > 180 * 30) throw new Error("The demo is longer than three minutes.");

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="KokonadDemo" component={Demo} durationInFrames={DEMO_FRAMES} fps={30} width={1920} height={1080} />
      <Folder name="Scenes">
        <Composition id="ColdOpen" component={ColdOpen} durationInFrames={COLD_OPEN_FRAMES} fps={30} width={1920} height={1080} />
        <Composition id="Intro" component={Intro} durationInFrames={INTRO_FRAMES} fps={30} width={1920} height={1080} />
        <Composition id="HostSetup" component={HostSetup} durationInFrames={HOST_SETUP_FRAMES} fps={30} width={1920} height={1080} />
        <Composition id="Join" component={Join} durationInFrames={JOIN_FRAMES} fps={30} width={1920} height={1080} />
        <Composition id="Question" component={Question} durationInFrames={QUESTION_FRAMES} fps={30} width={1920} height={1080} />
        <Composition id="Reveal" component={Reveal} durationInFrames={REVEAL_FRAMES} fps={30} width={1920} height={1080} />
        <Composition id="Result" component={Result} durationInFrames={RESULT_FRAMES} fps={30} width={1920} height={1080} />
        <Composition id="Split" component={Split} durationInFrames={SPLIT_FRAMES} fps={30} width={1920} height={1080} />
        <Composition id="Payout" component={Payout} durationInFrames={PAYOUT_FRAMES} fps={30} width={1920} height={1080} />
        <Composition id="Monad" component={Monad} durationInFrames={MONAD_FRAMES} fps={30} width={1920} height={1080} />
        <Composition id="Outro" component={Outro} durationInFrames={OUTRO_FRAMES} fps={30} width={1920} height={1080} />
      </Folder>
    </>
  );
};
