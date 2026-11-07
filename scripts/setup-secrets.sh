#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Digite os valores no prompt do Wrangler. Nunca cole secrets no código.
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.jsonc
npx wrangler secret put ADMIN_PASS --config wrangler.jsonc
npx wrangler secret put ADMIN_SESSION_SECRET --config wrangler.jsonc
npx wrangler secret put ENCRYPT_KEY --config wrangler.jsonc
npx wrangler secret put BELLA_ENCRYPT_KEY --config wrangler.jsonc
npx wrangler secret put BELLA_VITE_ENCRYPT_KEY --config wrangler.jsonc
npx wrangler secret put VITE_ENCRYPT_KEY --config wrangler.jsonc
npx wrangler secret put CRON_SECRET --config wrangler.jsonc
npx wrangler secret put FB_ACCESS_TOKEN --config wrangler.jsonc
npx wrangler secret put FLEVOPAY_API_KEY --config wrangler.jsonc
npx wrangler secret put FLEVOPAY_PRODUCT_HASH --config wrangler.jsonc
npx wrangler secret put INVICTUSPAY_API_KEY --config wrangler.jsonc
npx wrangler secret put IRONPAY_API_TOKEN --config wrangler.jsonc
npx wrangler secret put IRONPAY_OFFER_HASH --config wrangler.jsonc
npx wrangler secret put IRONPAY_PRODUCT_HASH --config wrangler.jsonc
npx wrangler secret put MASTERFY_API_KEY --config wrangler.jsonc
npx wrangler secret put UMBRELLAPAG_API_KEY --config wrangler.jsonc
npx wrangler secret put UNIPAY_PUBLIC_KEY --config wrangler.jsonc
npx wrangler secret put UNIPAY_SECRET_KEY --config wrangler.jsonc
npx wrangler secret put UTMIFY_API_TOKEN --config wrangler.jsonc
npx wrangler secret put VENUS_PAY_SECRET_KEY --config wrangler.jsonc
npx wrangler secret put VENUS_PAY_PRODUCT_ID --config wrangler.jsonc
npx wrangler secret put RESEND_API_KEY --config wrangler.jsonc
npx wrangler secret put VERDEFY_SALES_TOKEN --config wrangler.jsonc
npx wrangler secret put MASTERFY_TOKENIZATION_KEY --config wrangler.jsonc
npx wrangler secret put ADMIN_USER --config wrangler.jsonc
npx wrangler secret put RESEND_FROM_EMAIL --config wrangler.jsonc
npx wrangler secret put RESHIPPING_FEE_AMOUNT --config wrangler.jsonc
npx wrangler secret put SUPABASE_URL --config wrangler.jsonc
npx wrangler secret put VENUS_PAY_PUBLIC --config wrangler.jsonc
npx wrangler secret put VERDEFY_SALES_SOURCE --config wrangler.jsonc
# Variável comum ausente do Pages: configurar PURCHASE_MIGRATION_AT somente se utilizada.
