#!/bin/bash

set -e  # exit on any error

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./cmd/deploy.sh <version>"
  exit 1
fi

cd "$(git rev-parse --show-toplevel)"

# --- MAIN BRANCH: bump version, build, commit, tag, push ---
git checkout main

npm version "$VERSION" --no-git-tag-version
npm run build

git add .
git commit -m "release v$VERSION"
git tag "v$VERSION"
git push origin main
git push origin "v$VERSION"

# --- GH-PAGES BRANCH: replace contents with dist/ ---
# dist/ is gitignored so it persists after branch switch
git checkout gh-pages

# Remove all tracked files but keep .gitignore
git rm -rf .
git checkout HEAD -- .gitignore 2>/dev/null || true

# Copy built output to root
cp -r dist/. .

# Remove the now-redundant dist folder (it's untracked/ignored)
rm -rf dist/

git add .
git commit -m "deploy v$VERSION"
git push origin gh-pages

# --- Return to main ---
git checkout main

echo "✅ Deployed v$VERSION"