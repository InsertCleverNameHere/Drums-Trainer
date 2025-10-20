# Versioning Mode Configuration

This file (`versioningMode.json`) controls how the app version is bumped when new commits are pushed to the `main` branch.

## Accepted Modes

- `"patch"` → Bumps Z only (e.g., `v2.0.0` → `v2.0.1`)
- `"minor"` → Bumps Y and resets Z (e.g., `v2.0.0` → `v2.1.0`)
- `"major"` → Bumps X and resets Y and Z (e.g., `v2.0.0` → `v3.0.0`)
- `"reset"` → Keeps X the same and resets Y and Z (e.g., `v2.5.7` → `v2.0.0`)
- `"resetmajor"` → Keeps X and Y the same and resets Z (e.g., `v2.5.7` → `v2.5.0`)
- `"none"` → Skips version bump even if commit hash changes

## Default Behavior

After every successful version bump, the mode is automatically reset to `"patch"` to ensure consistent patch-level increments unless explicitly changed before the next push.
