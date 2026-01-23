import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';

const Profile = ({ onClose, onSave, initialTeamsWebhookUrl, initialMatchesWebhookUrl, initialIsRatingUpdateEnabled }) => {
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState('');
  const [matchesWebhookUrl, setMatchesWebhookUrl] = useState('');
  const [isRatingUpdateEnabled, setIsRatingUpdateEnabled] = useState(true);

  useEffect(() => {
    setTeamsWebhookUrl(initialTeamsWebhookUrl || '');
    setMatchesWebhookUrl(initialMatchesWebhookUrl || '');
    setIsRatingUpdateEnabled(initialIsRatingUpdateEnabled ?? true);
  }, [initialTeamsWebhookUrl, initialMatchesWebhookUrl, initialIsRatingUpdateEnabled]);

  const handleSave = () => {
    onSave({
      teams: teamsWebhookUrl,
      matches: matchesWebhookUrl,
      isRatingUpdateEnabled: isRatingUpdateEnabled,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-xl w-full max-w-2xl mx-4 transform animate-in fade-in slide-in-from-bottom-10 duration-300">
        <div className="flex justify-between items-center p-6 border-b border-slate-800">
          <h2 className="text-2xl font-bold text-white">プロファイル設定</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 rounded-full">
            <X size={24} />
          </button>
        </div>
        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="teamsWebhookUrl" className="block text-sm font-medium text-slate-300 mb-2">
                チーム分け結果 Webhook URL
              </label>
              <input
                type="text"
                id="teamsWebhookUrl"
                value={teamsWebhookUrl}
                onChange={(e) => setTeamsWebhookUrl(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                placeholder="https://discord.com/api/webhooks/..."
              />
            </div>

            <div>
              <label htmlFor="matchesWebhookUrl" className="block text-sm font-medium text-slate-300 mb-2">
                戦績 Webhook URL
              </label>
              <input
                type="text"
                id="matchesWebhookUrl"
                value={matchesWebhookUrl}
                onChange={(e) => setMatchesWebhookUrl(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                placeholder="https://discord.com/api/webhooks/..."
              />
            </div>
            <div className="flex items-center justify-between pt-4">
              <div>
                <label htmlFor="enableRatingUpdate" className="block text-sm font-medium text-slate-300">
                  戦績アップロード時にレートを更新する
                </label>
                <p className="text-xs text-slate-500">
                  オフにすると、試合結果を記録するだけでレートは変動しません。
                </p>
              </div>
              <label htmlFor="enableRatingUpdate" className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="enableRatingUpdate"
                  className="sr-only peer"
                  checked={isRatingUpdateEnabled}
                  onChange={(e) => setIsRatingUpdateEnabled(e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-focus:ring-4 peer-focus:ring-indigo-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          <div className="flex items-start gap-3 mt-4 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg text-yellow-200">
            <AlertTriangle size={20} className="shrink-0 mt-0.5" />
            <p className="text-xs">
              WebhookのURLは機密情報です。第三者に漏洩しないよう、このツールの利用者以外には共有しないでください。URLが漏洩すると、誰でもあなたのDiscordチャンネルにメッセージを投稿できてしまいます。
            </p>
          </div>
        </div>
        <div className="bg-slate-900/50 px-8 py-5 flex justify-end gap-4 border-t border-slate-800 rounded-b-2xl">
          <button onClick={onClose} className="px-6 py-2.5 rounded-lg text-slate-300 hover:bg-slate-700 transition font-semibold">
            キャンセル
          </button>
          <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition font-semibold shadow-md shadow-indigo-900/20">
            <Save size={16} />
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
