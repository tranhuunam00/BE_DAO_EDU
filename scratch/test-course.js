const http = require('http');

const BASE = 'http://localhost:5000/api';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const loginRes = await request('POST', '/auth/login', {
    email: 'admin@dao.edu.vn',
    password: '123456',
  });
  if (loginRes.status !== 200 && loginRes.status !== 201) {
    console.error('Login failed:', loginRes.status, loginRes.data);
    process.exit(1);
  }
  const token = loginRes.data.accessToken;
  console.log('Logged in successfully. Fetching course details...');
  const courseRes = await request('GET', '/courses/0b97d7ee-762d-4707-902c-490f7f9f1150', null, token);
  console.log('Course details levels and pricing:');
  console.log(JSON.stringify(courseRes.data.levels, null, 2));
}

main();
