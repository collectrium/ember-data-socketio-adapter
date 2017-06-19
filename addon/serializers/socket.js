import DS from 'ember-data';
import Ember from 'ember';

const {
  get,
  keys,
  copy,
  String: { underscore },
  merge,
  compare,
  isArray
 } = Ember;

const {
  RESTSerializer
} = DS;

export default RESTSerializer.extend({
  normalizeQueryResponse(store, type, payload) {
    return this.normalizeArrayResponse(store, type, payload.payload);
  },
  buildDiff(hash, snapshot) {
    hash = copy(hash);
    const isNew = get(snapshot, 'isNew');
    if (isNew) {
      return hash;
    }
    const diff = {
      id: hash.id
    };
    const relationships = snapshot._internalModel._relationships;
    const initializedRelationshipsKeys = keys(relationships.initializedRelationships);
    const relationshipsData = {};
    initializedRelationshipsKeys.forEach((key) => {
      const relationship = relationships.get(key);
      if (relationship.hasData && relationship.hasLoaded && relationship.canonicalState) {
        if (isArray(relationship.canonicalState)) {
          relationshipsData[key] = relationship.canonicalState.map((internalModel) => {
            return get(internalModel.getRecord(), 'id');
          });
        } else {
          relationshipsData[key] = get(relationship.canonicalState.getRecord(), 'id');
        }
      } else {
        relationshipsData[key] = null;
      }
    });
    const attributesData = get(snapshot, 'data') || snapshot._internalModel._data;
    const possibleHash = merge(attributesData, relationshipsData);
    keys(possibleHash).forEach((key) => {
      if (this.isDiffer(hash[key], possibleHash[key]) && hash[key] !== undefined) {
        // TODO: handle dates and all transforms processed data correctly
        diff[key] = hash[key];
      }
    });

    return diff;
  },
  isDiffer(a, b) {
    return compare(a, b);
  },
  payloadKeyFromModelName(modelName) {
    return underscore(modelName);
  },
  serializeIntoHash(hash, typeClass, snapshot, options) {
    const isBulkOperation = snapshot instanceof Array;
    const normalizedRootKey = this.payloadKeyFromModelName(typeClass.modelName);
    if (isBulkOperation) {
      const bulkPayload = [];
      snapshot.forEach((snapshotData) => {
        bulkPayload.push(this.serialize(snapshotData, options));
      });
      hash[normalizedRootKey] = bulkPayload;
    } else {
      hash[normalizedRootKey] = this.serialize(snapshot, options);
    }
  },
  normalizeFindAllResponse(store, type, payload) {
    return this.normalizeArrayResponse(store, type, payload.payload);
  },
  normalizeFindManyResponse(store, type, payload) {
    return this.normalizeArrayResponse(store, type, payload.payload);
  },
  normalizeCreateRecordResponse(store, type, payload) {
    return this.normalizeArrayResponse(store, type, payload);
  },
  normalizeUpdateRecordResponse(store, type, payload) {
    return this.normalizeArrayResponse(store, type, payload);
  },
  normalizeDeleteRecordResponse(store, type, payload) {
    return this.normalizeArrayResponse(store, type, payload);
  },
  serialize(snapshot, options = {}) {
    const { updateAsPatch } = options;
    let hash = this._super(snapshot, options);
    if (updateAsPatch) {
      hash = this.buildDiff(hash, snapshot);
    }
    return hash;
  }
});
