import React from 'react';
import { Trash2, Settings, Swords, Save, Database } from 'lucide-react';
import { ROLES } from '../constants';

const PlayerList = ({
  players,
  onGenerateTeams,
  onUpdateRatings,
  isUpdatingRatings,
  onLoadFromDB,
  isLoadingFromDB,
  onClear,
  onUpdatePlayer,
  onCheckAllRoles,
  onRemovePlayer,
  rateTolerance,
  onRateToleranceChange,
}) => {
  return (
    <section className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-xl overflow-x-auto">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
        <h2 className="text-lg font-semibold text-blue-400">プレイヤーリスト ({players.length})</h2>
        <div className="flex items-center gap-4">
          <button onClick={onLoadFromDB} disabled={isLoadingFromDB} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-bold transition shadow-md shadow-indigo-900/20 active:scale-[0.98] text-white text-sm whitespace-nowrap disabled:bg-slate-700 disabled:opacity-40">
            <Database size={16} className={isLoadingFromDB ? 'animate-spin' : ''}/>
            {isLoadingFromDB ? 'LOADING...' : 'DB LOAD'}
          </button>
          <button onClick={onUpdateRatings} disabled={isUpdatingRatings || players.length === 0} className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 px-4 py-2 rounded-lg font-bold transition shadow-md shadow-sky-900/20 active:scale-[0.98] text-white text-sm whitespace-nowrap disabled:bg-slate-700 disabled:opacity-40">
            <Save size={16} className={isUpdatingRatings ? 'animate-spin' : ''}/>
            {isUpdatingRatings ? 'SAVING...' : 'DB SAVE'}
          </button>
          <div className="flex items-center gap-2">
            <label htmlFor="rate-tolerance" className="text-xs text-slate-400 whitespace-nowrap">許容誤差:</label>
            <input
              type="number"
              id="rate-tolerance"
              step="50"
              value={rateTolerance}
              onChange={(e) => onRateToleranceChange(parseFloat(e.target.value) || 0)}
              className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <button
            onClick={onGenerateTeams}
            disabled={players.length < 2}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:opacity-40 px-6 py-2 rounded-lg font-bold transition shadow-md shadow-emerald-900/20 active:scale-[0.98] text-white text-sm whitespace-nowrap flex items-center gap-2"
          >
            <Swords size={16} />
            チーム分け実行
          </button>
          <button onClick={onClear} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
            <Trash2 size={12} /> 全削除
          </button>
        </div>
      </div>
      <table className="w-full text-left border-collapse min-w-[600px]">
        <thead>
          <tr className="border-b border-slate-700 text-slate-400 text-[10px] uppercase tracking-widest">
            <th className="py-3 px-1">Name</th>
            {ROLES.map(r => <th key={r} className="py-3 text-center">{r}</th>)}
            <th className="py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {players.map((p) => (
            <tr key={p.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
              <td className="py-4 font-medium max-w-[150px] truncate text-slate-200">{p.name}</td>
              {ROLES.map(role => (
                <td key={role} className="py-4 text-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={p[role]}
                      onChange={(e) => onUpdatePlayer(p.id, role, e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-600 transition-all cursor-pointer"
                    />
                    <input
                      type="number"
                      step="100"
                      className={`w-16 bg-slate-900/50 border border-slate-700/50 rounded px-2 py-1 text-center font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${p.isRegistered === false ? 'text-red-400' : ''}`}
                      value={p[`${role}_rate`] || ''}
                      onChange={(e) => onUpdatePlayer(p.id, `${role}_rate`, parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </td>
              ))}
              <td className="py-4 text-right">
                <div className="flex justify-end gap-1.5">
                  <button onClick={() => onCheckAllRoles(p.id)} className="p-2 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-all" title="全選択">
                    <Settings size={14} />
                  </button>
                  <button onClick={() => onRemovePlayer(p.id)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-all" title="削除">
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {players.length === 0 && (
            <tr><td colSpan={ROLES.length + 2} className="py-16 text-center text-slate-500 italic font-light tracking-wide">リストが空です。ロビーから取得するか手動で追加してください。</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
};

export default PlayerList;
