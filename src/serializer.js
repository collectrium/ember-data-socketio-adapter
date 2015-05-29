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
  }
});

export default Serializer;
