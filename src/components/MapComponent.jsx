import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, LayersControl, ZoomControl } from 'react-leaflet';
import axios from 'axios';
import SearchBar from './SearchBar';

const MapFlyTo = ({ targetLocation }) => {
    const map = useMap();
    
    useEffect(() => {
        if (targetLocation) {
            map.flyTo([targetLocation.lat, targetLocation.lon], targetLocation.zoom, {
                duration: 1.5
            });
        }
    }, [targetLocation, map]);

    return null;
};

const getSatelliteName = (code) => {
    if (!code) return 'Unknown';
    const c = String(code).trim().toUpperCase();
    
    switch (c) {
        case 'N':
            return 'NOAA-20 (VIIRS)';
        case 'NPP':
        case '1':
            return 'Suomi NPP (VIIRS)';
        case 'T':
            return 'Terra (MODIS)';
        case 'A':
            return 'Aqua (MODIS)';
        default:
            return code; // Jika ada kode lain, tampilkan apa adanya
    }
};

const MapComponent = () => {
    const [hotspots, setHotspots] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [locationNames, setLocationNames] = useState({});
    
    const [searchTarget, setSearchTarget] = useState(null);

    const centerPosition = [-6.28862, 106.71789];

    useEffect(() => {
        const fetchHotspots = async () => {
            try {
                const response = await axios.get('http://localhost:5000/api/hotspots');
                const resultData = response.data.data || response.data;
                if (Array.isArray(resultData)) {
                    setHotspots(resultData);
                } else {
                    setHotspots([]);
                }
            } catch (error) {
                console.error(error);
                setHotspots([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHotspots();
    }, []);

    const fetchLocationName = async (id, lat, lng) => {
        if (locationNames[id]) return;

        try {
            const response = await axios.get(
                `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
            );
            
            const address = response.data.address;
            const cityOrRegency = address.city || address.town || address.county || address.municipality || 'Wilayah Tidak Dikenal';
            const state = address.state || address.region || '';
            const country = address.country || '';
            
            const fullLocation = [cityOrRegency, state, country].filter(Boolean).join(', ');

            setLocationNames((prev) => ({
                ...prev,
                [id]: fullLocation
            }));
        } catch (error) {
            console.error(error);
            setLocationNames((prev) => ({
                ...prev,
                [id]: "Gagal memuat nama tempat"
            }));
        }
    };

    const getConfidenceBadge = (confidence) => {
        const confLower = String(confidence).toLowerCase();
        if (confLower === 'h' || parseInt(confidence) >= 80) {
            return {
                label: 'High',
                bg: 'bg-red-300 text-red-700',
            };
        } else if (confLower === 'n' || (parseInt(confidence) >= 30 && parseInt(confidence) < 80)) {
            return {
                label: 'Moderate',
                bg: 'bg-amber-300 text-amber-700',
            };
        } else {
            return {
                label: 'Low',
                bg: 'bg-yellow-300 text-yellow-700',
            };
        }
    };

    const handleSearch = (query) => {
        console.log("Mencari wilayah:", query);
    };

    return (
        <div className="relative w-full h-screen bg-slate-50">
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000]">
                <SearchBar onLocationFound={setSearchTarget} />
            </div>

            <div className="w-full h-full relative z-0">
                {isLoading && (
                    <div className="absolute inset-0 z-[2000] bg-white opacity-50 backdrop-blur-sm flex flex-col items-center justify-center transition-all duration-300">
                        <div className="w-12 h-12 mb-4 border-4 border-slate-200 border-t-red-600 rounded-full animate-spin"></div>
                        <span className="font-mont font-bold text-slate-800 text-xl tracking-widest uppercase">
                            Loading...
                        </span>
                    </div>
                )}

                <MapContainer 
                    center={centerPosition} 
                    zoom={5} 
                    className="w-full h-full"
                    preferCanvas={true}
                    zoomControl={false}
                >
                    <MapFlyTo targetLocation={searchTarget} />
                    
                    <LayersControl position="topright">
                        <LayersControl.BaseLayer checked name="Street / Standard">
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            />
                        </LayersControl.BaseLayer>
                        <LayersControl.BaseLayer name="Dark Mode">
                            <TileLayer
                                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            />
                        </LayersControl.BaseLayer>

                        <LayersControl.BaseLayer name="Satellite">
                            <TileLayer
                                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                            />
                        </LayersControl.BaseLayer>
                        <LayersControl.BaseLayer name="Clean Light">
                            <TileLayer
                                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            />
                        </LayersControl.BaseLayer>
                    </LayersControl>

                    <ZoomControl position="topright" />

                    {Array.isArray(hotspots) && hotspots.map((spot) => {
                        console.log("Data spot:", spot);
                        const lat = parseFloat(spot.latitude);
                        const lng = parseFloat(spot.longitude);

                        if (isNaN(lat) || isNaN(lng)) return null;

                        const confBadge = getConfidenceBadge(spot.confidence);
                        const tempInCelsius = (parseFloat(spot.brightness) - 273.15).toFixed(1);
                        const dateObj = new Date(spot.acq_datetime);
                        const formattedDateTime = `${dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, ${dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;
                        let strokeColor = '#ef4444'; // Default: Merah (High)
                        let fillColor = '#dc2626';

                        if (confBadge.label === 'Moderate') {
                            strokeColor = '#f59e0b'; // Oranye / Amber
                            fillColor = '#d97706';
                        } else if (confBadge.label === 'Low') {
                            strokeColor = '#E7EF0B'; // Kuning
                            fillColor = '#C1C809';
                        }
                        return (
                            <CircleMarker 
                                key={spot.id} 
                                center={[lat, lng]}
                                radius={6}
                                pathOptions={{
                                    color: strokeColor,
                                    fillColor: fillColor,
                                    fillOpacity: 0.85,
                                    weight: 1.5
                                }}
                                eventHandlers={{
                                    popupopen: () => fetchLocationName(spot.id, lat, lng)
                                }}
                            >
                                <Popup className="custom-popup">
                                    <div className="w-76 p-2 bg-transparent font-sans">
                                        <div className="flex flex-col items-start gap-2 pb-2.5 mb-2 border-b border-slate-200/60">
                                            <span className="font-gothic text-lg tracking-wider text-red-600 font-bold whitespace-nowrap">
                                                HOTSPOT DETECTED
                                            </span>
                                            <span className={`inline-flex items-center gap-1 text-[11px] font-mont font-semibold px-2 py-0.5 rounded-full shrink-0 ${confBadge.bg}`}>
                                                {confBadge.label}
                                            </span>
                                        </div>

                                        <div className="space-y-3 text-xs text-slate-700">
                                            <div className="flex items-center bg-white/60 px-3 py-2.5 rounded-xl">
                                                <span className="font-gothic text-slate-900 text-sm">{spot.frp ? `${spot.frp} MW` : 'N/A'}</span>
                                            </div>

                                            <div className="space-y-2 px-1 pt-1">
                                                <div>
                                                    <div className="text-[10px] text-slate-500 font-mont font-medium uppercase tracking-wider">Location</div>
                                                    <div className="font-mont font-semibold text-slate-800 leading-tight">
                                                        {locationNames[spot.id] || (
                                                            <span className="text-slate-400 italic animate-pulse">Loading...</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-slate-500 font-mont font-medium uppercase tracking-wider">Coordinates</div>
                                                    <div className="font-mont font-semibold text-slate-700">{lat.toFixed(4)}, {lng.toFixed(4)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-slate-500 font-mont font-medium uppercase tracking-wider">Date Occured</div>
                                                    <div className="font-mont font-semibold text-slate-700">{formattedDateTime}</div>
                                                </div>

                                                <div>
                                                    <div className="text-[10px] text-slate-500 font-mont font-medium uppercase tracking-wider">Temperature</div>
                                                    <div className="font-mont font-semibold text-slate-700">
                                                        {tempInCelsius} °C
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-slate-500 font-mont font-medium uppercase tracking-wider">Satellite</div>
                                                    <div className="font-mont font-semibold text-slate-700">
                                                        {getSatelliteName(spot.satellite)} 
                                                        {/* Opsional jika ada kolom instrument: {spot.instrument ? `(${spot.instrument})` : ''} */}
                                                    </div>
                                                </div> 
                                            </div>
                                        </div>
                                    </div>
                                </Popup>
                            </CircleMarker>
                        );
                    })}
                </MapContainer>
            </div>
        </div>
    );
};

export default MapComponent;