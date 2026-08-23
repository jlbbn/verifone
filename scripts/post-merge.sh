#!/bin/bash
set -e

echo "==> Post-merge setup: installing dependencies..."
npm install --legacy-peer-deps

echo "==> Running DB migrations (drizzle push)..."
npm run db:push -- --config=server/drizzle.config.ts --force

echo "==> Post-merge setup complete."
