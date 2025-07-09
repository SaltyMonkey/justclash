## Shadowsocks (SS)

ss://YWVzLTI1Ni1nY206cGFzczEyMw==@mydomain.com:443#SS TLS
ss://aes-256-gcm:mypassword@1.2.3.4:8388#MySSNode
ss://chacha20-ietf-poly1305:pass123@8.8.8.8:4443#FastNode
ss://YWVzLTI1Ni1jZmI6cGFzczEyMw==@ss.example.net:1443#Base64Node
ss://aes-128-gcm:secretpwd@host.com:8080#ShortName

---

## VLESS

### WebSocket (ws)
vless://c1b2c3d4-e5f6-7890-abcd-ef1234567890@vless.example.com:443?type=ws&security=tls&sni=host.com#VLESS WS TLS
vless://abcdef12-3456-7890-abcd-ef1234567890@1.2.3.4:443?type=ws&security=tls&host=cdn.com&path=%2Fws#CDN WS

### gRPC
vless://123e4567-e89b-12d3-a456-426614174000@domain.com:443?type=grpc&security=tls&serviceName=grpcService#GRPC Node
vless://b2c3d4e5-f678-9012-abcd-ef1234567890@grpc.example.com:443?type=grpc&security=tls#gRPC TLS

### Reality
vless://abcdef12-3456-7890-abcd-ef1234567890@1.2.3.4:443?type=tcp&security=reality&fp=chrome&pbk=pubkey123&sid=shortid#RealityNode
vless://cafe1234-5678-90ab-cdef-1234567890ab@reality.host:443?type=ws&security=reality&fp=firefox&pbk=pubkey456&sid=shortid2#Reality WS

---

## VMess

vmess://eyJ2IjoiMiIsInBzIjoiTXlWTWVzcyIsImFkZCI6InZtZXNzLmV4YW1wbGUuY29tIiwicG9ydCI6IjQ0MyIsImlkIjoiMTIzZTQ1NjctZTg5Yi0xMmQzLWE0NTYtNDI2NjE0MTc0MDAwIiwiYWlkIjoiMCIsIm5ldCI6IndzIiwidHlwZSI6Im5vbmUiLCJob3N0IjoiaG9zdC5jb20iLCJwYXRoIjoiL3dzIiwidGxzIjoidGxzIn0=
vmess://123e4567-e89b-12d3-a456-426614174000@1.2.3.4:443?type=ws&security=tls&host=host.com&path=%2Fws#MyVMessWS
vmess://abcdef12-3456-7890-abcd-ef1234567890@domain.com:443?type=tcp&security=tls#TCP TLS

---

## SOCKS5

socks5://user:pass@1.2.3.4:1080
socks5://proxy.example.com:1080
socks5://user@8.8.8.8:1081

---

## Trojan

trojan://mypassword@trojan.example.com:443?sni=host.com#TrojanTLS
trojan://pass123@1.2.3.4:443?type=ws&host=ws.example.com&path=%2Fws#TrojanWS
trojan://secret@domain.com:443?type=grpc&serviceName=grpcService#TrojanGRPC

---

## SSH

ssh://user:pass@ssh.example.com:22
ssh://root@1.2.3.4:2222?private-key=---BEGIN%20RSA...
ssh://user@host.com?host-key=ssh-ed25519-AAA...,ssh-rsa-BBB...

---

## Mierus

mierus://user:pass@mierus.example.com?profile=MyProfile&port=1234&protocol=TCP
mierus://admin:pwd@1.2.3.4?profile=Test&port=1000-2000&protocol=TCP
mierus://user:pass@host.com?profile=MultiPort&port=1000&protocol=TCP&port=2000&protocol=TCP
