# Execute no PowerShell, na pasta do projeto. Os valores são solicitados pelo Wrangler.
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar SUPABASE_SERVICE_ROLE_KEY.' }
npx wrangler secret put ADMIN_PASS --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar ADMIN_PASS.' }
npx wrangler secret put ADMIN_SESSION_SECRET --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar ADMIN_SESSION_SECRET.' }
npx wrangler secret put ENCRYPT_KEY --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar ENCRYPT_KEY.' }
npx wrangler secret put BELLA_ENCRYPT_KEY --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar BELLA_ENCRYPT_KEY.' }
npx wrangler secret put BELLA_VITE_ENCRYPT_KEY --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar BELLA_VITE_ENCRYPT_KEY.' }
npx wrangler secret put VITE_ENCRYPT_KEY --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar VITE_ENCRYPT_KEY.' }
npx wrangler secret put CRON_SECRET --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar CRON_SECRET.' }
npx wrangler secret put FB_ACCESS_TOKEN --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar FB_ACCESS_TOKEN.' }
npx wrangler secret put FLEVOPAY_API_KEY --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar FLEVOPAY_API_KEY.' }
npx wrangler secret put FLEVOPAY_PRODUCT_HASH --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar FLEVOPAY_PRODUCT_HASH.' }
npx wrangler secret put INVICTUSPAY_API_KEY --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar INVICTUSPAY_API_KEY.' }
npx wrangler secret put IRONPAY_API_TOKEN --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar IRONPAY_API_TOKEN.' }
npx wrangler secret put IRONPAY_OFFER_HASH --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar IRONPAY_OFFER_HASH.' }
npx wrangler secret put IRONPAY_PRODUCT_HASH --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar IRONPAY_PRODUCT_HASH.' }
npx wrangler secret put MASTERFY_API_KEY --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar MASTERFY_API_KEY.' }
npx wrangler secret put UMBRELLAPAG_API_KEY --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar UMBRELLAPAG_API_KEY.' }
npx wrangler secret put UNIPAY_PUBLIC_KEY --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar UNIPAY_PUBLIC_KEY.' }
npx wrangler secret put UNIPAY_SECRET_KEY --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar UNIPAY_SECRET_KEY.' }
npx wrangler secret put UTMIFY_API_TOKEN --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar UTMIFY_API_TOKEN.' }
npx wrangler secret put VENUS_PAY_SECRET_KEY --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar VENUS_PAY_SECRET_KEY.' }
npx wrangler secret put VENUS_PAY_PRODUCT_ID --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar VENUS_PAY_PRODUCT_ID.' }
npx wrangler secret put RESEND_API_KEY --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar RESEND_API_KEY.' }
npx wrangler secret put VERDEFY_SALES_TOKEN --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar VERDEFY_SALES_TOKEN.' }
npx wrangler secret put MASTERFY_TOKENIZATION_KEY --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar MASTERFY_TOKENIZATION_KEY.' }
npx wrangler secret put ADMIN_USER --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar ADMIN_USER.' }
npx wrangler secret put RESEND_FROM_EMAIL --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar RESEND_FROM_EMAIL.' }
npx wrangler secret put RESHIPPING_FEE_AMOUNT --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar RESHIPPING_FEE_AMOUNT.' }
npx wrangler secret put SUPABASE_URL --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar SUPABASE_URL.' }
npx wrangler secret put VENUS_PAY_PUBLIC --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar VENUS_PAY_PUBLIC.' }
npx wrangler secret put VERDEFY_SALES_SOURCE --config wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar VERDEFY_SALES_SOURCE.' }
