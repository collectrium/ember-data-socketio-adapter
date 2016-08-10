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
  isNewSerializerAPI: true,

  payloadWithMeta(payload) {
    let meta;
    let customPayload = payload.payload;

    if (payload && payload['meta'] !== undefined) {
      meta = payload.meta;
    }
    customPayload.meta = meta;

    return customPayload;
  },

  normalizeQueryResponse(store, type, payload) {
    const customPayload = this.payloadWithMeta(payload);
    return this.normalizeArrayResponse(store, type, customPayload);
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
    const attributesData = get(snapshot, 'data');
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
    const customPayload = this.payloadWithMeta(payload);
    return this.normalizeArrayResponse(store, type, customPayload);
  },
  normalizeFindManyResponse(store, type, payload) {
    const customPayload = this.payloadWithMeta(payload);
    return this.normalizeArrayResponse(store, type, customPayload);
  },
  normalizeCreateRecordResponses(store, type, payload) {
    return this.normalizeArrayResponse(store, type, payload);
  },
  normalizeUpdateRecordResponses(store, type, payload) {
    return this.normalizeArrayResponse(store, type, payload);
  },
  normalizeDeleteRecordResponses(store, type, payload) {
    return this.normalizeArrayResponse(store, type, payload);
  },
  serialize(snapshot, options = {}) {
    const { updateAsPatch } = options;
    let hash = this._super(snapshot, options);
    if (updateAsPatch) {
      hash = this.buildDiff(hash, snapshot.record);
    }
    return hash;
  }
});
