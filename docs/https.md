# HTTPS and offline mode

Offline mode needs HTTPS. Browsers give a service worker only to a page served over HTTPS, or to
`http://localhost` on the same machine. So:

- **Only on the machine that runs the quiz:** no certificate needed. Run the production build
  (`pnpm --dir quiz build`, then start it as in step 3) and `http://localhost:3000/` (or the port you start it on) works offline.
  The development server (`next dev`) never works offline.
- **From a phone, tablet or another computer:** serve the quiz over HTTPS with a home-made
  certificate, and install its root on every device that opens it. This page says how.

The certificate is yours alone: you make it, and the key that signed it is deleted as soon as the
script ends, so nothing else can be signed with it afterwards. Install it only on your own devices.

## 1. Pick the name devices will open

Use the quiz machine's address on your home network (the commands below find it), or its local
name, for example `quiz-mac.local`. An IP address works on every phone; some Android phones do
not resolve `.local` names. Give the machine a fixed address in your router, or the certificate
stops matching when the address changes.

Find the address:

| System | Command |
|---|---|
| macOS | `ipconfig getifaddr en0` |
| Linux | `hostname -I` |
| Windows | `ipconfig` (the IPv4 Address line) |

The examples below use `127.0.0.1` as a stand-in. Put your machine's network address in its place:
a phone cannot reach `127.0.0.1`, which always means the device itself.

## 2. Make the certificate

The script needs `bash` and `openssl`.

| System | Where to run it |
|---|---|
| macOS, Linux | Any terminal. Both ship `openssl`. |
| Windows | Git Bash (comes with [Git for Windows](https://git-scm.com/download/win)), or WSL. |

From the repository root:

```bash
# Replace 127.0.0.1 with your machine's network address.
bash scripts/make-cert.sh certs 127.0.0.1
```

It writes three files to `certs/`, which git ignores:

| File | Goes to |
|---|---|
| `quiz-ca.crt` | Every device that opens the quiz (step 5). Not secret. |
| `quiz.crt` | The HTTPS server (step 4). |
| `quiz.key` | The HTTPS server only. Secret: never copy it anywhere else. |

The certificate also covers `localhost` and `127.0.0.1`. It lasts 825 days, the most Apple
accepts. The script refuses to overwrite an existing set.

## 3. Run the quiz

Build the quiz, then start it on this machine only, telling it which home-network name it may
answer to. A service worker needs this production build; the development server (`next dev`)
does not give offline mode.

```bash
pnpm --dir quiz build
```

```bash
# Replace the first 127.0.0.1 with your machine's network address; keep -H 127.0.0.1.
QUIZ_LAN_HOST=127.0.0.1 NEXT_TELEMETRY_DISABLED=1 pnpm --dir quiz exec next start -H 127.0.0.1 -p 47830
```

`-H 127.0.0.1` keeps port 47830 closed to the network, so devices reach the quiz only through nginx
and its allow list in step 4. (`pnpm --dir quiz start` listens on every network interface
instead, on port 3000; if you use it, block that port in the machine's firewall.)

`QUIZ_LAN_HOST` takes the host name or address only, with no `https://` and no port. Without it
the quiz answers to `localhost` only, and refuses to save answers sent from any other address.

The voice features need macOS (`say`), so run the quiz on a Mac to have them; everything else runs
on Linux and Windows too.

## 4. Serve it over HTTPS

[nginx](https://nginx.org) takes HTTPS on port 443 and passes it to the quiz on port 47830. Save
this as `quiz-https.conf`, with the full path to your `certs/` folder in both certificate lines:

```nginx
server {
    # default_server: a browser opening an IP address sends no TLS server name.
    listen              443 ssl default_server;
    server_name         _;
    ssl_certificate     /full/path/to/certs/quiz.crt;
    ssl_certificate_key /full/path/to/certs/quiz.key;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location / {
        # This machine and private network ranges only. Anything allowed here can save and
        # reset answers, so narrow it to your own network's range.
        allow 127.0.0.1;
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny  all;
        proxy_pass         http://127.0.0.1:47830;
        proxy_http_version 1.1;
        # Both are required: the quiz checks that the page's Origin matches this Host, over https.
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }
}
```

| System | Install nginx | Put the file in | Load it |
|---|---|---|---|
| macOS ([Homebrew](https://brew.sh)) | `brew install nginx` | `/opt/homebrew/etc/nginx/servers/` | `nginx -t`, then `brew services restart nginx` |
| Debian, Ubuntu | `sudo apt install nginx` | `/etc/nginx/conf.d/` | `sudo nginx -t`, then `sudo systemctl reload nginx` |
| Fedora | `sudo dnf install nginx` | `/etc/nginx/conf.d/` | `sudo nginx -t`, then `sudo systemctl reload nginx` |
| Windows | [nginx for Windows](https://nginx.org/en/docs/windows.html) | `conf/`, and add `include quiz-https.conf;` inside `http { }` in `conf/nginx.conf` | `nginx -t`, then `nginx -s reload` |

Allow port 443 through the machine's firewall if a phone cannot connect.

## 5. Trust the certificate on each device

Install `quiz-ca.crt`, the root, not `quiz.crt`. Copy it to the device by AirDrop, email, a USB
cable or a cloud folder.

### iPhone and iPad

1. Open `quiz-ca.crt` on the device (AirDrop it, or tap it in Mail or Files), then tap **Allow**.
2. **Settings › General › VPN & Device Management**: tap the downloaded profile, then **Install**.
3. **Settings › General › About › Certificate Trust Settings**: turn on full trust for
   *Star Exam Companion home root*.

Apple's steps: [Trust manually installed certificate profiles](https://support.apple.com/en-us/102390).

### Android

1. Copy `quiz-ca.crt` to the phone's Downloads.
2. **Settings › Security & privacy › More security settings › Encryption & credentials ›
   Install a certificate › CA certificate**, accept the warning, and pick the file. Menu names
   differ by maker; search Settings for "CA certificate".

Chrome trusts it at once. Firefox for Android needs **Settings › About Firefox**, tap the logo
five times, then **Settings › Secret Settings › Use third party CA certificates**.

### macOS

```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/quiz-ca.crt
```

Or open `quiz-ca.crt` in Keychain Access, add it to **System**, open it, and set **When using this
certificate** to **Always Trust**. Safari and Chrome use this; Firefox does too, as long as
`security.enterprise_roots.enabled` is on in `about:config`.

### Windows

In PowerShell, for your own account:

```powershell
Import-Certificate -FilePath .\certs\quiz-ca.crt -CertStoreLocation Cert:\CurrentUser\Root
```

Or double-click `quiz-ca.crt`, **Install Certificate**, **Place all certificates in the following
store**, **Trusted Root Certification Authorities**. Edge and Chrome use this store; Firefox does
too, as long as `security.enterprise_roots.enabled` is on in `about:config`.

### Linux

System-wide, which `curl` and most tools use:

| Distribution | Commands |
|---|---|
| Debian, Ubuntu | `sudo cp certs/quiz-ca.crt /usr/local/share/ca-certificates/` then `sudo update-ca-certificates` |
| Fedora, RHEL | `sudo cp certs/quiz-ca.crt /etc/pki/ca-trust/source/anchors/` then `sudo update-ca-trust` |
| Arch | `sudo trust anchor certs/quiz-ca.crt` |

Chrome and Chromium on Linux keep their own store. Add it there with `certutil` from the
`libnss3-tools` package:

```bash
certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n "Star Exam Companion home root" -i certs/quiz-ca.crt
```

In Firefox: **Settings › Privacy & Security › Certificates › View Certificates › Authorities ›
Import**, and tick **Trust this CA to identify websites**.

## 6. Check it

1. Open `https://127.0.0.1/` (your address) on the device. It loads with no certificate warning.
2. Add it to the home screen: **Share › Add to Home Screen** in Safari, **⋮ › Add to Home
   screen** in Chrome.
3. Tap the laptop icon in the header: **Secure / Offline** says *Yes / Ready*.

Offline, answers wait on the device and reach the quiz machine the next time the app is open on
the home network with that machine awake. iOS has no background sync, so nothing is sent while
the app is closed.

## Renewing or removing it

Before the 825 days run out, move `certs/` away, run step 2 again, reload nginx, and install the
new `quiz-ca.crt` on each device (step 5). Remove the old root from each device: it is the
profile under **VPN & Device Management** on iOS, **Trusted credentials › User** on Android, and
the *Star Exam Companion home root* entry in each system's certificate store.
