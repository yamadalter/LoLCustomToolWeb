import React from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { RANK_DATA } from '../constants';

const TeamResults = ({ result, onCopy, statusMsg }) => {
  const getAverageRank = (score) => {
    const avg = score / 5;
    const closest = RANK_DATA.reduce((prev, curr) =>
      Math.abs(curr.val - avg) < Math.abs(prev.val - avg) ? curr : prev
    );
    return closest.name;
  };

  return (
    <section className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-xl">
      <h2 className="text-lg font-semibold mb-4 text-blue-400">チーム分け結果</h2>

      {!result && (
        <div className="h-full flex items-center justify-center text-center text-slate-500 italic py-16">
          プレイヤーリストの上部にあるボタンからチーム分けを実行してください。
        </div>
      )}

      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-700 pb-3">
            <span>MATCH PREVIEW</span>
            <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20 font-mono">Diff: {result.diff}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2.5">
              <p className="text-[10px] font-bold text-blue-400 flex items-center justify-between px-1">
                <span>TEAM 1 <span className="text-slate-500 font-normal ml-1">({getAverageRank(result.score1)})</span></span>
                <span className="font-mono">{result.score1}</span>
              </p>
              {result.team1.map((p, i) => (
                <div key={i} className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-700/50 shadow-inner group">
                  <span className="text-slate-500 font-mono text-[9px] mr-2 inline-block w-6 uppercase group-hover:text-blue-400 transition-colors">{p.role}</span>
                  <span className="font-medium truncate block text-xs">{p.name}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2.5">
              <p className="text-[10px] font-bold text-red-400 flex items-center justify-between px-1">
                <span>TEAM 2 <span className="text-slate-500 font-normal ml-1">({getAverageRank(result.score2)})</span></span>
                <span className="font-mono">{result.score2}</span>
              </p>
              {result.team2.map((p, i) => (
                <div key={i} className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-700/50 shadow-inner group">
                  <span className="text-slate-500 font-mono text-[9px] mr-2 inline-block w-6 uppercase group-hover:text-red-400 transition-colors">{p.role}</span>
                  <span className="font-medium truncate block text-xs">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-6 space-y-3">
            <button onClick={() => onCopy('standard')} className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] text-white border border-slate-600 shadow-sm"><Copy size={14} /> 結果コピー</button>
            <button onClick={() => onCopy('opgg')} className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] text-blue-300 border border-slate-600 shadow-sm"><ExternalLink size={14} /> OPGGコピー</button>
            {statusMsg && <p className="text-center text-[10px] text-emerald-400 font-medium animate-pulse">{statusMsg}</p>}
          </div>
        </div>
      )}
    </section>
  );
};

export default TeamResults;
