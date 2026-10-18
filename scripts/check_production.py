"""Read-only public release health checks; no session/account or secret needed."""
import argparse, json, re, time, urllib.request
from urllib.parse import urlsplit

def verify(base, expected=None):
    def read(path):
        with urllib.request.urlopen(base+path, timeout=25) as response:
            assert response.status == 200, (path, response.status)
            return response.read(), response.headers
    raw, headers = read('/version.json'); release = json.loads(raw)
    assert re.fullmatch(r'\d+\.\d+\.\d+', release['version'])
    assert release['buildId'] and 'no-store' in headers.get('Cache-Control','')
    if expected: assert release['version'] == expected, 'Production version does not match the requested version'
    html, headers = read('/home'); html = html.decode()
    assert 'no-cache' in headers.get('Cache-Control','')
    entry = re.search(r'<script[^>]*src="([^"]+)"',html).group(1)
    assert re.fullmatch(r'/assets/[\w.-]+-[\w-]{8}\.js', entry), 'Entry must be content fingerprinted'
    js, headers = read(entry)
    assert release['buildId'].encode() in js, 'HTML/client and release metadata do not match'
    assert 'immutable' in headers.get('Cache-Control','') and 'max-age=31536000' in headers.get('Cache-Control',''), 'Fingerprinted assets should be cached for repeat visits'
    worker, headers = read('/sw.js')
    assert release['buildId'].encode() in worker and 'no-store' in headers.get('Cache-Control','')
    manifest = json.loads(read('/manifest.webmanifest')[0])
    assert manifest['display']=='standalone' and manifest['icons'] and manifest['start_url'].startswith('/')
    health = json.loads(read('/api/app?action=health')[0])
    assert health['ready'] and health['database'], 'Public database health check failed'
    for path in ['/profile','/settings','/friends','/invite','/streak','/privacy']:
        assert b'id="root"' in read(path)[0], 'Direct route did not serve the app: '+path
    print('PASS: Public version '+release['version']+' has matching client/worker metadata, immutable compiled assets, refreshable routes, a PWA manifest and a healthy database.',flush=True)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--base',default='https://jishoo.vercel.app');parser.add_argument('--expected-version');args=parser.parse_args()
    target=urlsplit(args.base)
    if target.scheme!='https' or not target.hostname or target.username or target.password or target.path not in ['', '/']:raise ValueError('Use an HTTPS website origin')
    for attempt in range(3):
        try:return verify(args.base.rstrip('/'),args.expected_version)
        except Exception:
            if attempt==2:raise
            time.sleep(8)

if __name__=='__main__':main()
