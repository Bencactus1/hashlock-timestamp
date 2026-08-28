[![proof of existence](https://hashlock.pronodealgo.xyz/badge/Bencactus1/hashlock-timestamp.svg)](https://hashlock.pronodealgo.xyz/badge/Bencactus1/hashlock-timestamp)

# Hashlock Timestamp — proof of existence for every release

Anchor the SHA-256 fingerprint of your release (commit + every published asset)
on the **Algorand blockchain**, automatically, at every release — for **0.005
USDC per proof**, paid machine-to-machine through the [x402
protocol](https://github.com/coinbase/x402). No account, no API key, no
subscription. The PDF certificates are attached to the release itself.

Your code never leaves GitHub: only the fingerprints travel.

## Why

- **Tamper evidence.** If anyone ever silently swaps the files of a published
  release, the on-chain proof exposes it: the fingerprints no longer match.
- **Prior art.** "This code existed publicly at this date" becomes a fact
  carved outside of GitHub, verifiable by anyone, forever.
- **It costs half a cent.** There is no budget meeting to hold.

## Usage

```yaml
name: timestamp-release
on:
  release:
    types: [published, edited]

# serialize runs - two simultaneous release events never fight over assets
concurrency:
  group: hashlock-timestamp-${{ github.ref }}

permissions:
  contents: write   # to attach the certificates to the release

jobs:
  timestamp:
    runs-on: ubuntu-latest
    steps:
      - uses: Bencactus1/hashlock-timestamp@v1
        with:
          wallet-mnemonic: ${{ secrets.HASHLOCK_WALLET }}
          network: mainnet
```

## One-time setup (5 minutes)

1. Create a **dedicated, throwaway Algorand wallet** (Pera, Defly, Lute...).
   Never use your main wallet.
2. Fund it with about **1 USDC on Algorand** (that pays ~200 proofs) and a
   little ALGO (0.3 is plenty — needed once for the USDC opt-in).
3. In your repository: Settings → Secrets and variables → Actions → New
   repository secret, name `HASHLOCK_WALLET`, value: the 25-word mnemonic.

To try it **for free** first, use `network: testnet` with a testnet wallet:
testnet ALGO from the [official dispenser](https://bank.testnet.algorand.network)
and testnet USDC from [Circle's faucet](https://faucet.circle.com) (pick
"Algorand Testnet").

## Inputs

| Input | Default | Description |
|---|---|---|
| `wallet-mnemonic` | — (required) | 25-word mnemonic of the dedicated wallet |
| `network` | `testnet` | `testnet` (free trial) or `mainnet` |
| `restamp-on-edit` | `true` | when a published release is EDITED: `true` re-proves the new state (a dated trace - nothing changes silently); `false` = **strict mode**, the edit is not re-proven and the badge stays red until you re-run the workflow yourself |
| `attach-certificates` | `true` | attach the PDF certificates to the release |
| `github-token` | `${{ github.token }}` | token used to read assets and attach certificates |

## What exactly gets proven

- **The commit** the release tag points to. Convention:
  `SHA-256("hashlock-git-commit-v1:<full commit sha>")`. Because a git commit
  id covers the whole tree and history, this one proof covers the entire
  repository.
- **Every uploaded asset**, hashed byte-for-byte (streamed, any size). The
  auto-generated "source code" archives are deliberately NOT hashed: GitHub
  does not guarantee them byte-stable over time.

Editing a published release re-triggers the action (`types: [edited]`): the
new state gets its own proof, dated — nothing changes silently, everything
stays fixable.

Re-running the action never pays twice: already-proven fingerprints are
recognized (HTTP 409) and reported with their original transaction.

## The live badge

Add a live badge to your README - green when the latest release is proven on
mainnet, blue on testnet, **red "INTEGRITY MISMATCH"** if a published file no
longer matches any anchored proof (checked against GitHub's own asset digests,
at most every 2 minutes):

```markdown
[![proof of existence](https://hashlock.pronodealgo.xyz/badge/OWNER/REPO.svg)](https://hashlock.pronodealgo.xyz/badge/OWNER/REPO)
```

Replace `OWNER/REPO` with your repository. The link target is your public
proof page, listing every anchored release with its on-chain records.

We ran the tamper drill publicly on this very repository: a modified release
asset turned the badge red within two minutes - while the repository page
itself showed nothing unusual (asset swaps leave no commit and no history).

## Verify without trusting anyone

Every certificate carries the transaction id. Anyone can check a file:

```
curl https://hashlock.pronodealgo.xyz/hashlock-algo-mainnet/api/verify/<sha256-of-the-file>
```

or on the site: https://hashlock.pronodealgo.xyz — free, no account.

## About

Built by [PronodeAlgo](https://pronodealgo.xyz) on
[Hashlock-Algo](https://hashlock.pronodealgo.xyz), a production x402
proof-of-existence service on Algorand. API docs:
[llms.txt](https://hashlock.pronodealgo.xyz/llms.txt) ·
[OpenAPI](https://hashlock.pronodealgo.xyz/openapi.json)
