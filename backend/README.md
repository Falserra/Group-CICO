# CiCo backend (PHP + MySQL)

The app talks to this folder over HTTP/JSON. Passwords and MPINs are hashed with bcrypt, sessions are
random tokens, money transfers run in one row-locked database transaction, and profile photos are
stored in the database.

* **Putting it online:** see [docs/DEPLOY.md](../docs/DEPLOY.md) (Render + TiDB Cloud, free tier).
* **Running it on your own PC with XAMPP:** below.

## Local setup (XAMPP)

1. **Serve the folder with Apache.** One-time, in PowerShell (a junction, so edits here are live):

   ```powershell
   New-Item -ItemType Junction -Path C:\xampp\htdocs\cico-api -Target C:\Users\admin\Desktop\mobprog\backend
   ```

2. **Pick a MySQL server.** If the `MySQL80` Windows service is running it owns port 3306: copy
   `config.local.example.php` to `config.local.php` and put your MySQL root password in it. (If you use XAMPP's
   own MySQL instead, no config is needed.) `config.local.php` is git-ignored.

3. **Start Apache** in the XAMPP control panel, then create the database. For development with sample accounts:

   ```powershell
   C:\xampp\php\php.exe C:\Users\admin\Desktop\mobprog\backend\setup.php --demo
   ```

   Without `--demo` you must choose the administrator's credentials instead:
   `--admin-password=<10+ characters> --admin-mpin=<6 digits>`.
   `--fresh --yes` deletes every CiCo table first.

4. Check <http://localhost/cico-api/index.php/health>.

`--demo` creates `cico`, `juan` and `maria` (password `1234`, MPINs `123456`, `111111`, `222222`) and
`admin` (`admin123`, MPIN `000000`). **Never use `--demo` on a server other people can reach.**

## Configuration

Everything comes from environment variables (see `config.php`); `config.local.php` fills in the rest.
If `CICO_DB_HOST` or `CICO_DB_PORT` is set, `config.local.php` is ignored, so hosting and tests can never be
redirected to another database by a stray local file.

| Variable | Default | Meaning |
|---|---|---|
| `CICO_DB_HOST` / `_PORT` / `_NAME` / `_USER` / `_PASS` | 127.0.0.1 / 3306 / cico / root / (empty) | database connection |
| `CICO_DB_SSL` | 0 | use TLS (cloud databases require it) |
| `CICO_DB_SSL_CA`, `CICO_DB_SSL_VERIFY` | bundled CA, 1 | CA file and certificate checking |
| `CICO_DEBUG` | 0 | include technical detail in server errors |
| `CICO_SANDBOX_KIT` | 0 | give new accounts sample linked accounts and auto-deductions |

## Where the app looks for the server

* Production: `EXPO_PUBLIC_API_URL` (set in `eas.json` for builds, or a `.env` file for development)
* Development fallback: Android emulator `http://10.0.2.2/cico-api/index.php`, browser `http://localhost/cico-api/index.php`,
  real phone: the PC that runs `npx expo start`

## Layout

```
index.php        front controller (routes are <server>/index.php/<route>)
setup.php        command-line installer (never reachable over the web)
config.php       settings
sql/schema.sql   tables (10, InnoDB, foreign keys, CHECK constraints)
lib/             database, auth, serializers, seed data
routes/          auth, me (profile + photo), sync, money, funding, safety, admin
certs/           CA certificate for TLS database connections
Dockerfile       container image used by Render
```
