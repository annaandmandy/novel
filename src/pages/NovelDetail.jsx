import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Trash2, Globe, Lock, User, Heart, List, Play } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function NovelDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [novel, setNovel] = useState(null);
    const [chapters, setChapters] = useState([]);
    const [characters, setCharacters] = useState([]);
    const [loading, setLoading] = useState(true);

    const [readingProgress, setReadingProgress] = useState(null);
    const [isFavorite, setIsFavorite] = useState(false);

    useEffect(() => {
        fetchData();
        if (user) checkFavorite();

        // Fetch reading progress from localStorage
        const savedProgress = localStorage.getItem(`novel_progress_${id}`);
        if (savedProgress) {
            setReadingProgress(JSON.parse(savedProgress));
        }
    }, [id, user]);

    const checkFavorite = async () => {
        const { data } = await supabase
            .from('favorites')
            .select('*')
            .eq('user_id', user.id)
            .eq('novel_id', id)
            .single();
        setIsFavorite(!!data);
    };

    const toggleFavorite = async () => {
        if (!user) {
            alert('請先登入');
            return;
        }
        if (isFavorite) {
            await supabase.from('favorites').delete().eq('user_id', user.id).eq('novel_id', id);
            setIsFavorite(false);
        } else {
            await supabase.from('favorites').insert({ user_id: user.id, novel_id: id });
            setIsFavorite(true);
        }
    };

    const fetchData = async () => {
        try {
            // Fetch Novel
            const { data: novelData, error: novelError } = await supabase
                .from('novels')
                .select('*')
                .eq('id', id)
                .single();
            if (novelError) throw novelError;
            setNovel(novelData);

            // Fetch Chapters
            const { data: chaptersData, error: chaptersError } = await supabase
                .from('chapters')
                .select('id, chapter_index, title, created_at')
                .eq('novel_id', id)
                .order('chapter_index', { ascending: true });
            if (chaptersError) throw chaptersError;
            setChapters(chaptersData);

            // Fetch Characters
            const { data: charData, error: charError } = await supabase
                .from('characters')
                .select('*')
                .eq('novel_id', id);
            if (charError) console.error(charError); // Non-critical
            setCharacters(charData || []);

        } catch (error) {
            console.error('Error fetching details:', error);
            alert('載入失敗');
            navigate('/');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('確定要刪除這本小說嗎？此操作無法復原，所有章節都將被刪除。')) return;
        try {
            const { error } = await supabase.from('novels').delete().eq('id', id);
            if (error) throw error;
            navigate('/');
        } catch (error) {
            console.error('Error deleting:', error);
            alert('刪除失敗');
        }
    };

    const togglePublic = async () => {
        try {
            const { error } = await supabase
                .from('novels')
                .update({ is_public: !novel.is_public })
                .eq('id', id);
            if (error) throw error;
            setNovel({ ...novel, is_public: !novel.is_public });
        } catch (error) {
            console.error('Error updating visibility:', error);
        }
    };

    const getGenreStyle = (genre) => {
        switch (genre) {
            case '無限流': return { bg: 'bg-indigo-900', text: 'text-indigo-200', border: 'border-indigo-700' };
            case '諜戰黑道': return { bg: 'bg-slate-800', text: 'text-slate-200', border: 'border-slate-700' };
            case '修仙玄幻': return { bg: 'bg-cyan-900', text: 'text-cyan-200', border: 'border-cyan-700' };
            case '末世生存': return { bg: 'bg-orange-900', text: 'text-orange-200', border: 'border-orange-700' };
            case '豪門宮鬥': return { bg: 'bg-red-900', text: 'text-red-200', border: 'border-red-700' };
            case '都市情緣': return { bg: 'bg-pink-900', text: 'text-pink-200', border: 'border-pink-700' };
            case 'BL': return { bg: 'bg-violet-900', text: 'text-purple-200', border: 'border-violet-700' };
            default: return { bg: 'bg-rose-900', text: 'text-rose-200', border: 'border-rose-700' };
        }
    };

    if (loading) return <div className="p-10 text-center text-slate-500">載入中...</div>;
    if (!novel) return null;

    const genreStyle = getGenreStyle(novel.genre);
    const protagonist = characters.find(c => c.role === '主角') || { name: novel.settings?.protagonist || '未知' };
    const loveInterest = characters.find(c => c.role === '對象/反派') || { name: novel.settings?.loveInterest || '未知' };

    const actionButtonText = readingProgress ? `繼續閱讀 (第 ${readingProgress.chapterIndex} 章)` : (chapters.length > 0 ? "開始閱讀" : "開始創作");

    return (
        <div className="min-h-screen bg-slate-950 pb-20">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 p-4 flex items-center gap-4">
                <Link to="/" className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-lg font-bold truncate flex-1">{novel.title}</h1>
                <div className="flex gap-2">
                    <button
                        onClick={toggleFavorite}
                        className={`p-2 rounded-full transition-colors ${isFavorite ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-500 hover:text-red-400'}`}
                        title={isFavorite ? "取消收藏" : "收藏"}
                    >
                        <Heart size={20} className={isFavorite ? "fill-current" : ""} />
                    </button>
                    {user && user.id === novel.owner_id && (
                        <>
                            <button
                                onClick={togglePublic}
                                className={`p-2 rounded-full transition-colors ${novel.is_public ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}
                                title={novel.is_public ? "公開中" : "私密"}
                            >
                                {novel.is_public ? <Globe size={20} /> : <Lock size={20} />}
                            </button>
                            <button
                                onClick={handleDelete}
                                className="p-2 rounded-full hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                                title="刪除"
                            >
                                <Trash2 size={20} />
                            </button>
                        </>
                    )}
                </div>
            </header>

            <div className="max-w-4xl mx-auto p-6 space-y-8">
                {/* Book Info Card */}
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Cover Placeholder */}
                    <div className={`w-full md:w-48 aspect-[2/3] rounded-xl shadow-2xl ${genreStyle.bg} flex flex-col items-center justify-center p-6 text-center border ${genreStyle.border} shrink-0`}>
                        <BookOpen size={48} className={`mb-4 ${genreStyle.text} opacity-50`} />
                        <h2 className="font-bold text-xl text-white mb-2 line-clamp-3">{novel.title}</h2>
                        <span className={`text-xs px-2 py-1 rounded-full bg-black/20 ${genreStyle.text}`}>
                            {novel.genre}
                        </span>
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 space-y-6">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">{novel.title}</h1>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {novel.tags && novel.tags.map((tag, i) => (
                                    <span key={i} className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-300 border border-slate-700">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                            {readingProgress && (
                                <div className="text-sm text-purple-400 font-medium mb-2">
                                    上次讀到：第 {readingProgress.chapterIndex} 章
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                                    <User size={20} />
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500">主角</div>
                                    <div className="font-medium text-slate-200">{protagonist.name}</div>
                                </div>
                            </div>
                            <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400">
                                    <Heart size={20} />
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500">CP/反派</div>
                                    <div className="font-medium text-slate-200">{loveInterest.name}</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-800/50">
                            <h3 className="text-sm font-bold text-slate-400 mb-2">劇情簡介</h3>
                            <p className="text-slate-300 leading-relaxed text-sm">
                                {novel.summary || novel.settings?.trope || "暫無簡介"}
                            </p>
                        </div>

                        {/* Desktop Action Button */}
                        <div className="hidden md:block pt-4">
                            <Link
                                to={`/read/${novel.id}`}
                                className="inline-flex items-center gap-2 px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-full font-bold transition-all shadow-lg shadow-purple-900/20"
                            >
                                <Play size={20} fill="currentColor" />
                                {actionButtonText}
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Chapter List */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <List size={20} className="text-purple-400" />
                            章節列表 ({chapters.length})
                        </h3>
                        <span className="text-xs text-slate-500">最新更新: {new Date(chapters[chapters.length - 1]?.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="grid gap-2">
                        {chapters.map((chapter) => (
                            <Link
                                key={chapter.id}
                                to={`/read/${novel.id}`} // Ideally this would link to specific chapter anchor, but Reader handles state. For now just go to Reader.
                                className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-800 transition-all flex justify-between items-center group"
                            >
                                <span className="text-slate-300 font-medium group-hover:text-purple-300 transition-colors">
                                    第 {chapter.chapter_index} 章：{chapter.title}
                                </span>
                                <span className="text-xs text-slate-600 group-hover:text-slate-500">
                                    閱讀
                                </span>
                            </Link>
                        ))}
                        {chapters.length === 0 && (
                            <div className="text-center py-10 text-slate-500">
                                尚未生成章節
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Floating Action Button */}
            <div className="md:hidden fixed bottom-24 left-0 right-0 px-6 flex justify-center z-20">
                <Link
                    to={`/read/${novel.id}`}
                    className="w-full max-w-sm flex items-center justify-center gap-2 px-8 py-4 bg-purple-600 text-white rounded-full font-bold shadow-xl shadow-purple-900/40"
                >
                    <Play size={20} fill="currentColor" />
                    {actionButtonText}
                </Link>
            </div>
        </div>
    );
}
