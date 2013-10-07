/*
 * Oni Apollo system module ('builtin:apollo-sys') common part
 *
 * Part of the StratifiedJS Runtime
 * http://onilabs.com/stratifiedjs
 *
 * (c) 2010-2013 Oni Labs, http://onilabs.com
 *
 * This file is licensed under the terms of the MIT License:
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */
/**
   @module apollo-sys-common
   @summary 'common' part of built-in Apollo system module
   @desc

   The StratifiedJS system module, accessible as
   `require('builtin:apollo-sys')`, is spread over two parts: the 'common'
   part, and the 'hostenv' specific part (where hostenv currently is
   one of 'xbrowser' or 'nodejs' - see [apollo-sys-xbrowser::] and
   [apollo-sys-nodejs::])

   The hostenv-specific file must provide the following functions:

   * jsonp_hostenv
   * getXDomainCaps_hostenv
   * request_hostenv
   * getTopReqParent_hostenv
   * resolveSchemelessURL_hostenv
   * getHubs_hostenv
   * getExtensions_hostenv
   * eval_hostenv
   * init_hostenv

*/

__oni_rt.sys = exports;

// we don't want to rely on the global 'undefined' symbol; see
// https://groups.google.com/d/msg/oni-apollo/fNMz2W8S5mU/sYCgrriYj1MJ
var UNDEF; // == undefined

// __oni_rt_bundle is the well-known location where
// bundle scripts will preload module sources.
// Bundles will define this object themselves
// if they are loaded before us.
if (!(__oni_rt.G.__oni_rt_bundle)) {
  __oni_rt.G.__oni_rt_bundle = {};
}

//----------------------------------------------------------------------
// helper functions that we use internally and export for use by other
// libraries; accessible through require('builtin:apollo-sys')

/**
   @variable hostenv
   @summary see [../../modules/sys::hostenv]
*/
exports.hostenv = __oni_rt.hostenv;

/**
   @function getGlobal
   @summary see [../../modules/sys::getGlobal]
*/
__js exports.getGlobal = function() { return __oni_rt.G; };

/**
   @function isArrayLike
   @summary  Tests if an object is an array, `arguments` object or, in an xbrowser hostenv of StratifiedJS, a NodeList.
   @param    {anything} [testObj] Object to test.
   @return   {Boolean}
   @desc
     See [../../modules/array::isArrayLike]
*/
__js exports.isArrayLike = function(obj) {
  return Array.isArray(obj) || 
         !!(obj && Object.prototype.hasOwnProperty.call(obj, 'callee')) ||
         !!(__oni_rt.G.NodeList && obj instanceof NodeList);
};

/**
  @function flatten
  @summary Create a recursively flattened version of an array.
  @param   {Array} [arr] The array to flatten.
  @return  {Array} Flattend version of *arr*, consisting of the elements
                   of *arr*, but with elements that are arrays replaced by
                   their elements (recursively).
  @desc
    See [../../modules/array::flatten]
*/
__js exports.flatten = function(arr, rv) {
  var rv = rv || [];
  var l=arr.length;
  for (var i=0; i<l; ++i) {
    var elem = arr[i];
    if (exports.isArrayLike(elem))
      exports.flatten(elem, rv);
    else
      rv.push(elem);
  }
  return rv;
};

/**
  @function expandSingleArgument
  @summary Returns an array from an `arguments` object with either multiple objects or a single array element.
  @param   {Arguments} [args] an *arguments* object.
  @return  {Array|Arguments}
                  If *args* has length 1 and its only element is an array,
                  returns that array.
                  Otherwise, returns `args`.
  @desc
    The intent is to allow functions that accept a sequence of items to be called as either:
    
        fn(a, b, c);
        fn([a,b,c]);

      In both cases, calling expandSingleArgument(arguments) from within `fn` will return [a,b,c].

      Note that flattening is only applied if a single argument is given, and flattening is non-recursive.
*/
__js exports.expandSingleArgument = function(args) {
  if (args.length == 1 && exports.isArrayLike(args[0]))
    args = args[0];
  return args;
}

/**
   @function isQuasi
   @summary  Tests if an object is a Quasi
   @param    {anything} [testObj] Object to test.
   @return   {Boolean}
   @desc
     See [../../modules/quasi::isQuasi]
*/
__js exports.isQuasi = function(obj) {
  return (obj instanceof __oni_rt.QuasiProto);
};

/**
   @function Quasi
   @summary Create a Quasi
   @summary See [../../modules/quasi::Quasi]
*/
__js exports.Quasi = function(arr) { return __oni_rt.Quasi.apply(__oni_rt, arr)};


/**
   @function mergeObjects
   @summary See [../../modules/object::merge]
*/
__js exports.mergeObjects = function(/*source*/) {
  var rv = {};
  var sources = exports.expandSingleArgument(arguments);
  for (var i=0; i<sources.length; i++) {
    exports.extendObject(rv, sources[i]);
  }
  return rv;
};

/**
   @function extendObject
   @summary See [../../modules/object::extend]
*/
__js exports.extendObject = function(dest, source) {
  for (var o in source) {
    if (Object.prototype.hasOwnProperty.call(source, o)) dest[o] = source[o];
  }
  return dest;
};


/**
  @function parseURL
  @summary Parses the given URL into components.
  @param {String} [url] URL to parse.
  @return {Object} Parsed URL as described at <http://stevenlevithan.com/demo/parseuri/js/> (using 'strict' mode).
  @desc
     Uses the parseuri function from <http://blog.stevenlevithan.com/archives/parseuri>.
*/
/*
  Implementation is taken originally from
  parseUri 1.2.2
  (c) Steven Levithan <stevenlevithan.com>
  MIT License
  http://blog.stevenlevithan.com/archives/parseuri
*/
__js {
function URI() {}
  URI.prototype = {
    toString: function() {
      return "#{this.protocol}://#{this.authority}#{this.relative}";
    }
  };
  URI.prototype.params = function() {
    if (!this._params) {
      var rv = {};
      this.query.replace(parseURLOptions.qsParser, function(_,k,v) {
        if (k) rv[decodeURIComponent(k)] = decodeURIComponent(v);
      });
      this._params = rv;
    }
    return this._params;
  };

  var parseURLOptions = {
    key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
    qsParser: /(?:^|&)([^&=]*)=?([^&]*)/g,
    // We're only using the 'strict' mode parser:
    parser: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
  }

  exports.parseURL = function(str) {
    var o = parseURLOptions,
    m = o.parser.exec(str),
    uri = new URI(),
    i = 14;
    while (i--) uri[o.key[i]] = m[i] || "";
    return uri;
  };
}

/**
  @function  constructQueryString
  @summary Build a URL query string.
  @param {QUERYHASHARR} [hashes] Object(s) with key/value pairs.
  @return {String}
  @desc
    See [../../modules/url::buildQuery]
*/
__js exports.constructQueryString = function(/*hashes*/) {
  var hashes = exports.flatten(arguments);
  var hl = hashes.length;
  var parts = [];
  for (var h=0; h<hl; ++h) {
    var hash = hashes[h];
    for (var q in hash) {
      var l = encodeURIComponent(q) + "=";
      var val = hash[q];
      if (!exports.isArrayLike(val))
        parts.push(l + encodeURIComponent(val));
      else {
        for (var i=0; i<val.length; ++i)
          parts.push(l + encodeURIComponent(val[i]));
      }
    }
  }
  return parts.join("&");
};

/**
  @function constructURL
  @summary Build a URL string.
  @param {URLSPEC} [urlspec] Base string and optional path strings
                   and query hashes. See [../../modules/url::build] for full syntax.
  @return {String}
*/
__js exports.constructURL = function(/* url_spec */) {
  var url_spec = exports.flatten(arguments);
  var l = url_spec.length;
  var rv = url_spec[0];
  
  // path components:
  for (var i=1; i<l; ++i) {
    var comp = url_spec[i];
    if (typeof comp != "string") break;
    if (rv.charAt(rv.length-1) != "/") rv += "/";
    rv += comp.charAt(0) == "/" ? comp.substr(1) :comp;
  }
  
  // query string:
  var qparts = [];
  for (;i<l;++i) {
    var part = exports.constructQueryString(url_spec[i]);
    if (part.length)
      qparts.push(part);
  }
  var query = qparts.join("&");
  if (query.length) {
    if (rv.indexOf("?") != -1)
      rv += "&";
    else
      rv += "?";
    rv += query;
  }
  return rv;
};

/**
  @function isSameOrigin
  @summary Checks if the given URLs have matching authority parts.
  @param {String} [url1] First URL.
  @param {String} [url2] Second URL.
*/
__js exports.isSameOrigin = function(url1, url2) {
  var a1 = exports.parseURL(url1).authority;
  if (!a1) return true;
  var a2 = exports.parseURL(url2).authority;
  return  !a2 || (a1 == a2);
};


/**
  @function canonicalizeURL
  @summary Convert relative to absolute URLs and collapse '.' and '..' path
           components.
  @param {String} [url] URL to canonicalize.
  @param {optional String} [base] URL which will be taken as a base if *url* is relative.
  @return {String} Canonicalized URL.
*/
__js exports.canonicalizeURL = function(url, base) {

  if (__oni_rt.hostenv == "nodejs" && __oni_rt.G.process.platform == 'win32') {
    // special case for mapping Windows paths in nodejs hostenv
    url  = url.replace(/\\/g, "/");
    base = base.replace(/\\/g, "/"); 
  }

  var a = exports.parseURL(url);
  
  // convert relative->absolute:
  if (base && (base = exports.parseURL(base)) &&
      (!a.protocol || a.protocol == base.protocol)) {
    if (!a.directory && !a.protocol) {
      a.directory = base.directory;
      if (!a.path && (a.query || a.anchor))
        a.file = base.file;
    }
    else if (a.directory && a.directory.charAt(0) != '/') {
      // a is relative to base.directory
      a.directory = (base.directory || "/") + a.directory;
    }
    if (!a.protocol) {
      a.protocol = base.protocol;
      if (!a.authority)
        a.authority = base.authority;
    }
  }

  // collapse "." & "..":
  var pin = a.directory.split("/");
  var l = pin.length;
  var pout = [];
  for (var i=0; i<l; ++i) {
    var c = pin[i];
    if (c == ".") continue;
    if (c == ".." && pout.length>1)
      pout.pop();
    else
      pout.push(c);
  }
  a.directory = pout.join("/");
  
  // build return value:
  var rv = "";
  if (a.protocol) rv += a.protocol + ":";
  if (a.authority)
    rv += "//" + a.authority;
  else if (a.protocol == "file") // file urls have an implied authority 'localhost'
    rv += "//";
  rv += a.directory + a.file;
  if (a.query) rv += "?" + a.query;
  if (a.anchor) rv += "#" + a.anchor;
  return rv;
};

/**
   @function  jsonp
   @summary   Perform a cross-domain capable JSONP-style request. 
   @param {URLSPEC} [url] Request URL (in the same format as accepted by [url.build](#url/build))
   @param {optional Object} [settings] Hash of settings (or array of hashes)
   @return    {Object}
   @setting {QUERYHASHARR} [query] Additional query hash(es) to append to url. Accepts same format as [url.buildQuery](#url/buildQuery).
   @setting {String} [cbfield="callback"] Name of JSONP callback field in query string.
   @setting {String} [forcecb] Force the name of the callback to the given string. 
*/
exports.jsonp = jsonp_hostenv; // to be implemented in hostenv-specific part


/**
   @function getXDomainCaps
   @summary Returns the cross-domain capabilities of the host environment ('CORS'|'none'|'*')
   @return {String}
*/
exports.getXDomainCaps = getXDomainCaps_hostenv; // to be implemented in hostenv-specific part


/**
   @function request
   @summary Performs an [XMLHttpRequest](https://developer.mozilla.org/en/XMLHttpRequest)-like HTTP request.
   @param {URLSPEC} [url] Request URL (in the same format as accepted by [url.buil](#url/build))
   @param {optional Object} [settings] Hash of settings (or array of hashes)
   @return {String}
   @setting {String} [method="GET"] Request method.
   @setting {QUERYHASHARR} [query] Additional query hash(es) to append to url. Accepts same format as [url.buildQuery](#url/buildQuery).
   @setting {String} [body] Request body.
   @setting {Object} [headers] Hash of additional request headers.
   @setting {String} [username] Username for authentication.
   @setting {String} [password] Password for authentication.
   @setting {Boolean} [throwing=true] Throw exception on error.
*/
exports.request = request_hostenv;

/**
  @function makeMemoizedFunction
  @summary
    See [../../modules/cutil::makeMemoizedFunction]
*/
exports.makeMemoizedFunction = function(f, keyfn) {
  var lookups_in_progress = {};

  var memoizer = function() {
    var key = keyfn ? keyfn.apply(this,arguments) : arguments[0];
    var rv = memoizer.db[key];
    if (typeof rv !== 'undefined') return rv;
    if (!lookups_in_progress[key])
      lookups_in_progress[key] = spawn (function(self, args) {
        return memoizer.db[key] = f.apply(self, args);
      })(this, arguments);
    try {
      return lookups_in_progress[key].waitforValue();
    }
    finally {
      if (lookups_in_progress[key].waiting() == 0) {
        lookups_in_progress[key].abort();
        delete lookups_in_progress[key];
      }
    }
  };

  memoizer.db = {};
  return memoizer;
};

//----------------------------------------------------------------------

/**
   @function eval
   @summary see [../../modules/sys::eval]
*/
exports.eval = eval_hostenv;

//----------------------------------------------------------------------
// require mechanism

var pendingLoads = {};

// require.alias, require.path are different for each
// module. makeRequire is a helper to construct a suitable require
// function that has access to these variables:
function makeRequire(parent) {
  // make properties of this require function accessible in requireInner:
  var rf = function(module, settings) {
    __js var opts = exports.extendObject({}, settings);
    if (opts.callback) {
      (spawn (function() {
        try { 
          var rv = requireInner(module, rf, parent, opts);
        }
        catch(e) { 
          opts.callback(e); return 1;
        }
        opts.callback(UNDEF, rv);
      })());
    }
    else
      return requireInner(module, rf, parent, opts);
  };

  rf.merge = function(/* modules */) {
    var rv = {}, args = arguments;

    // helper to build a binary recursion tree to load the modules in parallel:
    // XXX we really want to use cutil::waitforAll here
    function inner(i, l) {
      if (l === 1) {
        var descriptor = args[i];
        var id, settings, exclude, include, name;
        __js if (typeof descriptor === 'string') {
          id = descriptor;
          exclude = [];
          include = null;
          name = null;
        }
        else {
          id = descriptor.id;
          settings = descriptor.settings;
          exclude = descriptor.exclude || [];
          include = descriptor.include || null;
          name = descriptor.name || null;
        }

        var module = rf(id, settings);
        // XXX wish we could use exports.extendObject here, but we
        // want the duplicate symbol check
        __js {
          var check = function(o) {
            if (rv[o] !== undefined)
              throw new Error("require.merge(.) name clash while merging module '#{id}': Symbol '#{o}' defined in multiple modules");
          };

          if (name) {
            check(name);
            rv[name] = module;
          } else if (include) {
            for (var i=0; i<include.length; i++) {
              var o = include[i];
              if (!module[o]) throw new Error("require.merge(.) module #{id} has no symbol #{o}");
              check(o);
              rv[o] = module[o];
            }
          } else {
            for (var o in module) {
              if (!Object.prototype.hasOwnProperty.call(module, o) || exclude.indexOf(o) !== -1) continue;
              check(o);
              rv[o] = module[o];
            }
          }
        }
      }
      else {
        var split = Math.floor(l/2);
        waitfor {
          inner(i, split);
        }
        and {
          inner(i+split, l-split);
        }
      }
    }

    // kick off the load:
    inner(0, args.length);

    return rv;
  };

  __js {

  rf.resolve = function(module, settings) {
    var opts = exports.extendObject({}, settings);
    return resolve(module, rf, parent, opts);
  };

  rf.url = function(relative) { 
    // Hack: We set a 'dummy' loader to prevent the resolver from appending '.sjs'
    return resolve(relative, rf, parent, {loader: 'dummy'}).path;
  };

  rf.path = ""; // default path is empty
  rf.alias = {};

  // install shared properties:
  if (exports.require) {
    rf.hubs = exports.require.hubs;
    rf.modules = exports.require.modules;
    rf.extensions = exports.require.extensions;
  }
  else {
    // we're the root
    rf.hubs = augmentHubs(getHubs_hostenv());
    rf.modules = {};
    // module compiler functions indexed by extension:
    rf.extensions = getExtensions_hostenv();
  }

  } // __js

  return rf;
}
exports._makeRequire = makeRequire;

__js function augmentHubs(hubs) {
  // add additional methods to the `require.hubs` array:
  hubs.addDefault = function(hub) {
    if (!this.defined(hub[0])) {
      this.push(hub);
      return true;
    }
    return false;
  };
  hubs.defined = function(prefix) {
    for (var i=0; i<this.length; i++) {
      var h = this[i][0];
      var l = Math.min(h.length, prefix.length);
      if (h.substr(0, l) == prefix.substr(0,l)) return true;
    }
    return false;
  };
  return hubs;
}

function html_sjs_extractor(html, descriptor) {
  var re = /<script (?:[^>]+ )?(?:type=['"]text\/sjs['"]|main=['"]([^'"]+)['"])[^>]*>((.|\n)*?)<\/script>/mg; // (fix vim highlighting) /
  var match;
  var src = '';
  while(match = re.exec(html)) {
    if (match[1]) src += 'require("' + match[1] + '")';
    else src += match[2];
    src += ';'
  }
  if (!src) throw new Error("No sjs found in HTML file");
  return default_compiler(src, descriptor);
}

// helper to resolve aliases
__js function resolveAliases(module, aliases) {
  var ALIAS_REST = /^([^:]+):(.*)$/;
  var alias_rest, alias;
  var rv = module;
  var level = 10; // we allow 10 levels of aliasing
  while ((alias_rest=ALIAS_REST.exec(rv)) &&
         (alias=aliases[alias_rest[1]])) {
    if (--level == 0)
      throw new Error("Too much aliasing in modulename '"+module+"'");
    rv = alias + alias_rest[2];
  }
  return rv;
}

// helper to resolve hubs
__js function resolveHubs(module, hubs, require_obj, parent, opts) {
  var path = module;
  var loader = opts.loader || default_loader;
  var src = opts.src || default_src_loader;

  // apply hostenv-specific resolution if path is scheme-less
  if (path.indexOf(":") == -1)
    path = resolveSchemelessURL_hostenv(path, require_obj, parent);
  
  var level = 10; // we allow 10 levels of rewriting indirection
  for (var i=0,hub; hub=hubs[i++]; ) {
    if (path.indexOf(hub[0]) == 0) {
      // we've got a match
      if (typeof hub[1] == "string") {
        path = hub[1] + path.substring(hub[0].length);
        // make sure the resulting path is absolute:
        if (path.indexOf(":") == -1)
          path = resolveSchemelessURL_hostenv(path, require_obj, parent);
        i=0; // start resolution from beginning again
        if (--level == 0)
          throw new Error("Too much indirection in hub resolution for module '"+module+"'");
      }
      else if (typeof hub[1] == "object") {
        if (hub[1].src) src = hub[1].src;
        if (hub[1].loader) loader = hub[1].loader;
        // that's it; no more indirection
        break;
      }
      else 
        throw new Error("Unexpected value for require.hubs element '"+hub[0]+"'");
    }
  }

  return {path:path, loader:loader, src:src};
}

// default module loader
__js function default_src_loader(path) {
  throw new Error("Don't know how to load module at "+path);
}


var compiled_src_tag = /^\/\*\__oni_compiled_sjs_1\*\//;
function default_compiler(src, descriptor) {
  //var start = new Date();
  var f;
  if (typeof(src) === 'function') {
    f = src;
  }
  else if (compiled_src_tag.exec(src)) {
    //console.log("#{descriptor.id} precompiled");
    // great; src is already compiled
    // XXX apparently eval is faster on FF, but eval is tricky with 
    // precompiled code, because of IE, where we need execScript

    f = new Function("module", "exports", "require", "__onimodulename", "__oni_altns", src);
  }
  else {
    f = exports.eval("(function(module,exports,require, __onimodulename, __oni_altns){"+src+"\n})",
                     {filename:"module #{descriptor.id}"});
  }
  f(descriptor, descriptor.exports, descriptor.require, "module #{descriptor.id}", {});
  //console.log("eval(#{descriptor.id}) = #{(new Date())-start} ms");
}
// used when precompiling modules - must be kept in sync with the above f() call
default_compiler.module_args = ['module', 'exports', 'require', '__onimodulename', '__oni_altns'];

function default_loader(path, parent, src_loader, opts) {
  // determine compiler function based on extension:
  var extension = /.+\.([^\.\/]+)$/.exec(path)[1]

  var compile = exports.require.extensions[extension];
  if (!compile) 
    throw new Error("Unknown type '"+extension+"'");
  
  var descriptor;
  if (!(descriptor = exports.require.modules[path])) {
    // we don't have this module cached -> load it
    var pendingHook = pendingLoads[path];
    if (!pendingHook) {
      pendingHook = pendingLoads[path] = spawn (function() {
        var src, loaded_from;
        if (typeof src_loader === "string") {
          src = src_loader;
          loaded_from = "[src string]";
        }
        else if (path in __oni_rt.modsrc) {
          // a built-in module
          loaded_from = "[builtin]";
          src = __oni_rt.modsrc[path];
          delete __oni_rt.modsrc[path];
          // xxx support plain js modules for built-ins?
        }
        else {
          ({src, loaded_from}) = src_loader(path);
        }
        var descriptor = {
          id: path,
          exports: {},
          loaded_from: loaded_from,
          loaded_by: parent,
          required_by: {}
        };
        descriptor.require = makeRequire(descriptor);

        if (opts.main) descriptor.require.main = descriptor;
        compile(src, descriptor);
        // It is important that we only set
        // exports.require.modules[module] AFTER compilation, because
        // the compilation might block, and we might get reentrant
        // calls to require() asking for the module that is still
        // being constructed.
        exports.require.modules[path] = descriptor;

        return descriptor;
      })();
    }
    else {
      // there is already a load pending for this module.
      // traverse this module's parent chain to detect loops:
      var p = parent;
      // We deliberately only traverse up to toplevel-1; there
      // are legitimate usecases in conductance where the *url* .../foo.sjs
      // loads the *module* .../foo.sjs.
      // In practice this means that in rare cases a cycle might only
      // be detected on the second loop.
      while (p.loaded_by) { 
        if (path === p.id)
          throw new Error("Circular module dependency loading #{path}");
        p = p.loaded_by;
      }
    }

      // 
    
    // wait for load to complete:
    try {
      var descriptor = pendingHook.waitforValue();
    }
    finally {
      // last one cleans up
      if (pendingHook.waiting() == 0)
        delete pendingLoads[path];
    }
  }
  
  if (!descriptor.required_by[parent.id])
    descriptor.required_by[parent.id] = 1;
  else
    ++descriptor.required_by[parent.id];
  
  return descriptor.exports;
}

__js default_loader.resolve = function(spec) {
  var p = spec.path;
  if (p.charAt(p.length-1) != '/') {
    // native modules are compiled based on extension:
    var matches = /.+\.([^\.\/]+)$/.exec(p);
    if (!matches || !exports.require.extensions[matches[1]])
      spec.path += ".sjs";
  }
}

function http_src_loader(path) {
  return { 
    src:         request_hostenv([path, {format:'compiled'}], {mime:'text/plain'}), 
    loaded_from: path 
  };
}


// loader that loads directly from github
// XXX the github API is now x-domain capable; at some point, when we
// drop support for older browsers, we can get rid of jsonp here and
// load via http.json
var github_api = "https://api.github.com/";
var github_opts = {cbfield:"callback"};
function github_src_loader(path) {
  var user, repo, tag;
  try {
    [,user,repo,tag,path] = /github:([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)/.exec(path);
  } catch(e) { throw new Error("Malformed module id '"+path+"'"); }
  
  var url = exports.constructURL(github_api, 'repos', user, repo, "contents", path,{ref:tag});

  waitfor {
    var data = jsonp_hostenv(url,github_opts).data;
  }
  or {
    hold(10000);
    throw new Error("Github timeout");
  }
  if (data.message && !data.content)
    throw new Error(data.message);
  
  // XXX maybe we should move some string functions into apollo-sys-common
  var str = exports.require('sjs:string');

  return {
    src: str.utf8ToUtf16(str.base64ToOctets(data.content)),
    loaded_from: url
  };
}

// resolve module id to {path,loader,src}
__js function resolve(module, require_obj, parent, opts) {
  // apply local aliases:
  var path = resolveAliases(module, require_obj.alias);
  
  var hubs = exports.require.hubs;
  // apply global aliases
  var resolveSpec = resolveHubs(path, hubs, require_obj, parent, opts);
  
  // make sure we have an absolute url with '.' & '..' collapsed:
  resolveSpec.path = exports.canonicalizeURL(resolveSpec.path, parent.id);  

  if (resolveSpec.loader.resolve) resolveSpec.loader.resolve(resolveSpec, parent);

  var preload = __oni_rt.G.__oni_rt_bundle;
  var pendingHubs = false;
  if (preload.h) {
    // check for any unresolved hubs:
    var deleteHubs = [];
    for (var k in preload.h) {
      if (!Object.prototype.hasOwnProperty.call(preload.h, k)) continue;
      var entries = preload.h[k];
      var parent = getTopReqParent_hostenv();
      var resolved = resolveHubs(k, hubs, exports.require, parent, {});
      if (resolved.path === k) {
        // hub not yet installed
        pendingHubs = true;
        continue;
      }

      for (var i=0; i<entries.length; i++) {
        var ent = entries[i];
        preload.m[resolved.path + ent[0]] = ent[1];
      }
      deleteHubs.push(k);
    }

    if (!pendingHubs) delete preload.h;
    else {
      // delete now-resolved hubs
      for (var i=0; i<deleteHubs.length; i++)
        delete preload.h[deleteHubs[i]];
    }
  }

  if (preload.m) {
    var path = resolveSpec.path;
    var contents = preload.m[path];
    if (contents !== undefined) {
      resolveSpec.src = function() {
        // once loaded, we remove src from memory to save space
        delete preload.m[path];
        var empty = true;
        for (var k in preload.m) {
          if (Object.prototype.hasOwnProperty.call(preload.m, k)) {
            empty = false;
            break;
          }
        }
        if(empty) delete preload.m;
        return {src:contents, loaded_from: path+"#bundle"};
      };
    }
  }

  return resolveSpec;
}

/**
   @function resolve
   @summary  Apollo's internal URL resolver
*/
__js exports.resolve = function(url, require_obj, parent, opts) {
  require_obj = require_obj || exports.require;
  parent = parent || getTopReqParent_hostenv();
  opts = opts || {};
  return resolve(url, require_obj, parent, opts);
};

// requireInner: workhorse for require
function requireInner(module, require_obj, parent, opts) {
  //var start = new Date();
  var resolveSpec = resolve(module, require_obj, parent, opts);

  // now perform the load:
  module = resolveSpec.loader(resolveSpec.path, parent, resolveSpec.src, opts, resolveSpec);
  if (opts.copyTo) {
    exports.extendObject(opts.copyTo, module);
  }
  //console.log("require(#{resolveSpec.path}) = #{(new Date())-start} ms");
  return module;
}

// top-level require function:
__js exports.require = makeRequire(getTopReqParent_hostenv());

__js exports.require.modules['builtin:apollo-sys.sjs'] = {
  id: 'builtin:apollo-sys.sjs',
  exports: exports,
  loaded_from: "[builtin]",
  required_by: { "[system]":1 }
};

exports.init = function(cb) {
  init_hostenv();
  cb();
}
