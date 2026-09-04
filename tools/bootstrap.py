#!/usr/bin/env python3
"""Bootstrap the pinned Socket binary without running a package manager."""
from datetime import datetime, timezone, timedelta
from pathlib import Path
import hashlib
import json
import os
import urllib.request

VERSION = 'v1.15.1'
ASSET = 'sfw-free-musl-linux-x86_64'
DIGEST = '28b6dc864d6bbc8bbd41f85a0e894f91f4ab41f2fc1c304c0c08e29da63ccf69'
URL = f'https://github.com/SocketDev/sfw-free/releases/download/{VERSION}/{ASSET}'
root = Path(__file__).resolve().parent.parent
def request(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'funMMO-bootstrap'}),timeout=60)
def main():
    with request(f'https://api.github.com/repos/SocketDev/sfw-free/releases/tags/{VERSION}') as response:
        release=json.load(response)
    asset=next(a for a in release['assets'] if a['name']==ASSET)
    cutoff=datetime.now(timezone.utc)-timedelta(days=7)
    if release['draft'] or release['prerelease'] or release['tag_name']!=VERSION:
        raise ValueError('Unexpected Socket release')
    for stamp in [release['published_at'],asset['created_at'],asset['updated_at']]:
        if datetime.fromisoformat(stamp.replace('Z','+00:00'))>cutoff:
            raise ValueError('Socket release or asset is younger than seven days')
    if asset['digest']!='sha256:'+DIGEST or asset['browser_download_url']!=URL:
        raise ValueError('Socket release metadata does not match the pin')
    directory=root/'.tools'
    directory.mkdir(exist_ok=True)
    target=directory/'sfw'
    if target.exists():
        with target.open('rb') as stream:
            if hashlib.file_digest(stream,'sha256').hexdigest()==DIGEST:
                print('Pinned Socket binary already verified.');return
        raise ValueError('Existing Socket binary does not match the pin')
    temporary=directory/'sfw.download'
    digest=hashlib.sha256()
    with request(URL) as response,temporary.open('xb') as stream:
        while chunk:=response.read(1024*1024):
            stream.write(chunk);digest.update(chunk)
    if digest.hexdigest()!=DIGEST:
        temporary.unlink()
        raise ValueError('Downloaded Socket binary failed checksum verification')
    temporary.chmod(0o755)
    os.replace(temporary,target)
    print('Pinned, age-eligible Socket binary verified.')

if __name__=='__main__':main()
