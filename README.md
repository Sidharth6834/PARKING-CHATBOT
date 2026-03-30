# ParkSmart | AI Parking Assistant

ParkSmart is a real-time smart parking spot locator web application. It features a chatbot interface that helps users find the nearest available parking spots based on their current location or a specified search query. 

It queries real-world parking data from OpenStreetMap using the Overpass API, calculating the distance to each spot, and displaying the top 5 closest parking locations. Since standard map data doesn't include live availability or pricing, ParkSmart simulates these metrics to provide a full smart-parking experience.

## Features

- **Chatbot Interface:** An intuitive, responsive chat UI where users can naturally ask for parking ("Find parking near me", "Show parking in New York").
- **Live Location Tracking:** Uses the browser's Geolocation API to find parking near your current physical location.
- **Interactive Map:** Integrates Leaflet.js to plot parking spots dynamically on a map interface alongside the chat window.
- **Real-World Data:** Fetches live map data for parking amenities via the OpenStreetMap Overpass API.
- **Geocoding:** Converts user location queries (e.g., city names or street addresses) into coordinates using the Nominatim API.
- **Simulated Real-Time Metrics:** Generates realistic, simulated availability and pricing per hour for each parking spot.
- **Proximity Sorting:** Uses the Haversine formula to accurately calculate distances and sorts results by closest proximity.

## Tech Stack

**Frontend:**
- HTML5 / CSS3 (Modern, responsive UI with grid/flexbox)
- Vanilla JavaScript
- Leaflet.js (for map rendering and markers)
- FontAwesome (for icons)

**Backend:**
- Node.js
- Express.js
- CORS & dotenv
- OpenStreetMap Overpass API (for parking data)
- Nominatim API (for geocoding)

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repository-url>
   cd "NEW PARKING"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory (if not already present). You can specify the port:
   ```env
   PORT=5000
   ```

4. **Run the server:**

   For development (uses nodemon):
   ```bash
   npm run dev
   ```
   
   Or standard start:
   ```bash
   node server.js
   ```

5. **Open the app:**
   Open your browser and navigate to `http://localhost:5000`.

## API Endpoints

- `GET /api/getParkingSpots?lat=...&lng=...`
  - Required query parameters: `lat` (Latitude), `lng` (Longitude)
  - Fetches nearby parking spots within a 1km radius using the Overpass API.
  - Returns top 5 closest spots with calculated distance, simulated price, and availability.

- `GET /api/geocode?q=...`
  - Required query parameter: `q` (Location name, e.g., "Paris")
  - Converts a text location into latitude and longitude coordinates.

## Project Structure

```text
├── public/                 # Frontend files
│   ├── index.html          # Main HTML
│   ├── style.css           # Styling
│   └── app.js              # Frontend logic (Chat UI & Map binding)
├── .env                    # Environment variables
├── package.json            # Node project configuration
└── server.js               # Express application backend
```

## Disclaimer
Note: The pricing and live spot availability functionalities are currently simulated for demonstration purposes, as OpenStreetMap data does not natively provide live parking capacities. 
