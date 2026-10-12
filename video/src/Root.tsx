import { Composition, Folder } from "remotion";
import { Demo } from "./Demo";
import { HostSetup } from "./scenes/HostSetup";
import { Intro } from "./scenes/Intro";
import { Join } from "./scenes/Join";
import { Monad } from "./scenes/Monad";
import { Outro } from "./scenes/Outro";
import { Payout } from "./scenes/Payout";
import { Question } from "./scenes/Question";
import { Result } from "./scenes/Result";
import { Reveal } from "./scenes/Reveal";

/** The hackathon caps the demo video at three minutes. */
const DEMO_FRAMES = 2826;
if (DEMO_FRAMES > 180 * 30) throw new Error("The demo is longer than three minutes.");

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="KokonadDemo" component={Demo} durationInFrames={DEMO_FRAMES} fps={30} width={1920} height={1080} />
      <Folder name="Scenes">
        <Composition id="Intro" component={Intro} durationInFrames={258} fps={30} width={1920} height={1080} />
        <Composition id="HostSetup" component={HostSetup} durationInFrames={360} fps={30} width={1920} height={1080} />
        <Composition id="Join" component={Join} durationInFrames={330} fps={30} width={1920} height={1080} />
        <Composition id="Question" component={Question} durationInFrames={420} fps={30} width={1920} height={1080} />
        <Composition id="Reveal" component={Reveal} durationInFrames={270} fps={30} width={1920} height={1080} />
        <Composition id="Result" component={Result} durationInFrames={300} fps={30} width={1920} height={1080} />
        <Composition id="Payout" component={Payout} durationInFrames={372} fps={30} width={1920} height={1080} />
        <Composition id="Monad" component={Monad} durationInFrames={432} fps={30} width={1920} height={1080} />
        <Composition id="Outro" component={Outro} durationInFrames={180} fps={30} width={1920} height={1080} />
      </Folder>
    </>
  );
};
