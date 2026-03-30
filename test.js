async function test() {
    const radius = 2000;
    const lat = 40.7128;
    const lng = -74.0060;

    const overpassQuery = `[out:json][timeout:15];
(
  node["amenity"="parking"](around:${radius},${lat},${lng});
);
out center;`;

    const overpassUrl = "https://lz4.overpass-api.de/api/interpreter";
    try {
        const overpassResponse = await fetch(overpassUrl, {
            method: "POST",
            body: `data=${encodeURIComponent(overpassQuery)}`,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        });
        
        const rawText = await overpassResponse.text();
        console.log("Status:", overpassResponse.status);
        console.log("Raw Response:", rawText.substring(0, 500));
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}
test();
