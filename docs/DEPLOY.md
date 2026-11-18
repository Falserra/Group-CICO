# Putting CiCo online (free tier: TiDB Cloud + Render)

The app talks to a PHP API; the API talks to a MySQL database. For a real deployment both live on
the internet, so the phone works anywhere and your PC can be off.

```
phone app ──HTTPS──▶ Render (PHP API, Docker) ──TLS──▶ TiDB Cloud (MySQL-compatible database)
```

Free tiers change. Check each site's current limits when you sign up. Known trade-off of Render's
free plan: the API **sleeps after 15 idle minutes** and takes up to a minute to wake on the next
request. Open the app a few minutes before a presentation.

Not tested yet: I could not run Docker or create these accounts from here, so steps 1-3 are the first
real run. If something fails, copy the error and we fix it together.

## 1. Create the database (TiDB Cloud)

1. Sign up at <https://tidbcloud.com> and create a **Starter** (free) cluster.
2. Open **Connect** and choose a *public endpoint*. Note the **host**, **port** (4000), **user** and
   set a **password**.
3. Create a database called `cico` (the SQL editor: `CREATE DATABASE cico;`), or use the default one
   and set `CICO_DB_NAME` to its name below.

## 2. Create the tables and the administrator (from your PC, once)

Pick a strong admin password (10+ characters) and a 6-digit admin MPIN. In PowerShell:

```powershell
$env:CICO_DB_HOST = "<host from TiDB>"
$env:CICO_DB_PORT = "4000"
$env:CICO_DB_USER = "<user from TiDB>"
$env:CICO_DB_PASS = "<password from TiDB>"
$env:CICO_DB_NAME = "cico"
$env:CICO_DB_SSL  = "1"
C:\xampp\php\php.exe C:\Users\admin\Desktop\mobprog\backend\setup.php --admin-password="<strong password>" --admin-mpin=<6 digits>
```

You should see "Tables created." and "Administrator account created". No demo accounts are added (that is
deliberate: a public server must not have accounts like `cico / 1234`). Never put these passwords in a file
that is committed to git.

If the connection fails with a certificate error, add `$env:CICO_DB_SSL_CA = "C:\path\to\ca.pem"` (TiDB's
**Connect** dialog has a CA download) and run it again.

## 3. Deploy the API (Render)

1. Push this repository to GitHub (it already has a remote).
2. On <https://render.com>: **New → Blueprint**, pick the repository. Render reads `render.yaml`.
3. When asked for the secrets, enter `CICO_DB_HOST`, `CICO_DB_USER` and `CICO_DB_PASS` (same values as step 2).
4. Wait for the deploy. Your API address looks like `https://cico-api.onrender.com`.
5. Check <https://cico-api.onrender.com/index.php/health>. It should show `{"ok":true,"status":"up",...}`.

## 4. Point the app at it and build the APK

1. In [eas.json](../eas.json) replace `https://YOUR-SERVICE.onrender.com/index.php` with your real address
   (keep `/index.php` at the end) in the `preview` and `production` profiles.
2. Build an installable Android APK in Expo's cloud:

   ```powershell
   npx eas-cli@latest login
   npx eas-cli@latest build -p android --profile preview
   ```

3. Download the APK from the link EAS prints and install it on a phone.

For testing in Expo Go against the hosted server, create a file named `.env` in the project folder containing
`EXPO_PUBLIC_API_URL=https://cico-api.onrender.com/index.php`, then restart `npx expo start`.

## Day-to-day

| Task | How |
|---|---|
| Log in as administrator | username `admin`, the password and MPIN from step 2 |
| Wipe all data and start over | rerun step 2 with `--fresh --yes` added (this deletes everything) |
| See the data | TiDB Cloud's SQL editor, or any MySQL client with the connection details |
| Update the API | push to GitHub; Render redeploys |

## Security checklist before showing it to anyone

- [ ] Admin password is long and unique; it is not written in any file in the repository.
- [ ] `CICO_DEBUG` is `0` on Render (the blueprint sets this).
- [ ] You did not run `setup.php --demo` against the hosted database.
- [ ] The API address starts with `https://`.
