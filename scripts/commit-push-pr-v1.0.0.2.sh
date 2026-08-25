#!/usr/bin/env bash
set -Eeuo pipefail
branch="manager-v1.0.0.2"
git switch -c "$branch" 2>/dev/null || git switch "$branch"
git add -- package.json package-lock.json server.js config.example.json db/init.sql db/migrate-1.0.0.2.sql public/index.html public/app.js public/start.html public/start.js public/start.css public/buy.html public/buy.js public/admin.html public/admin.js README.md CHANGELOG.md test/server.test.js docs/VERSION_1.0.0.2_CHAIN_VERSION_POS_PURCHASE.md scripts/commit-push-pr-v1.0.0.2.sh
git commit -m "feat: add live chain version and AAH purchase flow"
git push -u origin "$branch"
gh pr create --base main --head "$branch" --title "IEUM Manager v1.0.0.2: Chain 버전·PoS·AAH 구매" --body-file docs/VERSION_1.0.0.2_CHAIN_VERSION_POS_PURCHASE.md
