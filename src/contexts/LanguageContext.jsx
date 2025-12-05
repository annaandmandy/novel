import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

const LanguageContext = createContext();

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
    const { user } = useAuth();
    // Try to get language from localStorage, default to 'zh-TW'
    const [language, setLanguage] = useState(() => {
        return localStorage.getItem('app_language') || 'zh-TW';
    });

    // Load language from user profile when user logs in
    useEffect(() => {
        const loadUserLanguage = async () => {
            if (user) {
                try {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('preferences')
                        .eq('id', user.id)
                        .single();

                    if (data && data.preferences && data.preferences.language) {
                        setLanguage(data.preferences.language);
                        localStorage.setItem('app_language', data.preferences.language);
                    }
                } catch (error) {
                    console.error("Error loading language preference:", error);
                }
            }
        };
        loadUserLanguage();
    }, [user]);

    useEffect(() => {
        localStorage.setItem('app_language', language);
    }, [language]);

    const t = (key) => {
        const keys = key.split('.');
        let value = translations[language];

        for (const k of keys) {
            if (value && value[k]) {
                value = value[k];
            } else {
                // Fallback to zh-TW if key missing in current language
                let fallback = translations['zh-TW'];
                for (const fk of keys) {
                    if (fallback && fallback[fk]) {
                        fallback = fallback[fk];
                    } else {
                        return key; // Return key if not found anywhere
                    }
                }
                return fallback;
            }
        }
        return value;
    };

    const changeLanguage = async (lang) => {
        if (translations[lang]) {
            setLanguage(lang);
            localStorage.setItem('app_language', lang);

            // Save to Supabase if user is logged in
            if (user) {
                try {
                    // First get current preferences to avoid overwriting other settings
                    const { data: currentData } = await supabase
                        .from('profiles')
                        .select('preferences')
                        .eq('id', user.id)
                        .single();

                    const currentPreferences = currentData?.preferences || {};

                    await supabase
                        .from('profiles')
                        .update({
                            preferences: {
                                ...currentPreferences,
                                language: lang
                            }
                        })
                        .eq('id', user.id);
                } catch (error) {
                    console.error("Error saving language preference:", error);
                }
            }
        }
    };

    return (
        <LanguageContext.Provider value={{ language, changeLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};
