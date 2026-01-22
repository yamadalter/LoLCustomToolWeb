import React from 'react';
import { RANK_DATA } from '../constants';
import { X } from 'lucide-react';

const RankTable = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-slate-800 text-slate-100 rounded-lg shadow-xl p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors"
          aria-label="閉じる"
        >
          <X size={24} />
        </button>
        <h2 className="text-2xl font-bold mb-4 text-center text-sky-400">ランク・レート対応表</h2>
        <div className="overflow-y-auto max-h-[70vh]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-800">
              <tr>
                <th className="border-b border-slate-600 p-3">ランク</th>
                <th className="border-b border-slate-600 p-3 text-right">レート</th>
              </tr>
            </thead>
            <tbody>
              {RANK_DATA.map((rank, index) => (
                <tr key={index} className="hover:bg-slate-700">
                  <td className="border-b border-slate-700 p-3">{rank.name}</td>
                  <td className="border-b border-slate-700 p-3 text-right font-mono">{rank.val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-4 text-center">
          このレートは内部計算用の初期値です。
        </p>
      </div>
    </div>
  );
};

export default RankTable;
