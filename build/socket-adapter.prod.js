/*!
 * @overview  Ember Data Socket Adapter
 * @copyright Copyright 2014 Collectrium LLC.
 * @author Andrew Fan <andrew.fan@upsilonit.com>
 */
// v0.1.21
// eab8bb3 (2014-08-13 15:43:48 +0300)


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
          S4() + S4() + '-' +
          S4() + '-' +
          S4() + '-' +
          S4() + '-' +
          S4() + S4() + S4()
          );
      },

      /**
       *
       * @param request
       * @returns {bool}
       */
      validateResponse: function (response, type) {
        var isValid = true;
        /**
         * Validation for responses
         * 'request_id' should be inside 'requestsPool'
         */
        if (response.hasOwnProperty('request_id')) {
          var deffered = this.requestsPool[response.request_id];

          if (!deffered){
            isValid = false;
          }

          var requestType = deffered.requestType;
            /* Validate response by request type */
            // TODO: pluralize
            // TODO: List responses validate

          switch (requestType) {
            case 'READ':
              if (!response.hasOwnProperty(type)) {
                isValid = false;
              }
              break;
            case 'READ_LIST':
              if (!response.hasOwnProperty('payload') || !response.payload.hasOwnProperty(type) || !response.type instanceof Array ) {
                isValid = false;
              }
              break;
            case 'CREATE':
              if (!response.hasOwnProperty(type)) {
                isValid = false;
              }
              break;
            case 'CREATE_LIST':
              /*if (!response.hasOwnProperty('payload') || !response.payload.hasOwnProperty(type) || !response.type instanceof Array ) {
                isValid = false;
              }*/
              break;
            case 'UPDATE':
            if (!response.hasOwnProperty(type)) {
                isValid = false;
              }
              break;
            case 'UPDATE_LIST':
              /*if (!response.hasOwnProperty('payload') || !response.payload.hasOwnProperty(type) || !response.type instanceof Array ) {
                isValid = false;
              }*/
              break;
            case 'DELETE':
              if (Object.keys(response).length !== 1) {
                isValid = false;
              }
              break;
            case 'DELETE_LIST':
              if (Object.keys(response).length !== 1) {
                isValid = false;
              }
              break;
            default:
              isValid = false;
              break;
          }
        }

        /**
         * Validation for push notifications
         * response should contains either 'payload' or 'ids' key
         * 'payload' type should be Object
         * 'ids' type should be Array
         */
        else {
          if (!response.hasOwnProperty('payload') && !response.hasOwnProperty('ids')) {
            isValid = false;
          }
          if (response.hasOwnProperty('ids') && !(response.ids instanceof Array)){
            isValid = false;
          }
          if (response.hasOwnProperty('payload') && !(response.payload instanceof Object)){
            isValid = false;
          }
        }
        return isValid;
      },

      /**
       *
       * @param type
       * @param options
       * @returns {Ember.get|*|Object}
       */
      getConnection: function(type, options) {
        var store = type.typeKey && type.store,
            scope = this;
        type = type.typeKey;
        var connections = get(this, 'socketConnections'),
          socketNS = type && get(connections, type),
          address = this.get('socketAddress') + '/',
          requestsPool = this.get('requestsPool');

        if (arguments.length === 1) {
          options = {};
        }
        if (!type) {
          options = arguments[0];
        }

        //if we establish connection for the first time
        if (!socketNS) {
          if (type) {
            address = address + type.decamelize() + '/';
          }
          socketNS = io.connect(address, options);
          if (type) {
            //TODO: when should be reject promise hmmm?
            socketNS.on('message', function(response) {
              var isResponseValid = scope.validateResponse(response, type.decamelize());

              if (!isResponseValid) {
                if (response.request_id && requestsPool[response.request_id]) {
                  var rejecter = requestsPool[response.request_id].reject;
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
                      forEach(response.ids, function (id) {
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
          requestsPool = this.get('requestsPool'),
          requestId = this.generateRequestId(),
          deffered = Ember.RSVP.defer('DS: SocketAdapter#emit ' + requestType + ' to ' + type.typeKey);
        if (!(hash instanceof Object)) {
          hash = {};
        }
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
        return this.send(type, 'READ_LIST', {ids: ids});
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
          data = {};
        data[type.typeKey] = [];

        data[type.typeKey].push(serializer.serialize(record));
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
          data = {};
        data[type.typeKey] = [];

        data[type.typeKey].push(serializer.serialize(record, { includeId: true }));
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
        set(this, 'requestsPool', Ember.A([]));
        this.getConnection({
          resource: 'handshake'
        });
      }.on('init')
    });

    __exports__["default"] = SocketAdapter;
  });
define("socket-adapter/belongs_to", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /*global Model*/
    var get = Ember.get,
        isNone = Ember.isNone;

    /*jshint -W079 */
    var Promise = Ember.RSVP.Promise;

    // copied from ember-data//lib/system/relationships/belongs_to.js
    function asyncBelongsTo(type, options, meta) {
      return Ember.computed('data', function(key, value) {
        var data = get(this, 'data'),
            store = get(this, 'store'),
            promiseLabel = 'DS: Async belongsTo ' + this + ' : ' + key,
            promise;

        if (arguments.length === 2) {
          ;
          return value === undefined ? null : DS.PromiseObject.create({
            promise: Promise.cast(value, promiseLabel)
          });
        }

        var link = data.links && data.links[key],
            belongsTo = data[key];

        if(!isNone(belongsTo)) {
          promise = store.fetchRecord(belongsTo) || Promise.cast(belongsTo, promiseLabel);
          return DS.PromiseObject.create({
            promise: promise
          });
        } else if (link) {
          promise = store.findBelongsTo(this, link, meta);
          return DS.PromiseObject.create({
            promise: promise
          });
        } else {
          return null;
        }
      }).meta(meta);
    }

    DS.belongsTo = function (type, options) {
      if (typeof type === 'object') {
        options = type;
        type = undefined;
      } else {
        ;
      }

      options = options || {};

      var meta = {
        type: type,
        isRelationship: true,
        options: options,
        kind: 'belongsTo'
      };

      return asyncBelongsTo(type, options, meta);
    };


    __exports__["default"] = DS.belongsTo;
  });
define("socket-adapter/has_many", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      @module ember-data
    */

    var get = Ember.get, set = Ember.set, setProperties = Ember.setProperties;

    // copied from ember-data/lib/system/relationships/has_many.js
    function asyncHasMany(type, options, meta, key) {
      /*jshint validthis:true */
      var relationship = this._relationships[key],
      promiseLabel = 'DS: Async hasMany ' + this + ' : ' + key;

      if (!relationship) {
        var resolver = Ember.RSVP.defer(promiseLabel);
        relationship = buildRelationship(this, key, options, function(store, data) {
          var link = data.links && data.links[key];
          var rel;
          if (link) {
            rel = store.findHasMany(this, link, meta, resolver);
          } else {
            rel = store.findMany(this, data[key], meta.type, resolver);
          }
          set(rel, 'promise', resolver.promise);
          return rel;
        });
      }

      var promise = relationship.get('promise').then(function() {
        return relationship;
      }, null, 'DS: Async hasMany records received');

      return DS.PromiseArray.create({ promise: promise });
    }

    // copied from ember-data/lib/system/relationships/has_many.js
    function buildRelationship(record, key, options, callback) {
      var rels = record._relationships;

      if (rels[key]) { return rels[key]; }

      var data = get(record, 'data'),
      store = get(record, 'store');

      var relationship = rels[key] = callback.call(record, store, data);

      return setProperties(relationship, {
        owner: record, name: key, isPolymorphic: options.polymorphic
      });
    }

    function hasRelationship(type, options) {
      options = options || {};

      var meta = { type: type, isRelationship: true, options: options, kind: 'hasMany' };

      return Ember.computed(function(key) {
        var records = get(this, 'data')[key],
        isRecordsEveryEmpty = Ember.A(records).everyProperty('isEmpty', false);

        if (!isRecordsEveryEmpty) {
          return asyncHasMany.call(this, type, options, meta, key);  
        }

        return buildRelationship(this, key, options, function(store, data) {
          var records = data[key];
          ;
          return store.findMany(this, data[key], meta.type);
        });
      }).property('data').meta(meta);
    }

    /*
      @namespace
      @method hasMany
      @for DS
      @param {String or DS.Model} type the model type of the relationship
      @param {Object} options a hash of options
      @return {Ember.computed} relationship
    */
    DS.hasMany = function(type, options) {
      if (typeof type === 'object') {
        options = type;
        type = undefined;
      }
      return hasRelationship(type, options);
    };

    __exports__["default"] = DS.hasMany;
  });
define("socket-adapter/json_serializer", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var get = Ember.get;

    DS.JSONSerializer.reopen({

      serializeBelongsTo: function(record, json, relationship) {
        var key = relationship.key;

        var belongsTo;
        if (record._data[key]) {
          belongsTo = record._data[key].id;
        } else {
          belongsTo = get(record, key);
        } 

        key = this.keyForRelationship ? this.keyForRelationship(key, 'belongsTo') : key;

        if (record._data[key]) {
          json[key] = belongsTo;
        } else {
          json[key] = get(belongsTo, 'id');
        }

        if (relationship.options.polymorphic) {
          this.serializePolymorphicType(record, json, relationship);
        }
      }

    });

    __exports__["default"] = DS.JSONSerializerer;
  });
define("socket-adapter/main", 
  ["socket-adapter/json_serializer","socket-adapter/serializer","socket-adapter/adapter","socket-adapter/store","socket-adapter/has_many","socket-adapter/belongs_to","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __dependency6__, __exports__) {
    "use strict";
    var serializer = __dependency2__["default"];
    var adapter = __dependency3__["default"];
    var store = __dependency4__["default"];

    var VERSION = '0.1.21';
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
              type: APRA.get('type')
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
        ;

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
            bulkSupport = get(adapter, 'bulkOperationsSupport'),
            operation, typeIndex, operationIndex;

          if (get(record, 'isNew')) {
            operation = 'createRecord';
          } else if (get(record, 'isDeleted')) {
            operation = 'deleteRecord';
          } else {
            operation = 'updateRecord';
          }
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
                  return;
                }
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
    });

    __exports__["default"] = Store;
  });
global.SA = requireModule('socket-adapter/main')['default'];
}(Ember.lookup));