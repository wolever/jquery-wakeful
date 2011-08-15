jquery-wakeful: A REST RPC protocol and jQuery based client
===========================================================

Current Status
--------------

Wakeful is currently being used in-house. It it still fairly new, though, so
expect some rough edges.


The Client
----------

Some examples of the Wakeful client::

    > var api = $.Wakeful({ baseUrl: "http://example.com/api/" })
    > api.get("people/{0}", ["wolever"], { include_friends: "yes" }, function(result) {
    .     console.log("got person:", result);
    . })
    >>> GET …/people/wolever?include_friends=yes
    <<< {"ok": true, "data": {"name": "David Wolever", "friends": ["shazow"]}}
    got person: {"name": "David Wolever", "friends": ["shazow"]}

    > api.post("people/new", { handle: "wolever", name: "David Wolever" })
    >>> POST …/people/new
    ... Content-Type: application/x-www-form-urlencoded; charset=UTF-8
    ...
    ... __kwargs="%7B%22id%22%3A%22wolever%22%2C%22name%22%3A%22David%20Wolever%22%7D"
    <<< {"ok": true, data: {"id": "eb2ab64120344db8bf56614f5c05fc33"}}

Note that, by default, the Wakeful client uses the browser's native JSON
serialization. It is up to the developer to set ``Wakeful().serializer`` if the
browser doesn't support JSON or a different serializer is desired.

The client is designed to be very extensible. For example, if the result of a
call is an image instead of serialized data, the client can be used to create
an appropriate URL. For example::

    > var call = api.callSetup($.extend(api.defaultCallSettings(), {
    .     url: "people/{0}/avatar",
    .     args: ["wolever"],
    .     kwargs: { size: "50" }
    . }));
    > var url = api.attachGetArgs(call.url, call.data);
    > url
    '…/people/wolever/avatar?size=50'
    > var img = new Image();
    > img.src = url;


Callbacks
.........

As with jQuery, three callbacks can be deinfed: success, error and complete.
The success and error callbacks can be specified as the second last and last
arguments of the ``{get,post,put,…}`` functions (ex, ``get(url, args, kwargs,
success, error)``). Otherwise they can be passed directly to the ``call``
method's ``settings``.

The **success** callback will be called with one argument: the return value of
the call: ``success(result)``.

The **error** callback will be called with an object ``{ type: …, … }`` which
describes the nature of the error. The possible values for ``type`` are:

    ``"parse"``
        When the serializer raised an exception while trying to parse the
        response. Additional fields:

        ``err``
            The exception raised by the serializer.

    ``"invalid-data"``
        When the result is not valid (either because it is ``null`` or neither
        ``ok`` or ``error`` are set). Additional fields:

        ``msg``
            A short description of the error

        ``result``
            The original result.

    ``"app"``
        When the server returned an ``error`` response. Additional fields:

        ``msg``
            The ``msg`` field from the server's response.

        ``result``
            The original result.

    ``"transport"``
        When an error occured during transport. Additional fields are 

        ``jqXHR``, ``textStatus``, ``errorThrown``
            The values provided by jQuery's ``.ajax(…)`` function.

The **complete** callback will be called with an object ``{ jqXHR: …,
textStatus: … }``, which contains the values provided by jQuery's ``.ajax(…)``
function.

The Server
----------

Because of the wide variety of server frameworks and requirements it is not
feasable (or sensible?) to include drop-in server code. However a sample
server, implemented in Python, is provided in ``test/server.py``, and the tests
(included in ``tests/tests.html``) can be used to test your implementation.


The Protocol
------------

The Wakeful protocol is designed to:

* Make arbitrary RPC-style calls (eg, with arguments and keyword/optional
  arguments) possible over idiomatic HTTP.
* Be accessable from browser-based JavaScript.
* Be easy to implement (see ``test/server.py`` for an example).

Wakeful calls and responses must follow these rules:

1. The HTTP method may be specified using the GET argument ``__actual_method``.
   For example, if a JavaScript client wants to send a ``PUT`` request, it may
   issue the request ``POST /example?__actual_method=PUT`` (this is necessary
   because browser-based JavaScript cannot reliably use any methods besides
   ``GET`` and ``POST``). See ``Wakeful.callFixType()`` a client
   implementation.

2. Call arguments are specified according to the following rules (see
   ``Wakeful.callSetDataFromArgs`` for a cliemt implementation):

    1. Keyword arguments which are *strings* may be specified as URL encoded
       GET or POST arguments. For example, ``get("get_person", {name:
       "wolever"})`` may be issued using ``GET /get_person?name=wolever``.
    2. Keyword arguments which are *not* strings (eg, numbers, arrays,
       objects) must be serialized into the ``__kwargs`` GET or POST argument.
       For example, ``post("set_friends", { friends: ["wolever", "shazow"] })``
       must be issued using ``POST /set_friends`` with the argument
       ``__kwargs`` set to ``serialize({ fiends: ["wolever", "shazow"] })``.
    3. The list of positional arguments must be serialized to the GET or POST
       argument ``__args``. For example, ``get("person_by_id", ["person_id"])``
       must be issued using ``GET /person_by_id`` with the ``__args`` GET
       variable set to ``serialize(["person_id"])``.
    4. If either keyword or positional arguments are empty, they may be
       ommitted. For exmaple, ``get("people", [], {})`` may be issued using
       ``GET /people``.

3. Call results must be a serialized dictionary containing either ``{ ok: true,
   data: … }`` or ``{ error: true, msg: …, … }`` (where ``…`` may be any
   value). If ``error`` is ``true``, then the client must return an error which
   includes the ``msg`` and any additional data. If ``ok`` is ``true``, the
   client must return ``data`` to the caller.

