import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Razorpay from 'razorpay';
import RSS from 'rss';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import rateLimit from 'express-rate-limit';

const Razorpay_Any = Razorpay as any;
const RSS_Any = RSS as any;

// Initialize Firebase Admin (using client SDK for backend reads since we made podcasts public)
const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
let db: any = null;
if (fs.existsSync(firebaseConfigPath)) {
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

// Initialize Razorpay
let razorpayClient: any = null;
function getRazorpay(): any {
  if (!razorpayClient) {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables are required');
    }
    razorpayClient = new Razorpay_Any({ key_id, key_secret });
  }
  return razorpayClient;
}

// Basic content moderation filter
function containsMaliciousLinks(text: string): boolean {
  const maliciousPatterns = [
    /phish/i,
    /malware/i,
    /bit\.ly\/[a-zA-Z0-9]+/i,
  ];
  return maliciousPatterns.some(pattern => pattern.test(text));
}

// In-memory IP rate limiting
const ipRateLimits = new Map<string, { count: number, lastUsed: number }>();

// Helper to get a valid API key, ignoring placeholders
function getApiKey(): string {
  const key = process.env.USER_GEMINI_KEY;
  if (key && key !== "MY_USER_GEMINI_KEY" && key.trim() !== "") {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Using API Key from source: USER_GEMINI_KEY`);
      console.log("SERVER_DEBUG: Using key starting with:", key.substring(0, 5));
    }
    return key;
  }
  return "";
}

// Helper for exponential backoff retry on 429 errors
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5, initialDelay = 5000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      let errorStr = '';
      try {
        errorStr = JSON.stringify(error);
      } catch (e) {
        errorStr = String(error);
      }
      
      const isQuotaError = error?.message?.includes('429') || 
                          error?.message?.includes('RESOURCE_EXHAUSTED') || 
                          error?.status === 'RESOURCE_EXHAUSTED' ||
                          errorStr.includes('429') ||
                          errorStr.includes('RESOURCE_EXHAUSTED');
                          
      // Don't retry if it's a daily quota limit (unless it explicitly tells us to retry)
      const hasRetryInfo = error?.message?.includes('Please retry in') || errorStr.includes('Please retry in');
      const isDailyQuota = (error?.message?.includes('generate_content_free_tier_requests') || errorStr.includes('generate_content_free_tier_requests')) && !hasRetryInfo;
      
      if (isQuotaError && !isDailyQuota && i < maxRetries - 1) {
        // Try to parse retryDelay from Google's error response if available
        let delay = initialDelay * Math.pow(2, i);
        
        try {
          // The error might be a string or an object depending on how it's caught
          const errObj = typeof error === 'string' ? JSON.parse(error) : error;
          const details = errObj?.details || errObj?.error?.details;
          const retryInfo = details?.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
          
          if (retryInfo?.retryDelay) {
            const seconds = parseInt(retryInfo.retryDelay.replace('s', ''));
            if (!isNaN(seconds)) {
              delay = (seconds + 2) * 1000; // Add 2s buffer
              console.log(`Gemini suggested retry delay: ${seconds}s. Waiting ${delay}ms...`);
            }
          } else {
            // Try to extract from message: "Please retry in 4.726383285s."
            const match = (error?.message || errorStr).match(/Please retry in ([\d.]+)s/);
            if (match && match[1]) {
              const seconds = parseFloat(match[1]);
              if (!isNaN(seconds)) {
                delay = (Math.ceil(seconds) + 2) * 1000;
                console.log(`Extracted retry delay from message: ${seconds}s. Waiting ${delay}ms...`);
              }
            }
          }
        } catch (e) {
          // Ignore parsing errors, fallback to exponential backoff
        }

        console.warn(`Quota exceeded (429). Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.set('trust proxy', 1); // Trust the first proxy (Cloud Run/Nginx)

  // CRITICAL: Middleware to disable the old "commutecast" URL
  // This must be the VERY FIRST middleware to ensure it blocks all requests
  app.use((req, res, next) => {
    const host = req.get('host') || '';
    const hostname = req.hostname || '';
    const url = req.originalUrl || '';

    if (host.toLowerCase().includes('commutecast') || hostname.toLowerCase().includes('commutecast')) {
      console.log(`BLOCKING REQUEST from old domain: ${host}`);
      res.status(410).send(`
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; text-align: center; background: #f8fafc; color: #1e293b; padding: 24px;">
          <div style="background: white; padding: 48px; border-radius: 32px; box-shadow: 0 20px 50px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; max-width: 550px; width: 100%;">
            <div style="width: 64px; height: 64px; background: #fee2e2; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            </div>
            <h1 style="font-size: 2.25rem; font-weight: 800; margin-bottom: 16px; color: #0f172a; letter-spacing: -0.025em;">EchoRouth</h1>
            <p style="font-size: 1.25rem; line-height: 1.6; color: #475569; margin-bottom: 32px; font-weight: 500;">
              This service has been rebranded and the old "CommuteCast" URL is now permanently disabled.
            </p>
            <div style="background: #f1f5f9; padding: 20px; border-radius: 16px; margin-bottom: 32px;">
              <p style="font-size: 0.95rem; color: #64748b; margin: 0;">
                To protect your security and payment integrations, we have moved to a new official domain.
              </p>
            </div>
            <p style="font-size: 0.875rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
              Please use the updated URL from your dashboard.
            </p>
          </div>
        </div>
      `);
      return;
    }
    next();
  });

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("CRITICAL: No valid Gemini API key found in environment!");
    console.log("Available env keys:", Object.keys(process.env));
  } else {
    console.log(`Valid API key found (length: ${apiKey.length})`);
  }

  // API Routes
  
  app.get('/api/health', (req, res) => {
    const key = getApiKey();
    res.json({ 
      status: 'ok',
      geminiKeyLength: key.length,
      isPlaceholder: key === 'MY_USER_GEMINI_KEY'
    });
  });

  // Secure Generation Endpoint with IP Tracking and Free Trial Enforcement
  app.post('/api/generate', async (req, res) => {
    try {
      const { userId, input, tone, length, language, isPremium } = req.body;
      
      if (!userId || !input) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const apiKey = getApiKey();
      if (!apiKey) {
        return res.status(500).json({ error: 'Gemini API key is not configured on the server. Please add USER_GEMINI_KEY to your secrets.' });
      }

      // Create a new GoogleGenAI instance right before making an API call
      const ai = new GoogleGenAI({ apiKey });

      // 3. Generate the Podcast Script using Gemini
      const lengthInstruction = length === '2min' ? 'Make it a 2-minute summary (around 15-20 lines of dialogue total).' : length === '3min' ? 'Make it a 3-minute summary (around 25-30 lines of dialogue total).' : 'Make it a 4-minute summary (around 35-40 lines of dialogue total).';
      
      const response = await withRetry(() => ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `You are an expert podcast producer. Create a podcast script between two hosts, Aavya and Ishaan, discussing the following news articles or topics. 
        
        If the input asks for today's news about specific topics (e.g. "today international news", "AI news", "Karnataka news"), use your Google Search tool to find the latest information and base the podcast on those facts.
        
        The script should be formatted EXACTLY like this:
        Aavya: [Aavya's dialogue]
        Ishaan: [Ishaan's dialogue]
        
        Language: ${language || 'English'}
        Tone: ${tone || 'conversational'}
        Length: ${lengthInstruction}
        
        CRITICAL: The entire dialogue MUST be written in ${language || 'English'}.
        Do not include any sound effects, stage directions, or other text besides the dialogue.
        
        Input material:
        ${input}`,
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: `You write engaging 2-person podcast scripts. You must write the script in ${language || 'English'}. Return a JSON object with 'title' and 'script'.`,
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: "A short, catchy title (max 6 words). Do not use quotes."
              },
              script: {
                type: Type.STRING,
                description: "The podcast dialogue formatted as Aavya: ... Ishaan: ..."
              }
            },
            required: ["title", "script"]
          }
        }
      }));

      let generatedScript = '';
      let generatedTitle = 'My EchoRouth';
      
      try {
        let jsonStr = response.text?.trim() || '{}';
        if (jsonStr.startsWith('```json')) {
          jsonStr = jsonStr.substring(7);
        }
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.substring(3);
        }
        if (jsonStr.endsWith('```')) {
          jsonStr = jsonStr.substring(0, jsonStr.length - 3);
        }
        jsonStr = jsonStr.trim();
        
        const parsed = JSON.parse(jsonStr);
        generatedScript = parsed.script || '';
        generatedTitle = parsed.title || 'My EchoRouth';
      } catch (e) {
        console.error("Failed to parse JSON response:", e);
        generatedScript = response.text || '';
      }
      
      // Basic Content Moderation
      if (containsMaliciousLinks(generatedScript)) {
        return res.status(400).json({ error: 'Generated content contains potentially malicious links.' });
      }

      res.json({ script: generatedScript, title: generatedTitle });
    } catch (error: any) {
      console.error('Generation error details:', error);
      
      const errorMsg = error?.message || String(error);
      const isQuotaError = errorMsg.includes('429') || errorMsg.includes('Quota exceeded') || errorMsg.includes('RESOURCE_EXHAUSTED');
      
      if (isQuotaError) {
        return res.status(429).json({ 
          error: `API Quota Exceeded: ${errorMsg}` 
        });
      }
      
      res.status(500).json({ error: 'Failed to generate podcast: ' + errorMsg });
    }
  });

  app.post('/api/scrape', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || !url.startsWith('http')) {
        return res.status(400).json({ error: 'Valid URL is required' });
      }

      // Existing scraping logic
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      $('script, style, nav, footer, header, aside, .ad, .advertisement, iframe').remove();
      
      let content = '';
      const articleSelectors = ['article', '.article-content', '.post-content', 'main', '#main-content'];
      for (const selector of articleSelectors) {
        if ($(selector).length > 0) {
          content = $(selector).text();
          break;
        }
      }
      
      if (!content) {
        content = $('body').text();
      }
      
      content = content.replace(/\s+/g, ' ').trim();
      if (content.length > 15000) {
        content = content.substring(0, 15000) + '...';
      }

      const title = $('title').text().trim() || url;
      res.json({ title, content });
    } catch (error: any) {
      console.error('Scraping error:', error.message);
      res.status(500).json({ error: 'Failed to scrape URL' });
    }
  });

  app.get('/api/feed/:userId', async (req, res) => {
    try {
      if (!db) throw new Error("Firebase not configured");
      
      const { userId } = req.params;
      const q = query(
        collection(db, 'podcasts'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      const feed = new RSS_Any({
        title: 'My EchoRouth',
        description: 'Personalized audio summaries generated by AI.',
        feed_url: `${process.env.APP_URL}/api/feed/${userId}`,
        site_url: process.env.APP_URL || 'http://localhost:3000',
        language: 'en',
      });

      snapshot.forEach((doc) => {
        const podcast = doc.data();
        feed.item({
          title: podcast.title,
          description: podcast.script.substring(0, 200) + '...',
          url: `${process.env.APP_URL}/`,
          guid: podcast.id,
          date: podcast.createdAt?.toDate ? podcast.createdAt.toDate() : new Date(),
          enclosure: {
            url: `${process.env.APP_URL}/api/audio/${podcast.id}`,
            type: 'audio/wav',
          }
        });
      });

      res.set('Content-Type', 'application/rss+xml');
      res.send(feed.xml());
    } catch (error: any) {
      console.error('RSS error:', error);
      res.status(500).send('Error generating RSS feed');
    }
  });

  app.get('/api/audio/:podcastId', async (req, res) => {
    try {
      if (!db) throw new Error("Firebase not configured");
      
      const { podcastId } = req.params;
      const podcastRef = doc(db, 'podcasts', podcastId);
      const podcastSnap = await getDoc(podcastRef);
      
      if (!podcastSnap.exists()) {
        return res.status(404).send('Podcast not found');
      }
      
      const podcast = podcastSnap.data();
      const audioBuffer = await generateChunkedAudio(podcast.script);
      
      if (!audioBuffer) {
        throw new Error("Failed to generate audio");
      }
      
      res.set({
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.length,
        'Accept-Ranges': 'bytes'
      });
      
      res.send(audioBuffer);
    } catch (error: any) {
      console.error('Audio generation error:', error);
      res.status(500).send('Error generating audio');
    }
  });

  app.post('/api/generate-audio', async (req, res) => {
    try {
      const { script } = req.body;
      if (!script) {
        return res.status(400).json({ error: 'Script is required' });
      }

      const audioBuffer = await generateChunkedAudio(script);
      if (!audioBuffer) {
        return res.status(500).json({ error: 'Failed to generate audio' });
      }

      res.json({ audio: audioBuffer.toString('base64') });
    } catch (error: any) {
      console.error('Audio generation error:', error);
      
      const errorMsg = error?.message || String(error);
      const isQuotaError = errorMsg.includes('429') || errorMsg.includes('Quota exceeded') || errorMsg.includes('RESOURCE_EXHAUSTED');
      
      if (isQuotaError) {
        return res.status(429).json({ 
          error: `API Quota Exceeded: ${errorMsg}` 
        });
      }
      
      res.status(500).json({ error: errorMsg || 'Error generating audio' });
    }
  });

  async function generateChunkedAudio(script: string): Promise<Buffer | null> {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("USER_GEMINI_KEY not configured");
    const ai = new GoogleGenAI({ apiKey });

    // Split script into speaker turns
    const lines = script.split('\n').filter(l => l.trim() !== '');
    const chunks: string[] = [];
    let currentChunk = "";
    
    // Group lines into chunks of ~4500 characters to minimize API requests and avoid rate limits
    for (const line of lines) {
      if (currentChunk.length + line.length > 4500 && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      currentChunk += line + "\n";
    }
    if (currentChunk) chunks.push(currentChunk.trim());

    console.log(`Generating audio in ${chunks.length} chunks...`);

    const audioParts: Buffer[] = [];
    
    // Process chunks sequentially to avoid rate limits
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      try {
        // Add a delay between requests to prevent hitting rate limits
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        const prompt = `TTS the following conversation between Aavya and Ishaan:\n${chunkText}`;
          const response = await withRetry(() => ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                  multiSpeakerVoiceConfig: {
                    speakerVoiceConfigs: [
                          { speaker: 'Aavya', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },   // Female
                          { speaker: 'Ishaan', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } } // Male (Deep)
                    ]
                  }
              }
            }
          }));
          
          const base64Data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (!base64Data) {
            console.warn("No audio data returned for chunk");
            return null;
          }
          
          const buffer = Buffer.from(base64Data, 'base64');
          // Strip WAV header if present to allow clean concatenation
          if (buffer.length > 44 && buffer.toString('utf8', 0, 4) === 'RIFF') {
            // Find the 'data' chunk
            let offset = 12; // Skip RIFF header and WAVE format
            while (offset < buffer.length - 8) {
              const chunkId = buffer.toString('utf8', offset, offset + 4);
              const chunkSize = buffer.readUInt32LE(offset + 4);
              if (chunkId === 'data') {
                audioParts.push(buffer.subarray(offset + 8, offset + 8 + chunkSize));
                break;
              }
              offset += 8 + chunkSize;
            }
            // Fallback if 'data' chunk not found
            if (offset >= buffer.length - 8) {
              audioParts.push(buffer.subarray(44));
            }
          } else {
            audioParts.push(buffer);
          }
        } catch (err: any) {
          console.error(`Error generating audio for chunk: ${err.message}`);
          console.error("FULL_ERROR_DETAILS:", JSON.stringify(err, null, 2));
          // Continue to the next chunk even if one fails
        }
      }

    if (audioParts.length === 0) {
      throw new Error("All audio chunks failed to generate. Please try again later.");
    }

    // Concatenate all raw PCM parts
    const totalLength = audioParts.reduce((acc, val) => acc + val.length, 0);
    const combinedRaw = Buffer.concat(audioParts);
    
    // Add a single WAV header for the entire combined audio
    return createWavBuffer(combinedRaw.toString('base64'), 24000);
  }

  app.post('/api/create-razorpay-order', async (req, res) => {
    try {
      const { userId, couponCode, isRecurring } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      let amount = 9900; // ₹99.00 (amount in smallest currency unit, paise)
      let discountApplied = false;
      let discountPercentage = 0;

      // Flexible coupon logic from environment variables
      if (couponCode) {
        try {
          const couponData = JSON.parse(process.env.COUPON_DATA || '{}');
          if (couponData[couponCode]) {
            discountPercentage = couponData[couponCode];
            amount = Math.floor(amount * (1 - discountPercentage / 100));
            discountApplied = true;
          }
        } catch (e) {
          console.error('Error parsing COUPON_DATA:', e);
        }
      }

      if (discountPercentage === 100) {
        return res.json({ mock: true, message: 'Coupon applied! Enjoy your free upgrade.' });
      }

      // If no Razorpay key is provided, use a mock checkout flow for testing
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        console.warn('Razorpay keys are missing. Using mock checkout flow.');
        return res.json({ mock: true, amount: amount / 100 });
      }

      const rzp = getRazorpay();
      const planId = process.env.RAZORPAY_PLAN_ID;

      // Use Subscription (Auto-Pay) ONLY if isRecurring is true AND a Plan ID exists AND no discount is applied
      // (Razorpay Subscriptions are tricky with one-time coupons, so we use Orders for discounted first payments)
      if (isRecurring && planId && !discountApplied) {
        const subscription = await rzp.subscriptions.create({
          plan_id: planId,
          total_count: 12, // 1 year
          quantity: 1,
          customer_notify: 1,
          notes: {
            userId: userId
          }
        });

        return res.json({ 
          subscriptionId: subscription.id, 
          keyId: process.env.RAZORPAY_KEY_ID,
          amount: amount,
          currency: 'INR',
          isSubscription: true
        });
      }

      // Fallback to one-time Order (for "1 Month" option or if discount is applied)
      const order = await rzp.orders.create({
        amount: amount,
        currency: 'INR',
        receipt: `rcpt_${Date.now()}` // Max length is 40 chars
      });

      res.json({ 
        orderId: order.id, 
        keyId: process.env.RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        discountApplied,
        isSubscription: false
      });
    } catch (error: any) {
      console.error('Razorpay error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

function createWavBuffer(base64Data: string, sampleRate: number): Buffer {
  const audioBytes = Buffer.from(base64Data, 'base64');
  if (audioBytes.length > 4 && audioBytes.toString('utf8', 0, 4) === 'RIFF') {
    return audioBytes;
  }
  const buffer = Buffer.alloc(44 + audioBytes.length);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + audioBytes.length, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(audioBytes.length, 40);
  audioBytes.copy(buffer, 44);
  return buffer;
}

startServer().catch(error => {
  console.error("FAILED TO START SERVER:", error);
  process.exit(1);
});
