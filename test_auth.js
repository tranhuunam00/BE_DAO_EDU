async function test() {
  const res = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@class.com', password: 'admin123' })
  });
  const data = await res.json();
  console.log("Login output:", data);

  if (data.refreshToken) {
    const refreshRes = await fetch('http://localhost:5000/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: data.refreshToken })
    });
    const refreshData = await refreshRes.json();
    console.log("Refresh output:", refreshData);
  }
}
test();
