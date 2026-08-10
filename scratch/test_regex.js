const header = 'Digest realm="IP Camera(28022000a)", nonce="87265a6f236e76aa61a0b380f2d8a57e", qop="auth", opaque="4d89a4", algorithm="MD5"';

// Regex hiện tại trong HikvisionIsapiClient
function parseChallenge1(header) {
  const params = {};
  const matches = header.matchAll(/(\w+)="?([^",]+)"?/g);
  for (const match of matches) {
    params[match[1]] = match[2];
  }
  return params;
}

// Regex trong test_chamcong.js
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

console.log("Parser 1 (Client):", parseChallenge1(header));
console.log("Parser 2 (Test):", parseChallenge2(header));
