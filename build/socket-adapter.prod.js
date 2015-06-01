/*!
 * @overview  Ember Data Socket Adapter
 * @copyright Copyright 2014 Collectrium LLC.
 * @author Andrew Fan <andrew.fan@upsilonit.com>
 */
// v0.1.39
// af0db43 (2015-05-29 18:24:25 +0300)


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
    /*jshint camelcase: false */
    var get = Ember.get, set = Ember.set,
      forEach = Ember.EnumerableUtils.forEach;

    var SocketAdapter = DS.RESTAdapter.extend({
      socketAddress: 'http://api.collectrium.websocket:5000',
      bulkOperationsSupport: {
        createRecord: true,
        updateRecord: false,
        deleteRecord: true
      },
      updateAsPatch: true,
      coalesceFindRequests: true,
      socketConnections: Ember.Object.create(),
      requestsPool: [],

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
          S4() + S4() + '-' +
          S4() + '-' +
          S4() + '-' +
          S4() + '-' +
          S4() + S4() + S4()
          );
      },

      /**
       *
       * @param type
       * @param options
       * @returns {Ember.get|*|Object}
       */
      getConnection: function(type, options) {
        /*jshint -W004 */
        var store = type.typeKey && type.store,
          address = get(this, 'socketAddress') + '/',
          requestsPool = get(this, 'requestsPool'),
          type = type.typeKey,
          connections = get(this, 'socketConnections'),
          socketNS = type && get(connections, type);

        if (arguments.length === 1) {
          options = {};
        }
        if (!type) {
          options = arguments[0];
        }
        if (socketNS) {
          //TODO: not sure that manually socket reconnecting is required
          if (socketNS.hasOwnProperty('socket') && !socketNS.socket.connected && !socketNS.socket.connecting) {
            socketNS.socket.connect();
          }
        }
        else {
          if (type) {
            address = address + type.decamelize() + '/';
          }
          socketNS = io.connect(address, options);
          if (type) {
            socketNS.on('message', function(response) {
              if (response.hasOwnProperty('errors')) {
                if (response.request_id && requestsPool[response.request_id]) {
                  var rejecter = requestsPool[response.request_id].reject;
                  delete response.request_id;
                  delete requestsPool[response.request_id];
                  Ember.run(null, rejecter, response);
                }
              } else {
                if (response.request_id && requestsPool[response.request_id]) {
                  var resolver = requestsPool[response.request_id].resolve;
                  delete response.request_id;
                  delete requestsPool[response.request_id];
                  Ember.run(null, resolver, response);
                }
                /**
                 * Handling PUSH notifications
                 * Operations can be only multiple
                 */
                else {
                  store.trigger('notification', response);
                  //if response contains only ids array it means that we receive DELETE
                  if (response.ids) {
                    //remove all records from store without sending DELETE requests
                    forEach(response.ids, function(id) {
                      var record = store.getById(type, id);
                      store.unloadRecord(record);
                    });
                  }
                  //we receive CREATE or UPDATE, ember-data will manage data itself
                  else {
                    if (response.hasOwnProperty('payload')) {
                      store.pushPayload(type, response.payload);
                    }
                  }
                }
              }
            });
          }
          if (type) {
            set(connections, type, socketNS);
          }
        }
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
        var connection = this.getConnection(type),
          requestsPool = get(this, 'requestsPool'),
          requestId = this.generateRequestId(),
          deffered = Ember.RSVP.defer('DS: SocketAdapter#emit ' + requestType + ' to ' + type.typeKey);
        if (!(hash instanceof Object)) {
          hash = {};
        }
        /**
         * Handshake was aborted
         */
        connection.on('error', function () {
            Ember.run(null, deffered.reject, {
              code:'auth-failed',
              name: 'Authentication failed',
              message: 'Invalid session token'
            });
        });
        deffered.requestType = requestType;
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
       * @param ids
       * @returns {Ember.RSVP.Promise}
       */

      findMany: function(store, type, ids) {
        //TODO: hash format TBD, imho should use {ids: ids}
        return this.send(type, 'READ_LIST', {query: {id__in: ids}});
      },

      /**
       *
       * @param store
       * @param type
       * @param id
       * @returns {Ember.RSVP.Promise}
       */
      find: function(store, type, id) {
        var model = store.modelFor(type),
          data = {
            id: id
          };
        if (model._findByIdParams) {
          if (model._findByIdParams.include) {
            data['include'] = model._findByIdParams.include;
          }
          if (model._findByIdParams.fields) {
            data['fields'] = model._findByIdParams.fields;
          }
        }
        return this.send(type, 'READ', data);
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
          data = {};
        data[type.typeKey.decamelize()] = serializer.serialize(record);

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
        data[type.typeKey.decamelize()] = [];

        forEach(records, function(record) {
          data[type.typeKey.decamelize()].push(serializer.serialize(record));
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
          data = {}, payload;
        payload = serializer.serialize(record, { includeId: true });

        if(get(this, 'updateAsPatch')) {
          payload = this.filterUnchangedParams(payload, record);
        }

        data[type.typeKey.decamelize()] = payload;

        return this.send(type, 'UPDATE', data);
      },

      filterUnchangedParams: function(hash, record) {
        hash = Ember.copy(hash);
        var originalData = get(record, 'data');
        var id = hash.id;

        Ember.keys(originalData).forEach(function(key) {
          if(hash[key] === originalData[key]) {
            // we won't send data that didn't change
            delete hash[key];
          } else if ((typeof hash[key] === 'object') && isEmpty(hash[key]) && isEmpty(originalData[key])) {
            // and we won't send comples data ( like objects/arrays ) it it's empty and wasn't load
            delete hash[key];
          }
        });

        hash.id = id;

        return hash;
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
        data[type.typeKey.decamelize()] = [];

        forEach(records, function(record) {
          data[type.typeKey.decamelize()].push(serializer.serialize(record, { includeId: true }));
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

    var VERSION = '0.1.39';
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
      },
      extractFindMany: function(store, type, payload) {
        return this.extractArray(store, type, payload.payload);
      },
      extractCreateRecords: function(store, type, payload) {
        return this.extractArray(store, type, payload);
      },
      extractUpdateRecords: function(store, type, payload) {
       return this.extractArray(store, type, payload);
      },
      extractDeleteRecords: function(store, type, payload) {
        return this.extractArray(store, type, payload);
      },
      serialize: function(snapshot, options) {
        var hash = this._super(snapshot, options);
        return this.filterFields(hash, snapshot);
      },
      filterFields: function(data, record) {
        var dataKeys = Object.keys(record.get('data')), // sended from server properties
          propsKeys = Object.keys(data), // properties from object
          retData = {};

        // skip pick-logic for CREATE requests
        if(!propsKeys.length) {
          retData = data;
        } else {
          propsKeys.forEach(function(key) {
            // We won't pass values if they didn't came from server ( not in dataKeys
            // but allow to set new not-default values ( if they were added on client ) (null is default value)
            if(dataKeys.contains(key) || data[key] !== null) {
              retData[key] = data[key];
            }
          });
        }

        return retData;
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
    /*jshint -W079 */
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
        label = 'DS: Extract and notify about ' + operation + ' completion of ' + record;

      ;

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

    //copied from ember-data store core
    function coerceId(id) {
      return id === null ? null : id+'';
    }

    function _bulkCommit(adapter, store, operation, type, records) {
      var promise = adapter[operation](store, type, records),
        serializer = serializerForAdapter(adapter, type),
        label = 'DS: Extract and notify about ' + operation + ' completion of ' + records.length +
                ' of type ' + type.typeKey;

      ;

      return promise.then(function(adapterPayload) {
        var payload;

        if (adapterPayload) {
          payload = serializer.extract(store, type, adapterPayload, null, operation);
        } else {
          payload = adapterPayload;
        }
        forEach(records, function(record, index) {
          store.didSaveRecord(record, payload && payload[index]);
        });
        return records;
      }, function(reason) {
        forEach(records, function(record) {
          if (reason instanceof DS.InvalidError) {
            store.recordWasInvalid(record, reason.errors);
          } else {
            store.recordWasError(record, reason);
          }
        });
        throw reason;
      }, label);
    }

    function _findQuery(adapter, store, type, query, recordArray) {
      var promise = adapter.findQuery(store, type, query, recordArray),
        serializer = serializerForAdapter(adapter, type),
        label = 'DS: Handle Adapter#findQuery of ' + type;

      return Promise.cast(promise, label).then(function(adapterPayload) {
        var payload = serializer.extract(store, type, adapterPayload, null, 'findQuery');
        ;

        recordArray.load(payload);
        return recordArray;
      }, null, 'DS: Extract payload of findQuery ' + type);
    }

    var Store = DS.Store.extend(Ember.Evented, {
      removeIdsFromStore: function(ids) {
        var i;
        if (ids instanceof Array) {
          for (i = 0; i > ids.length; i++) {

          }
        }
      },
      find: function(type, id) {
        ;
        ;

        if (arguments.length === 1) {
          return this.findAll(type);
        }

        // We are passed a query instead of an id.
        if (Ember.typeOf(id) === 'object') {
          return promiseArray(this.findQuery(type, id).then(function(APRA){
            /**
             * Return mutable array
             */
            return Ember.ArrayProxy.create({
              content: APRA.get('content'),
              meta: APRA.get('meta'),
              query: APRA.get('query'),
              type: APRA.get('type'),
              _APRA: APRA,
              addObject: function(record){
                this._APRA.manager.updateRecordArray(this._APRA, null, null, record);
              }
            });
          }));
        }
        return this.findById(type, coerceId(id));
      },
      findQuery: function(type, query) {
        type = this.modelFor(type);

        var array = this.recordArrayManager
          .createAdapterPopulatedRecordArray(type, query);

        var adapter = this.adapterFor(type);

        ;
        // Failed on loosing context
        // ;

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
          var meta = adapterPopulatedRecordArray.meta;
          if (meta) {
            //TODO: maybe we should merge meta from server and not override it
            set(array, 'meta', meta);
          }
          return array;
        }, null, 'DS: Store#filter of ' + type));
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
          ], resolvers, i, j;

        forEach(pending, function(tuple) {
          var record = tuple[0], resolver = tuple[1],
            type = record.constructor,
            adapter = this.adapterFor(record.constructor),
            bulkSupport, operation, typeIndex, operationIndex;

          if (get(record, 'isNew')) {
            operation = 'createRecord';
          } else if (get(record, 'isDeleted')) {
            operation = 'deleteRecord';
          } else {
            operation = 'updateRecord';
          }
          bulkSupport = get(adapter, 'bulkOperationsSupport')[operation];

          if (bulkSupport) {
            operationIndex = bulkDataOperationMap.indexOf(operation);
            typeIndex = bulkDataTypeMap.indexOf(type);
            if (typeIndex === -1) {
              bulkDataTypeMap.push(type);
              typeIndex = bulkDataTypeMap.length - 1;
              bulkRecords[typeIndex] = [];
              bulkDataResolvers[typeIndex] = [];
              bulkDataAdapters[typeIndex] = this.adapterFor(record.constructor);
            }
            bulkDataResolvers[typeIndex].push(resolver);
            if (!(bulkRecords[typeIndex][operationIndex] instanceof Array)) {
              bulkRecords[typeIndex][operationIndex] = [];
            }
            bulkRecords[typeIndex][operationIndex].push(record);
          }
          else {
            resolver.resolve(_commit(adapter, this, operation, record));
          }
        }, this);

        /*jshint -W083 */
        if (bulkRecords.length) {
          for (i = 0; i < bulkRecords.length; i++) {
            for (j = 0; j < bulkDataOperationMap.length; j++) {
              if (bulkRecords[i][j] && bulkRecords[i][j].length) {
                if (bulkRecords[i][j].length === 1) {
                  bulkDataResolvers[i][0].resolve(_commit(bulkDataAdapters[i], this,
                    bulkDataOperationMap[j], bulkRecords[i][j][0]));
                }
                else{
                  resolvers = bulkDataResolvers[i];
                  _bulkCommit(bulkDataAdapters[i], this,
                    bulkDataOperationMap[j].pluralize(), bulkDataTypeMap[i], bulkRecords[i][j])
                    .then(function(records) {
                      forEach(records, function(record, index) {
                        resolvers[index].resolve(record);
                      });
                    });
                }
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