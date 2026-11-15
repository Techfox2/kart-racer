"""Private, validated asset caching; authorization must happen before serve()."""
import gzip
import hashlib
from email.utils import formatdate
from functools import lru_cache
from pathlib import Path

@lru_cache(maxsize=128)
def fingerprint(path, size, modified):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

@lru_cache(maxsize=32)
def compressed(path, size, modified):
    return gzip.compress(Path(path).read_bytes(), compresslevel=6, mtime=0)

def accepts_gzip(header):
    for part in header.lower().split(','):
        values=[v.strip() for v in part.split(';')]
        if values[0]!='gzip':continue
        try:return all(float(v[2:])>0 for v in values[1:] if v.startswith('q='))
        except ValueError:return False
    return False

def serve(handler,target):
    stat=target.stat();key=(str(target),stat.st_size,stat.st_mtime_ns)
    text=target.suffix.lower() in ('.js','.css','.json','.html','.svg')
    zipped=text and stat.st_size>1024 and accepts_gzip(handler.headers.get('Accept-Encoding',''))
    handler.static_cacheable=target.suffix.lower()!='.html'
    etag='"'+fingerprint(*key)+('-gz' if zipped else '')+'"'
    match=handler.headers.get('If-None-Match','')
    unchanged=handler.static_cacheable and any(v.strip().removeprefix('W/') in ('*',etag) for v in match.split(','))
    handler.send_response(304 if unchanged else 200)
    if handler.static_cacheable:handler.send_header('ETag',etag)
    handler.send_header('Last-Modified',formatdate(stat.st_mtime,usegmt=True))
    if text:handler.send_header('Vary','Accept-Encoding')
    if unchanged:
        handler.end_headers();return
    body=compressed(*key) if zipped else None
    handler.send_header('Content-Type',handler.guess_type(str(target)))
    handler.send_header('Content-Length',str(len(body) if body is not None else stat.st_size))
    if zipped:handler.send_header('Content-Encoding','gzip')
    handler.end_headers()
    if handler.command=='HEAD':return
    if body is not None:handler.wfile.write(body)
    else:
        with target.open('rb') as source:handler.copyfile(source,handler.wfile)
