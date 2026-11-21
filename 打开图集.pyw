"""Open the local atlas, reusing its preview server when it is already running."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.error import URLError
from urllib.request import ProxyHandler, build_opener
import webbrowser


def main():
    root = Path(__file__).resolve().parent
    opener = build_opener(ProxyHandler({}))
    for port in range(8873, 8890):
        url = f"http://127.0.0.1:{port}/"
        try:
            with opener.open(url + "index.html", timeout=1) as response:
                if response.read(65536) == (root / "index.html").read_bytes():
                    webbrowser.open(url)
                    return
        except (OSError, URLError):
            pass
        try:
            server = ThreadingHTTPServer(("127.0.0.1", port), partial(AtlasHandler, directory=str(root)))
        except OSError:
            continue
        Thread(target=webbrowser.open, args=(url,), daemon=True).start()
        with server:
            server.serve_forever()
        return
    raise OSError("Local preview ports 8873–8889 are busy")


class AtlasHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # pythonw runs without a console.
        pass


if __name__ == "__main__":
    main()
