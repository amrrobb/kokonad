This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Playing a room (week 1)

`/` takes a room code and `/r/[code]` joins it. The participant's account signs requests and
`backend/` relays them, so the account never needs MON. Run the relayer alongside the app:

```bash
cd ../backend && pnpm start      # ALLOWED_ORIGIN=http://localhost:3000 in backend/.env
cd ../web && pnpm dev            # NEXT_PUBLIC_RELAY_URL=http://localhost:8787 in web/.env.local
```

**Known limitation, on purpose:** until Dynamic is configured, the account key lives in memory
for the tab only (`lib/signer.ts`). CLAUDE.md forbids keeping it in browser storage. Reloading the
tab starts a new account: the old one stays in the room with its coins and the player sees the
name screen again. This is not a bug to fix in storage; Dynamic's persistent account replaces it.

**Watch when testing with more people:** the lobby polls the chain every 2 s and makes 7 + 2N
reads per poll (N = people in the room). Envio replaces these reads in week 2.
