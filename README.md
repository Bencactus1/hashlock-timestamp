[![proof of existence](https://hashlock.pronodealgo.xyz/badge/Bencactus1/hashlock-timestamp.svg)](https://hashlock.pronodealgo.xyz/badge/Bencactus1/hashlock-timestamp)

# Hashlock Timestamp

**Proof of existence for every release, anchored on the Algorand blockchain — automatically, for half a cent.**

At every release, this action writes the SHA-256 fingerprint of your commit and
of every published file onto Algorand, pays **0.005 USDC** by itself through the
[x402 protocol](https://github.com/coinbase/x402), and attaches a PDF
certificate to the release. No account, no API key, no subscription.

Your code never leaves GitHub — only the fingerprints travel.

---

## Quick start

```yaml
name: timestamp-release
on:
  release:
    types: [published, edited]

concurrency:
  group: hashlock-timestamp-${{ github.ref }}

permissions:
  contents: write   # attach the certificates to the release
  id-token: write   # OIDC: proves this workflow really runs in your repo

jobs:
  timestamp:
    runs-on: ubuntu-latest
    steps:
      - uses: Bencactus1/hashlock-timestamp@v1
        with:
          wallet-mnemonic: ${{ secrets.HASHLOCK_WALLET }}
          network: mainnet   # or 'testnet' to try it for free
```

Then drop the badge in your README (replace `OWNER/REPO`):

```markdown
[![proof of existence](https://hashlock.pronodealgo.xyz/badge/OWNER/REPO.svg)](https://hashlock.pronodealgo.xyz/badge/OWNER/REPO)
```

---

## Why it matters

- **Tamper evidence.** If anyone ever silently swaps the files of a published
  release, the on-chain proof exposes it and the badge turns **red**. Asset
  swaps leave no commit and no history — the badge is often the only thing that
  shows it.
- **Prior art.** "This code existed publicly at this date" becomes a fact carved
  outside of GitHub, verifiable by anyone, forever — even if this service and
  your repository both disappear.
- **It costs half a cent.** No budget meeting, no vendor onboarding.

## How it works

```
release published  ->  SHA-256 of the commit  ->  x402 payment  ->  proof written  ->  certificate
                       and every asset            0.005 USDC        on Algorand        attached to
                       (streamed, any size)       (automatic)       (permanent)        the release
```

The developer does nothing beyond publishing the release. Everything above runs
on GitHub's machines, in about 40 seconds.

## One-time setup (5 minutes)

1. Create a **dedicated, throwaway Algorand wallet** (Pera, Lute, Defly...).
   Never use your main wallet.
2. Fund it with about **1 USDC on Algorand** (~200 proofs) and a little ALGO
   (0.3 is plenty — needed once, for the USDC opt-in).
3. In your repository: **Settings → Secrets and variables → Actions → New
   repository secret**, name it `HASHLOCK_WALLET`, value: the 25-word mnemonic.

**Try it for free first** with `network: testnet` and a testnet wallet — testnet
ALGO from the [official dispenser](https://bank.testnet.algorand.network),
testnet USDC from [Circle's faucet](https://faucet.circle.com) (choose
"Algorand Testnet").

## The badge

| Colour | Meaning |
|---|---|
| **green** | the latest release is anchored on Algorand mainnet, every file still matches its proof |
| **blue** | same, on the test network (free trial — not a real-money proof) |
| **red — INTEGRITY MISMATCH** | a published file no longer matches what was anchored: it changed after being proven. Don't trust that download until a fresh proof is published |
| **grey — none** | this repository has no proof yet |

**Green proves** the file is exactly what was published, unchanged, at a date
that cannot be faked. **Green does not prove** the code is safe — it proves
*what* existed and *when*, never that it is good.

Clicking the badge opens your public proof page: every anchored release, its
on-chain records, and a one-click "how to verify it yourself".

## Security

- **No one can impersonate your repository.** Ownership is anchored on GitHub's
  OIDC token (`id-token: write`): only a real workflow running *in your repo*
  can claim your badge — not even by timestamping first.
- **The badge can only be turned red by a real change** to your published files;
  third parties are ignored entirely.
- **Nothing is downloaded at runtime.** The payment libraries are frozen into
  the action (built with [ncc](https://github.com/vercel/ncc), committed,
  version-pinned, watched by Dependabot) — closing the supply-chain window.
- Your **file contents never leave GitHub**; only SHA-256 fingerprints are sent.

## Verify without trusting anyone

Every certificate carries the transaction id. Anyone can check a downloaded file:

```bash
curl https://hashlock.pronodealgo.xyz/hashlock-algo-mainnet/api/verify/<sha256-of-the-file>
```

If the hash is anchored on Algorand, you get the transaction, block and date —
free, no account. The proof lives on the blockchain, not on this service.

## What exactly gets proven

- **The commit** the release tag points to
  (`SHA-256("hashlock-git-commit-v1:<commit sha>")`). A commit id covers the
  whole tree and history, so this single proof covers the entire repository.
- **Every uploaded asset**, hashed byte-for-byte (streamed, any size). The
  auto-generated "source code" archives are deliberately *not* hashed — GitHub
  does not guarantee them byte-stable over time.

Editing a published release re-triggers the action: the new state gets its own
dated proof (nothing changes silently). Re-running never pays twice — already
proven fingerprints are recognized and reported with their original transaction.

## Inputs

| Input | Default | Description |
|---|---|---|
| `wallet-mnemonic` | — (required) | 25-word mnemonic of the dedicated wallet, stored as a repository secret |
| `network` | `testnet` | `testnet` (free trial) or `mainnet` |
| `restamp-on-edit` | `true` | when a published release is edited: `true` re-proves the new state; `false` = **strict mode**, the badge stays red until you re-run the workflow yourself |
| `attach-certificates` | `true` | attach the PDF certificates to the release |
| `github-token` | `${{ github.token }}` | token used to read assets and attach certificates |

## FAQ

**Is my source code sent anywhere?** No. Only SHA-256 fingerprints leave your
runner. The files stay on GitHub.

**What if I edit a release?** By default the action re-proves the new state, so
the badge stays green and every version keeps a dated proof. Use
`restamp-on-edit: false` for a strict mode that stays red until you re-run.

**Can I use it on a private repository?** Yes, but by design a private repo gets
**no public badge**: the proof is still written on-chain and the certificate is
still produced, but the repository's name is never stored or displayed on our
side. Public badges are for public repositories only - a private repo must never
leak its name, releases or file names.

**Does it work for organizations and multi-contributor repos?** Yes. Ownership
is tied to the repository itself (via OIDC), not to a person or a wallet — any
collaborator's run counts, and no one outside the repo can claim it.

**What does a proof cost?** 0.005 USDC per fingerprint on mainnet (a release
typically produces 2–3 fingerprints). Free on testnet.

**Green badge = safe code?** No. It means "unchanged since it was published at
this date". It is tamper evidence and prior art, not a security audit.

## About

Built by [PronodeAlgo](https://pronodealgo.xyz) on
**[Hashlock-Algo](https://hashlock.pronodealgo.xyz)**, a production x402
proof-of-existence service on Algorand.
Docs: [llms.txt](https://hashlock.pronodealgo.xyz/llms.txt) ·
[OpenAPI](https://hashlock.pronodealgo.xyz/openapi.json) · MIT licensed.
