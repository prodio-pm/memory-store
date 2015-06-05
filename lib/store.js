var async = require('async');
var sift = require('sift');
var uuid = (function(){
  var uuid = require('bson-objectid');
  return function(){
    return uuid().toString();
  };
})();

var noop = function(){};
var isNumeric = function (n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
};
var _stores = {};

var extend = function() {
  // copy reference to target object
  var target = arguments[0] || {}, i = 1, length = arguments.length, deep = false, options, name, src, copy;

  // Handle a deep copy situation
  if (typeof target === 'boolean') {
    deep = target;
    target = arguments[1] || {};
    // skip the boolean and the target
    i = 2;
  }

  // Handle case when target is a string or something (possible in deep copy)
  if (typeof target !== 'object' && !typeof target === 'function')
    target = {};

  var isPlainObject = function(obj) {
    // Must be an Object.
    // Because of IE, we also have to check the presence of the constructor property.
    // Make sure that DOM nodes and window objects don't pass through, as well
    if (!obj || toString.call(obj) !== '[object Object]' || obj.nodeType || obj.setInterval)
      return false;

    var has_own_constructor = hasOwnProperty.call(obj, 'constructor');
    var has_is_property_of_method = obj.constructor&&hasOwnProperty.call(obj.constructor.prototype, 'isPrototypeOf');
    // Not own constructor property must be Object
    if (obj.constructor && !has_own_constructor && !has_is_property_of_method)
      return false;

    // Own properties are enumerated firstly, so to speed up,
    // if last one is own, then all properties are own.

    var last_key;
    for (key in obj)
      last_key = key;

    return typeof last_key === 'undefined' || hasOwnProperty.call(obj, last_key);
  };

  for (; i < length; i++) {
    // Only deal with non-null/undefined values
    if ((options = arguments[i]) !== null) {
      // Extend the base object
      for (name in options) {
        src = target[name];
        copy = options[name];

        // Prevent never-ending loop
        if (target === copy)
            continue;

        // Recurse if we're merging object literal values or arrays
        if (deep && copy && (isPlainObject(copy) || Array.isArray(copy))) {
          var clone = src && (isPlainObject(src) || Array.isArray(src)) ? src : Array.isArray(copy) ? [] : {};

          // Never move original objects, clone them
          target[name] = extend(deep, clone, copy);

        // Don't bring in undefined values
        } else if (typeof copy !== 'undefined')
          target[name] = copy;
      }
    }
  }

  // Return the modified object
  return target;
};

var InvalidRecordError = function InvalidRecordError(key){
  var criteria = typeof(key)==='string'?{_id: key}:key;
  var info = JSON.stringify(criteria);
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = 'Could not locate record matching '+info;
  this.key = criteria;
};

var Store = module.exports = function(options, callback){
  var self = this;
  var hasOptions = typeof(options) === 'object';
  var collectionName = hasOptions ? options.collectionName || options.collection : options;
  self._store = _stores[collectionName] = (_stores[collectionName] || {
    _store: [],
    _iid: 0,
    _indexes: []
  });
  self.collectionName = collectionName;
  if(typeof(callback)==='function'){
    setImmediate(function(){
      callback(null, self);
    });
  }
};

var lock = function(store, callback){
  if(store._lock){
    return setImmediate(function(){
      lock(store, callback);
    });
  }
  store._lock = true;
  return setImmediate(function(){
    return callback(function(){
      store._lock = false;
    });
  });
};

Store.init = function(cfg){
  var config = cfg || {stores: _stores};
  _stores = config.stores || {};
};

Store.prototype.get = function(_id, callback){
  var self = this, store = self._store;
  lock(this, function(unlock){
    var idx = store._indexes.indexOf(_id);
    unlock();
    return callback(null, {
      root: 'record',
      record: store._store[idx]
    });
  });
};

Store.prototype.insert = function(record, callback){
  var self = this, store = self._store;
  record._created = new Date();
  lock(this, function(unlock){
    var id = record._id || uuid();
    var idx = store._store.length;
    record._id = id;
    store._indexes[idx] = id;
    store._store[idx] = record;
    unlock();
    return callback(null, {root: 'record', record: extend(true, {}, record)});
  });
};

Store.prototype.update = function(_id, record, callback){
  var self = this, store = self._store, findKey;
  record._updated = new Date();
  lock(this, function(unlock){
    if(typeof(_id)==='object'){
      var recs = sift(_id, store._store);
      if(!recs || !recs.length){
        unlock();
        return callback(new InvalidRecordError(_id));
      }
      _id = recs[0]._id;
    }
    var idx = store._indexes.indexOf(_id);
    if(idx>-1){
      record._id = _id;
      record._created = store._store[idx]._created;
      store._store[idx] = record;
      unlock();
      return callback(null, {root: 'record', record: extend(true, {}, record)});
    }else{
      unlock();
      return callback(new InvalidRecordError(_id));
    }
  });
};

Store.prototype.delete = function(_id, callback){
  var self = this, store = self._store;

  lock(this, function(unlock){
    var idx = store._indexes.indexOf(_id);
    if(idx>-1){
      store._indexes.splice(idx, 1);
      store._store.splice(idx, 1);
      unlock();
      return callback(null, true);
    }else{
      unlock();
      return callback(new InvalidRecordError(_id));
    }
  });
};

var buildCompareFunc = function(o){
  var keys = Object.keys(o), val, ord;
  var src = 'var cmp = '+(function(a, b){
    var v;
    if(!isNaN(parseFloat(a)) && isFinite(b)){
      v = a-b;
      if(v>0) return 1;
      if(v<0) return -1;
      return 0;
    }else{
      return (""+a).localeCompare(""+b);
    }
  }).toString()+'\r\n';
  keys.forEach(function(key){
    val = o[key];
    if(val>0){
      ord = 'a.'+key+', b.'+key;
    }else if(val<0){
      ord = 'b.'+key+', a.'+key;
    }
    src += 'v = cmp('+ord+');\r\n'+
      'if(v!=0) return v\r\n';
  });
  src+='return 0;';
  return new Function('a', 'b', src);
};

Store.prototype.asArray = function(options, callback){
  var self = this, store = self._store._store;
  lock(this, function(unlock){
    options = options || {};
    var records = options.filter?sift(options.filter, store):store;
    var count = records.length;
    var offset = isNumeric(options.offset)?parseInt(options.offset):0;
    var limit = isNumeric(options.limit)?parseInt(options.limit):count;
    if(options.sort){
      var f = buildCompareFunc(options.sort);
      records = records.sort(f);
    }
    records = records.slice(offset, offset+limit);
    var result = {length: count, count: records.length, limit: limit, offset: offset, root: 'response', response: extend(true, [], records)};
    unlock();
    return callback(null, result);
  });
};

Store.prototype.upsert = function(key, record, callback){
  var self = this;
  self.asArray({filter: key}, function(err, recs){
    if(err){
      return callback(err);
    }
    recs = recs[recs.root];
    if((!recs)||recs.length==0){
      self.insert(record, callback);
    }else{
      var results = [];
      async.each(recs, function(rec, next){
        self.update(rec._id, record, function(err, data){
          results.push(data);
          next();
        });
      }, function(){
        callback(null, results.length>1?extend(true, [], results):extend(true, {}, results[0]));
      });
    }
  });
};

Store.prototype.ensure = function(record, callback){
  var self = this;
  self.asArray({filter: record}, function(err, recs){
    if(err){
      return callback(err);
    }
    recs = recs[recs.root];
    if((!recs)||recs.length==0){
      self.insert(record, callback);
    }else{
      callback(null, extend(true, recs[0]));
    }
  });
};
