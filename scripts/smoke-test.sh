#!/usr/bin/env bash
# Functional smoke test for TITAN EVENTS (run with the dev server on :3000)
set -u
B=http://localhost:3000
# Start from a clean slate for lockout/rate-limit state so the test is repeatable.
rm -f "$(dirname "$0")/../data/security.json" 2>/dev/null || true
J=/tmp/cookies-$$.txt
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); printf "  \033[32m✓\033[0m %s\n" "$1"; }
bad()  { FAIL=$((FAIL+1)); printf "  \033[31m✗\033[0m %s\n" "$1"; }
check(){ [ "$2" = "$3" ] && ok "$1 ($2)" || bad "$1 — expected $3, got $2"; }

csrf() { # $1 = cookie jar, $2 = url
  curl -s -b "$1" -c "$1" "$2" | grep -o 'name="_csrf" value="[^"]*"' | head -1 | sed 's/.*value="//;s/"$//'
}

echo "── public pages ──"
for p in / /events "/events?type=past" "/events?category=concert" /services /contact /sitemap.xml /robots.txt /manifest.webmanifest /healthz; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$B$p")
  check "GET $p" "$code" "200"
done
check "GET /nope returns 404" "$(curl -s -o /dev/null -w '%{http_code}' "$B/nope")" "404"

echo "── SEO ──"
home=$(curl -s "$B/")
echo "$home" | grep -q 'og:image' && ok "og:image present" || bad "og:image missing"
echo "$home" | grep -q 'application/ld+json' && ok "structured data present" || bad "structured data missing"
echo "$home" | grep -q '/events/' && ok "sitemap linked" || bad "no event links"
curl -s "$B/sitemap.xml" | grep -q '<urlset' && ok "sitemap xml valid" || bad "sitemap invalid"

echo "── contact form ──"
TOKEN=$(csrf "$J" "$B/contact")
code=$(curl -s -b "$J" -c "$J" -o /dev/null -w '%{http_code}' -X POST "$B/contact" \
  --data-urlencode "_csrf=$TOKEN" --data-urlencode "name=Test Person" --data-urlencode "email=test@example.com" \
  --data-urlencode "phone=+94 77 000 0000" --data-urlencode "eventType=wedding" --data-urlencode "message=Please quote a 200 guest wedding in Colombo." \
  --data-urlencode "formOpenedAt=1")
check "POST /contact (valid) redirects" "$code" "302"

# validation error path
TOKEN=$(csrf "$J" "$B/contact")
curl -s -b "$J" -c "$J" -o /dev/null -X POST "$B/contact" --data-urlencode "_csrf=$TOKEN" \
  --data-urlencode "name=A" --data-urlencode "email=bademail" --data-urlencode "message=short" --data-urlencode "formOpenedAt=1"
page=$(curl -s -b "$J" -c "$J" "$B/contact")
echo "$page" | grep -q "Please tell us your name" && ok "validation errors re-render" || bad "validation errors not shown"
echo "$page" | grep -q 'value="bademail"' && ok "input values preserved" || bad "input values lost"

# csrf rejection
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/contact" --data "name=X&email=x@y.com&message=hello there" -H 'Accept: text/html')
check "POST without CSRF blocked" "$code" "403"

# honeypot
TOKEN=$(csrf "$J" "$B/contact")
curl -s -b "$J" -c "$J" -o /dev/null -X POST "$B/contact" --data-urlencode "_csrf=$TOKEN" \
  --data-urlencode "name=Bot" --data-urlencode "email=bot@example.com" --data-urlencode "message=spam spam spam" \
  --data-urlencode "website=http://spam.example" --data-urlencode "formOpenedAt=1"

echo "── admin auth ──"
check "wrong password rejected" "$(curl -s -o /dev/null -w '%{http_code}' "$B/admin")" "302"
TOKEN=$(csrf "$J" "$B/admin/login")
code=$(curl -s -b "$J" -c "$J" -o /dev/null -w '%{http_code}' -X POST "$B/admin/login" \
  --data-urlencode "_csrf=$TOKEN" --data-urlencode "username=admin" --data-urlencode "password=nope")
check "bad login returns form" "$code" "200"
resp=$(curl -s -b "$J" -c "$J" -X POST "$B/admin/login" --data-urlencode "_csrf=$TOKEN" --data-urlencode "username=admin" --data-urlencode "password=nope")
echo "$resp" | grep -q "attempt(s) remaining" && ok "remaining attempts shown" || bad "no remaining-attempts message"

# correct login
J2=/tmp/cookies-admin-$$.txt
TOKEN=$(csrf "$J2" "$B/admin/login")
code=$(curl -s -b "$J2" -c "$J2" -o /dev/null -w '%{http_code}' -X POST "$B/admin/login" \
  --data-urlencode "_csrf=$TOKEN" --data-urlencode "username=admin" --data-urlencode "password=Titan@2025")
check "login with correct credentials" "$code" "302"

echo "── admin pages ──"
for p in /admin /admin/events/new /admin/inquiries /admin/backup /admin/activity /admin/security /admin/settings; do
  check "GET $p" "$(curl -s -b "$J2" -o /dev/null -w '%{http_code}' "$B$p")" "200"
done
TOKEN=$(csrf "$J2" "$B/admin/events/new")

echo "── create event with poster upload ──"
IMG=/tmp/test-poster-$$.png
node -e "
const sharp=require('/home/user/titan_website/node_modules/sharp');
sharp({create:{width:2000,height:1300,channels:3,background:{r:180,g:140,b:40}}}).png().toFile('$IMG').then(()=>console.log('made test image'));
"
code=$(curl -s -b "$J2" -c "$J2" -o /dev/null -w '%{http_code}' -X POST "$B/admin/events" \
  -F "_csrf=$TOKEN" -F "name=Smoke Test Gala" -F "date=2027-03-14" -F "time=19:00" -F "venue=Test Venue, Colombo" \
  -F "category=corporate" -F "type=upcoming" -F "ticketLink=https://example.com/tickets" \
  -F "description=A smoke test event created by the automated check." -F "poster=@$IMG;type=image/png")
check "POST create event" "$code" "302"
NEW=$(node -e "const d=require('/home/user/titan_website/data/titan.json');const e=d.events.find(x=>x.name==='Smoke Test Gala');process.stdout.write(e?e.id:'')")
[ -n "$NEW" ] && ok "event appears in dashboard ($NEW)" || bad "created event not listed"
curl -s "$B/events" | grep -q "Smoke Test Gala" && ok "event visible on public site" || bad "event not public"
curl -s -b "$J2" "$B/admin" | grep -q 'uploads/events/' && ok "poster was optimised + stored" || bad "poster missing"
# multipart request without a token must be rejected
code=$(curl -s -b "$J2" -o /dev/null -w '%{http_code}' -X POST "$B/admin/events" -F "name=No CSRF" -F "date=2027-01-01" -F "venue=X" -F "category=party" -F "description=should be blocked")
check "multipart POST without CSRF blocked" "$code" "403"
PIMG=$(ls -t public/uploads/events/*.jpg 2>/dev/null | grep -v -- '-thumb' | head -1)
[ -n "$PIMG" ] && ok "poster file on disk: $(basename "$PIMG")" || bad "no uploaded file"
node -e "const s=require('/home/user/titan_website/node_modules/sharp'); s('$PIMG').metadata().then(m=>console.log('   poster dims:',m.width+'x'+m.height, m.format))"

echo "── edit / toggle / delete ──"
TOKEN=$(csrf "$J2" "$B/admin/events/$NEW/edit")
code=$(curl -s -b "$J2" -c "$J2" -o /dev/null -w '%{http_code}' -X POST "$B/admin/events/$NEW" \
  -F "_csrf=$TOKEN" -F "name=Smoke Test Gala (Updated)" -F "date=2027-03-14" -F "venue=Renamed Venue" \
  -F "category=party" -F "type=upcoming" -F "description=Updated by the smoke test with new details.")
check "POST update event" "$code" "302"
curl -s "$B/events?category=party" | grep -q "Updated" && ok "update reflected publicly" || bad "update not visible"

TOKEN=$(csrf "$J2" "$B/admin")
code=$(curl -s -b "$J2" -c "$J2" -o /dev/null -w '%{http_code}' -X POST "$B/admin/events/$NEW/toggle-type" --data-urlencode "_csrf=$TOKEN")
check "POST toggle to past" "$code" "302"
curl -s "$B/events?type=past" | grep -q "Smoke Test Gala" && ok "moved into past events" || bad "toggle failed"

TOKEN=$(csrf "$J2" "$B/admin")
code=$(curl -s -b "$J2" -c "$J2" -o /dev/null -w '%{http_code}' -X POST "$B/admin/events/$NEW/delete" --data-urlencode "_csrf=$TOKEN")
check "POST delete event" "$code" "302"
curl -s "$B/events?type=past" | grep -q "Smoke Test Gala" && bad "event still public" || ok "event removed from site"

echo "── announcements ──"
TOKEN=$(csrf "$J2" "$B/admin")
curl -s -b "$J2" -c "$J2" -o /dev/null -X POST "$B/admin/announcements" \
  --data-urlencode "_csrf=$TOKEN" --data-urlencode "title=Smoke test announcement" --data-urlencode "content=This announcement was created by the automated smoke test."
curl -s "$B/" | grep -q "Smoke test announcement" && ok "announcement appears on homepage" || bad "announcement not shown"
AID=$(curl -s -b "$J2" "$B/admin" | grep -o 'announcements/ann_[a-z0-9]*/delete' | head -1 | sed 's|announcements/||;s|/delete||')
TOKEN=$(csrf "$J2" "$B/admin")
curl -s -b "$J2" -c "$J2" -o /dev/null -X POST "$B/admin/announcements/$AID/delete" --data-urlencode "_csrf=$TOKEN"
curl -s "$B/" | grep -q "Smoke test announcement" && bad "announcement still visible" || ok "announcement deleted"

echo "── inquiries ──"
curl -s -b "$J2" "$B/admin/inquiries" | grep -q "Test Person" && ok "new inquiry listed in admin" || bad "inquiry missing"
curl -s -b "$J2" "$B/admin/inquiries" | grep -q 'pill">New' && ok "New badge shown" || bad "New badge missing"
IID=$(curl -s -b "$J2" "$B/admin/inquiries" | grep -o 'inquiries/inq_[a-z0-9]*/status' | head -1 | sed 's|inquiries/||;s|/status||')
TOKEN=$(csrf "$J2" "$B/admin/inquiries")
curl -s -b "$J2" -c "$J2" -o /dev/null -X POST "$B/admin/inquiries/$IID/status" --data-urlencode "_csrf=$TOKEN" --data-urlencode "status=read"
curl -s -b "$J2" "$B/admin/inquiries?status=read" | grep -q "Test Person" && ok "marked as read" || bad "status update failed"

echo "── backup ──"
code=$(curl -s -b "$J2" -o /tmp/backup-$$.json -w '%{http_code}' "$B/admin/backup/download")
check "download backup" "$code" "200"
node -e "const d=require('/tmp/backup-$$.json'); console.log('   backup contains', d.data.events.length, 'events,', d.data.announcements.length, 'announcements,', d.data.inquiries.length, 'inquiries')" 2>/dev/null \
  && ok "backup JSON parses" || bad "backup JSON invalid"
node -e "const d=require('/tmp/backup-$$.json'); if(d.data.admin||d.data.admin===null) console.log('   admin block:', d.data.admin===null?'null (kept private)':'present')"
TOKEN=$(csrf "$J2" "$B/admin/backup")
code=$(curl -s -b "$J2" -c "$J2" -o /dev/null -w '%{http_code}' -X POST "$B/admin/backup/create" --data-urlencode "_csrf=$TOKEN")
check "create server snapshot" "$code" "302"
ls data/backups/*.json >/dev/null 2>&1 && ok "snapshot files stored ($(ls data/backups | wc -l) files)" || bad "no snapshot files"
code=$(curl -s -b "$J2" -c "$J2" -o /dev/null -w '%{http_code}' -X POST "$B/admin/backup/restore" -F "_csrf=$TOKEN" -F "backup=@/tmp/backup-$$.json;type=application/json")
check "restore from uploaded file" "$code" "302"
curl -s "$B/events" | grep -q "Golden Hour" && ok "restored data still intact" || bad "restore damaged data"
code=$(curl -s -b "$J2" -c "$J2" -o /dev/null -w '%{http_code}' -X POST "$B/admin/backup/restore" -F "_csrf=$TOKEN" -F "backup=@/etc/hostname;type=application/json")
check "invalid restore handled" "$code" "302"

echo "── security / credentials ──"
TOKEN=$(csrf "$J2" "$B/admin/security")
code=$(curl -s -b "$J2" -c "$J2" -o /dev/null -w '%{http_code}' -X POST "$B/admin/security" \
  --data-urlencode "_csrf=$TOKEN" --data-urlencode "currentPassword=wrongpass" --data-urlencode "newPassword=newpass1234" --data-urlencode "confirmPassword=newpass1234")
check "wrong current password rejected" "$code" "302"
TOKEN=$(csrf "$J2" "$B/admin/security")
curl -s -b "$J2" -c "$J2" -o /dev/null -X POST "$B/admin/security" \
  --data-urlencode "_csrf=$TOKEN" --data-urlencode "currentPassword=Titan@2025" --data-urlencode "newPassword=smoketest99" --data-urlencode "confirmPassword=smoketest99"
J3=/tmp/cookies-new-$$.txt
T2=$(csrf "$J3" "$B/admin/login")
code=$(curl -s -b "$J3" -c "$J3" -o /dev/null -w '%{http_code}' -X POST "$B/admin/login" --data-urlencode "_csrf=$T2" --data-urlencode "username=admin" --data-urlencode "password=smoketest99")
check "new password works" "$code" "302"
TOKEN=$(csrf "$J3" "$B/admin/security")
curl -s -b "$J3" -c "$J3" -o /dev/null -X POST "$B/admin/security" \
  --data-urlencode "_csrf=$TOKEN" --data-urlencode "currentPassword=smoketest99" --data-urlencode "newPassword=Titan@2025" --data-urlencode "confirmPassword=Titan@2025"
T4=$(csrf "$J3" "$B/admin/login")
curl -s -b "$J3" -c "$J3" -o /dev/null -X POST "$B/admin/login" --data-urlencode "_csrf=$T4" --data-urlencode "username=admin" --data-urlencode "password=Titan@2025" && ok "password restored to default"

echo "── lockout & rate limiting ──"
JL=/tmp/cookies-lock-$$.txt
for i in 1 2 3 4 5 6; do
  TL=$(csrf "$JL" "$B/admin/login")
  OUT=$(curl -s -b "$JL" -c "$JL" -X POST "$B/admin/login" --data-urlencode "_csrf=$TL" --data-urlencode "username=admin" --data-urlencode "password=bad$i")
done
echo "$OUT" | grep -qi "locked" && ok "account locks after repeated failures" || bad "no lockout message after 5 attempts"
echo "$OUT" | grep -q 'disabled' && ok "login button disabled while locked" || bad "login form not disabled"

echo "── logout ──"
TOKEN=$(csrf "$J2" "$B/admin")
curl -s -b "$J2" -c "$J2" -o /dev/null -X POST "$B/admin/logout" --data-urlencode "_csrf=$TOKEN"
check "admin requires login after logout" "$(curl -s -b "$J2" -o /dev/null -w '%{http_code}' "$B/admin")" "302"

echo
echo "════════════════════════════════════"
printf "  passed: %s   failed: %s\n" "$PASS" "$FAIL"
echo "════════════════════════════════════"
rm -f "$J" "$J2" "$J3" "$JL" "$IMG" /tmp/backup-$$.json
[ "$FAIL" -eq 0 ]
