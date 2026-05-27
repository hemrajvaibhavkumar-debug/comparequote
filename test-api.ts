import 'dotenv/config';

async function testApi() {
  try {
    console.log("Attempting to login to get token...");
    const loginRes = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    
    if (!loginRes.ok) {
      console.error("Login failed!", await loginRes.text());
      return;
    }
    
    const { token } = await loginRes.json();
    console.log("Login successful! Token acquired.");
    
    console.log("Attempting to fetch /api/po...");
    const poRes = await fetch('http://localhost:3000/api/po', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (poRes.ok) {
      const data = await poRes.json();
      console.log("Successfully fetched POs! Count:", data.length);
    } else {
      console.error("Failed to fetch POs! Status:", poRes.status);
      console.error("Error Body:", await poRes.text());
    }
  } catch (e: any) {
    console.error("API Test Failed!", e.message);
  }
}

testApi();
