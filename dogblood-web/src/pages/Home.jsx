import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Globe, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Home() {
    const [novels, setNovels] = useState([]);
    const [loading, setLoading] = useState(true);

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

    const handleDelete = async (e, id) => {
        e.preventDefault(); // Prevent navigation
        if (!window.confirm('確定要刪除這本小說嗎？此操作無法復原。')) return;

        try {
            const { error } = await supabase.from('novels').delete().eq('id', id);
            if (error) throw error;
            setNovels(novels.filter(n => n.id !== id));
        } catch (error) {
            console.error('Error deleting novel:', error);
            alert('刪除失敗');
        }
    };

    const togglePublic = async (e, novel) => {
        e.preventDefault(); // Prevent navigation
        try {
            const { error } = await supabase
                .from('novels')
                .update({ is_public: !novel.is_public })
                .eq('id', novel.id);

            if (error) throw error;

            setNovels(novels.map(n =>
                n.id === novel.id ? { ...n, is_public: !novel.is_public } : n
            ));
        } catch (error) {
            console.error('Error updating visibility:', error);
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
            case 'BL': return { bg: 'bg-violet-900', badge: 'bg-purple-500/20 text-purple-200' };
            default: return { bg: 'bg-rose-900', badge: 'bg-rose-500/20 text-rose-200' };
        }
    };

    if (loading) {
        return <div className="p-6 text-center text-slate-500">載入中...</div>;
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    我的書庫
                </h1>
                <Link to="/create" className="md:hidden p-2 bg-purple-600 rounded-full hover:bg-purple-500 transition-colors shadow-lg shadow-purple-900/20">
                    <Plus size={24} />
                </Link>
            </header>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {novels.map((novel) => {
                    const style = getGenreStyle(novel.genre);
                    return (
                        <Link key={novel.id} to={`/novel/${novel.id}`} className="group relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg transition-transform hover:scale-[1.02] active:scale-95 bg-slate-900 border border-slate-800">
                            <div className={`absolute inset-0 ${style.bg} opacity-60 group-hover:opacity-80 transition-opacity`} />

                            {/* Actions Overlay Removed - Moved to Detail Page */}

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
