#!/usr/bin/env python3
"""Build the Pulse Life phone app (ai/index.html) from the artifact page body in life/index.html.

life/index.html is written for the claude.ai Artifact publisher, which adds the document skeleton.
The phone app needs a full document with the PWA head, so this wraps the same body and points the
scripts at ../life/. Run it after editing life/index.html:  python3 tools/build-ai.py
"""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
body = (root / "life" / "index.html").read_text(encoding="utf-8")
body = re.sub(r"<title>.*?</title>\s*", "", body, count=1, flags=re.S)
body = re.sub(r'<script src="(i18n|planner|app)\.js"></script>', r'<script src="../life/\1.js"></script>', body)
head = """<!doctype html>
<html lang="ka">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Pulse Life</title>
<meta name="description" content="Your personal AI that knows you and plans your life.">
<meta name="theme-color" content="#0C0E17">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Pulse Life">
<link rel="apple-touch-icon" href="../icon-180.png">
<link rel="icon" href="../icon-192.png">
<link rel="manifest" href="manifest.webmanifest">
<style>:root{padding-top:env(safe-area-inset-top,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
"""
tail = """
<script>if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function(){});</script>
</body>
</html>
"""
(root / "ai" / "index.html").write_text(head + body + tail, encoding="utf-8")
print("ai/index.html built")
