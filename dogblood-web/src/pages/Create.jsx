import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Dice5, ArrowRight, Sparkles,
    Infinity, VenetianMask, CloudLightning, Skull, Crown, Heart,
    Zap, Smile, Scale, Moon, Coffee
} from 'lucide-react';
import { generateNovelStart, generateRandomSettings, getRecommendedTotalChapters } from '../lib/gemini';
import { supabase } from '../lib/supabase';

export default function Create() {
    const navigate = useNavigate();

    // --- State Management ---
    const [category, setCategory] = useState('BG');
    const [genre, setGenre] = useState('豪門宮鬥');
    const [pov, setPov] = useState('第三人稱');
    const [tone, setTone] = useState('爽文');
    const [selectedTags, setSelectedTags] = useState([]);

    const [settings, setSettings] = useState({
        title: '',
        protagonist: '',
        loveInterest: '',
        trope: '',
        summary: ''
    });

    // Store deep character profiles (hidden from simple UI but used for generation)
    const [profiles, setProfiles] = useState({
        protagonist: {},
        loveInterest: {}
    });

    const [designBlueprint, setDesignBlueprint] = useState({});
    const [targetEndingChapter, setTargetEndingChapter] = useState(120);

    const [loading, setLoading] = useState(false);
    const [loadingRandom, setLoadingRandom] = useState(false);
    const [customTag, setCustomTag] = useState('');

    // --- Options Configuration ---
    const GENRE_OPTIONS = [
        { id: '無限流', icon: Infinity, label: '無限流', desc: '生存遊戲、副本解密' },
        { id: '諜戰黑道', icon: VenetianMask, label: '諜戰黑道', desc: '臥底、雙重身分、懸疑' },
        { id: '修仙玄幻', icon: CloudLightning, label: '修仙玄幻', desc: '升級、歷練、東方幻想' },
        { id: '末世生存', icon: Skull, label: '末世生存', desc: '喪屍、天災、人性考驗' },
        { id: '豪門宮鬥', icon: Crown, label: '豪門宮鬥', desc: '復仇、權謀、打臉' },
        { id: '都市情緣', icon: Heart, label: '都市情緣', desc: '甜寵、虐戀、現代日常' },
    ];

    const POV_OPTIONS = [
        { id: '第三人稱', label: '第三人稱 (上帝視角)', desc: '宏觀敘事、群像描寫', category: 'ALL' },
        { id: '女主', label: '女主 (BG/大女主)', desc: '細膩情感、成長視角', category: 'BG' },
        { id: '男主', label: '男主 (BG/男頻)', desc: '征服欲、大局觀', category: 'BG' },
        { id: '主受', label: '主受 (BL)', desc: '心理掙扎、韌性', category: 'BL' },
        { id: '主攻', label: '主攻 (BL)', desc: '掌控欲、強勢', category: 'BL' },
    ];

    const TONE_OPTIONS = [
        { id: '爽文', icon: Zap, label: '爽文', desc: '節奏快、不憋屈' },
        { id: '歡脫', icon: Smile, label: '歡脫', desc: '搞笑、沙雕、吐槽' },
        { id: '嚴肅', icon: Scale, label: '嚴肅', desc: '正劇、權謀、寫實' },
        { id: '暗黑', icon: Moon, label: '暗黑', desc: '壓抑、絕望、人性' },
        { id: '溫馨', icon: Coffee, label: '溫馨', desc: '治癒、日常、慢熱' },
    ];

    const AVAILABLE_TAGS = [
        "重生", "穿越", "系統", "穿書", "馬甲",
        "強強", "主僕", "相愛相殺", "破鏡重圓", "追妻火葬場", "年下",
        "副本解密", "生存遊戲", "升級", "歷練", "打臉", "復仇", "建設", "權謀",
        "校園", "職場", "娛樂圈", "幫派", "臥底", "動作", "喪屍", "天災"
    ];

    // --- Handlers ---

    // Reset POV when category changes
    React.useEffect(() => {
        setPov('第三人稱');
    }, [category]);

    const toggleTag = (tag) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(prev => prev.filter(t => t !== tag));
        } else {
            if (selectedTags.length >= 3) {
                alert("最多選擇 3 個標籤");
                return;
            }
            setSelectedTags(prev => [...prev, tag]);
        }
    };

    const addCustomTag = () => {
        if (!customTag.trim()) return;
        if (selectedTags.length >= 3) {
            alert("最多選擇 3 個標籤");
            return;
        }
        if (!selectedTags.includes(customTag.trim())) {
            setSelectedTags(prev => [...prev, customTag.trim()]);
        }
        setCustomTag('');
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleRandomize = async () => {
        setLoadingRandom(true);
        try {
            // Updated signature: generateRandomSettings(genre, tags, tone, targetChapterCount)
            const randomSettings = await generateRandomSettings(genre, selectedTags, tone, parseInt(targetEndingChapter));

            // Separate flat settings for UI and deep profiles for logic
            setSettings({
                title: randomSettings.title,
                protagonist: randomSettings.protagonist.name,
                loveInterest: randomSettings.loveInterest.name,
                trope: randomSettings.trope,
                summary: randomSettings.summary
            });

            setProfiles({
                protagonist: randomSettings.protagonist.profile,
                loveInterest: randomSettings.loveInterest.profile
            });

            if (randomSettings.design_blueprint) {
                setDesignBlueprint(randomSettings.design_blueprint);
            }

        } catch (error) {
            console.error(error);
            alert('隨機生成失敗，請重試。');
        } finally {
            setLoadingRandom(false);
        }
    };

    const handleCreate = async () => {
        if (!settings.title || !settings.protagonist) {
            alert('請填寫完整設定');
            return;
        }

        setLoading(true);
        try {
            // 1. Generate Content
            // Construct full settings object with profiles for the AI
            // 1. Generate Content
            // Construct full settings object with profiles for the AI
            const apiSettings = {
                ...settings,
                design_blueprint: designBlueprint,
                protagonist: { name: settings.protagonist, role: '主角', profile: profiles.protagonist },
                loveInterest: { name: settings.loveInterest, role: '對象/反派', profile: profiles.loveInterest }
            };

            // Updated signature: generateNovelStart(genre, settings, tags, tone, pov)
            // Note: We must pass the specific genre (e.g. '無限流') not the category ('BG')
            const startResponse = await generateNovelStart(genre, apiSettings, selectedTags, tone, pov);
            const content = startResponse.content;
            // Note: startResponse.character_updates is also available here if we want to use it dynamically,
            // but for now we use the pre-generated profiles for the main characters.

            // 2. Save Novel to Supabase
            const { data: novel, error: novelError } = await supabase
                .from('novels')
                .insert({
                    owner_id: 'productive_v1', // Hardcoded for now
                    title: settings.title,
                    genre: genre, // Save specific genre (e.g. '無限流') so gemini.js works correctly
                    summary: settings.summary || settings.trope,
                    settings: { ...settings, tone, pov, category, design_blueprint: designBlueprint }, // Save category and blueprint in settings
                    tags: selectedTags,
                    target_ending_chapter: parseInt(targetEndingChapter) || 120,
                    is_public: false
                })
                .select()
                .single();

            if (novelError) throw novelError;

            // 3. Save Chapter 1
            const { error: chapterError } = await supabase
                .from('chapters')
                .insert({
                    novel_id: novel.id,
                    chapter_index: 1,
                    title: '第一章',
                    content: content
                });

            if (chapterError) throw chapterError;

            // 4. Save Initial Characters
            const charactersToInsert = [
                {
                    novel_id: novel.id,
                    name: settings.protagonist,
                    role: '主角',
                    description: '本故事主角',
                    status: 'Alive',
                    profile: profiles.protagonist // Save deep profile
                },
                {
                    novel_id: novel.id,
                    name: settings.loveInterest,
                    role: '對象/反派',
                    description: '本故事重要角色',
                    status: 'Alive',
                    profile: profiles.loveInterest // Save deep profile
                }
            ];

            const { error: charactersError } = await supabase
                .from('characters')
                .insert(charactersToInsert);

            if (charactersError) throw charactersError;

            // Navigate to Reader
            navigate(`/read/${novel.id}`);

        } catch (error) {
            alert('生成或儲存失敗，請檢查 Supabase 連接或 API Key。');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto min-h-full flex flex-col">
            <h1 className="text-3xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                創作新小說
            </h1>

            <div className="space-y-10 flex-1">

                {/* Step 0: Category Selection */}
                <section>
                    <h2 className="text-xl font-medium text-slate-200 mb-4 flex items-center gap-2">
                        <span className="bg-rose-600 text-xs px-2 py-1 rounded text-white">Step 1</span>
                        選擇性向 (Category)
                    </h2>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setCategory('BG')}
                            className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${category === 'BG'
                                ? 'border-rose-500 bg-rose-500/10 text-white shadow-[0_0_20px_rgba(244,63,94,0.2)]'
                                : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                                }`}
                        >
                            <div className="text-2xl mb-1">🌹</div>
                            <div className="font-bold">BG (言情)</div>
                        </button>
                        <button
                            onClick={() => setCategory('BL')}
                            className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${category === 'BL'
                                ? 'border-violet-500 bg-violet-500/10 text-white shadow-[0_0_20px_rgba(139,92,246,0.2)]'
                                : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                                }`}
                        >
                            <div className="text-2xl mb-1">🔮</div>
                            <div className="font-bold">BL (耽美)</div>
                        </button>
                    </div>
                </section>

                {/* Step 1: Genre Selection */}
                <section>
                    <h2 className="text-xl font-medium text-slate-200 mb-4 flex items-center gap-2">
                        <span className="bg-purple-600 text-xs px-2 py-1 rounded text-white">Step 2</span>
                        選擇題材 (Genre)
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {GENRE_OPTIONS.map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => {
                                    setGenre(opt.id);
                                    setTargetEndingChapter(getRecommendedTotalChapters(opt.id));
                                }}
                                className={`p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden group ${genre === opt.id
                                    ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                                    }`}
                            >
                                <div className={`absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity ${genre === opt.id ? 'opacity-20' : ''}`}>
                                    <opt.icon size={64} />
                                </div>
                                <div className="relative z-10">
                                    <div className="mb-2 text-purple-400"><opt.icon size={24} /></div>
                                    <div className="font-bold text-lg text-slate-100">{opt.label}</div>
                                    <div className="text-xs text-slate-400 mt-1">{opt.desc}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Step 2: POV & Tone */}
                <div className="grid md:grid-cols-2 gap-8">
                    {/* POV Selection */}
                    <section>
                        <h2 className="text-xl font-medium text-slate-200 mb-4 flex items-center gap-2">
                            <span className="bg-blue-600 text-xs px-2 py-1 rounded text-white">Step 3</span>
                            視角 (POV)
                        </h2>
                        <div className="space-y-3">
                            {POV_OPTIONS.filter(opt => opt.category === 'ALL' || opt.category === category).map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => setPov(opt.id)}
                                    className={`w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${pov === opt.id
                                        ? 'border-blue-500 bg-blue-500/10 text-white'
                                        : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                                        }`}
                                >
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${pov === opt.id ? 'border-blue-500' : 'border-slate-600'
                                        }`}>
                                        {pov === opt.id && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                    </div>
                                    <div>
                                        <div className="font-medium">{opt.label}</div>
                                        <div className="text-xs opacity-70">{opt.desc}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Tone Selection */}
                    <section>
                        <h2 className="text-xl font-medium text-slate-200 mb-4 flex items-center gap-2">
                            <span className="bg-pink-600 text-xs px-2 py-1 rounded text-white">Step 3</span>
                            基調 (Tone)
                        </h2>
                        <div className="grid grid-cols-2 gap-3">
                            {TONE_OPTIONS.map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => setTone(opt.id)}
                                    className={`p-3 rounded-lg border text-left transition-all flex flex-col gap-2 ${tone === opt.id
                                        ? 'border-pink-500 bg-pink-500/10 text-white'
                                        : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <opt.icon size={16} />
                                        <span className="font-medium">{opt.label}</span>
                                    </div>
                                    <div className="text-xs opacity-70">{opt.desc}</div>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Step 4: Tags */}
                <section>
                    <h2 className="text-xl font-medium text-slate-200 mb-4 flex items-center gap-2">
                        <span className="bg-emerald-600 text-xs px-2 py-1 rounded text-white">Step 4</span>
                        元素標籤 (Tags)
                    </h2>
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                        <div className="flex flex-wrap gap-2 mb-4">
                            {AVAILABLE_TAGS.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => toggleTag(tag)}
                                    className={`px-3 py-1.5 rounded-full text-sm border transition-all ${selectedTags.includes(tag)
                                        ? 'bg-emerald-600 border-emerald-600 text-white'
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                                        }`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2 pt-4 border-t border-slate-800">
                            <input
                                type="text"
                                value={customTag}
                                onChange={(e) => setCustomTag(e.target.value)}
                                placeholder="自定義標籤..."
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                                onKeyDown={(e) => e.key === 'Enter' && addCustomTag()}
                            />
                            <button
                                onClick={addCustomTag}
                                className="px-4 py-2 bg-slate-800 rounded-lg text-sm hover:bg-slate-700 text-slate-200"
                            >
                                新增
                            </button>
                        </div>
                    </div>
                </section>

                {/* Step 5: Settings */}
                <section className="space-y-4 pt-4 border-t border-slate-800">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-medium text-slate-200 flex items-center gap-2">
                            <span className="bg-orange-600 text-xs px-2 py-1 rounded text-white">Step 5</span>
                            核心設定
                        </h2>
                        <button
                            onClick={handleRandomize}
                            disabled={loadingRandom}
                            className="text-sm flex items-center gap-2 text-purple-400 hover:text-purple-300 disabled:opacity-50 px-3 py-1.5 rounded-lg hover:bg-purple-500/10 transition-colors"
                        >
                            <Dice5 size={16} className={loadingRandom ? "animate-spin" : ""} />
                            {loadingRandom ? "AI 生成中..." : "隨機生成設定"}
                        </button>
                    </div>

                    <div className="space-y-4">
                        <input
                            name="title"
                            value={settings.title}
                            onChange={handleInputChange}
                            type="text"
                            placeholder="小說標題"
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 transition-colors text-lg font-bold"
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <input
                                name="protagonist"
                                value={settings.protagonist}
                                onChange={handleInputChange}
                                type="text"
                                placeholder="主角姓名"
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 transition-colors"
                            />
                            <input
                                name="loveInterest"
                                value={settings.loveInterest}
                                onChange={handleInputChange}
                                type="text"
                                placeholder="對象/反派姓名"
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 transition-colors"
                            />
                        </div>
                        <textarea
                            name="trope"
                            value={settings.trope}
                            onChange={handleInputChange}
                            placeholder="核心梗 / 背景設定 (例如：重生回十年前，誓要奪回一切...)"
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 h-24 resize-none focus:outline-none focus:border-purple-500 transition-colors"
                        />
                        <textarea
                            name="summary"
                            value={settings.summary}
                            onChange={handleInputChange}
                            placeholder="劇情摘要 (至少 150 字，將顯示在圖書館)"
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 h-32 resize-none focus:outline-none focus:border-purple-500 transition-colors text-sm"
                        />

                        <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-300 mb-1">預計完結章節數</label>
                                <div className="text-xs text-slate-500">AI 將根據此長度規劃三幕劇節奏 (預設 120)</div>
                            </div>
                            <input
                                type="number"
                                value={targetEndingChapter}
                                onChange={(e) => setTargetEndingChapter(e.target.value)}
                                min="20"
                                max="500"
                                className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-center focus:outline-none focus:border-purple-500"
                            />
                        </div>
                    </div>
                </section>
            </div>

            <div className="pt-8 mt-8 pb-8 border-t border-slate-800">
                <button
                    onClick={handleCreate}
                    disabled={loading || loadingRandom}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-xl shadow-lg shadow-purple-900/40 hover:shadow-purple-900/60 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <>
                            <Sparkles className="animate-spin" /> 正在構建世界...
                        </>
                    ) : (
                        <>
                            開始寫作 <ArrowRight size={24} />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
