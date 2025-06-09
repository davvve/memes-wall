document.addEventListener('DOMContentLoaded', () => {
    const gallery = document.getElementById('photo-gallery');
    const photoShareUrl = 'https://fotoshare.co/u/86712254/6289822';

    async function fetchPhotos() {
        try {
            // Using a proxy to bypass CORS issues for fetching external content
            const API_KEY = '0a7db09c6859445f802cf0ea4836507f'; // Hardcoded API key from .env
            const proxyUrl = `http://localhost:3000/proxy?url=${encodeURIComponent(photoShareUrl)}&api_key=${API_KEY}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const html = await response.text();
            
            // Parse the HTML to extract image URLs
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const imageElements = doc.querySelectorAll('.image-grid img'); // Adjust selector if needed

            const photos = Array.from(imageElements).map(img => img.src);

            // Display photos, newest first (assuming the order in the HTML is oldest first)
            displayPhotos(photos.reverse());

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
                alert(`Selected photo: ${photoUrl} (Meme generation feature coming soon!)`);
                // TODO: Implement actual meme generation logic here
            });

            photoContainer.appendChild(img);
            photoContainer.appendChild(selectButton);
            gallery.appendChild(photoContainer);
        });
    }

    fetchPhotos();
});