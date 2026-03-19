/**
 * yt-dlp GUI — Frontend Logic v2
 * Features: i18n, theme toggle, history, drag-drop, batch download, settings
 */

// ═══ i18n ═══
const I18N = {
    zh: {
        fetch: '获取信息', download: '开始下载', download_all: '全部下载',
        format: '格式', subtitle: '字幕', embed_sub: '嵌入字幕到视频',
        queue: '下载队列', open_dir: '打开目录', no_tasks: '暂无下载任务',
        no_tasks_hint: '粘贴链接，即刻开始', settings: '设置',
        download_dir: '下载目录', choose: '选择', proxy: '代理 (HTTP/SOCKS5)',
        speed_limit: '限速', cookie_browser: 'Cookie 来源浏览器',
        history: '下载历史', clear: '清空', drop_hint: '拖拽链接到此处',
        url_placeholder: '粘贴视频或播放列表链接（支持多行批量）...',
        no_sub: '不下载字幕', all_sub: '全部字幕', auto_gen: '(自动生成)',
        finished: '下载完成', error: '下载出错', cancelled: '已取消',
        pending: '等待中...', cancel: '取消', remove: '移除',
        open_loc: '打开位置', fetching: '正在获取视频信息...',
        fetch_fail: '获取失败', dl_fail: '下载失败', enter_url: '请输入视频链接',
        no_cookie: '不使用 Cookie', history_empty: '暂无历史记录',
        best_mp4: '最佳画质 (MP4)', best_merge: '最高质量 (合并)',
        audio_mp3: '仅音频 (MP3)',
    },
    en: {
        fetch: 'Get Info', download: 'Download', download_all: 'Download All',
        format: 'Format', subtitle: 'Subtitle', embed_sub: 'Embed subtitles',
        queue: 'Download Queue', open_dir: 'Open Dir', no_tasks: 'No tasks yet',
        no_tasks_hint: 'Paste a link to start', settings: 'Settings',
        download_dir: 'Download Directory', choose: 'Choose',
        proxy: 'Proxy (HTTP/SOCKS5)', speed_limit: 'Speed Limit',
        cookie_browser: 'Cookie Browser', history: 'Download History',
        clear: 'Clear', drop_hint: 'Drop link here',
        url_placeholder: 'Paste video or playlist URL (multi-line supported)...',
        no_sub: 'No subtitles', all_sub: 'All subtitles', auto_gen: '(auto)',
        finished: 'Completed', error: 'Error', cancelled: 'Cancelled',
        pending: 'Pending...', cancel: 'Cancel', remove: 'Remove',
        open_loc: 'Open Location', fetching: 'Fetching video info...',
        fetch_fail: 'Fetch failed', dl_fail: 'Download failed',
        enter_url: 'Please enter a URL', no_cookie: 'No Cookie',
        history_empty: 'No history yet',
        best_mp4: 'Best Quality (MP4)', best_merge: 'Highest (Merge)',
        audio_mp3: 'Audio Only (MP3)',
    },
};
let currentLang = 'zh';

function t(key) { return (I18N[currentLang] || I18N.zh)[key] || key; }

function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
}

// ═══ State ═══
const state = { videoInfo: null, tasks: {} };
const $ = s => document.querySelector(s);
const dom = {
    urlInput:         $('#url-input'),
    pasteBtn:         $('#paste-btn'),
    fetchBtn:         $('#fetch-btn'),
    fetchStatus:      $('#fetch-status'),
    videoInfo:        $('#video-info'),
    videoThumb:       $('#video-thumb'),
    videoDuration:    $('#video-duration'),
    videoTitle:       $('#video-title'),
    videoUploader:    $('#video-uploader'),
    videoDesc:        $('#video-desc'),
    formatSelect:     $('#format-select'),
    downloadBtn:      $('#download-btn'),
    subtitleGroup:    $('#subtitle-group'),
    subtitleSelect:   $('#subtitle-select'),
    embedSubCheck:    $('#embed-sub-check'),
    embedSubLabel:    $('#embed-sub-label'),
    playlistInfo:     $('#playlist-info'),
    playlistTitle:    $('#playlist-title'),
    playlistCount:    $('#playlist-count'),
    playlistEntries:  $('#playlist-entries'),
    plFormatSelect:   $('#playlist-format-select'),
    plDownloadBtn:    $('#playlist-download-btn'),
    tasksList:        $('#tasks-list'),
    emptyState:       $('#empty-state'),
    settingsBtn:      $('#settings-btn'),
    settingsPanel:    $('#settings-panel'),
    settingsCloseBtn: $('#settings-close-btn'),
    chooseDirBtn:     $('#choose-dir-btn'),
    dirDisplay:       $('#download-dir-display'),
    openDirBtn:       $('#open-dir-btn'),
    versionChip:      $('#version-chip'),
    drawerOverlay:    $('#drawer-overlay'),
    themeBtn:         $('#theme-btn'),
    langBtn:          $('#lang-btn'),
    historyBtn:       $('#history-btn'),
    historyPanel:     $('#history-panel'),
    historyCloseBtn:  $('#history-close-btn'),
    historyList:      $('#history-list'),
    clearHistoryBtn:  $('#clear-history-btn'),
    proxyInput:       $('#proxy-input'),
    speedLimitInput:  $('#speed-limit-input'),
    cookieBrowserSel: $('#cookie-browser-select'),
    dropOverlay:      $('#drop-overlay'),
    mainDrop:         $('#main-drop-zone'),
    thumbWrap:        $('#thumb-wrap'),
};

// ── SVG icons ──
const icons = {
    downloading: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>',
    finished:    '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
    error:       '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
    pending:     '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>',
    cancelled:   '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>',
    cancel:      '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    remove:      '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
    openExt:     '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>',
};

// ── Utilities ──
function esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function fmtDuration(s) {
    if (!s) return '';
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = Math.floor(s%60);
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}

// ── API bridge ──
async function api(method, ...args) {
    while (!window.pywebview || !window.pywebview.api) await new Promise(r => setTimeout(r, 80));
    return window.pywebview.api[method](...args);
}

// ═══ Fetch Info ═══
async function fetchInfo() {
    const raw = dom.urlInput.value.trim();
    if (!raw) { showError(t('enter_url')); return; }

    // 多行批量：如果有多行链接，逐个添加到下载队列
    const urls = raw.split('\n').map(u => u.trim()).filter(u => u && (u.startsWith('http') || u.startsWith('www')));
    if (urls.length > 1) {
        for (const u of urls) startDownload(u, 'best', false, '', false);
        dom.urlInput.value = '';
        return;
    }

    const url = urls[0] || raw;
    dom.fetchBtn.disabled = true;
    dom.videoInfo.classList.add('hidden');
    dom.playlistInfo.classList.add('hidden');
    showLoading(t('fetching'));

    try {
        const info = await api('get_video_info', url);
        if (info.error) { showError(info.error); return; }
        hideStatus();
        state.videoInfo = info;
        state.videoInfo.url = url;
        info.type === 'playlist' ? renderPlaylist(info) : renderVideo(info);
    } catch (e) {
        showError(`${t('fetch_fail')}: ${e}`);
    } finally {
        dom.fetchBtn.disabled = false;
    }
}

function showLoading(msg) { dom.fetchStatus.innerHTML = `<div class="spinner"></div>${esc(msg)}`; dom.fetchStatus.className = 'status-bar'; dom.fetchStatus.classList.remove('hidden'); }
function showError(msg) { dom.fetchStatus.textContent = msg; dom.fetchStatus.className = 'status-bar error'; dom.fetchStatus.classList.remove('hidden'); }
function hideStatus() { dom.fetchStatus.classList.add('hidden'); }

// ═══ Render Video ═══
function renderVideo(info) {
    dom.videoThumb.src = info.thumbnail || '';
    dom.videoThumb.onerror = () => dom.videoThumb.style.display = 'none';
    dom.videoThumb.onload  = () => dom.videoThumb.style.display = 'block';
    dom.videoDuration.textContent = fmtDuration(info.duration);
    dom.videoTitle.textContent = info.title;
    dom.videoUploader.textContent = info.uploader || '';
    dom.videoDesc.textContent = info.description || '';

    // Formats
    dom.formatSelect.innerHTML = '';
    [{v:'best',l:t('best_mp4')},{v:'bestvideo+bestaudio',l:t('best_merge')},{v:'audio',l:t('audio_mp3')}].forEach(o => {
        const el = document.createElement('option'); el.value = o.v; el.textContent = o.l;
        dom.formatSelect.appendChild(el);
    });
    const vFmts = (info.formats||[]).filter(f => f.vcodec !== 'none' && f.resolution && f.resolution !== 'audio only').sort((a,b) => (b.tbr||0) - (a.tbr||0));
    const seen = new Set();
    for (const f of vFmts) {
        if (seen.has(f.resolution)) continue; seen.add(f.resolution);
        const el = document.createElement('option');
        el.value = f.format_id;
        el.textContent = `${f.resolution} ${f.ext}${f.filesize ? ` (${(f.filesize/1048576).toFixed(1)}MB)` : ''}`;
        dom.formatSelect.appendChild(el);
    }

    // Subtitles
    const subs = info.subtitles || [];
    dom.subtitleSelect.innerHTML = `<option value="">${t('no_sub')}</option>`;
    if (subs.length > 0) {
        for (const s of subs) {
            const el = document.createElement('option'); el.value = s.lang;
            el.textContent = (s.name || s.lang) + (s.auto ? ` ${t('auto_gen')}` : '');
            dom.subtitleSelect.appendChild(el);
        }
        const allOpt = document.createElement('option'); allOpt.value = 'all'; allOpt.textContent = t('all_sub');
        dom.subtitleSelect.appendChild(allOpt);
        dom.subtitleGroup.style.display = '';
    } else {
        dom.subtitleGroup.style.display = 'none';
    }
    dom.embedSubLabel.style.display = 'none';
    dom.videoInfo.classList.remove('hidden');
}

// ═══ Render Playlist ═══
function renderPlaylist(info) {
    dom.playlistTitle.textContent = info.title;
    dom.playlistCount.textContent = `${info.count} videos`;
    dom.playlistEntries.innerHTML = '';
    for (let i = 0; i < info.entries.length; i++) {
        const e = info.entries[i], div = document.createElement('div');
        div.className = 'playlist-entry';
        div.innerHTML = `<span class="idx">${i+1}</span><span class="entry-title">${esc(e.title||e.url)}</span><span class="dur">${fmtDuration(e.duration)}</span>`;
        dom.playlistEntries.appendChild(div);
    }
    dom.playlistInfo.classList.remove('hidden');
}

// ═══ Download ═══
async function startDownload(url, formatId, audioOnly, subLangs, embedSubs) {
    try {
        const t = await api('start_download', url, formatId||'best', audioOnly||false, subLangs||'', embedSubs||false);
        addTask(t);
    } catch (e) { showError(`${t('dl_fail')}: ${e}`); }
}

function addTask(t) {
    state.tasks[t.id] = t; dom.emptyState.classList.add('hidden');
    const div = document.createElement('div'); div.className = 'task-item'; div.id = `task-${t.id}`;
    div.innerHTML = taskHTML(t); dom.tasksList.prepend(div);
}

function taskHTML(tk) {
    const icon = icons[tk.status] || icons.pending;
    const fillCls = tk.status === 'finished' ? 'task-bar-fill done' : 'task-bar-fill';
    let meta = '';
    if (tk.status === 'downloading') {
        meta = `<span>${tk.progress}%</span>`;
        if (tk.speed) meta += `<span>${esc(tk.speed)}</span>`;
        if (tk.eta) meta += `<span>${esc(tk.eta)}</span>`;
        if (tk.filesize) meta += `<span>${esc(tk.filesize)}</span>`;
    } else if (tk.status === 'finished') { meta = `<span style="color:var(--c-ok)">${t('finished')}</span>`; }
    else if (tk.status === 'error') { meta = `<span style="color:var(--c-err)">${esc(tk.error||t('error'))}</span>`; }
    else if (tk.status === 'cancelled') { meta = `<span>${t('cancelled')}</span>`; }
    else { meta = `<span>${t('pending')}</span>`; }

    let actions = '';
    if (tk.status === 'downloading' || tk.status === 'pending') {
        actions = `<button class="btn-icon" onclick="cancelTask('${tk.id}')" title="${t('cancel')}">${icons.cancel}</button>`;
    } else {
        if (tk.status === 'finished' && tk.filename) actions += `<button class="btn-icon" onclick="openLoc('${esc(tk.filename)}')" title="${t('open_loc')}">${icons.openExt}</button>`;
        actions += `<button class="btn-icon" onclick="removeTask('${tk.id}')" title="${t('remove')}">${icons.remove}</button>`;
    }
    return `<div class="task-icon-wrap s-${tk.status}">${icon}</div><div class="task-body"><div class="task-name">${esc(tk.title)}</div><div class="task-bar"><div class="${fillCls}" style="width:${tk.progress}%"></div></div><div class="task-meta">${meta}</div></div><div class="task-controls">${actions}</div>`;
}

window.onTaskUpdate = function(tk) {
    state.tasks[tk.id] = tk;
    const el = document.getElementById(`task-${tk.id}`);
    if (el) el.innerHTML = taskHTML(tk);
};

async function cancelTask(id) { try { await api('cancel_download', id); } catch(e) {} }
async function removeTask(id) {
    try {
        await api('remove_task', id);
        const el = document.getElementById(`task-${id}`);
        if (el) { el.style.animation = 'fadeOut 0.2s var(--ease)'; setTimeout(() => { el.remove(); delete state.tasks[id]; if (!Object.keys(state.tasks).length) dom.emptyState.classList.remove('hidden'); }, 200); }
    } catch(e) {}
}
async function openLoc(f) { try { await api('open_file_location', f); } catch(e) {} }

// ═══ Drawers ═══
function openDrawer(panel) {
    document.querySelectorAll('.drawer').forEach(d => d.classList.add('hidden'));
    panel.classList.remove('hidden');
    dom.drawerOverlay.classList.remove('hidden');
}
function closeDrawers() {
    document.querySelectorAll('.drawer').forEach(d => d.classList.add('hidden'));
    dom.drawerOverlay.classList.add('hidden');
}

// ═══ Theme ═══
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    $('#theme-icon-dark').style.display = theme === 'dark' ? '' : 'none';
    $('#theme-icon-light').style.display = theme === 'light' ? '' : 'none';
    api('update_settings', 'theme', theme).catch(() => {});
}

// ═══ Lang ═══
function setLang(lang) {
    currentLang = lang;
    applyI18n();
    api('update_settings', 'lang', lang).catch(() => {});
}

// ═══ History ═══
async function loadHistory() {
    try {
        const list = await api('get_history');
        dom.historyList.innerHTML = '';
        if (!list || list.length === 0) {
            dom.historyList.innerHTML = `<div class="history-empty">${t('history_empty')}</div>`;
            return;
        }
        for (const h of list) {
            const div = document.createElement('div'); div.className = 'history-item';
            div.innerHTML = `<div class="hi-title">${esc(h.title)}</div><div class="hi-time">${esc(h.time)}</div><div class="hi-url" onclick="document.getElementById('url-input').value='${esc(h.url)}'">${esc(h.url)}</div>`;
            dom.historyList.appendChild(div);
        }
    } catch(e) {}
}

// ═══ Drag & Drop ═══
function setupDragDrop() {
    let dragCounter = 0;
    dom.mainDrop.addEventListener('dragenter', e => { e.preventDefault(); dragCounter++; dom.dropOverlay.classList.remove('hidden'); });
    dom.mainDrop.addEventListener('dragleave', e => { e.preventDefault(); dragCounter--; if (dragCounter <= 0) { dragCounter = 0; dom.dropOverlay.classList.add('hidden'); } });
    dom.mainDrop.addEventListener('dragover', e => e.preventDefault());
    dom.mainDrop.addEventListener('drop', e => {
        e.preventDefault(); dragCounter = 0; dom.dropOverlay.classList.add('hidden');
        const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list') || '';
        if (text) { dom.urlInput.value = text.trim(); fetchInfo(); }
    });
}

// ═══ Settings sync ═══
function settingBlur(inputEl, key) {
    inputEl.addEventListener('blur', () => {
        api('update_settings', key, inputEl.value.trim()).catch(() => {});
    });
    inputEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') { inputEl.blur(); }
    });
}

// ═══ Init ═══
function init() {
    dom.fetchBtn.addEventListener('click', fetchInfo);
    dom.urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') fetchInfo(); });

    dom.pasteBtn.addEventListener('click', async () => {
        try { const t = await api('get_clipboard'); if (t) dom.urlInput.value = t.trim(); } catch(e) {}
    });

    dom.downloadBtn.addEventListener('click', () => {
        if (!state.videoInfo) return;
        const fmt = dom.formatSelect.value, audio = fmt === 'audio';
        const subLang = dom.subtitleSelect ? dom.subtitleSelect.value : '';
        const embedSub = dom.embedSubCheck ? dom.embedSubCheck.checked : false;
        startDownload(state.videoInfo.url || dom.urlInput.value.trim(), audio ? 'best' : fmt, audio, subLang, embedSub);
    });

    dom.plDownloadBtn.addEventListener('click', () => {
        if (!state.videoInfo || state.videoInfo.type !== 'playlist') return;
        const fmt = dom.plFormatSelect.value, audio = fmt === 'audio';
        for (const e of state.videoInfo.entries) startDownload(e.url, audio ? 'best' : 'best', audio, '', false);
    });

    // Subtitle toggle
    if (dom.subtitleSelect) {
        dom.subtitleSelect.addEventListener('change', () => {
            const has = dom.subtitleSelect.value !== '', isA = dom.formatSelect.value === 'audio';
            dom.embedSubLabel.style.display = (has && !isA) ? '' : 'none';
        });
    }
    if (dom.formatSelect) {
        dom.formatSelect.addEventListener('change', () => {
            const has = dom.subtitleSelect && dom.subtitleSelect.value !== '', isA = dom.formatSelect.value === 'audio';
            dom.embedSubLabel.style.display = (has && !isA) ? '' : 'none';
        });
    }

    // Drawers
    dom.settingsBtn.addEventListener('click', () => openDrawer(dom.settingsPanel));
    dom.settingsCloseBtn.addEventListener('click', closeDrawers);
    dom.historyBtn.addEventListener('click', () => { loadHistory(); openDrawer(dom.historyPanel); });
    dom.historyCloseBtn.addEventListener('click', closeDrawers);
    dom.drawerOverlay.addEventListener('click', closeDrawers);

    dom.chooseDirBtn.addEventListener('click', async () => {
        try { const d = await api('choose_directory'); if (d) dom.dirDisplay.textContent = d; } catch(e) {}
    });
    dom.openDirBtn.addEventListener('click', () => openLoc(''));

    // Theme
    dom.themeBtn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'dark';
        setTheme(cur === 'dark' ? 'light' : 'dark');
    });

    // Language
    dom.langBtn.addEventListener('click', () => {
        setLang(currentLang === 'zh' ? 'en' : 'zh');
    });

    // History clear
    dom.clearHistoryBtn.addEventListener('click', async () => {
        await api('clear_history');
        dom.historyList.innerHTML = `<div class="history-empty">${t('history_empty')}</div>`;
    });

    // Settings inputs
    settingBlur(dom.proxyInput, 'proxy');
    settingBlur(dom.speedLimitInput, 'speed_limit');
    dom.cookieBrowserSel.addEventListener('change', () => {
        api('update_settings', 'cookie_browser', dom.cookieBrowserSel.value).catch(() => {});
    });

    // Video preview click -> open URL
    if (dom.thumbWrap) {
        dom.thumbWrap.addEventListener('click', () => {
            const url = state.videoInfo?.url || dom.urlInput.value.trim();
            if (url) {
                try { api('open_file_location', ''); } catch(e) {} // fallback
            }
        });
    }

    setupDragDrop();
    loadSettings();
}

async function loadSettings() {
    try {
        const settings = await api('get_settings');
        dom.dirDisplay.textContent = settings.download_dir || '~/Downloads';
        dom.proxyInput.value = settings.proxy || '';
        dom.speedLimitInput.value = settings.speed_limit || '';
        dom.cookieBrowserSel.value = settings.cookie_browser || '';
        if (settings.theme) setTheme(settings.theme);
        if (settings.lang) { currentLang = settings.lang; applyI18n(); }

        const info = await api('get_app_info');
        dom.versionChip.querySelector('span').textContent = `yt-dlp ${info.yt_dlp_version}`;
    } catch(e) {
        dom.versionChip.querySelector('span').textContent = 'yt-dlp';
    }
}

document.addEventListener('DOMContentLoaded', init);
