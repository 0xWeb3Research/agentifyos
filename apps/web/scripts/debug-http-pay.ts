// Repro the CLI path exactly: sign here, deliver via HTTP header, let the
// ROUTE settle. Print the route's full error including the failed deploy hash.
import { loadRoleWallet, signPayment } from "../src/lib/x402/casper";

async function main() {
  const base = "http://localhost:8402/api/t/cspr-market-data";
  const res = await fetch(base);
  const j = (await res.json()) as any;
  const req = j.accepts[0];

  const agent = loadRoleWallet("agent");
  const payload = signPayment(agent, req);
  const header = Buffer.from(JSON.stringify(payload)).toString("base64");

  const res2 = await fetch(base, { headers: { "PAYMENT-SIGNATURE": header } });
  const body = await res2.text();
  console.log("HTTP", res2.status);
  console.log(body.slice(0, 800));
}
main();
