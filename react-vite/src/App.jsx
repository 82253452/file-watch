import React, {useState, useEffect, useRef} from 'react';
import Neutralino from '@neutralinojs/lib';
import './App.css';
import {createClient} from "@clickhouse/client-web";

const clickhouseClient = createClient({
    url: 'http://localhost:5101/',
    username: 'root',
    password: 'root',
    database:'biss'
});

const FileWatcherApp = () => {
    const [watchedDirs, setWatchedDirs] = useState([]);
    const [logs, setLogs] = useState([]);
    const [systemInfo, setSystemInfo] = useState({});
    const [isWatching, setIsWatching] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);
    const [selectedDir, setSelectedDir] = useState('');


    useEffect(() => {
        loadSavedData();
        fetchSystemInfo();
        callRustExtension();
        return () => {
            // 清理所有监听器
            Object.keys(watchers.current).forEach(path => {
                Neutralino.filesystem.unwatch(watchers.current[path]).catch(console.error);
            });
        };
    }, []);

    let watchers = useRef({});

    async function callRustExtension() {
        try {
            // 调用 greet 方法
            console.log(333)
            const greetResult = await Neutralino.extensions.dispatch(
                'rs.extension',
                'greet',
                { name: 'Neutralino' }
            );
            console.log(444)
            console.log('Greeting:', greetResult);
            console.log('Greeting:', greetResult.data.greeting);

            // 调用 calculate 方法
            const calcResult = await Neutralino.extensions.dispatch(
                'rs.extension',
                'calculate',
                { a: 5, b: 7 }
            );
            console.log('Calculation result:', calcResult.data.result);
        } catch (err) {
            console.error('Extension error:', err);
        }
    }

    const loadSavedData = async () => {
        try {
            const data = await Neutralino.storage.getData('watchedDirs');
            if (data) {
                const dirs = JSON.parse(data);
                setWatchedDirs(dirs);

                // 恢复监听状态
                dirs.filter(dir => dir.isActive).forEach(dir => {
                    startWatch(dir.path);
                });
            }
        } catch (err) {
            addLog('没有找到保存的监听目录', 'system');
        }
    };

    const fetchSystemInfo = async () => {
        try {
            const memoryInfo = await Neutralino.computer.getMemoryInfo();
            const osInfo = await Neutralino.computer.getOSInfo();
            const cpuInfo = await Neutralino.computer.getCPUInfo();
            const disks = await getDiskSpace()
            setSystemInfo({osName:osInfo.name,memory:memoryInfo.physical,arch:cpuInfo.model,disks});

        } catch (err) {
            addLog('获取系统信息失败: ' + err.message, 'error');
        }
    };

    const addLog = (message, type = 'info') => {
        const timestamp = new Date().toLocaleString();
        setLogs(prev => [...prev.slice(-200), { message, type, timestamp }]);
    };

    const selectDirectory = async () => {
        try {
            const dir = await Neutralino.os.showFolderDialog('选择监听目录');
            if (dir) {
                setSelectedDir(dir);
            }
        } catch (err) {
            addLog('选择目录失败: ' + err.message, 'error');
        }
    };

    const addWatchedDir = async () => {
        if (!selectedDir) {
            addLog('请先选择目录', 'warning');
            return;
        }
        if (watchedDirs.some(dir => dir.path === selectedDir)) {
            addLog('该目录已在监听列表中', 'warning');
            return;
        }

        const newDir = {
            path: selectedDir,
            isActive: false,
            lastSync: null
        };

        const updatedDirs = [...watchedDirs, newDir];
        setWatchedDirs(updatedDirs);
        await Neutralino.storage.setData('watchedDirs', JSON.stringify(updatedDirs));
        addLog(`添加监听目录: ${selectedDir}`, 'success');
        setSelectedDir('');
    };

    const startWatch = async (path) => {
        try {
            if (watchers.current[path]) {
                addLog(`已经在监听目录: ${path}`, 'warning');
                return;
            }

            const watcherId = await Neutralino.filesystem.createWatcher(path);
            Neutralino.events.on('watchFile', (evt) => {
                if(watcherId === evt.detail.id) {
                    addLog(`文件变化: ${evt.detail.dir} (${evt.detail.action})`, 'file');
                }
            });
            watchers.current[path] = watcherId;
            setWatchedDirs(prev =>
                prev.map(dir =>
                    dir.path === path ? { ...dir, isActive: true } : dir
                )
            );

            addLog(`开始监听目录: ${path}`, 'success');
            setIsWatching(true);
        } catch (err) {
            addLog(`开始监听失败: ${err.message}`, 'error');
        }
    };

    const stopWatch = async (path) => {
        try {
            if (!watchers.current[path]) {
                addLog(`未在监听目录: ${path}`, 'warning');
                return;
            }
            await Neutralino.filesystem.removeWatcher(watchers.current[path]);
            delete watchers.current[path];

            setWatchedDirs(prev =>
                prev.map(dir =>
                    dir.path === path ? { ...dir, isActive: false } : dir
                )
            );

            addLog(`停止监听目录: ${path}`, 'info');
            setIsWatching(Object.keys(watchers.current).length > 0);
        } catch (err) {
            addLog(`停止监听失败: ${err.message}`, 'error');
        }
    };

    const toggleAllWatch = async (start) => {
        const results = await Promise.all(
            watchedDirs.map(dir =>
                start ? startWatch(dir.path) : stopWatch(dir.path)
            )
        );

        setIsWatching(start);
        addLog(start ? '开始监听所有目录' : '停止监听所有目录', 'info');
    };

    const fullSync = async (path) => {
        try {
            addLog(`开始全量同步: ${path}`, 'info');
            const {total} = await processDirectoryBulk(path)
            addLog(`同步完成: ${path} (${total}个文件)`, 'success');
        } catch (err) {
            addLog(`同步失败: ${err.message}`, 'error');
        }
    };

    async function processDirectoryBulk(dirPath, batchSize = 10000) {
            const files = await Neutralino.filesystem.readDirectory(dirPath,{recursive:true});
            let batch = [];
            let processedCount = 0;

            for (const file of files) {
                if (file.type === 'FILE') {
                    const fullPath = file.path;
                    const content = await Neutralino.filesystem.readFile(fullPath);
                    const stats = await Neutralino.filesystem.getStats(fullPath);

                    batch.push({
                        file_name: file.entry.split(/[\\\/]/).pop(),
                        file_path: fullPath,
                        file_size: stats.size,
                        content: content,
                        last_modified: stats.modifiedAt,
                        extension: file.entry.split(/[.]/).pop().toLowerCase()
                    });

                    if (batch.length >= batchSize) {
                        const d = await fetch('https://www.baidu.com')
                        console.log(d.text())

                        await clickhouseClient.insert({
                            table:'file_contents',
                            values:batch,
                            format: 'JSONEachRow'
                        })
                        processedCount += batch.length;
                        batch = [];
                    }
                }
            }

            // 插入剩余记录
            if (batch.length > 0) {
                await clickhouseClient.insert({
                    table:'file_contents',
                    values:batch,
                    format: 'JSONEachRow'
                })
                processedCount += batch.length;
            }

            return { total: processedCount, success: true };
    }
    const removeWatchedDir = async (path) => {
        try {
            if (watchers.current[path]) {
                await stopWatch(path);
            }

            const updatedDirs = watchedDirs.filter(dir => dir.path !== path);
            setWatchedDirs(updatedDirs);
            await Neutralino.storage.setData('watchedDirs', JSON.stringify(updatedDirs));
            addLog(`移除监听目录: ${path}`, 'info');
        } catch (err) {
            addLog(`移除失败: ${err.message}`, 'error');
        }
    };
    async function getDiskSpace() {
        let command = 'wmic logicaldisk get size,freespace,caption';
        try {
            const {stdOut} = await Neutralino.os.execCommand(command);
            console.log('磁盘信息:', stdOut);
            // 解析 wmic 输出（如 "C: 12345678 9876543"）
            const lines = stdOut.trim().split('\n').slice(1);
            return lines.map(line => {
                const [drive, free, size] = line.trim().split(/\s+/);
                return ({drive, size, free})
            });
        } catch (error) {
            console.error('获取磁盘信息失败:', error);
        }
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    return (
        <div className="app-container w-screen">
            <header className="app-header">
                <h1 className="app-title">文件系统监听器</h1>
                <div className="system-status">
                    <span className={`status-indicator ${isWatching ? 'active' : ''}`}></span>
                    <span>{isWatching ? '监听中' : '已停止'}</span>
                </div>
            </header>

            <div className="app-content">
                <div className="left-panel">
                    <div className="control-section">
                        <h2 className="section-title">目录管理</h2>
                        <div className="directory-selector">
                            <input
                                type="text"
                                className="directory-input"
                                value={selectedDir}
                                readOnly
                                placeholder="选择监听目录"
                            />
                            <button className="btn select-btn" onClick={selectDirectory}>
                                选择目录
                            </button>
                            <button className="btn add-btn" onClick={addWatchedDir}>
                                添加监听
                            </button>
                        </div>
                    </div>

                    <div className="watched-dirs-section">
                        <div className="section-header">
                            <h2 className="section-title">监听目录</h2>
                            <div className="global-controls">
                                <button
                                    className={`btn ${isWatching ? 'stop-btn' : 'start-btn'}`}
                                    onClick={() => toggleAllWatch(!isWatching)}
                                >
                                    {isWatching ? '全部停止' : '全部开始'}
                                </button>
                            </div>
                        </div>
                        <ul className="dir-list">
                            {watchedDirs.map((dir, index) => (
                                <li key={index} className="dir-item">
                                    <div className="dir-info">
                                        <span className="dir-path">{dir.path}</span>
                                        <span className={`dir-status ${dir.isActive ? 'active' : ''}`}>
                      {dir.isActive ? '监听中' : '已停止'}
                    </span>
                                        {dir.lastSync && (
                                            <span className="dir-sync">上次同步: {new Date(dir.lastSync).toLocaleString()}</span>
                                        )}
                                    </div>
                                    <div className="dir-actions">
                                        <button
                                            className={`btn ${dir.isActive ? 'stop-btn' : 'start-btn'}`}
                                            onClick={() => dir.isActive ? stopWatch(dir.path) : startWatch(dir.path)}
                                        >
                                            {dir.isActive ? '停止' : '开始'}
                                        </button>
                                        <button className="btn sync-btn" onClick={() => fullSync(dir.path)}>
                                            全量同步
                                        </button>
                                        <button className="btn remove-btn" onClick={() => removeWatchedDir(dir.path)}>
                                            移除
                                        </button>
                                    </div>
                                </li>
                            ))}
                            {watchedDirs.length === 0 && (
                                <li className="empty-message">暂无监听目录</li>
                            )}
                        </ul>
                    </div>

                    <div className="system-info-section">
                        <h2 className="section-title">系统信息</h2>
                        <div className="info-grid">
                            <div className="info-item">
                                <span className="info-label">操作系统:</span>
                                <span className="info-value">{systemInfo.osName || '未知'}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">CPU架构:</span>
                                <span className="info-value">{systemInfo.arch || '未知'}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">内存:</span>
                                <span className="info-value">
                  {systemInfo.memory ? `${Math.round(systemInfo.memory.available / 1024 / 1024 / 1024)}GB / ${Math.round(systemInfo.memory.total / 1024 / 1024 / 1024)}GB` : '未知'}
                </span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">磁盘空间:</span>
                                <div className="info-value">
                  {systemInfo.disks ? systemInfo?.disks?.map(disk => (
                      `${disk.drive}: ${formatBytes(disk.free)} / ${formatBytes(disk.size)}`
                  )).join(', ') : '未知'}
                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="right-panel">
                    <div className="logs-section">
                        <div className="section-header">
                            <h2 className="section-title">文件变化日志</h2>
                            <button className="btn clear-btn" onClick={() => {
                                setLogs([])
                            }}>
                                清空日志
                            </button>
                        </div>
                        <div className="logs-container">
                            {logs.length > 0 ? (
                                <ul className="log-list">
                                    {logs.map((log, index) => (
                                        <li key={index} className={`log-item ${log.type}`}>
                                            <span className="log-time">[{log.timestamp}]</span>
                                            <span className="log-message">{log.message}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="empty-message">暂无日志记录</div>
                            )}
                        </div>
                    </div>

                    {syncProgress > 0 && syncProgress < 100 && (
                        <div className="sync-progress">
                            <div className="progress-bar" style={{ width: `${syncProgress}%` }}></div>
                            <span className="progress-text">同步中: {syncProgress}%</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FileWatcherApp;