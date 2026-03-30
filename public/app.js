let map;
let userMarker;
let parkingMarkers = [];
let currentCoords = null;

// Initialize Leaflet Map
function initMap() {
    // Default to a central location if geolocation fails (e.g., London)
    const defaultCoords = [51.505, -0.09];
    map = L.map('map').setView(defaultCoords, 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Initial check for geolocation
    getUserLocation();
}

// Get User Location
function getUserLocation(showSuccessMessage = false) {
    const statusBadge = document.getElementById('locationStatus');
    const dot = statusBadge.querySelector('.dot');

    if (!navigator.geolocation) {
        addBotMessage("Geolocation is not supported by your browser.");
        return;
    }

    statusBadge.innerHTML = `<span class="dot" style="background:#ffcc00; box-shadow: 0 0 10px #ffcc00;"></span> Searching for location...`;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            currentCoords = { lat: latitude, lng: longitude };
            
            updateMap(latitude, longitude, "You are here");
            
            statusBadge.innerHTML = `<span class="dot" style="background:#00ff80; box-shadow: 0 0 10px #00ff80;"></span> Location Active`;
            
            if (showSuccessMessage) {
                addBotMessage("Location updated successfully! 📍");
            }
        },
        (error) => {
            console.error(error);
            statusBadge.innerHTML = `<span class="dot" style="background:#ff4d4d; box-shadow: 0 0 10px #ff4d4d;"></span> Location Denied`;
            addBotMessage("I couldn't fetch your location. Please type your location or enable GPS.");
        }
    );
}

// Update Map with User Location
function updateMap(lat, lng, label) {
    map.setView([lat, lng], 15);

    if (userMarker) {
        userMarker.setLatLng([lat, lng]).bindPopup(label).openPopup();
    } else {
        userMarker = L.marker([lat, lng]).addTo(map).bindPopup(label).openPopup();
    }
}

// Add Chat Message
function addMessage(text, isUser = false) {
    const chatHistory = document.getElementById('chatHistory');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    
    msgDiv.innerHTML = `<div class="message-content">${text}</div>`;
    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return msgDiv;
}

// Add Bot Message with typing effect or just direct
function addBotMessage(text) {
    return addMessage(text, false);
}

// Find Parking Logic
async function findParking() {
    if (!currentCoords) {
        addBotMessage("I need your location to find parking. Please click the location arrow or wait for GPS.");
        getUserLocation();
        return;
    }

    addBotMessage("Searching for the best parking spots near you... 🔍");

    try {
        const response = await fetch(`/api/getParkingSpots?lat=${currentCoords.lat}&lng=${currentCoords.lng}`);
        const data = await response.json();

        if (data.success && data.spots.length > 0) {
            displayParkingResults(data.spots);
            updateMapMarkers(data.spots);
        } else {
            addBotMessage("I couldn't find any available parking spots near you right now. 😔");
        }
    } catch (error) {
        console.error(error);
        addBotMessage("Something went wrong while fetching parking data. Please try again later.");
    }
}

// Find Parking for a custom text location
async function findParkingForLocation(locationName) {
    addBotMessage(`Searching for "**${locationName}**"... 🌍`);

    try {
        const geoResponse = await fetch(`/api/geocode?q=${encodeURIComponent(locationName)}`);
        const geoData = await geoResponse.json();

        if (geoData.success) {
            addBotMessage(`Found **${geoData.name.split(',')[0]}**. Searching for parking... 🔍`);
            
            // Set the active coordinates to the searched city
            currentCoords = { lat: geoData.lat, lng: geoData.lng };
            
            // Move Map
            updateMap(currentCoords.lat, currentCoords.lng, "Searched Location");

            // Look up parking using the new coordinates
            const parkingResponse = await fetch(`/api/getParkingSpots?lat=${currentCoords.lat}&lng=${currentCoords.lng}`);
            const parkingData = await parkingResponse.json();

            if (parkingData.success && parkingData.spots.length > 0) {
                displayParkingResults(parkingData.spots);
                updateMapMarkers(parkingData.spots);
            } else {
                addBotMessage("I couldn't find any public parking spots near this location right now. 😔");
            }
        } else {
            addBotMessage(`I couldn't find any valid coordinates for "**${locationName}**" on the map. Try being more specific (e.g., 'parking near Times Square, NY').`);
        }
    } catch (error) {
        console.error("Geocoding fetch error:", error);
        addBotMessage("Something went wrong while searching the map. It might be rate-limited.");
    }
}

// Display Parking Result Cards in Chat
function displayParkingResults(spots) {
    const container = document.createElement('div');
    container.className = 'parking-results-list';

    let html = `I found **${spots.length} available spots** near you:<br>`;
    
    spots.forEach(spot => {
        html += `
            <div class="parking-card">
                <h4>${spot.name}</h4>
                <div class="card-info">
                    <p><i class="fas fa-map-marker-alt"></i> ${spot.distance} km away</p>
                    <p><i class="fas fa-clock"></i> Updated: ${spot.last_updated}</p>
                </div>
                <div class="card-footer">
                    <span class="available-badge">${spot.available_spots} spots left</span>
                    <span class="price">$${spot.price_per_hour}/hr</span>
                </div>
            </div>
        `;
    });

    addBotMessage(html);
    document.getElementById('lastUpdated').innerText = `Last updated: ${new Date().toLocaleTimeString()}`;
}

// Update markers on Map
function updateMapMarkers(spots) {
    // Clear old markers
    parkingMarkers.forEach(marker => map.removeLayer(marker));
    parkingMarkers = [];

    const bounds = L.latLngBounds([currentCoords.lat, currentCoords.lng]);

    spots.forEach(spot => {
        const marker = L.marker([spot.latitude, spot.longitude]).addTo(map)
            .bindPopup(`<b>${spot.name}</b><br>${spot.available_spots} spots available<br>$${spot.price_per_hour}/hr`);
        parkingMarkers.push(marker);
        bounds.extend([spot.latitude, spot.longitude]);
    });

    map.fitBounds(bounds, { padding: [50, 50] });
}

// Event Listeners
document.getElementById('chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('userInput');
    const query = input.value.trim().toLowerCase();
    
    if (!query) return;

    addMessage(input.value, true);
    input.value = '';

    // Enhanced Intent Detection for "Near" locations
    if (query.includes('parking') || query.includes('find')) {
        // Did they specify a location using "near [name]" or "in [name]"?
        const match = query.match(/(?:near|in|at)\s+(.+)/);
        
        if (match && match[1].trim() && match[1].trim() !== 'me') {
            const locationStr = match[1].trim();
            findParkingForLocation(locationStr);
        } else {
            // Defaults to standard GPS behavior if no location is typed
            findParking();
        }
    } else if (query.includes('hi') || query.includes('hello')) {
        addBotMessage("Hello! I'm ParkSmart. Ask me to 'find parking' to get started! 👋");
    } else {
        addBotMessage("I'm not sure I understand. Try asking 'Find parking near Central Park' or 'Find parking near me'!");
    }
});

document.getElementById('geoBtn').addEventListener('click', () => {
    getUserLocation(true);
});

document.getElementById('refreshBtn').addEventListener('click', () => {
    if (currentCoords) {
        findParking();
    } else {
        addBotMessage("I need your location first!");
        getUserLocation();
    }
});

// Start the app
window.onload = initMap;
