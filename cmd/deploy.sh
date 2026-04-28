#!/bin/bash

set -e  # exit on any error

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./deploy.sh <version>"
  exit 1
fi

cd "$(git rev-parse --show-toplevel)"

git checkout main

npm run build

git add .
git commit -m "release v$VERSION"
git push origin main

git checkout gh-pages

git rm -rf .

mv dist/* .

git add .
git commit -m "deploy v$VERSION"
git push origin gh-pages

git checkout main

echo "Deployed v$VERSION"