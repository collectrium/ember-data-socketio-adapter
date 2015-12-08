import DS from 'ember-data';
import Ember from 'ember';

const {
  get,
  keys,
  copy,
  String: { underscore },
  EnumerableUtils: { forEach },
 } = Ember;

const {
  RESTSerializer
} = DS;

export default RESTSerializer.extend({
  extractFindQuery(store, type, payload) {
    return this.extractArray(store, type, payload.payload);
  },
  filterUnchangedParams(hash, snapshot) {
    hash = copy(hash);
    const originalData = get(snapshot, 'data');
    const { id } = hash;

    forEach(keys(originalData), (key) => {
      if(hash[key] === originalData[key]) {
        delete hash[key];
      }
    });

    hash.id = id;

    return hash;
  },
  payloadKeyFromModelName(modelName) {
    return underscore(modelName);
  },
  serializeIntoHash(hash, typeClass, snapshot, options) {
    const isBulkOperation = snapshot instanceof Array;
    const normalizedRootKey = this.payloadKeyFromModelName(typeClass.modelName);
    if (isBulkOperation) {
      const bulkPayload = [];
      forEach(snapshot, (snapshotData) => {
        bulkPayload.push(this.serialize(snapshotData, options));
      });
      hash[normalizedRootKey] = bulkPayload;
    }
    else {
      hash[normalizedRootKey] = this.serialize(snapshot, options);
    }
  },
  extractFindAll(store, type, payload) {
    return this.extractArray(store, type, payload.payload);
  },
  extractFindMany(store, type, payload) {
    return this.extractArray(store, type, payload.payload);
  },
  extractCreateRecords(store, type, payload) {
    return this.extractArray(store, type, payload);
  },
  extractUpdateRecords(store, type, payload) {
    return this.extractArray(store, type, payload);
  },
  extractDeleteRecords(store, type, payload) {
    return this.extractArray(store, type, payload);
  },
  serialize(snapshot, options) {
    const { updateAsPatch } = options;
    let hash = this._super(snapshot, options);
    if (updateAsPatch) {
      hash = this.filterUnchangedParams(hash, snapshot);
    }
    return this.filterFields(hash, snapshot);
  },
  filterFields(data, snapshot) {
    const dataKeys = keys(get(snapshot, 'data')); // sended from server properties
    const propsKeys = keys(data); // properties from object
    let retData = {};

    // skip pick-logic for CREATE requests
    if(get(snapshot, 'isNew')) {
      retData = data;
    } else {
      forEach(propsKeys, (key) => {
        const relationship = snapshot.record.relationshipFor(key);
        // We won't pass values if they didn't came from server ( not in dataKeys )
        // but allow to set new not-default values ( if they were added on client ) (null is default value)
        if(dataKeys.indexOf(key)  >= 0 || (!(relationship && relationship.kind === 'hasMany') && data[key] !== null)) {
          retData[key] = data[key];
        }
      });
    }
    return retData;
  }
});
