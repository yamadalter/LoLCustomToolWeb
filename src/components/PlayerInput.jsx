import React from 'react';
import { UserPlus } from 'lucide-react';

const PlayerInput = ({
  inputName,
  onInputNameChange,
  inputTag,
  onInputTagChange,
  onAddPlayer,
}) => {
  return (
    <section className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-xl">
      <h2 className="flex items-center gap-2 text-lg font-semibold mb-4 text-blue-400">
        <UserPlus size={20} /> プレイヤー追加
      </h2>
      <div className="flex flex-wrap gap-3">
        <div className="flex-grow flex gap-3">
          <input
            type="text"
            placeholder="サモナー名"
            className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            value={inputName}
            onChange={onInputNameChange}
            onKeyPress={(e) => e.key === 'Enter' && onAddPlayer()}
          />
          <input
            type="text"
            placeholder="ゲームタグ"
            className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 w-48 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            value={inputTag}
            onChange={onInputTagChange}
            onKeyPress={(e) => e.key === 'Enter' && onAddPlayer()}
          />
        </div>
        <button
          onClick={onAddPlayer}
          className="bg-blue-600 hover:bg-blue-500 px-8 py-2 rounded-lg font-bold transition shadow-lg shadow-blue-900/40 active:scale-95 text-white"
        >
          追加
        </button>
      </div>
    </section>
  );
};

export default PlayerInput;
