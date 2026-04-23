const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// KNN (K-Nearest Neighbors) Model to find closest parking spots
class KNNModel {
    constructor(k = 5) {
        this.k = k;
    }

    // Helper function to calculate distance using Haversine formula
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of the Earth in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    }

    findNearest(targetLocation, spotsData) {
        // Calculate distance for all spots in the dataset
        const distances = spotsData.map(spot => {
            const distance = this.calculateDistance(
                targetLocation.lat, targetLocation.lng, 
                spot.latitude, spot.longitude
            );
            return { ...spot, distance: distance.toFixed(2) };
        });

        // Sort by distance (ascending) to find the nearest neighbors
        distances.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

        // Return top K nearest spots
        return distances.slice(0, this.k);
    }
}

// Gemini Chat Endpoint
app.post('/api/chat', async (req, res) => {
    const { message, location } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Message is required." });
    }

    try {
        const prompt = `
            You are ParkSmart AI, a helpful parking assistant. 
            The user says: "${message}"
            Current user coordinates: ${location ? JSON.stringify(location) : "Unknown"}

            Your task:
            1. If the user wants to find parking, respond with JSON format: {"intent": "find_parking", "location": "location name or 'near me'", "reply": "A helpful response"}.
            2. If the user is just chatting (greeting, thanking, etc.), respond with JSON: {"intent": "chat", "reply": "Your conversational response"}.
            3. If they ask for parking "near me" and the coordinates are known, use "near me".
            4. Keep the 'reply' short and friendly.
            
            Return ONLY the JSON.
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // Clean the response in case Gemini adds markdown backticks
        const cleanJson = responseText.replace(/```json|```/g, "").trim();
        const aiResponse = JSON.parse(cleanJson);

        res.json({
            success: true,
            intent: aiResponse.intent,
            extracted_location: aiResponse.location,
            reply: aiResponse.reply
        });
    } catch (error) {
        console.error("Gemini Error:", error.message);
        res.status(500).json({ error: "Failed to process message with AI." });
    }
});

// API Endpoint to get real parking spots from OpenStreetMap Overpass API
app.get('/api/getParkingSpots', async (req, res) => {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
        return res.status(400).json({ error: "Latitude and Longitude are required." });
    }

    try {
        const radius = 1000; // Reduced to 1km to prevent 504 Gateway Timeouts
        
        // Build the Overpass API query for finding parking amenities
        // Increased timeout to 25s to give the mirror plenty of time to compute ways/relations
        const overpassQuery = `
            [out:json][timeout:25];
            (
              node["amenity"="parking"](around:${radius},${lat},${lng});
              way["amenity"="parking"](around:${radius},${lat},${lng});
              relation["amenity"="parking"](around:${radius},${lat},${lng});
            );
            out center;
        `;
        
        // Fetch from a faster OpenStreetMap Overpass API mirror
        const overpassUrl = "https://lz4.overpass-api.de/api/interpreter";
        const overpassResponse = await fetch(overpassUrl, {
            method: "POST",
            body: `data=${encodeURIComponent(overpassQuery)}`,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "ParkingLocatorApp/1.0",
                "Accept": "application/json"
            }
        });
        
        if (!overpassResponse.ok) {
            const errorText = await overpassResponse.text();
            console.error("Overpass API Error Status:", overpassResponse.status);
            console.error("Overpass API Error Body:", errorText.substring(0, 500));
            return res.status(overpassResponse.status).json({ 
                error: "Failed to connect to OpenStreetMap data. The free server might be temporarily busy or rate-limiting requests." 
            });
        }

        const data = await overpassResponse.json();

        if (!data || !data.elements) {
            console.error("Overpass API Error: No elements returned.");
            return res.status(500).json({ error: "Failed to fetch parking data from OpenStreetMap." });
        }

        // Map the results and simulate availability / pricing since OSM doesn't provide it
        const parsedSpots = data.elements.map((place, index) => {
            const spotLat = place.lat || (place.center && place.center.lat);
            const spotLng = place.lon || (place.center && place.center.lon);
            const tags = place.tags || {};
            const name = tags.name ? tags.name : "Public Parking Area";

            // Pricing logic for India (approximate)
            let price = 0;
            if (tags.fee === 'no') {
                price = 0;
            } else if (tags.charge) {
                // Extract numeric value from charge string if possible
                const match = tags.charge.match(/\d+/);
                price = match ? parseInt(match[0]) : 30;
            } else {
                // Heuristic: paid parking usually ₹20-₹60, unknown/street ₹10-₹30
                price = tags.fee === 'yes' 
                    ? Math.floor(Math.random() * 41) + 20 
                    : Math.floor(Math.random() * 21) + 10;
            }

            return {
                id: place.id || index + 1,
                name: name,
                latitude: spotLat,
                longitude: spotLng,
                // Simulate real-time metrics
                available_spots: Math.floor(Math.random() * 60) + 5, 
                price_per_hour: price,
                last_updated: new Date().toLocaleTimeString()
            };
        });

        // Initialize KNN Model expecting 5 nearest neighbors
        const knn = new KNNModel(5);
        
        // Use the model to predict/find the nearest spots to user's location
        const targetLocation = { lat: parseFloat(lat), lng: parseFloat(lng) };
        const topSpots = knn.findNearest(targetLocation, parsedSpots);

        res.json({
            success: true,
            user_location: { lat, lng },
            spots: topSpots,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: "Internal server error fetching parking data." });
    }
});

// API Endpoint to geocode a location name into lat/lng
app.get('/api/geocode', async (req, res) => {
    const { q } = req.query;

    if (!q) {
        return res.status(400).json({ error: "Location query 'q' is required." });
    }

    try {
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
        
        const response = await fetch(nominatimUrl, {
            headers: {
                "User-Agent": "ParkingLocatorApp/1.0" // OpenStreetMap requires a user agent
            }
        });

        if (!response.ok) {
            return res.status(500).json({ error: "Geocoding map service unavailable." });
        }

        const data = await response.json();

        if (data && data.length > 0) {
            const firstResult = data[0];
            res.json({
                success: true,
                lat: parseFloat(firstResult.lat),
                lng: parseFloat(firstResult.lon),
                name: firstResult.display_name
            });
        } else {
            res.status(404).json({ error: "Location not found." });
        }
    } catch (error) {
        console.error("Geocoding Error:", error);
        res.status(500).json({ error: "Internal server error during geocoding." });
    }
});

// Export the Express API
module.exports = app;

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

// Keep the process alive for the demo
setInterval(() => {}, 60000);
