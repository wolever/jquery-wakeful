import os
import re
import json

from werkzeug.wrappers import Request, Response

class AppError(Exception):
    def __init__(self, msg, data):
        self.msg = msg
        self.data = data


class TestAPI(object):
    def __init__(self, request_method):
        self.request_method = request_method

    def echo(self, *args, **kwargs):
        result = dict(kwargs)
        result.update([ (idx, var) for (idx, var)
                        in enumerate(args) ])
        result["method"] = self.request_method
        return result


def handle_rpc(request, func_name):
    get_kwargs = dict(request.args.items())
    post_kwargs = dict(request.form.items())

    kwargs = dict(get_kwargs)
    kwargs.update(post_kwargs)

    json_kwargs = json.loads(kwargs.pop("__kwargs", "{}"))
    kwargs.update(json_kwargs)
    kwargs = dict((str(key), val) for (key, val)
                  in kwargs.items())

    args = json.loads(kwargs.pop("__args", "[]"))

    method = kwargs.pop("__actual_type", request.method)
    api = TestAPI(method)

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
        return handle_rpc(request, match.group(1))
    return Response("unknown: " + request.path, status=404)

if __name__ == '__main__':
    from werkzeug.serving import run_simple
    static_root = os.path.join(os.path.dirname(__file__), "../")
    run_simple('127.0.0.1', 4513, application,
               use_debugger=True, use_reloader=True,
               static_files={"/static": static_root })

