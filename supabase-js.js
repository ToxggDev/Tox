/**
 * Supabase client library for Chrome Extension
 * This file loads the Supabase client from the local file and makes it available to the extension
 */

// Create a global supabaseJs variable that can be used by the background script
(function() {
  // Load the Supabase client from local file
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('supabase.js');
  document.head.appendChild(script);
  
  // Wait for it to load
  script.onload = function() {
    console.log('Supabase library loaded successfully');
    // Create a global variable that the background script can access
    globalThis.supabaseJs = window.supabase;
  };
})();

// If direct loading doesn't work, provide a fallback implementation
if (!globalThis.supabaseJs) {
  // Load from CDN directly
  const supabaseScript = `
    var supabaseJs = {
      createClient: function(url, key) {
        return {
          from: function(table) {
            return {
              select: function(columns) {
                return {
                  limit: function(limit) {
                    return {
                      then: function(callback) {
                        // Make a direct fetch request to Supabase
                        fetch(url + '/rest/v1/' + table + '?select=' + (columns || '*') + '&limit=' + limit, {
                          headers: {
                            'apikey': key,
                            'Authorization': 'Bearer ' + key
                          }
                        })
                        .then(response => response.json())
                        .then(data => callback({data: data, error: null}))
                        .catch(error => callback({data: null, error: error}));
                        
                        return this;
                      }
                    };
                  },
                  eq: function(column, value) {
                    return this;
                  }
                };
              },
              insert: function(data) {
                return {
                  then: function(callback) {
                    // Make a direct fetch request to Supabase
                    fetch(url + '/rest/v1/' + table, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'apikey': key,
                        'Authorization': 'Bearer ' + key,
                        'Prefer': 'return=minimal'
                      },
                      body: JSON.stringify(data)
                    })
                    .then(response => {
                      if (response.ok) {
                        callback({data: null, error: null});
                      } else {
                        response.text().then(text => {
                          callback({data: null, error: {message: text}});
                        });
                      }
                    })
                    .catch(error => callback({data: null, error: error}));
                    
                    return this;
                  }
                };
              },
              channel: function(name) {
                return {
                  on: function(event, table, callback) {
                    return this;
                  },
                  subscribe: function(callback) {
                    callback('SUBSCRIBED');
                    return this;
                  }
                };
              }
            };
          }
        };
      }
    };
  `;
  
  // Add to global scope
  globalThis.supabaseJs = eval(supabaseScript);
  console.log('Using fallback Supabase implementation');
}