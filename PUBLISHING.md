# Publishing to the GitHub Marketplace — checklist

Everything is ready. To publish (all on github.com, no code changes):

1. On the repository home page, the blue banner "You can publish this Action to
   the GitHub Marketplace" -> **Draft a release** (or Releases -> Draft a new
   release, then tick "Publish this Action to the GitHub Marketplace").
2. Accept the GitHub Marketplace Developer Agreement (one-time).
3. GitHub reads `action.yml` automatically:
   - **Name:** Hashlock Timestamp
   - **Icon / colour:** a blue lock (from the `branding` block)
   - **Description (tagline):** already set in action.yml
4. **Primary category:** *Continuous integration*
   **Secondary category:** *Security* (or *Utilities*)
5. **Release:** point it at the latest tag (e.g. v0.3.1) and keep the major
   tag **v1** as the one users reference (`uses: Bencactus1/hashlock-timestamp@v1`).
6. The README becomes the Marketplace page. Publish.

That's it. The listing shows the name, the blue lock, the tagline, the README,
and the live badge at the top.

Notes:
- The action name must be unique across the whole Marketplace. "Hashlock
  Timestamp" should be free; if not, a small suffix works.
- You can unpublish or edit the listing at any time from the same screen.
