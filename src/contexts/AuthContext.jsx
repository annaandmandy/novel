import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // ...

    useEffect(() => {
        // Check active sessions and sets the user
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for changes on auth state (sign in, sign out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Handle Deep Links for Mobile Auth
        let appListener = null;

        if (Capacitor.isNativePlatform()) {
            App.addListener('appUrlOpen', async (data) => {
                console.log('App opened with URL:', data.url);
                if (data.url.includes('google-auth')) {
                    try {
                        // Parse the URL to get access_token and refresh_token
                        // Supabase returns them in the hash fragment (#)
                        const url = data.url;
                        let queryString = url.split('#')[1];
                        if (!queryString) queryString = url.split('?')[1];

                        if (queryString) {
                            const params = new URLSearchParams(queryString);
                            const accessToken = params.get('access_token');
                            const refreshToken = params.get('refresh_token');

                            if (accessToken && refreshToken) {
                                const { error } = await supabase.auth.setSession({
                                    access_token: accessToken,
                                    refresh_token: refreshToken,
                                });
                                if (error) throw error;
                                console.log('Mobile Auth: Session set successfully');
                            }
                        }
                    } catch (error) {
                        console.error('Mobile Auth Error:', error);
                    }
                }
            }).then(listener => {
                appListener = listener;
            });
        }

        return () => {
            subscription.unsubscribe();
            if (appListener) appListener.remove();
        };
    }, []);

    const signUp = async (email, password) => {
        return supabase.auth.signUp({ email, password });
    };

    const signIn = async (email, password) => {
        return supabase.auth.signInWithPassword({ email, password });
    };

    const signOut = async () => {
        return supabase.auth.signOut();
    };

    const signInWithGoogle = async () => {
        // 自動判斷環境
        const isNative = Capacitor.isNativePlatform();
        const redirectUrl = isNative
            ? 'dogblood://google-auth'       // 如果是 App (iOS/Android)，用 Deep Link
            : window.location.origin;        // 如果是網頁，用網頁的網址

        return supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl
            }
        });
    };

    return (
        <AuthContext.Provider value={{ user, signUp, signIn, signOut, signInWithGoogle, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
