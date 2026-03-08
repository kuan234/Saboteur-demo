import React, { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

export default function AuthPage() {
    const { login, register } = useSocket();
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [nickname, setNickname] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (isLogin) {
                if (!username || !password) throw new Error('请输入账号和密码');
                await login(username, password);
            } else {
                if (!username || !password || !nickname) throw new Error('请填写完整信息');
                await register(username, password, nickname);
                // Automatically switch to login upon success
                setIsLogin(true);
                setError('注册成功，请登录！');
                setTimeout(() => setError(''), 3000);
                setPassword('');
            }
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center relative"
            style={{ background: 'radial-gradient(ellipse at center, #1e1610 0%, #0a0705 100%)' }}>

            {/* Ambient background glow */}
            <div className="absolute w-96 h-96 bg-amber-600/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="z-10 bg-stone-900 border border-stone-700/50 p-8 rounded-xl shadow-2xl w-80 relative overflow-hidden">
                {/* Decorative top border */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-stone-800 via-amber-600 to-stone-800" />

                <h1 className="text-3xl text-center text-amber-500 font-bold mb-6 tracking-wider font-medieval" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                    ⛏️ 矮人矿坑
                </h1>

                <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
                    <input
                        type="text"
                        placeholder="账号 / Username"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        className="w-full bg-stone-800 border border-stone-600 text-stone-200 px-4 py-3 rounded-lg focus:outline-none focus:border-amber-500 transition-colors"
                    />
                    <input
                        type="password"
                        placeholder="密码 / Password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full bg-stone-800 border border-stone-600 text-stone-200 px-4 py-3 rounded-lg focus:outline-none focus:border-amber-500 transition-colors"
                    />
                    {!isLogin && (
                        <input
                            type="text"
                            placeholder="游戏昵称 / Nickname"
                            value={nickname}
                            onChange={e => setNickname(e.target.value)}
                            className="w-full bg-stone-800 border border-stone-600 text-stone-200 px-4 py-3 rounded-lg focus:outline-none focus:border-amber-500 transition-colors"
                        />
                    )}

                    {error && <div className="text-red-400 text-sm text-center font-bold bg-red-900/30 p-2 rounded">{error}</div>}

                    <button
                        type="submit"
                        className="w-full py-3 mt-4 bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 border border-amber-500/50 rounded-lg text-white font-bold text-lg shadow-lg transform transition-all hover:scale-[1.02] active:scale-95"
                    >
                        {isLogin ? '登 录' : '注 册'}
                    </button>
                </form>

                <div
                    onClick={() => { setIsLogin(!isLogin); setError(''); }}
                    className="mt-6 text-center text-stone-400 hover:text-amber-400 cursor-pointer transition-colors text-sm"
                >
                    {isLogin ? '没有账号？去注册 ➔' : '已有账号？返回登录 ➔'}
                </div>
            </div>
        </div>
    );
}
