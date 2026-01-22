import React, { useState } from 'react';
import RankTable from './RankTable';
import {
  Users,
  UserPlus,
  Trash2,
  Copy,
  ExternalLink,
  Save,
  Upload,
  Settings,
  Github,
  Twitter,
  FolderOpen,
  RefreshCw,
  AlertCircle,
  Terminal,
  FileSearch,
  MapPin,
  Gamepad2,
  Bug,
  ListOrdered
} from 'lucide-react';
import { VERSION } from '../constants';

const DebugConsole = ({ logs, logsEndRef, onClear }) => (
  <div className="bg-black/80 font-mono text-xs p-4 rounded-xl border border-red-500/30 mb-6 shadow-xl max-h-60 overflow-y-auto">
    <div className="flex justify-between items-center mb-2 border-b border-red-900/50 pb-2">
      <span className="text-red-400 font-bold flex items-center gap-2"><Terminal size={12}/> DEBUG CONSOLE</span>
      <button onClick={onClear} className="text-slate-500 hover:text-slate-300">CLEAR</button>
    </div>
    <div className="space-y-1">
      {logs.length === 0 && <span className="text-slate-600 italic">No logs yet...</span>}
      {logs.map((log, i) => (
        <div key={i} className="flex gap-2 break-all">
          <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
          <span className={`font-bold shrink-0 w-16 ${
            log.type === 'SEND' ? 'text-blue-400' :
            log.type === 'RECEIVE' ? 'text-green-400' :
            log.type === 'ERROR' ? 'text-red-500' :
            log.type === 'TIMEOUT' ? 'text-amber-500' : 'text-slate-300'
          }`}>{log.type}</span>
          <span className="text-slate-300">{log.message}</span>
          {log.data && <span className="text-slate-500 truncate ml-2">{log.data}</span>}
        </div>
      ))}
      <div ref={logsEndRef} />
    </div>
  </div>
);

const LcuInfoDisplay = ({ lcuInfo }) => (
  <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-4 mb-6 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300 shadow-lg shadow-indigo-900/10">
    <div className="flex items-center gap-3">
      <div className="bg-indigo-500/20 p-2 rounded-full text-indigo-400">
        <RefreshCw size={16} />
      </div>
      <div>
        <div className="text-indigo-300 font-bold text-sm">LCU接続情報取得済み</div>
        <div className="text-[10px] text-slate-500 font-mono">Port: {lcuInfo.port} | Auth: {lcuInfo.password.substring(0,4)}***</div>
      </div>
    </div>
    <div className="flex items-center gap-2 text-[10px] text-amber-300 bg-amber-400/5 px-3 py-1.5 rounded-full border border-amber-500/20">
      <AlertCircle size={12} className="shrink-0" />
      <span>拡張機能を介してローカル通信を行います</span>
    </div>
  </div>
);

const Header = ({
  pathDisplay,
  onPathChange,
  onPickFolder,
  isFileSystemApiSupported,
  onReadLockfile,
  onFetchLobby,
  lcuInfo,
  isLoadingLobby,
  onExport,
  showDebug,
  onToggleDebug,
  debugLogs,
  logsEndRef,
  onClearLogs
}) => {
  const [showRankTable, setShowRankTable] = useState(false);

  return (
    <>
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-900/20">
            <span className="text-white font-bold"><Users size={32} /></span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">LoLチーム分けツール</h1>
            <p className="text-slate-400 text-sm">Balanced Team Maker for Custom Games</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 text-sm justify-center items-center">
           <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 px-3 py-1 rounded text-[10px] font-mono shadow-inner group">
             <MapPin size={12} className="text-indigo-400 shrink-0" />
             <input
                type="text"
                value={pathDisplay}
                onChange={onPathChange}
                className="bg-transparent border-none focus:outline-none text-slate-400 w-[150px] md:w-[250px] placeholder:italic"
                placeholder="Paste lockfile content here..."
             />
           </div>

           <button
             onClick={onPickFolder}
             className={`flex items-center gap-2 px-3 py-2 rounded transition shadow-sm border ${isFileSystemApiSupported ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-400 text-white' : 'bg-slate-700 border-slate-600 opacity-60'}`}
           >
             <FolderOpen size={16} /> フォルダ選択
           </button>
           <button
             onClick={onReadLockfile}
             className="flex items-center gap-2 px-3 py-2 rounded transition shadow-sm border bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white"
           >
             <FileSearch size={16} /> 設定読込
           </button>
           
           <button
             onClick={onFetchLobby}
             disabled={!lcuInfo || isLoadingLobby}
             className={`flex items-center gap-2 px-3 py-2 rounded transition shadow-sm border ${lcuInfo ? 'bg-amber-600 hover:bg-amber-500 border-amber-400 text-white animate-pulse-subtle' : 'bg-slate-800 border-slate-700 opacity-40 cursor-not-allowed text-slate-500'}`}
           >
             <Gamepad2 size={16} className={isLoadingLobby ? 'animate-spin' : ''} />
             {isLoadingLobby ? '取得中...' : 'ロビー取得'}
           </button>

           <button onClick={onExport} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded transition shadow-sm border border-slate-700">
             <Save size={16} /> SAVE
           </button>
           <button onClick={() => setShowRankTable(true)} className="flex items-center gap-2 bg-sky-800 hover:bg-sky-700 px-3 py-2 rounded transition shadow-sm border border-sky-700 text-sky-200">
             <ListOrdered size={16} /> レート表
           </button>
           <button
             onClick={onToggleDebug}
             className={`flex items-center gap-2 px-3 py-2 rounded transition shadow-sm border ${showDebug ? 'bg-red-900/50 border-red-500 text-red-200' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
             title="デバッグログを表示"
           >
             <Bug size={16} />
           </button>
        </div>
      </header>

      {showDebug && (
        <DebugConsole logs={debugLogs} logsEndRef={logsEndRef} onClear={onClearLogs} />
      )}

      {lcuInfo && <LcuInfoDisplay lcuInfo={lcuInfo} />}

      {showRankTable && <RankTable onClose={() => setShowRankTable(false)} />}
    </>
  );
};
