var oldBelongsTo = DS.belongsTo;
/**
 * All belongsTo relations should be async
 * @param type
 * @param options
 * @returns {*}
 */
DS.belongsTo = function(type, options) {
  options = options || {};
  options.async = true;
  return oldBelongsTo(type, options);
};

export default DS.belongsTo;