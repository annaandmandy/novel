import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Home() {
    const [novels, setNovels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGenre, setSelectedGenre] = useState('全部');

    const GENRE_OPTIONS = ['全部', '無限流', '諜戰黑道', '修仙玄幻', '末世生存', '豪門宮鬥', '都市情緣'];

    useEffect(() => {
        fetchNovels();
    }, []);

    const fetchNovels = async () => {
        try {
            const { data, error } = await supabase
                .from('novels')
                .select('*')
                .eq('owner_id', 'productive_v1')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setNovels(data);
        } catch (error) {
            console.error('Error fetching novels:', error);
        } finally {
            setLoading(false);
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
        const matchesGenre = selectedGenre === '全部' || novel.genre === selectedGenre;
        const query = searchQuery.toLowerCase();
        const matchesSearch = !query ||
            novel.title?.toLowerCase().includes(query) ||
            novel.settings?.protagonist?.toLowerCase().includes(query) ||
            novel.tags?.some(tag => tag.toLowerCase().includes(query));

        return matchesGenre && matchesSearch;
    });

    if (loading) {
        return <div className="p-6 text-center text-slate-500">載入中...</div>;
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <header className="flex flex-col gap-6 mb-8">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        我的書庫
                    </h1>
                    <Link to="/create" className="md:hidden p-2 bg-purple-600 rounded-full hover:bg-purple-500 transition-colors shadow-lg shadow-purple-900/20">
                        <Plus size={24} />
                    </Link>
                </div>

                {/* Search & Filter */}
                <div className="space-y-4">
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="搜尋書名、主角或標籤..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                        />
                    </div>

                    {/* Genre Filter */}
                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {GENRE_OPTIONS.map(genre => (
                            <button
                                key={genre}
                                onClick={() => setSelectedGenre(genre)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${selectedGenre === genre
                                    ? 'bg-purple-600 border-purple-600 text-white'
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                                    }`}
                            >
                                {genre}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {filteredNovels.map((novel) => {
                    const style = getGenreStyle(novel.genre);
                    return (
                        <Link key={novel.id} to={`/novel/${novel.id}`} className="group relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg transition-transform hover:scale-[1.02] active:scale-95 bg-slate-900 border border-slate-800">
                            <div className={`absolute inset-0 ${style.bg} opacity-60 group-hover:opacity-80 transition-opacity`} />

                            <div className="absolute inset-0 p-4 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                                <div className="flex flex-wrap gap-1 mb-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm border border-white/10 ${style.badge}`}>
                                        {novel.genre}
                                    </span>
                                    {novel.tags && novel.tags.slice(0, 2).map((tag, i) => (
                                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 backdrop-blur-sm border border-white/5 text-slate-200 truncate max-w-[60px]">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                                <h3 className="font-bold text-lg leading-tight mb-1 line-clamp-2">{novel.title}</h3>
                                <p className="text-xs text-slate-300 line-clamp-2 opacity-80">{novel.summary || novel.settings?.trope}</p>
                            </div>
                        </Link>
                    );
                })}

                {/* Empty State / Add New Placeholder */}
                <Link to="/create" className="flex flex-col items-center justify-center aspect-[2/3] rounded-xl border-2 border-dashed border-slate-800 hover:border-purple-500/50 hover:bg-slate-900/50 transition-colors group">
                    <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center mb-3 group-hover:bg-purple-900/30 transition-colors border border-slate-800 group-hover:border-purple-500/30">
                        <Plus className="text-slate-500 group-hover:text-purple-400" />
                    </div>
                    <span className="text-sm text-slate-500 font-medium group-hover:text-purple-400 transition-colors">新建小說</span>
                </Link>
            </div>
        </div>
    );
}
