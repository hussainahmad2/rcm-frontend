# Velora Frontend

## Start

```powershell
cd C:\RCM\frontend
npm install
npm start
```

- Site: http://127.0.0.1:5173
- Login: http://127.0.0.1:5173/login
- Workspace: http://127.0.0.1:5173/workspace (JWT required)

Start the backend first (`cd C:\RCM\backend && npm start`).

Access tokens live in memory only. Refresh tokens use an httpOnly cookie.
