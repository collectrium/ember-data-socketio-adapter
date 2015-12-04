import DS from 'ember-data';
import Ember from 'ember';

const {
  get,
  keys
 } = Ember;

export default DS.RESTSerializer.extend({
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
  },
  serialize(snapshot, options) {
    const hash = this._super(snapshot, options);
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
      propsKeys.forEach(function(key) {
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
