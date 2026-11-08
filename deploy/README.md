# 线上部署

线上地址：<https://splendor.zulogic.cn>

## 架构

```
浏览器 ── HTTPS/WSS ──> 1Panel OpenResty (Docker, host 网络)
                         ├─ :80    → 301 跳转 https
                         ├─ :443   → stream ssl_preread → 127.0.0.1:9443
                         └─ 127.0.0.1:9443 ssl proxy_protocol
                                  └─ proxy_pass http://127.0.0.1:3101
                                          └─ systemd: splendor (Node 24)
                                                  └─ /opt/splendor  (dist + server + shared)
```

- Node 服务只监听 `127.0.0.1:3101`，不直接暴露公网。
- 证书复用 1Panel 的通配符证书 `/opt/1panel/www/ssl/zulogic.cn/{fullchain,privkey}.pem`（SAN：`*.zulogic.cn`）。
- 静态资源与 WebSocket（`/ws`）由同一个 Node 进程提供，Nginx 侧已开启 Upgrade 与 3600s 长超时。

## 文件说明

| 文件 | 作用 | 服务器位置 |
| --- | --- | --- |
| `splendor.service` | systemd 单元 | `/etc/systemd/system/splendor.service` |
| `splendor.zulogic.cn.conf` | 站点 server 块 | `/opt/1panel/www/conf.d/splendor.zulogic.cn.conf` |
| `splendor-proxy.conf` | 反代 location | `/opt/1panel/www/sites/splendor.zulogic.cn/proxy/proxy.conf` |

## 首次部署

```bash
# 1. 本地打包（dist 必须先 npm run build）
tar -czf deploy/splendor-deploy.tar.gz dist server shared package.json package-lock.json

# 2. 上传并解压
scp deploy/splendor-deploy.tar.gz guan:/opt/splendor-deploy.tar.gz
ssh guan "mkdir -p /opt/splendor && tar -xzf /opt/splendor-deploy.tar.gz -C /opt/splendor"

# 3. 安装生产依赖（系统自带 node 12 太旧，需用 nvm 的 Node 24）
ssh guan "export PATH=/root/.nvm/versions/node/v24.12.0/bin:\$PATH; cd /opt/splendor && npm ci --omit=dev"

# 4. 安装 systemd 服务
scp deploy/splendor.service guan:/etc/systemd/system/splendor.service
ssh guan "systemctl daemon-reload && systemctl enable --now splendor"

# 5. 安装站点配置
ssh guan "mkdir -p /opt/1panel/www/sites/splendor.zulogic.cn/{index,log,proxy}"
scp deploy/splendor.zulogic.cn.conf guan:/opt/1panel/www/conf.d/splendor.zulogic.cn.conf
scp deploy/splendor-proxy.conf guan:/opt/1panel/www/sites/splendor.zulogic.cn/proxy/proxy.conf
ssh guan "docker exec 1Panel-openresty-qfVZ nginx -t && docker exec 1Panel-openresty-qfVZ nginx -s reload"
```

## 更新版本

```bash
npm run build
tar -czf deploy/splendor-deploy.tar.gz dist server shared package.json package-lock.json
scp deploy/splendor-deploy.tar.gz guan:/opt/splendor-deploy.tar.gz
ssh guan "tar -xzf /opt/splendor-deploy.tar.gz -C /opt/splendor && rm -f /opt/splendor-deploy.tar.gz && systemctl restart splendor"
```

依赖有变动时再执行一次 `npm ci --omit=dev`。

## 运维命令

```bash
ssh guan "systemctl status splendor"          # 服务状态
ssh guan "journalctl -u splendor -n 50"       # 最近日志
ssh guan "systemctl restart splendor"         # 重启
ssh guan "curl -s http://127.0.0.1:3101/api/health"
```

## 验收

```bash
node scripts/prod-check.mjs   # 线上首页、建房、开局、皮肤、静态资源
node scripts/multiplayer.mjs https://splendor.zulogic.cn   # 线上双人联机、重连、聊天
```

> 房间状态保存在内存中，`systemctl restart splendor` 会清空所有进行中的房间。
