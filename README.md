# ipad-display-ubuntu

在 **Ubuntu 22.04 (GNOME / Wayland)** 上把 iPad 当作**第二块显示器**,类似 macOS 的 Sidecar。
*Use an iPad as a second display on Ubuntu 22.04 (GNOME/Wayland), like macOS Sidecar.*

iPad 端**无需安装任何 App**,只用 Safari。完整原理与图文说明见 [docs/index.html](docs/index.html)。

## 快速开始

```bash
sudo apt install python3-gi gir1.2-gst-plugins-base-1.0 python3-gst-1.0 \
  gstreamer1.0-pipewire gstreamer1.0-plugins-good gstreamer1.0-plugins-base qrencode
./extension/install.sh        # 顶栏菜单 + 后台服务;然后注销并重新登录一次
```

之后**不用命令行**:点顶栏的 **iPad 图标**:

- 打开开关 → 虚拟显示器出现,菜单里直接显示**二维码和配对码**;
- 用 iPad 相机扫码配对,分享 → 添加到主屏幕;以后点图标即可;
- 菜单里选 **横屏/竖屏**、**左/右/上/下**、**Wi-Fi/USB**(运行中修改会自动重启生效);
- 打开“登录时启动”,开机后自动可用。

同一个扩展还会让拖到 iPad 上的窗口自动铺满 iPad(见下文)。

<details><summary>命令行用法(可选)</summary>

```bash
./ipad-display --position left                         # 横屏
./ipad-display --position left --orientation portrait  # 竖屏
```

终端会显示二维码和配对码;Ctrl+C 退出。不要和顶栏菜单启动的服务同时运行(会抢 8800 端口)。

</details>

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
| `--size` | `auto` | `auto`:按 iPad 屏幕比例(首次连接时学习,下次启动生效);或固定 `宽x高` |
| `--orientation` | `landscape` | `landscape` 横屏 / `portrait` 竖屏,运行期间固定(与 Sidecar 一样) |
| `--max-edge` | `1600` | auto 模式下长边像素,越大越清晰但越吃性能 |
| `--position` | `right` | iPad 屏幕在内置屏幕的 `left` / `right` / `above` / `below` |
| `--scale` | `1` | GNOME 界面缩放,`2` 为 HiDPI |
| `--fps` | `30` | 最大帧率(在 Mutter 一侧限流,减轻合成器负担) |
| `--quality` | `75` | JPEG 质量 1–100 |
| `--port` | `8800` | HTTP 端口;`80` 可省略端口号,需先 `sudo sysctl net.ipv4.ip_unprivileged_port_start=80` |
| `--cookie-days` | `90` | 配对有效天数 |
| `--list-devices` | | 列出已配对设备并退出 |
| `--forget` | | 取消所有设备配对并退出 |
| `--no-pairing` | | 关闭认证(仅限可信网络) |
| `--usb` | | 只走 USB 数据线;插线出现显示器,拔线移除 |
| `--usb-doctor` | | 诊断 USB 连接并退出 |
| `--usb-iface` | | 手动指定 USB 网卡名(自动识别失败时) |

## 屏幕位置与黑边

- GNOME 42 的“设置 → 显示器”不能拖动这块虚拟屏幕,所以用 `--position left|right|above|below` 指定位置;其他显示器变化导致 GNOME 重新排列时,脚本会自动把它放回原位。
- **横竖屏在启动时选定,运行中不跟随旋转**(Apple Sidecar 也只支持横屏)。原因:GNOME 42 在虚拟显示器运行中改变尺寸时会绘制错误(下半部分变成灰色),只有在创建时就确定尺寸才正常。
  - 横屏:`./ipad-display --position left`(默认)
  - 竖屏:`./ipad-display --position left --orientation portrait`
  - 拿反了方向时,iPad 上会提示“旋转到横屏/竖屏”。
- 默认 `--size auto`:第一次连接时 iPad 会上报屏幕比例,脚本记在 `~/.config/ipad-display/size.json`,**下次启动**按这个比例创建显示器,从而没有黑边。
- 为了没有黑边,请用「添加到主屏幕」的图标打开(全屏),不要在带地址栏的 Safari 标签里用。
- 想要更清晰:`./ipad-display --max-edge 2048 --scale 2`(GNOME 界面 2 倍缩放,等效 1024 宽)。

## 窗口自动铺满 iPad(GNOME 扩展)

GNOME 不会在窗口移到另一块显示器时调整大小,窗口拖到较小的 iPad 上会超出屏幕。
附带的扩展让落到 iPad 显示器上的窗口**自动最大化、铺满 iPad**;不能最大化的窗口和对话框会缩小并移到屏幕内。
拖回笔记本屏幕时,GNOME 会自动恢复原来的大小。

由 `./extension/install.sh` 一并安装(和顶栏菜单是同一个扩展)。

- 适用于:鼠标拖过去松手、`Super+Shift+→/←` 移过去、直接在 iPad 上打开的新窗口。
- 不影响桌面图标(DING)等辅助窗口和全屏窗口。
- 关闭:`gnome-extensions disable ipad-display-helper@ysonggit.github.io`

## 性能与稳定

- 帧率在 Mutter 一侧限制(`max-framerate`),并在颜色转换之前丢帧;触摸移动事件按显示帧合并,避免淹没合成器。
- 如果仍然卡顿:降低 `--max-edge` / `--fps` / `--quality`,或改用 USB 连接。

## USB 数据线连接(推荐)

iOS 只允许电脑**主动连到** iPad(usbmuxd),不允许 iPad 上的 Safari 通过数据线连回电脑。
唯一能让 Safari 经数据线访问电脑的通道,是 iPad 的 **USB 网络**(个人热点,Linux 驱动 `ipheth`):
iPad 自己是 `172.20.10.1`,Ubuntu 拿到 `172.20.10.x`,画面和触控都走这根线,不经过 Wi-Fi。

```bash
./ipad-display --usb-doctor          # 逐项检查:设备、信任、驱动、网卡、IP、连通性
./ipad-display --usb --position left
```

1. 用数据线连接 iPad,解锁,弹出“信任此电脑”时点**信任**;
2. iPad:设置 → 个人热点 → 打开“允许其他人加入”(不需要 Wi-Fi 密码,也不会用蜂窝流量给电脑上网以外的用途);
3. 终端出现二维码,扫码配对、添加到主屏幕;以后插线 + 点图标即可。

`--usb` 模式下:
- **只**在 USB 网卡上提供服务,来自 Wi-Fi / 其他网卡的请求一律拒绝;
- 插上线才创建虚拟显示器,拔掉 5 秒后自动移除(5 秒内重新插上不受影响);
- JPEG 质量默认提高到 85(线缆带宽充足)。

开机自动运行:在顶栏菜单里选“连接 → USB”,并打开“登录时启动”。

> 关于雷雳 / USB 3 线:iPad 的 USB 网络是 USB 2 级别(约几百 Mbit/s),线缆规格不影响速度;
> 但这已远超画面所需(约 3–8 MB/s),优势在于延迟稳定、不受 Wi-Fi 干扰,同时还能给 iPad 充电。
>
> **仅 Wi-Fi 版 iPad 没有“个人热点”**,无法建立 USB 网络,只能用 Wi-Fi 模式。

### 个人热点打不开(灰色 / 被强制关闭)时

iOS 只有在**装了 SIM、蜂窝数据已打开、运营商允许热点**时才能开个人热点;
屏幕使用时间里的“蜂窝数据更改 = 不允许”或公司 MDM 描述文件也会禁用它。没有 SIM 就无法开启。

替代的有线方案:**以太网转接器**(USB-C 口的 iPad 原生支持)

```
iPad ─ USB-C 以太网转接器 ─ 网线 ─ USB-C 以太网转接器 ─ MacBook Pro (Ubuntu)
```

```bash
ip -br link                                   # 找到电脑上的以太网网卡名,例如 enx00e04c680001
nmcli connection add type ethernet ifname enx00e04c680001 con-name ipad-eth ipv4.method shared
./ipad-display --usb --usb-iface enx00e04c680001 --position left
```

`ipv4.method shared` 让 Ubuntu 在这根网线上做 DHCP(电脑是 `10.42.0.1`),iPad 自动拿到地址;
`--usb-iface` 让脚本只在这块网卡上服务,其余行为与 USB 模式相同(插线出现显示器、拔线移除)。
千兆有线,延迟比 Wi-Fi 稳定;用带 PD 供电口的转接器还能同时给 iPad 充电。

## 已知限制

- 依赖 Mutter 的私有 D-Bus 接口(`ScreenCast.RecordVirtual` / `RemoteDesktop`),在 GNOME 42 上验证,其他版本可能失效。
- 使用 MJPEG(本机没有 H.264 编码器),带宽比 H.264 高。
- 无键盘透传、无音频、无 Apple Pencil 压感。
- 使用明文 HTTP:Cookie 在不可信的 Wi-Fi 上可能被嗅探,请只在家庭网络或 USB 热点下使用。
- 配对记录保存在 `~/.config/ipad-display/devices.json`(仅存哈希);PIN 连续错 5 次会锁定该来源 5 分钟。

## License

MIT
