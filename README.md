# ipad-display-ubuntu

在 **Ubuntu 22.04 (GNOME / Wayland)** 上把 iPad 当作**第二块显示器**,类似 macOS 的 Sidecar。
*Use an iPad as a second display on Ubuntu 22.04 (GNOME/Wayland), like macOS Sidecar.*

iPad 端**无需安装任何 App**,只用 Safari。完整原理与图文说明见 [docs/index.html](docs/index.html)。

## 快速开始

```bash
sudo apt install python3-gi gir1.2-gst-plugins-base-1.0 python3-gst-1.0 \
  gstreamer1.0-pipewire gstreamer1.0-plugins-good gstreamer1.0-plugins-base
./ipad-display --size 2048x1536 --scale 2
```

终端会打印带随机令牌的地址,例如 `http://192.168.1.10:8800/?k=xxxx`:

1. 在 iPad 的 Safari 中打开该地址;
2. 分享 → 添加到主屏幕,以全屏方式打开;
3. 把窗口拖到新出现的显示器上,或在 设置 → 显示器 中调整位置;
4. 按 Ctrl+C 退出,虚拟显示器随之消失。

## 触控操作

| 手势 | 效果 |
|---|---|
| 单指点按 | 鼠标左键点击 |
| 单指拖动 | 按住左键拖动 |
| 双指拖动 | 滚动 |
| 长按 0.5 秒 | 右键 |

## 参数

| 参数 | 默认值 | 说明 |
|---|---|---|
| `--size` | `1600x1200` | 虚拟显示器像素,iPad 为 4:3,原生 `2048x1536` |
| `--scale` | `1` | GNOME 界面缩放,`2` 为 HiDPI |
| `--fps` | `30` | 最大帧率 |
| `--quality` | `75` | JPEG 质量 1–100 |
| `--port` | `8800` | HTTP 端口 |
| `--token` | 随机 | 访问令牌 |

## USB 有线连接

插上 iPad,开启「个人热点」并允许 USB,Ubuntu 会出现一个有线网络(ipheth),
使用脚本打印的对应 IP 即可,延迟比 Wi-Fi 低。

## 已知限制

- 依赖 Mutter 的私有 D-Bus 接口(`ScreenCast.RecordVirtual` / `RemoteDesktop`),在 GNOME 42 上验证,其他版本可能失效。
- 使用 MJPEG(本机没有 H.264 编码器),带宽比 H.264 高。
- 无键盘透传、无音频、无 Apple Pencil 压感。
- 任何拿到令牌的局域网设备都能控制本机,请勿泄露地址。

## License

MIT
