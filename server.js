// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// --- Konfiguration für die persistente Festplatte ---
// Unterscheide zwischen lokaler Entwicklung und Render.com Deployment
let storageBasePath;

// Render.com setzt eine Umgebungsvariable 'NODE_ENV' auf 'production'
// Zusätzlich könnte Render auch 'RENDER=true' setzen. Wir prüfen beides.
if (process.env.NODE_ENV === 'production' && process.env.RENDER === 'true') {
    // Wenn auf Render.com, nutze den persistenten Mount-Pfad
    // WICHTIG: Dies muss der MOUNT-PFAD sein, den du in Render konfigurierst!
    // Ein gängiger Pfad ist /var/data. Wenn du einen anderen wählst, hier anpassen.
    storageBasePath = '/var/data';
    console.log("Running in Production (Render.com), using /var/data for storage.");
} else {
    // Für die lokale Entwicklung, speichere im Projektordner
    // 'data' Ordner wird direkt im Hauptverzeichnis deines Projekts erstellt.
    storageBasePath = path.join(__dirname, 'data');
    console.log(`Running Locally, using ${storageBasePath} for storage.`);
}

const MEMES_SUBDIR = 'memes'; // Unterverzeichnis für unsere Memes innerhalb des Basis-Pfades
const MEMES_DIR = path.join(storageBasePath, MEMES_SUBDIR);

// Middleware
app.use(cors({
    origin: [
        'http://localhost:8080',
        'http://127.0.0.1:8080',
        process.env.FRONTEND_URL 
    ],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '50mb' }));


// --- Start-Up Logik: Sicherstellen, dass der Meme-Ordner existiert ---
// Diese Logik ist jetzt Teil des app.listen Callbacks
app.listen(port, async () => {
    console.log('Server wird gestartet...');
    try {
        if (!fs.existsSync(MEMES_DIR)) {
            console.log(`Erstelle Verzeichnis: ${MEMES_DIR}`);
            fs.mkdirSync(MEMES_DIR, { recursive: true }); // recursive: true erstellt auch Elternverzeichnisse falls nötig
            console.log('Verzeichnis erfolgreich erstellt.');
        } else {
            console.log(`Verzeichnis ${MEMES_DIR} existiert bereits.`);
        }
    } catch (error) {
        console.error(`Fehler beim Erstellen des Verzeichnisses ${MEMES_DIR}:`, error);
        // Im Fehlerfall könnte man hier den Server beenden: process.exit(1);
        // Oder eine spezifischere Fehlermeldung für den User anzeigen.
    }
    console.log(`Backend läuft auf Port ${port}`);
});

// --- Statische Dateien für Memes bereitstellen ---
app.use('/memes', express.static(MEMES_DIR));


// --- Endpunkt für den Upload eines Memes ---
app.post('/upload-meme', async (req, res) => {
    const imageDataUrl = req.body.image;
    if (!imageDataUrl) {
        return res.status(400).send('Kein Bilddaten-URL bereitgestellt.');
    }

    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    const fileName = `meme-${Date.now()}.png`;
    const filePath = path.join(MEMES_DIR, fileName);

    try {
        fs.writeFileSync(filePath, buffer);
        const memeUrl = `${req.protocol}://${req.get('host')}/memes/${fileName}`;
        console.log(`Meme hochgeladen: ${memeUrl}`);
        res.status(200).json({ message: 'Meme erfolgreich hochgeladen!', url: memeUrl });
    } catch (err) {
        console.error('Fehler beim Speichern des Memes:', err);
        res.status(500).json({ message: 'Fehler beim Speichern des Memes.', error: err.message });
    }
});

// --- Endpunkt zum Abrufen aller Memes (für die Social Wall) ---
app.get('/memes-list', (req, res) => {
    fs.readdir(MEMES_DIR, (err, files) => {
        if (err) {
            console.error('Fehler beim Lesen des Meme-Verzeichnisses:', err);
            return res.status(500).json({ message: 'Fehler beim Abrufen der Memes.', error: err.message });
        }

        const memeUrls = files
            .filter(file => file.startsWith('meme-') && file.endsWith('.png'))
            .map(file => `${req.protocol}://${req.get('host')}/memes/${file}`)
            .sort((a, b) => b.localeCompare(a));

        res.status(200).json(memeUrls);
    });
});