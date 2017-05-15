import DS from 'ember-data';
import Ember from 'ember';

const {
  get,
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
  isDiffer(a, b) {
    return compare(a, b);
  },

  getChangedRelations(snapshot) {
    const changedRelations = {};
    const record = snapshot.record.toJSON();

    snapshot.eachRelationship((name) => {
      const relationships = snapshot._internalModel._relationships;
      const relationship = relationships.get(name);
      let oldValue = null;

      if (relationship.hasData && relationship.hasLoaded && relationship.canonicalState) {
        if (isArray(relationship.canonicalState)) {
          oldValue = relationship.canonicalState.map((internalModel) => {
            return get(internalModel.getRecord(), 'id');
          });
        } else {
          oldValue = get(relationship.canonicalState.getRecord(), 'id');
        }
      }

      const newValue = record[name];
      changedRelations[name] = [oldValue, newValue];
    });

    return changedRelations;
  },

  getChangedAttributesWithRelations(snapshot) {
    const changedRelations = this.getChangedRelations(snapshot);
    const changedAttributes = snapshot.changedAttributes();
    return merge(changedAttributes, changedRelations);
  },

  buildDiff(hash, snapshot) {
    hash = copy(hash);
    const isNew = get(snapshot, 'isNew');

    if (isNew) {
      return hash;
    }

    const changedAttributesWithRelations = this.getChangedAttributesWithRelations(snapshot);

    return Object.keys(changedAttributesWithRelations).reduce((diff, key) => {
      const [oldValue, newValue] = changedAttributesWithRelations[key];

      if (this.isDiffer(oldValue, newValue)) {
        diff[key] = newValue;
      }

      return diff;
    }, { id: hash.id });
  },

  serialize(snapshot, options = {}) {
    const { updateAsPatch } = options;
    let hash = this._super(snapshot, options);

    if (updateAsPatch) {
      hash = this.buildDiff(hash, snapshot);
    }

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
      snapshot.forEach((snapshotData) => {
        bulkPayload.push(this.serialize(snapshotData, options));
      });
      hash[normalizedRootKey] = bulkPayload;
    } else {
      hash[normalizedRootKey] = this.serialize(snapshot, options);
    }
  },

  extractFindQuery(store, type, payload) {
    return this.extractArray(store, type, payload.payload);
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
  }
});
