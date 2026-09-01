import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents, LayersControl, ZoomControl } from 'react-leaflet';
import axios from 'axios';
import SearchBar from './SearchBar';
import loadingImg from '../assets/loading.webp';

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

const MapBoundsFetcher = ({ onBoundsChange }) => {
    const map = useMapEvents({
        moveend: () => {
            const bounds = map.getBounds();
            onBoundsChange({
                minLng: bounds.getWest(),
                minLat: bounds.getSouth(),
                maxLng: bounds.getEast(),
                maxLat: bounds.getNorth(),
            });
        },
    });

    useEffect(() => {
        if (map) {
            const bounds = map.getBounds();
            onBoundsChange({
                minLng: bounds.getWest(),
                minLat: bounds.getSouth(),
                maxLng: bounds.getEast(),
                maxLat: bounds.getNorth(),
            });
        }
    }, [map, onBoundsChange]);

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
            return code;
    }
};

const MapComponent = () => {
    const [hotspots, setHotspots] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [locationNames, setLocationNames] = useState({});
    const [searchTarget, setSearchTarget] = useState(null);
    
    const debounceTimeout = useRef(null);
    const centerPosition = [-6.28862, 106.71789];

    const fetchHotspots = useCallback(async (currentBounds) => {
        if (!currentBounds) return;
        
        setIsLoading(true);
        try {
            const { minLng, minLat, maxLng, maxLat } = currentBounds;
            const response = await axios.get('http://localhost:5001/api/hotspots', {
                params: { minLng, minLat, maxLng, maxLat }
            });
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
    }, []);

    const handleBoundsChange = useCallback((newBounds) => {
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }
        debounceTimeout.current = setTimeout(() => {
            fetchHotspots(newBounds);
        }, 500);
    }, [fetchHotspots]);

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

    return (
        <div className="relative w-full h-screen bg-slate-50">
            <div className="absolute z-[1000] top-3 left-5 md:left-1/2 md:-translate-x-1/2">
                <SearchBar onLocationFound={setSearchTarget} />
            </div>

            <div className="w-full h-full relative z-0">
                {isLoading && (
                    <div className="absolute inset-0 z-[2000] bg-white opacity-50 backdrop-blur-sm flex flex-col items-center justify-center transition-all duration-300">
                        <img
                            src={loadingImg}
                            className="w-48 h-48 object-contain"
                        />
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
                    <MapBoundsFetcher onBoundsChange={handleBoundsChange} />
                    
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
                        const lat = parseFloat(spot.latitude);
                        const lng = parseFloat(spot.longitude);

                        if (isNaN(lat) || isNaN(lng)) return null;

                        const confBadge = getConfidenceBadge(spot.confidence);
                        const tempInCelsius = (parseFloat(spot.brightness) - 273.15).toFixed(1);
                        const dateObj = new Date(spot.acq_datetime);
                        const formattedDateTime = `${dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, ${dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;
                        
                        let strokeColor = '#ef4444';
                        let fillColor = '#dc2626';

                        if (confBadge.label === 'Moderate') {
                            strokeColor = '#f59e0b';
                            fillColor = '#d97706';
                        } else if (confBadge.label === 'Low') {
                            strokeColor = '#E7EF0B';
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
                                        <div className="flex flex-col items-start gap-2 pb-2.5 mb-2">
                                            <span className="font-gothic text-lg tracking-wider text-red-600 font-bold whitespace-nowrap">
                                                HOTSPOT DETECTED
                                            </span>
                                            <span className={`inline-flex items-center text-[11px] font-mont font-semibold px-2 rounded-full shrink-0 ${confBadge.bg}`}>
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