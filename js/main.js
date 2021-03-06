let restaurants,
  neighborhoods,
  cuisines
var map
var dbStore
var markers = []

/**
 * Service Worker Registration
 */
registerServiceWorker = () => {
  if (!navigator.serviceWorker) return;
  navigator.serviceWorker.register('../sw.js')
    .then((reg) => console.log('registration successfull'))
    .catch((error) => console.warn(error))
}
registerServiceWorker();


/**
 * Fetch all neighborhoods and set their HTML.
 */
fetchNeighborhoods = () => {
  DBHelper.fetchNeighborhoods((error, neighborhoods) => {
    if (error) { // Got an error
      console.error(error);
    } else {
      self.neighborhoods = neighborhoods;
      requestAnimationFrame(fillNeighborhoodsHTML)
    }
  });
}

/**
 * Set neighborhoods HTML.
 */
fillNeighborhoodsHTML = () => {
  const select = document.getElementById('neighborhoods-select');
  self.neighborhoods.forEach(neighborhood => {
    const option = document.createElement('option');
    option.innerHTML = neighborhood;
    option.value = neighborhood;
    select.append(option);
  });
}

/**
 * Fetch all cuisines and set their HTML.
 */
fetchCuisines = () => {
  DBHelper.fetchCuisines((error, cuisines) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.cuisines = cuisines;
      requestAnimationFrame(fillCuisinesHTML);
    }
  });
}

/**
 * Set cuisines HTML.
 */
fillCuisinesHTML = () => {
  const select = document.getElementById('cuisines-select');

  self.cuisines.forEach(cuisine => {
    const option = document.createElement('option');
    option.innerHTML = cuisine;
    option.value = cuisine;
    select.append(option);
  });
}

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  addMarkersToMap();
}
/**
 * Update page and map for current restaurants.
 */
updateRestaurants = () => {
  const cSelect = document.getElementById('cuisines-select');
  const nSelect = document.getElementById('neighborhoods-select');

  const cIndex = cSelect.selectedIndex;
  const nIndex = nSelect.selectedIndex;

  const cuisine = cSelect[cIndex].value;
  const neighborhood = nSelect[nIndex].value;

  DBHelper.fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, (error, restaurants) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      requestAnimationFrame(resetRestaurants.bind(self, restaurants));
      requestAnimationFrame(fillRestaurantsHTML.bind(self));
    }
  })
}

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
resetRestaurants = (restaurants) => {
  // Remove all restaurants
  self.restaurants = [];
  const ul = document.getElementById('restaurants-list');
  ul.innerHTML = '';

  // Remove all map markers
  self.markers.forEach(m => m.setMap(null));
  self.markers = [];
  self.restaurants = restaurants;
}

/**
 * Create all restaurants HTML and add them to the webpage.
 */
fillRestaurantsHTML = () => {
  const ul = document.getElementById('restaurants-list');
  self.restaurants.forEach(restaurant => {
    requestAnimationFrame(function() {
      ul.append(createRestaurantHTML(restaurant));
    })
  });
  addMarkersToMap();
}

/**
 * Create restaurant HTML.
 */
createRestaurantHTML = (restaurant) => {
  const li = document.createElement('li');

  const image = document.createElement('img');
  image.className = 'restaurant-img lazy';
  image.alt = `Restaurant: ${restaurant.name}`
  
  image.src = DBHelper.imageUrlForRestaurant(restaurant);
  li.append(image);

  const restaurantItemText = document.createElement('div');
  const name = document.createElement('h3');
  name.innerHTML = restaurant.name;
  restaurantItemText.append(name);

  const neighborhood = document.createElement('p');
  neighborhood.innerHTML = restaurant.neighborhood;
  restaurantItemText.append(neighborhood);

  const address = document.createElement('p');
  address.innerHTML = restaurant.address;
  restaurantItemText.append(address);

  const more = document.createElement('a');
  more.innerHTML = 'View Details';
  more.href = DBHelper.urlForRestaurant(restaurant);
  restaurantItemText.append(more)

  li.append(restaurantItemText)

  return li
}

/**
 * Add markers for current restaurants to the map.
 */
addMarkersToMap = () => {
  if (self.restaurants) {
    if (!self.google) return;
    if (!self.map) {
      let loc = {
        lat: 40.722216,
        lng: -73.987501
      };
      
      self.map = new google.maps.Map(document.getElementById('map'), {
        zoom: 12,
        center: loc,
        scrollwheel: false
      });
    }

    self.restaurants.forEach(restaurant => {
      // Add marker to the map
      const marker = DBHelper.mapMarkerForRestaurant(restaurant, self.map);
      google.maps.event.addListener(marker, 'click', () => {
        window.location.href = marker.url
      });
      self.markers.push(marker);
    });
  }

}

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
function intializeContent(event) {
  let lazyImages = [].slice.call(document.querySelectorAll("img.lazy"));

  if ("IntersectionObserver" in window) {
    let lazyImageObserver = new IntersectionObserver(function(entries, observer) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          let lazyImage = entry.target;
          lazyImage.src = lazyImage.dataset.src;
          lazyImage.srcset = lazyImage.dataset.srcset;
          lazyImage.classList.remove("lazy");
          lazyImageObserver.unobserve(lazyImage);
        }
      });
    });

    lazyImages.forEach(function(lazyImage) {
      lazyImageObserver.observe(lazyImage);
    });
  } else {
      let active = false;
      const lazyLoad = function() {
        if (active === false) {
          active = true;

          setTimeout(function() {
            lazyImages.forEach(function(lazyImage) {
              if ((lazyImage.getBoundingClientRect().top <= window.innerHeight && lazyImage.getBoundingClientRect().bottom >= 0) && getComputedStyle(lazyImage).display !== "none") {
                lazyImage.src = lazyImage.dataset.src;
                lazyImage.srcset = lazyImage.dataset.srcset;
                lazyImage.classList.remove("lazy");

                lazyImages = lazyImages.filter(function(image) {
                  return image !== lazyImage;
                });

                if (lazyImages.length === 0) {
                  document.removeEventListener("scroll", lazyLoad);
                  window.removeEventListener("resize", lazyLoad);
                  window.removeEventListener("orientationchange", lazyLoad);
                }
              }
            });

            active = false;
          }, 200);
        }
      }
      document.addEventListener("scroll", lazyLoad);
      window.addEventListener("resize", lazyLoad);
      window.addEventListener("orientationchange", lazyLoad);
  }

  fetchNeighborhoods();
  fetchCuisines();
}

function showSnackbar(message) {
  var snackbar = document.getElementById("snackbar");
  snackbar.className = "show";
  snackbar.innerHTML = message;
  setTimeout(function(){ snackbar.className = snackbar.className.replace("show", ""); }, 5000);
}

intializeContent();
updateRestaurants();