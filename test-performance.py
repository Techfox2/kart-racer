# Local-only browser runner with an isolated disposable account database.
import os,socket,subprocess,sys,tempfile,time,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parent
(root/'.work').mkdir(exist_ok=True)
with socket.socket() as sock:
 sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
with tempfile.TemporaryDirectory(prefix='grand-poly-performance-') as data:
 origin=f'http://127.0.0.1:{port}'
 env=dict(os.environ,ACCOUNT_DATA=data,GAME_ROOT=str(root),PUBLIC_ORIGIN=origin,PORT=str(port),TEST_ORIGIN=origin)
 server=subprocess.Popen([sys.executable,str(root/'server/app.py')],cwd=root,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  for _ in range(100):
   try:urllib.request.urlopen(origin,timeout=1).close();break
   except OSError:
    if server.poll() is not None:raise RuntimeError('Local server failed to start')
    time.sleep(.1)
  result=subprocess.run(['node','test-performance.cjs'],cwd=root,env=env,timeout=180)
 finally:server.terminate();server.wait(timeout=10)
raise SystemExit(result.returncode)
