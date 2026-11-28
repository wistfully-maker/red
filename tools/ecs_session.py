"""Task-scoped SSH operator. Credentials come from a hidden terminal prompt."""
import argparse
import base64
import getpass
import hashlib
from pathlib import Path
import sys
import time

import paramiko

ROOT=Path(__file__).resolve().parents[1]
STATE=ROOT/'output/ecs-deploy'


def connect():
    STATE.mkdir(parents=True,exist_ok=True)
    client=paramiko.SSHClient()
    client.load_system_host_keys()
    known=STATE/'known_hosts'
    if known.exists():client.load_host_keys(str(known))
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    password=getpass.getpass('ECS SSH password (hidden): ')
    client.connect('101.37.244.10',port=22,username='root',password=password,
                   timeout=15,auth_timeout=20,banner_timeout=20,
                   look_for_keys=False,allow_agent=False)
    del password
    client.save_host_keys(str(known))
    fingerprint=base64.b64encode(hashlib.sha256(client.get_transport().get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
    print('SSH host key SHA256:'+fingerprint,flush=True)
    client.get_transport().set_keepalive(20)
    return client


def run(client,command,transcript=None):
    print('$ '+command,flush=True)
    _,out,err=client.exec_command(command,get_pty=False)
    channel=out.channel
    record=transcript.open('w',encoding='utf-8') if transcript else None
    import select
    while not channel.exit_status_ready() or channel.recv_ready() or channel.recv_stderr_ready():
        if channel.recv_ready():
            text=channel.recv(65536).decode('utf-8',errors='replace');print(text,end='',flush=True)
            if record:record.write(text);record.flush()
        if channel.recv_stderr_ready():
            text=channel.recv_stderr(65536).decode('utf-8',errors='replace');print(text,end='',file=sys.stderr,flush=True)
            if record:record.write(text);record.flush()
        if not channel.recv_ready() and not channel.recv_stderr_ready():select.select([channel],[],[],.25)
    status=channel.recv_exit_status()
    if record:record.close()
    return status


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--command-file',type=Path)
    parser.add_argument('--upload',type=Path)
    parser.add_argument('--destination')
    parser.add_argument('--transcript',type=Path)
    args=parser.parse_args()
    client=connect()
    try:
        if args.upload:
            if not args.destination.startswith('/opt/shanhe-atlas/'):
                raise ValueError('Upload destination must stay inside the new app')
            last=[-1]
            began=time.monotonic()
            def progress(done,total):
                delay=done/(4*1024*1024)-(time.monotonic()-began)
                if delay>0:time.sleep(min(delay,.1))
                percent=int(done*100/total)
                if percent//5!=last[0]:
                    last[0]=percent//5;print(f'Upload {percent}% ({done}/{total} bytes)',flush=True)
            with client.open_sftp() as sftp:sftp.put(str(args.upload),args.destination,callback=progress)
        if args.command_file:
            code=run(client,args.command_file.read_text(encoding='utf-8-sig'),args.transcript)
            if code:raise SystemExit(code)
    finally:client.close()


if __name__=='__main__':main()
