var assert = require('assert');
var TESTS_COLLECTION = 'moca-tests';
var async = require('async');

describe('Store', function(){
  var Store = require('../');
  describe('General', function(){
    it('Should init with no config object', function(done){
      Store.init();
      done();
    });
    it('Should take a custom stores object', function(done){
      Store.init({stores: {}});
      done();
    });
    it('Should call callback if supplied', function(done){
      new Store(TESTS_COLLECTION, function(err, test){
        assert(test);
        done();
      });
    });
    it('Should init a store when asked', function(done){
      var test = new Store(TESTS_COLLECTION);
      assert(test);
      done();
    });
    it('Should init a store from collection option', function(done){
      var test = new Store({collection: TESTS_COLLECTION});
      assert(test);
      done();
    });
    it('Should throw an error when trying to update a record by id that doesn\'t exist', function(done){
      var test = new Store({collection: TESTS_COLLECTION});
      test.update('1234', {}, function(err){
        assert(!!err, 'No error thrown on invalid ID');
        done();
      });
    });
    it('Should throw an error when trying to update a record by key that doesn\'t exist', function(done){
      var test = new Store({collection: TESTS_COLLECTION});
      test.update({foo: 'bar 1'}, {}, function(err){
        assert(!!err, 'No error thrown on invalid ID');
        done();
      });
    });
    it('Should insert records', function(done){
      var test = new Store(TESTS_COLLECTION);
      test.insert({foo: 'bar 1'}, function(err, rec){
        assert(!err, 'Test store threw an error: '+(err||'').toString());
        var rec = rec[rec.root];
        assert(rec);
        assert(rec._created, 'Created doesn\'t exist');
        assert(rec._id);
        done();
      });
    });
    it('Should be able to retrieve a record by _id', function(done){
      var test = new Store(TESTS_COLLECTION);
      var r = {foo: 'bar 2'};
      test.insert(r, function(err, rec){
        assert(!err, 'Test store threw an error: '+(err||'').toString());
        var rec = rec[rec.root];
        assert(rec, 'Record didn\'t return on insert');
        test.get(rec._id, function(err, rec2){
          assert(!err, 'Test store threw an error: '+(err||'').toString());
          assert(rec2, 'Record didn\'t return on get');
          assert(rec._id.toString() === rec2[rec2.root]._id.toString());
          assert(rec2[rec2.root].foo === r.foo, 'Fetched record does not match inserted record');
          done();
        });
      });
    });
    it('Should be able to update a record by _id', function(done){
      var test = new Store(TESTS_COLLECTION);
      var r = {foo: 'bar 3'};
      test.insert(r, function(err, rec){
        assert(!err, 'Test store threw an error: '+(err||'').toString());
        var rec = rec[rec.root];
        assert(rec, 'Record didn\'t return on insert');
        test.update(rec._id, {bar: 'none', foo: 'bar 3'}, function(err, rec2){
          assert(!err, 'Test store threw an error: '+(err||'').toString());
          var res = rec2[rec2.root];
          assert(res, 'Record didn\'t return on get');
          assert(res._created, 'Created got cleared');
          assert(res._updated, 'Updated doesn\'t exist');
          assert(rec._id.toString() === rec2[rec2.root]._id.toString());
          assert(rec2[rec2.root].foo === r.foo, 'Fetched record does not match inserted record');
          done();
        });
      });
    });
    it('Should be able to update a record by using filter', function(done){
      var test = new Store(TESTS_COLLECTION);
      var r = {foo: 'bar 4'};
      test.insert(r, function(err, rec){
        assert(!err, 'Test store threw an error: '+(err||'').toString());
        var rec = rec[rec.root];
        assert(rec, 'Record didn\'t return on insert');
        test.update({foo: 'bar 4'}, {bar: 'none', foo: 'bar 4'}, function(err, rec2){
          assert(!err, 'Test store threw an error: '+(err||'').toString());
          var res = rec2[rec2.root];
          assert(res, 'Record didn\'t return on get');
          assert(res._created, 'Created got cleared');
          assert(res._updated, 'Updated doesn\'t exist');
          assert(rec._id.toString() === rec2[rec2.root]._id.toString());
          assert(rec2[rec2.root].foo === r.foo, 'Fetched record does not match inserted record');
          done();
        });
      });
    });
    it('Should be able to list records from a store', function(done){
      var test = new Store(TESTS_COLLECTION);
      test.asArray(null, function(err, res){
        assert(!err, 'Test store threw an error: '+(err||'').toString());
        assert(res.length===4, 'Length is wrong');
        assert(res.count===4, 'Count is wrong');
        done();
      });
    });
    it('Should be able to list records from a store', function(done){
      var test = new Store(TESTS_COLLECTION);
      test.asArray(null, function(err, res){
        assert(!err, 'Test store threw an error: '+(err||'').toString());
        assert(res.length===4, 'Length is wrong');
        assert(res.count===4, 'Count is wrong');
        done();
      });
    });
    it('Should be able to paginate records from a store', function(done){
      var test = new Store(TESTS_COLLECTION);
      test.asArray({offset: 1, limit: 1}, function(err, res){
        assert(!err, 'Test store threw an error: '+(err||'').toString());
        assert(res.length===4, 'Length is wrong');
        assert(res.offset===1, 'Offset is wrong');
        assert(res.limit===1, 'Limit is wrong');
        assert(res.count===1, 'Count is wrong');
        assert(res[res.root][0].foo === 'bar 2', 'Wrong record returned');
        done();
      });
    });
    it('Should be able to filter records from a store', function(done){
      var test = new Store(TESTS_COLLECTION);
      test.asArray({filter: {bar: {$exists: true}}}, function(err, res){
        assert(!err, 'Test store threw an error: '+(err||'').toString());
        assert(res.length===2, 'Length is wrong');
        assert(res.count===2, 'Count is wrong');
        done();
      });
    });
    it('Should be able to filter and paginate records from a store', function(done){
      var test = new Store(TESTS_COLLECTION);
      test.asArray({filter: {bar: {$exists: false}}, offset: 1, limit: 1}, function(err, res){
        assert(!err, 'Test store threw an error: '+(err||'').toString());
        assert(res.length===2, 'Length is wrong');
        assert(res.offset===1, 'Offset is wrong');
        assert(res.limit===1, 'Limit is wrong');
        assert(res.count===1, 'Count is wrong');
        assert(res[res.root][0].foo === 'bar 1', 'Wrong record returned');
        done();
      });
    });
    it('Should be able to delete a record by id',  function(done){
      var test = new Store(TESTS_COLLECTION);
      test.insert({delete: 'me'}, function(err, rec){
        var id = rec[rec.root]._id;
        assert(id, 'Record didn\'t get created');
        test.asArray({filter: {delete: 'me'}}, function(err, result){
          assert(!err, 'Test store threw an error: '+(err||'').toString());
          var rec = result[result.root][0];
          assert(rec.delete==='me', 'Got the wrong record');
          test.delete(id, function(err, deleted){
            assert(!err, 'Test store threw an error: '+(err||'').toString());
            assert(deleted, 'Didn\'t get deleted');
            test.asArray({filter: {delete: 'me'}}, function(err, result){
              assert(result.length===0, 'Record said it deleted but didn\'t');
              done();
            });
          });
        });
      });
    });
  });
  describe('Cleanup', function(){
    it('Should let us delete all records', function(done){
      var test = new Store(TESTS_COLLECTION);
      test.asArray(null, function(err, result){
        assert(!err, 'Test store threw an error: '+(err||'').toString());
        var records = result[result.root];
        async.each(records, function(record, next){
          var id = record._id;
          test.delete(id.toString(), function(err, ok){
            assert(ok, 'Record with id of '+id+' did not delete');
            next();
          });
        }, function(){
          test.asArray(null, function(err, result){
            assert(result.length === 0, 'Records didn\'t all get cleaned up');
            done();
          });
        });
      });
    });
  });
  describe('Race Condition', function(){
    it('Should handle race conditions to updates', function(done){
      var test = new Store(TESTS_COLLECTION);
      var r = {
            foo: 'bar',
            _v: 1
          };
      test.insert(r, function(err, record){
        assert(!err, 'Test store threw an error: '+(err||'').toString());
        var checkUpdateVersion = function(i){
          test.asArray({}, function(err, records){
            assert(!err, 'Test store threw an error: '+(err||'').toString());
            var rec = records[records.root].shift();
            var _v = rec._v;
            rec.i = i;
            rec._v = rec._v + 1;
            test.update({_v: _v, foo: 'bar'}, rec, function(err, rec){
              assert(!err, 'Test store threw an error: '+(err||'').toString());
              return done();
            });
          });
        };
        test.update(r, {foo: 'bar', _v: 2, t: 1}, function(err){
          if(err){
            checkUpdateVersion(1);
          }
        });
        test.update(r, {foo: 'bar', _v: 2, t: 2}, function(err){
          if(err){
            checkUpdateVersion(2);
          }
        });
      });
    });
  });
});
