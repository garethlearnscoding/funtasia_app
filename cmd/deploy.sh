#!/bin/bash

set -e  # exit on any error

if [ -z "$1" ]; then
  echo "Usage: ./deploy.sh <message> <re-commit?>"
  exit 1
fi

cd "$(git rev-parse --show-toplevel)"

git checkout main

npm run build

if [ -z "$2" ]; then
  echo "commiting and pushing all current changes"
  git add .
  git commit -m "$1"
  git push origin main
fi

git checkout gh-pages

git rm -r .
rm -r node_modules
rm package-lock.json

mv dist/* .

git add .
git commit -m "$1"
git push origin gh-pages

git checkout main

# since node_modules was deleted
npm install

echo "Commited with message: $1"