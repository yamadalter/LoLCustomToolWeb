import React, { useState, useEffect, useCallback } from 'react';
import { Twitter, Github } from 'lucide-react';
import Header from './components/Header';
import PlayerInput from './components/PlayerInput';
import PlayerList from './components/PlayerList';
import TeamResults from './components/TeamResults';
import MatchHistory from './components/MatchHistory';
import Profile from './components/Profile';
import './App.css';

// Custom Hooks
import { useLogger } from './hooks/useLogger';
import { useSettings } from './hooks/useSettings';
import { useLcu } from './hooks/useLcu';
import { usePlayers } from './hooks/usePlayers';
import { useTeamGenerator } from './hooks/useTeamGenerator';
import { useMatchHistory } from './hooks/useMatchHistory';


const VERSION = "v2.0.0-β.1";

function App() {
  const [showDebug, setShowDebug] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [isLoadingLobby, setIsLoadingLobby] = useState(false);

  // --- Custom Hooks ---
  const { logs, addLog, logsEndRef, clearLogs } = useLogger(showDebug);
  
  const { 
    showProfile, setShowProfile, teamsWebhookUrl, matchesWebhookUrl, 
    isRatingUpdateEnabled, handleSaveProfile, initialSettings
  } = useSettings();
  
  const { 
    lcuInfo, pathDisplay, setPathDisplay, isFileSystemApiSupported, 
    handlePickFolder, handleReadLockfile 
  } = useLcu(addLog);
  
  const {
    players, setPlayers, inputName, setInputName, inputTag, setInputTag,
    isUpdatingRatings, isLoadingFromDB, removePlayer, updatePlayer, checkAllRoles,
    clearPlayers, handleAddPlayerByRiotId, handleUpdateRatings, handleLoadFromDB,
    processLobbyData, processSearchedPlayerData, statusMsg: playerStatus
  } = usePlayers(addLog, lcuInfo);
  
  const {
    teams, isGeneratingTeams, generateTeamsError, rateTolerance, setRateTolerance,
    handleGenerateTeams, handleSendTeamsToDiscord, copyResults, statusMsg: teamGeneratorStatus
  } = useTeamGenerator(players, teamsWebhookUrl, addLog);

  const {
    matches, selectedMatchId, setSelectedMatchId, isLoadingMatches, isUploading,
    currentUserPuuid, championMap, ddragonUrl, handleFetchMatches, processMatchHistoryData,
    handleUploadMatch, handleSendMatchToDiscord, selectedMatch, statusMsg: matchHistoryStatus
  } = useMatchHistory(lcuInfo, matchesWebhookUrl, isRatingUpdateEnabled, addLog, players, setPlayers);

  // --- Event Handling for Chrome Extension ---
  const handleMessage = useCallback(async (event) => {
    if (!event.data || !event.data.type) return;
    
    addLog('RECEIVE', `メッセージを受信しました: ${event.data.type}`, event.data);
  
    switch (event.data.type) {
      case 'LCU_LOBBY_DATA_RESPONSE':
        setIsLoadingLobby(false);
        if (event.data.success) {
          processLobbyData(event.data.data);
        } else {
          const errorMsg = event.data.error || 'ロビー情報の取得に失敗しました。';
          setStatusMsg(errorMsg);
          addLog('ERROR', errorMsg);
          alert(errorMsg);
        }
        break;

      case 'LCU_SEARCH_PLAYER_RESPONSE':
        setIsLoadingLobby(false); // Reuse loading state
        if (event.data.success) {
          processSearchedPlayerData(event.data.data);
        } else {
          const errorMsg = event.data.error || 'プレイヤーの検索に失敗しました。';
          setStatusMsg(errorMsg);
          addLog('ERROR', errorMsg);
          alert(errorMsg);
        }
        break;

      case 'LCU_MATCH_HISTORY_DATA_RESPONSE':
        if (event.data.success) {
            processMatchHistoryData(event.data.data);
        } else {
            const errorMsg = event.data.error || '対戦履歴の取得に失敗しました。';
            setStatusMsg(errorMsg);
            addLog('ERROR', errorMsg);
            alert(errorMsg);
        }
        break;
      
      case 'LCU_ERROR':
        setIsLoadingLobby(false);
        const errorMsg = event.data.error || '拡張機能からエラーが返されました。';
        setStatusMsg(errorMsg);
        addLog('ERROR', 'LCU_ERROR', event.data);
        alert(errorMsg);
        break;

      default:
        // Other message types can be ignored or logged
        break;
    }
  }, [addLog, processLobbyData, processSearchedPlayerData, processMatchHistoryData]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);
  
  // --- LCU Request Trigger ---
  const fetchLobbyFromExtension = useCallback(() => {
    if (!lcuInfo) return;
    setIsLoadingLobby(true);
    setStatusMsg('拡張機能経由でロビー情報を取得中...');
    
    const messageData = {
      type: 'FETCH_LCU_LOBBY_REQUEST',
      port: lcuInfo.port,
      password: lcuInfo.password,
      protocol: lcuInfo.protocol || 'https'
    };
    
    addLog('SEND', '拡張機能へリクエスト送信', messageData);
    window.postMessage(messageData, "*");

    setTimeout(() => {
      setIsLoadingLobby(prev => {
        if (prev) {
          addLog('TIMEOUT', '拡張機能からの応答がありません。');
          setStatusMsg('タイムアウト: 拡張機能からの応答がありません。');
          return false;
        }
        return prev;
      });
    }, 5000);
  }, [lcuInfo, addLog]);


  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-screen-3xl mx-auto">
        <Header
          pathDisplay={pathDisplay}
          onPathChange={(e) => setPathDisplay(e.target.value)}
          onPickFolder={handlePickFolder}
          isFileSystemApiSupported={isFileSystemApiSupported}
          onReadLockfile={handleReadLockfile}
          onFetchLobby={fetchLobbyFromExtension}
          lcuInfo={lcuInfo}
          isLoadingLobby={isLoadingLobby}
          showDebug={showDebug}
          onToggleDebug={() => setShowDebug(!showDebug)}
          debugLogs={logs}
          logsEndRef={logsEndRef}
          onClearLogs={clearLogs}
          onToggleProfile={() => setShowProfile(true)}
        />

        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          <div className="md:col-span-2 space-y-6">
            <PlayerInput
              inputName={inputName}
              onInputNameChange={(e) => setInputName(e.target.value)}
              inputTag={inputTag}
              onInputTagChange={(e) => setInputTag(e.target.value)}
              onAddPlayer={handleAddPlayerByRiotId}
            />

            <TeamResults
              teams={teams}
              isGeneratingTeams={isGeneratingTeams}
              generateTeamsError={generateTeamsError}
              onCopy={copyResults}
              statusMsg={teamGeneratorStatus || playerStatus || statusMsg}
              onSendToDiscord={handleSendTeamsToDiscord}
              teamsWebhookUrl={teamsWebhookUrl}
            />

            <PlayerList
              players={players}
              onGenerateTeams={handleGenerateTeams}
              onUpdateRatings={handleUpdateRatings}
              isUpdatingRatings={isUpdatingRatings}
              onLoadFromDB={handleLoadFromDB}
              isLoadingFromDB={isLoadingFromDB}
              onClear={clearPlayers}
              onUpdatePlayer={updatePlayer}
              onCheckAllRoles={checkAllRoles}
              onRemovePlayer={removePlayer}
              rateTolerance={rateTolerance}
              onRateToleranceChange={setRateTolerance}
            />
          </div>

          <div className="md:col-span-3 space-y-6">
            <MatchHistory
              lcuInfo={lcuInfo}
              isLoading={isLoadingMatches}
              isUploading={isUploading}
              onFetch={handleFetchMatches}
              onUpload={handleUploadMatch}
              matches={matches}
              selectedMatchId={selectedMatchId}
              onSelectMatch={setSelectedMatchId}
              currentUserPuuid={currentUserPuuid}
              selectedMatch={selectedMatch}
              championMap={championMap}
              ddragonUrl={ddragonUrl}
              onSendMatchToDiscord={handleSendMatchToDiscord}
              matchesWebhookUrl={matchesWebhookUrl}
              statusMsg={matchHistoryStatus}
            />
          </div>
        </div>

        {showProfile && (
          <Profile
            onClose={() => setShowProfile(false)}
            onSave={(settings) => {
              handleSaveProfile(settings);
              setStatusMsg('プロファイル設定を保存しました！');
              setTimeout(() => setStatusMsg(''), 3000);
            }}
            initialTeamsWebhookUrl={initialSettings.teams}
            initialMatchesWebhookUrl={initialSettings.matches}
            initialIsRatingUpdateEnabled={initialSettings.isRatingUpdateEnabled}
          />
        )}

        <footer className="flex flex-col items-center gap-4 text-slate-500 pt-8 mt-8 border-t border-slate-800">
          <div className="flex gap-6">
            <a href="https://x.com/yamadalter" target="_blank" rel="noreferrer" className="hover:text-blue-400 transition-colors"><Twitter size={20} /></a>
            <a href="https://github.com/yamadalter/LOLCustomTool" target="_blank" rel="noreferrer" className="hover:text-white transition-colors"><Github size={20} /></a>
          </div>
          <div className="text-[10px] text-center space-y-1 font-mono tracking-tight opacity-50">
            <p>VERSION {VERSION}</p>
            <p>© 2026 Produced by yamadalter</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
