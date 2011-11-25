(function($) {
  function partial(fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    return function() {
      return fn.apply(this, args.concat(Array.prototype.slice.call(arguments)));
    };
  }

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

    self.attachGetArgs = function(url, args) {
      var argsStr = $.param(args);
      if (argsStr.length == 0)
        return url;

      var getStart = url.indexOf("?");
      if (getStart < 0) {
        argsStr = "?" + argsStr;
      } else if (getStart < (url.length - 1)) {
        // Note: -1 because, if the URL matches /\?$/, we just append the
        // argsStr.
        argsStr = "&" + argsStr;
      }

      return url + argsStr;
    };

    self.defaultCallSettings = function() {
      return {
        type: "GET",
        url: "",
        args: [],
        kwargs: {},
        getArgs: {},
        data: {},
        success: function(result) {},
        error: function(error) {
          self.log("warning: error without errback", error);
        },
        complete: function(status) {},
        // Don't let jQuery try to load the response for us
        converters: {},
        dataType: "text"
      };
    };

    self.callFixType = function(settings) {
      var type = settings.type.toUpperCase();
      settings.originalType = type;

      if (type == "GET" || type == "POST")
        return;

      settings.getArgs.__actual_method = type;
      settings.type = "POST";
    };

    self.callAppendGetArgs = function(settings) {
      settings.url = self.attachGetArgs(settings.url, settings.getArgs);
    };

    self.callExpandUrlVariables = function(settings) {
      var argsToRemove = [];
      var kwargsToRemove = [];

      var newUrl = settings.url.replace(/\{(.*?)\}/g, function(match, key) {
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
          kwargsToRemove.push(key);
        } else {
          argsToRemove.push(+key);
        }

        return encodeURIComponent(result);
      });

      settings.url = newUrl;

      if (argsToRemove.length > 0) {
        var removed = {};
        argsToRemove.sort();
        for (var i = (argsToRemove.length - 1); i >= 0; i -= 1) {
          var toRemove = argsToRemove[i];
          if (removed[toRemove])
            continue;
          removed[toRemove] = true;
          settings.args.splice(toRemove, 1);
        }
      }

      if (kwargsToRemove.length > 0) {
        for (var i = 0; i < kwargsToRemove.length; i += 1)
          delete settings.kwargs[kwargsToRemove[i]];
      }

    };

    self.callSetDataFromArgs = function(settings) {
      var kwargs = settings.kwargs;
      var kwargsNeedSerializing = false;
      for (var key in kwargs) {
        if (!(kwargs.hasOwnProperty(key)))
          continue;
        var value = kwargs[key];
        var type = typeof value;
        if (type != "string") {
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

    /**
     * Parses a response string.
     * If an error is encountered, an error object is returned:
     *     { error: {
     *         type: "...",
     *         msg: "...",
     *         resultStr: "...",
     *         result: (<parsed response>|undefined),
     *         ...
     *     }}
     * (see code for possible "types")
     *
     * Otherwise an ok object is returned:
     *     { ok: <parsed response>.data }
     */
    self.parseResult = function(resultStr) {
      var result;

      var error = function(type, msg, extra) {
        return { error: $.extend({
          type: type,
          msg: msg,
          resultStr: resultStr,
          result: result
        }, extra || {})};
      };

      try {
        result = self.serializer.parse(resultStr);
      } catch (e) {
        return error("parse", "error while parsing response: " + e, {
          err: e
        });
      }

      if (!result)
        return error("invalid-data", "null result");
      
      if (result.error)
        return error("app", result.msg);

      if (!result.ok)
        return error("invalid-data", "neither result.error or result.ok set");

      return { ok: result.data };
    };

    self.callCallback_success = function(settings, data, textStatus, jqXHR) {
      var result = self.parseResult(data);
      if (result.error) {
        settings._original_error(result.error);
      } else {
        settings._original_success(result.ok);
      }
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
      self.callFixType(settings);

      self.callExpandUrlVariables(settings);
      self.callAppendGetArgs(settings);
      self.callPrefixUrlWithBase(settings);

      self.callSetDataFromArgs(settings);
      self.callSetupCallbacks(settings);

      return settings;
    };

    self.url = function(url) {
      var settingsArgs = Array.prototype.slice.call(arguments, [1]);
      var settings = self.buildSettings("GET", url, settingsArgs);
      settings = $.extend({}, self.defaultCallSettings(), settings);
      self.callExpandUrlVariables(settings);
      self.callSetDataFromArgs(settings);
      $.extend(settings.getArgs, settings.data);
      self.callAppendGetArgs(settings);
      self.callPrefixUrlWithBase(settings);
      return settings.url;
    };

    self.call = function(settings) {
      settings = $.extend({}, self.defaultCallSettings(), settings);
      self.callSetup(settings);
      return $.ajax(settings);
    };

    self.buildSettings = function(type, url, args) {
      if (!$.isArray(args[0]))
        args.splice(0, 0, undefined);
      if (!$.isPlainObject(args[1]))
        args.splice(1, 0, undefined);
      return {
        type: type,
        url: url,
        args: args[0],
        kwargs: args[1],
        success: args[2],
        error: args[3]
      };
    };

    self._callFactory = function(type) {
      return function(url) {
        var settingsArgs = Array.prototype.slice.call(arguments, [1]);
        return self.call(self.buildSettings(type, url, settingsArgs));
      };
    };

    self.get = self._callFactory("GET");
    self.post = self._callFactory("POST");
    self.put = self._callFactory("PUT");
    self.del = self._callFactory("DELETE");
    // Note: 'del' is used because 'delete' is a reserved word.
    return self;
  };

  $.wakeful = $.Wakeful();

})(jQuery);
