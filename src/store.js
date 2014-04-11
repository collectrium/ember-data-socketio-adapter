var get = Ember.get, set = Ember.set;
var forEach = Ember.EnumerableUtils.forEach;

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

var Store = DS.Store.extend({
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
          if (bulkRecords[i][j] && bulkRecords[i][j].length) {
            bulkDataResolvers[i].resolve(_bulkCommit(bulkDataAdapters[i], this,
                bulkDataOperationMap[j] + 's', bulkDataTypeMap[i], bulkRecords[i][j]));
          }
      }
    }
  }
});

export default Store;