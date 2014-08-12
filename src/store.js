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

  Ember.assert('Your adapter\'s ' + operation + ' method must return a promise, but it returned ' + promise, isThenable(promise));

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

  Ember.assert('Your adapter\'s ' + operation + ' method must return a promise, but it returned ' + promise, isThenable(promise));

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
    Ember.assert('The response from a findQuery must be an Array, not ' + Ember.inspect(payload), Ember.typeOf(payload) === 'array');

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
    Ember.assert('You need to pass a type to the store\'s find method', arguments.length >= 1);
    Ember.assert('You may not pass `' + id + '` as id to the store\'s find method', arguments.length === 1 || !Ember.isNone(id));

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

    Ember.assert('You tried to load a query but you have no adapter (for ' + type + ')', adapter);
    Ember.assert('You tried to load a query but your adapter does not implement `findQuery`', adapter.findQuery);

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

export default Store;