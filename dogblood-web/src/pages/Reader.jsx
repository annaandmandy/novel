import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Info, Settings, Share, BookOpen, X, Trash2, Plus, Edit2, AlertTriangle, Type, Palette, List } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateNextChapter } from '../lib/gemini';

// Helper to split text into pages
const splitTextIntoPages = (text, charsPerPage = 500) => {
    if (!text) return [];
    const pages = [];
    let currentIndex = 0;
    while (currentIndex < text.length) {
        let endIndex = currentIndex + charsPerPage;
        if (endIndex < text.length) {
            const nextNewLine = text.indexOf('\n', endIndex);
            const nextPeriod = text.indexOf('。', endIndex);

            if (nextNewLine !== -1 && nextNewLine - endIndex < 100) {
                endIndex = nextNewLine + 1;
            } else if (nextPeriod !== -1 && nextPeriod - endIndex < 50) {
                endIndex = nextPeriod + 1;
            }
        }
        pages.push(text.slice(currentIndex, endIndex));
        currentIndex = endIndex;
    }
    return pages;
};

const THEMES = {
    dark: { bg: 'bg-slate-950', text: 'text-slate-300', ui: 'bg-slate-900', border: 'border-slate-800' },
    light: { bg: 'bg-slate-50', text: 'text-slate-800', ui: 'bg-white', border: 'border-slate-200' },
    sepia: { bg: 'bg-[#f4ecd8]', text: 'text-[#5b4636]', ui: 'bg-[#e9e0c9]', border: 'border-[#d3c4a5]' },
    black: { bg: 'bg-black', text: 'text-gray-400', ui: 'bg-gray-900', border: 'border-gray-800' },
};

export default function Reader() {
    const { id } = useParams();
    const [novel, setNovel] = useState(null);
    const [chapters, setChapters] = useState([]);
    const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);

    const [showMenu, setShowMenu] = useState(false);
    const [showWiki, setShowWiki] = useState(false);
    const [wikiTab, setWikiTab] = useState('overview');

    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [generationError, setGenerationError] = useState(null);
    const isPrefetching = useRef(false);

    // User Settings
    const [preferences, setPreferences] = useState({
        fontSize: 18,
        fontFamily: 'font-serif',
        theme: 'dark'
    });

    // Wiki Data
    const [characters, setCharacters] = useState([]);
    const [memories, setMemories] = useState([]);

    useEffect(() => {
        fetchNovelData();
        fetchUserProfile();
        fetchReadingProgress();
    }, [id]);

    // Save Progress Effect (Debounced)
    useEffect(() => {
        if (!novel) return;
        const timer = setTimeout(() => {
            saveReadingProgress();
        }, 1000); // Save after 1 second of no changes
        return () => clearTimeout(timer);
    }, [currentChapterIndex, currentPageIndex, novel]);

    // Auto-generation Effect
    useEffect(() => {
        if (!novel || chapters.length === 0) return;

        const checkAndGenerate = async () => {
            // If we are close to the end (within 5 chapters), generate more
            if (chapters.length - 1 < currentChapterIndex + 5 && !isPrefetching.current) {
                await prefetchChapters();
            }
        };

        checkAndGenerate();
    }, [currentChapterIndex, chapters.length, novel]);

    const fetchUserProfile = async () => {
        const { data } = await supabase.from('profiles').select('preferences').eq('id', 'productive_v1').single();
        if (data?.preferences) {
            setPreferences(data.preferences);
        }
    };

    const savePreferences = async (newPrefs) => {
        setPreferences(newPrefs);
        await supabase.from('profiles').update({ preferences: newPrefs }).eq('id', 'productive_v1');
    };

    const fetchNovelData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const { data: novelData } = await supabase.from('novels').select('*').eq('id', id).single();
            setNovel(novelData);

            const { data: chaptersData } = await supabase.from('chapters').select('*').eq('novel_id', id).order('chapter_index', { ascending: true });
            setChapters(chaptersData);
            // Default to 0, will be overwritten by fetchReadingProgress if exists
            if (chaptersData.length > 0 && currentChapterIndex === 0) {
                // Keep 0 or wait for progress fetch
            }

            fetchWikiData();
        } catch (error) {
            console.error("Error fetching novel:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchWikiData = async () => {
        const { data: charData } = await supabase.from('characters').select('*').eq('novel_id', id);
        setCharacters(charData || []);

        const { data: memData } = await supabase.from('memories').select('*').eq('novel_id', id).order('created_at', { ascending: false });
        setMemories(memData || []);
    };

    const fetchReadingProgress = async () => {
        if (!id) return;
        const { data, error } = await supabase
            .from('reading_progress')
            .select('*')
            .eq('novel_id', id)
            .eq('user_id', 'productive_v1')
            .single();

        if (data) {
            setCurrentChapterIndex(data.last_chapter_index || 0);
            setCurrentPageIndex(data.last_page_index || 0);
        }
    };

    const saveReadingProgress = async () => {
        if (!id) return;
        const { error } = await supabase
            .from('reading_progress')
            .upsert({
                user_id: 'productive_v1',
                novel_id: id,
                last_chapter_index: currentChapterIndex,
                last_page_index: currentPageIndex,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, novel_id' });

        if (error) console.error("Error saving progress:", error);
    };

    const prefetchChapters = async () => {
        if (isPrefetching.current) return;
        isPrefetching.current = true;
        setGenerating(true);
        setGenerationError(null);

        try {
            let lastChapter = chapters[chapters.length - 1];
            console.log(`Prefetching chapter ${lastChapter.chapter_index + 1}...`);

            // 1. Call AI (Get JSON)
            const aiResponse = await generateNextChapter(
                {
                    ...novel.settings,
                    targetEndingChapter: novel.target_ending_chapter,
                    currentChapterIndex: lastChapter.chapter_index
                },
                lastChapter.content,
                characters,
                memories,
                novel.tags || []
            );

            // 2. Handle DB Updates
            const updates = [];

            // A. Insert Chapter
            const newIndex = lastChapter.chapter_index + 1;
            updates.push(
                supabase.from('chapters').insert({
                    novel_id: novel.id,
                    chapter_index: newIndex,
                    title: `第 ${newIndex} 章`,
                    content: aiResponse.content
                }).select().single()
                    .then(({ data }) => {
                        if (data) setChapters(prev => [...prev, data]);
                    })
            );

            // B. Auto-update Memories
            if (aiResponse.new_memories?.length > 0) {
                const memoryInserts = aiResponse.new_memories.map(m => ({
                    novel_id: novel.id,
                    content: m,
                    type: 'auto_event'
                }));
                updates.push(
                    supabase.from('memories').insert(memoryInserts).select()
                        .then(({ data }) => {
                            if (data) setMemories(prev => [...data, ...prev]);
                        })
                );
            }

            // C. Auto-update Characters
            if (aiResponse.character_updates?.length > 0) {
                for (const update of aiResponse.character_updates) {
                    // Use upsert to handle both insert and update in one atomic operation
                    // We assume a unique constraint on (novel_id, name) in Supabase

                    // First, try to find if we have a partial match locally to merge status
                    // (This part is still useful for the "bullet point status" logic)
                    const normalize = (str) => str.replace(/\s+/g, '');
                    const existingChar = characters.find(c =>
                        normalize(c.name) === normalize(update.name) ||
                        normalize(c.name).includes(normalize(update.name)) ||
                        normalize(update.name).includes(normalize(c.name))
                    );

                    let finalStatus = update.status || 'Alive';
                    let finalDesc = update.description || update.description_append || "新登場角色";
                    let finalName = update.name;

                    if (existingChar) {
                        finalName = existingChar.name; // Keep original name
                        finalDesc = existingChar.description + (update.description_append ? ` | ${update.description_append}` : "");

                        if (update.status) {
                            finalStatus = update.status;
                        } else {
                            finalStatus = existingChar.status;
                        }
                    }

                    updates.push(
                        supabase.from('characters').upsert({
                            novel_id: novel.id,
                            name: finalName,
                            role: existingChar ? existingChar.role : '配角',
                            status: finalStatus,
                            description: finalDesc
                        }, { onConflict: 'novel_id,name' }) // Ensure no spaces in column list
                            .then(({ error }) => {
                                if (error) throw error;
                            })
                            .catch(async (err) => {
                                // Catch 409 Conflict (Duplicate Key) and fallback to Update
                                if (err.code === '23505' || err.status === 409 || err.message?.includes('Conflict')) {
                                    console.warn(`Upsert conflict for ${finalName}, falling back to UPDATE...`);
                                    const { error: updateError } = await supabase.from('characters')
                                        .update({
                                            status: finalStatus,
                                            description: finalDesc
                                        })
                                        .eq('novel_id', novel.id)
                                        .eq('name', finalName);

                                    if (updateError) console.error("Fallback update failed:", updateError);
                                } else {
                                    console.error("Character update failed:", err);
                                }
                            })
                    );
                }
                // Re-fetch wiki data to sync UI
                updates.push(fetchWikiData());
            }

            await Promise.all(updates);

        } catch (error) {
            console.error("Auto-generation failed:", error);
            setGenerationError("生成失敗，點擊重試");
        } finally {
            isPrefetching.current = false;
            setGenerating(false);
        }
    };

    // Pagination Logic
    const currentChapter = chapters[currentChapterIndex];
    const charsPerPage = useMemo(() => {
        const ratio = 18 / preferences.fontSize;
        return Math.floor(500 * ratio);
    }, [preferences.fontSize]);

    const pages = useMemo(() => currentChapter ? splitTextIntoPages(currentChapter.content, charsPerPage) : [], [currentChapter, charsPerPage]);

    const handlePageClick = (e) => {
        const width = window.innerWidth;
        const clickX = e.clientX;

        if (clickX > width * 0.7) {
            if (currentPageIndex < pages.length - 1) {
                setCurrentPageIndex(prev => prev + 1);
            } else if (currentChapterIndex < chapters.length - 1) {
                setCurrentChapterIndex(prev => prev + 1);
                setCurrentPageIndex(0);
            }
        } else if (clickX < width * 0.3) {
            if (currentPageIndex > 0) {
                setCurrentPageIndex(prev => prev - 1);
            } else if (currentChapterIndex > 0) {
                setCurrentChapterIndex(prev => prev - 1);
                setCurrentPageIndex(0);
            }
        } else {
            setShowMenu(!showMenu);
        }
    };

    // Wiki Actions
    const handleAddCharacter = async () => {
        const name = prompt("角色名稱:");
        if (!name) return;
        const role = prompt("角色定位 (主角/反派/配角):", "配角");
        const desc = prompt("角色描述:");

        const { data, error } = await supabase.from('characters').insert({
            novel_id: id,
            name,
            role,
            description: desc,
            status: 'Alive'
        }).select().single();

        if (!error) setCharacters([...characters, data]);
    };

    const handleDeleteCharacter = async (charId) => {
        if (!confirm("確定刪除此角色？")) return;
        await supabase.from('characters').delete().eq('id', charId);
        setCharacters(characters.filter(c => c.id !== charId));
    };

    const handleAddMemory = async () => {
        const content = prompt("新增記憶/事件:");
        if (!content) return;

        const { data, error } = await supabase.from('memories').insert({
            novel_id: id,
            content,
            type: 'event'
        }).select().single();

        if (!error) setMemories([data, ...memories]);
    };

    const handleEditMemory = async (mem) => {
        if (!confirm("警告：修改記憶可能會導致故事不連貫！確定要修改嗎？")) return;
        const newContent = prompt("修改記憶內容:", mem.content);
        if (!newContent || newContent === mem.content) return;

        const { error } = await supabase.from('memories').update({ content: newContent }).eq('id', mem.id);
        if (!error) {
            setMemories(memories.map(m => m.id === mem.id ? { ...m, content: newContent } : m));
        }
    };

    const handleDeleteMemory = async (memId) => {
        if (!confirm("警告：刪除記憶可能會導致故事不連貫！確定要刪除嗎？")) return;
        await supabase.from('memories').delete().eq('id', memId);
        setMemories(memories.filter(m => m.id !== memId));
    };

    // Theme Styles
    const theme = THEMES[preferences.theme] || THEMES.dark;

    if (loading) return <div className="h-screen flex items-center justify-center text-slate-500">載入中...</div>;
    if (!novel || !currentChapter) return <div className="h-screen flex items-center justify-center text-slate-500">無內容</div>;

    return (
        <div className={`h-screen ${theme.bg} ${theme.text} ${preferences.fontFamily} leading-relaxed relative overflow-hidden flex flex-col transition-colors duration-300`}>

            {/* Header Info (Top Right) */}
            <div className="absolute top-4 right-6 z-10 opacity-50 text-xs font-medium pointer-events-none">
                {novel.title}
            </div>

            {/* Content Area */}
            <div
                onClick={handlePageClick}
                className="flex-1 px-6 py-12 md:p-12 max-w-3xl mx-auto w-full cursor-pointer flex flex-col transition-all duration-300"
            >
                <div className="flex-1 flex flex-col">
                    {currentPageIndex === 0 && (
                        <h2 className="text-2xl font-bold mb-6 opacity-90">{currentChapter.title}</h2>
                    )}
                    <p
                        className="whitespace-pre-line text-justify min-h-[60vh]"
                        style={{ fontSize: `${preferences.fontSize}px`, lineHeight: '1.8' }}
                    >
                        {pages[currentPageIndex]}
                    </p>
                </div>

                {/* Footer Info */}
                <div className="h-8 flex items-center justify-between text-[10px] opacity-40 mt-4 border-t border-current pt-2">
                    <span>第 {currentChapter.chapter_index} 章</span>
                    <span>{Math.round(((currentPageIndex + 1) / pages.length) * 100)}%</span>
                </div>
            </div>

            {/* Sidebar / Menu Overlay */}
            {showMenu && (
                <div className="absolute inset-0 z-30 flex">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowMenu(false)} />

                    {/* Sidebar Panel (Left on Desktop, Bottom on Mobile) */}
                    <div className={`relative flex flex-col ${theme.ui} ${theme.text} w-full md:w-80 md:h-full h-auto mt-auto md:mt-0 shadow-2xl transition-transform`}>

                        {/* Menu Header */}
                        <div className={`p-4 border-b ${theme.border} flex justify-between items-center`}>
                            <h3 className="font-bold">閱讀設定</h3>
                            <button onClick={() => setShowMenu(false)}><X size={20} /></button>
                        </div>

                        {/* Menu Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">

                            {/* Navigation */}
                            <section>
                                <h4 className="text-xs font-bold opacity-50 mb-3 uppercase tracking-wider">導航</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => { setShowWiki(true); setShowMenu(false); }} className={`p-3 rounded-lg border ${theme.border} flex items-center justify-center gap-2 hover:opacity-80`}>
                                        <Info size={16} /> Wiki 設定
                                    </button>
                                    <Link to="/" className={`p-3 rounded-lg border ${theme.border} flex items-center justify-center gap-2 hover:opacity-80`}>
                                        <ChevronLeft size={16} /> 返回書庫
                                    </Link>
                                </div>
                            </section>

                            {/* Ending Settings */}
                            <section>
                                <h4 className="text-xs font-bold opacity-50 mb-3 uppercase tracking-wider">完結設定</h4>
                                <div className={`p-4 rounded-lg border ${theme.border} space-y-2`}>
                                    <label className="text-xs opacity-70 block">預計完結章節 (目前: {chapters.length} 章)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            placeholder="無 (未設定)"
                                            defaultValue={novel.target_ending_chapter || ''}
                                            onBlur={async (e) => {
                                                const val = parseInt(e.target.value);
                                                if (!val) return;
                                                if (val <= chapters.length + 5) {
                                                    alert(`完結章節必須大於目前章節 + 5 (至少 ${chapters.length + 6} 章)`);
                                                    e.target.value = novel.target_ending_chapter || '';
                                                    return;
                                                }
                                                const { error } = await supabase.from('novels').update({ target_ending_chapter: val }).eq('id', novel.id);
                                                if (!error) {
                                                    setNovel({ ...novel, target_ending_chapter: val });
                                                    alert(`已設定預計在第 ${val} 章完結。AI 將會開始收束劇情。`);
                                                }
                                            }}
                                            className={`w-full bg-transparent border ${theme.border} rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500`}
                                        />
                                    </div>
                                    <p className="text-[10px] opacity-50">設定後，AI 會在接近該章節時自動收束劇情並生成結局。</p>
                                </div>
                            </section>

                            {/* Chapter Jump */}
                            <section>
                                <h4 className="text-xs font-bold opacity-50 mb-3 uppercase tracking-wider">章節 ({chapters.length})</h4>
                                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                    {chapters.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => { setCurrentChapterIndex(c.chapter_index - 1); setCurrentPageIndex(0); setShowMenu(false); }}
                                            className={`px-3 py-1 text-xs rounded-full border ${c.chapter_index === currentChapter.chapter_index ? 'bg-purple-600 border-purple-600 text-white' : theme.border}`}
                                        >
                                            {c.chapter_index}
                                        </button>
                                    ))}
                                    {generating && <span className="text-xs opacity-50 animate-pulse self-center">生成中...</span>}
                                    {generationError && (
                                        <button onClick={() => prefetchChapters()} className="text-xs text-red-400 border border-red-500/50 px-2 py-1 rounded hover:bg-red-900/20">
                                            重試
                                        </button>
                                    )}
                                </div>
                            </section>

                            {/* Appearance */}
                            <section>
                                <h4 className="text-xs font-bold opacity-50 mb-3 uppercase tracking-wider">外觀</h4>

                                {/* Font Size */}
                                <div className="mb-4">
                                    <div className="flex justify-between text-xs mb-2">
                                        <span className="flex items-center gap-1"><Type size={12} /> 字體大小</span>
                                        <span>{preferences.fontSize}px</span>
                                    </div>
                                    <input
                                        type="range" min="14" max="32" step="1"
                                        value={preferences.fontSize}
                                        onChange={(e) => savePreferences({ ...preferences, fontSize: parseInt(e.target.value) })}
                                        className="w-full accent-purple-500"
                                    />
                                </div>

                                {/* Theme */}
                                <div className="grid grid-cols-4 gap-2 mb-4">
                                    {Object.keys(THEMES).map(t => (
                                        <button
                                            key={t}
                                            onClick={() => savePreferences({ ...preferences, theme: t })}
                                            className={`h-8 rounded-full border-2 ${preferences.theme === t ? 'border-purple-500' : 'border-transparent'} ${THEMES[t].bg}`}
                                            title={t}
                                        />
                                    ))}
                                </div>

                                {/* Font Family */}
                                <div className="flex rounded-lg overflow-hidden border border-slate-700">
                                    <button
                                        onClick={() => savePreferences({ ...preferences, fontFamily: 'font-serif' })}
                                        className={`flex-1 py-2 text-xs ${preferences.fontFamily === 'font-serif' ? 'bg-purple-600 text-white' : ''}`}
                                    >
                                        宋體 (Serif)
                                    </button>
                                    <button
                                        onClick={() => savePreferences({ ...preferences, fontFamily: 'font-sans' })}
                                        className={`flex-1 py-2 text-xs ${preferences.fontFamily === 'font-sans' ? 'bg-purple-600 text-white' : ''}`}
                                    >
                                        黑體 (Sans)
                                    </button>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            )}

            {/* Wiki Modal */}
            {showWiki && (
                <div className={`absolute inset-0 z-50 ${theme.bg} ${theme.text} flex flex-col`}>
                    <div className={`flex justify-between items-center p-4 border-b ${theme.border}`}>
                        <h2 className="text-lg font-bold">Wiki 資料庫</h2>
                        <button onClick={() => setShowWiki(false)} className={`p-2 rounded-full ${theme.ui}`}><X size={20} /></button>
                    </div>

                    {/* Wiki Tabs */}
                    <div className={`flex border-b ${theme.border}`}>
                        {['overview', 'characters', 'memory'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setWikiTab(tab)}
                                className={`flex-1 py-3 text-sm font-medium capitalize ${wikiTab === tab ? 'text-purple-500 border-b-2 border-purple-500' : 'opacity-60'}`}
                            >
                                {tab === 'overview' ? '總覽' : tab === 'characters' ? '角色' : '記憶'}
                            </button>
                        ))}
                    </div>

                    {/* Wiki Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">

                        {/* Overview Tab */}
                        {wikiTab === 'overview' && (
                            <div className="space-y-4">
                                <div className={`p-4 rounded-xl border ${theme.border} ${theme.ui}`}>
                                    <h3 className="text-sm font-bold text-purple-500 mb-2">劇情摘要</h3>
                                    <p className="text-sm opacity-80 leading-relaxed">{novel.summary}</p>
                                </div>
                                <div className={`p-4 rounded-xl border ${theme.border} ${theme.ui}`}>
                                    <h3 className="text-sm font-bold text-blue-500 mb-2">核心梗</h3>
                                    <p className="text-sm opacity-80">{novel.settings.trope}</p>
                                </div>
                            </div>
                        )}

                        {/* Characters Tab */}
                        {wikiTab === 'characters' && (
                            <div className="space-y-3">
                                <button onClick={handleAddCharacter} className={`w-full py-2 border border-dashed ${theme.border} rounded-lg opacity-60 text-sm hover:opacity-100 flex items-center justify-center gap-2`}>
                                    <Plus size={16} /> 新增角色
                                </button>
                                {characters.map(char => (
                                    <div key={char.id} className={`p-4 rounded-xl border ${theme.border} ${theme.ui} relative group`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold">{char.name} <span className="text-xs opacity-60 font-normal">({char.role})</span></h3>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${char.status.includes('死') || char.status === 'Dead' ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                                                    {char.status === 'Alive' ? '存活' : char.status}
                                                </span>
                                            </div>
                                            <button onClick={() => handleDeleteCharacter(char.id)} className="opacity-60 hover:text-red-400">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <p className="text-sm opacity-80 mt-2">{char.description}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Memory Tab */}
                        {wikiTab === 'memory' && (
                            <div className="space-y-3">
                                <div className="bg-yellow-900/10 border border-yellow-900/30 p-3 rounded-lg flex gap-2 items-start">
                                    <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-yellow-500/80">修改記憶可能會導致 AI 生成的故事前後不連貫，請謹慎操作。</p>
                                </div>
                                <button onClick={handleAddMemory} className={`w-full py-2 border border-dashed ${theme.border} rounded-lg opacity-60 text-sm hover:opacity-100 flex items-center justify-center gap-2`}>
                                    <Plus size={16} /> 新增記憶節點
                                </button>
                                {memories.map(mem => (
                                    <div key={mem.id} className={`p-4 rounded-xl border ${theme.border} ${theme.ui}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] opacity-50">{new Date(mem.created_at).toLocaleDateString()}</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleEditMemory(mem)} className="opacity-60 hover:text-blue-400"><Edit2 size={14} /></button>
                                                <button onClick={() => handleDeleteMemory(mem.id)} className="opacity-60 hover:text-red-400"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                        <p className="text-sm opacity-80">{mem.content}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
}
