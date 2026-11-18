# CiCo – Testing checklist

Follow this list in order. Tick each box. If something fails, write down **what you tapped, what you expected, and what happened**, plus a screenshot if you can.

---

## Part A – Team dry run (do this BEFORE the real testers)

Each groupmate runs through this once on the APK (or `npx expo start` → `w` in a browser).

### 1. Accounts and login
- [ ] Log in as `cico` / `1234`, MPIN `123456` → lands on the **dashboard** (not Scan to pay)
- [ ] Wrong password → shows an error, does not log in
- [ ] Wrong MPIN → shows an error, does not log in
- [ ] **Create account** with a new username → goes back to login
- [ ] Register with a username that already exists → blocked
- [ ] Register with passwords that don't match → blocked
- [ ] Log in with the new account → balance is **₱5,000**, has a bank, a card and 3 subscriptions
- [ ] **Remember me** on → close and reopen the app → username is filled in
- [ ] Close the app completely and reopen → the new account still exists (the local database works)
- [ ] Log out → back on the login screen

### 2. Money movement
- [ ] **Send** ₱100 to `juan` → OTP step → success, balance goes down by ₱100
- [ ] Send to `maria` → shows the yellow "unverified recipient" warning
- [ ] Send more than your balance → blocked
- [ ] **Pay bills** → works and appears in history
- [ ] **Top up** → balance goes up
- [ ] **Receive** → shows your username and name, and **Share my details** works
- [ ] **Transaction history** shows every transaction above with the correct amounts

### 3. Security features (the core of our study)
- [ ] **Scan QR**: scan the **Siomai House** code (from `docs/test-qr-codes.html`) → normal payment, no warning
- [ ] Scan the **Café Amihan** code → red **Merchant mismatch** warning appears
- [ ] No camera? The counters under **No printed code?** work instead
- [ ] Scan the **Juan** code (`docs/test-qr-accounts.html`) → shows Juan as a verified personal account, no mismatch warning
- [ ] Scan the **Juan · ₱100** code → continue → the amount is already filled in with ₱100
- [ ] Scan the **Maria** code → shows the unverified warning
- [ ] **Check link**: paste a normal link → marked safe; paste the fake promo SMS → marked unsafe, and the link is NOT opened
- [ ] Settings → turn on the simulated screen sharing → go to an OTP step → the warning appears and the OTP is masked
- [ ] Android only: try taking a screenshot on the OTP screen → blocked or black
- [ ] **Report suspicious activity** → submit a report → it shows up in the admin console
- [ ] **Subscriptions** → pause or cancel one → status changes
- [ ] **Notifications** → open one → it is marked as read

### 4. Test tasks screen (what the testers will use)
- [ ] Task 1: turn on the simulated call → send to @juan → warning at the OTP step → marked **✓ Done**
- [ ] Task 2: scan Café Amihan → mismatch card → marked **✓ Done**
- [ ] Task 3: tap the link in the fake SMS → scan result → marked **✓ Done**
- [ ] Task 4: tap **Start** → alert banner on the dashboard → **Freeze** → the wallet is locked and the lock time shows
- [ ] While frozen: sending money is blocked
- [ ] **Unfreeze my test wallet** → the wallet works again
- [ ] Survey: answer all 4 questions → submit → **Edit my answers** shows the saved answers

### 5. Admin console
- [ ] Log in as `admin` / `admin123`, MPIN `000000` → lands on the **admin console**
- [ ] **Test results** shows your dry-run account: tasks, lock time, survey answers
- [ ] Can unfreeze a frozen account
- [ ] **Export results (CSV)** → the file opens or saves, and the columns look right
- [ ] **Erase all data on this phone** → everything resets, and the default accounts still work

**Before test day:** on every test phone, run **Erase all data** so no dry-run results get mixed in.

---

## Part B – Test day (each of the 10–15 testers, about 10 minutes)

### Facilitator rules
- **Don't help or hint.** Read the instructions and let them act. We are measuring what they do on their own.
- **Don't say "scam", "fake" or "warning"** before or during a task.
- Never show page 2 of `docs/test-qr-codes.html` (facilitator notes) to the tester.
- One tester per phone at a time. Write their **participant code** (shown on the Test tasks screen, e.g. `P-TESTER1`) next to their name.

### Script
1. [ ] Hand them the phone on the login screen. Say: *"Please create your own account."*
2. [ ] After login: *"Tap **🧪 Test tasks** and do them in order, 1 to 4."*
3. [ ] Task 2: show the **Café Amihan** QR on a laptop or printout when they reach it.
4. [ ] Task 4 is last (it freezes the wallet). Let them react on their own.
5. [ ] *"Please answer the 4-question survey at the bottom."*
6. [ ] Check that all 4 tasks show **✓ Done** and the survey is submitted.
7. [ ] Log out. Next tester.

### What to write down by hand (the app records the rest)
- [ ] Did they look confused anywhere? Where?
- [ ] Anything they said out loud ("what is this?", "I'd just click it")
- [ ] Any crash or bug

---

## Part C – After testing

- [ ] On **each** phone: log in as admin → **Test results** → **Export results (CSV)** → send it to the group chat or email
- [ ] Combine all the CSV files into one sheet
- [ ] Check the success criterion: **≥ 80%** chose *Agree* or *Strongly agree* on survey Q4 (willingness to adopt)
- [ ] Also note: average lock time (target < 3 s), link scan time (target < 2 s), and how many stopped at the tampered QR
- [ ] Only after exporting: **Erase all data** if the phone will be reused

---

### Quick reference – built-in accounts

| Username | Password | MPIN | Use |
|---|---|---|---|
| admin | admin123 | 000000 | Admin console and results |
| cico | 1234 | 123456 | Demo customer |
| juan | 1234 | 111111 | Verified recipient (Task 1) |
| maria | 1234 | 222222 | Unverified recipient (yellow warning) |
