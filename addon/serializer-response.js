import DS from 'ember-data';
import Ember from 'ember';

const {
  Model
  } = DS;

const {
  get,
  } = Ember;

/**
 Convert the payload from `serializer.extract` to a JSON-API Document.
 @method _normalizeSerializerPayload
 @private
 @param {subclass of DS.Model} modelClass
 @param {Object} payload
 @return {Object} JSON-API Document
 */
export function _normalizeSerializerPayload(modelClass, payload) {
  let data = null;

  if (payload) {
    if (Ember.typeOf(payload) === 'array') {
      data = [].map.call(payload, (payload) => _normalizeSerializerPayloadItem(modelClass, payload));
    } else {
      data = _normalizeSerializerPayloadItem(modelClass, payload);
    }
  }

  return { data };
}

/**
 Convert the payload representing a single record from `serializer.extract` to
 a JSON-API Resource Object.
 @method _normalizeSerializerPayloadItem
 @private
 @param {subclass of DS.Model} modelClass
 @param {Object} payload
 @return {Object} JSON-API Resource Object
 */
export function _normalizeSerializerPayloadItem(modelClass, itemPayload) {
  var item = {};

  item.id = '' + itemPayload.id;
  item.type = modelClass.modelName;
  item.attributes = {};
  item.relationships = {};

  modelClass.eachAttribute(function(name) {
    if (itemPayload.hasOwnProperty(name)) {
      item.attributes[name] = itemPayload[name];
    }
  });

  modelClass.eachRelationship(function(key, relationshipMeta) {
    var relationship, value;

    if (itemPayload.hasOwnProperty(key)) {
      relationship = {};
      value = itemPayload[key];
      let normalizeRelationshipData = function(value, relationshipMeta) {
        if (Ember.isNone(value)) {
          return null;
        }
        // Temporary support for https://github.com/emberjs/data/issues/3271
        if (value instanceof Model) {
          value = { id: value.id, type: value.constructor.modelName };
        }
        if (Ember.typeOf(value) === 'object') {
          Ember.assert('Ember Data expected a number or string to represent the record(s) in the `' + key + '` relationship instead it found an object. If this is a polymorphic relationship please specify a `type` key. If this is an embedded relationship please include the `DS.EmbeddedRecordsMixin` and specify the `' + key + '` property in your serializer\'s attrs object.', value.type);
          if (value.id) {
            value.id = `${value.id}`;
          }
          return value;
        }

        Ember.assert("A " + relationshipMeta.parentType + " record was pushed into the store with the value of " + key + " being " + Ember.inspect(value) + ", but " + key + " is a belongsTo relationship so the value must not be an array. You should probably check your data payload or serializer.", !Ember.isArray(value));
        return { id: `${value}`, type: relationshipMeta.type };
      };

      if (relationshipMeta.kind === 'belongsTo') {
        relationship.data = normalizeRelationshipData(value, relationshipMeta);
        // handle the belongsTo polymorphic case, where { post:1, postType: 'video' }
        if (relationshipMeta.options && relationshipMeta.options.polymorphic && itemPayload[key + 'Type']) {
          relationship.data.type = itemPayload[key + 'Type'];
        }
      } else if (relationshipMeta.kind === 'hasMany') {
        // || [] because the hasMany could be === null
        Ember.assert("A " + relationshipMeta.parentType + " record was pushed into the store with the value of " + key + " being '" + Ember.inspect(value) + "', but " + key + " is a hasMany relationship so the value must be an array. You should probably check your data payload or serializer.", Ember.isArray(value) || value === null);

        var relationshipData = Ember.A(value || []);
        relationship.data = map.call(relationshipData, function(item) {
          return normalizeRelationshipData(item, relationshipMeta);
        });
      }
    }

    if (itemPayload.links && itemPayload.links.hasOwnProperty(key)) {
      relationship = relationship || {};
      value = itemPayload.links[key];

      relationship.links = {
        related: value
      };
    }

    if (relationship) {
      relationship.meta = get(itemPayload, `meta.${key}`);
      item.relationships[key] = relationship;
    }
  });

  return item;
}
