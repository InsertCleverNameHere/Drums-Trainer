# Versioning System

## Overview

The Random Groove Trainer uses **automated semantic versioning** based on commit message keywords. No manual configuration is required.

---

## Commit Message Keywords

All keywords are **case-insensitive** and must appear at the **start** of the commit message.

| Keyword       | Effect                      | Example                            |
| ------------- | --------------------------- | ---------------------------------- |
| `MAJOR:`      | Breaking changes (X.0.0)    | `MAJOR: Rewrite audio engine`      |
| `MINOR:`      | New features (X.Y.0)        | `MINOR: Add tap tempo feature`     |
| `PATCH:`      | Bug fixes (X.Y.Z) [default] | `PATCH: Fix slider bug`            |
| (none)        | Defaults to patch           | `Fix typo in README`               |
| `RESET:`      | Reset minor/patch to zero   | `RESET: Start fresh version cycle` |
| `RESETMINOR:` | Reset patch to zero         | `RESETMINOR: Clean patch history`  |
| `NONE:`       | Skip version bump           | `NONE: Update documentation only`  |
| `NEW: X.Y.Z`  | Override version completely | `NEW: 5.0.0 Simplify versioning`   |

---

## Examples

### Major Version Bump (Breaking Changes)

```bash
git commit -m "MAJOR: Redesign simple metronome API"
# v8.1.0 → v9.0.0
```

### Minor Version Bump (New Features)

```bash
git commit -m "MINOR: Add dark mode toggle"
# v8.1.0 → v8.2.0
```

### Patch Version Bump (Bug Fixes)

```bash
git commit -m "PATCH: Fix countdown visual glitch"
# v8.1.0 → v8.1.1
```

### Default Behavior (No Keyword)

```bash
git commit -m "Fix typo in README"
# Defaults to PATCH → v8.1.0 → v8.1.1
```

### Skip Version Bump

```bash
git commit -m "NONE: Update screenshots in docs"
# v8.1.0 (no change)
```

### Custom Version Override

```bash
git commit -m "NEW: 2.0.0 Relaunch with new branding"
# → v2.0.0 (ignores previous version)
```

---

## Automated Workflow

On every push to `main`:

1. **Parse commit message** → Determine version bump type
2. **Bump version** → Update `commits.json` and `service-worker.js`
3. **Build artifacts** → Create `user.zip` (debloated) and `dev.zip` (full)
4. **Generate changelog** → Auto-generate `CHANGELOG.md` from git history
5. **Commit changes** → Push version bump back to `main`
6. **Create release** → GitHub Release with ZIP artifacts
7. **Deploy** → GitHub Pages updated with user artifact

---

## Artifacts

### User Artifact (`user.zip`)

Production-ready PWA with no development resources:

- ✅ Core app files (`index.html`, `js/`, `css/`, etc.)
- ✅ PWA assets (`manifest.webmanifest`, `service-worker.js`)
- ❌ Tests, docs, dev tools

### Dev Artifact (`dev.zip`)

Full codebase for development:

- ✅ Everything in user artifact
- ✅ Tests (`tests/`)
- ✅ Documentation (`docs/`)
- ✅ Development tools (`.vscode/`, `eslint.config.mjs`)

---

## Deployment

- **GitHub Pages**: Deploys `user.zip` by default
- **GitHub Releases**: Includes both `user.zip` and `dev.zip`

---

## Migration from Old System

### Old System (Deprecated)

- Manual `versioningMode.json` editing before each commit
- Single artifact (no user/dev separation)

### New System

- Automatic versioning from commit messages
- Separate user and dev artifacts
- Auto-generated changelogs
- GitHub Releases integration

---

## Troubleshooting

### "Version didn't bump"

Check if your commit message starts with a keyword. If no keyword is present, the default `PATCH` bump applies.

### "Workflow failed"

Check GitHub Actions logs for errors. Common issues:

- Missing `npm ci` (dependencies not installed)
- Permissions issue (workflow needs `contents: write`)

### "GitHub Pages not updating"

Verify that:

1. GitHub Pages is enabled in repository settings
2. Source is set to "GitHub Actions"
3. Workflow completed successfully

---

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Development Roadmap](./ROADMAP.md)
