/*
 * MagicMirror²
 * Module: MMM-ImagesPhotos
 *
 * Original module:
 *   Rodrigo Ramírez Norambuena
 *
 * Enhancements:
 *   Trent Sams
 *
 * Added:
 *   - Non-repeating shuffle playlist
 *   - Photo history navigation
 *   - Touch gesture support
 *   - Slideshow pause/resume controls
 *
 * MIT Licensed.
 */

const ourModuleName = "MMM-ImagesPhotos";

Module.register(ourModuleName, {
  defaults: {
    opacity: 0.9,
    animationSpeed: 500,
    updateInterval: 5000,
    getInterval: 60000,
    maxWidth: "100%",
    maxHeight: "100%",
    retryDelay: 2500,
    path: "",
    fill: false,
    blur: 8,
    sequential: false,
    // Touch gesture configuration.
    swipeDistance: 50,
    tapDistance: 10,
    touch: false
  },

  wrapper: null,
  suspended: false,
  timer: null,
  fullscreen: false,

  touchStartX: 0,
  touchStartY: 0,
  touchStartTime: 0,
  touchMoved: false,

  requiresVersion: "2.24.0", // Required version of MagicMirror

  /**
   * Initialize module state.
   *
   * Creates the slideshow controller, history, and playback
   * structures before requesting the initial photo list.
   */

  start() {
    this.photos = [];
    this.loaded = false;

    // Current photo being displayed.
    this.currentIndex = -1;

    // Playback order used by shuffle mode.
    this.playlist = [];
    this.playlistPosition = -1;

    // History of viewed photos.
    this.history = [];
    this.historyPosition = -1;

    this.config.id = this.identifier;
    this.sendSocketNotification("CONFIG", this.config);
  },

  getStyles() {
    return ["MMM-ImagesPhotos.css"];
  },

  /*
   * Requests new data from api url helper
   */
  async getPhotos() {
    const urlApHelper = `/MMM-ImagesPhotos/photos/${this.identifier}`;
    const self = this;
    let retry = true;

    try {
      const photosResponse = await fetch(urlApHelper);

      if (photosResponse.ok) {
        const photosData = await photosResponse.json();
        self.processPhotos(photosData);
      } else if (photosResponse.status === 401) {
        self.updateDom(self.config.animationSpeed);
        Log.error(self.name, photosResponse.status);
        retry = false;
      } else {
        Log.error(self.name, "Could not load photos.");
      }

      if (!photosResponse.ok) {
        if (retry) {
          self.scheduleUpdate(self.loaded ? -1 : self.config.retryDelay);
        }
      }
    } catch (error) {
      Log.error(self.name, error);
    }
  },

  /**
   * Handle MagicMirror notifications.
   *
   * Responds to slideshow control notifications and determines
   * whether this module is running in a fullscreen region.
   */

  notificationReceived(notification, payload, sender) {
    // Detect fullscreen positions
    if (notification === "ALL_MODULES_STARTED") {
      const ourInstances = MM.getModules().withClass(ourModuleName);
      ourInstances.forEach((m) => {
        if (m.data.position.toLowerCase().startsWith("fullscreen")) {
          this.fullscreen = true;
        }
      });
    }

    // Navigation controls
    if (notification === "IMAGE_NEXT") {
      this.showNextPhoto();
      this.updateDom(this.config.animationSpeed);
    }

    if (notification === "IMAGE_PREVIOUS") {
      this.showPreviousPhoto();
      this.updateDom(this.config.animationSpeed);
    }

    if (notification === "IMAGE_PAUSE") {
      this.suspend();
    }

    if (notification === "IMAGE_RESUME") {
      this.resume()
    }

    if (notification === "IMAGE_TOGGLE_PAUSE") {
      if (this.suspended) {
        this.resume();
      } else {
        this.suspend();
      }
    }
  },

  /**
   * Start or restart the slideshow timer.
   *
   * Only one timer is active at a time. When the timer expires,
   * the slideshow advances to the next image and refreshes
   * the display.
   */

  startTimer() {
    const self = this;

    // Cancel any existing timer.
    if (self.timer !== null) {
      clearTimeout(self.timer);
      self.timer = null;
    }

    self.timer = setTimeout(() => {
      self.timer = null;

      if (!self.suspended) {
        self.advancePhoto();
        self.updateDom(self.config.animationSpeed);
      }
    }, this.config.updateInterval);
  },

  socketNotificationReceived(notification, payload, source) {
    if (notification === "READY" && payload === this.identifier) {
      // Schedule update timer.
      this.getPhotos();
    }
  },

  /*
   * Schedule next update.
   *
   * argument delay number - Milliseconds before next update.
   *  If empty, this.config.updateInterval is used.
   */
  scheduleUpdate(delay) {
    let nextLoad = this.config.getInterval;
    if (typeof delay !== "undefined" && delay >= 0) {
      nextLoad = delay;
    }

    const self = this;
    setTimeout(() => {
      self.getPhotos();
    }, nextLoad);
  },

  /**
   * Build the slideshow playback order.
   *
   * Sequential mode preserves the source order.
   * Shuffle mode randomizes the list using a Fisher-Yates shuffle
   * so every image is displayed once before repeating.
   */
  buildPlaylist() {
    this.playlist = [];

    for (let i = 0; i < this.photos.length; i++) {
      this.playlist.push(i);
    }

    if (!this.config.sequential) {
      for (let i = this.playlist.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.playlist[i], this.playlist[j]] =
          [this.playlist[j], this.playlist[i]];
      }
    }

    this.playlistPosition = -1;

  },

  /**
   * Record a displayed image.
   *
   * The viewing history allows manual navigation without
   * affecting the slideshow playback order.
   */
  addToHistory(index) {
    this.history.push(index);
    this.historyPosition = this.history.length - 1;
  },

  /**
   * Advance the slideshow.
   *
   * Selects the next image from the playback playlist,
   * rebuilding the playlist when every image has been shown.
   *
   * @returns {Object|null} Selected photo object.
   */
  advancePhoto() {
    if (!this.photos.length) {
      return null;
    }

    if (!this.playlist.length) {
      this.buildPlaylist();
    }

    // Start a new playlist after every image has been shown.
    if (this.playlistPosition >= this.playlist.length - 1) {
      this.buildPlaylist();
    }

    this.playlistPosition++;

    this.currentIndex = this.playlist[this.playlistPosition];

    this.addToHistory(this.currentIndex);

    return this.photos[this.currentIndex];
  },

  /**
   * Display the next image.
   *
   * Moves forward through browsing history when available.
   * Otherwise advances the slideshow to a new image.
   *
   * @returns {Object|null} Selected photo object.
   */
  showNextPhoto() {
    if (!this.photos.length) {
      return null;
    }

    // User is walking forward through history.
    if (this.historyPosition < this.history.length - 1) {
      this.historyPosition++;
      this.currentIndex = this.history[this.historyPosition];

      return this.photos[this.currentIndex];
    }

    // Already at newest image.
    return this.advancePhoto();
  },

  /**
 * Display the previous image.
 *
 * Navigates backward through the viewing history without
 * changing the slideshow playback order.
 *
 * @returns {Object|null} Selected photo object.
 */
  showPreviousPhoto() {
    if (!this.photos.length) {
      return null;
    }

    if (this.historyPosition <= 0) {
      return this.photos[this.currentIndex];
    }

    this.historyPosition--;

    this.currentIndex = this.history[this.historyPosition];

    return this.photos[this.currentIndex];
  },

  /**
   * Return the currently selected image.
   *
   * Initializes slideshow playback on the first request.
   *
   * @returns {Object|null} Current photo object.
   */
  getCurrentPhoto() {
    if (!this.photos.length) {
      return null;
    }

    if (this.currentIndex === -1) {
      return this.advancePhoto();
    }

    return this.photos[this.currentIndex];
  },

  scaleImage(srcwidth, srcheight, targetwidth, targetheight, fLetterBox) {
    const result = { width: 0, height: 0, fScaleToTargetWidth: true };

    if (
      srcwidth <= 0 ||
      srcheight <= 0 ||
      targetwidth <= 0 ||
      targetheight <= 0
    ) {
      return result;
    }

    // Scale to the target width
    const scaleX1 = targetwidth;
    const scaleY1 = (srcheight * targetwidth) / srcwidth;

    // Scale to the target height
    const scaleX2 = (srcwidth * targetheight) / srcheight;
    const scaleY2 = targetheight;

    // Now figure out which one we should use
    let fScaleOnWidth = scaleX2 > targetwidth;
    if (fScaleOnWidth) {
      fScaleOnWidth = fLetterBox;
    } else {
      fScaleOnWidth = !fLetterBox;
    }

    if (fScaleOnWidth) {
      result.width = Math.floor(scaleX1);
      result.height = Math.floor(scaleY1);
      result.fScaleToTargetWidth = true;
    } else {
      result.width = Math.floor(scaleX2);
      result.height = Math.floor(scaleY2);
      result.fScaleToTargetWidth = false;
    }
    result.targetleft = Math.floor((targetwidth - result.width) / 2);
    result.targettop = Math.floor((targetheight - result.height) / 2);

    return result;
  },


  /**
   * Pause slideshow playback.
   *
   * Stops the active slideshow timer while preserving
   * the current image and navigation state.
   */
  suspend() {
    this.suspended = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  },

  /**
   * Resume slideshow playback.
   *
   * Advances to the next image and restarts automatic
   * slideshow progression.
   */
  resume() {
    this.suspended = false;

    this.advancePhoto();
    this.updateDom(this.config.animationSpeed);
  },


  /**
   * Register touchscreen gesture handlers.
   *
   * Supports swipe navigation and tap-to-pause controls.
   * Listeners are attached to a persistent element because
   * slideshow images are recreated during each DOM update.
   */
  attachTouchHandlers(element) {
    const SWIPE_DISTANCE = this.config.swipeDistance;
    const TAP_DISTANCE = this.config.tapDistance;

    element.addEventListener("touchstart", (event) => {
      const touch = event.touches[0];

      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.touchStartTime = Date.now();
      this.touchMoved = false;
    });

    element.addEventListener("touchmove", (event) => {
      const touch = event.touches[0];

      if (
        Math.abs(touch.clientX - this.touchStartX) > TAP_DISTANCE ||
        Math.abs(touch.clientY - this.touchStartY) > TAP_DISTANCE
      ) {
        this.touchMoved = true;
      }
    });

    element.addEventListener("touchend", (event) => {

      const touch = event.changedTouches[0];

      const dx = touch.clientX - this.touchStartX;
      const dy = touch.clientY - this.touchStartY;

      // Ignore mostly vertical gestures.
      if (Math.abs(dy) > Math.abs(dx)) {
      }

      // Swipe left -> next
      if (dx < -SWIPE_DISTANCE) {
        this.showNextPhoto();
        this.updateDom(this.config.animationSpeed);
        return;
      }

      // Swipe right -> previous
      if (dx > SWIPE_DISTANCE) {
        this.showPreviousPhoto();
        this.updateDom(this.config.animationSpeed);
        return;
      }

      // Tap toggles pause
      if (!this.touchMoved) {
        this.suspended ? this.resume() : this.suspend();
      }
    });
  },

  getDom() {
    if (this.fullscreen) {
      return this.getDomFS();
    }
    return this.getDomnotFS();
  },

  /**
   * Build the module DOM for standard (non-fullscreen) layouts.
   */
  getDomnotFS() {
    const self = this;
    const wrapper = document.createElement("div");
    const photoImage = this.getCurrentPhoto();

    if (photoImage) {
      const img = document.createElement("img");
      this.attachTouchHandlers(img);
      img.src = photoImage.url;
      img.id = "mmm-images-photos";
      img.style.maxWidth = this.config.maxWidth;
      img.style.maxHeight = this.config.maxHeight;
      img.style.opacity = self.config.opacity;
      img.className = "bgimage";
      wrapper.appendChild(img);
      self.startTimer();
    }
    return wrapper;
  },

  /**
   * Build the module DOM for fullscreen layouts.
   *
   * Reuses persistent DOM elements to minimize image flicker
   * during slideshow transitions.
   */
  getDomFS() {
    const self = this;
    // If wrapper div not yet created
    if (this.wrapper === null) {
      // Create it once, try to reduce image flash on change

      this.wrapper = document.createElement("div");

      this.bk = document.createElement("div");
      this.bk.className = "bgimagefs";
      if (this.config.fill === true) {
        this.bk.style.filter = `blur(${this.config.blur}px)`;
        this.bk.style["-webkit-filter"] = `blur(${this.config.blur}px)`;
      } else {
        this.bk.style.backgroundColor = this.config.backgroundColor;
      }
      this.wrapper.appendChild(this.bk);
      this.fg = document.createElement("div");
      this.wrapper.appendChild(this.fg);
      if (this.config.touch) {
        this.attachTouchHandlers(this.wrapper);
      }
    }
    if (this.photos.length) {
      // Get the size of the margin, if any, we want to be full screen
      const m = window
        .getComputedStyle(document.body, null)
        .getPropertyValue("margin-top");
      // Set the style for the containing div

      this.fg.style.border = "none";
      this.fg.style.margin = "0px";

      const photoImage = this.getCurrentPhoto();

      let img = null;
      if (photoImage) {
        // Create img tag element
        img = document.createElement("img");

        // Set default position, corrected in onload handler
        img.style.left = `${0}px`;
        img.style.top = document.body.clientHeight + parseInt(m, 10) * 2;
        img.style.position = "relative";

        img.src = photoImage.url;
        // Make invisible
        img.style.opacity = 0;
        // Append this image to the div
        this.fg.appendChild(img);

        //modification for ShowMessage
        this.sendNotification("IMAGEFILEPATH", img.src);

        /* set the image load error handler
               report the image load failed
               go load the next one with no delay
            */
        img.onerror = (evt) => {
          const eventImage = evt.currentTarget;
          Log.error(
            `image load failed=${eventImage.src}`
          );

          this.showNextPhoto();
          this.updateDom()
        }
        /*
         * Set the onload event handler
         * The loadurl request will happen when the html is returned to MM and inserted into the dom.
         */
        img.onload = (evt) => {
          // Get the image of the event
          const eventImage = evt.currentTarget;

          // What's the size of this image and it's parent
          const w = eventImage.width;
          const h = eventImage.height;
          const tw = document.body.clientWidth + parseInt(m, 10) * 2;
          const th = document.body.clientHeight + parseInt(m, 10) * 2;

          // Compute the new size and offsets
          const result = self.scaleImage(w, h, tw, th, true);

          // Adjust the image size
          eventImage.width = result.width;
          eventImage.height = result.height;

          // Adjust the image position
          eventImage.style.left = `${result.targetleft}px`;
          eventImage.style.top = `${result.targettop}px`;

          // If another image was already displayed
          const c = self.fg.childElementCount;
          if (c > 1) {
            for (let i = 0; i < c - 1; i++) {
              // Hide it
              self.fg.firstChild.style.opacity = 0;
              self.fg.firstChild.style.backgroundColor = "rgba(0,0,0,0)";
              // Remove the image element from the div
              self.fg.removeChild(self.fg.firstChild);
            }
          }
          self.fg.firstChild.style.opacity = self.config.opacity;

          self.fg.firstChild.style.transition = "opacity 1.25s";
          if (self.config.fill === true) {
            self.bk.style.backgroundImage = `url(${self.fg.firstChild.src})`;
          }
          if (!self.suspended) {
            self.startTimer();
          }
        };
      }
    }
    return this.wrapper;
  },

  getScripts() {
    return ["MMM-ImagesPhotos.css"];
  },

  /**
   * Process an updated photo list.
   *
   * Initializes the playback playlist when photos are first
   * received and refreshes the module after the initial load.
   */
  processPhotos(data) {
    const self = this;

    // Save the latest photo list first.
    this.photos = data;

    // Build the playback order after photos exist.
    if (!this.playlist.length && this.photos.length) {
      this.buildPlaylist();
    }

    if (this.loaded === false) {
      if (this.suspended === false) {
        self.updateDom(self.config.animationSpeed);
      }
    }

    this.loaded = true;
  }
});
