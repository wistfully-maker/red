set -eu
mkdir -p /opt/shanhe-atlas/uploads/control
tar -xf /opt/shanhe-atlas/uploads/control.tar -C /opt/shanhe-atlas/uploads/control
nice -n 10 /opt/shanhe-atlas/venv/bin/python /opt/shanhe-atlas/uploads/control/ecs_unpack.py '{"release":"20261128T065633Z-21585b5a6e19","websiteFiles":567,"servedFiles":705,"uncompressedBytes":579916398,"archiveBytes":476891965,"archiveSha256":"7aafd5cfa038b43b1287dc76b74d32d12e9f85d509de20116406929e63ecf6fb","serverSha256":"60172888917ce0178ebab29002c7cdd9e457cbc7a068efb083fb6b5e504e0e32"}'
if ss -tlnH 'sport = :18081' | grep -q .; then echo 'Port conflict; new service not started'; exit 1; fi
test ! -e /etc/systemd/system/shanhe-atlas-web.service
install -m 644 /opt/shanhe-atlas/uploads/control/shanhe-atlas-web.service /etc/systemd/system/shanhe-atlas-web.service
systemd-analyze verify /etc/systemd/system/shanhe-atlas-web.service
systemctl daemon-reload
systemctl is-active longtou-web longtou-monitor
systemctl enable --now shanhe-atlas-web.service
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS -o /dev/null http://127.0.0.1:18081/; then break; fi
  sleep .5
done
/opt/shanhe-atlas/venv/bin/python /opt/shanhe-atlas/uploads/control/ecs_asset_checks.py
sh /opt/shanhe-atlas/uploads/control/ecs_verify.sh
python3 - <<'MEMORY'
from pathlib import Path
memory=dict(line.split(':',1) for line in Path('/proc/meminfo').read_text().splitlines())
available=int(memory['MemAvailable'].strip().split()[0])
print('MemAvailableKiB='+str(available))
assert available>=614400, 'Less than 600MiB available'
MEMORY
