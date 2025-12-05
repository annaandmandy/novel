import React, { useState } from 'react';
import { X, Save, User } from 'lucide-react';

export default function CharacterEditModal({ isOpen, onClose, characterName, profile, onSave }) {
    if (!isOpen) return null;

    const [editedProfile, setEditedProfile] = useState(profile || {});

    const handleChange = (field, value) => {
        setEditedProfile(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        onSave(editedProfile);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="flex items-center justify-between p-6 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <User size={20} className="text-purple-400" />
                        編輯角色設定：{characterName}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">外貌特徵 (Appearance)</label>
                            <textarea
                                value={editedProfile.appearance || ''}
                                onChange={(e) => handleChange('appearance', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none h-24 resize-none"
                                placeholder="黑髮紅眼，身穿..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">表層性格 (Surface Personality)</label>
                            <textarea
                                value={editedProfile.personality_surface || ''}
                                onChange={(e) => handleChange('personality_surface', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none h-24 resize-none"
                                placeholder="看似冷漠，實則..."
                            />
                        </div>
                    </div>

                    {/* Deep Info */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">核心價值觀 (Core Personality)</label>
                        <textarea
                            value={editedProfile.personality_core || ''}
                            onChange={(e) => handleChange('personality_core', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none h-20 resize-none"
                            placeholder="堅信正義，或者..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">生平經歷 (Biography)</label>
                        <textarea
                            value={editedProfile.biography || ''}
                            onChange={(e) => handleChange('biography', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none h-32 resize-none"
                            placeholder="出生於..."
                        />
                    </div>

                    {/* Anti-OOC Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-purple-400 mb-1">說話風格 (Speaking Style)</label>
                            <input
                                type="text"
                                value={editedProfile.speaking_style || ''}
                                onChange={(e) => handleChange('speaking_style', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                                placeholder="文縐縐、粗俗、簡短..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-purple-400 mb-1">代表台詞 (Sample Dialogue)</label>
                            <input
                                type="text"
                                value={editedProfile.sample_dialogue || ''}
                                onChange={(e) => handleChange('sample_dialogue', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                                placeholder="一句話代表他..."
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">創傷 (Trauma)</label>
                            <textarea
                                value={editedProfile.trauma || ''}
                                onChange={(e) => handleChange('trauma', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none h-20 resize-none"
                                placeholder="童年陰影..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">慾望 (Desire)</label>
                            <textarea
                                value={editedProfile.desire || ''}
                                onChange={(e) => handleChange('desire', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none h-20 resize-none"
                                placeholder="想要成為..."
                            />
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-900 sticky bottom-0 z-10">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                    >
                        <Save size={18} />
                        保存設定
                    </button>
                </div>
            </div>
        </div>
    );
}
