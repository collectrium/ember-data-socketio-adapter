import DS from 'ember-data';
import Ember from 'ember';

const { Evented } = Ember;

export default DS.Store.extend(Evented, {});
