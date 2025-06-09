// Konfiguration des Backends (Backend-URL von Render.com)
let BACKEND_BASE_URL;
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    BACKEND_BASE_URL = 'http://localhost:3000'; // Lokale Entwicklung
} else {
    // Für Render.com Produktionsumgebung
    BACKEND_BASE_URL = 'https://memes-wall.onrender.com'; // <--- HIER ANPASSEN!
}

// API-Key für das Frontend
// WARNUNG: Dieser Key ist im Browser sichtbar! Für ein einfaches Hochzeitsprojekt ist das oft akzeptabel.
// WICHTIG: Füge hier den GLEICHEN API-Key ein, den du bei Render.com als "API_KEY" hinterlegt hast!
const FRONTEND_API_KEY = '0a7db09c6859445f802cf0ea4836507f';

// --- DOM-Elemente abrufen ---
const imageUpload = document.getElementById('imageUpload');
const memeCanvas = document.getElementById('memeCanvas');
const imageUploadArea = document.querySelector('.image-upload-area'); // Get the new clickable area
const uploadPlaceholder = document.getElementById('uploadPlaceholder'); // Get the placeholder text
const ctx = memeCanvas.getContext('2d');
const topTextInput = document.getElementById('topTextInput');
const bottomTextInput = document.getElementById('bottomTextInput');
const fontSizeControl = document.getElementById('fontSizeControl');
const generateAndSaveBtn = document.getElementById('generateAndSaveBtn');

let currentImage = null; // Das geladene Bildobjekt
let memeTexts = []; // Array zum Speichern der Textfelder {text, x, y, size, color, font, align, stroke, strokeWidth}
let selectedTextIndex = -1; // Index des aktuell ausgewählten/gezogenen Textfeldes
let dragOffsetX, dragOffsetY; // Offset für Drag-Operationen

// --- Multi-Room Fähigkeit: Raum-ID aus der URL lesen ---
function getRoomIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');
    if (!roomId) {
        console.warn("No 'room' parameter found in URL. Using 'default' room.");
        alert("Achtung: Keine Raum-ID in der URL gefunden. Es wird der Standardraum 'default' verwendet. Bitte stelle sicher, dass du die korrekte URL verwendest (z.B. ?room=deineHochzeitsID).");
        return 'default'; // Fallback auf einen Standardraum
    }
    // Einfache Bereinigung der Raum-ID, um gültige Ordnernamen zu gewährleisten
    return roomId.replace(/[^a-zA-Z0-9_-]/g, '');
}
const currentRoomId = getRoomIdFromUrl();

// --- Initialisierung und Event-Listener ---
function initCanvas() {
    // Canvas mit einer Standardgröße initialisieren
    memeCanvas.width = 600;
    memeCanvas.height = 400;
    ctx.clearRect(0, 0, memeCanvas.width, memeCanvas.height);
    // Placeholder text is now handled by HTML/CSS
}

// Removed drawPlaceholderText function as it's now handled by HTML/CSS

function setupEventListeners() {
    // Bild-Upload per Drag & Drop auf den neuen Bereich
    imageUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        imageUploadArea.classList.add('drag-over');
    });
    imageUploadArea.addEventListener('dragleave', () => {
        imageUploadArea.classList.remove('drag-over');
    });
    imageUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        imageUploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleImageFile(e.dataTransfer.files[0]);
        }
    });

    // Explicitly trigger file input when the image upload area is clicked
    imageUploadArea.addEventListener('click', (e) => {
        // Only trigger file input if the click is not on the canvas itself (for text dragging)
        // and if no image is loaded (i.e., placeholder is visible)
        if (e.target === imageUploadArea || e.target === uploadPlaceholder) {
            imageUpload.click();
        }
    });

    // Bild-Upload per Dateiauswahl
    imageUpload.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleImageFile(e.target.files[0]);
        }
    });

    // Texteingaben aktualisieren das Meme in Echtzeit
    topTextInput.addEventListener('input', drawMeme);
    bottomTextInput.addEventListener('input', drawMeme);
    fontSizeControl.addEventListener('input', drawMeme);

    // Meme generieren und speichern
    generateAndSaveBtn.addEventListener('click', async () => {
        if (!currentImage) {
            alert('Bitte lade zuerst ein Bild hoch.');
            return;
        }
        drawMeme(true); // Zeichne final, ohne interaktive Elemente
        const imageDataUrl = memeCanvas.toDataURL('image/png');
        await uploadMeme(imageDataUrl);
    });

    // --- Canvas Interaktion (Ziehen von Textfeldern) ---
    memeCanvas.addEventListener('mousedown', handleMouseDown);
    memeCanvas.addEventListener('mousemove', handleMouseMove);
    memeCanvas.addEventListener('mouseup', handleMouseUp);
    memeCanvas.addEventListener('mouseout', handleMouseUp); // Falls Maus Canvas verlässt
    
    // --- Touch Events für mobile Geräte ---
    memeCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    memeCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    memeCanvas.addEventListener('touchend', handleTouchEnd);
    memeCanvas.addEventListener('touchcancel', handleTouchEnd);
}

// --- Bildhandling ---
function handleImageFile(file) {
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                currentImage = img;
                // Passe Canvas-Größe an Bild an, aber skaliere, wenn zu groß
                const maxWidth = 800; // Etwas breiter als vorher für mehr Flexibilität
                const maxHeight = 700; 

                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = height * (maxWidth / width);
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = width * (maxHeight / height);
                    height = maxHeight;
                }
                
                // Mindestgröße für das Canvas, damit es immer sichtbar ist
                width = Math.max(width, 300);
                height = Math.max(height, 200);

                memeCanvas.width = width;
                memeCanvas.height = height;

                // Setze die initialen Textfelder zurück oder neu
                memeTexts = [
                    { text: topTextInput.value.toUpperCase(), x: memeCanvas.width / 2, y: memeCanvas.height * 0.15, size: parseInt(fontSizeControl.value), color: 'white', font: 'Impact', align: 'center', stroke: 'black', strokeWidth: 4, type: 'top' },
                    { text: bottomTextInput.value.toUpperCase(), x: memeCanvas.width / 2, y: memeCanvas.height * 0.85, size: parseInt(fontSizeControl.value), color: 'white', font: 'Impact', align: 'center', stroke: 'black', strokeWidth: 4, type: 'bottom' }
                ];
                drawMeme();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        imageUploadArea.classList.add('has-image'); // Add class to hide placeholder
    } else {
        alert('Bitte wähle eine Bilddatei aus.');
        imageUpload.value = '';
        imageUploadArea.classList.remove('has-image'); // Ensure placeholder is visible if upload fails
    }
}

// --- Meme zeichnen ---
function drawMeme(isFinalRender = false) {
    ctx.clearRect(0, 0, memeCanvas.width, memeCanvas.height); // Canvas leeren

    if (currentImage) {
        ctx.drawImage(currentImage, 0, 0, memeCanvas.width, memeCanvas.height);
    } else {
        // Placeholder text is now handled by HTML/CSS
        return; // Kein Bild, kein Meme
    }

    // Aktualisiere die Texte basierend auf den Input-Feldern
    memeTexts[0].text = topTextInput.value.toUpperCase();
    memeTexts[0].size = parseInt(fontSizeControl.value);
    
    memeTexts[1].text = bottomTextInput.value.toUpperCase();
    memeTexts[1].size = parseInt(fontSizeControl.value);


    memeTexts.forEach((textObj, index) => {
        if (!textObj.text) return; // Leere Texte nicht zeichnen

        ctx.font = `${textObj.size}px ${textObj.font}`;
        ctx.fillStyle = textObj.color;
        ctx.textAlign = textObj.align;
        ctx.strokeStyle = textObj.stroke;
        ctx.lineWidth = textObj.strokeWidth;
        ctx.lineJoin = 'round'; // Für bessere Ecken beim Text-Outline

        // Schatteneffekt für besseren Kontrast
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 7;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        ctx.strokeText(textObj.text, textObj.x, textObj.y);
        ctx.fillText(textObj.text, textObj.x, textObj.y);

        // Schatten zurücksetzen, damit es andere Elemente nicht beeinflusst
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Zeichne den Rahmen nur, wenn es kein finaler Render ist und der Text ausgewählt ist
        if (!isFinalRender && index === selectedTextIndex) {
            drawSelectionBox(textObj);
        }
    });
}

function drawSelectionBox(textObj) {
    // Umrandung des Textfeldes zur Visualisierung
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]); // Gestrichelte Linie

    const textMetrics = ctx.measureText(textObj.text);
    const textWidth = textMetrics.width;
    const textHeight = textObj.size * 1.2; // Schätzung der Höhe inklusive Ober- und Unterlängen

    // Bounding box basierend auf textAlign
    let xOffset = 0;
    if (textObj.align === 'center') xOffset = textWidth / 2;
    else if (textObj.align === 'right') xOffset = textWidth;

    // Y ist die Baseline, also muss die Box nach oben gezeichnet werden
    ctx.strokeRect(textObj.x - xOffset - 5, textObj.y - textHeight + 5, textWidth + 10, textHeight + 5);
    ctx.setLineDash([]); // Liniendash zurücksetzen
}


// --- Canvas Interaktionslogik ---
function getClickedTextIndex(mouseX, mouseY) {
    // Iteriere rückwärts, damit der oberste Text zuerst erkannt wird
    for (let i = memeTexts.length - 1; i >= 0; i--) {
        const textObj = memeTexts[i];
        if (!textObj.text) continue;

        ctx.font = `${textObj.size}px ${textObj.font}`;
        const textMetrics = ctx.measureText(textObj.text);
        const textWidth = textMetrics.width;
        const textHeight = textObj.size * 1.2; // Wie in drawSelectionBox

        let xMin, xMax, yMin, yMax;
        
        // Bounding box basierend auf textAlign
        if (textObj.align === 'center') {
            xMin = textObj.x - textWidth / 2;
            xMax = textObj.x + textWidth / 2;
        } else if (textObj.align === 'right') {
            xMin = textObj.x - textWidth;
            xMax = textObj.x;
        } else { // 'left'
            xMin = textObj.x;
            xMax = textObj.x + textWidth;
        }
        yMin = textObj.y - textHeight + 5; // Y ist Baseline, Box geht nach oben
        yMax = textObj.y + 5; // Kleiner Puffer unten


        if (mouseX >= xMin && mouseX <= xMax &&
            mouseY >= yMin && mouseY <= yMax) {
            return i;
        }
    }
    return -1; // Keinen Text gefunden
}

function handleMouseDown(e) {
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;
    selectedTextIndex = getClickedTextIndex(mouseX, mouseY);

    if (selectedTextIndex !== -1) {
        const textObj = memeTexts[selectedTextIndex];
        dragOffsetX = mouseX - textObj.x;
        dragOffsetY = mouseY - textObj.y;
        memeCanvas.style.cursor = 'grabbing';
        drawMeme(); // Zeichne mit Auswahlbox
    } else {
        memeCanvas.style.cursor = 'default';
    }
}

function handleMouseMove(e) {
    if (selectedTextIndex !== -1) {
        const textObj = memeTexts[selectedTextIndex];
        textObj.x = e.offsetX - dragOffsetX;
        textObj.y = e.offsetY - dragOffsetY;
        drawMeme();
    } else {
        // Mauszeiger ändern, wenn über einem Textfeld
        const mouseX = e.offsetX;
        const mouseY = e.offsetY;
        if (getClickedTextIndex(mouseX, mouseY) !== -1) {
            memeCanvas.style.cursor = 'grab';
        } else {
            memeCanvas.style.cursor = 'default';
        }
    }
}

function handleMouseUp() {
    selectedTextIndex = -1;
    memeCanvas.style.cursor = 'default';
    drawMeme(); // Final zeichnen, ohne Auswahlbox
}

// --- Touch Event Handlers ---
function handleTouchStart(e) {
    const touch = e.touches[0];
    const rect = memeCanvas.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;

    selectedTextIndex = getClickedTextIndex(touchX, touchY);

    if (selectedTextIndex !== -1) {
        e.preventDefault(); // Only prevent default if a text is selected for dragging
        const textObj = memeTexts[selectedTextIndex];
        dragOffsetX = touchX - textObj.x;
        dragOffsetY = touchY - textObj.y;
    }
    // If no text is selected, allow default behavior (e.g., label click)
}

function handleTouchMove(e) {
    e.preventDefault(); // Verhindert Scrolling/Zooming des Browsers bei Touch
    if (selectedTextIndex !== -1) {
        const touch = e.touches[0];
        const rect = memeCanvas.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;

        const textObj = memeTexts[selectedTextIndex];
        textObj.x = touchX - dragOffsetX;
        textObj.y = touchY - dragOffsetY;
        drawMeme();
    }
}

function handleTouchEnd() {
    selectedTextIndex = -1;
    drawMeme();
}


// --- Meme hochladen ---
async function uploadMeme(imageDataUrl) {
    if (!FRONTEND_API_KEY) {
        alert('API Key nicht geladen. Bitte aktualisiere die Seite.');
        console.error("API Key is missing for upload.");
        return;
    }

    const uploadUrl = `${BACKEND_BASE_URL}/upload-meme/${currentRoomId}`;

    try {
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': FRONTEND_API_KEY
            },
            body: JSON.stringify({ imageDataUrl })
        });

        if (response.ok) {
            const result = await response.json();
            alert('Meme erfolgreich hochgeladen und auf der Social Wall verfügbar!');
            console.log('Uploaded meme URL:', result.imageUrl);
            resetMemeEditor(); // Reset the editor after successful upload
            // Optional: Weiterleitung zur Social Wall nach dem Upload
            // window.location.href = `social-wall.html?room=${currentRoomId}`;
        } else {
            const errorData = await response.json();
            throw new Error(`Upload failed: ${errorData.message}`);
        }
    } catch (error) {
        console.error('Fehler beim Hochladen des Memes:', error);
        alert(`Ein Fehler ist beim Hochladen des Memes aufgetreten: ${error.message || 'Unbekannter Fehler'}`);
    }
}

// --- Editor zurücksetzen ---
function resetMemeEditor() {
    currentImage = null; // Bild zurücksetzen
    ctx.clearRect(0, 0, memeCanvas.width, memeCanvas.height); // Canvas leeren
    memeCanvas.width = 600; // Standardgröße wiederherstellen
    memeCanvas.height = 400;

    topTextInput.value = ''; // Textfelder leeren
    bottomTextInput.value = '';
    fontSizeControl.value = '60'; // Schriftgröße zurücksetzen

    // Initialisiere memeTexts neu mit leeren Werten und Standardpositionen
    memeTexts = [
        { text: '', x: memeCanvas.width / 2, y: memeCanvas.height * 0.15, size: 60, color: 'white', font: 'Impact', align: 'center', stroke: 'black', strokeWidth: 4, type: 'top' },
        { text: '', x: memeCanvas.width / 2, y: memeCanvas.height * 0.85, size: 60, color: 'white', font: 'Impact', align: 'center', stroke: 'black', strokeWidth: 4, type: 'bottom' }
    ];
    selectedTextIndex = -1; // Keine Textauswahl

    imageUpload.value = ''; // Dateiauswahlfeld zurücksetzen
    imageUploadArea.classList.remove('has-image'); // Placeholder wieder anzeigen
    imageUploadArea.classList.remove('drag-over'); // Drag-over-Klasse entfernen

    initCanvas(); // Canvas neu initialisieren (zeichnet den leeren Zustand)
}

// --- Initialisierung beim Laden der Seite ---
document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    setupEventListeners();
});