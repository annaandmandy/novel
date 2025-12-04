import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Heart, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Square() {
    const { user } = useAuth();
    const [novels, setNovels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [favorites, setFavorites] = useState(new Set());

    useEffect(() => {
        fetchPublicNovels();
        if (user) {
            fetchFavorites();
        }
    }, [user]);

    const fetchPublicNovels = async () => {
        try {
            const { data, error } = await supabase
                .from('novels')
                .select('*')
                .eq('is_public', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setNovels(data);
        } catch (error) {
            console.error('Error fetching public novels:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchFavorites = async () => {
        try {
            const { data, error } = await supabase
                .from('favorites')
                .select('novel_id')
                .eq('user_id', user.id);

            if (error) throw error;
            setFavorites(new Set(data.map(f => f.novel_id)));
        } catch (error) {
            console.error('Error fetching favorites:', error);
        }
    };

    const toggleFavorite = async (e, novelId) => {
        e.preventDefault(); // Prevent navigation
        if (!user) {
            alert('請先登入');
            return;
        }

        try {
            if (favorites.has(novelId)) {
                const { error } = await supabase
                    .from('favorites')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('novel_id', novelId);
                if (error) throw error;
                const newFavs = new Set(favorites);
                newFavs.delete(novelId);
                setFavorites(newFavs);
            } else {
                const { error } = await supabase
                    .from('favorites')
                    .insert({ user_id: user.id, novel_id: novelId });
                if (error) throw error;
                setFavorites(new Set(favorites).add(novelId));
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
    };

    const getGenreStyle = (genre) => {
        switch (genre) {
            case '無限流': return { bg: 'bg-indigo-900', badge: 'bg-indigo-500/20 text-indigo-200' };
            case '諜戰黑道': return { bg: 'bg-slate-800', badge: 'bg-slate-500/20 text-slate-200' };
            case '修仙玄幻': return { bg: 'bg-cyan-900', badge: 'bg-cyan-500/20 text-cyan-200' };
            case '末世生存': return { bg: 'bg-orange-900', badge: 'bg-orange-500/20 text-orange-200' };
            case '豪門宮鬥': return { bg: 'bg-red-900', badge: 'bg-red-500/20 text-red-200' };
            case '都市情緣': return { bg: 'bg-pink-900', badge: 'bg-pink-500/20 text-pink-200' };
            default: return { bg: 'bg-rose-900', badge: 'bg-rose-500/20 text-rose-200' };
        }
    };

    const filteredNovels = novels.filter(novel => {
        const query = searchQuery.toLowerCase();
        return !query ||
            novel.title?.toLowerCase().includes(query) ||
            novel.settings?.protagonist?.toLowerCase().includes(query) ||
            novel.tags?.some(tag => tag.toLowerCase().includes(query));
    });

    if (loading) return <div className="p-6 text-center text-slate-500">載入中...</div>;

    return (
        <div className="p-6 max-w-4xl mx-auto pb-24">
            <header className="flex flex-col gap-6 mb-8">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    公開廣場
                </h1>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        type="text"
                        placeholder="搜尋公開作品..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                </div>
            </header>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {filteredNovels.map((novel) => {
                    const style = getGenreStyle(novel.genre);
                    const isFav = favorites.has(novel.id);

                    return (
                        <Link key={novel.id} to={`/novel/${novel.id}`} className="group relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg transition-transform hover:scale-[1.02] active:scale-95 bg-slate-900 border border-slate-800">
                            <div className={`absolute inset-0 ${style.bg} opacity-60 group-hover:opacity-80 transition-opacity`} />

                            <div className="absolute inset-0 p-4 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                                {/* Favorite Button */}
                                <button
                                    onClick={(e) => toggleFavorite(e, novel.id)}
                                    className="absolute top-2 right-2 p-2 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 transition-colors z-10"
                                >
                                    <Heart size={16} className={isFav ? "fill-red-500 text-red-500" : "text-white"} />
                                </button>

                                <div className="flex flex-wrap gap-1 mb-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm border border-white/10 ${style.badge}`}>
                                        {novel.genre}
                                    </span>
                                </div>
                                <h3 className="font-bold text-lg leading-tight mb-1 line-clamp-2">{novel.title}</h3>
                                <p className="text-xs text-slate-300 line-clamp-2 opacity-80">{novel.summary || novel.settings?.trope}</p>
                            </div>
                        </Link>
                    );
                })}

                {filteredNovels.length === 0 && (
                    <div className="col-span-full text-center py-10 text-slate-500">
                        暫無公開作品
                    </div>
                )}
            </div>
        </div>
    );
}
