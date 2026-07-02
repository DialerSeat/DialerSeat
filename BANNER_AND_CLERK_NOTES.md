# Remove resub banner + fix Clerk delete-account casing

## 1. ResubBanner removed sitewide
- app/dashboard/layout.tsx: import + <ResubBanner /> mount removed.
- DELETE the file components/ResubBanner.tsx from your repo (it's gone from the
  build; a zip can't ship a deletion, so remove it manually):
    git rm components/ResubBanner.tsx
Read-only enforcement in proxy.ts is untouched — unsubbed users are still
read-only; they just no longer see the banner.

## 2. Clerk delete-account: lowercase 'delete account' now actually works
Root cause: the localization only customized userProfile.deletePage.* keys, but
the input PLACEHOLDER — which is ALSO the exact string Clerk validates the typed
text against — is a ROOT-level key. Verified against @clerk/localizations 4.12.0:
  formFieldInputPlaceholder__confirmDeletionUserAccount: "Delete account"
So the page said "Type 'delete account'" while Clerk silently required capital-D
"Delete account". Added the root-level key set to 'delete account' in
app/layout.tsx — placeholder and required typed text are now lowercase and
consistent with the instruction text.

## Apply
Replace app/layout.tsx + app/dashboard/layout.tsx; delete components/ResubBanner.tsx.
tsc: clean.
