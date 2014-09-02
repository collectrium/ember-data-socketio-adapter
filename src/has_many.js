var oldHasMany = DS.hasMany;
/**
 * All hasMany relations should be async
 * @param type
 * @param options
 * @returns {*}
 */
DS.hasMany = function(type, options) {
  options = options || {};
  options.async = true;
  return oldHasMany(type, options);
};

export default DS.hasMany;