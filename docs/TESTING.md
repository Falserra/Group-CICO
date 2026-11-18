# CiCo – Test build guide (Activity 7: 7-day live simulation)

For the facilitators running the 10–15 participant test.

## 1. Build the APK

The APK is built in the cloud with EAS. You don't need Android Studio.

```bash
npx eas-cli@latest login                                   # free Expo account, one time only
npx eas-cli@latest build -p android --profile preview      # takes about 10–20 min
```

When the build finishes, EAS prints a link and a QR code. Open the link on each test phone, download the `.apk` and install it. Android will ask you to allow installs from the browser.

For a later build after code changes, raise `android.versionCode` in `app.json` (1 → 2 → 3…) so the new APK installs over the old one.

## 2. What is stored on the phone

- All data lives in a local SQLite database (`cico.db`) inside the app. **No internet is needed** and nothing leaves the phone.
- Accounts, balances, transactions, reports, task results and survey answers stay saved after the app is closed or the phone restarts.
- Passwords and MPINs are stored as salted SHA-256 hashes, never as plain text.
- Uninstalling the app or clearing its storage erases everything. **Export the results first** (see step 4).

## 3. Running a session (about 10 minutes per participant)

1. The participant taps **Create account** and registers. New accounts get ₱5,000 of test money, a linked bank and card, and 3 subscriptions.
2. On the dashboard they open **🧪 Test tasks** and work through them in order:

   | # | Task | What the app records |
   |---|------|----------------------|
   | 1 | Screen-sharing OTP shield: turn on the simulated call, then send money to @juan | Cancelled vs. continued with the masked OTP |
   | 2 | Tampered counter QR: scan the **Café Amihan** code from `docs/test-qr-codes.html` | Paused and cancelled vs. paid anyway |
   | 3 | Suspicious promo link: tap the link in the fake SMS | Scan time (target < 2 s), whether they tried to open it |
   | 4 | Emergency freeze: tap Start, then react to the alert on the dashboard | Time-to-lock (target < 3 s), reaction time |

3. They finish with the **4-question survey**. Willingness to adopt counts as *Agree* or *Strongly agree* on Q4.
4. Task 4 freezes their wallet. They can tap **Unfreeze my test wallet** on the Test tasks screen, or you can unlock them from the admin console.

Show `docs/test-qr-codes.html` on a laptop screen or print page 1. Page 2 holds the facilitator notes; keep it away from participants. If scanning fails, participants can tap the same counters under **No printed code?** in the scanner.

Phones cannot tell an app that a Messenger call is sharing the screen, so Task 1 uses the in-app "Simulated Messenger call" switch. The OTP screen still blocks real screenshots and recordings on Android: a real screen share shows black.

## 4. Collecting results

Log in as **admin / admin123** (MPIN `000000`), then open **Test results**:

- Adoption rate vs. the ≥ 80% success criterion, the average Likert score for each question, time-to-lock and the tampered-QR stop rate.
- **Export results (CSV)** opens the share sheet. Send the file to yourself through Messenger, email or Notes. Do this on **every** test phone and combine the files.
- **Erase all data on this phone** resets the device for a new round, after you have exported.

## Accounts that already exist on every install

| Username | Password | MPIN | Purpose |
|---|---|---|---|
| admin | admin123 | 000000 | Facilitator / Security console |
| cico | 1234 | 123456 | Demo customer |
| juan | 1234 | 111111 | Recipient for Task 1 (verified) |
| maria | 1234 | 222222 | Unverified recipient (shows a yellow warning) |
| siomai.house / cafe.amihan / benjie.r | – | – | Merchants and the scammer account behind the QR codes |
