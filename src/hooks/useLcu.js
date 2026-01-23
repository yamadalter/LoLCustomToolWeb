import { useState, useEffect } from 'react';

const isFileSystemApiSupported = typeof window.showDirectoryPicker === 'function';

const parseLockfile = (text) => {
  const parts = text.split(':');
  if (parts.length >= 5) {
    return {
      name: parts[0],
      pid: parts[1],
      port: parts[2],
      password: parts[3],
      protocol: parts[4]
    };
  }
  return null;
};

export function useLcu(addLog) {
  const [lcuInfo, setLcuInfo] = useState(null);
  const [dirHandle, setDirHandle] = useState(null);
  const [pathDisplay, setPathDisplay] = useState('C:\\Riot Games\\League of Legends');

  // Load saved path from localStorage
  useEffect(() => {
    const savedPath = localStorage.getItem('lol_custom_path');
    if (savedPath) setPathDisplay(savedPath);
  }, []);

  // Save path to localStorage
  useEffect(() => {
    localStorage.setItem('lol_custom_path', pathDisplay);
  }, [pathDisplay]);

  const handlePickFolder = async () => {
    if (!isFileSystemApiSupported) {
      alert("お使いのブラウザはフォルダ選択に対応していません。");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({
        mode: 'read',
        id: 'lol-installation-dir',
        startIn: 'documents'
      });
      setDirHandle(handle);
      setPathDisplay(handle.name);
    } catch (err) {
      if (err.name !== 'AbortError') {
        addLog('ERROR', 'フォルダの選択に失敗しました。', err);
        alert("フォルダの選択に失敗しました。");
      }
    }
  };

  const handleReadLockfile = async () => {
    // Try parsing manual input first
    const manualInfo = parseLockfile(pathDisplay);
    if (manualInfo) {
      setLcuInfo(manualInfo);
      addLog('INFO', 'Lockfile情報を手動入力から読み込みました', manualInfo);
      return;
    }

    if (!dirHandle) {
      alert("LoLフォルダを選択するか、lockfileの内容を貼り付けてください。");
      return;
    }

    try {
      let lockfileHandle = null;
      try {
        lockfileHandle = await dirHandle.getFileHandle('lockfile');
      } catch (e) {
        // If not in root, try 'League of Legends' subdirectory
        try {
          const gameDir = await dirHandle.getDirectoryHandle('League of Legends');
          lockfileHandle = await gameDir.getFileHandle('lockfile');
        } catch (innerE) {
          throw new Error("lockfileが見つかりませんでした。");
        }
      }

      const file = await lockfileHandle.getFile();
      const content = await file.text();
      const info = parseLockfile(content);
      if (info) {
        setLcuInfo(info);
        addLog('INFO', 'Lockfileをファイルシステムから読み込みました', info);
      } else {
        throw new Error("lockfileの解析に失敗しました。");
      }
    } catch (err) {
      addLog('ERROR', 'Lockfile読み込み失敗', err.message);
      alert(err.message || "読み込みに失敗しました。");
    }
  };

  return {
    lcuInfo,
    pathDisplay,
    setPathDisplay,
    isFileSystemApiSupported,
    handlePickFolder,
    handleReadLockfile,
  };
}
