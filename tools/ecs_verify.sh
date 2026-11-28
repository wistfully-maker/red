set -eu
echo '$ systemctl is-active shanhe-atlas-web.service'
systemctl is-active shanhe-atlas-web.service
echo '$ systemctl show shanhe-atlas-web.service -p MemoryCurrent -p MemoryMax -p NRestarts -p User -p MainPID'
systemctl show shanhe-atlas-web.service -p MemoryCurrent -p MemoryMax -p NRestarts -p User -p MainPID
echo '$ systemctl status shanhe-atlas-web.service --no-pager --full'
systemctl status shanhe-atlas-web.service --no-pager --full
echo '$ curl -sS -o /dev/null -w HTTP_CODE_TIME http://127.0.0.1:18081/'
curl -sS -o /dev/null -w '%{http_code} %{time_total}s\n' http://127.0.0.1:18081/
echo '$ ss -tlnp | grep -E 18080_OR_18081'
ss -tlnp | grep -E '18080|18081'
echo '$ systemctl is-active longtou-web longtou-monitor'
systemctl is-active longtou-web longtou-monitor
echo '$ systemctl show longtou-web.service longtou-monitor.service -p Id -p MainPID -p ActiveEnterTimestamp -p NRestarts'
systemctl show longtou-web.service longtou-monitor.service -p Id -p MainPID -p ActiveEnterTimestamp -p NRestarts
echo '$ free -h'
free -h
echo '$ systemctl is-enabled shanhe-atlas-web.service'
systemctl is-enabled shanhe-atlas-web.service
echo '$ du -sh /opt/shanhe-atlas'
du -sh /opt/shanhe-atlas
echo '$ /opt/shanhe-atlas/venv/bin/python --version'
/opt/shanhe-atlas/venv/bin/python --version
echo '$ logs rotation limit: 2 MiB per file, 3 backups'
ls -lh /opt/shanhe-atlas/logs
