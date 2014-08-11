var get = Ember.get;

DS.JSONSerializer.reopen({

  serializeBelongsTo: function(record, json, relationship) {
    var key = relationship.key;

    var belongsTo;
    if (record._data[key]) {
      belongsTo = record._data[key].id;
    } else {
      belongsTo = get(record, key);
    } 

    key = this.keyForRelationship ? this.keyForRelationship(key, 'belongsTo') : key;

    if (record._data[key]) {
      json[key] = belongsTo;
    } else {
      json[key] = get(belongsTo, 'id');
    }

    if (relationship.options.polymorphic) {
      this.serializePolymorphicType(record, json, relationship);
    }
  }

});

export default DS.JSONSerializerer;