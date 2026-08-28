# Building the bundle

The action runs `dist/index.mjs`, a single self-contained file that includes
its dependencies (frozen, no runtime download). To rebuild it after editing
`src/index.mjs` or updating a dependency:

```bash
mkdir -p /tmp/hashlock-build && cp src/index.mjs /tmp/hashlock-build/
cd /tmp/hashlock-build
npm init -y && npm pkg set type=module
npm install @x402-avm/fetch@2.6.1 @x402-avm/avm@2.6.1 algosdk@3.7.0
npx @vercel/ncc@0.38.3 build index.mjs -o dist
```

Then copy `dist/index.mjs` back into the repo's `dist/` and commit it. Bumping
a dependency is a deliberate act: change the exact version above, rebuild,
review the diff, commit. Nothing updates on its own.
