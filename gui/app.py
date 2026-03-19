#!/usr/bin/env python3
"""yt-dlp GUI — 跨平台桌面视频下载应用"""

import json
import os
import re
import subprocess
import sys
import threading
import time
import uuid

import webview

# 将项目根目录加入 sys.path，以便从任意位置启动时都能导入 yt_dlp
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import yt_dlp  # noqa: E402

_ANSI_RE = re.compile(r'\x1b\[[0-9;]*m')
_CONFIG_DIR = os.path.join(os.path.dirname(__file__), '.data')
_HISTORY_FILE = os.path.join(_CONFIG_DIR, 'history.json')
_SETTINGS_FILE = os.path.join(_CONFIG_DIR, 'settings.json')


def strip_ansi(s: str) -> str:
    return _ANSI_RE.sub('', s).strip() if s else ''


def _ensure_data_dir():
    os.makedirs(_CONFIG_DIR, exist_ok=True)


class DownloadTask:
    __slots__ = ('id', 'url', 'title', 'status', 'progress', 'speed',
                 'eta', 'filesize', 'filename', 'error', '_cancel')

    def __init__(self, url):
        self.id = str(uuid.uuid4())[:8]
        self.url = url
        self.title = url
        self.status = 'pending'
        self.progress = 0.0
        self.speed = ''
        self.eta = ''
        self.filesize = ''
        self.filename = ''
        self.error = ''
        self._cancel = False

    def to_dict(self):
        return {k: getattr(self, k) for k in
                ('id', 'url', 'title', 'status', 'progress',
                 'speed', 'eta', 'filesize', 'filename', 'error')}


class Api:
    """暴露给前端的 Python API"""

    def __init__(self):
        self._tasks: dict[str, DownloadTask] = {}
        self._window = None

        # 加载持久化设置
        self._settings = {
            'download_dir': os.path.expanduser('~/Downloads'),
            'proxy': '',           # e.g. http://127.0.0.1:7890 or socks5://...
            'speed_limit': '',     # e.g. '5M', '500K', '' = unlimited
            'cookie_browser': '',  # e.g. 'chrome', 'firefox', 'edge', ''
            'theme': 'dark',       # 'dark' or 'light'
            'lang': 'zh',          # 'zh' or 'en'
        }
        self._load_settings()
        self._history: list = []
        self._load_history()

    def set_window(self, window):
        self._window = window

    # ── 持久化 ──

    def _load_settings(self):
        try:
            with open(_SETTINGS_FILE, 'r', encoding='utf-8') as f:
                saved = json.load(f)
                self._settings.update(saved)
        except Exception:
            pass

    def _save_settings(self):
        _ensure_data_dir()
        with open(_SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(self._settings, f, ensure_ascii=False, indent=2)

    def _load_history(self):
        try:
            with open(_HISTORY_FILE, 'r', encoding='utf-8') as f:
                self._history = json.load(f)
        except Exception:
            self._history = []

    def _save_history(self):
        _ensure_data_dir()
        with open(_HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(self._history[-500:], f, ensure_ascii=False, indent=2)

    def _add_history(self, title, url, filename):
        self._history.append({
            'title': title,
            'url': url,
            'filename': filename,
            'time': time.strftime('%Y-%m-%d %H:%M:%S'),
        })
        self._save_history()

    # ── 设置 API ──

    def get_settings(self) -> dict:
        return dict(self._settings)

    def update_settings(self, key: str, value: str) -> dict:
        if key in self._settings:
            self._settings[key] = value
            self._save_settings()
            return {'success': True}
        return {'error': f'Unknown key: {key}'}

    def get_download_dir(self) -> str:
        return self._settings['download_dir']

    def choose_directory(self) -> str:
        if self._window:
            result = self._window.create_file_dialog(
                webview.FOLDER_DIALOG,
                directory=self._settings['download_dir'],
            )
            if result and len(result) > 0:
                self._settings['download_dir'] = result[0]
                self._save_settings()
                return self._settings['download_dir']
        return self._settings['download_dir']

    # ── 历史记录 ──

    def get_history(self) -> list:
        return list(reversed(self._history[-100:]))

    def clear_history(self) -> dict:
        self._history = []
        self._save_history()
        return {'success': True}

    # ── 视频信息获取 ──

    def get_video_info(self, url: str) -> dict:
        try:
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': False,
                'writesubtitles': True,
                'writeautomaticsub': True,
            }
            self._apply_network_opts(ydl_opts)

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if info is None:
                    return {'error': '无法获取视频信息'}

                if info.get('_type') == 'playlist':
                    entries = []
                    for entry in (info.get('entries') or []):
                        if entry:
                            entries.append({
                                'id': entry.get('id', ''),
                                'title': entry.get('title', ''),
                                'duration': entry.get('duration', 0),
                                'url': entry.get('webpage_url') or entry.get('url', ''),
                            })
                    return {
                        'type': 'playlist',
                        'title': info.get('title', ''),
                        'count': len(entries),
                        'entries': entries[:50],
                    }

                formats = []
                for f in (info.get('formats') or []):
                    formats.append({
                        'format_id': f.get('format_id', ''),
                        'ext': f.get('ext', ''),
                        'resolution': f.get('resolution', 'audio only'),
                        'filesize': f.get('filesize') or f.get('filesize_approx') or 0,
                        'vcodec': f.get('vcodec', 'none'),
                        'acodec': f.get('acodec', 'none'),
                        'fps': f.get('fps'),
                        'tbr': f.get('tbr'),
                        'format_note': f.get('format_note', ''),
                    })

                subtitles = []
                sub_data = info.get('subtitles') or {}
                auto_sub_data = info.get('automatic_captions') or {}
                for lang, subs in sub_data.items():
                    name = subs[0].get('name', lang) if subs else lang
                    subtitles.append({'lang': lang, 'name': name, 'auto': False})
                for lang, subs in auto_sub_data.items():
                    if lang not in sub_data:
                        name = subs[0].get('name', lang) if subs else lang
                        subtitles.append({'lang': lang, 'name': name, 'auto': True})
                priority = {'zh-Hans': 0, 'zh': 1, 'zh-Hant': 2, 'en': 3, 'ja': 4, 'ko': 5}
                subtitles.sort(key=lambda s: (s['auto'], priority.get(s['lang'], 99), s['lang']))

                return {
                    'type': 'video',
                    'id': info.get('id', ''),
                    'title': info.get('title', ''),
                    'thumbnail': info.get('thumbnail', ''),
                    'duration': info.get('duration', 0),
                    'uploader': info.get('uploader', ''),
                    'view_count': info.get('view_count'),
                    'description': (info.get('description') or '')[:300],
                    'formats': formats,
                    'subtitles': subtitles,
                }
        except Exception as e:
            return {'error': str(e)}

    # ── 网络选项（代理/cookie/限速）──

    def _apply_network_opts(self, ydl_opts: dict):
        proxy = self._settings.get('proxy', '').strip()
        if proxy:
            ydl_opts['proxy'] = proxy

        cookie_browser = self._settings.get('cookie_browser', '').strip()
        if cookie_browser:
            ydl_opts['cookiesfrombrowser'] = (cookie_browser,)

        speed_limit = self._settings.get('speed_limit', '').strip()
        if speed_limit:
            ydl_opts['ratelimit'] = self._parse_speed(speed_limit)

    @staticmethod
    def _parse_speed(s: str) -> int:
        s = s.strip().upper()
        if s.endswith('M'):
            return int(float(s[:-1]) * 1024 * 1024)
        elif s.endswith('K'):
            return int(float(s[:-1]) * 1024)
        try:
            return int(s)
        except ValueError:
            return 0

    # ── 下载任务管理 ──

    def start_download(self, url: str, format_id: str = 'best',
                       audio_only: bool = False,
                       sub_langs: str = '', embed_subs: bool = False) -> dict:
        task = DownloadTask(url)
        self._tasks[task.id] = task
        threading.Thread(
            target=self._download_worker,
            args=(task, format_id, audio_only, sub_langs, embed_subs),
            daemon=True,
        ).start()
        return task.to_dict()

    def _download_worker(self, task, format_id, audio_only, sub_langs='', embed_subs=False):
        def progress_hook(d):
            if task._cancel:
                raise Exception('用户取消下载')
            if d['status'] == 'downloading':
                task.status = 'downloading'
                total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
                downloaded = d.get('downloaded_bytes', 0)
                if total > 0:
                    task.progress = round(downloaded / total * 100, 1)
                task.speed = strip_ansi(d.get('_speed_str', ''))
                task.eta = strip_ansi(d.get('_eta_str', ''))
                task.filesize = strip_ansi(d.get('_total_bytes_str', ''))
                task.filename = d.get('filename', '')
                self._notify_progress(task)
            elif d['status'] == 'finished':
                task.filename = d.get('filename', '')

        try:
            if audio_only:
                fmt = 'bestaudio/best'
            elif format_id and format_id != 'best':
                fmt = format_id
            else:
                fmt = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'

            ydl_opts = {
                'format': fmt,
                'outtmpl': os.path.join(self._settings['download_dir'], '%(title)s.%(ext)s'),
                'progress_hooks': [progress_hook],
                'quiet': True,
                'no_warnings': True,
            }
            self._apply_network_opts(ydl_opts)

            if sub_langs:
                ydl_opts['writesubtitles'] = True
                ydl_opts['writeautomaticsub'] = True
                ydl_opts['subtitleslangs'] = [l.strip() for l in sub_langs.split(',')]
                ydl_opts['subtitlesformat'] = 'srt/best'
                if embed_subs and not audio_only:
                    ydl_opts.setdefault('postprocessors', [])
                    ydl_opts['postprocessors'].append({
                        'key': 'FFmpegEmbedSubtitle',
                        'already_have_subtitle': False,
                    })

            if audio_only:
                ydl_opts.setdefault('postprocessors', [])
                ydl_opts['postprocessors'].append({
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                })

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url=task.url, download=True)
                if info:
                    task.title = info.get('title', task.url)

            task.status = 'finished'
            task.progress = 100
            self._add_history(task.title, task.url, task.filename)
            self._send_notification(task.title)
        except Exception as e:
            if task._cancel:
                task.status = 'cancelled'
            else:
                task.status = 'error'
                task.error = str(e)

        self._notify_progress(task)

    def _notify_progress(self, task):
        if self._window:
            try:
                data = json.dumps(task.to_dict(), ensure_ascii=False)
                self._window.evaluate_js(f'window.onTaskUpdate({data})')
            except Exception:
                pass

    def _send_notification(self, title):
        """发送系统通知"""
        try:
            if sys.platform == 'darwin':
                subprocess.Popen([
                    'osascript', '-e',
                    f'display notification "已完成: {title}" with title "yt-dlp GUI" sound name "Glass"'
                ])
            elif sys.platform == 'win32':
                # Windows toast via PowerShell
                ps = (
                    f'[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, '
                    f'ContentType = WindowsRuntime] > $null; '
                    f'$t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(0); '
                    f'$t.GetElementsByTagName("text")[0].AppendChild($t.CreateTextNode("已完成: {title}")) > $null; '
                    f'[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("yt-dlp GUI")'
                    f'.Show([Windows.UI.Notifications.ToastNotification]::new($t))'
                )
                subprocess.Popen(['powershell', '-Command', ps],
                                 creationflags=0x08000000)
            else:
                subprocess.Popen(['notify-send', 'yt-dlp GUI', f'已完成: {title}'])
        except Exception:
            pass

    def cancel_download(self, task_id: str) -> dict:
        task = self._tasks.get(task_id)
        if task:
            task._cancel = True
            return {'success': True}
        return {'error': '任务不存在'}

    def get_tasks(self) -> list:
        return [t.to_dict() for t in self._tasks.values()]

    def remove_task(self, task_id: str) -> dict:
        if task_id in self._tasks:
            del self._tasks[task_id]
            return {'success': True}
        return {'error': '任务不存在'}

    # ── 工具 ──

    def open_file_location(self, filepath: str):
        if not filepath:
            filepath = self._settings['download_dir']
        folder = os.path.dirname(filepath) if os.path.isfile(filepath) else filepath
        if sys.platform == 'darwin':
            subprocess.Popen(['open', folder])
        elif sys.platform == 'win32':
            subprocess.Popen(['explorer', folder])
        else:
            subprocess.Popen(['xdg-open', folder])

    def get_clipboard(self) -> str:
        try:
            if sys.platform == 'darwin':
                r = subprocess.run(['pbpaste'], capture_output=True, text=True, timeout=2)
                return r.stdout
            elif sys.platform == 'win32':
                r = subprocess.run(['powershell', '-Command', 'Get-Clipboard'],
                                   capture_output=True, text=True, timeout=2)
                return r.stdout.strip()
            else:
                r = subprocess.run(['xclip', '-selection', 'clipboard', '-o'],
                                   capture_output=True, text=True, timeout=2)
                return r.stdout
        except Exception:
            return ''

    def get_app_info(self) -> dict:
        return {
            'yt_dlp_version': yt_dlp.version.__version__,
            'platform': sys.platform,
        }


def main():
    api = Api()

    # 兼容 PyInstaller 打包环境
    if getattr(sys, 'frozen', False):
        base_dir = sys._MEIPASS
        # 将打包的 ffmpeg 加入 PATH
        os.environ['PATH'] = base_dir + os.pathsep + os.environ.get('PATH', '')
    else:
        base_dir = os.path.dirname(__file__)
    static_dir = os.path.join(base_dir, 'static')
    index_path = os.path.join(static_dir, 'index.html')

    window = webview.create_window(
        title='yt-dlp GUI',
        url=index_path,
        js_api=api,
        width=1100,
        height=750,
        min_size=(800, 550),
        background_color='#0f0f1a',
    )
    api.set_window(window)

    webview.start(debug=False)


if __name__ == '__main__':
    main()
