// Konfiguration des Backends (Backend-URL von Render.com)
let BACKEND_BASE_URL;
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    BACKEND_BASE_URL = 'http://localhost:3000'; // Lokale Entwicklung
} else {
    // Für Render.com Produktionsumgebung
    BACKEND_BASE_URL = 'https://memes-wall.onrender.com'; // <--- HIER ANPASSEN!
}

document.addEventListener('DOMContentLoaded', () => {
    const gallery = document.getElementById('photo-gallery');
    function getRoomIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const roomId = params.get('room');
        if (!roomId) {
            console.warn("No 'room' parameter found in URL for photo gallery. Using 'default' room.");
            return 'default';
        }
        return roomId.replace(/[^a-zA-Z0-9_-]/g, '');
    }

    const roomId = getRoomIdFromUrl();
    const localPhotosApiUrl = `${BACKEND_BASE_URL}/photos-list/${roomId}`;

    async function fetchPhotos() {
        try {
            const response = await fetch(localPhotosApiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const photos = await response.json();
            
            // Display photos, newest first (assuming the server returns them newest first)
            displayPhotos(photos);

        } catch (error) {
            console.error('Error fetching photos:', error);
            gallery.innerHTML = '<p>Failed to load photos. Please try again later.</p>';
        }
    }

    function displayPhotos(photos) {
        gallery.innerHTML = ''; // Clear loading message

        if (photos.length === 0) {
            gallery.innerHTML = '<p>No photos found.</p>';
            return;
        }

        photos.forEach(photoUrl => {
            const photoContainer = document.createElement('div');
            photoContainer.classList.add('photo-item');

            const img = document.createElement('img');
            img.src = photoUrl;
            img.alt = 'Fotobox Photo';

            const selectButton = document.createElement('button');
            selectButton.textContent = 'Select for Meme';
            selectButton.addEventListener('click', () => {
                window.location.href = `index.html?imageUrl=${encodeURIComponent(photoUrl)}&room=${encodeURIComponent(roomId)}`;
            });

            photoContainer.appendChild(img);
            photoContainer.appendChild(selectButton);
            gallery.appendChild(photoContainer);
        });
    }

    fetchPhotos();
});