import os
import json

from werkzeug.wrappers import Request, Response

@Request.application
def application(request):
    if request.path == "/":
        return Response(status=302, headers=[
            ("Location", "/static/test/test.html"),
        ])
    if request.path.startswith("/echo/"):
        result = dict(request.args.items())
        result.update(json.loads(result.pop("__kwargs", "{}")))
        args = json.loads(result.pop("__args", "[]"))
        result.update([ (idx, val) for (idx, val)
                         in enumerate(args) ])
        return Response(json.dumps({ "ok": True, "data": result }))
    return Response("unknown: " + request.path, status=404)

if __name__ == '__main__':
    from werkzeug.serving import run_simple
    static_root = os.path.join(os.path.dirname(__file__), "../")
    run_simple('127.0.0.1', 4513, application,
               use_debugger=True, use_reloader=True,
               static_files={"/static": static_root })

