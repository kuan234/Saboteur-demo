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
        <div className="w-full h-full flex flex-col items-center justify-center relative"
            style={{ background: 'radial-gradient(ellipse at center, #1e1610 0%, #0a0705 100%)' }}>

            <div className="absolute w-96 h-96 bg-amber-600/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="z-10 bg-stone-900 border border-stone-700/50 p-8 rounded-xl shadow-2xl w-80 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-stone-800 via-amber-600 to-stone-800" />

                <h1 className="text-3xl text-center text-amber-500 font-bold mb-2 tracking-wider font-medieval" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                    ⛏️ 矮人矿坑
                </h1>
                <p className="text-center text-stone-400 text-sm mb-6">无需注册，输入用户名即可开始</p>

                <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
                    <input
                        type="text"
                        placeholder="用户名 / Username"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        className="w-full bg-stone-800 border border-stone-600 text-stone-200 px-4 py-3 rounded-lg focus:outline-none focus:border-amber-500 transition-colors"
                    />

                    {error && <div className="text-red-400 text-sm text-center font-bold bg-red-900/30 p-2 rounded">{error}</div>}

                    <button
                        type="submit"
                        className="w-full py-3 mt-2 bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 border border-amber-500/50 rounded-lg text-white font-bold text-lg shadow-lg transform transition-all hover:scale-[1.02] active:scale-95"
                    >
                        进入大厅
                    </button>
                </form>
            </div>
        </div>
    );
}
