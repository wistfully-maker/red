set -eu
ss -tlnp | grep -E '1808[0-9]|80[0-9][0-9]' || true
free -h && df -h /
ls -la /opt
systemctl is-active longtou-web longtou-monitor
curl -sS -o /dev/null -w '%{http_code} %{time_total}s\n' http://127.0.0.1:18080/
systemctl show longtou-web.service longtou-monitor.service -p Id -p MainPID -p ActiveEnterTimestamp -p NRestarts
python3 -c "import importlib.util; print({k:bool(importlib.util.find_spec(k)) for k in ['venv','ensurepip']})"
