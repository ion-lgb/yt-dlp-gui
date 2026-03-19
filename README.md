# yt-dlp GUI

跨平台桌面视频下载工具，基于 [yt-dlp](https://github.com/yt-dlp/yt-dlp) + [pywebview](https://pywebview.flowrl.com/)。

![screenshot](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue)
![python](https://img.shields.io/badge/python-3.10+-green)

## ✨ 功能

- 🎬 支持 YouTube 及 [1000+ 网站](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md) 视频下载
- 📋 多格式选择（MP4 / 合并最高质量 / 仅音频 MP3）
- 📝 字幕下载与嵌入（手动 + 自动生成，中/英/日/韩优先）
- 🌐 代理设置（HTTP / SOCKS5）
- 🍪 Cookie 导入（Chrome / Firefox / Safari / Edge / Brave）
- ⏱ 下载限速
- 📜 下载历史记录
- 📋 多链接批量下载
- 🖱 拖拽链接到窗口
- 🔔 下载完成系统通知
- 🌗 暗色 / 亮色主题切换
- 🌍 中英双语界面

## 🚀 快速开始

### 从 Release 下载

前往 [Releases](../../releases) 页面下载对应平台安装包：
- **macOS**: `yt-dlp-gui-macos.dmg`
- **Linux**: `yt-dlp-gui-linux.tar.gz`
- **Windows**: `yt-dlp-gui-windows.zip`

### 从源码运行

```bash
# 克隆
git clone https://github.com/ion-lgb/yt-dlp-gui.git
cd yt-dlp-gui

# 创建虚拟环境
python3 -m venv gui/.venv
source gui/.venv/bin/activate  # Linux/macOS
# gui\.venv\Scripts\activate   # Windows

# 安装依赖
pip install pywebview yt-dlp

# 运行
python gui/app.py
```

## 📦 手动打包

```bash
pip install pyinstaller
pyinstaller yt-dlp-gui.spec --clean --noconfirm
# 产物在 dist/ 目录
```

## 📄 License

MIT
