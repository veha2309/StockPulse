const https = require('https');

function toGoogleSymbol(symbol) {
  const GOOGLE_MAP = {
    "NSE:NIFTY_50":        "NIFTY_50:INDEXNSE",
    "NSE:NIFTY_BANK":      "NIFTY_BANK:INDEXNSE",
    "BSE:SENSEX":          "SENSEX:INDEXBOM",
  };
  if (GOOGLE_MAP[symbol]) return GOOGLE_MAP[symbol];
  if (symbol.startsWith("NSE:")) return symbol.slice(4) + ":NSE";
  if (symbol.startsWith("BSE:")) return symbol.slice(4) + ":BOM";
  return symbol;
}

async function fetchFromGoogleFinance(originalSymbol) {
    const gSym = toGoogleSymbol(originalSymbol);
    console.log(`Testing Google Finance recovery for: ${originalSymbol} -> ${gSym}`);
    try {
      const url = `https://www.google.com/finance/quote/${gSym}`;
      const html = await new Promise((resolve, reject) => {
        https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, res => {
          let d = "";
          res.on("data", c => d += c);
          res.on("end", () => resolve(d));
        }).on("error", reject);
      });
      const match = html.match(/data-last-price="([0-9.,]+)"/) || html.match(/itemprop="price" content="([0-9.]+)"/);
      if (match) {
          console.log(`✅ SUCCESS: Found price ${match[1]}`);
          return parseFloat(match[1].replace(/,/g, ''));
      }
      console.log('❌ FAILED: No price match found in HTML');
      return null;
    } catch (e) {
      console.log('❌ ERROR:', e.message);
      return null;
    }
}

async function runTests() {
    await fetchFromGoogleFinance("NSE:NIFTY_50");
    await fetchFromGoogleFinance("BSE:SENSEX");
    await fetchFromGoogleFinance("NSE:RELIANCE");
}

runTests();
