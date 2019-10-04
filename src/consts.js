exports.LIBRARY_SPECIFIC_OPTIONS = new Set([
  // "Auth" shorthand
  'user',
  'password',

  // Database settings go to query string
  'queryOptions',

  // Driver options
  'dataObjects',
  'format',
  'syncParser',
  'omitFormat',
  'readonly',
  'useQueryString'
]);
