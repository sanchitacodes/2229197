const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
const PORT = 9876;

// Sliding window setup
const WINDOW_SIZE = 10;
let windowState = [];

// Base API
const BASE_URL = "http://20.244.56.144/evaluation-service";
const TYPE_MAP = {
    'p': 'primes',
    'e': 'even',
    'f': 'fibo',
    'r': 'rand'
};

// Load access token from local file
function loadAccessToken() {
    try {
        const data = fs.readFileSync('auth_token.json', 'utf-8');
        const tokenData = JSON.parse(data);
        return tokenData.access_token;
    } catch (err) {
        console.error("Error loading access token:", err.message);
        return null;
    }
}

const ACCESS_TOKEN = loadAccessToken();

// Endpoint to get numbers
app.get('/numbers/:typeCode', async (req, res) => {
    const { typeCode } = req.params;
    const endpoint = TYPE_MAP[typeCode];

    if (!endpoint) {
        return res.status(400).json({ error: `Invalid number type: ${typeCode}` });
    }

    try {
        const response = await axios.get(`${BASE_URL}/${endpoint}`, {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`
            }
        });

        const numbers = response.data.numbers || [];

        // Save previous state
        const windowPrevState = [...windowState];

        // Update current state
        windowState = [...windowState, ...numbers];

        // Keep only the last 10 elements
        if (windowState.length > WINDOW_SIZE) {
            windowState = windowState.slice(-WINDOW_SIZE);
        }

        // Calculate average
        const avg = windowState.length > 0
            ? (windowState.reduce((sum, val) => sum + val, 0) / windowState.length).toFixed(2)
            : 0;

        // Return response
        res.json({
            windowPrevState,
            windowCurrState: windowState,
            numbers,
            avg: parseFloat(avg)
        });

    } catch (error) {
        console.error("Error fetching numbers:", error.message);
        res.status(500).json({ error: "Failed to fetch numbers" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
