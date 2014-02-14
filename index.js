var redis = require('redis');
var settings = require('./default-settings');
var helpers = require('./helpers');

module.exports = function(config) {
  return new RedisPool(config);
};

var pools = {};

function RedisPool(config) {
  var config = helpers.mergeOptions(settings, config);
  var hash = helpers.createHash(config);
  if (typeof pools[hash] != 'undefined') {
    return pools[hash];
  }
  this._config = config;
  pools[hash] = this;
  this._connections = {
    all: [],
    free: [],
    count: 0
  };
  this._queue = [];
};

RedisPool.prototype.getClient = function(cb) {
  var rc;
  var RP = this;
  if ((rc = this._getFreeClient()) != null) {
    cb(rc, function() {
      RP.release(rc);
    });
  }
  else if (this._connections.count >= this._config.maxConnections) {
    this._queue.push(cb);
  }
  else {
    this._createClient(cb);
  }
};

RedisPool.prototype._getFreeClient = function() {
  if (this._connections.free.length > 0) {
    var rc = this._connections.free[0];
    helpers.removeArrayEl(this._connections.free, rc);
    return rc;
  }
  return null;
};

RedisPool.prototype._createClient = function(cb) {
  this._connections.count++;
  var cbDone = false;
  var RP = this;
  var newCb = function(rc) {
    if (!cbDone) {
      if (rc != null) {
        RP._connections.all.push(rc);
      }
      cbDone = true;
      cb(rc, function() {
        RP.release(rc);
      });
    }
  }
  var rc = redis.createClient(this._config.port, this._config.host, this._config.options);
  if (this._config.password) {
    rc.auth(this._config.password, function(err) {
      if (err) {
        console.error('redis auth error:', err);
        throw err;
      }
    });
  }
  rc.on('ready', function() {
    newCb(rc);
  });
  if (this._config.handleRedisError) {
    var RP = this;
    rc.on('error', function(e) {
      console.error('redis error:', e);
      newCb(null);
      RP.close(rc);
    });
  }
};

RedisPool.prototype.close = function(rc) {
  helpers.removeArrayEl(this._connections.free, rc);
  helpers.removeArrayEl(this._connections.all, rc);
  this._connections.count--;
  rc.quit();
  this._releaseQueue();
};

RedisPool.prototype.release = function(rc) {
  if (this._connections.free.indexOf(rc) == -1 && this._connections.all.indexOf(rc) != -1) {
    this._connections.free.push(rc);
    this._releaseQueue();
  }
};

RedisPool.prototype._releaseQueue = function() {
  if (this._queue.length > 0) {
    var cb = this._queue[0];
    helpers.removeArrayEl(this._queue, cb);
    this.getClient(cb);
  }
};

RedisPool.prototype.closeAll = function() {
  for (var i = this._connections.all.length - 1; i>=0; i--) {
    this.close(this._connections.all[i]);
  }
}