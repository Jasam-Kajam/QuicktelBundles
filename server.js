const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(express.static("public")); // for public files

// === Step 1: Get Access Token ===
async function getAccessToken() {
  const auth = Buffer.from(`${process.env.CONSUMER_KEY}:${process.env.CONSUMER_SECRET}`).toString("base64");

  try {
    const response = await axios.get(
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );
    return response.data.access_token;
  } catch (err) {
    console.error("❌ Failed to get access token:", err.response?.data || err.message);
    throw err;
  }
}

// === Step 2: Initiate STK Push ===
app.post("/stkpush", async (req, res) => {
  const { amount, phone } = req.body;

  if (!amount || !phone) {
    return res.status(400).json({ error: "Missing amount or phone number" });
  }

  try {
    const access_token = await getAccessToken();

    const timestamp = new Date()
      .toISOString()
      .replace(/[-T:.Z]/g, "")
      .slice(0, 14); // Format: YYYYMMDDHHMMSS

    const password = Buffer.from(
      `${process.env.SHORTCODE}${process.env.PASSKEY}${timestamp}`
    ).toString("base64");

    const stkBody = {
      BusinessShortCode: process.env.SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: process.env.SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: process.env.CALLBACK_URL,
      AccountReference: "Quicktel",
      TransactionDesc: "Quicktel Bundle Purchase"
    };

    const response = await axios.post(
      "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      stkBody,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.status(200).json({
      message: "✅ STK push sent",
      data: response.data,
    });
  } catch (err) {
    console.error("❌ STK Push error:", err.response?.data || err.message);
    res.status(500).json({
      error: "STK Push failed",
      details: err.response?.data || err.message,
    });
  }
});

// === Step 3: Callback Endpoint ===
app.post("/mpesa/callback", (req, res) => {
  console.log("📞 M-PESA CALLBACK:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

// === Start the server ===
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});