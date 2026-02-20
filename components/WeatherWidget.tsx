import React, { useEffect, useState } from 'react';
import { Coordinates } from '../types';
import { Cloud, Droplets, Wind, Thermometer, Sun, CloudRain, CloudSnow, CloudLightning, CloudFog, Loader2 } from 'lucide-react';

interface WeatherData {
    temperature: number;
    windSpeed: number;
    humidity: number;
    weatherCode: number;
}

interface WeatherWidgetProps {
    coords: Coordinates;
    compact?: boolean;
}

const weatherDescriptions: Record<number, { label: string; icon: React.ReactNode }> = {
    0: { label: 'Clear sky', icon: <Sun size={20} className="text-amber-400" /> },
    1: { label: 'Mainly clear', icon: <Sun size={20} className="text-amber-400" /> },
    2: { label: 'Partly cloudy', icon: <Cloud size={20} className="text-slate-400" /> },
    3: { label: 'Overcast', icon: <Cloud size={20} className="text-slate-500" /> },
    45: { label: 'Foggy', icon: <CloudFog size={20} className="text-slate-400" /> },
    48: { label: 'Icy fog', icon: <CloudFog size={20} className="text-blue-300" /> },
    51: { label: 'Light drizzle', icon: <CloudRain size={20} className="text-blue-400" /> },
    53: { label: 'Drizzle', icon: <CloudRain size={20} className="text-blue-400" /> },
    55: { label: 'Heavy drizzle', icon: <CloudRain size={20} className="text-blue-500" /> },
    61: { label: 'Light rain', icon: <CloudRain size={20} className="text-blue-400" /> },
    63: { label: 'Rain', icon: <CloudRain size={20} className="text-blue-500" /> },
    65: { label: 'Heavy rain', icon: <CloudRain size={20} className="text-blue-600" /> },
    71: { label: 'Light snow', icon: <CloudSnow size={20} className="text-sky-300" /> },
    73: { label: 'Snow', icon: <CloudSnow size={20} className="text-sky-400" /> },
    75: { label: 'Heavy snow', icon: <CloudSnow size={20} className="text-sky-500" /> },
    80: { label: 'Rain showers', icon: <CloudRain size={20} className="text-blue-400" /> },
    81: { label: 'Moderate showers', icon: <CloudRain size={20} className="text-blue-500" /> },
    82: { label: 'Violent showers', icon: <CloudRain size={20} className="text-blue-600" /> },
    95: { label: 'Thunderstorm', icon: <CloudLightning size={20} className="text-yellow-500" /> },
    96: { label: 'Thunderstorm + hail', icon: <CloudLightning size={20} className="text-red-500" /> },
    99: { label: 'Heavy hail', icon: <CloudLightning size={20} className="text-red-600" /> },
};

function getWeatherInfo(code: number) {
    return weatherDescriptions[code] || { label: 'Unknown', icon: <Cloud size={20} className="text-slate-400" /> };
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ coords, compact = false }) => {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const fetchWeather = async () => {
            setLoading(true);
            setError(false);

            try {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
                const res = await fetch(url);
                const data = await res.json();

                if (!cancelled && data.current) {
                    setWeather({
                        temperature: Math.round(data.current.temperature_2m),
                        windSpeed: Math.round(data.current.wind_speed_10m),
                        humidity: data.current.relative_humidity_2m,
                        weatherCode: data.current.weather_code,
                    });
                }
            } catch (e) {
                if (!cancelled) setError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchWeather();
        return () => { cancelled = true; };
    }, [coords.lat, coords.lng]);

    if (loading) {
        return (
            <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-xl p-4 flex items-center justify-center gap-2 text-sky-500 border border-sky-100">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm font-medium">Loading weather...</span>
            </div>
        );
    }

    if (error || !weather) {
        return (
            <div className="bg-slate-50 rounded-xl p-4 text-center text-slate-400 text-sm border border-slate-100">
                Weather unavailable for this location
            </div>
        );
    }

    const info = getWeatherInfo(weather.weatherCode);

    if (compact) {
        return (
            <div className="flex items-center gap-2 bg-sky-50 px-3 py-1.5 rounded-full border border-sky-100">
                {info.icon}
                <span className="text-sm font-bold text-slate-700">{weather.temperature}°C</span>
                <span className="text-xs text-slate-400">{info.label}</span>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-2xl p-5 border border-sky-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-1.5">
                    🌦️ Current Conditions
                </h3>
                <span className="text-[10px] text-slate-400">Open-Meteo</span>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    {info.icon}
                    <div>
                        <span className="text-3xl font-black text-slate-800">{weather.temperature}°</span>
                        <span className="text-lg text-slate-400 ml-0.5">C</span>
                    </div>
                </div>
                <div className="text-sm font-medium text-slate-600">{info.label}</div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-white/60 rounded-lg p-2 text-center">
                    <Thermometer size={14} className="text-red-400 mx-auto mb-1" />
                    <span className="text-xs font-bold text-slate-700">{weather.temperature}°C</span>
                    <span className="block text-[10px] text-slate-400">Feels like</span>
                </div>
                <div className="bg-white/60 rounded-lg p-2 text-center">
                    <Wind size={14} className="text-blue-400 mx-auto mb-1" />
                    <span className="text-xs font-bold text-slate-700">{weather.windSpeed} km/h</span>
                    <span className="block text-[10px] text-slate-400">Wind</span>
                </div>
                <div className="bg-white/60 rounded-lg p-2 text-center">
                    <Droplets size={14} className="text-cyan-400 mx-auto mb-1" />
                    <span className="text-xs font-bold text-slate-700">{weather.humidity}%</span>
                    <span className="block text-[10px] text-slate-400">Humidity</span>
                </div>
            </div>
        </div>
    );
};

export default WeatherWidget;
