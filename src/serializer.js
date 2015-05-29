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
  filterFields: function(data, record) {
    var dataKeys = Object.keys(record.get('data')), // sended from server properties
      propsKeys = Object.keys(data), // properties from object
      retData = {};

    // skip pick-logic for CREATE requests
    if(!propsKeys.length) {
      retData = data;
    } else {
      propsKeys.forEach(function(key) {
        // We won't pass values if they didn't came from server ( not in dataKeys
        // but allow to set new not-default values ( if they were added on client ) (null is default value)
        if(dataKeys.contains(key) || data[key] !== null) {
          retData[key] = data[key];
        }
      });
    }

    return retData;
  }
});

export default Serializer;
