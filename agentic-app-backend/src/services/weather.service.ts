

export async function fetchWeather(city: string): Promise<any> {
        try {
            const apiKey = process.env.WEATHER_API_KEY;
            if (!apiKey) {
                return { error: { message: "WEATHER_API_KEY is not defined in environment variables." } };
            }
            const baseUrl = `http://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(city.trim())}`;
            const res = await fetch(baseUrl);
            const data = await res.json();
            return data;
        } catch (error: any) {
            console.log(error);
            return { error: { message: error.message || "Failed to fetch weather data" } };
        }
    }
