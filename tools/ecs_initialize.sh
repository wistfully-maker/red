set -eu
test ! -e /opt/shanhe-atlas
test ! -e /etc/systemd/system/shanhe-atlas-web.service
if ss -tlnH 'sport = :18081' | grep -q .; then echo '18081 is occupied; aborting'; exit 1; fi
mkdir -p /opt/shanhe-atlas/releases /opt/shanhe-atlas/uploads /opt/shanhe-atlas/logs
chmod 700 /opt/shanhe-atlas/uploads
cd /opt/shanhe-atlas
python3 -m venv venv
./venv/bin/pip install -U pip
useradd --system --user-group --home-dir /opt/shanhe-atlas --shell /usr/sbin/nologin shanhe-atlas
chown shanhe-atlas:shanhe-atlas /opt/shanhe-atlas/logs
chmod 750 /opt/shanhe-atlas/logs
./venv/bin/python --version
systemctl is-active longtou-web longtou-monitor
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/
