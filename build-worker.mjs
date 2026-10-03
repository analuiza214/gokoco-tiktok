import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => fs.readFileSync(path.join(root, 'worker-src', name), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/^export (async function|function)/gm, '$1');
const wrap = (name, exports) => `\nconst { ${exports.join(', ')} } = (() => {\n${read(name)}\nreturn { ${exports.join(', ')} };\n})();\n`;
let output = '// Gerado por build-worker.mjs. Edite worker-src/.\n';
output += wrap('providers/ironpay.js', ['createPixIronpay', 'statusPixIronpay']);
output += wrap('providers/masterfy.js', ['createPixMasterfy', 'statusPixMasterfy']);
output += wrap('providers/umbrellapag.js', ['createPixUmbrellapag', 'statusPixUmbrellapag']);
output += wrap('providers/venuspay.js', ['createPixVenuspay', 'statusPixVenuspay']);
output += wrap('pix-gateway-status.js', ['queryPixGatewayStatus']);
output += wrap('admin-auth.js', ['verifyAdminToken']);
output += wrap('purchase-tracking.js', ['capturePurchaseTracking', 'purchaseDestination', 'purchaseSummary', 'deliverPaidPurchase']);
output += `\nconst adminLogin = (() => {\n${read('admin-login.js')}\nreturn onRequest;\n})();\n`;
output += read('index.js');
fs.writeFileSync(path.join(root, '_worker.js'), output);
console.log('Criado _worker.js');
