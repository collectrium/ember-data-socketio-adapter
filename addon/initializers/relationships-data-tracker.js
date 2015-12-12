import Ember from 'ember';
import DS from 'ember-data';
const {
  Model
} = DS;
const {
  get
} = Ember;
export default {
  after: 'store',
  name: 'relationships-data-tracker',
  initialize() {
    Model.reopen({
      saveRelationshipsInData: function() {
        const data = get(this, 'data');
        this.constructor.eachRelationship((key, meta) => {
          if (meta.kind === 'belongsTo') {
            data[key] = get(this, `${key}.id`);
          }
          if (meta.kind === 'hasMany') {
            data[key] = get(this, key).toArray().getEach('id');
          }
        });
      },
      didCommit: function() {
        this.saveRelationshipsInData();
      },
      didLoad: function() {
        this.saveRelationshipsInData();
      }
    });
  }
};
