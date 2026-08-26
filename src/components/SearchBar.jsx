import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import axios from 'axios';

const SearchBar = ({ onLocationFound }) => {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    

    const onSubmitSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setIsSearching(true);
        try {
            const response = await axios.get(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`
            );

            if (response.data && response.data.length > 0) {
                const result = response.data[0];
                if (onLocationFound) {
                    onLocationFound({
                        lat: parseFloat(result.lat),
                        lon: parseFloat(result.lon),
                        zoom: 10
                    });
                }
            } else {
                alert("Wilayah tidak ditemukan.");
            }
        } catch (error) {
            console.error("Gagal mencari lokasi:", error);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        // Menghapus absolute & posisi left/top, menggantinya dengan w-full/relative
        <form onSubmit={onSubmitSearch} className="relative flex items-center">
            <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search places..."
                className="w-64 sm:w-80 py-2 pl-4 pr-10 bg-white/70 hover:bg-white border border-transparent focus:bg-white rounded-xl text-sm font-mont 
              text-slate-800 placeholder:text-slate-500 focus:outline-none transition-all duration-300"
            />
            
            <button 
                type="submit"
                disabled={isSearching}
                className="absolute right-2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
            >
                {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Search className="w-4 h-4" />
                )}
            </button>
        </form>
    );
};

export default SearchBar;