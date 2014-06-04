window.fixtures = [
  
];

window.getFixture = function(name) {
  var fix;

  fixtures.forEach(function (fixture) {
    if (fixture.name === name) {
      fix = fixture.response;
    }
  });
  fix = JSON.stringify(fix);
  return JSON.parse(fix);
}

window.addFixture = function(name, request, response) {
  var obj = {};

  if (request.type) {
    obj.type = request.type;
  }
  if (request.requestType) {
    obj.requestType = request.requestType;
  }
  if (request.hash) {
    obj.hash = request.hash;
  }
 
  window.fixtures.push({
    name: name,
    request: obj,
    response: response
  }); 
};

// Find Post by ID without options
addFixture('Find Post by ID = 1', {
  type: 'post',
  requestType: 'READ',
  hash: {id: "1"}
}, { post: [
    { id: 1, name: 'Socket.io is awesome', comments: [1,2], author: 1 }
  ] 
});


addFixture('Find Post by ID = 2', {
  type: 'post',
  requestType: 'READ',
  hash: {id: "2"}
}, { post: [
    { id: 2, name: 'Ember.js is awesome', comments: [] }
  ] 
});

addFixture('Find Post by ID = 3', {
  type: 'post',
  requestType: 'READ',
  hash: {id: "3"}
}, { post: [
    { id: 3, name: 'Socket.io is awesome', comments: [] }
  ] 
});

// Find All Posts without options
addFixture('Find Posts without options', {
  type: 'post',
  requestType: 'READ_LIST',
  hash: {}
}, {
  meta: {},
  payload: {
    post: [
      { id: 1, name: 'Socket.io is awesome', comments: [1,2], author: 1 },
      { id: 2, name: 'Ember.js is awesome', comments: [], author: null }
    ]
  }
});

addFixture('Find Posts with options {limit: 1}', {
  type: 'post',
  requestType: 'READ_LIST',
  hash: {limit: 1}
}, {
  meta: {total: 1},
  payload: {
    post: [
      { id: 1, name: 'Socket.io is awesome', comments: [1,2], author: 1 }
    ]
  }
});

addFixture('Find Posts with options {author: 1, limit: 1},', {
  type: 'post',
  requestType: 'READ_LIST',
  hash: {
    author: 1,
    limit: 1
  }
}, {
  meta: {total: 1},
  payload: {
    post: [
      { id: 1, name: 'Socket.io is awesome', comments: [1,2], author: 1 }
    ]
  }
});

addFixture('Find Posts with options {limit: 2}', {
  type: 'post',
  requestType: 'READ_LIST',
  hash: {limit: 2}
}, {
  meta: {total: 2},
  payload: {
    post: [
      { id: 1, name: 'Socket.io is awesome', comments: [1,2], author: 1 },
      { id: 2, name: 'Ember.js is awesome', comments: [], author: null }
    ]
  }
});

// Create Post
addFixture('Create Post', {
  type: 'post',
  requestType: 'CREATE',
  hash: {
    post: [
      { name: 'Socket.io is awesome', comments: [], author: '1' }
    ]
  }
}, {
  post: [
    { id: 1, name: 'Socket.io is awesome' }
  ]
});

// Create Posts
addFixture('Create Posts', {
  type: 'post',
  requestType: 'CREATE_LIST',
  hash: {
    post: [
      { name: 'Socket.io is awesome', comments: [], author: '1' },
      { name: 'Ember.js is awesome', comments: [], author: '1' }
    ]
  }
}, {
  post: [
    { id: 1, name: 'Socket.io is awesome', author: 1 },
    { id: 2, name: 'Ember.js is awesome' }
  ]
});

// Update Post
addFixture('Update Post', {
  type: 'post',
  requestType: 'UPDATE',
  hash: {
    post: [
      { id: '1', name: 'Javascript is awesome', comments: [], author: '1' }
    ]
  }
}, {
  post: [
    { id: 1, name: 'Javascript is awesome' }
  ]
});

// Update Posts
addFixture('Update Posts', {
  type: 'post',
  requestType: 'UPDATE_LIST',
  hash: {
    post: [
      { id: '1', name: 'Javascript is awesome', comments: [], author: "1" },
      { id: '2', name: 'Javascript is awesome', comments: [], author: undefined }
    ]
  }  
}, {
  post: [
    { id: 1, name: 'Javascript is awesome', comments: [], author: 1 },
    { id: 2, name: 'Javascript is awesome', comments: [], author: undefined }
  ]  
});

// Delete Post
addFixture('Delete Post', {
  type: 'post',
  requestType: 'DELETE',
  hash: { id: '2' }
}, {
  post: {
    id: 2
  }
});

// Delete Posts
addFixture('Delete Posts', {
  type: 'post',
  requestType: 'DELETE_LIST',
  hash: {
    ids: ['1', '2']
  }
}, {
  post: {
    id: [1, 2]
  }
});

// Read Posts with releations
addFixture('Read Posts with releations', {
  type: 'post',
  requestType: 'READ_LIST',
  hash: {
    include: ['comments', 'author']
  }
}, {
  meta: {total: 2},
  payload: {
    post: [
      { id: 1, name: 'Javascript is awesome', comments: [1,2], author: 1 },
      { id: 2, name: 'Socket.io is awesome', comments: [] }
    ],
    comments: [
      { id: 1, name: 'Greet.' },
      { id: 2, name: 'Nice.' }
    ],
    author: [
      { id: 1, name: 'Test' }
    ]
  }
});

// Find Comment by ID without options
addFixture('Find Comments by IDS = [1,2]', {
  type: 'comment',
  requestType: 'READ_LIST',
  hash: {
    ids: ["1", "2"]
  }
}, {
  payload: {
    comments: [
      { id: 1, name: 'Greet.' },
      { id: 2, name: 'Nice.' }
    ]
  }
});

addFixture('Find Comment by ID = 1', {
  type: 'comment',
  requestType: 'READ',
  hash: {id: "1"}
}, {
  comment: [
    { id: 1, name: 'Greet.' }
  ]
});

addFixture('Find Comment by ID = 2', {
  type: 'comment',
  requestType: 'READ',
  hash: {id: "2"}
}, {
  comment: [
    { id: 2, name: 'Nice.' }
  ]
});

addFixture('Find Author by ID = 1', {
  type: 'author',
  requestType: 'READ',
  hash: { id: "1" }
}, {
  author: [
    { id: 1, name: 'Test' }
  ]
});

addFixture('Error message', {
  type: 'post',
  requestType: 'READ_LIST',
  hash: { id: 1, error: "error" }
}, {
  error: 'Server error'
});