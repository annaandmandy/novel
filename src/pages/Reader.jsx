import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Info, Settings, Share, BookOpen, X, Trash2, Plus, Edit2, AlertTriangle, Type, Palette, List, ToggleLeft, ToggleRight, Save, User, Play, Pause, Volume2, Timer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateNextChapter, refineCharacterProfile } from '../lib/gemini';
import ReactMarkdown from 'react-markdown';



const THEMES = {
    dark: { bg: 'bg-slate-950', text: 'text-slate-300', ui: 'bg-slate-900', border: 'border-slate-800' },
    light: { bg: 'bg-slate-50', text: 'text-slate-800', ui: 'bg-white', border: 'border-slate-200' },
    sepia: { bg: 'bg-[#f4ecd8]', text: 'text-[#5b4636]', ui: 'bg-[#e9e0c9]', border: 'border-[#d3c4a5]' },
    black: { bg: 'bg-black', text: 'text-gray-400', ui: 'bg-gray-900', border: 'border-gray-800' },
};

export default function Reader() {
    const { id } = useParams();
    const { user } = useAuth();
    const [novel, setNovel] = useState(null);
    const [chapters, setChapters] = useState([]);
    const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const contentRef = useRef(null);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [showMenu, setShowMenu] = useState(false);
    const [showWiki, setShowWiki] = useState(false);
    const [wikiTab, setWikiTab] = useState('overview');
    const [useDeepSeek, setUseDeepSeek] = useState(true); // Default to true

    // Character Form State
    const [editingChar, setEditingChar] = useState(null); // null = adding, object = editing
    const [showCharForm, setShowCharForm] = useState(false);
    const [charForm, setCharForm] = useState({ name: '', role: '配角', gender: '未知', description: '', profile: {} });
    const [isProcessingChar, setIsProcessingChar] = useState(false);

    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [generationError, setGenerationError] = useState(null);
    const isPrefetching = useRef(false);

    // TTS & Auto-Turn State
    const [isPlaying, setIsPlaying] = useState(false);
    const isPlayingRef = useRef(false); // Ref to track playing state for callbacks
    const [ttsRate, setTtsRate] = useState(1);
    const [isAutoTurning, setIsAutoTurning] = useState(false);
    const [autoTurnInterval, setAutoTurnInterval] = useState(10); // Seconds
    const autoTurnTimerRef = useRef(null);
    const speechRef = useRef(null);

    // Sync ref with state
    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    // Auto-Turn Logic
    useEffect(() => {
        if (isAutoTurning) {
            autoTurnTimerRef.current = setInterval(() => {
                handleNextPage();
            }, autoTurnInterval * 1000);
        } else {
            clearInterval(autoTurnTimerRef.current);
        }
        return () => clearInterval(autoTurnTimerRef.current);
    }, [isAutoTurning, autoTurnInterval, currentPageIndex, currentChapterIndex, totalPages]); // Dependencies to ensure fresh state

    // TTS Logic
    const toggleTTS = () => {
        if (isPlayingRef.current) {
            window.speechSynthesis.cancel();
            setIsPlaying(false);
        } else {
            if (!contentRef.current) return;

            // 1. Identify where to start
            const elements = Array.from(contentRef.current.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote'));
            if (elements.length === 0) return;

            const containerRect = contentRef.current.parentElement.getBoundingClientRect();
            let startIndex = 0;

            // Find the first visible element
            for (let i = 0; i < elements.length; i++) {
                const rect = elements[i].getBoundingClientRect();
                if (rect.right > containerRect.left + 5) {
                    startIndex = i;
                    break;
                }
            }

            // 2. Queue utterances
            setIsPlaying(true);

            // Cancel any existing speech first
            window.speechSynthesis.cancel();

            for (let i = startIndex; i < elements.length; i++) {
                const element = elements[i];
                const text = element.textContent?.trim();
                if (!text) continue;

                // Clean text
                const cleanText = text.replace(/[#*`]/g, '');
                const utterance = new SpeechSynthesisUtterance(cleanText);
                utterance.lang = 'zh-TW';
                utterance.rate = ttsRate;

                // Auto-Turn Logic on Start
                utterance.onstart = () => {
                    if (!isPlayingRef.current) return; // Safety check using Ref

                    const rect = element.getBoundingClientRect();
                    const container = contentRef.current?.parentElement?.getBoundingClientRect();

                    if (rect && container) {
                        // If element is mostly off-screen to the right, turn page
                        // We check if the *start* of the element is beyond the *center* of the current view?
                        // Or simply if it's to the right of the current viewport.
                        // Since we are in a column layout, 'right' is the direction of next pages.

                        // Note: rect.left is relative to the viewport.
                        // container.right is the right edge of the visible area.
                        // If element.left > container.right, it's on the next page.
                        if (rect.left > container.right - 50) {
                            setCurrentPageIndex(prev => prev + 1);
                        }
                    }
                };

                // Handle End of Queue
                if (i === elements.length - 1) {
                    utterance.onend = () => {
                        setIsPlaying(false);
                    };
                }

                // Error handling
                utterance.onerror = (e) => {
                    // Ignore interrupted error if we manually stopped it
                    if (e.error === 'interrupted' && !isPlayingRef.current) return;

                    console.error("TTS Error:", e);
                    if (i === elements.length - 1) setIsPlaying(false);
                };

                window.speechSynthesis.speak(utterance);
            }
        }
    };

    // Stop TTS on unmount or chapter change
    useEffect(() => {
        return () => {
            window.speechSynthesis.cancel();
        };
    }, []);

    useEffect(() => {
        if (isPlaying) {
            // Restart TTS if chapter changes while playing (optional, or just stop)
            window.speechSynthesis.cancel();
            setIsPlaying(false);
        }
    }, [currentChapterIndex]);

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
        if (user) {
            fetchNovelData();
            fetchUserProfile();
            fetchReadingProgress();
        }
    }, [id, user]);

    // Save Progress Effect (Debounced)
    useEffect(() => {
        if (!novel) return;
        const timer = setTimeout(() => {
            saveReadingProgress();
        }, 1000); // Save after 1 second of no changes
        return () => clearTimeout(timer);
    }, [currentChapterIndex, currentPageIndex, novel]);

    // Measure pages effect
    useEffect(() => {
        if (!contentRef.current || !chapters[currentChapterIndex]) return;

        // 給瀏覽器一點時間渲染樣式 (例如 margin 生效)
        const timer = setTimeout(() => {
            if (!contentRef.current) return;

            const { scrollWidth, clientWidth } = contentRef.current;
            const gap = 48; // 必須跟你 style 裡的 columnGap 一樣
            const stride = clientWidth + gap;

            // 【關鍵修正】
            // 有時候內容只超出一點點 (例如 0.5px)，瀏覽器會把它算成新的一欄，
            // 但 Math.ceil 如果沒有緩衝可能會少算。
            // 我們加上 20px 的緩衝，確保只要有內容溢出，就多算一頁。
            const safeScrollWidth = scrollWidth + 40;

            const pages = Math.ceil(safeScrollWidth / stride);

            // 確保至少有一頁
            setTotalPages(pages || 1);

            // 如果視窗大小改變導致頁數變少，修正當前頁碼防止卡在空白頁
            if (currentPageIndex >= pages) {
                setCurrentPageIndex(Math.max(0, pages - 1));
            }
        }, 150); // 稍微延長一點時間到 150ms 比較保險

        return () => clearTimeout(timer);
    }, [chapters, currentChapterIndex, windowWidth, preferences.fontSize]);

    // Auto-generation Effect
    useEffect(() => {
        if (!novel || chapters.length === 0) return;
        if (generationError) return; // Stop auto-generation on error

        // Only owner can generate new chapters
        if (!user || user.id !== novel.owner_id) return;

        const checkAndGenerate = async () => {
            // If we are close to the end (within 5 chapters), generate more
            if (chapters.length - 1 < currentChapterIndex + 5 && !isPrefetching.current) {
                await prefetchChapters();
            }
        };

        checkAndGenerate();
    }, [currentChapterIndex, chapters.length, novel, generating, generationError]);

    const fetchUserProfile = async () => {
        if (!user) return;
        const { data } = await supabase.from('profiles').select('preferences').eq('id', user.id).single();
        if (data?.preferences) {
            setPreferences(data.preferences);
        }
    };

    const savePreferences = async (newPrefs) => {
        setPreferences(newPrefs);
        await supabase.from('profiles').update({ preferences: newPrefs }).eq('id', user.id);
    };

    const fetchNovelData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const { data: novelData } = await supabase.from('novels').select('*').eq('id', id).single();
            setNovel(novelData);
            if (novelData.settings?.useDeepSeek !== undefined) {
                setUseDeepSeek(novelData.settings.useDeepSeek);
            }

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
            .eq('user_id', user.id)
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
                user_id: user.id,
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
                    id: novel.id,
                    title: novel.title,
                    genre: novel.genre,
                    targetEndingChapter: novel.target_ending_chapter,
                    currentChapterIndex: lastChapter.chapter_index
                },
                lastChapter.content,
                characters,
                memories,
                novel.settings?.clues || [], // clues (Arg 5)
                novel.tags || [],            // tags (Arg 6)
                novel.settings?.tone,        // tone (Arg 7)
                novel.settings?.pov,         // pov (Arg 8)
                novel.settings?.plot_state,  // lastPlotState (Arg 9)
                useDeepSeek                  // useDeepSeek (Arg 10)
            );

            // 2. Handle DB Updates
            const updates = [];

            // A. Insert Chapter
            // Re-verify the next index right before insertion to be absolutely safe
            const { data: latestChapter } = await supabase
                .from('chapters')
                .select('chapter_index')
                .eq('novel_id', novel.id)
                .order('chapter_index', { ascending: false })
                .limit(1)
                .single();

            const safeNewIndex = (latestChapter?.chapter_index || lastChapter.chapter_index) + 1;

            updates.push(
                supabase.from('chapters').insert({
                    novel_id: novel.id,
                    chapter_index: safeNewIndex,
                    title: `第 ${safeNewIndex} 章`,
                    content: aiResponse.content
                }).select().single()
                    .then(({ data }) => {
                        if (data) {
                            setChapters(prev => {
                                // Prevent duplicates in local state
                                if (prev.some(c => c.chapter_index === data.chapter_index)) return prev;
                                return [...prev, data];
                            });
                        }
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
                    let finalProfile = update.profile_update || {};
                    let finalGender = update.gender || '未知';

                    if (existingChar) {
                        finalName = existingChar.name; // Keep original name
                        finalGender = existingChar.gender || update.gender || '未知'; // Keep existing gender if known
                        if (update.description) {
                            finalDesc = update.description;
                        } else if (update.description_append) {
                            finalDesc = existingChar.description + (update.description_append ? ` | ${update.description_append}` : "");
                        }

                        if (update.status) {
                            finalStatus = update.status;
                        } else {
                            finalStatus = existingChar.status;
                        }

                        // Merge profile updates if any
                        if (update.profile_update) {
                            finalProfile = { ...(existingChar.profile || {}), ...update.profile_update };
                        } else {
                            finalProfile = existingChar.profile || {};
                        }
                    }

                    updates.push(
                        supabase.from('characters').upsert({
                            novel_id: novel.id,
                            name: finalName,
                            role: existingChar ? existingChar.role : '配角',
                            gender: finalGender,
                            status: finalStatus,
                            description: finalDesc,
                            profile: finalProfile
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
                                            description: finalDesc,
                                            profile: finalProfile,
                                            gender: finalGender
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

            // D. Update Plot State & Clues in Novel Settings
            let newSettings = { ...novel.settings };
            let settingsChanged = false;

            // Update Plot State
            if (aiResponse.plot_state) {
                newSettings.plot_state = aiResponse.plot_state;
                settingsChanged = true;
            }

            // Update Clues
            let currentClues = newSettings.clues || [];
            if (aiResponse.new_clues?.length > 0 || aiResponse.resolved_clues?.length > 0) {
                // Add new clues
                if (aiResponse.new_clues) {
                    currentClues = [...currentClues, ...aiResponse.new_clues];
                }
                // Remove resolved clues
                if (aiResponse.resolved_clues) {
                    currentClues = currentClues.filter(c => !aiResponse.resolved_clues.includes(c));
                }
                newSettings.clues = currentClues;
                settingsChanged = true;
            }

            if (settingsChanged) {
                updates.push(
                    supabase.from('novels')
                        .update({ settings: newSettings })
                        .eq('id', novel.id)
                        .then(({ error }) => {
                            if (error) console.error("Failed to update settings (plot/clues):", error);
                            else {
                                setNovel(prev => ({ ...prev, settings: newSettings }));
                            }
                        })
                );
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

    // Navigation Logic
    const handleNextPage = () => {
        if (currentPageIndex < totalPages - 1) {
            setCurrentPageIndex(prev => prev + 1);
        } else if (currentChapterIndex < chapters.length - 1) {
            setCurrentChapterIndex(prev => prev + 1);
            setCurrentPageIndex(0);
        }
    };

    const handlePrevPage = () => {
        if (currentPageIndex > 0) {
            setCurrentPageIndex(prev => prev - 1);
        } else if (currentChapterIndex > 0) {
            setCurrentChapterIndex(prev => prev - 1);
            setCurrentPageIndex(0);
        }
    };

    // Keyboard & Volume Key Navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Arrow keys
            if (e.key === 'ArrowRight') handleNextPage();
            if (e.key === 'ArrowLeft') handlePrevPage();

            // Volume keys (Note: iOS Safari doesn't expose these by default, but some wrappers/browsers might)
            // We map VolumeUp to Next (or Prev depending on preference, usually Next)
            if (e.key === 'VolumeUp') {
                e.preventDefault(); // Try to prevent system volume change if possible (rarely works on web)
                handleNextPage();
            }
            if (e.key === 'VolumeDown') {
                e.preventDefault();
                handlePrevPage();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPageIndex, currentChapterIndex, totalPages, chapters]);

    // Swipe Logic
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            handleNextPage();
        } else if (isRightSwipe) {
            handlePrevPage();
        }
    };

    const handlePageClick = (e) => {
        // Prevent click if it was a swipe
        if (touchStart && touchEnd && Math.abs(touchStart - touchEnd) > 10) return;

        const width = window.innerWidth;
        const clickX = e.clientX;

        if (clickX > width * 0.7) {
            handleNextPage();
        } else if (clickX < width * 0.3) {
            handlePrevPage();
        } else {
            setShowMenu(!showMenu);
        }
    };

    // Wiki Actions
    const handleSaveCharacter = async () => {
        if (!charForm.name || !charForm.description) {
            alert("請填寫名稱和描述");
            return;
        }

        setIsProcessingChar(true);
        try {
            let finalCharData = { ...charForm };

            // If adding new character, use AI to refine profile
            if (!editingChar) {
                console.log("Refining character with AI...");
                const refined = await refineCharacterProfile(charForm, { title: novel.title, genre: novel.genre, trope: novel.settings.trope }, useDeepSeek);
                finalCharData = { ...finalCharData, ...refined };
            } else {
                // If editing, use the form data which might have modified profile
                finalCharData.profile = charForm.profile;
            }

            const { data, error } = await supabase.from('characters').upsert({
                id: editingChar?.id, // If editing, include ID
                novel_id: id,
                name: finalCharData.name,
                role: finalCharData.role,
                gender: finalCharData.gender,
                description: finalCharData.description,
                profile: finalCharData.profile || {},
                status: editingChar?.status || 'Alive'
            }).select().single();

            if (error) throw error;

            if (editingChar) {
                setCharacters(characters.map(c => c.id === editingChar.id ? data : c));
            } else {
                setCharacters([...characters, data]);
            }
            setShowCharForm(false);
            setCharForm({ name: '', role: '配角', gender: '未知', description: '', profile: {} });
        } catch (error) {
            console.error("Error saving character:", error);
            alert("儲存失敗");
        } finally {
            setIsProcessingChar(false);
        }
    };

    const openAddCharModal = () => {
        setEditingChar(null);
        setCharForm({ name: '', role: '配角', gender: '未知', description: '', profile: {} });
        setShowCharForm(true);
    };

    const openEditCharModal = (char) => {
        setEditingChar(char);
        setCharForm({
            name: char.name,
            role: char.role,
            gender: char.gender || '未知',
            description: char.description,
            profile: char.profile || {}
        });
        setShowCharForm(true);
    };

    const handleDeleteCharacter = async (charId) => {
        if (!confirm("確定刪除此角色？\n\n注意：角色將會在「下一章」被安排自然退場（死亡、離開等），之後才會完全消失。")) return;

        // Soft delete: Mark as 'Exiting' so AI knows to write them out
        const { error } = await supabase.from('characters').update({ status: 'Exiting' }).eq('id', charId);

        if (!error) {
            // Update local state to reflect change immediately
            setCharacters(characters.map(c => c.id === charId ? { ...c, status: 'Exiting' } : c));
        }
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
        <div className={`h-[100dvh] ${theme.bg} ${theme.text} ${preferences.fontFamily} leading-relaxed relative overflow-hidden flex flex-col transition-colors duration-300 pt-[calc(env(safe-area-inset-top))]`}>

            {/* Header Info (Top Right) */}
            <div className="absolute top-12 right-6 z-10 opacity-50 text-xs font-medium pointer-events-none">
                {novel.title}
            </div>

            {/* Content Area */}
            <div
                onClick={handlePageClick}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                className="flex-1 px-6 py-12 md:p-12 max-w-3xl mx-auto w-full cursor-pointer flex flex-col transition-all duration-300"
            >
                <div className="flex-1 relative overflow-hidden">
                    <div
                        ref={contentRef}
                        className="h-full absolute inset-0 transition-transform duration-300 ease-out"
                        style={{
                            columnWidth: `${windowWidth < 768 ? windowWidth - 48 : 768 - 96}px`, // Container width - padding
                            columnGap: '48px', // Matches padding
                            columnFill: 'auto',
                            width: '100%',
                            transform: `translateX(calc(-${currentPageIndex} * (100% + 48px)))`
                        }}
                    >
                        <div className="markdown-content" style={{ fontSize: `${preferences.fontSize}px`, lineHeight: '1.8' }}>
                            <ReactMarkdown
                                components={{
                                    // 1. 處理段落：最安全的設定
                                    p: ({ node, ...props }) => (
                                        <p className="mb-4 text-justify whitespace-pre-wrap break-inside-auto block" {...props} />
                                    ),

                                    // 2. 處理 H1/H2/H3 (## 符號)
                                    // 關鍵修改：
                                    // - 移除 'break-after-avoid'：雖然這可能讓標題單獨留在頁尾，但為了「不讓字消失」，這是必要的犧牲。
                                    // - 確保 'w-full block'：明確佔位。
                                    // - 減少 'mt' (margin-top)：減少擠壓。
                                    h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2 w-full block break-inside-auto leading-snug" {...props} />,
                                    h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-4 mb-2 w-full block break-inside-auto leading-snug" {...props} />,
                                    h3: ({ node, ...props }) => <h3 className="text-base font-bold mt-3 mb-1 w-full block break-inside-auto leading-snug" {...props} />,

                                    // 3. 處理 HR (*** 符號) - 這是重點！
                                    // 瀏覽器原生的 <hr> 在 column layout 常常壞掉。
                                    // 我們改用一個普通的 <div> 來模擬線條，這樣最穩定。
                                    hr: ({ node, ...props }) => (
                                        <div className="w-full py-4 break-inside-auto">
                                            <div className="w-full border-t border-current opacity-20"></div>
                                        </div>
                                    ),

                                    // 4. 其他元素保持簡單
                                    li: ({ node, ...props }) => <li className="ml-4 list-disc break-inside-auto" {...props} />,
                                    blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-purple-500 pl-4 py-1 my-2 italic opacity-80" {...props} />,
                                    strong: ({ node, ...props }) => <strong className="font-bold opacity-100" {...props} />,
                                    em: ({ node, ...props }) => <em className="italic opacity-90" {...props} />,
                                }}
                            >
                                {(() => {
                                    let text = currentChapter.content?.trim() || '';
                                    // Fix: Handle cases where JSON was saved directly to DB
                                    if (text.startsWith('{') && text.includes('"content"')) {
                                        try {
                                            const parsed = JSON.parse(text);
                                            if (parsed.content) text = parsed.content;
                                        } catch (e) { console.warn("Failed to parse JSON content", e); }
                                    }
                                    // Fix: Ensure literal \n strings are converted to newlines if escaped
                                    text = text.replace(/\\n/g, '\n');

                                    // We rely on CSS columns now, so we can keep headers.
                                    // Just ensure they don't have excessive margins that push content out of flow weirdly.
                                    // But standard markdown should be fine with column-break-inside: avoid;

                                    return text;
                                })()}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="h-8 flex items-center justify-between text-[10px] opacity-40 mt-4 border-t border-current pt-2">
                    <span>第 {currentChapter.chapter_index} 章</span>
                    <span>{Math.round(((currentPageIndex + 1) / totalPages) * 100)}%</span>
                </div>
            </div>

            {/* Sidebar / Menu Overlay */}
            {showMenu && (
                <div className="absolute inset-0 z-30 flex">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowMenu(false)} />

                    {/* Sidebar Panel (Left on Desktop, Bottom on Mobile) */}
                    <div className={`relative flex flex-col ${theme.ui} ${theme.text} w-full md:w-80 md:h-full h-auto max-h-[85dvh] md:max-h-full mt-auto md:mt-0 shadow-2xl transition-transform rounded-t-2xl md:rounded-none`}>

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

                            {/* AI Model Selection */}
                            {user && user.id === novel.owner_id && (
                                <>
                                    <section>
                                        <h4 className="text-xs font-bold opacity-50 mb-3 uppercase tracking-wider">AI 模型</h4>
                                        <div className={`p-4 rounded-lg border ${theme.border} flex items-center justify-between`}>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-bold ${useDeepSeek ? 'text-blue-500' : 'opacity-50'}`}>DeepSeek V3</span>
                                                <span className="text-xs opacity-50">vs</span>
                                                <span className={`text-sm font-bold ${!useDeepSeek ? 'text-purple-500' : 'opacity-50'}`}>Gemini 2.0</span>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    const newVal = !useDeepSeek;
                                                    setUseDeepSeek(newVal);
                                                    // Persist setting
                                                    await supabase.from('novels').update({
                                                        settings: { ...novel.settings, useDeepSeek: newVal }
                                                    }).eq('id', novel.id);
                                                }}
                                                className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${useDeepSeek ? 'bg-blue-600' : 'bg-purple-600'}`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${useDeepSeek ? 'left-1' : 'translate-x-7 left-0'}`} />
                                            </button>
                                        </div>
                                        <p className="text-[10px] opacity-50 mt-2 px-1">
                                            {useDeepSeek ? "DeepSeek: 擅長中式網文邏輯與情節策劃。" : "Gemini: 擅長擴寫與潤色，速度較快。"}
                                        </p>
                                    </section>
                                </>
                            )}


                            {/* TTS & Auto-Turn */}
                            <section>
                                <h4 className="text-xs font-bold opacity-50 mb-3 uppercase tracking-wider">聽書與自動翻頁</h4>
                                <div className={`p-4 rounded-lg border ${theme.border} space-y-4`}>

                                    {/* TTS Controls */}
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold flex items-center gap-2"><Volume2 size={14} /> 語音朗讀</span>
                                            <button
                                                onClick={toggleTTS}
                                                className={`p-2 rounded-full ${isPlaying ? 'bg-purple-600 text-white' : 'bg-slate-700/50'}`}
                                            >
                                                {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                                            </button>
                                        </div>
                                        {isPlaying && (
                                            <div className="flex items-center gap-2 text-xs">
                                                <span>速度</span>
                                                <input
                                                    type="range" min="0.5" max="2" step="0.1"
                                                    value={ttsRate}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        setTtsRate(val);
                                                        // Real-time update requires restart, simpler to just update state for next play or complex handling. 
                                                        // For V1, user needs to restart to apply speed change effectively or we implement dynamic update.
                                                        // Dynamic update:
                                                        if (isPlaying) {
                                                            window.speechSynthesis.cancel();
                                                            setTimeout(toggleTTS, 100);
                                                        }
                                                    }}
                                                    className="flex-1 accent-purple-500"
                                                />
                                                <span>{ttsRate}x</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className={`h-px ${theme.border} bg-current opacity-10`} />

                                    {/* Auto-Turn Controls */}
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold flex items-center gap-2"><Timer size={14} /> 自動翻頁</span>
                                            <button
                                                onClick={() => setIsAutoTurning(!isAutoTurning)}
                                                className={`relative w-10 h-5 rounded-full transition-colors ${isAutoTurning ? 'bg-green-500' : 'bg-slate-700/50'}`}
                                            >
                                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${isAutoTurning ? 'left-6' : 'left-1'}`} />
                                            </button>
                                        </div>
                                        {isAutoTurning && (
                                            <div className="flex items-center gap-2 text-xs">
                                                <span>間隔</span>
                                                <input
                                                    type="range" min="5" max="60" step="5"
                                                    value={autoTurnInterval}
                                                    onChange={(e) => setAutoTurnInterval(parseInt(e.target.value))}
                                                    className="flex-1 accent-green-500"
                                                />
                                                <span>{autoTurnInterval}秒</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {user && user.id === novel.owner_id && (
                                <>
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
                                </>
                            )}
                            {/* Ending Settings */}


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
                <div className={`absolute inset-0 z-50 ${theme.bg} ${theme.text} flex flex-col pt-12 md:pt-0`}>
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
                                {user && user.id === novel.owner_id && (
                                    <button onClick={openAddCharModal} className={`w-full py-2 border border-dashed ${theme.border} rounded-lg opacity-60 text-sm hover:opacity-100 flex items-center justify-center gap-2`}>
                                        <Plus size={16} /> 新增角色
                                    </button>
                                )}
                                {characters
                                    .filter(c => c.status !== 'Retired' && c.status !== 'Exiting') // Hide Retired and Exiting from UI (looks deleted to user)
                                    .map(char => (
                                        <div key={char.id} className={`p-4 rounded-xl border ${theme.border} ${theme.ui} relative group`}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold flex items-center gap-2">
                                                        {char.name}
                                                        <span className="text-xs opacity-60 font-normal">({char.role})</span>
                                                    </h3>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${char.status.includes('死') || char.status === 'Dead' ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                                                        {char.status === 'Alive' ? '存活' : char.status}
                                                    </span>
                                                </div>
                                                {user && user.id === novel.owner_id && (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => openEditCharModal(char)} className="opacity-60 hover:text-blue-400">
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button onClick={() => handleDeleteCharacter(char.id)} className="opacity-60 hover:text-red-400">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-sm opacity-80 mt-2">{char.description}</p>
                                        </div>
                                    ))}
                            </div>
                        )}

                        {/* Memory Tab */}
                        {wikiTab === 'memory' && (
                            <div className="space-y-3">
                                {user && user.id === novel.owner_id && (
                                    <>
                                        <div className="bg-yellow-900/10 border border-yellow-900/30 p-3 rounded-lg flex gap-2 items-start">
                                            <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                                            <p className="text-xs text-yellow-500/80">修改記憶可能會導致 AI 生成的故事前後不連貫，請謹慎操作。</p>
                                        </div>
                                        <button onClick={handleAddMemory} className={`w-full py-2 border border-dashed ${theme.border} rounded-lg opacity-60 text-sm hover:opacity-100 flex items-center justify-center gap-2`}>
                                            <Plus size={16} /> 新增記憶節點
                                        </button>
                                    </>
                                )}
                                {memories.map(mem => (
                                    <div key={mem.id} className={`p-4 rounded-xl border ${theme.border} ${theme.ui}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] opacity-50">{new Date(mem.created_at).toLocaleDateString()}</span>
                                            {user && user.id === novel.owner_id && (
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleEditMemory(mem)} className="opacity-60 hover:text-blue-400"><Edit2 size={14} /></button>
                                                    <button onClick={() => handleDeleteMemory(mem.id)} className="opacity-60 hover:text-red-400"><Trash2 size={14} /></button>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-sm opacity-80">{mem.content}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* Character Form Modal */}
            {showCharForm && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`w-full max-w-md ${theme.ui} ${theme.text} rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}>
                        <div className={`p-4 border-b ${theme.border} flex justify-between items-center`}>
                            <h3 className="font-bold">{editingChar ? '編輯角色' : '新增角色'}</h3>
                            <button onClick={() => setShowCharForm(false)}><X size={20} /></button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto">
                            <div>
                                <label className="text-xs opacity-70 block mb-1">角色名稱</label>
                                <input
                                    value={charForm.name}
                                    onChange={(e) => setCharForm({ ...charForm, name: e.target.value })}
                                    className={`w-full bg-transparent border ${theme.border} rounded px-3 py-2 focus:outline-none focus:border-purple-500`}
                                    placeholder="例如：林湘"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs opacity-70 block mb-1">定位</label>
                                    <select
                                        value={charForm.role}
                                        onChange={(e) => setCharForm({ ...charForm, role: e.target.value })}
                                        className={`w-full bg-transparent border ${theme.border} rounded px-3 py-2 focus:outline-none focus:border-purple-500`}
                                    >
                                        <option value="主角">主角</option>
                                        <option value="配角">配角</option>
                                        <option value="反派">反派</option>
                                        <option value="路人">路人</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs opacity-70 block mb-1">性別</label>
                                    <select
                                        value={charForm.gender}
                                        onChange={(e) => setCharForm({ ...charForm, gender: e.target.value })}
                                        className={`w-full bg-transparent border ${theme.border} rounded px-3 py-2 focus:outline-none focus:border-purple-500`}
                                    >
                                        <option value="男">男</option>
                                        <option value="女">女</option>
                                        <option value="未知">未知</option>
                                        <option value="無性別">無性別</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs opacity-70 block mb-1">外貌/性格描述</label>
                                <textarea
                                    value={charForm.description}
                                    onChange={(e) => setCharForm({ ...charForm, description: e.target.value })}
                                    className={`w-full bg-transparent border ${theme.border} rounded px-3 py-2 h-32 focus:outline-none focus:border-purple-500 resize-none`}
                                    placeholder="請輸入角色的外貌特徵、性格關鍵詞或背景故事..."
                                />
                            </div>

                            {!editingChar && (
                                <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded text-xs text-blue-400 flex gap-2">
                                    <Info size={14} className="shrink-0 mt-0.5" />
                                    <p>點擊儲存後，AI ({useDeepSeek ? 'DeepSeek' : 'Gemini'}) 將會自動補全該角色的詳細設定（冰山檔案）。</p>
                                </div>
                            )}

                            {/* Profile Editing Section (Only when editing) */}
                            {editingChar && (
                                <div className="space-y-3 pt-4 border-t border-slate-700/50">
                                    <h4 className="text-xs font-bold opacity-50 uppercase tracking-wider">詳細設定 (Profile)</h4>

                                    <div>
                                        <label className="text-xs opacity-70 block mb-1">外貌 (Appearance)</label>
                                        <textarea
                                            value={charForm.profile?.appearance || ''}
                                            onChange={(e) => setCharForm({ ...charForm, profile: { ...charForm.profile, appearance: e.target.value } })}
                                            className={`w-full bg-transparent border ${theme.border} rounded px-3 py-2 h-20 text-xs focus:outline-none focus:border-purple-500 resize-none`}
                                            placeholder="詳細外貌描寫..."
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs opacity-70 block mb-1">表層性格 (Personality Surface)</label>
                                        <textarea
                                            value={charForm.profile?.personality_surface || ''}
                                            onChange={(e) => setCharForm({ ...charForm, profile: { ...charForm.profile, personality_surface: e.target.value } })}
                                            className={`w-full bg-transparent border ${theme.border} rounded px-3 py-2 h-20 text-xs focus:outline-none focus:border-purple-500 resize-none`}
                                            placeholder="平時展現出的性格..."
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs opacity-70 block mb-1">核心性格 (Personality Core)</label>
                                        <textarea
                                            value={charForm.profile?.personality_core || ''}
                                            onChange={(e) => setCharForm({ ...charForm, profile: { ...charForm.profile, personality_core: e.target.value } })}
                                            className={`w-full bg-transparent border ${theme.border} rounded px-3 py-2 h-20 text-xs focus:outline-none focus:border-purple-500 resize-none`}
                                            placeholder="內在真實性格與動機..."
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs opacity-70 block mb-1">背景故事 (Biography)</label>
                                        <textarea
                                            value={charForm.profile?.biography || ''}
                                            onChange={(e) => setCharForm({ ...charForm, profile: { ...charForm.profile, biography: e.target.value } })}
                                            className={`w-full bg-transparent border ${theme.border} rounded px-3 py-2 h-24 text-xs focus:outline-none focus:border-purple-500 resize-none`}
                                            placeholder="角色的過去經歷..."
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs opacity-70 block mb-1 text-purple-400">說話風格 (Speaking Style)</label>
                                            <input
                                                value={charForm.profile?.speaking_style || ''}
                                                onChange={(e) => setCharForm({ ...charForm, profile: { ...charForm.profile, speaking_style: e.target.value } })}
                                                className={`w-full bg-transparent border ${theme.border} rounded px-3 py-2 text-xs focus:outline-none focus:border-purple-500`}
                                                placeholder="文縐縐、粗俗..."
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs opacity-70 block mb-1 text-purple-400">代表台詞 (Sample Dialogue)</label>
                                            <input
                                                value={charForm.profile?.sample_dialogue || ''}
                                                onChange={(e) => setCharForm({ ...charForm, profile: { ...charForm.profile, sample_dialogue: e.target.value } })}
                                                className={`w-full bg-transparent border ${theme.border} rounded px-3 py-2 text-xs focus:outline-none focus:border-purple-500`}
                                                placeholder="一句話代表他..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className={`p-4 border-t ${theme.border} flex justify-end gap-2`}>
                            <button onClick={() => setShowCharForm(false)} className="px-4 py-2 opacity-60 hover:opacity-100">取消</button>
                            <button
                                onClick={handleSaveCharacter}
                                disabled={isProcessingChar}
                                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isProcessingChar ? 'AI 處理中...' : '儲存'}
                            </button>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
}
