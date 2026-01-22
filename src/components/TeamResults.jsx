import React from 'react';
import { Copy, ExternalLink, Loader2, Send } from 'lucide-react';

const TeamResults = ({ result, teams, onCopy, statusMsg, isGeneratingTeams, generateTeamsError, onSendToDiscord, teamsWebhookUrl }) => {
  const displayData = teams || result;
  const scoreA = teams?.scoreA || result?.score1;
  const scoreB = teams?.scoreB || result?.score2;
  const teamA = teams?.teamA || result?.team1;
  const teamB = teams?.teamB || result?.team2;

  // レート差を計算
  const diff = (scoreA !== undefined && scoreB !== undefined) ? Math.abs(scoreA - scoreB).toFixed(2) : (result?.diff || 'N/A');

  return (
    <section className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-xl min-h-[300px] flex flex-col">
      <h2 className="text-lg font-semibold mb-4 text-blue-400">チーム分け結果</h2>

      {isGeneratingTeams && (
        <div className="flex-grow flex items-center justify-center text-center text-slate-400">
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={32} className="animate-spin" />
            <p>レートを計算してチーム分けを実行中...</p>
          </div>
        </div>
      )}

      {!isGeneratingTeams && generateTeamsError && (
        <div className="flex-grow flex items-center justify-center text-center text-red-400 bg-red-500/10 rounded-lg p-4">
          <p>エラー: {generateTeamsError}</p>
        </div>
      )}

      {!isGeneratingTeams && !generateTeamsError && !displayData && (
        <div className="flex-grow flex items-center justify-center text-center text-slate-500 italic">
          プレイヤーを選択して「レートでチーム分け」ボタンを押してください。
        </div>
      )}

      {!isGeneratingTeams && !generateTeamsError && displayData && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-700 pb-3">
            <span>MATCH PREVIEW</span>
            <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20 font-mono">
              Diff: {diff}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* TEAM A */}
            <div className="space-y-2.5">
              <p className="text-[10px] font-bold text-blue-400 flex items-center justify-between px-1">
                <span>TEAM 1</span>
                <span className="font-mono">{scoreA}</span>
              </p>
              {teamA.map((p, i) => (
                <div key={p.puuid || i} className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-700/50 shadow-inner group">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-700/50 px-1.5 py-0.5 rounded w-12 text-center">
                        {p.assignedRole}
                      </span>
                      <span className="font-medium truncate block text-xs">{p.displayName || p.name}</span>
                    </div>
                    <span className="text-slate-500 font-mono text-[9px] group-hover:text-blue-400 transition-colors">
                      {p.mu?.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {/* TEAM B */}
            <div className="space-y-2.5">
              <p className="text-[10px] font-bold text-red-400 flex items-center justify-between px-1">
                <span>TEAM 2</span>
                <span className="font-mono">{scoreB}</span>
              </p>
              {teamB.map((p, i) => (
                <div key={p.puuid || i} className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-700/50 shadow-inner group">
                   <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-700/50 px-1.5 py-0.5 rounded w-12 text-center">
                        {p.assignedRole}
                      </span>
                      <span className="font-medium truncate block text-xs">{p.displayName || p.name}</span>
                    </div>
                    <span className="text-slate-500 font-mono text-[9px] group-hover:text-red-400 transition-colors">
                      {p.mu?.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-6 space-y-3">
            <button onClick={() => onCopy('standard')} className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] text-white border border-slate-600 shadow-sm"><Copy size={14} /> 結果コピー</button>
            <button onClick={() => onCopy('opgg')} className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] text-blue-300 border border-slate-600 shadow-sm"><ExternalLink size={14} /> OPGGコピー</button>
            <button
              onClick={onSendToDiscord}
              disabled={!teamsWebhookUrl}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 py-3 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] text-white border border-indigo-500 shadow-sm disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
              title={!teamsWebhookUrl ? "プロファイル設定でWebhook URLを設定してください" : "Discordに結果を送信"}
            >
              <Send size={14} />
              Discordへ送信
            </button>
            {statusMsg && <p className="text-center text-[10px] text-emerald-400 font-medium animate-pulse">{statusMsg}</p>}
          </div>
        </div>
      )}
    </section>
  );
};

export default TeamResults;
