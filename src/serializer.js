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
  serialize: function(snapshot, options) {
    var hash = this._super(snapshot, options);
    return this.filterFields(hash, snapshot);
  },
  filterFields: function(data, snapshot) {
    var dataKeys = Object.keys(snapshot.get('data')); // sended from server properties
    var propsKeys = Object.keys(data); // properties from object
    var retData = {};
    var relationship;

    // skip pick-logic for CREATE requests
    if(!snapshot.record) {
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
