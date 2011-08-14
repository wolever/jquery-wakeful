(function($) {
  function partial(fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    return function() {
      return fn.apply(this, args.concat(Array.prototype.slice.call(arguments)));
    };
  };

  function log() {
    if (typeof console != "undefined")
      console.log.apply(console, arguments);
  }

  var _json;
  if (typeof JSON != "undefined")
    _json = JSON;

  $.Wakeful = function(options) {
    var self = $.extend({
      baseUrl: undefined,
      serializer: _json
    }, (options || {}));

    self.log = log;

    self.defaultCallSettings = {
      url: "",
      args: [],
      kwargs: {},
      getArgs: {},
      data: {},
      success: function(result) {},
      error: function(error) {
        self.log("warning: error without errback", error);
      },
      complete: function(status) {}
    };

    self.callFixType = function(settings) {
      var type = settings.type.toUpperCase();
      settings.originalType = type;

      if (type == "GET" || type == "POST")
        return;

      settings.getArgs.__actual_type = type;
      settings.type = "POST";
    };

    self.callAppendGetArgs = function(settings) {
      var argsStr = $.param(settings.getArgs);
      if (argsStr.length == 0)
        return;

      var getStart = args.url.indexOf("?");
      if (getStart < 0) {
        argsStr = "?" + argsStr;
      } else if (getStart < (settings.url.length - 1)) {
        // Note: -1 because, if the URL matches /\?$/, we just append the
        // argsStr.
        argsStr = "&" + argsStr;
      }

      settings.url += argsStr;
    };

    self.callExpandUrlVariables = function(settings) {
      var newUrl = settings.url.replace(/{(.*?)}/g, function(match, key) {
        var source;
        if (isNaN(parseInt(key))) {
          source = settings.kwargs;
        } else {
          source = settings.args;
        }

        var result = source[key];
        if (result === undefined)
          return match;
        
        if (source === settings.kwargs) {
          delete source[key];
        } else {
          source.splice(key, 1);
        }

        return encodeURIComponent(result);
      });
      settings.url = newUrl;
    };

    self.callSetDataFromArgs = function(settings) {
      var kwargs = settings.kwargs;
      var kwargsNeedSerializing = false;
      for (var key in kwargs) {
        if (!(kwargs.hasOwnProperty(key)))
          continue;
        var value = kwargs[key];
        var type = typeof value;
        if (!(type == "string" || type == "number")) {
          kwargsNeedSerializing = true;
          break;
        }
      }

      if (kwargsNeedSerializing) {
        settings.data.__kwargs = self.serializer.stringify(kwargs);
      } else {
        $.extend(settings.data, kwargs);
      }

      var args = settings.args;
      if (args.length > 0) {
        settings.data.__args = self.serializer.stringify(args);
      }
    };

    self.callPrefixUrlWithBase = function(settings) {
      if (self.baseUrl)
        settings.url = self.baseUrl + settings.url;
    };

    self.callCallback_success = function(settings, data, textStatus, jqXHR) {
      try {
        var result = self.serializer.parse(data);
      } catch (e) {
        settings._original_error({
          type: "parse",
          err: e
        });
        return;
      }

      if (!result) {
        settings._original_error({
          type: "invalid-data",
          msg: "null result"
        });
        return;
      }

      if (!result.ok) {
        settings._original_error({
          type: "app",
          msg: result.msg,
          result: result
        });
        return;
      }

      settings._original_success(result.data);
    };

    self.callCallback_error = function(settings, jqXHR, textStatus, errorThrown) {
      settings._original_error({
        type: "transport",
        jqXHR: jqXHR,
        textStatus: textStatus,
        errorThrown: errorThrown
      });
    };

    self.callCallback_complete = function(settings, jqXHR, textStatus) {
      settings._original_complete({
        jqXHR: jqXHR,
        textStatus: textStatus
      });
    };

    self.callSetupCallbacks = function(settings) {
      var callbacks = ["success", "error", "complete"];
      for (var i = 0; i < callbacks.length; i += 1) {
        var callback = callbacks[i];
        var original = settings[callback];
        settings["_original_" + callback] = original;
        settings[callback] = partial(self["callCallback_" + callback], settings);
      }
    };

    self.callSetup = function(settings) {
      // Setup the call so it will be a valid jQuery call
      self.callFixType(settings);
      self.callSetDataFromArgs(settings);
      self.callSetupCallbacks(settings);

      // Munge the URL a bit
      self.callExpandUrlVariables(settings);
      self.callAppendGetArgs(settings);
      self.callPrefixUrlWithBase(settings);
    }

    self.call = function(settings) {
      settings = $.extend({}, self.defaultCallSettings, settings);
      self.callSetup(settings);
      return $.ajax(settings);
    };

    self._callFactory = function(type) {
      return function(url) {
        var args = Array.prototype.slice.call(arguments);
        if (!$.isArray(args[1]))
          args.splice(1, 0, undefined);
        if (!$.isPlainObject(args[2]))
          args.splice(2, 0, undefined);
        return self.call({
          type: type,
          url: url,
          args: args[1],
          kwargs: args[2],
          success: args[3],
          error: args[4]
        });
      };
    };

    self.get = self._callFactory("GET");
    return self;
  };

  $.wakeful = $.Wakeful();

})(jQuery);
