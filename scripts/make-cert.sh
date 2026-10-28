#!/usr/bin/env bash
# Makes the home-made certificate that lets a phone or another computer open the quiz over HTTPS,
# which a service worker (offline mode) needs. Follows Apple's rules for a trusted TLS
# certificate, the strictest of the platforms: RSA 2048, SHA-256, every name in subjectAltName,
# serverAuth, at most 825 days. docs/https.md says how to serve and install it.
#
# Usage: scripts/make-cert.sh [output-dir] [host]
#   output-dir  default certs/ at the repo root, which git ignores
#   host        default localhost; the name or IPv4 address phones open, such as
#               quiz-mac.local or the machine's network address. localhost and 127.0.0.1 are
#               always included.
#
# Writes quiz-ca.crt (install it on each device), quiz.crt and quiz.key (for the HTTPS server).
# The root key is deleted before the script ends, so nothing else can ever be signed with this root.
set -euo pipefail
# Every file and directory this script makes is readable by the owner only.
umask 077

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/certs}"
HOST="${2:-localhost}"
DAYS=825

command -v openssl >/dev/null 2>&1 || { echo "make-cert: openssl not found" >&2; exit 1; }

# An IPv4 address with every part 0-255, or a host name of letters, digits and hyphens whose
# labels are at most 63 characters and whose whole is at most 253.
ipv4() {
  [[ "$1" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || return 1
  local part
  for part in ${1//./ }; do (( 10#$part <= 255 )) || return 1; done
}
hostname_ok() {
  (( ${#1} <= 253 )) || return 1
  # An all-digit last label is a mistyped address such as 999.1.1.1, never a real name.
  [[ "${1##*.}" =~ ^[0-9]+$ ]] && return 1
  [[ "$1" =~ ^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$ ]]
}
if ipv4 "$HOST"; then
  EXTRA="IP:$HOST"
elif hostname_ok "$HOST"; then
  EXTRA="DNS:$HOST"
else
  echo "make-cert: not a host name or IPv4 address: $HOST" >&2
  exit 1
fi
SAN="DNS:localhost,IP:127.0.0.1"
[ "$HOST" = "localhost" ] || [ "$HOST" = "127.0.0.1" ] || SAN="$SAN,$EXTRA"

if [ -e "$OUT/quiz-ca.crt" ] || [ -e "$OUT/quiz.crt" ] || [ -e "$OUT/quiz.key" ]; then
  echo "make-cert: $OUT already holds a certificate. Move it away first; your devices trust the old root." >&2
  exit 1
fi

# Only a folder this script makes gets the owner-only mode; a folder the user named keeps its own.
if [ ! -d "$OUT" ]; then
  mkdir -p "$OUT"
  chmod 700 "$OUT"
fi
work="$(mktemp -d)"
done=0
# On any failure, remove what this run wrote, so a rerun is not refused for a half-made set.
cleanup() {
  rm -rf "$work"
  [ "$done" = 1 ] || rm -f "$OUT/quiz-ca.crt" "$OUT/quiz.crt" "$OUT/quiz.key"
}
trap cleanup EXIT

# openssl is quiet on success; on failure its own message says why.
run_openssl() {
  if ! openssl "$@" 2>"$work/openssl.err"; then
    echo "make-cert: openssl $1 failed:" >&2
    cat "$work/openssl.err" >&2
    exit 1
  fi
}

cat > "$work/ca.cnf" <<EOF
[req]
distinguished_name = dn
x509_extensions = ca
prompt = no
[dn]
CN = Star Exam Companion home root
[ca]
basicConstraints = critical, CA:TRUE, pathlen:0
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
EOF

cat > "$work/server.ext" <<EOF
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = $SAN
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid
EOF

# The subject is only a label; a long host name lives in subjectAltName, where browsers look.
CN="$HOST"
(( ${#CN} <= 64 )) || CN="Star Exam Companion"

run_openssl req -x509 -new -newkey rsa:2048 -nodes -sha256 -days "$DAYS" \
  -config "$work/ca.cnf" -keyout "$work/ca.key" -out "$OUT/quiz-ca.crt"
run_openssl req -new -newkey rsa:2048 -nodes -sha256 -subj "/CN=$CN" \
  -keyout "$OUT/quiz.key" -out "$work/quiz.csr"
run_openssl x509 -req -sha256 -days "$DAYS" -in "$work/quiz.csr" \
  -CA "$OUT/quiz-ca.crt" -CAkey "$work/ca.key" -CAcreateserial -CAserial "$work/ca.srl" \
  -extfile "$work/server.ext" -out "$OUT/quiz.crt"

chmod 600 "$OUT/quiz.key"
chmod 644 "$OUT/quiz-ca.crt" "$OUT/quiz.crt"
done=1
# The root key goes with $work on exit.

echo "made: $OUT/quiz-ca.crt (install on each device), $OUT/quiz.crt and $OUT/quiz.key (for the server)"
echo "names: $SAN"
