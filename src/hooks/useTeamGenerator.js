import { useState } from 'react';
import { ROLES, ROLE_MAP } from '../constants';

// --- Helper Functions ---

function* combinations(arr, n) {
  if (n === 0) {
    yield [];
    return;
  }
  for (let i = 0; i <= arr.length - n; i++) {
    for (const rest of combinations(arr.slice(i + 1), n - 1)) {
      yield [arr[i], ...rest];
    }
  }
}

function* product(...arrays) {
  if (arrays.length === 0) {
    yield [];
    return;
  }
  const [head, ...tail] = arrays;
  for (const h of head) {
    for (const t of product(...tail)) {
      yield [h, ...t];
    }
  }
}

const createTeams = (players) => {
  const validTeams = [];
  for (const teamA of combinations(players, 5)) {
    const teamB = players.filter(p => !teamA.includes(p));
    const teamACanCover = ROLES.every(role => teamA.some(p => p[role]));
    const teamBCanCover = ROLES.every(role => teamB.some(p => p[role]));
    if (teamACanCover && teamBCanCover) {
      validTeams.push([teamA, teamB]);
    }
  }
  return validTeams;
};

const assignRoles = (team) => {
  const assignments = [];
  const rolePlayerOptions = ROLES.map(role => team.filter(p => p[role]));
  if (rolePlayerOptions.some(options => options.length === 0)) return [];

  for (const assignment of product(...rolePlayerOptions)) {
    if (new Set(assignment).size === 5) {
      assignments.push(assignment);
    }
  }
  return assignments;
};

const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};


// --- The Hook ---

export function useTeamGenerator(players, teamsWebhookUrl, addLog) {
  const [teams, setTeams] = useState(null);
  const [isGeneratingTeams, setIsGeneratingTeams] = useState(false);
  const [generateTeamsError, setGenerateTeamsError] = useState(null);
  const [rateTolerance, setRateTolerance] = useState(500);
  const [statusMsg, setStatusMsg] = useState('');


  const handleGenerateTeams = async () => {
    setTeams(null);
    setGenerateTeamsError(null);
    setIsGeneratingTeams(true);
    addLog('INFO', '組み合わせベースのチーム分けを開始します', { playerCount: players.length, rateTolerance });

    let activePlayers = players.filter(p => ROLES.some(role => p[role]));
    if (activePlayers.length !== 10) {
      const errorMsg = "プレイヤー人数は10人にしてください。";
      setGenerateTeamsError(errorMsg);
      setIsGeneratingTeams(false);
      alert(errorMsg);
      addLog('ERROR', errorMsg, { playerCount: activePlayers.length });
      return;
    }

    activePlayers = shuffleArray(activePlayers);
    await new Promise(resolve => setTimeout(resolve, 50)); // Allow UI to update

    try {
      const possibleTeamCombinations = createTeams(activePlayers);
      if (possibleTeamCombinations.length === 0) {
        throw new Error("全ロールをカバーできるチームの組み合わせが見つかりませんでした。");
      }

      let bestArrangement = null;
      let minDifference = Infinity;

      searchLoop: for (const [teamA, teamB] of possibleTeamCombinations) {
        const assignmentsA = shuffleArray(assignRoles(teamA));
        const assignmentsB = shuffleArray(assignRoles(teamB));
        if (assignmentsA.length === 0 || assignmentsB.length === 0) continue;

        for (const assignedA of assignmentsA) {
          for (const assignedB of assignmentsB) {
            const scoreA = assignedA.reduce((acc, p, i) => acc + (p[`${ROLES[i]}_rate`] || 1500), 0);
            const scoreB = assignedB.reduce((acc, p, i) => acc + (p[`${ROLES[i]}_rate`] || 1500), 0);
            const diff = Math.abs(scoreA - scoreB);

            if (diff < minDifference) {
              minDifference = diff;
              bestArrangement = { teamA: assignedA, teamB: assignedB, scoreA, scoreB };
              if (minDifference <= rateTolerance) {
                addLog('INFO', `許容誤差内の組み合わせを発見。計算を終了します。 (差: ${minDifference})`);
                break searchLoop;
              }
            }
          }
        }
      }

      if (bestArrangement) {
        const formatTeam = (assignedTeam) => assignedTeam.map((player, index) => ({
          ...player,
          displayName: `${player.name}#${player.tag}`,
          assignedRole: ROLES[index],
          mu: player[`${ROLES[index]}_rate`] || 1500,
        }));
        
        const finalTeams = {
          teamA: formatTeam(bestArrangement.teamA),
          teamB: formatTeam(bestArrangement.teamB),
          scoreA: bestArrangement.scoreA.toFixed(2),
          scoreB: bestArrangement.scoreB.toFixed(2)
        };
        
        setTeams(finalTeams);
        addLog('SUCCESS', 'チーム分け成功', { finalTeams, minDifference });
      } else {
        throw new Error('チーム分けに失敗しました。適切な組み合わせが見つかりません。');
      }
    } catch (error) {
      const errorMsg = error.message || '不明なエラーが発生しました。';
      setGenerateTeamsError(errorMsg);
      addLog('ERROR', `チーム分け失敗: ${errorMsg}`);
      alert(`チーム分けに失敗しました: ${errorMsg}`);
    } finally {
      setIsGeneratingTeams(false);
    }
  };

  const handleSendTeamsToDiscord = async () => {
    if (!teams || !teamsWebhookUrl) {
        setStatusMsg('チームデータまたはWebhook URLがありません。');
        setTimeout(() => setStatusMsg(''), 3000);
        return;
    }
    setStatusMsg('Discordに送信中...');
    const { teamA, teamB, scoreA, scoreB } = teams;
    const diff = Math.abs(scoreA - scoreB).toFixed(2);
    const getOpgg = (team) => `https://www.op.gg/multisearch/jp?summoners=${team.map(p => encodeURIComponent(p.displayName)).join('%2C')}`;

    const embed = {
      title: 'カスタムゲーム チーム分け結果',
      color: 3447003,
      fields: [
        { name: `🔵 チーム1 (合計レート: ${Math.trunc(scoreA)})`, value: teamA.map(p => `> **${ROLE_MAP[p.assignedRole]}**: ${p.displayName.split('#')[0]} (${p.mu.toFixed(0)})`).join('\n') + `\n\n**[OPGG](${getOpgg(teamA)})**\n`, inline: true },
        { name: `🔴 チーム2 (合計レート: ${Math.trunc(scoreB)})`, value: teamB.map(p => `> **${ROLE_MAP[p.assignedRole]}**: ${p.displayName.split('#')[0]} (${p.mu.toFixed(0)})`).join('\n') + `\n\n**[OPGG](${getOpgg(teamB)})**\n`, inline: true },
        { name: '📈 レート差', value: `**${diff}**`, inline: false }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'LoLチーム分けツール' },
    };

    try {
      const response = await fetch(teamsWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'LoLチーム分けツール', embeds: [embed] }),
      });
      if (!response.ok) throw new Error(`Discord APIエラー: ${response.status} ${await response.text()}`);
      setStatusMsg('Discordに送信しました！');
      addLog('SUCCESS', 'Discord Webhook送信成功');
    } catch (error) {
      setStatusMsg('Discordへの送信に失敗しました。');
      addLog('ERROR', `Discord Webhook送信失敗: ${error.message}`);
      alert(`Discordへの送信に失敗しました: ${error.message}`);
    } finally {
      setTimeout(() => setStatusMsg(''), 3000);
    }
  };

  const copyResults = (type = 'standard') => {
    if (!teams) return;
    const { teamA, teamB, scoreA, scoreB } = teams;
    let text = ` \nチーム1 (合計レート: ${scoreA})\n` +
               teamA.map(p => `${ROLE_MAP[p.assignedRole]}:${p.displayName.split('#')[0]}`).join('\n') + 
               `\n\nチーム2 (合計レート: ${scoreB})\n` +
               teamB.map(p => `${ROLE_MAP[p.assignedRole]}:${p.displayName.split('#')[0]}`).join('\n');
    
    if (type === 'opgg') {
      const getOpgg = (team) => `https://www.op.gg/multisearch/jp?summoners=${team.map(p => encodeURIComponent(p.displayName)).join('%2C')}`;
      text += `\n\nTeam1 OPGG: ${getOpgg(teamA)}\nTeam2 OPGG: ${getOpgg(teamB)}`;
    }

    navigator.clipboard.writeText(text).then(() => {
      setStatusMsg('コピーしました！');
      setTimeout(() => setStatusMsg(''), 3000);
    });
  };

  return {
    teams,
    isGeneratingTeams,
    generateTeamsError,
    statusMsg,
    rateTolerance,
    setRateTolerance,
    handleGenerateTeams,
    handleSendTeamsToDiscord,
    copyResults,
  };
}
