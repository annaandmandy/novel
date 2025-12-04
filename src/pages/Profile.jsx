import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, User, Settings, Heart, Edit2, Save, X, Tag } from 'lucide-react';

const AVAILABLE_TAGS = [
    "重生", "穿越", "救贖", "系統", "穿書", "馬甲",
    "強強", "主僕", "相愛相殺", "破鏡重圓", "追妻火葬場", "年下",
    "副本解密", "生存遊戲", "升級", "歷練", "打臉", "復仇", "建設", "權謀",
    "校園", "職場", "娛樂圈", "幫派", "臥底", "動作", "喪屍", "天災", "中式恐怖", "修仙", "規則怪談", "克蘇魯"
];

export default function Profile() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();

    const [profile, setProfile] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        bio: '',
        tags: [],
        preferences: {
            fontSize: 18,
            fontFamily: 'font-serif',
            theme: 'dark'
        }
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            fetchProfile();
        }
    }, [user]);

    const fetchProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data) {
                setProfile(data);
                setFormData({
                    username: data.username || '',
                    bio: data.bio || '',
                    tags: data.tags || [],
                    preferences: data.preferences || { fontSize: 18, fontFamily: 'font-serif', theme: 'dark' }
                });
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        }
    };

    const handleSignOut = async () => {
        await signOut();
        navigate('/auth');
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const updates = {
                id: user.id,
                username: formData.username,
                bio: formData.bio,
                tags: formData.tags,
                preferences: formData.preferences,
                updated_at: new Date(),
            };

            const { error } = await supabase.from('profiles').upsert(updates);

            if (error) throw error;
            setProfile({ ...profile, ...updates });
            setIsEditing(false);
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('儲存失敗');
        } finally {
            setLoading(false);
        }
    };

    const toggleTag = (tag) => {
        if (formData.tags.includes(tag)) {
            setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
        } else {
            if (formData.tags.length >= 10) {
                alert("最多選擇 10 個標籤");
                return;
            }
            setFormData({ ...formData, tags: [...formData.tags, tag] });
        }
    };

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 space-y-6">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center text-slate-600">
                    <User size={40} />
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-xl font-bold text-slate-200">尚未登入</h2>
                    <p className="text-slate-400 text-sm">登入以同步您的閱讀進度與創作</p>
                </div>
                <button
                    onClick={() => navigate('/auth')}
                    className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-full font-bold transition-all shadow-lg shadow-purple-900/20"
                >
                    立即登入 / 註冊
                </button>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-8 pb-24">
            {/* Header */}
            <header className="flex items-start justify-between pb-6 border-b border-slate-800">
                <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-lg shrink-0">
                        {profile?.username?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                    </div>
                    <div>
                        {isEditing ? (
                            <input
                                type="text"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                placeholder="設定暱稱"
                                className="bg-slate-900 border border-slate-700 rounded px-3 py-1 text-lg font-bold text-white focus:outline-none focus:border-purple-500 w-full mb-1"
                            />
                        ) : (
                            <h1 className="text-2xl font-bold text-white">{profile?.username || '未設定暱稱'}</h1>
                        )}
                        <p className="text-slate-400 text-sm">{user.email}</p>
                    </div>
                </div>
                {!isEditing ? (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="p-2 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                        <Edit2 size={20} />
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsEditing(false)}
                            className="p-2 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="p-2 rounded-full bg-purple-600 text-white hover:bg-purple-500 transition-colors shadow-lg shadow-purple-900/20"
                        >
                            <Save size={20} />
                        </button>
                    </div>
                )}
            </header>

            {/* Bio Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-slate-300 font-bold">
                    <User size={18} />
                    自我介紹
                </div>
                {isEditing ? (
                    <textarea
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        placeholder="寫一段關於你的介紹..."
                        className="w-full h-32 bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-200 focus:outline-none focus:border-purple-500 resize-none"
                    />
                ) : (
                    <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-800/50 min-h-[5rem]">
                        <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {profile?.bio || "這位用戶很懶，什麼都沒寫..."}
                        </p>
                    </div>
                )}
            </section>

            {/* Tags Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-slate-300 font-bold">
                    <Tag size={18} />
                    偏好標籤
                </div>

                {isEditing ? (
                    <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
                        <div className="flex flex-wrap gap-2 mb-4">
                            {formData.tags.map(tag => (
                                <span key={tag} className="px-3 py-1 rounded-full bg-purple-600 text-white text-sm flex items-center gap-1">
                                    {tag}
                                    <button onClick={() => toggleTag(tag)} className="hover:text-purple-200"><X size={14} /></button>
                                </span>
                            ))}
                        </div>
                        <div className="border-t border-slate-800 pt-4">
                            <p className="text-xs text-slate-500 mb-2">點擊選擇標籤 (最多 10 個)</p>
                            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                                {AVAILABLE_TAGS.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => toggleTag(tag)}
                                        className={`px-3 py-1 rounded-full text-xs border transition-all ${formData.tags.includes(tag)
                                            ? 'bg-purple-600 border-purple-600 text-white opacity-50 cursor-not-allowed'
                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                                            }`}
                                        disabled={formData.tags.includes(tag)}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {profile?.tags && profile.tags.length > 0 ? (
                            profile.tags.map((tag, i) => (
                                <span key={i} className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-sm">
                                    {tag}
                                </span>
                            ))
                        ) : (
                            <span className="text-slate-500 text-sm">尚未選擇標籤</span>
                        )}
                    </div>
                )}
            </section>

            {/* Reading Settings Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-slate-300 font-bold">
                    <Settings size={18} />
                    閱讀設定 (預設)
                </div>

                <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4 space-y-4">
                    {/* Font Size */}
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400">字體大小</span>
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setFormData({ ...formData, preferences: { ...formData.preferences, fontSize: Math.max(12, formData.preferences.fontSize - 1) } })}
                                    className="w-8 h-8 rounded bg-slate-800 text-slate-300 flex items-center justify-center hover:bg-slate-700"
                                >-</button>
                                <span className="w-8 text-center text-slate-200">{formData.preferences.fontSize}</span>
                                <button
                                    onClick={() => setFormData({ ...formData, preferences: { ...formData.preferences, fontSize: Math.min(32, formData.preferences.fontSize + 1) } })}
                                    className="w-8 h-8 rounded bg-slate-800 text-slate-300 flex items-center justify-center hover:bg-slate-700"
                                >+</button>
                            </div>
                        ) : (
                            <span className="text-slate-200">{profile?.preferences?.fontSize || 18}px</span>
                        )}
                    </div>

                    {/* Font Family */}
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400">字型</span>
                        {isEditing ? (
                            <select
                                value={formData.preferences.fontFamily}
                                onChange={(e) => setFormData({ ...formData, preferences: { ...formData.preferences, fontFamily: e.target.value } })}
                                className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-purple-500"
                            >
                                <option value="font-serif">襯線體 (Serif)</option>
                                <option value="font-sans">無襯線體 (Sans)</option>
                                <option value="font-mono">等寬體 (Mono)</option>
                            </select>
                        ) : (
                            <span className="text-slate-200">
                                {profile?.preferences?.fontFamily === 'font-serif' ? '襯線體' :
                                    profile?.preferences?.fontFamily === 'font-sans' ? '無襯線體' : '等寬體'}
                            </span>
                        )}
                    </div>

                    {/* Theme */}
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400">主題</span>
                        {isEditing ? (
                            <div className="flex gap-2">
                                {['dark', 'light', 'sepia', 'black'].map(theme => (
                                    <button
                                        key={theme}
                                        onClick={() => setFormData({ ...formData, preferences: { ...formData.preferences, theme } })}
                                        className={`w-6 h-6 rounded-full border-2 ${formData.preferences.theme === theme ? 'border-purple-500 scale-110' : 'border-transparent'
                                            } ${theme === 'dark' ? 'bg-slate-900' :
                                                theme === 'light' ? 'bg-slate-100' :
                                                    theme === 'sepia' ? 'bg-[#f4ecd8]' : 'bg-black'
                                            }`}
                                    />
                                ))}
                            </div>
                        ) : (
                            <span className="capitalize text-slate-200">{profile?.preferences?.theme || 'Dark'}</span>
                        )}
                    </div>
                </div>
            </section>

            <div className="border-t border-slate-800 pt-6 space-y-4">
                <section className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="p-4 border-b border-slate-800 font-bold text-slate-300 flex items-center gap-2">
                        <Settings size={18} /> 一般設定
                    </div>
                    <div className="p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">App 版本</span>
                            <span className="text-slate-200">v0.1.0 (Beta)</span>
                        </div>
                    </div>
                </section>

                <button
                    onClick={handleSignOut}
                    className="w-full p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 font-bold"
                >
                    <LogOut size={20} /> 登出
                </button>
            </div>
        </div>
    );
}
