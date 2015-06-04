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

Store.init = function(cfg){
  var config = cfg || {stores: _stores};
  _stores = config.stores || {};
};

Store.prototype.get = function(_id, callback){
  var self = this, store = self._store;
  process.nextTick(function(){
    var idx = store._indexes.indexOf(_id);
    callback(null, {
      root: 'record',
      record: store._store[idx]
    });
  });
};

Store.prototype.insert = function(record, callback){
  var self = this, store = self._store;
  record._created = new Date();
  process.nextTick(function(){
    var id = record._id || uuid();
    var idx = store._store.length;
    record._id = id;
    store._indexes[idx] = id;
    store._store[idx] = record;
    return callback(null, {root: 'record', record: record});
  });
};

Store.prototype.update = function(_id, record, callback){
  var self = this, store = self._store;
  record._updated = new Date();
  process.nextTick(function(){
    var idx = store._indexes.indexOf(_id);
    if(idx>-1){
      record._id = _id;
      record._created = store._store[idx]._created;
      store._store[idx] = record;
      return callback(null, {root: 'record', record: record});
    }else{
      return callback('Record with ID of '+_id+' does not exist!');
    }
  });
};

Store.prototype.delete = function(_id, callback){
  var self = this, store = self._store;

  process.nextTick(function(){
    var idx = store._indexes.indexOf(_id);
    if(idx>-1){
      store._indexes.splice(idx, 1);
      store._store.splice(idx, 1);
      return callback(null, true);
    }else{
      return callback('Record with ID of '+_id+' does not exist!');
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
  process.nextTick(function(){
    var result = {length: count, count: records.length, limit: limit, offset: offset, root: 'response', response: records};
    callback(null, result);
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
        callback(null, results.length>1?results:results[0]);
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
      callback(null, recs[0]);
    }
  });
};
