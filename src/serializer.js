var get = Ember.get;

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
  serialize: function(record, options) {
    // for some cases we have snapshot / for some record
    // todo: update methods which used this one for new signature
    // see ember-data changelog
    var snapshot = !!record._createSnapshot? record._createSnapshot(): record;
    var hash = this._super(snapshot, options);
    return this.filterFields(hash, snapshot);
  },
  filterFields: function(data, snapshot) {
    var dataKeys = Object.keys(get(snapshot, 'data')); // sended from server properties
    var propsKeys = Object.keys(data); // properties from object
    var retData = {};
    var relationship;

    // skip pick-logic for CREATE requests
    if(get(snapshot, 'isNew')) {
      retData = data;
    } else {
      propsKeys.forEach(function(key) {
        relationship = snapshot.record.relationshipFor(key);
        // We won't pass values if they didn't came from server ( not in dataKeys )
        // but allow to set new not-default values ( if they were added on client ) (null is default value)
        if(dataKeys.contains(key) || (!(relationship && relationship.kind === 'hasMany') && data[key] !== null)) {
          retData[key] = data[key];
        }
      });
    }
    return retData;
  }
});

export default Serializer;
