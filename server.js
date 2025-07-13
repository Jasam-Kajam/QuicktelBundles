const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const dotenv = require("dotenv");
const app = express();

dotenv.config(); // Load .env variables

app.use(bodyParser.json());

// GET OAUTH TOKEN
async function getAccessToken() {
  const { CONSUMER_KEY, CONSUMER_SECRET } = process.env;
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");

  const response = await axios.get(
    "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    }
  );
  return response.data.access_token;
}

// STK PUSH
app.post("/stkpush", async (req, res) => {
  const phone = req.body.phone; // Must be in format 2547XXXXXXXX
  const amount = req.body.amount || 10;
  const access_token = await getAccessToken();

  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
  const password = Buffer.from(
    process.env.SHORTCODE + process.env.PASSKEY + timestamp
  ).toString("base64");

  const payload = {
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
    TransactionDesc: "Quicktel Bundles",
  };

  try {
    const response = await axios.post(
      "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      payload,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    res.json({
      status: "sent",
      response: response.data,
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "STK Push Failed" });
  }
});

// CALLBACK ENDPOINT (Safaricom will send payment result here)
app.post("/mpesa/callback", (req, res) => {
  console.log("Callback received:", JSON.stringify(req.body, null, 2));
  res.json({ status: "OK" });
});

// HOME
app.get("/", (req, res) => {
  res.send("Quicktel Bundles API is live 🚀");
});

// START SERVER
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});