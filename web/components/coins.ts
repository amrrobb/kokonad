/**
 * The one celebratory animation in the app (DESIGN.md §4): coins fly from the result number to the
 * balance pill on a win. 10 coins, 700–1300 ms, cubic-bezier(.2,.7,.2,1).
 * With prefers-reduced-motion the coins are skipped and the pill gives a 200 ms tick instead.
 */
const COINS = 10;
const EASE = "cubic-bezier(.2,.7,.2,1)";

export function flyCoins(from: Element): void {
  const pill = document.querySelector("[data-balance-pill]");
  if (!pill) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    pill.animate([{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }], { duration: 200, easing: "ease-out" });
    return;
  }

  const a = from.getBoundingClientRect();
  const b = pill.getBoundingClientRect();
  const startX = a.left + a.width / 2;
  const startY = a.top + a.height / 2;
  const endX = b.left + 14; // the coin dot at the left of the pill
  const endY = b.top + b.height / 2;

  let landed = 0;
  for (let i = 0; i < COINS; i++) {
    const coin = document.createElement("span");
    coin.setAttribute("data-coin-fly", "");
    coin.setAttribute("aria-hidden", "true");
    Object.assign(coin.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "16px",
      height: "16px",
      marginLeft: "-8px",
      marginTop: "-8px",
      borderRadius: "9999px",
      background: "radial-gradient(circle at 35% 35%, #FFE38A, #F2B72B 55%, #D99A12)",
      pointerEvents: "none",
      zIndex: "50",
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(coin);

    // Fan out a little first so ten coins read as ten, then converge on the pill.
    const spreadX = (i - (COINS - 1) / 2) * 9;
    const lift = 26 + (i % 3) * 12;
    const duration = 700 + (600 * i) / (COINS - 1);
    const anim = coin.animate(
      [
        { transform: `translate(${startX}px, ${startY}px) scale(.6)`, opacity: 0 },
        { transform: `translate(${startX + spreadX}px, ${startY - lift}px) scale(1)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${endX}px, ${endY}px) scale(.7)`, opacity: 1, offset: 0.92 },
        { transform: `translate(${endX}px, ${endY}px) scale(.3)`, opacity: 0 },
      ],
      { duration, easing: EASE, fill: "forwards" },
    );
    anim.onfinish = () => {
      coin.remove();
      landed += 1;
      if (landed === COINS) pill.animate([{ transform: "scale(1)" }, { transform: "scale(1.1)" }, { transform: "scale(1)" }], { duration: 200, easing: "ease-out" });
    };
  }
}
