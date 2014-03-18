var RedisPool = require('./index')();
var assert = require('assert');

function testRedisConn(cb) {
  RedisPool.getClient(function(rc, done) {
    assert.equal(RedisPool._connections.all.length, 1);
    assert.equal(RedisPool._connections.free.length, 0);
    RedisPool.close(rc);
    cb();
  });
};

function testFree(cb) {
  RedisPool.getClient(function(rc, done) {
    assert.equal(RedisPool._connections.free.length, 0);
    done();
    assert.equal(RedisPool._connections.free.length, 1);
    RedisPool.close(rc);
    cb();
  });
};

function testPoolAndCloseAll(cb) {
  var totalCnt = RedisPool._config.maxConnections, completeCnt = 0;
  var check = function() {
    assert.equal(RedisPool._connections.free.length, 0);
    assert.equal(RedisPool._connections.all.length, totalCnt);
    RedisPool.closeAll();
    assert.equal(RedisPool._connections.all.length, 0);
    cb();
  }
  for (var i = 0; i<totalCnt; i++) {
    RedisPool.getClient(function(rc, done) {
      if (++completeCnt == totalCnt) {
        check();
      }
    })
  }
};

function testQueue(cb) {
  var totalCnt = RedisPool._config.maxConnections + 5, completeCnt = 0, closed = 0;
  var check = function() {
    assert.equal(RedisPool._connections.free.length, 0);
    assert.equal(RedisPool._connections.all.length, RedisPool._config.maxConnections);
    assert.equal(RedisPool._queue, 0);
    RedisPool.closeAll();
    cb();
  }
  for (var i = 0; i<totalCnt; i++) {
    RedisPool.getClient(function(rc, done) {
      setTimeout(function() {
        assert.equal(RedisPool._queue.length, (5-closed > 0 ? 5-closed : 0));
        done();
        closed++;
        assert.equal(RedisPool._queue.length, (5-closed > 0 ? 5-closed : 0));
      }, 3000);
      if (++completeCnt == totalCnt) {
        check();
      }
    })
  }
};

testRedisConn(function() {
  testFree(function() {
    testPoolAndCloseAll(function() {
      testQueue(function() {
        console.log('All tests complete');
      });
    })
  })
});