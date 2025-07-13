require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());

// Serve static frontend files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html on root request
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Load Daraja credentials from .env
const shortcode = process.env.SHORTCODE;        // e.g. 8644442
const passkey = process.env.PASSKEY;            // From Safaricom portal
const consumerKey = process.env.CONSUMER_KEY;
const consumerSecret = process.env.CONSUMER_SECRET;
const callbackUrl = process.env.CALLBACK_URL;

// Generate current timestamp
function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[^0-9]/g, "").slice(0, 14);
}

// Generate access token from Safaricom
async function getAccessToken() {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const res = await axios.get(
    "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    {
      headers: { Authorization: `Basic ${auth}` }
    }
  );
  return res.data.access_token;
}

// Handle STK Push route
app.post("/stkpush", async (req, res) => {
  try {
    const { amount, phone, name } = req.body;
    const timestamp = getTimestamp();
    const password = Buffer.from(shortcode + passkey + timestamp).toString("base64");
    const token = await getAccessToken();

    const response = await axios.post(
      "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerBuyGoodsOnline",
        Amount: amount,
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: name,
        TransactionDesc: `Purchase ${name}`
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({ success: true, data: response.data });
  } catch (err) {
    console.error("STK Push error:", err.response?.data || err);
    res.json({
      success: false,
      message: err.response?.data?.errorMessage || "Failed to send STK"
    });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});