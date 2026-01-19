import React from 'react';
import { DDRAGON_URL, DDRAGON_VERSION } from '../constants';

const MatchDetails = ({ match }) => {
  if (!match) return null;

  const blueTeam = match.participants.filter(p => p.teamId === 100);
  const redTeam = match.participants.filter(p => p.teamId === 200);

  const getTeamStats = (team) => {
    return team.reduce((acc, p) => {
      acc.kills += p.stats.kills;
      acc.deaths += p.stats.deaths;
      acc.assists += p.stats.assists;
      return acc;
    }, { kills: 0, deaths: 0, assists: 0 });
  };

  const blueTeamStats = getTeamStats(blueTeam);
  const redTeamStats = getTeamStats(redTeam);

  const blueTeamWon = blueTeam[0]?.stats.win;

  const PlayerRow = ({ participant }) => {
    const champName = participant.championName || 'Unknown';
    const items = [
      participant.stats.item0,
      participant.stats.item1,
      participant.stats.item2,
      participant.stats.item3,
      participant.stats.item4,
      participant.stats.item5,
      participant.stats.item6 // Trinket
    ];
    
    const participantIdentity = match.participantIdentities?.find(p => p.participantId === participant.participantId);
    const playerName = participantIdentity?.player?.gameName || participant.summonerName || 'Unknown Player';

    return (
      <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors">
        <img
          src={`${DDRAGON_URL}/img/champion/${champName}.png`}
          alt={champName}
          className="w-10 h-10 rounded-md border-2 border-slate-700"
          onError={(e) => { e.target.src = `https://via.placeholder.com/40`; }} // Fallback
        />
        <div className="flex-grow w-32">
          <p className="font-semibold text-sm truncate text-slate-200">{playerName}</p>
          <p className="text-xs text-slate-400 font-mono">{`${participant.stats.kills} / ${participant.stats.deaths} / ${participant.stats.assists}`}</p>
        </div>
        <div className="flex items-center gap-1">
          {items.map((itemId, i) => (
            <div key={i} className="w-7 h-7 bg-slate-900 rounded border border-slate-700">
              {itemId > 0 && (
                <img
                  src={`${DDRAGON_URL}/img/item/${itemId}.png`}
                  alt={`Item ${itemId}`}
                  className="w-full h-full rounded"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-4 space-y-6 bg-slate-900/50 p-4 rounded-lg border border-slate-700 animate-in fade-in">
      {/* Team Headers */}
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className={`p-2 rounded-t-lg ${blueTeamWon ? 'bg-blue-800' : 'bg-slate-700'}`}>
          <h3 className={`text-lg font-bold ${blueTeamWon ? 'text-blue-300' : 'text-slate-300'}`}>
            {blueTeamWon ? '勝利' : '敗北'} (ブルーチーム)
          </h3>
          <p className="font-mono text-sm text-slate-300">{`${blueTeamStats.kills} / ${blueTeamStats.deaths} / ${blueTeamStats.assists}`}</p>
        </div>
        <div className={`p-2 rounded-t-lg ${!blueTeamWon ? 'bg-red-800' : 'bg-slate-700'}`}>
          <h3 className={`text-lg font-bold ${!blueTeamWon ? 'text-red-300' : 'text-slate-300'}`}>
            {!blueTeamWon ? '勝利' : '敗北'} (レッドチーム)
          </h3>
          <p className="font-mono text-sm text-slate-300">{`${redTeamStats.kills} / ${redTeamStats.deaths} / ${redTeamStats.assists}`}</p>
        </div>
      </div>

      {/* Player Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          {blueTeam.map(p => <PlayerRow key={p.participantId} participant={p} />)}
        </div>
        <div className="space-y-2">
          {redTeam.map(p => <PlayerRow key={p.participantId} participant={p} />)}
        </div>
      </div>
    </div>
  );
};

const MatchHistory = ({
  lcuInfo,
  isLoading,
  isUploading,
  onFetch,
  onUpload,
  matches,
  selectedMatchId,
  onSelectMatch,
  currentUserPuuid,
  selectedMatch,
  championMap,
}) => {
  return (
    <section className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-xl">
      <h2 className="text-lg font-semibold mb-4 text-blue-400">対戦履歴</h2>
      <div className="space-y-4">
        <div className="flex gap-4">
          <button
            onClick={onFetch}
            disabled={!lcuInfo || isLoading}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:opacity-40 py-3 rounded-xl font-bold transition shadow-lg shadow-purple-900/20 active:scale-[0.98] text-white"
          >
            {isLoading ? '取得中...' : '対戦履歴を取得'}
          </button>
          <button
            onClick={() => onUpload(selectedMatch)}
            disabled={!selectedMatch || isUploading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:opacity-40 py-3 rounded-xl font-bold transition shadow-lg shadow-blue-900/20 active:scale-[0.98] text-white"
          >
            {isUploading ? 'アップロード中...' : 'DBへアップロード'}
          </button>
        </div>
        <select
          value={selectedMatchId}
          onChange={(e) => onSelectMatch(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          disabled={matches.length === 0 || Object.keys(championMap).length === 0}
        >
          <option value="">試合を選択...</option>
          {matches.map(match => {
            const playerParticipantIdentity = match.participantIdentities?.find(p => p.player.puuid === currentUserPuuid);
            const participant = playerParticipantIdentity 
              ? match.participants.find(p => p.participantId === playerParticipantIdentity.participantId)
              : match.participants[0];
            
            if (!participant) return null;

            const stats = participant.stats;
            const outcome = stats.win ? 'Victory' : 'Defeat';
            const kda = `${stats.kills}/${stats.deaths}/${stats.assists}`;
            const championName = participant.championName || 'Unknown';
            return (
              <option key={match.gameId} value={match.gameId}>
                {new Date(match.gameCreation).toLocaleString()} - {championName} - {outcome} ({kda})
              </option>
            );
          })}
        </select>
        {selectedMatch && <MatchDetails match={selectedMatch} />}
      </div>
    </section>
  );
};

export default MatchHistory;

