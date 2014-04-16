/*!
 * @overview  Ember Data Socket Adapter
 * @copyright Copyright 2014 Collectrium LLC.
 * @author Andrew Fan <andrew.fan@upsilonit.com>
 */
// v0.1.8
// 6ce8a46 (2014-04-16 19:56:08 +0300)


(function(global) {
//copied from Ember-data loader https://github.com/emberjs/data/blob/master/vendor/loader.js
var define, requireModule, require, requirejs;

(function() {
  var registry = {}, seen = {};

  define = function(name, deps, callback) {
    registry[name] = { deps: deps, callback: callback };
  };

  requirejs = require = requireModule = function(name) {
    requirejs._eak_seen = registry;

    if (seen[name]) {
      return seen[name];
    }
    seen[name] = {};

    if (!registry[name]) {
      throw new Error("Could not find module " + name);
    }

    var mod = registry[name],
      deps = mod.deps,
      callback = mod.callback,
      reified = [],
      exports;

    for (var i = 0, l = deps.length; i < l; i++) {
      if (deps[i] === 'exports') {
        reified.push(exports = {});
      } else {
        reified.push(requireModule(resolve(deps[i])));
      }
    }

    var value = callback.apply(this, reified);
    seen[name] = exports || value;
    return seen[name];

    function resolve(child) {
      if (child.charAt(0) !== '.') {
        return child;
      }
      var parts = child.split("/");
      var parentBase = name.split("/").slice(0, -1);

      for (var i = 0, l = parts.length; i < l; i++) {
        var part = parts[i];

        if (part === '..') {
          parentBase.pop();
        }
        else if (part === '.') {
          continue;
        }
        else {
          parentBase.push(part);
        }
      }

      return parentBase.join("/");
    }
  };
})();
define("socket-adapter/adapter", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /*global io */
    var get = Ember.get, set = Ember.set;
    var forEach = Ember.EnumerableUtils.forEach;

    var SocketAdapter = DS.RESTAdapter.extend({
      socketAddress: 'http://api.collectrium.websocket:5000',
      bulkOperationsSupport: true,

      socketConnections: null,
      requestsPool: null,

      /**
       * generate unique request id
       * @returns {string}
       */
      generateRequestId: function() {
        var S4 = function() {
          return Math.floor(
              Math.random() * 0x10000 // 65536
          ).toString(16);
        };

        return (
          S4() + S4() + "-" +
          S4() + "-" +
          S4() + "-" +
          S4() + "-" +
          S4() + S4() + S4()
          );
      },

      /**
       *
       * @param root
       * @param options
       * @returns {Ember.get|*|Object}
       */
      getConnection: function(root, options) {
        if (arguments.length === 1) {
          options = {};
        }
        if (root instanceof Object) {
          options = root;
          root = '/';
        }
        var connections = get(this, 'socketConnections'),
          socketNS = get(connections, root),
          address = this.get('socketAddress'),
          requestsPool = this.get('requestsPool');

        if (!socketNS) {
          address += '/';
          if (root !== '/') {
            address = address + root + '/';
          }
          socketNS = io.connect(address, options);
          set(connections, root, socketNS);
        }
        //TODO: when should be reject promise hmmm?
        socketNS.on('message', function(response) {
          //TODO: think about push update
          if (response.request_id && requestsPool[response.request_id]) {
            Ember.run(null, requestsPool[response.request_id].resolve, response);
            delete response.request_id;
            delete requestsPool[response.request_id];
          }
        });

        return socketNS;
      },

      /**
       *
       * @param type
       * @param requestType
       * @param hash
       * @returns {Ember.RSVP.Promise}
       */
      send: function(type, requestType, hash) {
        var connection = this.getConnection(type.typeKey),
          requestsPool = this.get('requestsPool'),
          requestId = this.generateRequestId(),
          deffered = Ember.RSVP.defer(
              "DS: SocketAdapter#emit " + requestType + " to " + type.typeKey
          );
        if (!(hash instanceof Object)) {
          hash = {};
        }
        hash.request_id = requestId;
        requestsPool[requestId] = deffered;
        connection.emit(requestType, hash);
        return deffered.promise;
      },

      /**
       * Fetching all resources of a given type from server, can't be called with params.
       * Returns resources without full relations.
       * @param store
       * @param type
       * @returns {Ember.RSVP.Promise}
       */
      findAll: function(store, type) {
        return this.send(type, 'READ_LIST');
      },

      /**
       *
       * @param store
       * @param type
       * @param query
       * @returns {Ember.RSVP.Promise}
       */
      findQuery: function(store, type, query) {
        return this.send(type, 'READ_LIST', query);
      },

      /**
       *
       * @param store
       * @param type
       * @param id
       * @returns {Ember.RSVP.Promise}
       */
      find: function(store, type, id) {
        return this.send(type, 'READ', {id: id});
      },

      /**
       *
       * @param store
       * @param type
       * @param record
       * @returns {Ember.RSVP.Promise}
       */
      createRecord: function(store, type, record) {
        var serializer = store.serializerFor(type.typeKey),
          data = serializer.serialize(record, { includeId: true });

        return this.send(type, 'CREATE', data);
      },

      /**
       *
       * @param store
       * @param type
       * @param records
       * @returns {Ember.RSVP.Promise}
       */
      createRecords: function(store, type, records) {
        var serializer = store.serializerFor(type.typeKey),
          data = {};
        data[type.typeKey] = [];

        forEach(records, function(record) {
          data[type.typeKey].push(serializer.serialize(record));
        });
        return this.send(type, 'CREATE_LIST', data);
      },

      /**
       *
       * @param store
       * @param type
       * @param record
       * @returns {*|ajax|v.support.ajax|jQuery.ajax|Promise|E.ajax}
       */
      updateRecord: function(store, type, record) {
        var serializer = store.serializerFor(type.typeKey),
          data = serializer.serialize(record, { includeId: true });

        return this.send(type, 'UPDATE', data);
      },

      /**
       *
       * @param store
       * @param type
       * @param records
       * @returns {Ember.RSVP.Promise}
       */
      updateRecords: function(store, type, records) {
        var serializer = store.serializerFor(type.typeKey),
          data = {};
        data[type.typeKey] = [];

        forEach(records, function(record) {
          data[type.typeKey].push(serializer.serialize(record, { includeId: true }));
        });

        return this.send(type, 'UPDATE_LIST', data);
      },

      /**
       *
       * @param store
       * @param type
       * @param record
       * @returns {Ember.RSVP.Promise}
       */
      deleteRecord: function(store, type, record) {
        var id = get(record, 'id');

        return this.send(type, 'DELETE', {id: id});
      },

      /**
       *
       * @param store
       * @param type
       * @param records
       * @returns {Ember.RSVP.Promise}
       */
      deleteRecords: function(store, type, records) {
        var data = {
          ids: []
        };

        forEach(records, function(record) {
          data.ids.push(get(record, 'id'));
        });

        return this.send(type, 'DELETE_LIST', data);
      },


      openSocket: function() {
        set(this, 'socketConnections', Ember.Object.create());
        set(this, 'requestsPool', Ember.Object.create());
        this.getConnection({
          resource: 'handshake'
        });
      }.on('init')
    });

    __exports__["default"] = SocketAdapter;
  });
define("socket-adapter/main", 
  ["socket-adapter/serializer","socket-adapter/adapter","socket-adapter/store","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    var serializer = __dependency1__["default"];
    var adapter = __dependency2__["default"];
    var store = __dependency3__["default"];

    var VERSION = "0.1.8";
    var SA;
    if ('undefined' === typeof SA) {

      SA = Ember.Namespace.create({
        VERSION: VERSION,
        Adapter: adapter,
        Serializer: serializer,
        Store: store
      });

      if (Ember.libraries) {
        Ember.libraries.registerCoreLibrary('Socket Adapter', SA.VERSION);
      }
    }

    __exports__["default"] = SA;
  });
define("socket-adapter/serializer", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var Serializer = DS.RESTSerializer.extend({
      extractFindQuery: function(store, type, payload) {
        return this.extractArray(store, type, payload.payload);
      },
      extractFindAll: function(store, type, payload) {
        return this.extractArray(store, type, payload.payload);
      }
    });

    __exports__["default"] = Serializer;
  });
define("socket-adapter/store", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var get = Ember.get, set = Ember.set;
    var forEach = Ember.EnumerableUtils.forEach;
    var Promise = Ember.RSVP.Promise;
    var PromiseArray = Ember.ArrayProxy.extend(Ember.PromiseProxyMixin);

    //copied from ember-data store core
    function isThenable(object) {
      return object && typeof object.then === 'function';
    }
    //copied from ember-data store core
    function serializerFor(container, type, defaultSerializer) {
      return container.lookup('serializer:' + type) ||
             container.lookup('serializer:application') ||
             container.lookup('serializer:' + defaultSerializer) ||
             container.lookup('serializer:-default');
    }
    //copied from ember-data store core
    function serializerForAdapter(adapter, type) {
      var serializer = adapter.serializer,
        defaultSerializer = adapter.defaultSerializer,
        container = adapter.container;

      if (container && serializer === undefined) {
        serializer = serializerFor(container, type.typeKey, defaultSerializer);
      }

      if (serializer === null || serializer === undefined) {
        serializer = {
          extract: function(store, type, payload) {
            return payload;
          }
        };
      }

      return serializer;
    }
    //copied from ember-data store core
    function _commit(adapter, store, operation, record) {
      var type = record.constructor,
        promise = adapter[operation](store, type, record),
        serializer = serializerForAdapter(adapter, type),
        label = "DS: Extract and notify about " + operation + " completion of " + record;

      Ember.assert("Your adapter's '" + operation + "' method must return a promise, but it returned " +
                   promise, isThenable(promise));

      return promise.then(function(adapterPayload) {
        var payload;

        if (adapterPayload) {
          payload = serializer.extract(store, type, adapterPayload, get(record, 'id'), operation);
        } else {
          payload = adapterPayload;
        }

        store.didSaveRecord(record, payload);
        return record;
      }, function(reason) {
        if (reason instanceof DS.InvalidError) {
          store.recordWasInvalid(record, reason.errors);
        } else {
          store.recordWasError(record, reason);
        }

        throw reason;
      }, label);
    }

    //copied from ember-data store core
    function promiseArray(promise, label) {
      return PromiseArray.create({
        promise: Promise.cast(promise, label)
      });
    }

    function _bulkCommit(adapter, store, operation, type, records) {
      var promise = adapter[operation](store, type, records),
        serializer = serializerForAdapter(adapter, type),
        label = "DS: Extract and notify about " + operation + " completion of " + records.length +
                " of type " + type.typeKey;

      Ember.assert("Your adapter's '" + operation +
                   "' method must return a promise, but it returned " +
                   promise, isThenable(promise));

      return promise.then(function(adapterPayload) {
        //TODO: iterate through adapterPayload and load record's json to store
        if (adapterPayload) {
          operation = operation.substring(0, operation.length - 1);
          forEach(records, function(record) {
            var payload;
            if (adapterPayload) {
              payload = serializer.extract(store, type, adapterPayload, null, operation);
            } else {
              payload = adapterPayload;
            }
            store.didSaveRecord(record, payload);

          }, this);
        }
        return records;
      }, function(reason) {
        forEach(records, function(record) {
          if (reason instanceof DS.InvalidError) {
            store.recordWasInvalid(record, reason.errors);
          } else {
            store.recordWasError(record, reason);
          }
        }, this);
        throw reason;
      }, label);
    }

    function _findQuery(adapter, store, type, query, recordArray) {
      var promise = adapter.findQuery(store, type, query, recordArray),
        serializer = serializerForAdapter(adapter, type),
        label = "DS: Handle Adapter#findQuery of " + type;

      return Promise.cast(promise, label).then(function(adapterPayload) {
        var payload = serializer.extract(store, type, adapterPayload, null, 'findQuery');

        Ember.assert("The response from a findQuery must be an Array, not " + Ember.inspect(payload), Ember.typeOf(payload) === 'array');
        //Set meta to adapterPopulatedRecordArray, it will be transitioned to instance of DS.FilteredRecordArray
        recordArray.load(payload);
        if (adapterPayload.meta){
          recordArray.set('_meta', adapterPayload.meta);
        }
        return recordArray;
      }, null, "DS: Extract payload of findQuery " + type);
    }


    var Store = DS.Store.extend({
      findQuery: function(type, query) {
        type = this.modelFor(type);

        var array = this.recordArrayManager
          .createAdapterPopulatedRecordArray(type, query);

        var adapter = this.adapterFor(type);

        Ember.assert("You tried to load a query but you have no adapter (for " + type + ")", adapter);
        Ember.assert("You tried to load a query but your adapter does not implement `findQuery`", adapter.findQuery);

        return promiseArray(_findQuery(adapter, this, type, query, array));
      },
      filter: function(type, query, filter) {
        var promise;

        // allow an optional server query
        if (arguments.length === 3) {
          promise = this.findQuery(type, query);
        } else if (arguments.length === 2) {
          filter = query;
        }

        type = this.modelFor(type);

        var array = this.recordArrayManager
          .createFilteredRecordArray(type, filter);
        promise = promise || Promise.cast(array);

        return promiseArray(promise.then(function(adapterPopulatedRecordArray) {
          var meta = adapterPopulatedRecordArray.get('_meta');
          if (meta){
            array.set('_meta', meta);
          }
          return array;
        }, null, "DS: Store#filter of " + type));
      },

      flushPendingSave: function() {
        var pending = this._pendingSave.slice();
        this._pendingSave = [];
        var bulkRecords = [],
          bulkDataTypeMap = [],
          bulkDataResolvers = [],
          bulkDataAdapters = [],
          bulkDataOperationMap = [
            'createRecord',
            'deleteRecord',
            'updateRecord'
          ], i, j;

        forEach(pending, function(tuple) {
          var record = tuple[0], resolver = tuple[1],
            type = record.constructor,
            adapter = this.adapterFor(record.constructor),
            operation, typeIndex, operationIndex;

          if (get(record, 'isNew')) {
            operation = 'createRecord';
          } else if (get(record, 'isDeleted')) {
            operation = 'deleteRecord';
          } else {
            operation = 'updateRecord';
          }
          if (get(adapter, 'bulkOperationsSupport')) {
            operationIndex = bulkDataOperationMap.indexOf(operation);
            typeIndex = bulkDataTypeMap.indexOf(type);
            if (typeIndex === -1) {
              bulkDataTypeMap.push(type);
              typeIndex = bulkDataTypeMap.length - 1;
              bulkRecords[typeIndex] = [];
              bulkDataResolvers[typeIndex] = resolver;
              bulkDataAdapters[typeIndex] = this.adapterFor(record.constructor);
            }

            if (!(bulkRecords[typeIndex][operationIndex] instanceof Array)) {
              bulkRecords[typeIndex][operationIndex] = [];
            }
            bulkRecords[typeIndex][operationIndex].push(record);
          }
          else {
            resolver.resolve(_commit(adapter, this, operation, record));
          }
        }, this);

        if (bulkRecords.length) {
          for (i = 0; i < bulkRecords.length; i++) {
            for (j = 0; j < bulkDataOperationMap.length; j++)
              if (bulkRecords[i][j]) {
                if (bulkRecords[i][j].length === 1){
                  bulkDataResolvers[i].resolve(_commit(bulkDataAdapters[i], this,
                    bulkDataOperationMap[j], bulkRecords[i][j][0]));
                }
                if (bulkRecords[i][j].length > 1){
                  bulkDataResolvers[i].resolve(_bulkCommit(bulkDataAdapters[i], this,
                      bulkDataOperationMap[j] + 's', bulkDataTypeMap[i], bulkRecords[i][j]));
                }
              }
          }
        }
      }
    });

    __exports__["default"] = Store;
  });
global.SA = requireModule('socket-adapter/main')['default'];
}(Ember.lookup));