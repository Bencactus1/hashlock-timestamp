// Hashlock Timestamp - GitHub Action
// A chaque release : empreinte SHA-256 du commit et de chaque fichier publie,
// paiement x402 automatique (0.005 USDC par preuve), inscription sur Algorand,
// certificats PDF attaches a la release. Le code ne quitte jamais GitHub :
// seules les empreintes voyagent.
import { wrapFetchWithPayment, x402Client } from "@x402-avm/fetch";
import {
  ExactAvmScheme, toClientAvmSigner,
  ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2,
} from "@x402-avm/avm";
import algosdk from "algosdk";
import { createHash } from "crypto";
import { readFileSync, appendFileSync } from "fs";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const RESEAU = (process.env.HASHLOCK_NETWORK || "testnet").toLowerCase();
if (!["testnet", "mainnet"].includes(RESEAU)) {
  echec(`network invalide: ${RESEAU} (attendu testnet ou mainnet)`);
}
const API = RESEAU === "mainnet"
  ? "https://hashlock.pronodealgo.xyz/hashlock-algo-mainnet/api"
  : "https://hashlock.pronodealgo.xyz/api";
const FRONT = RESEAU === "mainnet"
  ? "https://hashlock.pronodealgo.xyz/"
  : "https://hashlock.pronodealgo.xyz/testnet/";
const ATTACHER = (process.env.HASHLOCK_ATTACH || "true") !== "false";
const JETON = process.env.GITHUB_TOKEN || "";
const DEPOT = process.env.GITHUB_REPOSITORY || "";
const API_GH = process.env.GITHUB_API_URL || "https://api.github.com";

function echec(msg) {
  console.error(`::error::${msg}`);
  process.exit(1);
}

const MNEMONIC = (process.env.HASHLOCK_WALLET_MNEMONIC || "").trim();
if (!MNEMONIC) {
  echec("wallet-mnemonic manquant. Creez un wallet Algorand DEDIE, deposez-y un peu d'USDC, et stockez sa phrase dans un secret du depot.");
}
let compte;
try {
  compte = algosdk.mnemonicToSecretKey(MNEMONIC);
} catch (e) {
  echec("wallet-mnemonic invalide (25 mots attendus).");
}
console.log(`Payeur : ${compte.addr.toString()} (${RESEAU})`);

// Client x402 : le paiement part automatiquement avec la requete.
// PIEGE connu de @x402-avm 2.6.1 : sur mainnet, algodUrl doit etre EXPLICITE.
const signer = toClientAvmSigner(Buffer.from(compte.sk).toString("base64"));
const scheme = RESEAU === "mainnet"
  ? new ExactAvmScheme(signer, { algodUrl: "https://mainnet-api.algonode.cloud" })
  : new ExactAvmScheme(signer);
const client = new x402Client();
client.register(RESEAU === "mainnet" ? ALGORAND_MAINNET_CAIP2 : ALGORAND_TESTNET_CAIP2, scheme);
const payer = wrapFetchWithPayment(fetch, client);

// ---------------------------------------------------------------------------
// Contexte GitHub : la release qui vient d'etre publiee (ou la derniere, en
// declenchement manuel type workflow_dispatch / re-run).
// ---------------------------------------------------------------------------
const enteteGH = {
  Authorization: JETON ? `Bearer ${JETON}` : undefined,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "hashlock-timestamp-action",
};

async function gh(url, options = {}) {
  const r = await fetch(url, { ...options, headers: { ...enteteGH, ...(options.headers || {}) } });
  if (!r.ok) throw new Error(`GitHub API ${r.status} sur ${url}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

let release = null;
try {
  const evenement = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf-8"));
  release = evenement.release || null;
} catch (_) { /* pas d'evenement lisible : on retombe sur la derniere release */ }
if (!release) {
  console.log("Pas d'evenement release : je prends la derniere release du depot.");
  release = await (await gh(`${API_GH}/repos/${DEPOT}/releases/latest`)).json();
}
const TAG = release.tag_name;
console.log(`Release : ${DEPOT} ${TAG} (${(release.assets || []).length} fichier(s) publie(s))`);

// ---------------------------------------------------------------------------
// Resolution du commit vise par le tag (target_commitish peut etre une branche)
// ---------------------------------------------------------------------------
async function commitDuTag() {
  try {
    let ref = await (await gh(`${API_GH}/repos/${DEPOT}/git/ref/tags/${encodeURIComponent(TAG)}`)).json();
    let objet = ref.object;
    if (objet.type === "tag") {
      objet = (await (await gh(objet.url)).json()).object; // tag annote -> commit
    }
    return objet.sha;
  } catch (_) {
    return release.target_commitish || null;
  }
}

// ---------------------------------------------------------------------------
// Horodater une empreinte (avec provenance GitHub). 409 = deja prouvee : un
// re-run n'est pas une erreur, la preuve d'origine reste la bonne.
// ---------------------------------------------------------------------------
const resultats = [];
async function horodater(hashHex, nomFichier, taille) {
  const r = await payer(`${API}/timestamp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hash: hashHex,
      filename: nomFichier,
      filesize: taille || undefined,
      githubRepo: DEPOT,
      githubRelease: TAG,
      source: "agent",
    }),
  });
  const corps = await r.json();
  if (r.status === 200) {
    console.log(`  prouve : ${nomFichier} -> tx ${corps.txId}`);
    resultats.push({ nom: nomFichier, hash: hashHex, txId: corps.txId, url: corps.explorerUrl, certificat: corps.certificate, neuf: true });
  } else if (r.status === 409) {
    console.log(`  deja prouve : ${nomFichier} -> tx ${corps.existing.txId} (re-run, rien a payer)`);
    resultats.push({ nom: nomFichier, hash: hashHex, txId: corps.existing.txId, url: corps.existing.explorerUrl, certificat: corps.certificate, neuf: false });
  } else {
    throw new Error(`horodatage refuse (${r.status}) pour ${nomFichier}: ${JSON.stringify(corps).slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Le commit : une preuve qui couvre tout le depot et son historique.
//    Convention documentee : SHA-256 de la chaine "hashlock-git-commit-v1:<sha>"
// ---------------------------------------------------------------------------
const sha = await commitDuTag();
if (sha) {
  const empreinte = createHash("sha256").update(`hashlock-git-commit-v1:${sha}`).digest("hex");
  console.log(`Commit ${sha.slice(0, 12)} :`);
  await horodater(empreinte, `git-commit ${sha.slice(0, 12)} (${TAG})`, null);
} else {
  console.log("::warning::commit du tag introuvable — seuls les fichiers publies seront prouves");
}

// ---------------------------------------------------------------------------
// 2. Chaque fichier publie de la release, hache en STREAMING (jamais tout en
//    memoire : les gros binaires passent sans peser).
// ---------------------------------------------------------------------------
const SUFFIXE_CERT = ".hashlock-certificate.pdf";
for (const asset of (release.assets || []).filter((a) => !a.name.endsWith(SUFFIXE_CERT))) {
  const r = await gh(asset.url, { headers: { Accept: "application/octet-stream" } });
  const h = createHash("sha256");
  for await (const morceau of r.body) h.update(morceau);
  const empreinte = h.digest("hex");
  console.log(`Fichier ${asset.name} (${asset.size} octets) :`);
  await horodater(empreinte, asset.name, asset.size);
}

if (resultats.length === 0) echec("rien a prouver : ni commit resolu, ni fichier publie.");

// ---------------------------------------------------------------------------
// 3. Attacher les certificats PDF a la release (remplace un attachement
//    homonyme laisse par un run precedent).
// ---------------------------------------------------------------------------
const rienDeNeuf = !resultats.some((r) => r.neuf);
if (rienDeNeuf) {
  console.log("Rien de neuf a prouver : certificats deja en place, on ne re-attache pas (c'est ce qui coupe la cascade d'evenements 'edited').");
}
if (ATTACHER && !rienDeNeuf) {
  const urlDepot = `${API_GH}/repos/${DEPOT}/releases/${release.id}`;
  const existants = (await (await gh(`${urlDepot}/assets?per_page=100`)).json());
  for (const res of resultats) {
    if (!res.certificat) continue;
    const nomCert = `${res.nom.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80)}.hashlock-certificate.pdf`;
    try {
      const doublon = existants.find((a) => a.name === nomCert);
      if (doublon) await gh(doublon.url, { method: "DELETE" });
      const upload = release.upload_url.replace(/\{.*\}$/, "") + `?name=${encodeURIComponent(nomCert)}`;
      const pdf = Buffer.from(res.certificat, "base64");
      await gh(upload, {
        method: "POST",
        headers: { "Content-Type": "application/pdf", "Content-Length": String(pdf.length) },
        body: pdf,
      });
      console.log(`  certificat attache : ${nomCert}`);
    } catch (e) {
      console.log(`::warning::certificat non attache (${nomCert}) : ${e.message.slice(0, 120)} — la preuve on-chain, elle, est faite.`);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Le resume du job, lisible dans l'onglet Actions.
// ---------------------------------------------------------------------------
const lignes = [
  `## Hashlock — proof of existence (${RESEAU})`,
  "",
  "| Item | SHA-256 | Algorand transaction |",
  "|---|---|---|",
  ...resultats.map((r) => `| ${r.nom} | \`${r.hash.slice(0, 16)}…\` | [${r.txId.slice(0, 12)}…](${r.url}) |`),
  "",
  `Verify any hash for free: ${FRONT} — or \`GET ${API}/verify/:hash\``,
];
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lignes.join("\n") + "\n");
}
console.log(`\nTermine : ${resultats.length} preuve(s), dont ${resultats.filter((r) => r.neuf).length} nouvelle(s).`);
