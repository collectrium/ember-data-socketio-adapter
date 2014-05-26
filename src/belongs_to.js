var get = Ember.get, set = Ember.set,
    isNone = Ember.isNone;

var Promise = Ember.RSVP.Promise;

// copied from ember-data//lib/system/relationships/belongs_to.js
function asyncBelongsTo(type, options, meta) {
  return Ember.computed('data', function(key, value) {
    var data = get(this, 'data'),
        store = get(this, 'store'),
        promiseLabel = "DS: Async belongsTo " + this + " : " + key,
        promise;

    if (arguments.length === 2) {
      Ember.assert("You can only add a '" + type + "' record to this relationship", !value || value instanceof store.modelFor(type));
      return value === undefined ? null : DS.PromiseObject.create({
        promise: Promise.cast(value, promiseLabel)
      });
    }

    var link = data.links && data.links[key],
        belongsTo = data[key];

    if(!isNone(belongsTo)) {
      promise = store.fetchRecord(belongsTo) || Promise.cast(belongsTo, promiseLabel);
      return DS.PromiseObject.create({
        promise: promise
      });
    } else if (link) {
      promise = store.findBelongsTo(this, link, meta);
      return DS.PromiseObject.create({
        promise: promise
      });
    } else {
      return null;
    }
  }).meta(meta);
}

DS.belongsTo = function (type, options) {
  if (typeof type === 'object') {
    options = type;
    type = undefined;
  } else {
    Ember.assert("The first argument DS.belongsTo must be a model type or string, like DS.belongsTo(App.Person)", !!type && (typeof type === 'string' || Model.detect(type)));
  }

  options = options || {};

  var meta = {
    type: type,
    isRelationship: true,
    options: options,
    kind: 'belongsTo'
  };

  return asyncBelongsTo(type, options, meta);
};


export default DS.belongsTo;