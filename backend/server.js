// backend/server.js (Corrected with a longer timeout for the API call)

require('dotenv').config();
const express = require('express');
const axios =require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const geminiApiKey = process.env.GEMINI_API_KEY;
const hfApiKey = process.env.HUGGING_FACE_API_TOKEN;

app.post('/api/generate', async (req, res) => {
    console.log("\n--- Received new request to /api/generate ---");
    const { topic } = req.body;

    if (!topic) return res.status(400).json({ error: 'Topic is required.' });
    if (!geminiApiKey || !hfApiKey) return res.status(500).json({ error: 'Server is not configured with API keys.' });

    try {
        // --- Part A: Generate Story ---
        console.log(`   -> Calling Gemini API for topic: "${topic}"`);
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
        const storyPrompt = `You are 'Anaganagaa', a magical AI storyteller for children. Your task is to create an educational story about: "${topic}". **Instructions:** 1. Keep the story short and simple (3-4 very short paragraphs). 2. Sprinkle relevant emojis (like 🚀, ✨, 🌱) throughout the story to make it engaging. 3. Create charming characters and use simple analogies. 4. End with a 'The Magical Lesson:' section that summarizes the main point. 5. Do not include any titles or headers. Just the story.`;
        
        const geminiResponse = await axios.post(geminiUrl, { contents: [{ parts: [{ text: storyPrompt }] }] });
        const story = geminiResponse.data.candidates[0].content.parts[0].text;
        console.log("   <- Gemini API call successful.");

        // --- Part B: Generate Image ---
        console.log("   -> Calling Hugging Face API for Stable Diffusion image...");
        const hfUrl = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0";
        const imagePrompt = `A beautiful and magical digital art illustration for a children's story, whimsical, colorful style. The scene is about: ${story.substring(0, 300)}`;

        const hfResponse = await axios.post(hfUrl, 
            { inputs: imagePrompt }, 
            {
                headers: { 
                    'Authorization': `Bearer ${hfApiKey}`,
                    'Accept': 'image/jpeg'
                },
                responseType: 'arraybuffer',
                timeout: 90000 // <--- THE NEW, IMPORTANT LINE: Wait for 90 seconds
            }
        );
        
        const imageBase64 = Buffer.from(hfResponse.data, 'binary').toString('base64');
        const imageUrl = `data:image/jpeg;base64,${imageBase64}`;
        console.log("   <- Hugging Face API call successful.");

        // --- Part C: Send Response ---
        console.log("--- Successfully processed request. Sending response to frontend. ---");
        res.json({ story, imageUrl });

    } catch (error) {
        console.error("\n--- 🚨 AN ERROR OCCURRED ---");
        if (error.response) {
            console.error("API Error Status:", error.response.status);
            console.error("API Error Data:", error.response.data.toString());
            res.status(500).json({ error: 'An external API service returned an error.' });
        } else if (error.code === 'ECONNRESET') {
            console.error("Connection Reset Error: The remote server (Hugging Face) may be overloaded or timed out. This is common with the free tier.");
            res.status(504).json({ error: 'The AI image generator is currently overloaded. Please try again in a moment.' });
        } else {
            console.error("Generic Error:", error.message);
            res.status(500).json({ error: 'An unexpected error occurred on the server.' });
        }
        console.error("--------------------------\n");
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running and listening on http://localhost:${PORT}`);
});