// Importiere notwendige Module
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();


const app = express();
const PORT = process.env.PORT || 3000;

// --- API-Key und Authentifizierung ---
const API_KEY = process.env.API_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL;

if (process.env.NODE_ENV !== 'production' && !API_KEY) {
    console.warn("WARNUNG: API_KEY ist in der lokalen Entwicklungsumgebung nicht gesetzt. Die API-Authentifizierung wird umgangen. Bitte setze API_KEY in deiner .env-Datei für volle Sicherheit.");
}


// --- Speicherpfad Konfiguration ---
let storageBasePath;
if (process.env.NODE_ENV === 'production' && process.env.RENDER === 'true') {
    storageBasePath = '/var/data';
    console.log("Running in Production (Render.com), using /var/data for storage.");
} else {
    storageBasePath = path.join(__dirname, 'data');
    console.log(`Running Locally, using ${storageBasePath} for storage.`);
}

function getRoomMemesDir(roomId) {
    const sanitizedRoomId = roomId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!sanitizedRoomId) {
        console.warn(`Invalid or empty roomId provided: "${roomId}". Using 'default' room.`);
        return path.join(storageBasePath, 'memes', 'default');
    }
    return path.join(storageBasePath, 'memes', sanitizedRoomId);
}

// --- Middleware Konfiguration ---

// **1. CORS Middleware (MUSS ZUERST SEIN, um Preflight-Anfragen korrekt zu behandeln)**
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = [
            FRONTEND_URL,
            'http://localhost:8080',
            'http://127.0.0.1:8080',
            `http://localhost:${PORT}`
        ].filter(Boolean);

        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log(`CORS blocked request from origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

// **2. Statische Dateibereitstellung für Memes (MUSS HIER VOR der API-Key Authentifizierung stehen)**
// Diese Route muss _nicht_ authentifiziert werden, da sie direkt von <img> Tags aufgerufen wird.
app.use('/memes/:roomId/:filename', (req, res, next) => {
    const roomId = req.params.roomId;
    const filename = req.params.filename;
    const roomMemesDir = getRoomMemesDir(roomId);
    
    // Setze den Request-Pfad auf den relativen Pfad der Datei innerhalb des Raumverzeichnisses
    req.url = `/${filename}`; 
    
    // Liefere die Datei aus dem spezifischen Raumverzeichnis
    express.static(roomMemesDir)(req, res, next);
});


// **3. Authentifizierungs-Middleware (Muss nach CORS und statischer Dateibereitstellung, aber vor den API-Routen kommen)**
function authenticateApiKey(req, res, next) {
    // WICHTIG: Erlaube OPTIONS-Anfragen (Preflight) ohne API-Key.
    if (req.method === 'OPTIONS') {
        return next();
    }

    if (process.env.NODE_ENV !== 'production' && !API_KEY) {
        return next();
    }

    const providedApiKey = req.headers['x-api-key'] || req.query.api_key;

    if (!providedApiKey || providedApiKey !== API_KEY) {
        console.warn(`Unauthorized API access attempt from IP: ${req.ip} (Provided Key: ${providedApiKey ? 'Yes' : 'No'}).`);
        return res.status(401).json({ message: 'Unauthorized: Invalid API Key' });
    }
    next();
}
// Wende die API-Schutz-Middleware an. Sie muss HIER angewendet werden.
app.use(authenticateApiKey);


// **4. Sicherheits-Header (Helmet)**
app.use(helmet());

// **5. JSON Body Parser (für POST-Anfragen)**
app.use(express.json({ limit: '50mb' }));

// --- Rate Limiting für die API-Endpunkte ---
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Zu viele Anfragen von dieser IP, bitte versuchen Sie es später erneut.'
});

const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Zu viele Uploads von dieser IP, bitte versuchen Sie es später erneut.'
});

// Wende Rate Limiting auf die relevanten Routen an
app.use(apiLimiter);


// --- API-Routen (alle nachfolgenden Routen sind geschützt) ---

app.post('/upload-meme/:roomId', uploadLimiter, async (req, res) => {
    const { imageDataUrl } = req.body;
    const roomId = req.params.roomId;

    if (!imageDataUrl || !roomId) {
        return res.status(400).json({ message: 'ImageDataUrl and Room ID are required.' });
    }

    const roomMemesDir = getRoomMemesDir(roomId);

    try {
        await fs.mkdir(roomMemesDir, { recursive: true });
        console.log(`Directory ensured: ${roomMemesDir}`);
    } catch (err) {
        console.error(`Error ensuring directory ${roomMemesDir}:`, err);
        return res.status(500).json({ message: 'Failed to create meme directory for room.' });
    }

    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `meme-${Date.now()}.png`;
    const filepath = path.join(roomMemesDir, filename);

    try {
        await fs.writeFile(filepath, buffer);
        console.log(`Meme saved: ${filepath} for room: ${roomId}`);

        const backendBaseUrl = process.env.BACKEND_BASE_URL || `http://localhost:${PORT}`;
        const memeUrl = `${backendBaseUrl}/memes/${roomId}/${filename}`;
        res.status(201).json({ message: 'Meme uploaded successfully', imageUrl: memeUrl });

    } catch (err) {
        console.error('Error saving meme:', err);
        res.status(500).json({ message: 'Failed to save meme.' });
    }
});

app.get('/memes-list/:roomId', async (req, res) => {
    const roomId = req.params.roomId;

    if (!roomId) {
        return res.status(400).json({ message: 'Room ID is required.' });
    }

    const roomMemesDir = getRoomMemesDir(roomId);

    try {
        const files = await fs.readdir(roomMemesDir);
        const memeFiles = files.filter(file => file.endsWith('.png'))
                                .sort((a, b) => b.localeCompare(a));

        const backendBaseUrl = process.env.BACKEND_BASE_URL || `http://localhost:${PORT}`;
        const memeUrls = memeFiles.map(file => {
            return `${backendBaseUrl}/memes/${roomId}/${file}`;
        });
        res.json(memeUrls);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log(`No memes found for room: ${roomId} (directory ${roomMemesDir} does not exist).`);
            return res.json([]);
        }
        console.error('Error reading memes directory for room:', err);
        res.status(500).json({ message: 'Failed to retrieve memes for room.' });
    }
});

app.delete('/delete-meme/:roomId/:filename', async (req, res) => {
    const roomId = req.params.roomId;
    const filename = req.params.filename;

    if (!roomId || !filename) {
        return res.status(400).json({ message: 'Room ID and filename are required.' });
    }

    const roomMemesDir = getRoomMemesDir(roomId);
    const filepath = path.join(roomMemesDir, filename);

    try {
        const resolvedPath = path.resolve(filepath);
        const resolvedRoomMemesDir = path.resolve(roomMemesDir);

        if (!resolvedPath.startsWith(resolvedRoomMemesDir)) {
            console.warn(`Attempted path traversal detected: ${filepath} (resolved to ${resolvedPath})`);
            return res.status(403).json({ message: 'Forbidden: Invalid file path.' });
        }

        await fs.unlink(resolvedPath);
        console.log(`Meme deleted: ${resolvedPath} for room: ${roomId}`);
        res.status(200).json({ message: 'Meme deleted successfully.' });

    } catch (err) {
        if (err.code === 'ENOENT') {
            return res.status(404).json({ message: 'Meme not found.' });
        }
        console.error(`Error deleting meme ${filepath}:`, err);
        res.status(500).json({ message: 'Failed to delete meme.' });
    }
});


// Statische Dateien für das Frontend ausliefern (z.B. index.html, script.js, style.css)
// Dies sollte im Hosting des Frontend-Dienstes auf Render.com erfolgen.
// Nur für lokale Entwicklung ist dies hier relevant.
if (process.env.NODE_ENV !== 'production') {
    app.use(express.static(path.join(__dirname, 'public')));
    console.log("Serving static files from /public for local development.");
}


// --- Server starten ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    if (process.env.NODE_ENV === 'production') {
        console.log(`Backend URL: ${process.env.BACKEND_BASE_URL}`);
        console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
    }
});