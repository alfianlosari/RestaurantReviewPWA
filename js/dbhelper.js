/**
 * open IndexDB 
 */
openDatabase = () => {
  if (!navigator.serviceWorker) {
    return Promise.resolve();
  }

  return idb.open('restaurant-review', 2, function(upgradeDB) {
    let store = upgradeDB.createObjectStore('restaurant-review', {
      keyPath: 'id'
    });
    let unsyncedCommentStore = upgradeDB.createObjectStore('restaurant-review-unsynced-comment');
    let commentStore = upgradeDB.createObjectStore('restaurant-review-comment');
    // commentStore.createIndex('by-time', 'updatedAt');
  });
}

dbStore = openDatabase();

syncUnsyncedData = () => {
  return dbStore.then(function(db) {
    if (!db) return null;
    var tx = db.transaction('restaurant-review-unsynced-comment');
    var store = tx.objectStore('restaurant-review-unsynced-comment');
    return store.getAll().
      then(function(restaurantCommment) {
        if (!restaurantCommment) return;
        restaurantCommment.forEach((comments) => {
          let restaurant_id = comments[0].restaurant_id;
          let promises = comments.map((comment) => DBHelper.uploadRestaurantReview(comment));
          Promise.all(promises)
            .then((success) => {
              var tx = db.transaction('restaurant-review-unsynced-comment', 'readwrite');
              var store = tx.objectStore('restaurant-review-unsynced-comment');
              store.delete(restaurant_id);
            })
        });
      });
  });
};

handleOfflineEvent = () => {
  showSnackbar('Your connection is offline');
}

if (navigator) {
  window.addEventListener('online', syncUnsyncedData);
  window.addEventListener('offline', handleOfflineEvent);
}

syncUnsyncedData();

/**
 * Common database helper functions.
 */
class DBHelper {

  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    const port = 1337 // Change this to your server port
    return `http://localhost:${port}/restaurants`;
  }

  static get DATABASE_REVIEWS_URL() {
    const port = 1337
    return `http://localhost:${port}/reviews`;
  }

  static showCachedRestaurantReviewById(id) {
    return dbStore.then(function(db) {
      if (!db) return null;
      var tx = db.transaction('restaurant-review-comment');
      var store = tx.objectStore('restaurant-review-comment');
      return store.get(Number(id)).
        then(function(reviews) {
          return reviews;
        });
  });
  }

  static showCachedRestaurants() {
    return dbStore.then(function(db) {
        if (!db) return null;
        var tx = db.transaction('restaurant-review');
        var store = tx.objectStore('restaurant-review');
        return store.getAll().
          then(function(restaurants) {
            if (restaurants.length === 0) return null;
            return restaurants;
          });
    });
  }
  
  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants(callback) {
    DBHelper.showCachedRestaurants()
      .then(function(restaurants) {
        if (restaurants) {
          callback(null, restaurants);
        } else {
          return fetch(DBHelper.DATABASE_URL)
            .then(function(response) {
              return response.json();
            })
            .then(function(restaurants) {
              dbStore.then(function(db) {
                if (!db) return;
                var tx = db.transaction('restaurant-review', 'readwrite');
                var store = tx.objectStore('restaurant-review');
                restaurants.forEach(function(restaurant) {
                  store.put(restaurant);
                });
            });
            callback(null, restaurants);
          });
        }
      }).catch(function(error) {
        callback(error, null);
      });
  }
  
  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {
    dbStore.then(function(db) {
      if (!db) return null;
      var tx = db.transaction('restaurant-review');
      var store = tx.objectStore('restaurant-review');
      return store.get(Number(id)).
        then((restaurant) => {
          return restaurant;
        });
    }).then((restaurant) => {
      if (restaurant) {
        callback(null, restaurant)
      } else {
        fetch(`${DBHelper.DATABASE_URL}/${id}`)
        .then(function(response) {
          return response.json();
        }).then(function(json) {
          callback(null, json)
        }).catch(function(error) {
          callback(error, null)
        });
      }
    }).catch((error) => {
      callback(error, null)
    });
  }

  static getRestaurantReviewsFromLocalDb(id) {
    return dbStore.then(function(db) {
      if (!db) return null;
      var commentTx = db.transaction('restaurant-review-comment');
      var commentStore = commentTx.objectStore('restaurant-review-comment');
      var unsyncedTx = db.transaction('restaurant-review-unsynced-comment');
      var unsyncedStore = unsyncedTx.objectStore('restaurant-review-unsynced-comment');
      return Promise.all([
        commentStore.get(Number(id)),
        unsyncedStore.get(Number(id))
      ]).then((result) => {
        const comments = result[0] || [];
        const unsyncedComment = result[1] || [];
        const reviews = comments.concat(unsyncedComment);
        if (reviews.length === 0) return null;
        return reviews;
      });
    })
  }




  /*
  * Fetch Reviews for a restaurant
  */
  static fetchRestaurantReviewsById(id, callback) {
    DBHelper.getRestaurantReviewsFromLocalDb(id)
      .then((reviews) => {
        if (reviews) {
          callback(null, reviews);
        }
        
        fetch(`http://localhost:1337/reviews/?restaurant_id=${id}`)
          .then(function(response) {
            return response.json()
          }).then((reviews) => {
            dbStore.then(function(db) {
              if (!db) return;
              var tx = db.transaction('restaurant-review-comment', 'readwrite');
              var store = tx.objectStore('restaurant-review-comment');
              return reviews
            });

            dbStore.then(function(db) {
              var unsyncedTx = db.transaction('restaurant-review-unsynced-comment');
              var unsyncedStore = unsyncedTx.objectStore('restaurant-review-unsynced-comment');
              unsyncedStore.get(Number(id))
                .then((unsynced) => {
                  if (unsynced) {
                    callback(null, reviews.concat(unsynced));
                  } else {
                    callback(null, reviews);
                  }
                });  
            });       
        });
      });
  }


  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants
        if (cuisine != 'all') { // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != 'all') { // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood)
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i)
        callback(null, uniqueNeighborhoods);
      }
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type)
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i)
        callback(null, uniqueCuisines);
      }
    });
  }


  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`);
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    return (`/img/${restaurant.id}.jpg`);
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP}
    );
    return marker;
  }

  /**
   *  Post Restaurant Review
   */
  static postRestaurantReview(review) {
    if (navigator.onLine) {
      return DBHelper.uploadRestaurantReview(review);
    } else {
      showSnackbar('Review has been saved and will sync when your connection are online');
      return dbStore.then(function(db) {
        if (!db) return;
        var tx = db.transaction('restaurant-review-unsynced-comment', 'readwrite');
        var store = tx.objectStore('restaurant-review-unsynced-comment');
        return store.get(review.restaurant_id)
          .then(function(reviews) {
            if (reviews) {
              reviews.push(review);
              store.put(reviews, review.restaurant_id);
            } else {
              store.put([review], review.restaurant_id);
            }
            return review;
        });
      });
    }
  }

  static uploadRestaurantReview(review) {
    return fetch(DBHelper.DATABASE_REVIEWS_URL, {
      method: 'POST',
      body: JSON.stringify(review),
    }).then(function(response) {
        return response.json();
    });
  }

  /**
   *  Favourite a restaurant
   */

   static favouriteRestaurantById(id) {
     return fetch(`http://localhost:1337/restaurants/${id}/`, {
       method: 'PUT',
       body: JSON.stringify({
         is_favorite: true
       })
     }).then(function(response) {
        return dbStore.then(function(db) {
          if (!db) return response.json();
          var tx = db.transaction('restaurant-review');
          var store = tx.objectStore('restaurant-review');
          return store.get(Number(id))
            .then((restaurant) => {
              if (restaurant) {
                restaurant.is_favorite = true;
                var tx = db.transaction('restaurant-review', 'readwrite');
                var store = tx.objectStore('restaurant-review');
                store.put(restaurant)
              }
              return response.json();
            })
        });


     });
   }

   /**
    *   Unfavourite a restaurant
    */

  static unfavouriteRestaurantById(id) {
    return fetch(`http://localhost:1337/restaurants/${id}/`, {
      method: 'PUT',
      body: JSON.stringify({
        is_favorite: false
      })
    }).then(function(response) {
      return dbStore.then(function(db) {
        if (!db) return response.json();
        var tx = db.transaction('restaurant-review');
        var store = tx.objectStore('restaurant-review');
        return store.get(Number(id))
          .then((restaurant) => {            
            if (restaurant) {
              restaurant.is_favorite = false;
              var tx = db.transaction('restaurant-review', 'readwrite');
              var store = tx.objectStore('restaurant-review');
              store.put(restaurant)
            }
            return response.json();
          })
      });
    });
  }

}
