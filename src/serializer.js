var Serializer = DS.RESTSerializer.extend({
  extractFindQuery: function(store, type, payload) {
    return this.extractArray(store, type, payload.payload);
  },
  extractFindAll: function(store, type, payload) {
    return this.extractArray(store, type, payload.payload);
  }
});

export default Serializer;