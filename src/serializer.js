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
    return this.pickQueriedFields(hash, snapshot);
  },
  pickQueriedFields: function(data, record) {
    var propsKeys = Object.keys(record.get('data')),
      retData = {};

    // skip pick-logic for CREATE requests
    if(!propsKeys.length) {
      retData = data;
    } else {
      propsKeys.forEach(function(key) {
        retData[key] = data[key];
      });
    }

    return retData;
  }
});

export default Serializer;
