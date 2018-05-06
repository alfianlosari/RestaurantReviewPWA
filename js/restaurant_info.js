let restaurant;
var map;

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
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  initMapAndMarker();
}

initMapAndMarker = () => {
  if (self.restaurant) {
      if (!self.google) return;
      if (!self.map) {
        self.map = new google.maps.Map(document.getElementById('map'), {
          zoom: 16,
          center: self.restaurant.latlng,
          scrollwheel: false
        });
      }
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
  }
}

/**
 * Get current restaurant from page URL.
 */
fetchRestaurantFromURL = (callback) => {
  if (self.restaurant) { // restaurant already fetched!
    callback(null, self.restaurant)
    return;
  }
  
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    error = 'No restaurant id in URL'
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantReviewsById(id, (error, reviews) => {
      if (error) {
        console.error(error)
      } else {
        self.reviews = reviews;
        requestAnimationFrame(fillReviewsHTML);
      }

    });

    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }

      requestAnimationFrame(fillRestaurantHTML)
      callback(null, restaurant)
    });
  }
}

/**
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = () => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = self.restaurant.name;

  const address = document.getElementById('restaurant-address');
  address.innerHTML = self.restaurant.address;

  const image = document.getElementById('restaurant-img');
  image.className = 'restaurant-img lazy';
  image.src = DBHelper.imageUrlForRestaurant(self.restaurant);
  image.alt = `Restaurant: ${self.restaurant.name}`;

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = self.restaurant.cuisine_type;

  const favourite = document.getElementById('restaurant-favourite-container');
  const label = document.createElement('label');
  label.setAttribute('for', 'restaurant-favourite');
  label.innerHTML = "Set As Favourite"
  favourite.appendChild(label);

  const checkbox = document.createElement('input');
  checkbox.setAttribute('type', 'checkbox');
  if (self.restaurant.is_favorite === true) {
    checkbox.setAttribute('checked', '');
  }

  checkbox.addEventListener('change', toggleFavorite)
  checkbox.setAttribute('id', 'restaurant-favourite');
  checkbox.setAttribute('name', 'restaurant-favourite');
  favourite.appendChild(checkbox);

  // fill operating hours
  if (self.restaurant.operating_hours) {
    requestAnimationFrame(fillRestaurantHoursHTML);
  }
}

toggleFavorite = (e) => {
  e && e.preventDefault()
  if (e.target.checked) {
    DBHelper.favouriteRestaurantById(self.restaurant.id)
    .then((success) => {})
    .catch((error) => {
      showSnackbar(error.message);
      e.target.checked = false;

    });

  } else {
    DBHelper.unfavouriteRestaurantById(self.restaurant.id)
    .then((success) => {})
    .catch((error) => {
      showSnackbar(error.message);
      e.target.checked = true;
      
    });
  }
}

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = () => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in self.restaurant.operating_hours) {
    const row = document.createElement('tr');
    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = self.restaurant.operating_hours[key];
    row.appendChild(time);
    hours.appendChild(row);
  }
}

/**
 * Create all reviews HTML and add them to the webpage.
 */
fillReviewsHTML = () => {
  const container = document.getElementById('reviews-container');
  container.innerHTML = '';
  const title = document.createElement('h2');
  title.innerHTML = 'Reviews';
  container.appendChild(title);

  const form = createReviewForm()
  container.appendChild(form);

  if (!self.reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }
  const ul = document.createElement('ul');
  ul.setAttribute('id', 'reviews-list');
  
  self.reviews.reverse().forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
}

createReviewForm = () => {
  const form = document.createElement('form');

  const label = document.createElement('label')
  label.setAttribute('for', 'reviewer-name');
  label.innerHTML = "Name";
  form.appendChild(label);

  const nameInput = document.createElement('input');
  nameInput.setAttribute('type', 'text');
  nameInput.setAttribute('name', 'reviewer-name');
  nameInput.setAttribute('id', 'reviewer-name');
  nameInput.setAttribute('placeholder', 'Enter your name');
  form.appendChild(nameInput);

  form.appendChild(document.createElement('br'));

  const ratingLabel = document.createElement('label');
  ratingLabel.setAttribute('for', 'reviewer-rating');
  ratingLabel.innerHTML = "Rating"
  form.appendChild(ratingLabel);

  const ratingSelect = document.createElement('select');
  ratingSelect.setAttribute('name', 'reviewer-rating');
  ratingSelect.setAttribute('id', 'reviewer-rating');

  ratingSelect.appendChild(createRatingOption(1));
  ratingSelect.appendChild(createRatingOption(2));
  ratingSelect.appendChild(createRatingOption(3));
  ratingSelect.appendChild(createRatingOption(4));
  ratingSelect.appendChild(createRatingOption(5));

  ratingSelect.setAttribute('value', 1);

  form.appendChild(ratingSelect);
  form.appendChild(document.createElement('br'));

  const commentLabel = document.createElement('label');
  commentLabel.setAttribute('for', 'reviewer-comment');
  commentLabel.innerHTML = 'Comment';
  form.appendChild(commentLabel);
  form.appendChild(document.createElement('br'));

  const commentTextarea = document.createElement('textarea');
  commentTextarea.setAttribute('name', 'reviewer-comment');
  commentTextarea.setAttribute('placeholder', 'Enter your review');
  commentTextarea.setAttribute('id', 'reviewer-comment');
  form.appendChild(commentTextarea);
  form.appendChild(document.createElement('br'));

  const submitButton = document.createElement('button');
  submitButton.setAttribute('type', 'submit');
  submitButton.setAttribute('value', 'Submit Review');
  submitButton.innerHTML = "Submit Review";
  submitButton.addEventListener('click', handleSubmitReview)
  form.appendChild(submitButton);
  return form;
}

handleSubmitReview = (e) => {
  e && e.preventDefault();
  const name = document.getElementById('reviewer-name');
  const rating = document.getElementById('reviewer-rating');
  const comments = document.getElementById('reviewer-comment');

  if (!name.value || !comments.value) {
    showSnackbar('Please fill your name and comment');
    return;
  }

  let date = new Date().getTime();

  DBHelper.postRestaurantReview({
    restaurant_id: self.restaurant.id,
    name: name.value, 
    rating: Number(rating.value), 
    comments: comments.value,
    createdAt: date,
    updatedAt: date
  }).then((review) =>{
    const ul = document.getElementById('reviews-list');
    let li = createReviewHTML(review);
    if (ul.childNodes.length === 0) {
      ul.appendChild(li);
    } else {
      ul.insertBefore(li, ul.childNodes[0]);
    }
  }).catch((error) => console.warn(error));

  name.value = '';
  rating.value = '1';
  comments.value = '';
}

createRatingOption = (rating) => {
  const option = document.createElement('option')
  option.setAttribute('value', rating)
  option.innerHTML = `${rating}`;
  return option;
}

/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = (review) => {
  const li = document.createElement('li');
  const titleDiv = document.createElement('div');
  titleDiv.setAttribute('class', 'item-header');

  const name = document.createElement('p');
  name.innerHTML = review.name;
  titleDiv.appendChild(name);

  const date = document.createElement('p');
  date.innerHTML = new Date(review.updatedAt).toLocaleString();
  titleDiv.appendChild(date);
  li.appendChild(titleDiv)

  const rating = document.createElement('p');
  rating.setAttribute('class', 'rating')
  rating.innerHTML = `Rating: ${review.rating}`;
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.setAttribute('class', 'review-text');
  comments.innerHTML = review.comments;
  li.appendChild(comments);

  return li;
}

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = (restaurant=self.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.setAttribute('aria-current', 'page');
  li.innerHTML = restaurant.name;
  breadcrumb.appendChild(li);
}

/**
 * Get a parameter by name from page URL.
 */
getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function showSnackbar(message) {
  var snackbar = document.getElementById("snackbar");
  snackbar.className = "show";
  snackbar.innerHTML = message;
  setTimeout(function(){ snackbar.className = snackbar.className.replace("show", ""); }, 5000);
}

fetchRestaurantFromURL((error, restaurant) => {
  if (error) { // Got an error!
    console.error(error);
  } else {
    fillBreadcrumb();
    initMapAndMarker();
  }
});