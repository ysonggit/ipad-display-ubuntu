# ipad-display-ubuntu

在 **Ubuntu 22.04 (GNOME / Wayland)** 上把 iPad 当作**第二块显示器**,类似 macOS 的 Sidecar。
*Use an iPad as a second display on Ubuntu 22.04 (GNOME/Wayland), like macOS Sidecar.*

iPad 端**无需安装任何 App**,只用 Safari。完整原理与图文说明见 [docs/index.html](docs/index.html)。

## 快速开始

```bash
sudo apt install python3-gi gir1.2-gst-plugins-base-1.0 python3-gst-1.0 \
  gstreamer1.0-pipewire gstreamer1.0-plugins-good gstreamer1.0-plugins-base qrencode
./ipad-display --size 2048x1536 --scale 2
```

**第一次(配对,不用打字):**

1. 终端会显示二维码,用 iPad **相机**扫描,Safari 自动打开并完成配对;
2. 分享 → 添加到主屏幕;
3. 把窗口拖到新出现的显示器上,或在 设置 → 显示器 中调整位置。

**以后:** 运行脚本,点主屏幕图标即可。Ctrl+C 退出,虚拟显示器随之消失。

不方便扫码(或没装 `qrencode`)时,在 Safari 打开 `http://主机名.local:8800`,输入终端显示的 **6 位配对码**。
如果主屏幕图标提示输入配对码,在终端里看新的码输入一次即可(iOS 的主屏幕 App 有独立的 Cookie 存储)。

每台 iPad 配对后保存 90 天;配对码和二维码是一次性的,用过即换新,30 分钟未用也会换新。

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
| `--port` | `8800` | HTTP 端口;`80` 可省略端口号,需先 `sudo sysctl net.ipv4.ip_unprivileged_port_start=80` |
| `--cookie-days` | `90` | 配对有效天数 |
| `--list-devices` | | 列出已配对设备并退出 |
| `--forget` | | 取消所有设备配对并退出 |
| `--no-pairing` | | 关闭认证(仅限可信网络) |

## USB 有线连接

插上 iPad,开启「个人热点」并允许 USB,Ubuntu 会出现一个有线网络(ipheth),
脚本会自动识别并优先使用该网络的地址(通常是 `172.20.10.x`),二维码也指向它,延迟比 Wi-Fi 低。

## 已知限制

- 依赖 Mutter 的私有 D-Bus 接口(`ScreenCast.RecordVirtual` / `RemoteDesktop`),在 GNOME 42 上验证,其他版本可能失效。
- 使用 MJPEG(本机没有 H.264 编码器),带宽比 H.264 高。
- 无键盘透传、无音频、无 Apple Pencil 压感。
- 使用明文 HTTP:Cookie 在不可信的 Wi-Fi 上可能被嗅探,请只在家庭网络或 USB 热点下使用。
- 配对记录保存在 `~/.config/ipad-display/devices.json`(仅存哈希);PIN 连续错 5 次会锁定该来源 5 分钟。

## License

MIT
