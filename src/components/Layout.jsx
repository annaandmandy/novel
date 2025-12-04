import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Library, Globe, PlusCircle, User } from 'lucide-react';
import clsx from 'clsx';

const NavItem = ({ to, icon: Icon, label }) => (
    <NavLink
        to={to}
        className={({ isActive }) =>
            clsx(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                isActive ? "text-purple-400" : "text-slate-400 hover:text-slate-200"
            )
        }
    >
        <Icon size={24} />
        <span className="text-xs font-medium">{label}</span>
    </NavLink>
);

export default function Layout() {
    return (
        <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden pt-[env(safe-area-inset-top)]">
            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto pb-16 md:pb-0 md:pl-20">
                <Outlet />
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 flex items-center justify-around z-50 safe-area-bottom">
                <NavItem to="/" icon={Library} label="書庫" />
                <NavItem to="/square" icon={Globe} label="廣場" />
                <NavItem to="/create" icon={PlusCircle} label="創作" />
                <NavItem to="/profile" icon={User} label="我的" />
            </nav>

            {/* Desktop Sidebar */}
            <nav className="hidden md:flex fixed top-0 left-0 bottom-0 w-20 flex-col items-center py-8 bg-slate-900 border-r border-slate-800 z-50 space-y-8">
                <div className="text-purple-500 font-bold text-xl">DB</div>
                <NavItem to="/" icon={Library} label="書庫" />
                <NavItem to="/square" icon={Globe} label="廣場" />
                <NavItem to="/create" icon={PlusCircle} label="創作" />
                <div className="flex-1" />
                <NavItem to="/profile" icon={User} label="我的" />
            </nav>
        </div>
    );
}
