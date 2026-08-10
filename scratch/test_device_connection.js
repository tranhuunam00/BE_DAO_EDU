const crypto = require('crypto');

const host = '192.168.22.123';
const username = 'admin';
const password = '28022000a';

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function parseChallenge1(header) {
  const params = {};
  const matches = header.matchAll(/(\w+)="?([^",]+)"?/g);
  for (const match of matches) {
    params[match[1]] = match[2];
  }
  return params;
}

function parseChallenge2(header) {
  const params = {};
  const regex = /(\w+)=(?:"([^"]*)"|([^,\s]*))/g;
  let match;
  while ((match = regex.exec(header)) !== null) {
    const key = match[1];
    const val = match[2] !== undefined ? match[2] : match[3];
    params[key] = val;
  }
  return params;
}

async function test() {
  const url = `http://${host}/ISAPI/System/time`;
  console.log("Sending request 1 to challenge...");
  let res = await fetch(url);
  console.log("Response status:", res.status);
  
  const wwwAuth = res.headers.get('www-authenticate');
  console.log("WWW-Authenticate Header:", wwwAuth);

  const c1 = parseChallenge1(wwwAuth);
  const c2 = parseChallenge2(wwwAuth);
  console.log("Parsed using client regex:", c1);
  console.log("Parsed using test script regex:", c2);

  // Let's test client response header construction with c1 and c2
  const cnonce = crypto.randomBytes(8).toString('hex');
  const realm = c1.realm;
  const nonce = c1.nonce;
  const opaque = c1.opaque;
  const qop = c1.qop;
  
  console.log("qop parsed value is:", qop);

  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`GET:/ISAPI/System/time`);
  
  // If qop contains multiple values like "auth, auth-int", we should select "auth"
  let selectedQop = qop;
  if (qop && qop.includes('auth')) {
    selectedQop = 'auth';
  }

  const nc = '00000001';
  let responseVal;
  if (selectedQop === 'auth') {
    responseVal = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${selectedQop}:${ha2}`);
  } else {
    responseVal = md5(`${ha1}:${nonce}:${ha2}`);
  }

  let authHeader = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="/ISAPI/System/time", response="${responseVal}"`;
  if (selectedQop) {
    authHeader += `, qop=${selectedQop}, nc=${nc}, cnonce="${cnonce}"`;
  }
  if (opaque) {
    authHeader += `, opaque="${opaque}"`;
  }

  console.log("Calculated Auth Header:", authHeader);

  console.log("Sending request 2 with Authorization header...");
  res = await fetch(url, {
    headers: {
      'Authorization': authHeader
    }
  });

  console.log("Response 2 status:", res.status);
  const text = await res.text();
  console.log("Response 2 body (partial):", text.substring(0, 500));
}

test().catch(console.error);
