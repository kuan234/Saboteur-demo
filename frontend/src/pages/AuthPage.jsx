import React, { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

export default function AuthPage() {
    const { quickLogin } = useSocket();
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (!username.trim()) throw new Error('请输入用户名');
            quickLogin(username);
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center relative p-4" data-testid="auth-page"
            style={{ background: 'radial-gradient(ellipse at center, #1e1610 0%, #0a0705 100%)' }}>

            <div className="absolute w-96 h-96 bg-amber-600/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="z-10 bg-stone-900/90 border border-stone-700/60 p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-stone-800 via-amber-600 to-stone-800" />

                <h1 className="text-3xl md:text-4xl text-center text-amber-500 font-bold mb-2 tracking-wider font-medieval" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                    ⛏️ 矮人矿坑
                </h1>
                <p className="text-center text-stone-400 text-sm mb-6">移动端优先体验 · 输入昵称即可开始</p>

                <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
                    <input
                        type="text"
                        placeholder="输入昵称"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        data-testid="nickname-input"
                        className="w-full bg-stone-800 border border-stone-600 text-stone-200 px-4 py-3.5 rounded-xl focus:outline-none focus:border-amber-500 transition-colors text-base"
                    />

                    {error && <div className="text-red-300 text-sm text-center font-bold bg-red-900/40 p-2.5 rounded-lg border border-red-500/40">{error}</div>}

                    <button
                        type="submit"
                        data-testid="login-submit"
                        className="w-full py-3.5 mt-2 bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 border border-amber-500/50 rounded-xl text-white font-bold text-lg shadow-lg transition-all active:scale-95"
                    >
                        进入大厅
                    </button>
                </form>
            </div>
        </div>
    );
}
