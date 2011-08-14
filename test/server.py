import os
import re
import json

from werkzeug.wrappers import Request, Response

class AppError(Exception):
    def __init__(self, msg, data):
        self.msg = msg
        self.data = data


class TestAPI(object):
    def echo(self, *args, **kwargs):
        result = dict(kwargs)
        result.update([ (idx, var) for (idx, var)
                        in enumerate(args) ])
        return result


def handle_rpc(request, func_name, api):
    api.get_kwargs = dict(request.args.items())
    api.post_kwargs = dict(request.form.items())

    kwargs = dict(api.get_kwargs)
    kwargs.update(api.post_kwargs)

    api.json_kwargs = json.loads(kwargs.pop("__kwargs", "{}"))
    kwargs.update(api.json_kwargs)

    args = json.loads(kwargs.pop("__args", "[]"))

    try:
        func = getattr(api, func_name)
        func_result = func(*args, **kwargs)
        result = { "ok": True, "data": func_result }
    except AppError, e:
        result = {
            "error": True,
            "data": e.data,
            "msg": e.msg,
        }

    return Response(json.dumps(result))


@Request.application
def application(request):
    if request.path == "/":
        return Response(status=302, headers=[
            ("Location", "/static/test/test.html"),
        ])

    match = re.match("^/api/(.+)", request.path)
    if match:
        api = TestAPI()
        return handle_rpc(request, match.group(1), api)
    return Response("unknown: " + request.path, status=404)

if __name__ == '__main__':
    from werkzeug.serving import run_simple
    static_root = os.path.join(os.path.dirname(__file__), "../")
    run_simple('127.0.0.1', 4513, application,
               use_debugger=True, use_reloader=True,
               static_files={"/static": static_root })

