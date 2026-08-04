#!/usr/bin/env bash
#
# Lift dealer-desk/ into its own repository, history intact.
#
# This directory only lives inside guess-age-ios because the session that built
# it could not create a new GitHub repo. `git subtree split` rewrites just this
# subdirectory's commits into a standalone branch with dealer-desk/ as the root,
# so authorship and the build-up history come along.
#
# Usage:
#   ./extract-to-repo.sh git@github.com:thvibe/dealer-desk.git [branch]
#
# Create the empty repo on GitHub first (no README, no .gitignore — an
# auto-initialised repo gives you an unrelated root commit to reconcile).
#
# This script never modifies the source repository. It works on a temporary
# clone and cleans up after itself.

set -euo pipefail

REMOTE="${1:-}"
BRANCH="${2:-main}"
SUBDIR="dealer-desk"

if [[ -z "$REMOTE" ]]; then
  echo "usage: $0 <git-remote-url> [branch]" >&2
  echo "example: $0 git@github.com:thvibe/dealer-desk.git" >&2
  exit 1
fi

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -d "$SOURCE_ROOT/.git" ]]; then
  echo "error: $SOURCE_ROOT is not a git repository" >&2
  exit 1
fi

if [[ ! -d "$SOURCE_ROOT/$SUBDIR" ]]; then
  echo "error: $SOURCE_ROOT/$SUBDIR not found" >&2
  exit 1
fi

WORKDIR="$(mktemp -d)"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

echo "→ Cloning a scratch copy so the source repo is never touched..."
git clone --no-hardlinks --quiet "$SOURCE_ROOT" "$WORKDIR/repo"
cd "$WORKDIR/repo"

echo "→ Splitting $SUBDIR/ into a standalone history..."
SPLIT_REF="$(git subtree split --prefix="$SUBDIR" -b "$BRANCH-split" 2>/dev/null | tail -1)"
COMMITS="$(git rev-list --count "$BRANCH-split")"
echo "  $COMMITS commit(s) carried over (head ${SPLIT_REF:0:8})"

echo "→ Pushing to $REMOTE as '$BRANCH'..."
git push "$REMOTE" "$BRANCH-split:refs/heads/$BRANCH"

cat <<EOF

✓ Done.

  git clone $REMOTE
  cd dealer-desk && npm install && npm run dev

Once you've confirmed the new repo looks right, remove $SUBDIR/ from
guess-age-ios so the game repo goes back to being just the game:

  git rm -r $SUBDIR && git commit -m "Move dealer-desk to its own repository"
EOF
