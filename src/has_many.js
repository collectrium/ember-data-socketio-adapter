/**
  @module ember-data
*/

var get = Ember.get, set = Ember.set, setProperties = Ember.setProperties;

// copied from ember-data/lib/system/relationships/has_many.js
function asyncHasMany(type, options, meta, key) {
  /*jshint validthis:true */
  var relationship = this._relationships[key],
  promiseLabel = 'DS: Async hasMany ' + this + ' : ' + key;

  if (!relationship) {
    var resolver = Ember.RSVP.defer(promiseLabel);
    relationship = buildRelationship(this, key, options, function(store, data) {
      var link = data.links && data.links[key];
      var rel;
      if (link) {
        rel = store.findHasMany(this, link, meta, resolver);
      } else {
        rel = store.findMany(this, data[key], meta.type, resolver);
      }
      set(rel, 'promise', resolver.promise);
      return rel;
    });
  }

  var promise = relationship.get('promise').then(function() {
    return relationship;
  }, null, 'DS: Async hasMany records received');

  return DS.PromiseArray.create({ promise: promise });
}

// copied from ember-data/lib/system/relationships/has_many.js
function buildRelationship(record, key, options, callback) {
  var rels = record._relationships;

  if (rels[key]) { return rels[key]; }

  var data = get(record, 'data'),
  store = get(record, 'store');

  var relationship = rels[key] = callback.call(record, store, data);

  return setProperties(relationship, {
    owner: record, name: key, isPolymorphic: options.polymorphic
  });
}

function hasRelationship(type, options) {
  options = options || {};

  var meta = { type: type, isRelationship: true, options: options, kind: 'hasMany' };

  return Ember.computed(function(key) {
    var records = get(this, 'data')[key],
    isRecordsEveryEmpty = Ember.A(records).everyProperty('isEmpty', false);

    if (!isRecordsEveryEmpty) {
      return asyncHasMany.call(this, type, options, meta, key);  
    }

    return buildRelationship(this, key, options, function(store, data) {
      var records = data[key];
      Ember.assert('You looked up the \'' + key + '\' relationship on \'' + this + '\' but some of the associated records were not loaded. Either make sure they are all loaded together with the parent record, or specify that the relationship is async (`DS.hasMany({ async: true })`)', Ember.A(records).everyProperty('isEmpty', false));
      return store.findMany(this, data[key], meta.type);
    });
  }).property('data').meta(meta);
}

/*
  @namespace
  @method hasMany
  @for DS
  @param {String or DS.Model} type the model type of the relationship
  @param {Object} options a hash of options
  @return {Ember.computed} relationship
*/
DS.hasMany = function(type, options) {
  if (typeof type === 'object') {
    options = type;
    type = undefined;
  }
  return hasRelationship(type, options);
};

export default DS.hasMany;