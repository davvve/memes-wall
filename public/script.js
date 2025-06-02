document.addEventListener('DOMContentLoaded', () => {
    const imageUpload = document.getElementById('imageUpload');
    const imagePreview = document.getElementById('imagePreview');
    const memeCanvasContainer = document.getElementById('memeCanvasContainer');
    const memeCanvas = document.getElementById('memeCanvas');
    const ctx = memeCanvas.getContext('2d');
    const memeTextarea = document.getElementById('memeText');
    const fontSizeInput = document.getElementById('fontSize');
    const addTextBtn = document.getElementById('addTextBtn');
    const generateMemeBtn = document.getElementById('generateMemeBtn');

    // WICHTIG: Ersetze DIESEN PLATZHALTER durch die URL deines Render.com Backends!
    // Beispiel: https://hochzeit-meme-backend.onrender.com
    const BACKEND_BASE_URL = 'http://localhost:3000';

    let currentImage = null;
    let textElements = []; // Speichert alle Text-Elemente mit ihren Eigenschaften
    let selectedTextElement = null; // Das gerade ausgewählte Text-Element für Drag & Drop
    let isDragging = false;
    let isResizing = false;
    let startX, startY; // Startkoordinaten für Drag & Drop und Größenänderung

    // --- Bild-Upload und Vorschau ---
    imageUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    currentImage = img;
                    // Skaliere das Bild für die Anzeige im Editor, falls es zu groß ist
                    const maxWidth = 550; // Max Breite für den Editor
                    const maxHeight = 400; // Max Höhe für den Editor
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

                    memeCanvas.width = img.width; // Der Canvas selbst bekommt Originalgröße für Qualität
                    memeCanvas.height = img.height;
                    
                    memeCanvasContainer.style.width = width + 'px';
                    memeCanvasContainer.style.height = height + 'px';
                    memeCanvasContainer.style.maxWidth = '100%';
                    memeCanvasContainer.style.maxHeight = '400px'; // Oder eine feste Höhe, die du möchtest
                    
                    drawMeme(); // Bild auf Canvas zeichnen
                    imagePreview.style.display = 'none'; // Vorschau ausblenden
                    memeCanvasContainer.style.display = 'block'; // Canvas anzeigen
                    
                    // Alle vorhandenen Text-Elemente neu positionieren (falls schon welche da waren)
                    // Da wir den Container skalieren, müssen die Texte relativ dazu positioniert werden
                    // (Das ist etwas komplexer, für einfaches Drag & Drop lassen wir die Texte 1:1)
                    // Wenn der Container skaliert wird, verschieben sich die DOM-Textelemente mit
                    // Die relevanten Koordinaten sind dann die CSS-Left/Top Werte im Verhältnis zum Canvas-Container
                    // Wenn wir später auf den finalen Canvas zeichnen, müssen wir die Skalierung der DOM-Elemente
                    // zum Originalbild berücksichtigen.

                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // --- Text hinzufügen ---
    addTextBtn.addEventListener('click', () => {
        const text = memeTextarea.value.trim();
        if (text && currentImage) {
            const fontSize = parseInt(fontSizeInput.value);
            
            // Initialposition: unten mittig auf dem Bild relativ zum Canvas-Container
            // Wir müssen die Größe des Canvas-Containers berücksichtigen, nicht des Canvas selbst
            const containerWidth = memeCanvasContainer.clientWidth;
            const containerHeight = memeCanvasContainer.clientHeight;

            const x = containerWidth / 2;
            const y = containerHeight - 20; // 20px vom unteren Rand
            addTextToMeme(text, x, y, fontSize);
            memeTextarea.value = ''; // Textfeld leeren
        } else if (!currentImage) {
            alert('Bitte zuerst ein Bild hochladen!');
        }
    });

    // Funktion zum Hinzufügen eines Text-Elements zum Meme
    function addTextToMeme(text, x, y, fontSize) {
        const textElement = document.createElement('div');
        textElement.classList.add('meme-text-element');
        textElement.textContent = text;
        textElement.style.fontSize = `${fontSize}px`;
        
        // Zentrum des Textes an x,y ausrichten
        textElement.style.left = `${x}px`;
        textElement.style.top = `${y}px`;
        textElement.style.transform = 'translate(-50%, -50%)'; 

        memeCanvasContainer.appendChild(textElement);
        textElements.push(textElement);

        // Event Listener für Drag & Drop und Größenänderung
        makeTextDraggableAndResizable(textElement);
    }

    // --- Drag & Drop für Text-Elemente ---
    function makeTextDraggableAndResizable(textElement) {
        let resizeHandle = document.createElement('div');
        resizeHandle.classList.add('resize-handle'); 
        textElement.appendChild(resizeHandle);

        const handleMouseDown = (e) => {
            selectedTextElement = textElement;
            if (e.target === resizeHandle) {
                isResizing = true;
            } else {
                isDragging = true;
            }
            startX = e.clientX || e.touches[0].clientX;
            startY = e.clientY || e.touches[0].clientY;
            e.preventDefault(); 
        };

        const handleMouseMove = (e) => {
            if (selectedTextElement !== textElement) return;

            const currentX = e.clientX || e.touches[0].clientX;
            const currentY = e.clientY || e.touches[0].clientY;

            if (isDragging) {
                let rect = textElement.getBoundingClientRect();
                let containerRect = memeCanvasContainer.getBoundingClientRect();

                let newX = currentX - startX + rect.left;
                let newY = currentY - startY + rect.top;

                // Relative Positionierung innerhalb des Containers
                newX = newX - containerRect.left;
                newY = newY - containerRect.top;

                // Sicherstellen, dass der Text innerhalb des Containers bleibt
                newX = Math.max(0, Math.min(newX, containerRect.width - rect.width));
                newY = Math.max(0, Math.min(newY, containerRect.height - rect.height));

                // Wir setzen left/top als Mittelpunkt, daher müssen wir die halbe Breite/Höhe addieren
                textElement.style.left = `${newX + rect.width / 2}px`;
                textElement.style.top = `${newY + rect.height / 2}px`;
            } else if (isResizing) {
                const deltaY = currentY - startY;
                const currentFontSize = parseFloat(textElement.style.fontSize);
                let newFontSize = currentFontSize + deltaY / 5; // Empfindlichkeit anpassen
                newFontSize = Math.max(10, Math.min(100, newFontSize)); // Min/Max Schriftgröße
                textElement.style.fontSize = `${newFontSize}px`;
            }
            startX = currentX;
            startY = currentY;
            e.preventDefault(); 
        };

        const handleMouseUp = () => {
            isDragging = false;
            isResizing = false;
            selectedTextElement = null;
        };

        textElement.addEventListener('mousedown', handleMouseDown);
        textElement.addEventListener('touchstart', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('touchmove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('touchend', handleMouseUp);
    }


    // --- Canvas zeichnen (Bild + Text) ---
    function drawMeme() {
        if (!currentImage) return;

        // Setze die Canvas-Größe auf die Größe des Originalbildes
        memeCanvas.width = currentImage.width;
        memeCanvas.height = currentImage.height;

        // Zeichne das Bild auf den Canvas
        ctx.clearRect(0, 0, memeCanvas.width, memeCanvas.height);
        ctx.drawImage(currentImage, 0, 0, memeCanvas.width, memeCanvas.height);
    }

    // --- Meme generieren und senden ---
    generateMemeBtn.addEventListener('click', async () => {
        if (!currentImage) {
            alert('Bitte zuerst ein Bild hochladen!');
            return;
        }

        // Temporärer Canvas für die finale Bildgenerierung
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = currentImage.width;
        finalCanvas.height = currentImage.height;
        const finalCtx = finalCanvas.getContext('2d');

        // Originalbild zeichnen
        finalCtx.drawImage(currentImage, 0, 0, finalCanvas.width, finalCanvas.height);

        // Skalierungsfaktor zwischen Editor-Container und Originalbild
        const scaleX = currentImage.width / memeCanvasContainer.clientWidth;
        const scaleY = currentImage.height / memeCanvasContainer.clientHeight;

        // Alle Text-Elemente auf den finalen Canvas zeichnen
        textElements.forEach(textElement => {
            const computedStyle = window.getComputedStyle(textElement);
            const fontSizePx = parseFloat(computedStyle.fontSize);
            const fontFamily = computedStyle.fontFamily;
            const textContent = textElement.textContent;

            finalCtx.font = `${fontSizePx * scaleY}px ${fontFamily}`; // Schriftgröße skalieren
            finalCtx.textAlign = 'center'; 
            finalCtx.textBaseline = 'middle'; 

            // Position des Text-Elements relativ zum Canvas-Container
            // Da wir translate(-50%, -50%) verwenden, ist left/top der Mittelpunkt des Textes
            const textLeftPx = parseFloat(textElement.style.left);
            const textTopPx = parseFloat(textElement.style.top);

            // Umrechnung der DOM-Position auf Canvas-Koordinaten mit Skalierung
            const finalX = textLeftPx * scaleX;
            const finalY = textTopPx * scaleY;

            // Meme-Textschatten (Schwarz)
            finalCtx.fillStyle = 'black'; 
            const shadowOffset = 2 * (scaleX + scaleY) / 2; // Schatten-Offset skalieren
            finalCtx.fillText(textContent, finalX - shadowOffset, finalY - shadowOffset);
            finalCtx.fillText(textContent, finalX + shadowOffset, finalY - shadowOffset);
            finalCtx.fillText(textContent, finalX - shadowOffset, finalY + shadowOffset);
            finalCtx.fillText(textContent, finalX + shadowOffset, finalY + shadowOffset);
            
            // Meme-Text (Weiß)
            finalCtx.fillStyle = 'white'; 
            finalCtx.fillText(textContent, finalX, finalY);
        });

        // Meme als Data URL (PNG) erhalten
        const imageDataUrl = finalCanvas.toDataURL('image/png');

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/upload-meme`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ image: imageDataUrl }),
            });

            if (response.ok) {
                alert('Meme erfolgreich geteilt und wird auf der Social Wall angezeigt!');
                resetMemeGenerator();
            } else {
                const errorData = await response.json();
                alert(`Fehler beim Hochladen des Memes: ${errorData.message || response.statusText}`);
            }
        } catch (error) {
            console.error('Fehler beim Senden des Memes:', error);
            alert('Netzwerkfehler. Bitte überprüfe deine Verbindung.');
        }
    });

    // --- Zurücksetzen der Meme-Generierung ---
    function resetMemeGenerator() {
        currentImage = null;
        textElements.forEach(el => el.remove()); // Alle Text-Elemente entfernen
        textElements = [];
        memeTextarea.value = '';
        fontSizeInput.value = 40; // Standard-Schriftgröße zurücksetzen
        imageUpload.value = ''; // Dateiauswahl zurücksetzen
        imagePreview.style.display = 'flex'; // Vorschau wieder anzeigen
        memeCanvasContainer.style.display = 'none'; // Canvas ausblenden
        ctx.clearRect(0, 0, memeCanvas.width, memeCanvas.height); // Canvas leeren
        memeCanvasContainer.style.width = '100%'; // Containerbreite zurücksetzen
        memeCanvasContainer.style.height = '300px'; // Containerhöhe zurücksetzen
    }
});