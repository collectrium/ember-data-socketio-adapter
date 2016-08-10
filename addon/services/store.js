import DS from 'ember-data';
import Ember from 'ember';

import {
  _normalizeSerializerPayload
} from './../serializer-response';

const {
  get,
  String: { pluralize },
  assert,
  Evented
} = Ember;

// copied from ember-data store core
function isThenable(object) {
  return object && typeof object.then === 'function';
}
// copied from ember-data store core
function serializerFor(container, type, defaultSerializer) {
  return container.lookup('serializer:' + type) ||
         container.lookup('serializer:application') ||
         container.lookup('serializer:' + defaultSerializer) ||
         container.lookup('serializer:-default');
}
// copied from ember-data store core
function serializerForAdapter(adapter, type) {
  let serializer = adapter.serializer;
  const defaultSerializer = adapter.defaultSerializer;
  const container = adapter.container;

  if (container && serializer === undefined) {
    serializer = serializerFor(container, type.modelName, defaultSerializer);
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
// copied from ember-data store core
function _commit(adapter, store, operation, snapshot) {
  const internalModel = snapshot._internalModel;
  const modelName = snapshot.modelName;
  const typeClass = store.modelFor(modelName);
  const promise = adapter[operation](store, typeClass, snapshot);
  const serializer = serializerForAdapter(store, adapter, modelName);
  const label = 'DS: Extract and notify about ' + operation + ' completion of ' + modelName;

  assert("Your adapter's '" + operation + "' method must return a value, but it returned `undefined", promise !== undefined);

  return promise.then((adapterPayload) => {
    let payload;

    store._adapterRun(() => {
      if (adapterPayload) {
        payload = serializer.extract(store, typeClass, adapterPayload, snapshot.id, operation);
      } else {
        payload = adapterPayload;
      }
      store.didSaveRecord(internalModel, _normalizeSerializerPayload(typeClass, payload));
    });
    return internalModel;
  }, (reason) => {
    if (reason instanceof DS.InvalidError) {
      store.recordWasInvalid(internalModel, reason.errors);
    } else {
      store.recordWasError(internalModel, reason);
    }
    throw reason;
  }, label);
}

function _bulkCommit(adapter, store, operation, modelName, snapshots) {
  const typeClass = store.modelFor(modelName);
  const promise = adapter[operation](store, typeClass, snapshots);
  const serializer = serializerForAdapter(store, adapter, modelName);
  const label = 'DS: Extract and notify about ' + operation + ' completion of ' + snapshots.length + ' of type ' + modelName;
  const internalModels = snapshots.map((snapshot) => snapshot._internalModel);
  assert('Your adapter\'s ' + operation + ' method must return a promise, but it returned ' + promise, isThenable(promise));

  return promise.then((adapterPayload) => {
    let payload;

    store._adapterRun(function() {
      if (adapterPayload) {
        payload = serializer.extract(store, typeClass, adapterPayload, null, operation);
      } else {
        payload = adapterPayload;
      }
      internalModels.forEach((internalModel, index) => {
        store.didSaveRecord(internalModel, _normalizeSerializerPayload(typeClass, payload && payload[index]));
      });
    });
    return internalModels;
  }, function(reason) {
    internalModels.forEach((internalModel) => {
      if (reason instanceof DS.InvalidError) {
        store.recordWasInvalid(internalModel, reason.errors);
      } else {
        store.recordWasError(internalModel, reason);
      }
    });
    throw reason;
  }, label);
}

export default DS.Store.extend(Evented, {
  flushPendingSave: function() {
    const pending = this._pendingSave.slice();
    this._pendingSave = [];
    const bulkRecords = [];
    const bulkDataTypeMap = [];
    const bulkDataResolvers = [];
    const bulkDataAdapters = [];
    const bulkDataOperationMap = [
        'createRecord',
        'deleteRecord',
        'updateRecord'
      ];

    pending.forEach((pendingItem) => {
      const snapshot = pendingItem.snapshot;
      const internalModel = snapshot._internalModel;
      const resolver = pendingItem.resolver;
      const type = internalModel.type.modelName;
      const adapter = this.adapterFor(type);
      let bulkSupport;
      let operation;
      let typeIndex;
      let operationIndex;

      if (internalModel.isNew()) {
        operation = 'createRecord';
      } else if (internalModel.isDeleted()) {
        operation = 'deleteRecord';
      } else {
        operation = 'updateRecord';
      }
      bulkSupport = get(adapter, 'bulkOperationsSupport')[operation];

      if (bulkSupport) {
        operationIndex = bulkDataOperationMap.indexOf(operation);
        typeIndex = bulkDataTypeMap.indexOf(type);
        if (typeIndex < 0) {
          bulkDataTypeMap.push(type);
          typeIndex = bulkDataTypeMap.length - 1;
          bulkRecords[typeIndex] = [];
          bulkDataResolvers[typeIndex] = [];
          bulkDataAdapters[typeIndex] = adapter;
        }
        if (!(bulkRecords[typeIndex][operationIndex] instanceof Array)) {
          bulkRecords[typeIndex][operationIndex] = [];
        }
        if (!(bulkDataResolvers[typeIndex][operationIndex] instanceof Array)) {
          bulkDataResolvers[typeIndex][operationIndex] = [];
        }
        bulkDataResolvers[typeIndex][operationIndex].push(resolver);
        bulkRecords[typeIndex][operationIndex].push(snapshot);
      } else {
        resolver.resolve(_commit(adapter, this, operation, snapshot));
      }
    });

    /*jshint -W083 */
    if (bulkRecords.length) {
      for (let i = 0; i < bulkRecords.length; i++) {
        for (let j = 0; j < bulkDataOperationMap.length; j++) {
          if (bulkRecords[i][j] && bulkRecords[i][j].length) {
            if (bulkRecords[i][j].length === 1) {
              bulkDataResolvers[i][j][0].resolve(_commit(bulkDataAdapters[i], this, bulkDataOperationMap[j], bulkRecords[i][j][0]));
            } else {
              _bulkCommit(bulkDataAdapters[i], this, pluralize(bulkDataOperationMap[j]), bulkDataTypeMap[i], bulkRecords[i][j])
                .then(
                  (snapshots) => {
                    snapshots.forEach((snapshot, index) => {
                      bulkDataResolvers[i][j][index].resolve(snapshot);
                    });
                  },
                  (response) => {
                    bulkDataResolvers[i][j].forEach((promise) => promise.reject(response));
                  }
                );
            }
          }
        }
      }
    }
  }
});
