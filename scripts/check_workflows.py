"""Validate workflow syntax with a pinned, checksum-verified actionlint binary."""
import hashlib, io, platform, subprocess, tarfile, tempfile, urllib.request
from pathlib import Path

VERSION = '1.7.7'
SHA256 = '023070a287cd8cccd71515fedc843f1985bf96c436b7effaecce67290e7e0757'

def main():
    if platform.system() != 'Linux' or platform.machine() not in ['x86_64','amd64']:
        raise RuntimeError('This CI helper targets Linux x86_64; use actionlint directly on other platforms.')
    url=f'https://github.com/rhysd/actionlint/releases/download/v{VERSION}/actionlint_{VERSION}_linux_amd64.tar.gz'
    with urllib.request.urlopen(url, timeout=30) as response: data=response.read()
    if hashlib.sha256(data).hexdigest() != SHA256: raise RuntimeError('actionlint checksum mismatch; refusing to execute')
    with tempfile.TemporaryDirectory(prefix='jishoo-actionlint-') as folder:
        # Extract only the expected executable, never arbitrary archive paths.
        with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
            executable=Path(folder)/'actionlint';executable.write_bytes(archive.extractfile('actionlint').read());executable.chmod(0o755)
        subprocess.run([str(executable)],cwd=Path(__file__).resolve().parents[1],check=True)
    print('PASS: GitHub workflow syntax and expressions validated with checksum-verified actionlint.')

if __name__=='__main__':main()
