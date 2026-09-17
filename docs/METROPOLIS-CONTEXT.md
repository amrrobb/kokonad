# Monad Metropolis Hackathon — Konteks Brainstorm

> Dokumen konteks untuk brainstorm ide. Semua kutipan bahasa Inggris diambil verbatim dari portal
> hackathon.monad.xyz dan Rules v3.0 (3 Sep 2026). Bagian "Penilaian" adalah analisis, bukan aturan.

Disusun: 15 Sep 2026. Tim: **solo**. Sisa waktu: **4 minggu**.

---

## 1. Fakta keras (tanggal, hadiah, deliverable)

| Item | Nilai |
|---|---|
| Build window | 1 Sep – 13 Okt 2026 |
| **Registrasi tutup** | **6 Okt** |
| Submission dibuka | 22 Sep |
| **Deadline** | **13 Okt 23:59 ET = 14 Okt 10:59 WIB** |
| Judging | 14–27 Okt · Winners 3 Nov |
| Total hadiah (Rules) | $145K (halaman marketing bilang $250K+ termasuk kredit sponsor) |
| Per track | $30K = 3 pemenang × $10K |
| Overall winner | $25K |
| Chain | Monad, testnet chain ID **10143** (mainnet 143). Testnet cukup |
| Satu project, **satu main track**, bounty sponsor boleh banyak |

### Deliverable wajib (sama untuk semua track)
- Logo (JPG/PNG/WEBP ≤3MB)
- **Public GitHub repo**, akses untuk `metropolis@hackathon.monad.xyz`, lisensi OSI (MIT/Apache/GPL)
- **Demo video ≤3 menit** — produk live, bukan slide atau code walkthrough, harus tampak interaksi Monad
- **Pitch video ≤2 menit** — tim, masalah, kenapa membangun ini
- **Live product link** di Monad testnet/mainnet + instruksi akses/kredensial tes untuk juri
- README: deskripsi, arsitektur, stack, setup, **contract addresses**, **penjelasan kenapa Monad**
- Opsional: iklan 30 detik (tidak dinilai)

---

## 2. Aturan yang membatasi ide (Rules v3.0)

### 2.1 Karya baru (4.1.4)
> "The substantial majority of the work submitted must be created during the Hackathon period; Pre-existing code or products may be used as a foundation only if the pre-existing components are identified in the README and the submission adds substantial new functionality built during the Hackathon period; and Use of AI coding tools is permitted and must be disclosed in the README."

- Repo harus punya **commit history** yang mencakup build window.
- 10.3: "Forking projects without significant original contributions" = plagiarisme.
- **Wajib tulis di README: pakai Claude Code / AI tools.**

### 2.2 IP pihak ketiga — dilarang keras
- 4.3: submission "does not infringe on any third-party rights"
- 7.3: peserta bertanggung jawab "ensuring no infringement of patents, copyrights, or trademarks"
- 10.1: diskualifikasi untuk "copyright infringement"
- 6.3: hadiah bisa **dicabut setelah menang** kalau "violated IP rights"
- 11.3: peserta menanggung ganti rugi ke Monad atas klaim pihak ketiga

**Konsekuensi:** tidak boleh ROM game komersial (Street Fighter, Mario Kart, Mortal Kombat), tidak boleh karakter/brand berlisensi. Repo publik + "bring your own ROM" tetap melanggar 9.1 (kode harus bisa dijalankan pihak ketiga dari README).

### 2.3 Token (9.3, 10.4)
- Token **tidak wajib** di track mana pun.
- Kalau ada token: peserta "solely responsible for the legal treatment", tidak boleh disebut endorsed Monad.
- Dilarang: wash trading, fake volume, pump & dump, bot manipulation.
- **Saran: testnet saja, MockUSDC/testnet MON, jangan token nyata.**

### 2.4 Kejujuran (8.2, 10.1)
- Dilarang "misrepresentation", "providing false or misleading information".
- **Wallet yang di-generate sendiri = simulasi/load test, harus dilabeli begitu. Bukan "pengguna".**
- Traction harus orang nyata (rubrik: "even a small Discord or test group", "even five friends").

### 2.5 Employer (4.3)
- Submission tidak boleh melanggar perjanjian dengan employer/klien atau memuat info rahasia.
- **Hindari domain yield stripping / PT-YT (Track 01 ide #03)** — itu wilayah Napier.

### 2.6 Lain-lain
- 5.3: submission **tidak rahasia**; juri (VC) boleh bangun/danai produk serupa.
- 2.5: satu peserta satu project.
- Hadiah USDC, KYC mungkin diminta.

---

## 3. Rubrik penilaian (SAMA untuk 4 track, beda fokus)

| Kriteria | Bobot |
|---|---|
| Technical Execution | 20% |
| Design & Craft | 20% |
| Originality & Track Insight | 15% |
| **Founder & Market Readiness** | **25%** |
| **Traction & Path Forward** | **20%** |

> **45% nilai bukan kode.** Harus bisa menyebut komunitas/segmen spesifik dan kenapa mereka pindah,
> plus bukti orang nyata mencoba + rencana distribusi konkret.

Catatan: Rules umum (5.2) menulis rubrik lain (Product/Technical/Monad Integration/Track Fit/Innovation @20%).
Halaman track adalah yang spesifik. Amankan keduanya: **"kenapa Monad" harus eksplisit** (9.2).

---

## 4. Empat main track (verbatim + ide resmi)

### Track 01 — Onchain Finance & Trading
> "New asset primitives, market structures, and the trading experiences that make them usable — all made possible by fast, cheap settlement."
> Belongs here if: "the core output is a financial instrument, market, asset primitive, or trading experience — and the primary user is a trader, protocol, or financial product builder."

Fokus rubrik: mekanisme market jalan end-to-end on-chain; UI yang trader percaya dengan modal; primitive baru yang **butuh** settlement cepat (bukan klon DeFi lebih cepat); bisa sebut first user spesifik di luar "crypto traders"; traction boleh "simulated volume or a handful of test trades" + target TVL/volume/liquidity partner.

Ide resmi: launchpad untuk **asset class baru spesifik** ("not another fair-launch meme bonding curve"); options di underlying non-tradisional (social attention, creator growth, event outcomes); yield stripping (**HINDARI — Napier**); execution-aware trading UI yang expose sub-second finality (real-time fills, no pending); mobile/simplified trading untuk segmen spesifik; embedded trading di wallet/game/app; order types baru (TWAP, grid) dengan UI lebih baik; **compute markets** (spot CLOB untuk "1 H100-hour, region X, week N"; structured products; tokenized compute yield; SLA insurance/performance bonds); **tokenized equities sebagai programmable asset** (lock/stream/condition/distribute, boleh mock ERC-20).

Konteks: Monad menekankan compute sebagai komoditas (CME/ICE compute futures) dan tokenized equities.

### Track 02 — Consumer Products & Payments
> "Consumer-facing financial products that use onchain rails as a design advantage, for users who don't identify as crypto users."
> Belongs here if: "the primary user is a consumer — someone who may not identify as a crypto user — and the core value is a financial experience, not a trading or market-making product."

Fokus rubrik: mekanik payment/behavioral **benar-benar eksekusi on-chain** dengan conditional logic; **"invisible blockchain — judge harshly on any point of friction that reveals 'this is crypto'"**; pengalaman finansial baru (bukan wallet rebranding); segmen konsumen bernama + pemahaman perilaku; user testing ("even five friends") + rencana 100 user berikutnya.

Ide resmi: payment sebagai gesture sosial (split bill, gift, tip yang terasa seperti pesan); **commitment contracts** (uang di balik goal perilaku: screen time, step count, verifikasi device-native); **accountability pools** (yang gagal mendanai yang berhasil); income share agreement konsumen; programmable gifts ("$500 saat lulus"); salary streaming per detik + yield idle; micro-insurance per menit; savings yield gated oleh goal perilaku yang diverifikasi social graph.

### Track 03 — Social, Attention & Culture
> "Products where open social graphs, competitive feed algorithms, and community governance let cultural participation translate into real ownership."
> Core question: "How do you build products where social participation, cultural engagement, and attention translate into real ownership and economic stake for the people generating them?"
> Belongs here if: "the core user value is social connection, cultural participation, or community — even if financial mechanics are involved."

Fokus rubrik: mekanisme sosial/kultural/governance jalan on-chain dan verifiable; terasa produk sosial asli ("inviting, fun, native to how people actually socialize — rather than a token-gated feature bolted onto a generic interface"); partisipasi → economic stake **nyata** (bukan on-chain dekoratif); tahu komunitas/creator base spesifik + kenapa migrasi; "any real community engagement (even a small Discord or test group)" + rencana growth/creator acquisition.

Ide resmi: algorithm marketplace (komunitas publish/jual/kompetisi strategi ranking feed); social client dengan recommendation engine yang di-govern komunitas; **attention futures** (stake on content/creator sebelum breakout); **early-supporter registries** ("cryptographically prove — and financially reward — fans who were there before the audience arrived"); wallet-seeded social graph; **TCG marketplace** dengan on-chain order book real-time; **TCG di mana scarcity, rule evolution, tournament, prize pool di-govern on-chain oleh pemain, bukan publisher**; AMM untuk long-tail collectibles; rental/lending kartu high-value; cross-game asset interoperability; **generative art yang berevolusi** dari on-chain events/holder actions/votes/oracle; **style sebagai ownable asset** (aesthetic NFT yang bisa dilisensikan ke koleksi lain, revenue split otomatis ke creator).

### Track 04 — Trust, Identity & AI Infrastructure
> "Protocol-level primitives for trust, provenance, and user-owned data that make AI genuinely useful without any single platform capturing the value."
> Belongs here if: "the primary output is a protocol, primitive, or infrastructure layer that other applications build on — not a standalone consumer product."

Monad menyebut building block spesifik: **native P256 precompile** (WebAuthn verification on-chain), **ERC-8004** (trustless agent registry), **BTX encrypted mempools**.

Fokus rubrik: implementasi benar & aman (WebAuthn/P256, key derivation, no leaked secrets); **Design = developer experience** (docs, API bersih), UI tidak wajib; privacy-preserving & tidak bisa di-capture satu platform; tahu developer/aplikasi mana yang akan adopsi dan kenapa tidak roll their own; traction = **"even one other team integrating it during the hackathon"**.

Ide resmi: mobile-native proof of personhood via WebAuthn/P256; content passports untuk AI-generated assets; personal data locker yang dibayar per query AI; **cross-application AI memory** (user-owned context layer); marketplace domain experts license decision patterns per training run; on-chain credential attestations untuk skill; decentralized data labelling untuk physical AI dengan stablecoin micropayments.

---

## 5. Sponsor bounties (detail lengkap)

Aturan: bounty bertanda track tertentu hanya bisa diambil kalau main track sama. "All tracks" bebas.

### 5.1 Layak dipertimbangkan

**Dynamic — $5K — All tracks**
> Integrate Dynamic SDK for authentication, embedded wallets (or server & agent wallets), and/or signing. App deployed & demoable.
- Kriteria: creative use (wallets, money movement, **agent wallets**); clean integration ("would real users use this?"); **bonus: kombinasi beberapa primitive** (embedded wallets + Fireblocks Flow, **agent wallets + delegated access**); bonus depth over breadth.
- Fakta: Dynamic listed di docs Monad sebagai embedded wallet provider. Delegated access = developer dapat share kriptografi + per-wallet API key untuk sign otomatis dengan batasan (cocok untuk bot/agent/recurring).
- SDK: JS, React, RN, Swift, Flutter, Kotlin, Unity, Node, Python, Rust, Java.

**Mera: One Passkey, Many Keys — $2.5K — Monad Foundation — All tracks**
> "Most creative non-wallet use of Mera's PRF-derived key material." Wallet boleh ada tapi "the wallet can't be the point"; minimal satu PRF namespace melakukan non-account work, **demonstrated live**.
- Kriteria: novelty ("the further from 'passkey wallet,' the better"); correct primitives (encryption vs derivation tepat, salts genuinely namespaced, **nothing sensitive persisted to disk or server**); **cross-device test live** (passkey sama di device/browser profile kedua reproduce key/decrypt state yang sama).
- Ide resmi: encrypted app state / E2E messaging per-conversation keys; **AI agent memory encrypted to user's passkey**; per-agent/per-app isolated identities dari salt namespaces; unlinkable per-context identities; SSH/dev identities dari passkey; secret vaults.
- Fakta teknis: API `createPasskeyWithPrfOutput`, `getPasskeyPrfOutput`. Output 32 byte deterministik per (credential, rpId, salt). rpId terikat domain. **Belum terverifikasi: kompatibilitas berdampingan dengan Dynamic sebagai wallet** (harus diuji).
- Docs: mera.category.xyz

**Best Mera-Powered UX on Monad — $2.5K — All tracks**
> App where Mera is the entire account layer — no seed phrase, no extension, no custody backend. (Alternatif Dynamic; pilih salah satu.)

**Envio — $1K — All tracks**
> Meaningfully use HyperIndex, HyperSync, or HyperRPC to power real on-chain data driving a core feature.
- Kriteria: **depth** (multichain, non-trivial schema, **derived/aggregated entities**, creative HyperSync analytics — lebih tinggi dari single-event ERC-20 indexer); working & live data; originality; craft (schema masuk akal, repo pickable).
- Deliverable: indexer deployed (Envio Cloud/self-host), public repo dengan `config.yaml`, `schema.graphql`, handlers; frontend/agent/API yang konsumsi datanya; demo end-to-end.
- Fakta: Monad testnet didukung resmi, network ID 10143.

**Chainlink CRE — $3K — All tracks**
> Build, simulate, or deploy a CRE Workflow used as an orchestration layer.
- Deliverable: integrate ≥1 blockchain dengan external API/system/data source/**LLM/AI agent**; **simulasi via CRE CLI sudah cukup** atau live deployment; CRE meaningfully used.
- Fakta: **Monad mainnet & testnet listed di CRE supported networks** (testnet: CLI v1.30.0+, SDK v1.19.0+).
- Risiko: kurva belajar.

**Best Community Team Project — $5K — Monad Foundation — All tracks**
- Tim harus menandai **campus group** di profil portal; komunitas harus ada di daftar onboarded groups (dropdown di field community).
- Dinilai dengan bar yang sama dengan track; bisa menang bersamaan dengan hadiah lain.
- **TODO: cek dropdown di profil.** Kalau tidak ada grupmu, tidak eligible.

**KIMI (Moonshot) — $3K kredit dibagi 10 tim (~$300) — All tracks**
- KIMI meaningfully driving a core feature (bukan chatbot widget); product on Monad; **wajib artikel/blog post** tentang cara pakai KIMI.
- Nilai rendah relatif usaha blog. Pakai KIMI sebagai LLM kalau memang butuh LLM; blog hanya kalau sisa waktu.

**Hunyuan (Tencent Kepler) — $2K voucher — HANYA Track 03**
- Multimodal/interactive (audio, video, 3D) "genuine and deep, not a token API call"; product on Monad; **wajib blog post**.
- Voucher, bukan cash. Ambil hanya kalau produk memang multimodal.

**Qwen 3.8 Max — $5K kredit — HANYA Track 04**
- "Push Qwen into genuinely agentic territory on Monad."

**Privy — $5K — All tracks**
- "Integrate Privy beyond authentication — login-only integrations will not qualify." Alternatif Dynamic; pilih salah satu.

### 5.2 Track-locked / tidak relevan untuk sebagian besar ide
| Bounty | Sponsor | Track | Hadiah | Inti |
|---|---|---|---|---|
| Cross-Border Payments (AUSD + Mera onboarding) | Agora | T02 | $10K | Mobile app kirim AUSD lintas negara |
| Mobile Trading App (Mera + AUSD + Perpl) | Agora | T01 | $10K | Mobile trading via Perpl |
| Consumer Trading App on Kuru | Kuru | T01 | $5K | Spot trading lewat Kuru CLOB |
| New Assets & Markets on Kuru | Kuru | T01 | $5K | Kelas market baru di Kuru order book |
| Best use of Perpl API | Perpl | All | $5K | Trading bot/automation di Perpl |
| Analytics/Risk Tool | Perpl | T01 | $3K | Dashboard risk/portfolio Perpl |
| Agent Wallet Plugin | MetaMask | T01 | $2.5K | Plugin trading untuk MetaMask Agent Wallet |
| Any-Chain Liquidity | Aurora Intents | All | $5K | NEAR Intents untuk deposit/swap lintas chain |
| Nansen | Nansen AI | All | $5K pool | Produk di atas data/API/MCP Nansen, bukan raw data |
| Cleanverse CVI/CVA | Cleanverse | T04 | $2K | Gate asset movement di balik identity verification |
| Alchemy | Alchemy | All | $1K kredit | Integrasi ≥1 Alchemy service |

---

## 6. Riwayat proyek sendiri (konteks, jangan diulang)

| Proyek | Chain | Kapan | Konsep | Hasil |
|---|---|---|---|---|
| HungerNads | **Monad** | Feb 2026 (Moltiverse) | 5 agent AI bertarung di hex grid, penonton bet/sponsor | **Tidak menang; app kurang menarik** |
| Steampunk | Hedera | Mar 2026 (Apex) — **disubmit** | Agent AI bertarung (MK64/SF2 emulator), taruhan, HCS-10 | Tidak menang |
| Steampunk Arcade | Mantle | Jun 2026 — tidak jadi submit | SF2 + LLM tactics + CPMM betting + ERC-8004 | — |
| Steampunk (Monad) | Monad | Feb 2026 | Skeleton tipis | — |

Pelajaran: **"AI vs AI yang ditonton manusia" sudah 3× tidak menarik.** Kode lama semuanya pre-Sep, boleh jadi referensi/foundation dengan disclosure, tapi produk yang di-demo harus mayoritas baru. Semua game lama pakai ROM ber-IP → tidak bisa dipakai.

Aset yang bisa dipakai ulang sebagai referensi (semua EVM Solidity biasa): escrow `Wager`, `PredictionPool` parimutuel, `OutcomeAMM` CPMM, ERC-8004 Identity/Reputation/Validation registries, `MatchProof` EIP-712, wagmi/RainbowKit setup, Foundry test patterns, DESIGN.md palet warm-dark (brass/copper/teal).

---

## 7. Ide yang sudah dievaluasi

### 7.1 Clockwork Arena (duel 1v1 automaton, LLM memilih aksi, commit-reveal per ronde)
- Track 03. On-chain penuh, ~80 tx/match → argumen Monad kuat.
- **Masalah:** masih "AI vs AI ditonton" = HungerNads dengan skin. Tidak ada alasan orang nyata main → traction/founder 45% lemah.
- Varian "manusia jadi pelatih (tulis strategi), AI eksekusi" lebih baik tapi belum diuji.

### 7.2 Hidden-role tactics (Stratego × catur × RPS, 7×7, 5v5, role tersembunyi commit-reveal, bunuh Raja)
- Track 03, cocok dengan ide resmi #07 (rules di-govern pemain: voting balance on-chain + season pool).
- Kekuatan: informasi tersembunyi butuh commit-reveal (kripto yang benar-benar diperlukan); Mera PRF untuk salt role lintas device (novelty bounty kuat); Dynamic delegated access menghilangkan ~40 popup/match.
- **Risiko:** balancing, LLM payah membaca grid (mitigasi: LLM pilih niat, kode hitung gerak), UI/animasi berat, butuh pemain main berulang untuk traction. **Berat untuk solo 4 minggu.**

### 7.3 NameBattle Launchpad (spec dari Claude Desktop, belum dikode)
- 24 jam: komunitas voting nama token via bracket (bobot sqrt deposit), harga via **uniform-price batch auction**, deposit pemenang → LP terkunci, vesting 72 jam, early-supporter multiplier dari bonus pool, jackpot tebak harga (commit-reveal), chaos events, agen AI (Namer, komentator, Artist logo).
- **Masalah prior art:** batch auction → LP = **Uniswap Continuous Clearing Auction** (live di ETH/Base/Arbitrum/Unichain, tool no-code, Aztec raise $59M). Juri Paradigm/Dragonfly mengenali seketika. Di Monad ada **nad.fun** ($1.1M raise, bonding curve, sangat populer).
- **Pain point nyata yang bisa dipakai:** sniping/bundling di bonding curve Monad terbukti (ada repo publik "Monad-Nadfun-Bundler-Volume-Bot" dengan stealth mode). Batch auction mematikan sniping.
- **Reposisi yang disarankan:** jangan sebut "launchpad"; auction jadi plumbing tak terlihat; produknya = **komunitas yang membangun token (nama/logo/hype) adalah yang memilikinya + early-supporter proof** (Track 03 ide #04). Track 03, bukan 01 (Track 01 ide #01 eksplisit "not another fair-launch meme").
- Kelebihan untuk solo: kontrak = kekuatan sendiri, frontend satu halaman satu klimaks (reveal), traction = **satu event 24 menit** dengan 5–10 orang nyata (cukup untuk rubrik).
- Bounty cocok: Envio (forecast harga kliring, leaderboard, sybil analytics), Dynamic (embedded wallet peserta + agent wallet untuk Namer/komentator), CRE (finalize → LLM/logo → IPFS → setLogoURI), KIMI opsional.
- Catatan: spec ditulis untuk 3 hari/3 orang → harus re-plan solo 4 minggu. Verifikasi DEX router di Monad testnet dulu. Testnet only (Rules 9.3/10.4).

---

## 8. Filter untuk ide baru (checklist)

Ide layak kalau lolos semua:
1. **Bukan "AI vs AI ditonton manusia"** (sudah 3× gagal).
2. **Tanpa IP pihak ketiga** (ROM, karakter, brand).
3. **Ada alasan konkret "kenapa Monad"** yang bisa ditunjukkan dengan angka di testnet (banyak tx kecil, sub-second finality, sesuatu yang tidak masuk akal di L1 mahal).
4. **Bisa menyebut komunitas/segmen spesifik** yang bisa dihubungi minggu ini untuk jadi 5–10 tester nyata.
5. **Solo, 4 minggu**, termasuk minggu terakhir untuk video demo + pitch + README + test dengan orang nyata. Berarti inti produk harus selesai dalam ~3 minggu.
6. **Prior art dicek** sebelum jatuh cinta: siapa yang sudah bangun ini, dan apa bedanya selain "di Monad".
7. **Satu klimaks demo** yang terlihat dalam 3 menit video.
8. Tidak menyentuh domain Napier (yield stripping/PT-YT).
9. Bounty hanya yang menyatu dengan produk (Dynamic/Mera, Envio, CRE); maksimal 3 inti.
10. Testnet only, tanpa token nyata.

## 9. Pertanyaan terbuka
- Komunitas mana yang bisa dijangkau untuk tester? (alumni hackathon, grup web3 Indonesia, Discord Monad)
- Nama project (ArcadeFi terpakai: token ARCADE di ETH/BSC, org GitHub `arcadefi`, domain arcadefi.xyz).
- Dropdown campus group di profil portal — eligible untuk Community Team $5K?
- Mera PRF berdampingan dengan Dynamic: uji 1–2 jam.
- DEX router yang tersedia di Monad testnet (untuk ide launch/likuiditas).
